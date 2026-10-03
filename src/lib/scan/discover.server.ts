import process from "node:process";

import { extractPage, foldText } from "@/lib/scan/audit/extract";
import { findCuiInText } from "@/lib/scan/audit/signals";
import {
  createRobotsCache,
  normalizeInputUrl,
  resolveHost,
  safeFetch,
  urlBlockReason,
  type RobotsCache,
} from "@/lib/scan/net.server";
import type { WebsiteDiscovery } from "@/lib/scan/types";

/**
 * Finds the company's website when the visitor didn't give one: verify the
 * registry/visitor URL first, then guess domains from the name (DNS first, so
 * non-existent guesses cost nothing), then Brave Search when keyed. A site
 * counts only when the page itself backs it up — the CUI printed on it
 * (strong) or the company name, plus the city (weaker). Only homepages are
 * opened, and never on a site whose robots.txt tells VortexScan to stay away.
 */

export { foldText };

export type DiscoverInput = { cui?: string; name: string; city?: string; knownWebsite?: string };

const LEGAL_TOKENS = new Set([
  "srl",
  "srld",
  "sa",
  "sc",
  "snc",
  "scs",
  "sca",
  "pfa",
  "ii",
  "if",
  "ra",
  "societate",
  "societatea",
  "comerciala",
  "cooperativa",
  "ltd",
  "llc",
  "gmbh",
]);
/** Words companies often drop from their domain. */
const GENERIC_TOKENS = new Set([
  "com",
  "impex",
  "prod",
  "productie",
  "trading",
  "trade",
  "group",
  "grup",
  "international",
  "romania",
  "consulting",
  "serv",
  "invest",
  "holding",
  "company",
  "co",
  "si",
  "and",
  "the",
]);

/** Distinctive lower-case ASCII tokens of a company name, legal form removed. */
export function companyNameTokens(name: string): { all: string[]; core: string[] } {
  const raw = foldText(name)
    .replace(/&/g, " si ")
    .replace(/\./g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  // "S R L" written with spaces → "srl"
  const merged: string[] = [];
  let letters = "";
  for (const token of raw) {
    if (token.length === 1) {
      letters += token;
      continue;
    }
    if (letters) merged.push(letters);
    letters = "";
    merged.push(token);
  }
  if (letters) merged.push(letters);
  const all = merged.filter((token) => !LEGAL_TOKENS.has(token));
  const core = all.filter((token) => !GENERIC_TOKENS.has(token));
  return { all, core: core.length ? core : all };
}

function domainGuesses(name: string): string[] {
  const { all, core } = companyNameTokens(name);
  if (!all.length) return [];
  const labels = new Set<string>();
  const add = (tokens: string[]) => {
    if (!tokens.length) return;
    const joined = tokens.join("");
    if (joined.length >= 3 && joined.length <= 40) labels.add(joined);
    if (tokens.length > 1) {
      const hyphen = tokens.join("-");
      if (hyphen.length <= 40) labels.add(hyphen);
    }
  };
  add(all);
  add(core);
  if (core.length > 2) add(core.slice(0, 2));
  // Brands often keep only their first distinctive word (e.g. "zexe.ro").
  if (core.length >= 2 && core[0].length >= 4) labels.add(core[0]);
  const guesses: string[] = [];
  for (const tld of ["ro", "com"]) {
    for (const label of labels) guesses.push(`${label}.${tld}`);
  }
  // Less common endings, for the full name only.
  const [primary] = labels;
  if (primary) for (const tld of ["eu", "net", "dev"]) guesses.push(`${primary}.${tld}`);
  return guesses.slice(0, 12);
}

const PARKED =
  /domain (is )?for sale|domeniul? (este )?de v[aâ]nzare|buy this domain|this domain (may be|is) for sale|parked (free|domain)|sedoparking|afternic|dan\.com|domain has been registered|default web ?site page|site (în|in) construc[țt]ie|under construction|coming soon|account suspended|cont suspendat/i;

type Verification = {
  url: string;
  host: string;
  confidence: number;
  evidence: string[];
  parked?: boolean;
};

/** Fetches a candidate and scores how well the page proves it belongs to the company. */
async function verifyCandidate(
  url: string,
  input: DiscoverInput,
  origin: string,
  timeoutMs: number,
  robots: RobotsCache,
  /** The URL came from the registry or the visitor, so a namesake is unlikely. */
  trusted = false,
): Promise<Verification | null> {
  let result;
  try {
    if ((await robots.get(new URL(url).origin)).optsOut) return null;
    result = await safeFetch(url, { timeoutMs, maxBytes: 1024 * 1024 });
  } catch {
    return null;
  }
  if (result.status >= 400 || !/html/i.test(result.contentType)) return null;
  const finalUrl = new URL(result.finalUrl);
  const page = extractPage(result.body, finalUrl.href, result.status);
  const host = finalUrl.hostname;
  const evidence = [origin];

  if (PARKED.test(`${page.title ?? ""} ${page.text.slice(0, 3000)}`) && page.wordCount < 400) {
    return {
      url: finalUrl.href,
      host,
      confidence: 0,
      parked: true,
      evidence: [...evidence, "Looks like a parked or placeholder page"],
    };
  }

  const haystack = foldText(
    [page.title, page.og.siteName, page.description, page.text.slice(0, 40_000), page.footerText]
      .filter(Boolean)
      .join(" "),
  );
  const cuiOnPage = findCuiInText(`${page.footerText} ${page.text}`, input.cui);
  let confidence = 0;

  if (input.cui && cuiOnPage === input.cui) {
    confidence = 0.97;
    evidence.push(`CUI ${input.cui} found on the page`);
  } else {
    const { core } = companyNameTokens(input.name);
    const distinctive = core.filter((token) => token.length >= 3);
    const tokens = distinctive.length ? distinctive : core;
    // Longer tokens match as word prefixes so Romanian inflections count ("zahana" → "zahanaua").
    const found = tokens.filter((token) =>
      new RegExp(token.length >= 4 ? `\\b${token}` : `\\b${token}\\b`).test(haystack),
    );
    const share = tokens.length ? found.length / tokens.length : 0;
    if (share === 1) {
      confidence = 0.72;
      evidence.push(`Company name "${tokens.join(" ")}" appears on the page`);
    } else if (share >= 0.6) {
      confidence = 0.55;
      evidence.push(`Most of the company name appears on the page (${found.join(", ")})`);
    }
    const label = foldText(host.replace(/^www\./, "").split(".")[0]).replace(/-/g, "");
    if (confidence > 0 && tokens.length && label.includes(tokens.join("").slice(0, 12))) {
      confidence += 0.05;
      evidence.push(`Domain matches the company name`);
    }
    if (cuiOnPage && input.cui && cuiOnPage !== input.cui) {
      confidence = Math.min(confidence, 0.2);
      evidence.push(`A different CUI (${cuiOnPage}) is printed on the page`);
    }
  }
  let cityMentioned = false;
  if (input.city && confidence > 0) {
    const city = foldText(input.city).replace(
      /^(mun|municipiul|oras|orasul|com|comuna|sat)\.?\s+/,
      "",
    );
    if (city.length >= 3 && haystack.includes(city)) {
      cityMentioned = true;
      confidence += 0.08;
      evidence.push(`City ${input.city} is mentioned`);
    }
  }
  // A name match on a foreign site is usually a namesake, not the Romanian company.
  const romanian =
    host.endsWith(".ro") ||
    page.lang?.startsWith("ro") ||
    page.hreflangs.some((lang) => lang.startsWith("ro")) ||
    cityMentioned ||
    /[ăâîșțşţ]/i.test(page.text.slice(0, 20_000));
  if (!trusted && confidence > 0 && confidence < 0.9 && !romanian) {
    confidence = Math.min(confidence, 0.35);
    evidence.push("The site doesn't look Romanian (namesake?)");
  }
  return { url: finalUrl.href, host, confidence: Math.min(0.99, confidence), evidence };
}

/** Hosts that list companies but are never the company's own site. */
const DIRECTORIES =
  /(^|\.)(listafirme|termene|risco|firme\.info|totalfirme|romanian-companies|infocui|confidas|kompass|facebook|instagram|linkedin|youtube|tiktok|twitter|x\.com|google|wikipedia|olx|emag|booking|tripadvisor|paginiaurii|cylex|firmepenet|lista-firme|eurolista|glassdoor|ejobs|bestjobs|anaf|onrc|mfinante|topfirme|companii|edenred|doctoridue|zilesinopti|restograf|ghidul|okazii|publi24|storia|imobiliare|yelp|foursquare|wanderlog|waze)\./i;

async function braveSearch(input: DiscoverInput): Promise<string[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  const query = [input.name.replace(/\bS\.?\s?R\.?\s?L\.?\b/gi, ""), input.city]
    .filter(Boolean)
    .join(" ");
  const params = new URLSearchParams({ q: query, country: "RO", search_lang: "ro", count: "10" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { accept: "application/json", "x-subscription-token": key },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { web?: { results?: Array<{ url?: string }> } };
    const origins: string[] = [];
    for (const item of data.web?.results ?? []) {
      if (!item.url) continue;
      try {
        const url = new URL(item.url);
        if (DIRECTORIES.test(`${url.hostname}.`) || urlBlockReason(url)) continue;
        if (!origins.includes(url.origin)) origins.push(url.origin);
      } catch {
        continue;
      }
    }
    return origins.slice(0, 3);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const toDiscovery = (match: Verification): WebsiteDiscovery => ({
  url: match.url,
  host: match.host,
  confidence: Number(match.confidence.toFixed(2)),
  evidence: match.evidence,
});

const ACCEPT = 0.45;

export async function discoverWebsite(input: DiscoverInput): Promise<WebsiteDiscovery | null> {
  let fallback: WebsiteDiscovery | null = null;
  const robots = createRobotsCache();
  // DNS for the name guesses runs while the listed site is checked; it never touches the sites.
  const resolving = Promise.all(
    domainGuesses(input.name).map(async (domain) => {
      const answer = await resolveHost(domain);
      return answer && !answer.nxdomain ? domain : null;
    }),
  );

  // 1. The website we were given (Trade Register or the visitor).
  if (input.knownWebsite) {
    const known = normalizeInputUrl(input.knownWebsite);
    if (known && !urlBlockReason(known)) {
      const match = await verifyCandidate(
        known.href,
        input,
        "Website listed for this company",
        8000,
        robots,
        true,
      );
      if (match && match.confidence >= 0.6) return toDiscovery(match);
      if (match && match.confidence >= ACCEPT) fallback = toDiscovery(match);
      else if (match && !match.parked) {
        fallback = toDiscovery({
          ...match,
          confidence: ACCEPT,
          evidence: [...match.evidence, "The page doesn't clearly mention the company name or CUI"],
        });
      } else if (!match) {
        // Still worth auditing: a listed site that is down is a finding in itself.
        fallback = {
          url: known.href,
          host: known.hostname,
          confidence: 0.3,
          evidence: ["Website listed for this company", "It did not respond when we checked"],
        };
      }
    }
  }

  // 2. Domains guessed from the name; DNS weeded out the ones that don't exist.
  const live = (await resolving)
    .filter((domain): domain is string => Boolean(domain))
    .filter((domain) => !fallback || fallback.host.replace(/^www\./, "") !== domain)
    .slice(0, 4);
  const guessed = await Promise.all(
    live.map((domain) =>
      verifyCandidate(
        `https://${domain}/`,
        input,
        `Guessed from the name: ${domain}`,
        6000,
        robots,
      ),
    ),
  );
  const pick = (matches: Array<Verification | null>) =>
    matches
      .filter((match): match is Verification => Boolean(match) && match!.confidence >= ACCEPT)
      .sort((a, b) => b.confidence - a.confidence)[0];
  const best = pick(guessed);
  if (best && best.confidence > (fallback?.confidence ?? 0)) return toDiscovery(best);
  if (fallback && fallback.confidence >= ACCEPT) return fallback;

  // 3. Web search as a last resort.
  const searched = await braveSearch(input);
  if (searched.length) {
    const top = pick(
      await Promise.all(
        searched.map((origin) =>
          verifyCandidate(origin, input, "Found via web search", 6000, robots),
        ),
      ),
    );
    if (top) return toDiscovery(top);
  }

  return fallback;
}

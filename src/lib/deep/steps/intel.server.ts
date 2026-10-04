import type { Fact, Gap, ReserveResult } from "../contracts";
import type { SocialLinks, StepEnv } from "../env.server";
import { bi, count } from "../parse/format";
import { fold } from "../parse/text";

import { paidCall } from "../llm/paid.server";
import type { LlmMessage } from "../llm/types";

import { fact, gap } from "./common.server";

/*
 * Active intelligence inside the "signals" step: recent press coverage
 * (Google News RSS, last 24 months), social profiles found by web search
 * (not only the ones the website links to) and one Claude web-search profile.
 * Social networks and link pages (Linktree and the like) are never fetched:
 * the search result URL is the evidence, marked "probabil" when the handle
 * or title matches the brand. Every request has a timeout and reads at most
 * MAX_BYTES; a source that fails becomes a gap, never an error of the step.
 */

const UA =
  "Mozilla/5.0 (compatible; VortexScan/1.0; +https://vortexhub.dev/privacy#vortex-scan-bot)";
const LEGAL_WORDS =
  /\b(s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?|s\.?\s?c\.?|srl-d|pfa|i\.?\s?i\.?|i\.?\s?f\.?|company|impex|com|prod|trading|grup|group|romania)\b/gi;

export function brandOf(name: string): string {
  return name
    .replace(LEGAL_WORDS, " ")
    .replace(/[^\p{L}\p{N}&\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function brandTokens(brand: string): string[] {
  return fold(brand)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export type NewsItem = {
  title: string;
  url: string;
  date: string;
  outlet?: string;
  tone: "risk" | "growth" | "neutral";
};

const RISK_WORDS =
  /insolven|faliment|amend|sanc[tț]i|anchet|perchezi|dosar|fraud|evaziun|scandal|reclama[tț]i|anpc|inchis|închis|concedier|datori|executare|controvers/i;
const GROWTH_WORDS =
  /investi|lanseaz|lansare|extinde|deschide|achizi|finan[tț]are|cre[sș]tere|record|premiu|parteneriat|export|fonduri|angajeaz|nou magazin|inaugur|dezvolt|complex comercial/i;

export function parseNewsRss(xml: string, tokens: string[], sinceMs: number): NewsItem[] {
  const out: NewsItem[] = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1];
    const raw = decode(body.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const url = decode(body.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const pub = body.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    const outlet = decode(body.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "") || undefined;
    if (!raw || !url || !pub) continue;
    const time = Date.parse(pub);
    if (!Number.isFinite(time) || time < sinceMs) continue;
    const title = outlet && raw.endsWith(` - ${outlet}`) ? raw.slice(0, -outlet.length - 3) : raw;
    const folded = fold(title);
    // Every word of the brand: one common word ("auto", "construct") would attach other
    // companies' news, and a "risk" headline about them, to this one.
    if (!tokens.length || !tokens.every((t) => folded.includes(t))) continue;
    const key = folded.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: title.slice(0, 200),
      url: url.slice(0, 600),
      date: new Date(time).toISOString().slice(0, 10),
      outlet: outlet?.slice(0, 80),
      tone: RISK_WORDS.test(title) ? "risk" : GROWTH_WORDS.test(title) ? "growth" : "neutral",
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
}

/** Bytes read from one answer (an RSS feed, a search page); the rest is never downloaded. */
export const MAX_BYTES = 1_500_000;

/** The body as text, reading at most `cap` bytes (the stream is cancelled past it). */
export async function readCapped(response: Response, cap = MAX_BYTES): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = cap - total;
    if (value.byteLength >= room) {
      text += decoder.decode(value.subarray(0, room), { stream: true });
      await reader.cancel().catch(() => undefined);
      break;
    }
    total += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchText(env: StepEnv, url: string, init?: RequestInit): Promise<string | null> {
  if (env.deadline - env.now() < 5000) return null;
  try {
    const res = await env.fetch(url, {
      ...init,
      headers: {
        "user-agent": UA,
        "accept-language": "ro-RO,ro;q=0.9,en;q=0.6",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(Math.min(10_000, env.deadline - env.now() - 2000)),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }
    return await readCapped(res);
  } catch (error) {
    env.log({ intel: url.slice(0, 60), error: String((error as Error)?.message ?? error) });
    return null;
  }
}

export async function searchNews(env: StepEnv): Promise<NewsItem[] | null> {
  const brand = brandOf(env.identity.name);
  const tokens = brandTokens(brand);
  // No word to search by: not searched, so a gap (never "no press coverage").
  if (!tokens.length) return null;
  const since = env.now() - 730 * 86_400_000;
  const queries = [
    `"${brand}"`,
    env.identity.city ? `"${brand}" ${env.identity.city}` : null,
  ].filter(Boolean) as string[];
  const all = new Map<string, NewsItem>();
  let answered = false;
  for (const q of queries) {
    const xml = await fetchText(
      env,
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ro&gl=RO&ceid=RO:ro`,
    );
    if (xml === null) continue;
    answered = true;
    for (const item of parseNewsRss(xml, tokens, since))
      all.set(fold(item.title).slice(0, 60), item);
  }
  if (!answered) return null;
  return [...all.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
}

/** Result links from DuckDuckGo's HTML page (redirect links unwrapped). */
export function parseSearchLinks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href=["']([^"']*[?&]uddg=[^"']+)["']/g)) {
    const uddg = decode(m[1]).match(/[?&]uddg=([^&]+)/);
    if (!uddg) continue;
    try {
      const href = decodeURIComponent(uddg[1]);
      if (!out.includes(href)) out.push(href);
    } catch {
      // malformed link
    }
  }
  return out;
}

export type FoundProfile = { platform: string; url: string; via: "search" | "ai_search" };

const SOCIAL_SITES = [
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "linkedin.com/company",
  "youtube.com",
];

function handleMatches(url: string, tokens: string[]): boolean {
  // The handle must start with the brand and add little else (rejects "brandvenezia" lookalikes
  // only partly, so profiles stay "probabil" with a check-at-source note).
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    return false; // a malformed link is skipped, never the whole search
  }
  const segment = fold(path)
    .split("/")
    .filter((p) => p && !["company", "pages", "channel", "c", "user"].includes(p))[0]
    ?.replace(/[^a-z0-9]/g, "");
  if (!segment) return false;
  const joined = tokens.join("");
  return segment.startsWith(joined) && segment.length <= joined.length + 6;
}

/**
 * Social profiles from two web searches on the brand. Only the result links are used: no
 * profile page and no link page (Linktree and the like) is ever fetched.
 */
export async function discoverSocial(env: StepEnv): Promise<FoundProfile[] | null> {
  const brand = brandOf(env.identity.name);
  const tokens = brandTokens(brand);
  if (!tokens.length) return null;
  const found = new Map<string, FoundProfile>();
  let answered = false;
  const q = `"${brand}" (${SOCIAL_SITES.map((s) => `site:${s}`).join(" OR ")})`;
  for (const query of [q, `${brand} instagram facebook tiktok`]) {
    const html = await fetchText(
      env,
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}&kl=ro-ro`,
    );
    if (html === null) continue;
    answered = true;
    for (const link of parseSearchLinks(html)) {
      const match = env.social.classify(link);
      if (!match?.profile || found.has(match.platform)) continue;
      if (!handleMatches(link, tokens)) continue;
      found.set(match.platform, {
        platform: match.platform,
        url: env.social.normalize(link),
        via: "search",
      });
    }
  }
  if (!answered) return null;
  return [...found.values()];
}

/** Brand + site domain merged with what the AI profile found (search links win per platform). */
export function mergeSocial(
  a: FoundProfile[] | null,
  b: FoundProfile[] | undefined,
): FoundProfile[] | null {
  if (!a && !b) return null;
  const out = new Map<string, FoundProfile>();
  for (const p of [...(a ?? []), ...(b ?? [])]) if (!out.has(p.platform)) out.set(p.platform, p);
  return [...out.values()];
}

export type ProfileItem = { text: string; source: string };
export type CompanyProfile = {
  social: FoundProfile[];
  tradeNames: ProfileItem[];
  people: Array<ProfileItem & { role: string }>;
  customers: ProfileItem[];
  reviews: ProfileItem[];
  ads: ProfileItem[];
  events: ProfileItem[];
  /** Seller pages on marketplaces (eMAG, OLX, Vinted...). */
  marketplaces: ProfileItem[];
  /** Physical shops / work points, distinct from the registered seat. */
  stores: ProfileItem[];
  /** Company phone numbers published in directories or on its own pages. */
  phones: ProfileItem[];
  /** Signs the company's own website is compromised, hijacked or SEO-spammed. */
  siteAlerts: ProfileItem[];
  /** Assets: OSIM/EUIPO trademarks, SEAP/SICAP contracts, EU funds, linked domains, mobile apps. */
  trademarks: ProfileItem[];
  publicContracts: ProfileItem[];
  euFunds: ProfileItem[];
  domains: ProfileItem[];
  apps: ProfileItem[];
  /** Presence: follower counts and open job ads. */
  followers: ProfileItem[];
  jobs: ProfileItem[];
  /** Other companies the key people run or own (public business roles only). */
  network: Array<{ person: string; company: string; cui?: string; role: string; source: string }>;
};

function siteDomain(env: StepEnv): string | undefined {
  const raw = env.identity.registrySite ?? env.identity.hintSite;
  if (!raw) return undefined;
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** URLs the web search really returned (every claim must cite one of them). */
function searchedUrls(content: Array<Record<string, unknown>>): Set<string> {
  const urls = new Set<string>();
  for (const block of content) {
    // An error answer is an object, a success a list of results.
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const r of block.content as Array<Record<string, unknown>>)
      if (typeof r.url === "string") urls.add(r.url.replace(/\/+$/, ""));
  }
  return urls;
}

/**
 * A profile URL as a comparable key: host without www/m, lowercased path without the trailing
 * slash (Facebook's profile.php keeps its id). Null for anything that is not a URL.
 */
function profileKey(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, "");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    const id = path.endsWith("/profile.php") ? `?id=${u.searchParams.get("id") ?? ""}` : "";
    return `${host}${path}${id}`;
  } catch {
    return null;
  }
}

/** The search returned this profile, or a page on it ("/brand/p/…" for "/brand", never "/brandx"). */
function profileReturned(url: string, seen: Set<string>): boolean {
  const key = profileKey(url);
  if (!key) return false;
  for (const s of seen) {
    const k = profileKey(s);
    if (k && (k === key || k.startsWith(`${key}/`))) return true;
  }
  return false;
}

/** Web searches the profile call may run, and their price ($10 per 1,000, not in the token price). */
export const PROFILE_SEARCHES = 5;
export const SEARCH_FEE_USD = 0.01;
/**
 * Input tokens the profile call may bill: the server's search loop reads the prompt and every
 * result so far on each of its turns (about 1,500 + 15,000 a search, summed over the turns),
 * plus a quarter. With 5 searches: about 290,000 (about $0.29 on Haiku 4.5).
 */
export const PROFILE_INPUT_TOKENS = Math.ceil(
  ((PROFILE_SEARCHES + 1) * 1_500 + (15_000 * PROFILE_SEARCHES * (PROFILE_SEARCHES + 1)) / 2) *
    1.25,
);
const PROFILE_MAX_TOKENS = 2400;
const ZERO_USAGE = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

/** Searches a response ran: the usage count, or the search calls in its content. */
export function searchesRun(message: Pick<LlmMessage, "usage" | "content">): number {
  const usage = message.usage as { server_tool_use?: { web_search_requests?: unknown } };
  const counted = Number(usage?.server_tool_use?.web_search_requests);
  const calls = message.content.filter(
    (b) => b.type === "server_tool_use" && (b as { name?: unknown }).name === "web_search",
  ).length;
  return Math.max(Number.isFinite(counted) ? counted : 0, calls);
}

const LISTS = [
  "tradeNames",
  "people",
  "customers",
  "reviews",
  "ads",
  "events",
  "marketplaces",
  "stores",
  "phones",
  "siteAlerts",
  "trademarks",
  "publicContracts",
  "euFunds",
  "domains",
  "apps",
  "followers",
  "jobs",
] as const;
type ListKey = Exclude<(typeof LISTS)[number], "people">;

/** One "network" entry: another company a key person runs, citing a returned result. */
function networkEntry(
  i: Record<string, unknown>,
  source: string | null,
  self?: { name: string; cui: string },
): CompanyProfile["network"] {
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const person = str(i.person, 80);
  const company = str(i.company, 120);
  const role = str(i.role, 60);
  const cui = str(i.cui, 14).replace(/^RO\s*/i, "");
  if (!source || !person || !company || !role) return [];
  if (self && (company.toLowerCase() === self.name.toLowerCase() || cui === self.cui)) return [];
  return [{ person, company, role, source, ...(/^\d{2,10}$/.test(cui) ? { cui } : {}) }];
}

/**
 * The profile from the model's answer: the JSON of its final text (the text blocks after the
 * last search, joined as they are: citations split a sentence into several blocks), each item
 * kept only when it cites a URL the search returned, each social profile only when the search
 * returned it (or a page on it). Null when there is no JSON object to read.
 */
export function parseProfile(
  content: Array<Record<string, unknown>>,
  links: SocialLinks,
  self?: { name: string; cui: string },
): CompanyProfile | null {
  const seen = searchedUrls(content);
  const lastSearch = content.reduce(
    (at, b, i) => (b.type === "web_search_tool_result" || b.type === "server_tool_use" ? i : at),
    -1,
  );
  const textOf = (blocks: Array<Record<string, unknown>>) =>
    blocks.map((b) => (b.type === "text" && typeof b.text === "string" ? b.text : "")).join("");
  const readJson = (text: string): Record<string, unknown> | null => {
    const from = text.indexOf("{");
    const to = text.lastIndexOf("}");
    if (from < 0 || to <= from) return null;
    try {
      const v: unknown = JSON.parse(text.slice(from, to + 1));
      return v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const raw = readJson(textOf(content.slice(lastSearch + 1))) ?? readJson(textOf(content));
  if (!raw) return null;
  const cited = (u: unknown) =>
    typeof u === "string" && seen.has(u.trim().replace(/\/+$/, "")) ? u.trim().slice(0, 600) : null;
  const list = (key: (typeof LISTS)[number], withRole = false) =>
    (Array.isArray(raw[key]) ? (raw[key] as unknown[]) : []).slice(0, 4).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const i = entry as Record<string, unknown>;
      const source = cited(i.source);
      const t = typeof i.text === "string" ? i.text.trim().slice(0, 200) : "";
      if (!source || !t) return [];
      const role = typeof i.role === "string" ? i.role.trim().slice(0, 60) : "";
      if (withRole && !role) return [];
      return [{ text: t, source, ...(withRole ? { role } : {}) }];
    });
  const social: FoundProfile[] = [];
  for (const entry of Array.isArray(raw.social) ? (raw.social as unknown[]) : []) {
    const u = entry && typeof entry === "object" ? (entry as Record<string, unknown>).url : null;
    if (typeof u !== "string") continue;
    const match = links.classify(u);
    if (!match?.profile || social.some((p) => p.platform === match.platform)) continue;
    if (!profileReturned(u, seen)) continue;
    social.push({ platform: match.platform, url: links.normalize(u), via: "ai_search" });
  }
  const lists = Object.fromEntries(
    LISTS.filter((k): k is ListKey => k !== "people").map((k) => [k, list(k)]),
  ) as Record<ListKey, ProfileItem[]>;
  const network = (Array.isArray(raw.network) ? (raw.network as unknown[]) : [])
    .slice(0, 8)
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const i = entry as Record<string, unknown>;
      return networkEntry(i, cited(i.source), self);
    });
  return {
    social,
    ...lists,
    people: list("people", true) as CompanyProfile["people"],
    network,
  };
}

/** A profile replayed from the ledger (a retried step): the same shape, checked again. */
function replayedProfile(result: unknown): CompanyProfile | null {
  const p = (result as { profile?: unknown } | null)?.profile;
  if (!p || typeof p !== "object") return null;
  const r = p as Record<string, unknown>;
  const items = (v: unknown, withRole = false) =>
    (Array.isArray(v) ? v : []).flatMap((i) => {
      const o = i as Record<string, unknown> | null;
      if (!o || typeof o.text !== "string" || typeof o.source !== "string") return [];
      if (withRole && typeof o.role !== "string") return [];
      return [
        {
          text: o.text.slice(0, 200),
          source: o.source.slice(0, 600),
          ...(withRole ? { role: String(o.role).slice(0, 60) } : {}),
        },
      ];
    });
  const social = (Array.isArray(r.social) ? r.social : []).flatMap((i) => {
    const o = i as Record<string, unknown> | null;
    return o && typeof o.platform === "string" && typeof o.url === "string"
      ? [{ platform: o.platform, url: o.url.slice(0, 600), via: "ai_search" as const }]
      : [];
  });
  const lists = Object.fromEntries(
    LISTS.filter((k): k is ListKey => k !== "people").map((k) => [k, items(r[k])]),
  ) as Record<ListKey, ProfileItem[]>;
  const network = (Array.isArray(r.network) ? r.network : []).flatMap((i) => {
    const o = i as Record<string, unknown> | null;
    return o && typeof o.source === "string" ? networkEntry(o, o.source.slice(0, 600)) : [];
  });
  return {
    social,
    ...lists,
    people: items(r.people, true) as CompanyProfile["people"],
    network,
  };
}

/**
 * One Claude call with web search (at most PROFILE_SEARCHES searches), billed through the run
 * ledger like every paid call: the tokens through paidCall (run budget, day budget, breaker,
 * replay of a settled answer instead of paying twice), and the search fee, which the token
 * price does not include, as its own reservation, settled at the searches really run. The
 * brand's social profiles, trade names, public key people, who its customers are, review
 * standing, ads and notable events. Anything without a source the search really returned is
 * dropped (parseProfile). Null when it did not run or did not answer: the step goes on.
 */
export async function claudeProfile(env: StepEnv): Promise<CompanyProfile | null> {
  const llm = env.llm;
  if (!llm || env.deadline - env.now() < 15_000) return null;
  const model = llm.models.extraction;
  const brand = brandOf(env.identity.name);
  const where = [env.identity.city, env.identity.county].filter(Boolean).join(", ");
  const domain = siteDomain(env);
  const prompt = `Research the Romanian company "${env.identity.name}" (CUI ${env.cui}${where ? `, ${where}` : ""}${domain ? `, website ${domain}` : ""}). Its trade name may be "${brand}" or a different brand${domain ? ` (try "${domain}" too)` : ""}. Use web search (at most ${PROFILE_SEARCHES} searches). Only report what the search results show about THIS company (same city, website, CUI or activity); ignore lookalikes abroad.
Reply with ONLY this JSON, every item citing the exact result URL it came from:
{"social":[{"url":"profile url (instagram/facebook/tiktok/linkedin company/youtube)"}],
"tradeNames":[{"text":"brand","source":"url"}],
"people":[{"role":"administrator/founder/CEO...","text":"name and one public fact","source":"url"}],
"customers":[{"text":"who buys (B2B/B2C, segment, price level)","source":"url"}],
"reviews":[{"text":"rating/review standing with numbers if shown","source":"url"}],
"ads":[{"text":"advertising seen (Meta, Google, campaigns)","source":"url"}],
"events":[{"text":"notable event with date (openings, partnerships, launches)","source":"url"}],
"marketplaces":[{"text":"platform + seller name (eMAG, OLX, Vinted, Etsy, Amazon...)","source":"seller page url"}],
"stores":[{"text":"physical shop / work point address or place, if different from the registered seat","source":"url"}],
"phones":[{"text":"company phone as published","source":"url"}],
"siteAlerts":[{"text":"sign the company's website is hacked, hijacked, expired or shows unrelated spam (casino, betting, foreign language)","source":"url"}],
"trademarks":[{"text":"trademark name, office (OSIM/EUIPO/WIPO), number/status","source":"url"}],
"publicContracts":[{"text":"Romanian public contract (SEAP/SICAP/e-licitatie): buyer, object, value, year","source":"url"}],
"euFunds":[{"text":"EU or state funding: program, amount, year","source":"url"}],
"domains":[{"text":"other website/domain the company runs","source":"url"}],
"apps":[{"text":"mobile app name and store","source":"url"}],
"followers":[{"text":"network + follower count as shown in the result","source":"url"}],
"jobs":[{"text":"open job ad: role, city, platform (eJobs, BestJobs, LinkedIn)","source":"url"}],
"network":[{"person":"key person's name","company":"another Romanian company they administer, found or own","cui":"its CUI if shown","role":"administrator/shareholder/founder","source":"url"}]}
Search steps: 1) the legal name and the brand on Romanian company directories (termene.ro, listafirme.ro, datasrl.ro, risco.ro, bizinfo.ro) to get administrators, phone and work points; 2) the brand plus the city on Instagram, TikTok, Facebook; 3) the legal name or CUI on emag.ro and other marketplaces; 4) the website domain, to see what it shows now; 5) the legal name on OSIM/EUIPO trademark search, SEAP/e-licitatie and EU-funds lists; 6) the brand on eJobs/BestJobs and app stores; follower counts only as shown in search results.
For "network", search the key people's names for OTHER companies they run; public business roles only, never home addresses or private contacts. Phones: only numbers the company publishes for itself.
Use empty arrays when unknown. Max 4 items per list (8 for network), each text under 160 characters.`;
  const idemKey = `${env.runId}|${env.step}|profile-search`;
  // The search fee first: without room for it in the run and the day, no call is sent.
  let fee: ReserveResult;
  try {
    fee = await env.ledger.reserve({
      runId: env.runId,
      idemKey: `${idemKey}|fee`,
      kind: "llm",
      step: env.step,
      model: "web_search",
      usd: PROFILE_SEARCHES * SEARCH_FEE_USD,
      dayCapUsd: env.ledger.dayCapUsd,
    });
  } catch {
    return null;
  }
  if (!fee.ok) {
    env.log({ intel: "claude-profile", refused: fee.reason });
    return null;
  }
  const feeCallId = fee.callId;
  let searches = 0;
  // false: the call may have run searches we cannot count (a timeout, a cut answer): the fee
  // stays reserved and counts as spent at finish, as the tokens do.
  let settleFee = true;
  try {
    const outcome = await paidCall({
      ledger: env.ledger,
      runId: env.runId,
      step: env.step,
      idemKey,
      plan: {
        model,
        inputTokens: PROFILE_INPUT_TOKENS,
        maxTokens: PROFILE_MAX_TOKENS,
        fallback: false,
      },
      floor: 800,
      exec: (maxTokens) =>
        llm.transport.create(
          {
            model,
            max_tokens: maxTokens,
            messages: [{ role: "user", content: prompt }],
            tools: [
              { type: "web_search_20250305", name: "web_search", max_uses: PROFILE_SEARCHES },
            ],
          },
          { timeoutMs: Math.max(10_000, env.deadline - env.now() - 2000) },
        ),
      // A retried step gets the same profile back instead of paying for a second search.
      toReplay: (message) => ({
        profile: parseProfile(message.content as Array<Record<string, unknown>>, env.social, {
          name: env.identity.name,
          cui: env.cui,
        }),
      }),
      deadline: env.deadline,
      now: env.now,
      log: env.log,
    });
    if (outcome.kind === "replay") return replayedProfile(outcome.result);
    if (outcome.kind === "error") {
      settleFee = outcome.error.billedNothing;
      return null;
    }
    if (outcome.kind !== "ok") return null;
    searches = searchesRun(outcome.message);
    return parseProfile(outcome.message.content as Array<Record<string, unknown>>, env.social, {
      name: env.identity.name,
      cui: env.cui,
    });
  } catch (error) {
    settleFee = false;
    env.log({ intel: "claude-profile", error: String((error as Error)?.message ?? error) });
    return null;
  } finally {
    if (settleFee) {
      await env.ledger
        .settle({ callId: feeCallId, usd: searches * SEARCH_FEE_USD, usage: ZERO_USAGE })
        .catch(() => undefined);
    }
  }
}

/** The gap when the AI web-search profile was expected (AI on) and did not come. */
export function profileGap(today: string): Gap {
  return gap(
    "presence",
    bi("Company profile from AI web search", "Profilul firmei din căutarea web cu AI"),
    bi(
      "The AI web search did not run or did not answer in time",
      "Căutarea web cu AI nu a rulat sau nu a răspuns la timp",
    ),
    today,
  );
}

const PROFILE_PARTS: Array<{
  key: Exclude<keyof CompanyProfile, "social" | "network">;
  section: "identity" | "people" | "presence" | "risk";
  label: [string, string];
}> = [
  { key: "tradeNames", section: "identity", label: ["Trade name", "Nume comercial"] },
  { key: "people", section: "people", label: ["Key person", "Persoană-cheie"] },
  { key: "customers", section: "presence", label: ["Customers", "Clienți"] },
  { key: "reviews", section: "presence", label: ["Reviews", "Recenzii"] },
  { key: "ads", section: "presence", label: ["Advertising", "Publicitate"] },
  { key: "events", section: "presence", label: ["Event", "Eveniment"] },
  { key: "marketplaces", section: "presence", label: ["Marketplace", "Marketplace"] },
  { key: "stores", section: "identity", label: ["Shop", "Magazin"] },
  { key: "phones", section: "identity", label: ["Phone", "Telefon"] },
  { key: "siteAlerts", section: "risk", label: ["Website alert", "Alertă site"] },
  { key: "trademarks", section: "identity", label: ["Trademark", "Marcă"] },
  { key: "publicContracts", section: "risk", label: ["Public contract", "Contract public"] },
  { key: "euFunds", section: "risk", label: ["Funding", "Finanțare"] },
  { key: "domains", section: "presence", label: ["Domain", "Domeniu"] },
  { key: "apps", section: "presence", label: ["App", "Aplicație"] },
  { key: "followers", section: "presence", label: ["Followers", "Urmăritori"] },
  { key: "jobs", section: "presence", label: ["Job ad", "Anunț de angajare"] },
];

export function profileFacts(profile: CompanyProfile | null, today: string): Fact[] {
  if (!profile) return [];
  const facts: Fact[] = [];
  for (const part of PROFILE_PARTS) {
    profile[part.key].forEach((item, i) => {
      const role = "role" in item ? `${(item as { role: string }).role}: ` : "";
      facts.push(
        fact({
          id: `profile.${part.key}.${i}`,
          section: part.section,
          predicate: `profile.${part.key}`,
          value: { text: item.text, source: item.source },
          display: bi(`${role}${item.text}`, `${role}${item.text}`),
          source: "web_search",
          asOf: today,
          confidence: "probabil",
          score: 0.7,
          method: "llm",
          gdpr: part.key === "people" ? "G1" : "G0",
          adverse: part.key === "siteAlerts" ? true : undefined,
          evidence: {
            url: item.source,
            note: bi(
              "Found by AI web search, with the page it came from; check at the source.",
              "Găsit prin căutare web cu AI, cu pagina-sursă; verifică la sursă.",
            ),
          },
        }),
      );
    });
  }
  profile.network.forEach((n, i) => {
    const line = `${n.person} — ${n.role}, ${n.company}${n.cui ? ` (CUI ${n.cui})` : ""}`;
    facts.push(
      fact({
        id: `people.network.${i}`,
        section: "people",
        predicate: "people.network",
        value: {
          person: n.person,
          company: n.company,
          cui: n.cui ?? null,
          role: n.role,
          source: n.source,
        },
        display: bi(line, line),
        source: "web_search",
        asOf: today,
        confidence: "probabil",
        score: 0.65,
        method: "llm",
        gdpr: "G1",
        evidence: {
          url: n.source,
          note: bi(
            "Other company of a key person, found by AI web search; check at the source.",
            "Altă firmă a unei persoane-cheie, găsită prin căutare web cu AI; verifică la sursă.",
          ),
        },
      }),
    );
  });
  return facts;
}

const PLATFORM: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  x: "X",
  "google-business": "Google",
};

export function intelFacts(
  news: NewsItem[] | null,
  social: FoundProfile[] | null,
  today: string,
): { facts: Fact[]; gaps: Gap[] } {
  const facts: Fact[] = [];
  const gaps: Gap[] = [];
  if (news) {
    const risk = news.filter((n) => n.tone === "risk").length;
    const growth = news.filter((n) => n.tone === "growth").length;
    facts.push(
      fact({
        id: "presence.news.count",
        section: "presence",
        predicate: "presence.news.count",
        value: { total: news.length, risk, growth, latest: news[0]?.date ?? null },
        display: news.length
          ? bi(
              `${news.length} press articles in 24 months (${growth} growth, ${risk} risk), latest ${news[0].date}`,
              `${news.length} articole de presă în 24 de luni (${growth} de creștere, ${risk} de risc), ultimul ${news[0].date}`,
            )
          : bi(
              "No press coverage found in 24 months",
              "Nicio apariție în presă în ultimele 24 de luni",
            ),
        source: "news",
        asOf: today,
        confidence: "probabil",
        method: "api",
        evidence: { url: "https://news.google.com" },
      }),
    );
    news.forEach((n, i) => {
      const tag =
        n.tone === "risk" ? ["risk", "risc"] : n.tone === "growth" ? ["growth", "creștere"] : null;
      facts.push(
        fact({
          id: `presence.news.item.${i}`,
          section: "presence",
          predicate: "presence.news.item",
          value: { title: n.title, date: n.date, outlet: n.outlet ?? null, tone: n.tone },
          display: bi(
            `${n.date}${n.outlet ? ` · ${n.outlet}` : ""}${tag ? ` [${tag[0]}]` : ""}: ${n.title}`,
            `${n.date}${n.outlet ? ` · ${n.outlet}` : ""}${tag ? ` [${tag[1]}]` : ""}: ${n.title}`,
          ),
          source: "news",
          asOf: n.date,
          confidence: "probabil",
          score: 0.75,
          method: "api",
          adverse: n.tone === "risk" ? true : undefined,
          evidence: { url: n.url },
        }),
      );
    });
  } else {
    gaps.push(
      gap(
        "presence",
        bi("Press coverage", "Apariții în presă"),
        bi("The news search did not answer", "Căutarea de știri nu a răspuns"),
        today,
        "https://news.google.com",
      ),
    );
  }
  if (social) {
    facts.push(
      fact({
        id: "presence.social_found.count",
        section: "presence",
        predicate: "presence.social_found",
        value: social.map((s) => s.platform),
        display: social.length
          ? bi(
              `Found by search: ${social.map((s) => PLATFORM[s.platform] ?? s.platform).join(", ")}`,
              `Găsite prin căutare: ${social.map((s) => PLATFORM[s.platform] ?? s.platform).join(", ")}`,
            )
          : bi("No social profiles found by search", "Niciun profil social găsit prin căutare"),
        short: count(social.length),
        source: "web_search",
        asOf: today,
        confidence: "probabil",
        method: "html",
      }),
    );
    for (const s of social) {
      facts.push(
        fact({
          id: `presence.social_found.${s.platform}`,
          section: "presence",
          predicate: "presence.social_profile",
          value: { platform: s.platform, url: s.url, via: s.via },
          display: bi(
            `${PLATFORM[s.platform] ?? s.platform}: ${s.url}`,
            `${PLATFORM[s.platform] ?? s.platform}: ${s.url}`,
          ),
          source: "web_search",
          asOf: today,
          confidence: "probabil",
          score: 0.75,
          method: "html",
          evidence: {
            url: s.url,
            note: bi(
              "Found by web search on the brand name; check it is the company's page.",
              "Găsit prin căutare după numele brandului; verifică dacă e pagina firmei.",
            ),
          },
        }),
      );
    }
  } else {
    gaps.push(
      gap(
        "presence",
        bi("Social profiles by search", "Profiluri sociale prin căutare"),
        bi("The web search did not answer", "Căutarea web nu a răspuns"),
        today,
      ),
    );
  }
  return { facts, gaps };
}

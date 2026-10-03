import type { Bilingual, Fact, Gap, WebsiteStatus } from "../contracts";
import type { StepEnv } from "../env.server";
import { bi } from "../parse/format";
import { extractPageLite, type PageLite } from "../parse/page";
import { textProvesCompany } from "../parse/registry";
import { fold } from "../parse/text";
import {
  classifyPageUrl,
  companyNameTokens,
  detectParked,
  domainGuesses,
  isSocialOrDirectoryHost,
  siteHost,
} from "../parse/web";

import { fact, gap, isoDay, type StepDraft } from "./common.server";
import type { PolitePage, PoliteResult } from "./polite.server";

/*
 * Step 2, "site" (plan A3, B4): which website is the company's, and in what
 * state. Candidates: the Trade Register's website, the quick scan's verified
 * site, the visitor's answer, then every live guessed domain (.ro and .dev
 * first; DNS first, so non-existent guesses cost no page request). A site
 * counts as the company's only with server-side proof: its CUI or either J
 * number format on a page, or the registry listing; a visitor's "Da" needs a
 * name match with Romanian content. Broken certificates (with an http retry),
 * parked or for-sale pages, dead domains and bot walls are findings in their
 * own right. The verified homepage is sealed into the cursor so the audit does
 * not fetch it again (homepage once per run).
 */

export type SiteCursor = {
  v: 1;
  origin: string;
  status: WebsiteStatus;
  home?: {
    url: string;
    requestedUrl: string;
    status: number;
    headers: Record<string, string>;
    ttfbMs: number;
    redirects: string[];
    html: string;
    tlsFailed?: boolean;
  };
  robots?: { origin: string; status: number; body: string };
  /** Pages already read by this step (proof pages), canonical URLs. */
  read: string[];
  /** Earliest next request per host: spacing holds across steps. */
  schedule?: Record<string, number>;
};

type Verdict = {
  url: string;
  origin: string;
  host: string;
  status: WebsiteStatus;
  proof?: "cui" | "reg_no" | "registry" | "name";
  confidence: number;
  evidence: Bilingual[];
  page?: PolitePage;
  lite?: PageLite;
  tlsFailed?: boolean;
  from: "registry" | "hint" | "visitor" | "guess";
  reason?: string;
};

/** The sealed homepage snapshot travels in the cursor (not attested, not counted in the 48 KB of facts). */
const SNAPSHOT_MAX_SEALED = 48_000;

/**
 * Removes what the checks do not read (style and svg bodies, comments, JSON
 * data islands, inline data: images) so the homepage fits in the cursor.
 */
export function stripForSnapshot(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "<style></style>")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "<svg></svg>")
    .replace(/<script\b[^>]*type=["']application\/json["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]{100,}/g, "data:image/x;base64,")
    .replace(/\s{2,}/g, " ")
    .slice(0, 220_000);
}

function nameEvidence(lite: PageLite, name: string, city?: string) {
  const haystack = fold(
    [lite.title, lite.description, lite.text.slice(0, 40_000), lite.footerText]
      .filter(Boolean)
      .join(" "),
  );
  const { core } = companyNameTokens(name);
  const tokens = core.filter((t) => t.length >= 3);
  const used = tokens.length ? tokens : core;
  const found = used.filter((t) =>
    new RegExp(t.length >= 4 ? `\\b${t}` : `\\b${t}\\b`).test(haystack),
  );
  const share = used.length ? found.length / used.length : 0;
  const cityHit = Boolean(city && fold(city).length >= 3 && haystack.includes(fold(city)));
  const romanian =
    lite.lang?.toLowerCase().startsWith("ro") ||
    lite.hreflangs.some((l) => l.toLowerCase().startsWith("ro")) ||
    /[ăâîșțşţ]/i.test(lite.text.slice(0, 20_000));
  return { share, cityHit, romanian };
}

function parkedNote(reason?: string): Bilingual {
  if (reason === "account suspended")
    return bi(
      "The hosting account of the website is suspended",
      "Contul de găzduire al site-ului este suspendat",
    );
  if (reason === "server default page")
    return bi(
      "The server shows a default page with no content",
      "Serverul arată o pagină implicită, fără conținut",
    );
  if (reason === "under construction")
    return bi(
      "The page says the site is under construction",
      "Pagina spune că site-ul e «în construcție»",
    );
  return bi(
    `The domain shows a parked or for-sale page (${reason ?? "parked"})`,
    `Domeniul afișează o pagină parcată sau «de vânzare» (${reason ?? "parcat"})`,
  );
}

async function fetchHome(
  env: StepEnv,
  host: string,
): Promise<{ result: PoliteResult; tlsFailed: boolean }> {
  const https = await env.polite.get(`https://${host}/`);
  if (https.ok || https.reason !== "tls") return { result: https, tlsFailed: false };
  // A broken certificate is a finding; the content may still be there over http.
  const http = await env.polite.get(`http://${host}/`);
  return { result: http, tlsFailed: true };
}

const STATUS_FROM_REFUSAL: Record<string, WebsiteStatus> = {
  dns: "dead",
  timeout: "unreachable",
  network: "unreachable",
  blocked_by_site: "blocked",
  optout: "blocked",
  robots: "blocked",
  tls: "broken_certificate",
};

async function verify(
  env: StepEnv,
  candidate: { url: string; from: Verdict["from"] },
): Promise<Verdict | null> {
  let start: URL;
  try {
    start = new URL(
      /^https?:\/\//i.test(candidate.url) ? candidate.url : `https://${candidate.url}`,
    );
  } catch {
    return null;
  }
  const host = start.hostname.toLowerCase();
  const base: Omit<Verdict, "status" | "confidence" | "evidence"> = {
    url: `https://${host}/`,
    origin: `https://${host}`,
    host,
    from: candidate.from,
  };
  const { result, tlsFailed } = await fetchHome(env, host);
  if (!result.ok) {
    if (
      result.reason === "not_allowed_host" ||
      result.reason === "budget" ||
      result.reason === "ssrf"
    )
      return null;
    const status = tlsFailed
      ? "broken_certificate"
      : (STATUS_FROM_REFUSAL[result.reason] ?? "unreachable");
    return {
      ...base,
      status,
      confidence: 0,
      evidence: [bi(result.blocked, result.blocked)],
      tlsFailed,
      reason: result.reason,
    };
  }
  const page = result;
  const finalUrl = new URL(page.url);
  const origin = finalUrl.origin;
  if (page.status >= 400 || !page.html) {
    return {
      ...base,
      origin,
      url: page.url,
      status: page.status >= 500 || page.status === 0 ? "unreachable" : "dead",
      confidence: 0,
      evidence: [
        bi(
          `The homepage answered HTTP ${page.status}`,
          `Pagina principală a răspuns HTTP ${page.status}`,
        ),
      ],
      tlsFailed,
    };
  }
  const parked = detectParked(page.text, finalUrl.hostname);
  if (parked.parked) {
    return {
      ...base,
      origin,
      url: page.url,
      status: "parked",
      confidence: 0,
      evidence: [parkedNote(parked.reason)],
      page,
      tlsFailed,
    };
  }
  const lite = extractPageLite(page.text, page.url, page.status);
  const proof = textProvesCompany(`${lite.text}\n${lite.footerText}`, {
    cui: env.cui,
    regNo: env.identity.regNo,
  });
  const evidence: Bilingual[] = [];
  let confidence = 0;
  let proofKind: Verdict["proof"];
  if (proof.cui) {
    confidence = 0.97;
    proofKind = "cui";
    evidence.push(
      bi("The tax code (CUI) is on the homepage", "Codul fiscal (CUI) apare pe pagina principală"),
    );
  } else if (proof.regNo) {
    confidence = 0.95;
    proofKind = "reg_no";
    evidence.push(
      bi(
        "The Trade Register number is on the homepage",
        "Numărul de la Registrul Comerțului apare pe pagina principală",
      ),
    );
  }
  const names = nameEvidence(lite, env.identity.name, env.identity.city);
  if (!proofKind) {
    // Proof often lives on the contact page (Doriot Dent) or the legal pages (Vortex Hub: terms, privacy).
    const links = lite.links
      .filter((l) => l.internal && l.url)
      .map((l) => ({ url: l.url!, kind: classifyPageUrl(l.url!, l.text), text: l.text }));
    const contact = links.find((l) => l.kind === "contact");
    const legal =
      links.find(
        (l) =>
          l.kind === "legal" &&
          /termeni|terms|date-firma|impressum|legal/i.test(`${l.url} ${l.text}`),
      ) ?? links.find((l) => l.kind === "legal");
    const proofLinks = [contact, legal].filter((l): l is NonNullable<typeof l> => Boolean(l));
    if (names.share >= 0.5 || candidate.from !== "guess") {
      for (const link of proofLinks) {
        if (env.deadline - env.now() < 5000) break;
        const second = await env.polite.get(link.url);
        if (!second.ok || second.status >= 400 || !second.html) continue;
        const secondLite = extractPageLite(second.text, second.url, second.status);
        const p2 = textProvesCompany(`${secondLite.text}\n${secondLite.footerText}`, {
          cui: env.cui,
          regNo: env.identity.regNo,
        });
        if (!p2.cui && !p2.regNo) continue;
        const where = new URL(second.url).pathname;
        confidence = p2.cui ? 0.96 : 0.94;
        proofKind = p2.cui ? "cui" : "reg_no";
        evidence.push(
          p2.cui
            ? bi(`The tax code (CUI) is on ${where}`, `Codul fiscal (CUI) apare pe ${where}`)
            : bi(
                `The Trade Register number is on ${where}`,
                `Numărul de la Registrul Comerțului apare pe ${where}`,
              ),
        );
        break;
      }
    }
  }
  if (!proofKind && candidate.from === "registry") {
    confidence = 0.9;
    proofKind = "registry";
    evidence.push(
      bi(
        "Website listed for this company in the Trade Register",
        "Site declarat pentru această firmă la Registrul Comerțului",
      ),
    );
  }
  if (!proofKind && names.share >= 0.6) {
    confidence = names.share === 1 ? 0.7 : 0.55;
    if (names.cityHit) confidence += 0.08;
    if (!names.romanian) confidence = Math.min(confidence, 0.35);
    proofKind = "name";
    evidence.push(bi("The company name appears on the page", "Numele firmei apare pe pagină"));
    if (names.cityHit)
      evidence.push(
        bi(`${env.identity.city} is mentioned`, `Apare localitatea ${env.identity.city}`),
      );
  }
  let status: WebsiteStatus = "none";
  if (proofKind === "cui" || proofKind === "reg_no" || proofKind === "registry") {
    status = tlsFailed ? "broken_certificate" : "verified";
  } else if (proofKind === "name" && confidence >= 0.5) {
    status = candidate.from === "visitor" && names.romanian ? "declared" : "ask_visitor";
  }
  if (status === "none") return null;
  return {
    ...base,
    origin,
    url: page.url,
    status,
    proof: proofKind,
    confidence,
    evidence,
    page,
    lite,
    tlsFailed,
  };
}

const STATUS_TEXT: Record<WebsiteStatus, Bilingual> = {
  verified: bi("Verified as the company's website", "Verificat: este site-ul firmei"),
  declared: bi("Confirmed by you", "Confirmat de tine"),
  ask_visitor: bi(
    "Probably the company's website (not proven)",
    "Probabil site-ul firmei (nedovedit)",
  ),
  broken_certificate: bi(
    "The security certificate is broken: browsers show a warning",
    "Certificatul de securitate nu e valid: browserele afișează un avertisment",
  ),
  parked: bi(
    "The domain shows a parked or for-sale page",
    "Domeniul afișează o pagină parcată sau «de vânzare»",
  ),
  dead: bi("The domain does not work", "Domeniul nu funcționează"),
  unreachable: bi("The website did not respond", "Site-ul nu a răspuns"),
  blocked: bi("The website blocks automated access", "Site-ul blochează accesul automat"),
  none: bi("We did not find a website of the company", "Nu am găsit un site al firmei"),
};

export async function runSite(
  env: StepEnv,
  input: { candidates?: string[]; answer?: { url: string; yes: boolean } },
): Promise<StepDraft> {
  const today = isoDay(env.now());
  const facts: Fact[] = [];
  const gaps: Gap[] = [];
  const seen = new Set<string>();
  const queue: Array<{ url: string; from: Verdict["from"] }> = [];
  /** A visitor's answer pointing at a social page: recorded as declared, never fetched. */
  let socialAnswer: string | undefined;
  const push = (url: string | undefined, from: Verdict["from"]) => {
    if (!url) return;
    let host: string;
    try {
      host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
    } catch {
      return;
    }
    // Social networks and directories are never the company's site and are never requested.
    if (isSocialOrDirectoryHost(host)) {
      if (from === "visitor") socialAnswer ??= url.slice(0, 300);
      return;
    }
    const key = siteHost(host);
    if (seen.has(key)) return;
    seen.add(key);
    queue.push({ url: host, from });
  };
  let rejected: string | undefined;
  if (input.answer && !input.answer.yes) {
    try {
      const raw = input.answer.url;
      rejected = siteHost(new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`).hostname);
    } catch {
      rejected = undefined;
    }
  }
  if (input.answer?.yes) push(input.answer.url, "visitor");
  push(env.identity.registrySite, "registry");
  push(env.identity.hintSite, "hint");
  for (const candidate of (input.candidates ?? []).slice(0, 3)) push(candidate, "hint");
  if (rejected) seen.add(rejected);

  // Guessed domains: DNS first (cheap), page requests only for the live ones.
  const guesses = domainGuesses(env.identity.name).filter((d) => !seen.has(siteHost(d)));
  const live: string[] = [];
  await Promise.all(
    guesses.map(async (domain) => {
      const answer = await env.dns.records(domain, "A");
      if (answer.status === "ok" && answer.data.length) live.push(domain);
    }),
  );
  live.sort((a, b) => guesses.indexOf(a) - guesses.indexOf(b));
  for (const domain of live) push(domain, "guess");

  const verdicts: Verdict[] = [];
  for (const candidate of queue) {
    if (env.deadline - env.now() < 4000 || env.counters().subrequests > 32) {
      gaps.push(
        gap(
          "site",
          bi("Some guessed domains", "Unele domenii ghicite"),
          bi("Not checked: the step ran out of time", "Neverificate: pasul a rămas fără timp"),
          today,
        ),
      );
      break;
    }
    const verdict = await verify(env, candidate).catch((error) => {
      env.log({ site: candidate.url, error: String(error) });
      return null;
    });
    if (verdict) verdicts.push(verdict);
    if (
      verdict &&
      (verdict.status === "verified" || verdict.status === "declared") &&
      verdict.confidence >= 0.9
    )
      break;
  }

  const rank = (v: Verdict) =>
    ({
      verified: 9,
      declared: 8,
      broken_certificate: 7,
      ask_visitor: 5,
      parked: 4,
      blocked: 3,
      unreachable: 2,
      dead: 1,
      none: 0,
    })[v.status] + v.confidence;
  // Guessed domains that failed are noise, not findings; registry and hint sites count.
  const meaningful = verdicts.filter(
    (v) =>
      v.from !== "guess" ||
      ["verified", "declared", "ask_visitor", "broken_certificate"].includes(v.status),
  );
  const best = [...meaningful].sort((a, b) => rank(b) - rank(a))[0];
  const status: WebsiteStatus = best?.status ?? "none";
  const siteFacts = { section: "site" as const, asOf: today };

  facts.push(
    fact({
      ...siteFacts,
      id: "site.status",
      predicate: "site.status",
      value: status,
      display: STATUS_TEXT[status],
      source: best ? "site" : "calc",
      confidence:
        status === "ask_visitor" ? "probabil" : status === "declared" ? "declarat" : "confirmat",
      method: best ? "html" : "derived",
      score: best
        ? Math.max(
            best.confidence,
            ["parked", "dead", "unreachable", "blocked", "broken_certificate"].includes(status)
              ? 0.95
              : 0,
          )
        : 1,
      adverse: ["parked", "dead", "broken_certificate"].includes(status) ? true : undefined,
      evidence: best ? { url: best.url, note: best.evidence[0] } : undefined,
      observed: best ? undefined : { pagesRead: verdicts.filter((v) => v.page).length },
    }),
  );
  if (best) {
    const shown = best.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    facts.push(
      fact({
        ...siteFacts,
        id: "site.url",
        predicate: "site.url",
        value: best.url,
        display: bi(shown, shown),
        source: best.from === "registry" ? "onrc" : "site",
        confidence:
          status === "ask_visitor" ? "probabil" : status === "declared" ? "declarat" : "confirmat",
        method: "html",
        score: best.confidence,
      }),
    );
    if (best.proof) {
      const proofText: Record<NonNullable<Verdict["proof"]>, Bilingual> = {
        cui: bi("Tax code (CUI) on the website", "Codul fiscal (CUI) pe site"),
        reg_no: bi(
          "Trade Register number on the website",
          "Numărul de la Registrul Comerțului pe site",
        ),
        registry: bi("Listed in the Trade Register", "Declarat la Registrul Comerțului"),
        name: bi(
          "Company name on the website (not proof)",
          "Numele firmei pe site (nu e o dovadă)",
        ),
      };
      facts.push(
        fact({
          ...siteFacts,
          id: "site.proof",
          predicate: "site.proof",
          value: best.proof,
          display: proofText[best.proof],
          source: "site",
          confidence: best.proof === "name" ? "probabil" : "confirmat",
          method: "html",
          score: best.confidence,
          evidence: { url: best.url },
        }),
      );
    }
    facts.push(
      fact({
        ...siteFacts,
        id: "site.https",
        predicate: "site.https",
        value: !best.tlsFailed && best.url.startsWith("https:"),
        display: best.tlsFailed
          ? bi(
              "No: the security certificate is not valid",
              "Nu: certificatul de securitate nu este valid",
            )
          : best.url.startsWith("https:")
            ? bi("Yes", "Da")
            : bi("No", "Nu"),
        source: "site",
        confidence: "confirmat",
        method: "html",
        adverse: best.tlsFailed ? true : undefined,
        score: 1,
      }),
    );
  }
  // The registry domain's own state, when it is not the site we kept (a dead or parked listing is a finding).
  const registry = verdicts.find((v) => v.from === "registry");
  if (registry && registry !== best) {
    facts.push(
      fact({
        id: "identity.website_registry.status",
        section: "identity",
        predicate: "identity.website_registry",
        value: { url: registry.url, status: registry.status },
        display: bi(
          `${registry.host}: ${STATUS_TEXT[registry.status].en}`,
          `${registry.host}: ${STATUS_TEXT[registry.status].ro}`,
        ),
        source: "site",
        asOf: today,
        confidence: "confirmat",
        method: "html",
        score: 0.95,
      }),
    );
  }

  // E-mail on the domain (MX, SPF, DMARC): public DNS records.
  if (best && ["verified", "declared", "broken_certificate", "ask_visitor"].includes(status)) {
    const domain = siteHost(best.host);
    const [mx, txt, dmarc] = await Promise.all([
      env.dns.records(domain, "MX"),
      env.dns.records(domain, "TXT"),
      env.dns.records(`_dmarc.${domain}`, "TXT"),
    ]);
    const dnsFact = (id: string, value: boolean | null, yes: Bilingual, no: Bilingual) =>
      value === null
        ? null
        : fact({
            id,
            section: "site",
            predicate: id,
            value,
            display: value ? yes : no,
            source: "dns",
            asOf: today,
            confidence: "confirmat",
            method: "api",
          });
    const out = [
      dnsFact(
        "site.dns.mx",
        mx.status === "error" ? null : mx.data.length > 0,
        bi("E-mail is set up on the domain", "E-mailul e configurat pe domeniu"),
        bi("No e-mail server on the domain", "Nu există server de e-mail pe domeniu"),
      ),
      dnsFact(
        "site.dns.spf",
        txt.status === "error" ? null : txt.data.some((t) => /^v=spf1/i.test(t)),
        bi("SPF record present", "Înregistrare SPF prezentă"),
        bi("No SPF record", "Lipsește înregistrarea SPF"),
      ),
      dnsFact(
        "site.dns.dmarc",
        dmarc.status === "error" ? null : dmarc.data.some((t) => /^v=dmarc1/i.test(t)),
        bi("DMARC record present", "Înregistrare DMARC prezentă"),
        bi("No DMARC record", "Lipsește înregistrarea DMARC"),
      ),
    ].filter((f): f is Fact<boolean> => f !== null);
    facts.push(...out);
  }

  if (socialAnswer) {
    const url = /^https?:\/\//i.test(socialAnswer) ? socialAnswer : `https://${socialAnswer}`;
    facts.push(
      fact({
        id: "presence.social_only",
        section: "presence",
        predicate: "presence.social_only",
        value: { url },
        display: bi("Only social pages (declared)", "Doar pagini sociale (declarat)"),
        source: "user",
        asOf: today,
        confidence: "declarat",
        method: "user",
        evidence: { url },
      }),
    );
  }

  const next: StepDraft["next"] = {};
  if (status === "ask_visitor" && best) {
    next.askSite = {
      url: best.url,
      reason: bi(
        "The name matches, but the page does not show the company's tax code or registration number.",
        "Numele se potrivește, dar pagina nu arată codul fiscal sau numărul de înregistrare al firmei.",
      ),
    };
  }
  if (
    best?.page &&
    ["verified", "declared", "broken_certificate", "ask_visitor"].includes(status)
  ) {
    const robots = env.polite.robotsText(best.origin);
    const cursor: SiteCursor = {
      v: 1,
      origin: best.origin,
      status,
      robots: robots ? { origin: best.origin, ...robots } : undefined,
      read: [],
      schedule: env.polite.hostSchedule(),
      home: {
        url: best.page.url,
        requestedUrl: best.page.requestedUrl,
        status: best.page.status,
        headers: best.page.headers,
        ttfbMs: best.page.ttfbMs,
        redirects: best.page.redirects,
        html: stripForSnapshot(best.page.text),
        tlsFailed: best.tlsFailed,
      },
    };
    let sealed = await env.seal(cursor, "site-snapshot");
    if (sealed.length > SNAPSHOT_MAX_SEALED) {
      env.log({ site: "snapshot_too_large", bytes: sealed.length });
      sealed = await env.seal({ ...cursor, home: undefined }, "site-snapshot");
    }
    next.crawlCursor = sealed;
  }
  if (status === "none") {
    gaps.push(
      gap(
        "site",
        bi("The company's website", "Site-ul firmei"),
        bi(
          `None listed in the Trade Register; ${live.length} guessed domains checked, none belongs to the company`,
          `Niciunul declarat la Registrul Comerțului; am verificat ${live.length} domenii ghicite, niciunul nu e al firmei`,
        ),
        today,
      ),
    );
  }
  return {
    status: "done",
    facts,
    gaps,
    counters: {
      candidates: queue.length,
      guessesLive: live.length,
      pagesRead: verdicts.filter((v) => v.page).length,
      subrequests: env.counters().subrequests,
    },
    next: Object.keys(next).length ? next : undefined,
  };
}

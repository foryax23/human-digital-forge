import {
  DEEP_LIMITS,
  type Fact,
  type Gap,
  type StepResult,
  type WebsiteStatus,
} from "../contracts";
import type { AuditSiteResult, StepEnv } from "../env.server";
import { extractWithModel } from "../llm/extract.server";
import { bi, count } from "../parse/format";
import { extractPageLite, type PageLite } from "../parse/page";
import { quoteLimit } from "../parse/quotes";
import { extractRules } from "../parse/rules-extract";
import { canonicalPageUrl, siteHost, type PageKind } from "../parse/web";

import { fact, gap, isoDay, type StepDraft } from "./common.server";
import {
  pageText,
  parseSitemap,
  rankCandidates,
  rulesToFacts,
  withTdmHeader,
  type QueuedPage,
} from "./pages.server";
import { LONG_CRAWL_DELAY_MS, type PolitePage } from "./polite.server";
import type { SiteCursor } from "./site.server";

/*
 * Step 5, "audit" (plan A3, B4): the polite audit of the company's own site.
 * The homepage comes from the site step's sealed snapshot (fetched once per
 * run); robots.txt is reused; the sitemap and up to 5 pages are read one at a
 * time, at least 1 s apart; the quick scan's deterministic checks run on
 * them; deterministic extraction and the first Haiku batch turn them into
 * facts. A site without proof is audited on its homepage only and not
 * crawled. The rest of the queue goes to the crawl batches in a sealed cursor.
 */

export type CrawlCursor = {
  v: 1;
  origin: string;
  status: WebsiteStatus;
  /** The attestation of the site result the audit used: a crawl continues only with that result. */
  siteAtt: string;
  batch: number;
  queue: QueuedPage[];
  read: string[];
  kindsRead: Partial<Record<PageKind, number>>;
  pagesRead: number;
  tokensUsed: number;
  tdm: boolean;
  robots?: { origin: string; status: number; body: string };
  /** Earliest next request per host: spacing holds across steps. */
  schedule?: Record<string, number>;
};

export const CRAWLABLE: WebsiteStatus[] = ["verified", "declared", "broken_certificate"];
const NOT_AUDITED: WebsiteStatus[] = ["parked", "dead", "unreachable", "blocked", "none"];

export function siteState(site: StepResult): { status: WebsiteStatus; url?: string } {
  const status =
    (site.facts.find((f) => f.id === "site.status")?.value as WebsiteStatus | undefined) ?? "none";
  const url = site.facts.find((f) => f.id === "site.url")?.value as string | undefined;
  return { status, url };
}

/** Audit findings as owner-facing counts: Important (critical, high), Mărunt (medium, low), În regulă. */
export function auditFacts(result: AuditSiteResult, asOf: string, url: string): Fact[] {
  const important = result.findings.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  );
  const minor = result.findings.filter((f) => f.severity === "medium" || f.severity === "low");
  const ok = Math.max(0, result.checksRun - result.findings.length);
  const base = {
    section: "site" as const,
    source: "audit" as const,
    asOf,
    confidence: "confirmat" as const,
    method: "html" as const,
    evidence: { url },
  };
  const facts: Fact[] = [
    fact({
      ...base,
      id: "site.audit.important",
      predicate: "site.audit.important",
      value: important.length,
      display: count(important.length),
    }),
    fact({
      ...base,
      id: "site.audit.minor",
      predicate: "site.audit.minor",
      value: minor.length,
      display: count(minor.length),
    }),
    fact({
      ...base,
      id: "site.audit.ok",
      predicate: "site.audit.ok",
      value: ok,
      display: bi(`${ok} of ${result.checksRun}`, `${ok} din ${result.checksRun}`),
    }),
  ];
  for (const f of important.slice(0, 6)) {
    facts.push(
      fact({
        ...base,
        id: `site.audit.issue.${f.id}`,
        predicate: "site.audit.issue",
        value: { id: f.id, severity: f.severity, category: f.category },
        display: f.title,
      }),
    );
  }
  const notable = result.technologies
    .filter((t) => ["cms", "ecommerce", "builder", "booking", "chat"].includes(t.category))
    .slice(0, 6);
  if (notable.length) {
    const names = notable.map((t) => t.name).join(", ");
    facts.push(
      fact({
        ...base,
        id: "site.tech",
        predicate: "site.tech",
        value: notable,
        display: bi(names, names),
      }),
    );
  }
  return facts;
}

/** True when two URLs are on the same site (www. ignored). */
export function sameSite(a: string, b: string): boolean {
  try {
    return siteHost(new URL(a).hostname) === siteHost(new URL(b).hostname);
  } catch {
    return false;
  }
}

export function slowSiteGap(today: string): Gap {
  return gap(
    "site",
    bi("Other pages of the website", "Celelalte pagini ale site-ului"),
    bi(
      "Not read: the website asks for long pauses between requests",
      "Necitite: site-ul cere pauze lungi între cereri",
    ),
    today,
  );
}

export async function runAudit(env: StepEnv, input: { site: StepResult }): Promise<StepDraft> {
  const today = isoDay(env.now());
  const started = env.now();
  const facts: Fact[] = [];
  const gaps: Gap[] = [];
  const { status, url } = siteState(input.site);
  if (NOT_AUDITED.includes(status) || !url) {
    return {
      status: "skipped",
      facts,
      gaps: [
        gap(
          "site",
          bi("Website checks", "Verificarea site-ului"),
          bi(
            "No working website of the company to check",
            "Nu există un site funcțional al firmei de verificat",
          ),
          today,
        ),
      ],
    };
  }
  // The dispatcher checked that this cursor is the one sealed with this site result
  // (next.cursorSha); belt and braces, a snapshot of another site or status is ignored.
  const opened = input.site.next?.crawlCursor
    ? await env.unseal<SiteCursor>(input.site.next.crawlCursor, "site-snapshot")
    : null;
  const snapshot =
    opened && opened.status === status && sameSite(opened.origin, url) ? opened : null;
  if (opened && !snapshot) env.log({ audit: "snapshot_ignored", reason: "site_mismatch" });
  const origin = snapshot?.origin ?? new URL(url).origin;
  if (snapshot?.robots)
    env.polite.seedRobots(snapshot.robots.origin, snapshot.robots.status, snapshot.robots.body);
  env.polite.seedSchedule(snapshot?.schedule);

  // Homepage: from the sealed snapshot when present (no second request), else one polite fetch.
  let home: (PolitePage & { tlsFailed?: boolean }) | null = null;
  if (snapshot?.home) {
    home = {
      ok: true,
      status: snapshot.home.status,
      url: snapshot.home.url,
      requestedUrl: snapshot.home.requestedUrl,
      contentType: "text/html",
      text: snapshot.home.html,
      headers: snapshot.home.headers,
      redirects: snapshot.home.redirects,
      ttfbMs: snapshot.home.ttfbMs,
      truncated: false,
      html: true,
      tlsFailed: snapshot.home.tlsFailed,
    };
  } else {
    const fetched = await env.polite.get(url);
    if (fetched.ok) home = fetched;
    env.log({
      audit: "homepage_refetched",
      reason: snapshot ? "snapshot_too_large" : "no_snapshot",
    });
  }
  if (!home || home.status >= 400) {
    return {
      status: "failed",
      facts,
      gaps: [
        gap(
          "site",
          bi("Website checks", "Verificarea site-ului"),
          bi("The homepage could not be read", "Pagina principală nu a putut fi citită"),
          today,
        ),
      ],
    };
  }
  const homeLite = withTdmHeader(extractPageLite(home.text, home.url, home.status), home.headers);
  const robots = await env.polite.robots(origin);
  // A Crawl-delay longer than a step can wait: the other pages stay unread (never faster than asked).
  const slowSite = (robots.crawlDelay ?? 0) * 1000 > LONG_CRAWL_DELAY_MS;
  if (slowSite) gaps.push(slowSiteGap(today));
  const crawlAllowed = CRAWLABLE.includes(status) && !slowSite;

  // Sitemap: the ones robots.txt declares on this host, else /sitemap.xml (at most 2 files).
  let sitemapUrls: string[] = [];
  let sitemapInfo: { found: boolean; url?: string; urlCount?: number; partial?: boolean } = {
    found: false,
  };
  if (crawlAllowed) {
    const declared = robots.sitemaps.filter((s) => {
      try {
        return new URL(s).host === new URL(origin).host;
      } catch {
        return false;
      }
    });
    const first = declared[0] ?? `${origin}/sitemap.xml`;
    const fetched = await env.polite.get(first, {
      accept: "application/xml,text/xml;q=0.9,*/*;q=0.5",
    });
    if (
      fetched.ok &&
      fetched.status === 200 &&
      /<(urlset|sitemapindex)/i.test(fetched.text.slice(0, 5000))
    ) {
      const parsed = parseSitemap(fetched.text);
      sitemapInfo = {
        found: true,
        url: fetched.url,
        urlCount: parsed.urls.length || undefined,
        partial: parsed.children.length > 0,
      };
      sitemapUrls = parsed.urls;
      if (parsed.children[0] && env.deadline - env.now() > 15_000) {
        const child = await env.polite.get(parsed.children[0], {
          accept: "application/xml,text/xml;q=0.9,*/*;q=0.5",
        });
        if (child.ok && child.status === 200) sitemapUrls = parseSitemap(child.text).urls;
      }
    }
  }

  const readKeys = new Set([canonicalPageUrl(home.url)]);
  const kindsRead: Partial<Record<PageKind, number>> = { home: 1 };
  const queue = crawlAllowed
    ? rankCandidates(homeLite.links, sitemapUrls, origin, readKeys, kindsRead)
    : [];
  const pages: Array<PageLite & { html: string }> = [{ ...homeLite, html: home.text }];
  const auditPages: Array<{ url: string; status: number; html: string }> = [];
  const broken: Array<{ url: string; status: number }> = [];
  const fetchUntil = started + 13_000;
  let taken = 0;
  while (queue.length && taken < 5 && env.now() < fetchUntil) {
    const next = queue.shift()!;
    if (!robots.isAllowed(`${new URL(next.url).pathname}${new URL(next.url).search}`)) continue;
    taken++;
    const result = await env.polite.get(next.url);
    if (!result.ok) {
      if (result.reason === "blocked_by_site") {
        gaps.push(
          gap(
            "site",
            bi("More pages of the website", "Alte pagini ale site-ului"),
            bi("The website blocks automated access", "Site-ul blochează accesul automat"),
            today,
          ),
        );
        queue.length = 0;
      }
      continue;
    }
    const key = canonicalPageUrl(result.url);
    if (readKeys.has(key)) continue;
    readKeys.add(key);
    if (result.status === 404 || result.status === 410 || result.status >= 500) {
      broken.push({ url: next.url, status: result.status });
      continue;
    }
    if (result.status >= 400 || !result.html) continue;
    const lite = withTdmHeader(
      extractPageLite(result.text, result.url, result.status),
      result.headers,
    );
    kindsRead[next.kind] = (kindsRead[next.kind] ?? 0) + 1;
    pages.push({ ...lite, html: result.text });
    auditPages.push({ url: result.url, status: result.status, html: result.text });
  }

  // Favicon probe only when the homepage declares none (otherwise the check would guess).
  let faviconFound = /<link[^>]+rel=["'][^"']*icon/i.test(home.text);
  if (!faviconFound && env.deadline - env.now() > 9000) {
    const icon = await env.polite.get(`${origin}/favicon.ico`, {
      method: "HEAD",
      accept: "image/*,*/*;q=0.5",
    });
    faviconFound = icon.ok && icon.status === 200 && !/html/i.test(icon.contentType);
  }
  const robotsRaw = env.polite.robotsText(origin);
  const audit = await env.auditSite({
    requestedUrl: home.requestedUrl,
    cui: env.cui,
    name: env.identity.name,
    home: {
      url: home.url,
      status: home.status,
      html: home.text,
      headers: home.headers,
      ttfbMs: home.ttfbMs,
      redirects: home.redirects,
      tlsFailed: home.tlsFailed,
    },
    pages: auditPages,
    brokenPages: broken,
    robots: { status: robotsRaw?.status, body: robotsRaw?.body },
    sitemap: sitemapInfo,
    faviconFound,
  });
  if (audit) facts.push(...auditFacts(audit, today, home.url));
  else
    gaps.push(
      gap(
        "site",
        bi("Website checks", "Verificările site-ului"),
        bi("The checks could not run", "Verificările nu au putut rula"),
        today,
      ),
    );

  // Deterministic extraction (always) and the first Haiku batch (verified sites, no TDM reservation).
  const caen = env.identity.caen3;
  const rules = extractRules(pages, { cui: env.cui, regNo: env.identity.regNo });
  facts.push(...rulesToFacts(rules, { batch: "a", asOf: today, caen, firstBatch: true }));
  facts.push(
    fact({
      id: "site.pages_read.a",
      section: "site",
      predicate: "site.pages_read",
      value: pages.length,
      display: count(pages.length),
      source: "site",
      asOf: today,
      confidence: "confirmat",
      method: "html",
    }),
  );
  let tokensUsed = 0;
  let usd = 0;
  if (env.llm && crawlAllowed && env.deadline - env.now() > 9000) {
    const extracted = await extractWithModel({
      llm: env.llm,
      ledger: env.ledger,
      runId: env.runId,
      step: "audit",
      batch: "a",
      pages: pages.map((p) => ({ url: p.url, text: pageText(p) })),
      quoteLimit: quoteLimit(rules.tdmReserved),
      tdmReserved: rules.tdmReserved,
      tokensUsed: 0,
      deadline: env.deadline,
      now: env.now,
      log: env.log,
      asOf: today,
    });
    if (extracted.kind === "ok") {
      facts.push(...extracted.facts);
      tokensUsed = extracted.tokens;
      usd = extracted.usd;
    } else {
      env.log({
        audit: "extraction_skipped",
        reason: extracted.kind === "skipped" ? extracted.reason : "",
      });
    }
  } else if (!env.llm) {
    gaps.push(
      gap(
        "offers",
        bi("Opening hours and offers", "Programul și ofertele"),
        bi(
          "Read by rules only (no AI in this run)",
          "Citite doar cu reguli (fără AI în această rulare)",
        ),
        today,
      ),
    );
  }
  if (!crawlAllowed && !slowSite) {
    gaps.push(
      gap(
        "site",
        bi("Other pages of the website", "Celelalte pagini ale site-ului"),
        status === "ask_visitor"
          ? bi(
              "Not read: we could not prove the website belongs to the company",
              "Necitite: nu am putut dovedi că site-ul aparține firmei",
            )
          : bi("Not read", "Necitite"),
        today,
      ),
    );
  }

  let next: StepDraft["next"];
  if (crawlAllowed && queue.length && pages.length < DEEP_LIMITS.crawlPagesMax) {
    const cursor: CrawlCursor = {
      v: 1,
      origin,
      status,
      siteAtt: input.site.att,
      batch: 1,
      queue: queue.slice(0, 40),
      read: [...readKeys],
      kindsRead,
      pagesRead: pages.length,
      tokensUsed,
      tdm: rules.tdmReserved,
      robots: robotsRaw ? { origin, ...robotsRaw } : undefined,
      schedule: env.polite.hostSchedule(),
    };
    next = { crawlCursor: await env.seal(cursor, "crawl") };
  }
  return {
    status: audit ? "done" : "partial",
    facts,
    gaps,
    counters: {
      pagesRead: pages.length,
      homepageFetches: snapshot?.home ? 0 : 1,
      sitemapUrls: sitemapUrls.length,
      subrequests: env.counters().subrequests,
    },
    next,
    spentUsd: usd || undefined,
  };
}

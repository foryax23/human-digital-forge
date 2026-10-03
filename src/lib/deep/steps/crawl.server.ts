import { DEEP_LIMITS, type Fact, type Gap, type StepResult } from "../contracts";
import type { StepEnv } from "../env.server";
import { extractWithModel } from "../llm/extract.server";
import { bi, count } from "../parse/format";
import { extractPageLite, type PageLite } from "../parse/page";
import { quoteLimit } from "../parse/quotes";
import { extractRules } from "../parse/rules-extract";
import { canonicalPageUrl } from "../parse/web";

import { CRAWLABLE, sameSite, siteState, slowSiteGap, type CrawlCursor } from "./audit.server";
import { fact, gap, isoDay, type StepDraft } from "./common.server";
import { pageText, rulesToFacts, withTdmHeader } from "./pages.server";
import { LONG_CRAWL_DELAY_MS } from "./polite.server";

/*
 * Step 6, "crawl" ×0–3 (plan A3, A9): continues from the audit's sealed
 * cursor (the client cannot steer it), one request at a time, at least 1 s
 * apart (Crawl-delay honoured), at most 30 pages per run, about 12 s of
 * fetching per batch, then rules and one Haiku batch on the pages it read.
 */

export async function runCrawl(
  env: StepEnv,
  input: { site: StepResult; cursor: string },
): Promise<StepDraft> {
  const today = isoDay(env.now());
  const started = env.now();
  const cursor = await env.unseal<CrawlCursor>(input.cursor, "crawl");
  // A crawl cursor continues only the attested site result the audit used, on that site,
  // when the site is one we may crawl (proof required): never another site's queue.
  const site = siteState(input.site);
  if (
    !cursor ||
    cursor.v !== 1 ||
    cursor.siteAtt !== input.site.att ||
    !CRAWLABLE.includes(site.status) ||
    !site.url ||
    !sameSite(cursor.origin, site.url)
  ) {
    return {
      status: "failed",
      facts: [],
      gaps: [
        gap(
          "site",
          bi("More pages", "Alte pagini"),
          bi("Invalid crawl cursor", "Cursor invalid"),
          today,
        ),
      ],
    };
  }
  if (cursor.batch > DEEP_LIMITS.crawlBatchesMax) return { status: "skipped", facts: [], gaps: [] };
  if (cursor.robots)
    env.polite.seedRobots(cursor.robots.origin, cursor.robots.status, cursor.robots.body);
  env.polite.seedSchedule(cursor.schedule);
  const robots = await env.polite.robots(cursor.origin);
  if ((robots.crawlDelay ?? 0) * 1000 > LONG_CRAWL_DELAY_MS)
    return { status: "skipped", facts: [], gaps: [slowSiteGap(today)] };
  const read = new Set(cursor.read);
  const queue = [...cursor.queue];
  const pages: Array<PageLite & { html: string }> = [];
  const gaps: Gap[] = [];
  const room = DEEP_LIMITS.crawlPagesMax - cursor.pagesRead;
  const fetchUntil = started + 12_000;
  let blocked = false;
  while (queue.length && pages.length < room && env.now() < fetchUntil) {
    const next = queue.shift()!;
    const target = new URL(next.url);
    if (!robots.isAllowed(`${target.pathname}${target.search}`)) continue;
    const result = await env.polite.get(next.url);
    if (!result.ok) {
      if (result.reason === "blocked_by_site") {
        blocked = true;
        break;
      }
      if (result.reason === "budget") break;
      continue;
    }
    const key = canonicalPageUrl(result.url);
    if (read.has(key)) continue;
    read.add(key);
    if (result.status >= 400 || !result.html) continue;
    pages.push({
      ...withTdmHeader(extractPageLite(result.text, result.url, result.status), result.headers),
      html: result.text,
    });
    cursor.kindsRead[next.kind] = (cursor.kindsRead[next.kind] ?? 0) + 1;
  }
  if (blocked) {
    gaps.push(
      gap(
        "site",
        bi("More pages of the website", "Alte pagini ale site-ului"),
        bi("The website blocks automated access", "Site-ul blochează accesul automat"),
        today,
      ),
    );
  }
  const batch = `c${cursor.batch}`;
  const facts: Fact[] = [];
  if (pages.length) {
    const rules = extractRules(pages, { cui: env.cui, regNo: env.identity.regNo });
    facts.push(
      ...rulesToFacts(rules, { batch, asOf: today, caen: env.identity.caen3, firstBatch: false }),
    );
    facts.push(
      fact({
        id: `site.pages_read.${batch}`,
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
    if (env.llm && env.deadline - env.now() > 8000) {
      const extracted = await extractWithModel({
        llm: env.llm,
        ledger: env.ledger,
        runId: env.runId,
        step: "crawl",
        batch,
        pages: pages.map((p) => ({ url: p.url, text: pageText(p) })),
        quoteLimit: quoteLimit(cursor.tdm || rules.tdmReserved),
        tdmReserved: cursor.tdm || rules.tdmReserved,
        tokensUsed: cursor.tokensUsed,
        deadline: env.deadline,
        now: env.now,
        log: env.log,
        asOf: today,
      });
      if (extracted.kind === "ok") {
        facts.push(...extracted.facts);
        cursor.tokensUsed += extracted.tokens;
      }
    }
  }
  const pagesRead = cursor.pagesRead + pages.length;
  let next: StepDraft["next"];
  if (
    !blocked &&
    queue.length &&
    pagesRead < DEEP_LIMITS.crawlPagesMax &&
    cursor.batch < DEEP_LIMITS.crawlBatchesMax
  ) {
    const updated: CrawlCursor = {
      ...cursor,
      batch: cursor.batch + 1,
      queue: queue.slice(0, 40),
      read: [...read],
      pagesRead,
      schedule: env.polite.hostSchedule(),
    };
    next = { crawlCursor: await env.seal(updated, "crawl") };
  }
  return {
    status: pages.length ? "done" : blocked ? "failed" : "skipped",
    facts,
    gaps,
    counters: {
      pagesRead: pages.length,
      totalPagesRead: pagesRead,
      subrequests: env.counters().subrequests,
    },
    next,
  };
}

import type { AutomationOpportunity, Lang } from "@/lib/scan/types";

import { pick } from "./format";
import { joinClauses, localizeTool } from "./localize";
import type { PdfContext } from "./model";
import { PAGE, SPACE } from "./theme";

/*
 * Page planning for decisions React-PDF can't make for us (it has no "does
 * this still fit?" query), such as whether the opportunity totals table fits
 * under the last card. It uses the heights measured by a first render
 * (measure.tsx) and falls back to estimates: text lengths become lines and
 * points, with constants measured on rendered pages of engine-built
 * blueprints in both languages (scripts/scan/try-pdf.tsx --variants).
 */

/** Usable height of a working page, between the running header and footer. */
const PAGE_ROOM = PAGE.height - SPACE.contentTop - SPACE.contentBottom;

/** Lines a text needs at a width; `em` is the font's average character width. */
export function estimateLines(chars: number, width: number, fontSize: number, em: number): number {
  return Math.max(1, Math.ceil(chars / (width / (fontSize * em))));
}

/** Height of an opportunity card including its bottom margin (see OpportunityCard). */
export function estimateCardHeight(o: AutomationOpportunity, lang: Lang): number {
  const title = estimateLines(pick(o.title, lang).length, 325, 10.5, 0.55);
  const story = Math.max(
    estimateLines(pick(o.problem, lang).length, 128, 7.4, 0.49),
    estimateLines(pick(o.solution, lang).length, 160, 7.4, 0.49),
  );
  // Tools, the monthly tool cost in brackets, then the assumptions.
  const notes =
    o.tools
      .slice(0, 5)
      .map((tool) => localizeTool(tool, lang))
      .join(" · ").length +
    44 +
    joinClauses(o.assumptions.map((a) => pick(a, lang))).length;
  const body = Math.max(story * 10.2 + estimateLines(notes, 307, 6.2, 0.463) * 8.6, 53);
  return 62.4 + (title - 1) * 12.6 + body;
}

/** How the opportunity cards are spread over pages, and whether the totals table closes them. */
export type OpportunityPlan = {
  /** Index of the first card on the second page, when we choose the break. */
  breakBefore: number | null;
  totals: boolean;
};

/** Bottom margin of an opportunity card, part of its height but free at a page end. */
const CARD_GAP = 6;

/**
 * Plans the opportunity pages from the measured block heights (ctx.measured,
 * exact to a fraction of a point) or, failing that, from estimates. Cards
 * that run onto a second page bring the totals table with them when it fits
 * (a table alone on a page is worse than none), and when that page would stay
 * mostly empty, cards move over from the first page so both pages read full.
 * Estimates get safety margins for their error of about a line per card.
 */
export function planOpportunities(ctx: PdfContext): OpportunityPlan {
  const { blueprint, lang, measured } = ctx;
  const n = blueprint.opportunities.length;
  const exact = measured?.opportunityCards.length === n ? measured : undefined;
  const heights =
    exact?.opportunityCards ?? blueprint.opportunities.map((o) => estimateCardHeight(o, lang));
  const table = exact?.opportunityTotals ?? 70 + n * 16.5;
  // Section title with a two-line intro, then the chart row, whose payback
  // ranking grows by one row per opportunity after the fourth (up to six).
  const head = exact?.opportunityHead ?? 247 + Math.max(0, Math.min(n, 6) - 4) * 22;
  const margin = exact ? 1 : 12;
  const tableMargin = exact ? 1 : 30;
  const fits = (used: number, height: number, room: number) =>
    used + height - CARD_GAP <= room - margin;

  const firstRoom = PAGE_ROOM - head;
  let first = 0;
  let used = 0;
  while (first < n && fits(used, heights[first], firstRoom)) used += heights[first++];
  if (first >= n) return { breakBefore: null, totals: false };

  // The rest from the second page on; only the last page's room matters.
  let room = PAGE_ROOM;
  let pages = 1;
  for (const h of heights.slice(first)) {
    if (!fits(PAGE_ROOM - room, h, PAGE_ROOM)) {
      room = PAGE_ROOM;
      pages += 1;
    }
    room -= h;
  }
  const totals = room >= table + tableMargin;
  if (!totals || pages > 1) return { breakBefore: null, totals };

  let rest = heights.slice(first).reduce((sum, h) => sum + h, 0);
  while (
    first > 2 &&
    rest + table < PAGE_ROOM * 0.55 &&
    rest + heights[first - 1] + table <= PAGE_ROOM - tableMargin
  ) {
    first -= 1;
    rest += heights[first];
  }
  return { breakBefore: first, totals: true };
}

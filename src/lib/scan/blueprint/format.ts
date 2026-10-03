import type { Bilingual, Estimate, Lang, Range } from "@/lib/scan/types";

/*
 * Number formatting and rounding shared by the engine, the scan screens and
 * the PDF (spec §3.2). Grouping is done by hand (not Intl) so the server and
 * every browser print exactly the same string. Everything a visitor sees goes
 * through the display steps below, so the same figure never reads two ways.
 */

/** Non-breaking space: between a number and its unit, after "≈". */
export const NBSP = " ";
/** The real minus sign (not a hyphen) for negative figures. */
export const MINUS = "−";

/** Display steps: every estimate is rounded to one of these before it is shown. */
export const STEP = {
  /** Hours a month (a value shown on its own under 10 keeps whole hours). */
  hours: 5,
  /** Money a month: tools, value of the hours. */
  monthly: 100,
  /** One-off cost: setup, the new website. */
  oneOff: 500,
  /** Cumulative and yearly money: the chart, the table, the KPIs. */
  cumulative: 1000,
} as const;

export function formatNumber(value: number, lang: Lang, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const group = lang === "ro" ? "." : ",";
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const sign = value < 0 && Number(fixed) !== 0 ? MINUS : "";
  return frac ? `${sign}${grouped}${lang === "ro" ? "," : "."}${frac}` : `${sign}${grouped}`;
}

/** "52–78" (or "60" when both ends round to the same value). */
export function formatRange(range: Range, lang: Lang, decimals = 0): string {
  const low = formatNumber(range.low, lang, decimals);
  const high = formatNumber(range.high, lang, decimals);
  return low === high ? low : `${low}–${high}`;
}

/**
 * Romanian puts "de" between a number and its noun from 20 up, except when the
 * last two digits are 01–19 ("20 de ore", "101 ore", "120 de ore").
 */
export function roNeedsDe(value: number): boolean {
  if (!Number.isInteger(value) || value < 20) return false;
  const lastTwo = value % 100;
  return lastTwo === 0 || lastTwo >= 20;
}

export function roCount(value: number, noun: string): string {
  const number = formatNumber(value, "ro", Number.isInteger(value) ? 0 : 1);
  return `${number} ${roNeedsDe(value) ? "de " : ""}${noun}`;
}

/** Hours: one decimal under 10, whole hours above. */
export function roundHours(value: number): number {
  return value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
}

/** RON: to the nearest 10. */
export function roundRon(value: number): number {
  return Math.round(value / 10) * 10;
}

/** Months: one decimal. */
export function roundMonths(value: number): number {
  return Math.round(value * 10) / 10;
}

/** A "nice" count for prose: 2 significant digits above 100. */
export function roundCount(value: number): number {
  if (value < 20) return Math.max(1, Math.round(value));
  if (value < 100) return Math.round(value / 5) * 5;
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

export function mapRange(range: Range, fn: (value: number) => number): Range {
  return { low: fn(range.low), high: fn(range.high) };
}

export function addRanges(ranges: Range[]): Range {
  return ranges.reduce((sum, r) => ({ low: sum.low + r.low, high: sum.high + r.high }), {
    low: 0,
    high: 0,
  });
}

export function midpoint(range: Range): number {
  return (range.low + range.high) / 2;
}

/* ------------------------------------------------------------- estimates */

/** The central value of an estimate; the range midpoint for stored blueprints without one. */
export function midOf(estimate: Estimate): number {
  return estimate.mid ?? midpoint(estimate);
}

/** Maps the corners and the central value (a missing central value stays missing). */
export function mapEstimate(estimate: Estimate, fn: (value: number) => number): Estimate {
  const out: Estimate = { low: fn(estimate.low), high: fn(estimate.high) };
  if (estimate.mid !== undefined) out.mid = fn(estimate.mid);
  return out;
}

/** Sums estimates, central values included (a missing one counts as its midpoint). */
export function addEstimates(estimates: Estimate[]): Estimate & { mid: number } {
  return estimates.reduce<Estimate & { mid: number }>(
    (sum, e) => ({ low: sum.low + e.low, high: sum.high + e.high, mid: sum.mid + midOf(e) }),
    { low: 0, high: 0, mid: 0 },
  );
}

/** A plain range (price book) as an estimate whose central value is the midpoint. */
export function centred(range: Range): Estimate & { mid: number } {
  return { low: range.low, high: range.high, mid: midpoint(range) };
}

/* -------------------------------------------------------------- rounding */

/** To the nearest multiple of `step`. */
export function roundStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Rounds a group of rows to `step` so that the rows add up to the total: the
 * total is the rounded raw sum (or `total` when given), each row is floored to
 * the step and the steps left over go to the largest remainders (ties: the
 * larger row, then the earlier one). Every surface then shows the same row.
 */
export function roundGroup(
  values: number[],
  step: number,
  total?: number,
): { rows: number[]; total: number } {
  const target =
    total ??
    roundStep(
      values.reduce((sum, v) => sum + v, 0),
      step,
    );
  // Floor through a small epsilon so 4500/500 never floors to 8.999… steps.
  const rows = values.map((v) => Math.max(0, Math.floor(v / step + 1e-9)) * step);
  const order = values
    .map((v, i) => ({ i, v, rest: v - rows[i] }))
    .sort((a, b) => b.rest - a.rest || b.v - a.v || a.i - b.i);
  let left = Math.round((target - rows.reduce((sum, v) => sum + v, 0)) / step);
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length, left--) {
    rows[order[k].i] += step;
  }
  for (let k = order.length - 1; left < 0 && k >= 0; k--) {
    if (rows[order[k].i] >= step) {
      rows[order[k].i] -= step;
      left++;
    }
  }
  return { rows, total: target };
}

/** Hours shown on their own: whole hours under 10, steps of 5 above. */
export function roundHoursAlone(value: number): number {
  return value < 10 ? Math.round(value) : roundStep(value, STEP.hours);
}

/* ----------------------------------------------------------- display text */

const bi = (en: string, ro: string): Bilingual => ({ en, ro });

/** "35 de ore" / "35 hours", with non-breaking spaces. */
export function hoursQty(value: number): Bilingual {
  if (value === 1) return bi(`1${NBSP}hour`, `o${NBSP}oră`);
  const ro = `${formatNumber(value, "ro")}${NBSP}${roNeedsDe(value) ? `de${NBSP}` : ""}ore`;
  return bi(`${formatNumber(value, "en")}${NBSP}hours`, ro);
}

/** "cam 35 de ore pe lună" / "about 35 hours a month". */
export function hoursPerMonth(value: number): Bilingual {
  const qty = hoursQty(value);
  return bi(`about ${qty.en} a month`, `cam ${qty.ro} pe lună`);
}

/** "8.000 lei" / "8,000 RON" (money takes no "de" in figures: "1.000 lei"). */
export function lei(value: number): Bilingual {
  return bi(`${formatNumber(value, "en")}${NBSP}RON`, `${formatNumber(value, "ro")}${NBSP}lei`);
}

/** "≈ 8.000 lei" / "≈ 8,000 RON": a one-off estimate. */
export function approxLei(value: number): Bilingual {
  const amount = lei(value);
  return bi(`≈${NBSP}${amount.en}`, `≈${NBSP}${amount.ro}`);
}

/** "cam 2.900 lei pe lună" / "about 2,900 RON a month". */
export function leiPerMonth(value: number, approx = true): Bilingual {
  const amount = lei(value);
  return approx
    ? bi(`about ${amount.en} a month`, `cam ${amount.ro} pe lună`)
    : bi(`${amount.en} a month`, `${amount.ro} pe lună`);
}

/** "−2.000 lei" / "+21.000 lei" (zero has no sign). */
export function signedLei(value: number): Bilingual {
  const sign = value > 0 ? "+" : "";
  const amount = lei(value);
  return bi(`${sign}${amount.en}`, `${sign}${amount.ro}`);
}

/** "luna 14" / "month 14" (capitalise at the start of a sentence with `ucFirst`). */
export function monthLabel(month: number): Bilingual {
  return bi(`month${NBSP}${month}`, `luna${NBSP}${month}`);
}

/** "luna 1" / "lunile 2–3" for a span of plan months. */
export function monthSpan(start: number, end: number): Bilingual {
  return start === end
    ? monthLabel(start)
    : bi(`months${NBSP}${start}–${end}`, `lunile${NBSP}${start}–${end}`);
}

/** "6 luni" / "24 de luni" / "1 lună". */
export function monthsQty(value: number): Bilingual {
  if (value === 1) return bi(`1${NBSP}month`, `o${NBSP}lună`);
  return bi(`${value}${NBSP}months`, `${value}${NBSP}${roNeedsDe(value) ? `de${NBSP}` : ""}luni`);
}

/** Upper-cases the first letter ("luna 14" → "Luna 14"). */
export function ucFirst(text: string): string {
  return text ? text[0].toLocaleUpperCase("ro") + text.slice(1) : text;
}

/** Lower-cases the first letter unless the word is an acronym ("AI", "AWB"). */
export function lcFirst(text: string): string {
  return /^[A-ZĂÂÎȘȚ][a-zăâîșț]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

/**
 * A plural customer noun with its definite article: "pacienți" → "pacienții",
 * "clienți firme" → "clienții" (the first word only, for "… noi").
 */
export function roDefinite(customers: string): string {
  const first = customers.split(" ")[0];
  return first.endsWith("i") ? `${first}i` : first;
}

/** "a, b și c" / "a, b and c". */
export function joinList(items: string[], lang: Lang): string {
  if (items.length <= 1) return items.join("");
  const and = lang === "ro" ? "și" : "and";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/**
 * A share (0–1) in words, for assumptions we never print as percentages. The
 * phrase is followed by "din …" / "of …" ("Cam jumătate din întrebări").
 */
export function shareWords(share: number): Bilingual {
  // Each band is centred on its fraction, so 0,30 reads "o treime", not "un sfert".
  if (share >= 0.65) return bi("most", "cea mai mare parte");
  if (share >= 0.55) return bi("more than half", "peste jumătate");
  if (share >= 0.42) return bi("about half", "cam jumătate");
  if (share >= 0.29) return bi("about a third", "cam o treime");
  if (share >= 0.18) return bi("about a quarter", "cam un sfert");
  return bi("a small share", "o mică parte");
}

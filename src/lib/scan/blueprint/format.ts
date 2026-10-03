import type { Lang, Range } from "@/lib/scan/types";

/*
 * Number formatting for the bilingual templates. Grouping is done by hand
 * (not Intl) so the server and every browser print exactly the same string.
 */

export function formatNumber(value: number, lang: Lang, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const group = lang === "ro" ? "." : ",";
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const sign = value < 0 ? "-" : "";
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

/** Lower-cases the first letter unless the word is an acronym ("AI", "AWB"). */
export function lcFirst(text: string): string {
  return /^[A-ZĂÂÎȘȚ][a-zăâîșț]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

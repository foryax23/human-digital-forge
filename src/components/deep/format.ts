import type { Bilingual, Lang } from "@/lib/deep/contracts";
import { formatDecimal, formatInt } from "@/lib/deep/parse/format";

/*
 * Number and date formats of the deep report on screen. Official figures arrive already
 * formatted in each fact's `display` (by code, on the server); these helpers format the
 * numbers the browser computes itself (estimates after "Ajustează", totals, timings), with
 * the refresh's rules: "lei" in both languages, a non-breaking space before the unit, the
 * real minus sign, an en dash in ranges and "≈" in front of estimates.
 */

export const NBSP = " ";
const MINUS = "−";

const signed = (text: string) => text.replace(/^-/, MINUS);

/** Rounds money to a readable step: 100 under 10.000, 500 under 100.000, 1.000 above. */
export function roundMoney(value: number): number {
  const abs = Math.abs(value);
  const step = abs < 1_000 ? 10 : abs < 10_000 ? 100 : abs < 100_000 ? 500 : 1_000;
  return Math.round(value / step) * step;
}

/** "4.620.000 lei" / "4,620,000 lei" with a non-breaking space and a real minus. */
export function lei(value: number, lang: Lang): string {
  return `${signed(formatInt(value, lang))}${NBSP}lei`;
}

/** Money in short form for figures: "4,62 mil." + unit "lei" (value and unit kept apart). */
export function leiParts(value: number, lang: Lang): { value: string; unit: string } {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const digits = abs >= 100_000_000 ? 0 : abs >= 10_000_000 ? 1 : 2;
    const m = signed(formatDecimal(value / 1_000_000, lang, digits));
    return lang === "ro" ? { value: m, unit: "mil. lei" } : { value: `${m}M`, unit: "lei" };
  }
  if (abs >= 10_000) {
    const k = signed(formatInt(Math.round(value / 1000), lang));
    return lang === "ro" ? { value: k, unit: "mii lei" } : { value: `${k}k`, unit: "lei" };
  }
  return { value: signed(formatInt(value, lang)), unit: "lei" };
}

/** "≈ 2.900 lei" for an estimate (rounded). */
export function approxLei(value: number, lang: Lang): string {
  return `≈${NBSP}${lei(roundMoney(value), lang)}`;
}

/** "2.300–3.600 lei" for a range, rounded, ordered low to high. */
export function leiRange(low: number, high: number, lang: Lang): string {
  const [a, b] = low <= high ? [low, high] : [high, low];
  return `${signed(formatInt(roundMoney(a), lang))}–${signed(formatInt(roundMoney(b), lang))}${NBSP}lei`;
}

/** "1,2 s" / "1.2 s"; whole seconds from 10 s; minutes and seconds from 60 s. */
export function duration(ms: number, lang: Lang): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return `${formatDecimal(s, lang, 1)}${NBSP}s`;
  if (s < 60) return `${Math.round(s)}${NBSP}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s - m * 60);
  return lang === "ro" ? `${m}${NBSP}min ${rest}${NBSP}s` : `${m}${NBSP}min ${rest}${NBSP}s`;
}

/** "0,42 $" / "0.42 $", always with its decimals (admin panel only). */
export function usd(value: number, lang: Lang, digits = 2): string {
  const fixed = Math.abs(value).toFixed(digits);
  const [whole, frac] = fixed.split(".");
  const sign = value < 0 ? MINUS : "";
  return `${sign}${formatInt(Number(whole), lang)}${lang === "ro" ? "," : "."}${frac}${NBSP}$`;
}

/** Today's date as "03.10.2026" / "3 Oct 2026". */
export function dayLabel(iso: string, lang: Lang): string {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!d) return iso;
  if (lang === "ro") return `${d[3]}.${d[2]}.${d[1]}`;
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  return `${Number(d[3])} ${months[Number(d[2]) - 1]} ${d[1]}`;
}

/** A fact's "valabil la": "FY2025" → "bilanț 2025"; an ISO date → "03.10.2026". */
export function asOfLabel(asOf: string, lang: Lang): string {
  const fy = /^FY(\d{4})$/.exec(asOf);
  if (fy) return lang === "ro" ? `bilanț ${fy[1]}` : `accounts ${fy[1]}`;
  return dayLabel(asOf, lang);
}

/** "din bilanțul 2025" / "verificat la 03.10.2026": when a fact holds, in plain words. */
export function asOfPhrase(asOf: string, lang: Lang): string {
  const fy = /^FY(\d{4})$/.exec(asOf);
  if (fy) return lang === "ro" ? `din bilanțul ${fy[1]}` : `from the ${fy[1]} accounts`;
  return lang === "ro"
    ? `verificat la ${dayLabel(asOf, lang)}`
    : `checked on ${dayLabel(asOf, lang)}`;
}

/** Romanian "de" from 20 up: "14 pagini", "20 de pagini", "101 pagini". */
export function roCount(n: number, one: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const rest = n % 100;
  const de = n >= 20 && (rest === 0 || rest >= 20);
  return `${formatInt(n, "ro")} ${de ? "de " : ""}${many}`;
}

/** Picks the active language of a bilingual text. */
export const pick = (text: Bilingual | undefined, lang: Lang): string => (text ? text[lang] : "");

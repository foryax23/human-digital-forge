import type { Bilingual, Lang, Range } from "@/lib/scan/types";

/** The visitor's language from a bilingual string, English as the fallback. */
export function pick(text: Bilingual | undefined, lang: Lang): string {
  if (!text) return "";
  return (lang === "ro" ? text.ro : text.en) || text.en || text.ro;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

/** Locale-aware number ("12,000" / "12.000"). */
export function formatNumber(value: number, lang: Lang, fractionDigits = 0): string {
  const key = `${lang}:${fractionDigits}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(lang === "ro" ? "ro-RO" : "en-GB", {
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: 0,
    });
    numberFormats.set(key, format);
  }
  return format.format(value);
}

/** "2,900–4,370", or a single number when both ends round the same. */
export function formatRange(range: Range, lang: Lang, fractionDigits = 0): string {
  const low = formatNumber(range.low, lang, fractionDigits);
  const high = formatNumber(range.high, lang, fractionDigits);
  return low === high ? low : `${low}–${high}`;
}

export function formatRon(range: Range, lang: Lang): string {
  return `${formatRange(range, lang)} RON`;
}

/** Axis-friendly money: 950 → "950", 12_400 → "12k", 4_500 → "4.5k". */
export function compactNumber(value: number, lang: Lang): string {
  const abs = Math.abs(value);
  if (abs < 1000) return formatNumber(value, lang);
  return `${formatNumber(value / 1000, lang, abs >= 10_000 ? 0 : 1)}k`;
}

/** "Month 1" / "Months 2–3" for a roadmap phase. */
export function formatMonthSpan(start: number, end: number, lang: Lang): string {
  if (start === end) return lang === "ro" ? `Luna ${start}` : `Month ${start}`;
  return lang === "ro" ? `Lunile ${start}–${end}` : `Months ${start}–${end}`;
}

/** "1–2 months" / "1 lună" for a duration range. */
export function formatMonthsRange(range: Range, lang: Lang, fractionDigits = 0): string {
  const single = range.low === range.high && range.high === 1;
  const unit = lang === "ro" ? (single ? "lună" : "luni") : single ? "month" : "months";
  return `${formatRange(range, lang, fractionDigits)} ${unit}`;
}

export const midpoint = (range: Range) => (range.low + range.high) / 2;

/** Short unit after an outcome range ("%", " h", " RON"). */
export function unitSuffix(unit: "%" | "hours" | "RON"): string {
  if (unit === "%") return "%";
  if (unit === "hours") return " h";
  return " RON";
}

/** Title-cases an ALL-CAPS registry string (ANAF addresses), leaves others alone. */
export function softenCaps(text: string): string {
  if (text !== text.toLocaleUpperCase("ro")) return text;
  return text
    .toLocaleLowerCase("ro")
    .replace(/(^|[\s,.(/-])(\p{L})/gu, (_, sep: string, letter: string) => {
      return sep + letter.toLocaleUpperCase("ro");
    });
}

/** Host without "www." for display. */
export function displayHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

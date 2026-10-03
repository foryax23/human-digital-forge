import type { Bilingual, Lang, Range } from "@/lib/scan/types";
import { formatNumber as formatFixed, midpoint, roNeedsDe } from "@/lib/scan/blueprint/format";

/*
 * Screen helpers for the scan report. Numbers come from the shared module
 * (src/lib/scan/blueprint/format.ts, also used by the PDF), so grouping,
 * the minus sign and "de" are the same everywhere: "1.000 lei", "−2.000",
 * "24 de luni". Figures a visitor reads should come from `displayPlan()`.
 */

export {
  approxLei,
  hoursPerMonth,
  lei,
  leiPerMonth,
  midOf,
  monthLabel,
  monthSpan,
  NBSP,
  roundGroup,
  roundStep,
  signedLei,
  STEP,
} from "@/lib/scan/blueprint/format";

/** The visitor's language from a bilingual string, English as the fallback. */
export function pick(text: Bilingual | undefined, lang: Lang): string {
  if (!text) return "";
  return (lang === "ro" ? text.ro : text.en) || text.en || text.ro;
}

/**
 * Locale number ("12,000" / "12.000", "4,6"): up to `fractionDigits`
 * decimals, trailing zeros dropped, real minus sign.
 */
export function formatNumber(value: number, lang: Lang, fractionDigits = 0): string {
  const text = formatFixed(value, lang, fractionDigits);
  if (!fractionDigits) return text;
  const decimal = lang === "ro" ? "," : ".";
  return text.includes(decimal) ? text.replace(/0+$/, "").replace(/[.,]$/, "") : text;
}

/** "2,900–4,370", or a single number when both ends round the same. */
export function formatRange(range: Range, lang: Lang, fractionDigits = 0): string {
  const low = formatNumber(range.low, lang, fractionDigits);
  const high = formatNumber(range.high, lang, fractionDigits);
  return low === high ? low : `${low}–${high}`;
}

/** "2.900–4.370 lei" / "2,900–4,370 RON". */
export function formatRon(range: Range, lang: Lang): string {
  return `${formatRange(range, lang)} ${lang === "ro" ? "lei" : "RON"}`;
}

/**
 * Axis-friendly money: 950 → "950", 12_400 → "12k", 4_500 → "4.5k".
 * @deprecated The refreshed chart labels its axis "mii lei" with plain numbers.
 */
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

/** "1–2 months" / "o lună" / "12–24 de luni" for a duration range. */
export function formatMonthsRange(range: Range, lang: Lang, fractionDigits = 0): string {
  const single = range.low === range.high && range.high === 1;
  if (lang === "ro") {
    if (single) return "o lună";
    const de = roNeedsDe(Math.round(range.high * 10 ** fractionDigits) / 10 ** fractionDigits);
    return `${formatRange(range, lang, fractionDigits)} ${de ? "de " : ""}luni`;
  }
  return `${formatRange(range, lang, fractionDigits)} ${single ? "month" : "months"}`;
}

export { midpoint };

/**
 * Short unit after an outcome range ("%", " ore" / " h", " lei" / " RON").
 * @deprecated Outcomes are statements now (`displayPlan().strategies[].result`).
 */
export function unitSuffix(unit: "%" | "hours" | "RON", lang?: Lang): string {
  if (unit === "%") return "%";
  if (unit === "hours") return lang === "ro" ? " ore" : " h";
  return lang === "ro" ? " lei" : " RON";
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

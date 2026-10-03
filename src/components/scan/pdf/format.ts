import type { Bilingual, Lang, Range } from "@/lib/scan/types";

/** Picks the active language from a bilingual value. */
export function pick(value: Bilingual | undefined, lang: Lang): string {
  if (!value) return "";
  return value[lang] || value.en;
}

/** Inline copy helper: `tr(lang)("Hours", "Ore")`. */
export function tr(lang: Lang) {
  return (en: string, ro: string) => (lang === "ro" ? ro : en);
}

const LOCALE: Record<Lang, string> = { en: "en-GB", ro: "ro-RO" };

/** Whole numbers with the language's grouping (2,900 / 2.900). */
export function formatInt(value: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.round(value));
}

/** One decimal when it matters (1.6 / 1,6), none for whole values. */
export function formatDecimal(value: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(value);
}

/** "52–78", or a single value when both ends match. */
export function formatRange(
  range: Range,
  lang: Lang,
  format: (value: number, lang: Lang) => string = formatInt,
): string {
  const low = format(range.low, lang);
  const high = format(range.high, lang);
  return low === high ? low : `${low}–${high}`;
}

/** Currency word: "RON" in English, "lei" in Romanian prose and tables. */
export function currency(lang: Lang): string {
  return lang === "ro" ? "lei" : "RON";
}

/**
 * Romanian puts "de" between a number and its noun when the number ends in
 * 00 or 20–99 ("56 de lei", "120 de ore", but "15 lei", "101 lei").
 */
export function roDe(value: number): string {
  const n = Math.abs(Math.round(value)) % 100;
  return n === 0 ? (Math.round(value) === 0 ? "" : "de ") : n >= 20 ? "de " : "";
}

/**
 * A range that may dip below zero (net gain): "−8.505 până la +4.339" /
 * "−8,505 to +4,339", with a true minus sign; plain formatRange otherwise.
 */
export function formatSignedRange(range: Range, lang: Lang): string {
  if (range.low >= 0) return formatRange(range, lang);
  const signed = (value: number) =>
    value < 0 ? `−${formatInt(Math.abs(value), lang)}` : `+${formatInt(value, lang)}`;
  return `${signed(range.low)} ${lang === "ro" ? "până la" : "to"} ${signed(range.high)}`;
}

/** Compact RON for axis labels: 12k, 1.2M. */
export function formatCompact(value: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Long date in the document language: "3 October 2026" / "3 octombrie 2026". */
export function formatDate(iso: string | undefined, lang: Lang): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  }).format(date);
}

export function midpoint(range: Range): number {
  return (range.low + range.high) / 2;
}

/** Hostname without "www." for display. */
export function displayHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(
      /^www\./,
      "",
    );
  } catch {
    return url;
  }
}

/** Shortens long strings (URLs, evidence) so a single unbreakable word can't overflow a column. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  // End on a whole word when that keeps most of the text; URLs and codes are cut hard.
  const space = cut.lastIndexOf(" ");
  const head = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${head.replace(/[\s,;:·–-]+$/, "")}…`;
}

/**
 * Whole items joined with commas while they fit in `max` characters, then a
 * count of the rest ("online booking, WhatsApp +9"), so a list is never cut
 * mid-word the way truncate would.
 */
export function fitList(items: string[], max: number): string {
  let out = "";
  for (let i = 0; i < items.length; i++) {
    const next = out ? `${out}, ${items[i]}` : items[i];
    const rest = items.length - i - 1;
    if (out && next.length + (rest ? ` +${rest}`.length : 0) > max) {
      return `${out} +${items.length - i}`;
    }
    out = next;
  }
  return out;
}

const COMMA_BELOW: Record<string, string> = { ş: "ș", ţ: "ț", Ş: "Ș", Ţ: "Ț" };

/**
 * Every string in a plain data tree with the legacy cedilla letters (ş ţ,
 * still common in ANAF records and older sites) spelled the correct
 * Romanian way, with a comma below (ș ț).
 */
export function withCommaBelow<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/[şţŞŢ]/g, (letter) => COMMA_BELOW[letter]) as T;
  }
  if (Array.isArray(value)) return value.map(withCommaBelow) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, withCommaBelow(item)]),
    ) as T;
  }
  return value;
}

/** Two-digit index: 1 → "01". */
export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** ASCII slug for file names: "Clinica Dentară Ș.R.L." → "Clinica-Dentara-S-R-L". */
export function asciiSlug(value: string, max = 48): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max)
      .replace(/-+$/g, "") || "report"
  );
}

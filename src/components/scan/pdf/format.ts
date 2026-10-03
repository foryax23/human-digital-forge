import type { Bilingual, Lang } from "@/lib/scan/types";

/*
 * Formatting for the PDF. Numbers, units and rounding come from the shared
 * helpers the scan screens use (src/lib/scan/blueprint/format.ts, spec §3.2),
 * so a figure reads the same on screen and on paper; only what is specific to
 * a printed page (dates, host names, fitting long strings) lives here.
 */

export {
  approxLei,
  formatNumber,
  hoursPerMonth,
  hoursQty,
  lei,
  leiPerMonth,
  MINUS,
  monthLabel,
  monthSpan,
  monthsQty,
  NBSP,
  roNeedsDe,
  signedLei,
  ucFirst,
} from "@/lib/scan/blueprint/format";
export { withCommaBelow } from "@/lib/scan/localize";

/** Picks the active language from a bilingual value. */
export function pick(value: Bilingual | undefined, lang: Lang): string {
  if (!value) return "";
  return value[lang] || value.en;
}

/** Inline copy helper: `tr(lang)("Hours", "Ore")`. */
export function tr(lang: Lang) {
  return (en: string, ro: string) => (lang === "ro" ? ro : en);
}

/** "de " before a Romanian noun when the count needs it ("20 de ore", "15 ore"). */
export function roDe(value: number): string {
  const n = Math.abs(Math.round(value));
  return n >= 20 && (n % 100 === 0 || n % 100 >= 20) ? "de " : "";
}

/** Long date in the document language: "3 October 2026" / "3 octombrie 2026". */
export function formatDate(iso: string | undefined, lang: Lang): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ro" ? "ro-RO" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  }).format(date);
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

/** "a, b și c" / "a, b and c", with "și încă 3" / "and 3 more" past `max` items. */
export function listOf(items: string[], lang: Lang, max = items.length): string {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  if (rest > 0) {
    return `${shown.join(", ")} ${lang === "ro" ? `și încă ${rest}` : `and ${rest} more`}`;
  }
  if (shown.length <= 1) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} ${lang === "ro" ? "și" : "and"} ${shown[shown.length - 1]}`;
}

/** Superscript digits for note references ("¹"), drawn in Space Grotesk. */
export function superscript(n: number): string {
  const digits = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return String(n)
    .split("")
    .map((d) => digits[Number(d)])
    .join("");
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

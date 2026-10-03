import type { Bilingual } from "../contracts";

/*
 * Number formats used in fact displays (client-safe). Every number a reader or
 * the AI sees is produced here, so the verifier can match prose against the
 * exact strings of the cited facts. Romanian: "4.620.000 lei", "4,62 mil. lei",
 * "21,5%". English: "4,620,000 lei", "4.62M lei", "21.5%".
 */

function group(digits: string, sep: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** Integer with thousands separators: RO "4.620.000", EN "4,620,000". */
export function formatInt(value: number, lang: "ro" | "en"): string {
  const sign = value < 0 ? "-" : "";
  return sign + group(String(Math.round(Math.abs(value))), lang === "ro" ? "." : ",");
}

/** Decimal with `digits` places (trailing zeros dropped): RO "4,62", EN "4.62". */
export function formatDecimal(value: number, lang: "ro" | "en", digits = 1): string {
  // Trailing zeros are dropped only after a decimal point: "120" stays "120", "4.50" becomes "4.5".
  let fixed = Math.abs(value).toFixed(digits);
  if (fixed.includes(".")) fixed = fixed.replace(/0+$/, "").replace(/\.$/, "");
  const [whole, frac] = fixed.split(".");
  const sign = value < 0 && Number(fixed) !== 0 ? "-" : "";
  const grouped = group(whole, lang === "ro" ? "." : ",");
  return sign + (frac ? `${grouped}${lang === "ro" ? "," : "."}${frac}` : grouped);
}

export const bi = (en: string, ro: string): Bilingual => ({ en, ro });

/** "4.620.000 lei" / "4,620,000 lei". */
export function lei(value: number): Bilingual {
  return bi(`${formatInt(value, "en")} lei`, `${formatInt(value, "ro")} lei`);
}

/** Short money: "4,62 mil. lei" / "4.62M lei"; "254 mii lei" / "254k lei"; small values unchanged. */
export function leiShort(value: number): Bilingual {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const m = value / 1_000_000;
    const digits = abs >= 100_000_000 ? 0 : abs >= 10_000_000 ? 1 : 2;
    return bi(
      `${formatDecimal(m, "en", digits)}M lei`,
      `${formatDecimal(m, "ro", digits)} mil. lei`,
    );
  }
  if (abs >= 10_000) {
    const k = Math.round(value / 1000);
    return bi(`${formatInt(k, "en")}k lei`, `${formatInt(k, "ro")} mii lei`);
  }
  return lei(value);
}

/** Percent from a ratio (0.215 → "21,5%"), one decimal below 10, none above. */
export function pct(ratio: number, digits?: number): Bilingual {
  const value = ratio * 100;
  const d = digits ?? (Math.abs(value) < 10 ? 1 : 0);
  return bi(`${formatDecimal(value, "en", d)}%`, `${formatDecimal(value, "ro", d)}%`);
}

/** Plain count: "106" (RO and EN share digits below 1000; grouped above). */
export function count(value: number): Bilingual {
  return bi(formatInt(value, "en"), formatInt(value, "ro"));
}

/** "din fiecare 100 de lei facturați, îți rămân 9" → the integer lei kept per 100. */
export function perHundred(ratio: number): number {
  return Math.round(ratio * 100);
}

/** ISO date "2026-10-03" → "03.10.2026" / "3 Oct 2026". */
export function dateLabel(iso: string): Bilingual {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!d) return bi(iso, iso);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return bi(`${Number(d[3])} ${months[Number(d[2]) - 1]} ${d[1]}`, `${d[3]}.${d[2]}.${d[1]}`);
}

/** Median and quartiles of a numeric list (linear interpolation, sorted copy). */
export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

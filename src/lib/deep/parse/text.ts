/*
 * Text helpers shared by the pure parsers (client-safe, no imports).
 */

/** ANAF still writes ş/ţ with a cedilla; Romanian uses the comma below (ș/ț). */
export const fixCedilla = (s: string) =>
  s.replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț");

/** Lower-case ASCII folding: "Timișoara" → "timisoara". */
export function fold(value: string): string {
  return fixCedilla(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Upper-case ASCII folding: "Timișoara" → "TIMISOARA". */
export const foldUpper = (value: string) => fold(value).toUpperCase();

/** Collapses whitespace (including non-breaking spaces) to single spaces. */
export const collapse = (value: string) => value.replace(/[\s\u00a0\u2007\u202f]+/g, " ").trim();

/**
 * Normal form for verbatim-quote checks: diacritics folded, whitespace
 * collapsed, typographic quotes and dashes unified, lower case.
 */
export function normalizeForQuote(value: string): string {
  return collapse(
    fold(value)
      .replace(/[‘’‚‛′`´]/g, "'")
      .replace(/[“”„‟«»″]/g, '"')
      .replace(/[‐-―−]/g, "-")
      .replace(/…/g, "...")
      // The model sees "<" and ">" as "‹" and "›" (llm/prompts.ts neutralize): same character here.
      .replace(/‹/g, "<")
      .replace(/›/g, ">"),
  );
}

const SMALL_WORDS = new Set(["de", "din", "la", "pe", "sub", "lui", "cu", "si"]);

/** "DROBETA-TURNU SEVERIN" → "Drobeta-Turnu Severin", "BAIA DE ARIEŞ" → "Baia de Arieș". */
export function titleCase(s: string): string {
  return fixCedilla(s)
    .toLocaleLowerCase("ro")
    .split(" ")
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word)
        ? word
        : word.replace(
            /(^|[-.(])(\p{L})/gu,
            (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("ro"),
          ),
    )
    .join(" ");
}

/** Decodes the handful of HTML/XML entities that appear in API payloads. */
export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Cuts a string to `max` characters on a word boundary, with an ellipsis. */
export function clip(value: string, max: number): string {
  const text = collapse(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(0, max - 1));
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

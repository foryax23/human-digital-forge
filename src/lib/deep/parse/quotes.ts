import { QUOTE_MAX } from "../contracts";

import { collapse, normalizeForQuote } from "./text";

/*
 * Quote checks for extracted items (client-safe): a quote is kept only when it
 * appears verbatim in that page's text (whitespace, quotes, dashes and
 * diacritics normalised) and fits the limit: 120 characters on sites with a
 * text-and-data-mining reservation, 200 otherwise, 300 as the hard cap.
 */

export function quoteLimit(tdmReserved: boolean): number {
  return tdmReserved ? QUOTE_MAX.tdm : QUOTE_MAX.default;
}

/** The quote as it will be stored (trimmed, cut to the limit on a word), or null when not on the page. */
export function verifyQuote(quote: string, pageText: string, limit: number): string | null {
  const q = collapse(quote).replace(/^["'«„“]+|["'»”]+$/g, "");
  if (q.length < 3) return null;
  const haystack = normalizeForQuote(pageText);
  const needle = normalizeForQuote(q);
  if (!needle || !haystack.includes(needle)) return null;
  const max = Math.min(limit, QUOTE_MAX.column);
  if (q.length <= max) return q;
  const cut = q.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}

/** "1.250,50" → 1250.5, "1,250.50" → 1250.5, "1 250" → 1250, "150" → 150, "12,5" → 12.5. */
export function parseLocaleNumber(token: string): number {
  let t = token.replace(/[\s\u00a0]/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t)) t = t.replace(/,/g, "");
  else t = t.replace(",", ".");
  return Number(t);
}

const NUMBER_TOKEN = /\d{1,3}(?:[.,\s\u00a0]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g;

/** The price amount appears as a number in the quote. */
export function amountInQuote(amount: number, quote: string): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  return (quote.match(NUMBER_TOKEN) ?? [])
    .map(parseLocaleNumber)
    .some((n) => Number.isFinite(n) && Math.abs(n - amount) < 0.01);
}

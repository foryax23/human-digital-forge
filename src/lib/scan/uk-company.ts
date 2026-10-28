/** Which company register the homepage search looks in. */
export type SearchCountry = "ro" | "uk";

/**
 * A UK Companies House number: 8 characters, either 8 digits or a 2-letter
 * prefix (SC, NI, OC, …) plus 6 digits. Short all-digit numbers are padded to 8.
 * Returns the canonical number, or null when the text is not one.
 */
export function parseUkCompanyNumber(input: string): string | null {
  const raw = input.trim().replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{6,8}$/.test(raw)) return raw.padStart(8, "0");
  if (/^[A-Z]{2}\d{6}$/.test(raw)) return raw;
  return null;
}

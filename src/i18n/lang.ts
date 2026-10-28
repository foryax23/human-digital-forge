/**
 * Language basics shared by the server and the browser (no React, no server-only imports).
 *
 * Romanian first: a visitor sees Romanian unless they chose English with the language switch.
 * That choice lives in the `vortex-language` cookie, so the server renders the right language
 * on the first byte and the browser hydrates the same markup (no flash, no hydration
 * mismatch). The cookie is a necessary preference cookie (the cookie policy already lists
 * "remembering your language"); it is set only when the visitor switches language.
 */

export type Language = "en" | "ro";

export const DEFAULT_LANGUAGE: Language = "ro";

/** Cookie name, also the localStorage key the site used before the cookie existed. */
export const LANGUAGE_COOKIE = "vortex-language";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function parseLanguage(value: unknown): Language | null {
  return value === "en" || value === "ro" ? value : null;
}

/** The language from a Cookie header (or `document.cookie`), or null when none was chosen. */
export function languageFromCookieHeader(header: string | null | undefined): Language | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== LANGUAGE_COOKIE) continue;
    return parseLanguage(part.slice(eq + 1).trim());
  }
  return null;
}

/** The Set-Cookie / document.cookie string that remembers a language for a year. */
export function languageCookieString(lang: Language, secure: boolean): string {
  return `${LANGUAGE_COOKIE}=${lang}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

/** Picks the string for a language: `pick(lang, "Services", "Servicii")`. */
export function pick(lang: Language, en: string, ro: string): string {
  return lang === "ro" ? ro : en;
}

/** `<html lang>` and Open Graph locale for a language. */
export const LOCALE: Record<Language, { html: string; og: string }> = {
  ro: { html: "ro", og: "ro_RO" },
  en: { html: "en", og: "en_US" },
};

/**
 * The language the root route loaded (its loader returns `{ lang }`), read from the route
 * matches a `head` function receives. Romanian when the root has not loaded.
 */
export function languageFromMatches(
  matches: ReadonlyArray<{ routeId?: string; loaderData?: unknown }> | undefined,
): Language {
  const root = matches?.find((m) => m.routeId === "__root__");
  const lang = (root?.loaderData as { lang?: unknown } | undefined)?.lang;
  return parseLanguage(lang) ?? DEFAULT_LANGUAGE;
}

// ---- Browser side -----------------------------------------------------------------------

/** The language chosen in this tab, so the root loader still answers right if cookies are blocked. */
let chosenInThisTab: Language | null = null;

export function rememberChosenLanguage(lang: Language): void {
  chosenInThisTab = lang;
}

export function chosenLanguageInThisTab(): Language | null {
  return chosenInThisTab;
}

// ---- Market (where the visitor buys: Romania in lei, the UK in pounds) ------------------

/** "ro": prices in lei, Romanian legal wording. "uk": English, prices in pounds, UK wording. */
export type Market = "ro" | "uk";

export const DEFAULT_MARKET: Market = "ro";

export const MARKET_COOKIE = "vortex-market";

export function parseMarket(value: unknown): Market | null {
  return value === "ro" || value === "uk" ? value : null;
}

export function marketFromCookieHeader(header: string | null | undefined): Market | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== MARKET_COOKIE) continue;
    return parseMarket(part.slice(eq + 1).trim());
  }
  return null;
}

export function marketCookieString(market: Market, secure: boolean): string {
  return `${MARKET_COOKIE}=${market}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

let marketInThisTab: Market | null = null;

export function rememberChosenMarket(market: Market): void {
  marketInThisTab = market;
}

export function chosenMarketInThisTab(): Market | null {
  return marketInThisTab;
}

/** The market the root route loaded, read from route matches (head functions). */
export function marketFromMatches(
  matches: ReadonlyArray<{ routeId?: string; loaderData?: unknown }> | undefined,
): Market {
  const root = matches?.find((m) => m.routeId === "__root__");
  const market = (root?.loaderData as { market?: unknown } | undefined)?.market;
  return parseMarket(market) ?? DEFAULT_MARKET;
}

import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  chosenLanguageInThisTab,
  languageFromCookieHeader,
  parseLanguage,
  type Language,
  DEFAULT_MARKET,
  MARKET_COOKIE,
  chosenMarketInThisTab,
  marketFromCookieHeader,
  parseMarket,
  type Market,
} from "./lang";

/**
 * The language to render: the visitor's saved choice (cookie), else Romanian.
 * On the server it reads the request's cookie; in the browser (client-side navigations and
 * reloads of the root loader after a switch) the tab's choice, then `document.cookie`. The
 * root loader calls it, and its result travels to the browser with the SSR payload, so the
 * first client render uses exactly the language the server rendered.
 */
export const getRequestLanguage = createIsomorphicFn()
  .server((): Language => {
    try {
      return parseLanguage(getCookie(LANGUAGE_COOKIE)) ?? DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  })
  .client(
    (): Language =>
      chosenLanguageInThisTab() ?? languageFromCookieHeader(document.cookie) ?? DEFAULT_LANGUAGE,
  );

/** The market to render (cookie), else Romania. Same server/browser split as the language. */
export const getRequestMarket = createIsomorphicFn()
  .server((): Market => {
    try {
      return parseMarket(getCookie(MARKET_COOKIE)) ?? DEFAULT_MARKET;
    } catch {
      return DEFAULT_MARKET;
    }
  })
  .client(
    (): Market =>
      chosenMarketInThisTab() ?? marketFromCookieHeader(document.cookie) ?? DEFAULT_MARKET,
  );

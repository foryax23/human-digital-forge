import { useRouter } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  LANGUAGE_COOKIE,
  languageCookieString,
  languageFromCookieHeader,
  parseLanguage,
  rememberChosenLanguage,
  marketCookieString,
  marketFromCookieHeader,
  rememberChosenMarket,
  type Language,
  type Market,
} from "./lang";

export type { Language } from "./lang";

type I18nContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  /** Returns the Romanian string when active, otherwise the English source. */
  t: (en: string, ro: string) => string;
  /** Where the visitor buys: "ro" (lei) or "uk" (pounds, English, UK legal wording). */
  market: Market;
  /** Switches market; "uk" also switches the language to English. */
  setMarket: (market: Market) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function saveChoice(lang: Language) {
  try {
    document.cookie = languageCookieString(lang, window.location.protocol === "https:");
  } catch {
    /* cookies blocked: the tab still remembers the choice (rememberChosenLanguage) */
  }
  try {
    window.localStorage.setItem(LANGUAGE_COOKIE, lang);
  } catch {
    /* ignore */
  }
}

/**
 * The active language. The app passes `initialLang` from the root loader (the visitor's
 * cookie, else Romanian), which is what the server rendered, so the first client render
 * matches the server markup. Without the prop (isolated renders such as the deep UI tests)
 * it starts in English, the language those renders assert.
 */
export function LanguageProvider({
  children,
  initialLang,
  initialMarket,
}: {
  children: ReactNode;
  initialLang?: Language;
  initialMarket?: Market;
}) {
  const router = useRouter({ warn: false });
  const [lang, setLangState] = useState<Language>(initialLang ?? "en");
  const [market, setMarketState] = useState<Market>(initialMarket ?? "ro");

  const setLang = useCallback(
    (next: Language) => {
      setLangState(next);
      rememberChosenLanguage(next);
      saveChoice(next);
      // The root loader reads the choice again, so <title>, meta and <html lang> follow.
      void router?.invalidate({ filter: (match) => match.routeId === "__root__" });
    },
    [router],
  );

  const setMarket = useCallback(
    (next: Market) => {
      setMarketState(next);
      rememberChosenMarket(next);
      try {
        document.cookie = marketCookieString(next, window.location.protocol === "https:");
      } catch {
        /* ignore */
      }
      if (next === "uk") setLang("en");
      else void router?.invalidate({ filter: (match) => match.routeId === "__root__" });
    },
    [router, setLang],
  );

  // First visit from a UK browser (en-GB) with no saved choice: open the UK version once.
  useEffect(() => {
    try {
      if (marketFromCookieHeader(document.cookie) || languageFromCookieHeader(document.cookie))
        return;
      if ((navigator.languages ?? [navigator.language]).some((l) => /^en-GB$/i.test(l))) {
        setMarket("uk");
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A choice saved before the cookie existed (localStorage only) moves to the cookie once.
  useEffect(() => {
    try {
      if (languageFromCookieHeader(document.cookie)) return;
      const stored = parseLanguage(window.localStorage.getItem(LANGUAGE_COOKIE));
      if (stored && stored !== lang) setLang(stored);
    } catch {
      /* ignore */
    }
    // Runs once after hydration; later changes go through setLang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep <html lang> in sync between root loader runs.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((en: string, ro: string) => (lang === "ro" ? ro : en), [lang]);

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t, market, setMarket }),
    [lang, setLang, t, market, setMarket],);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }
  return ctx;
}

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
  type Language,
} from "./lang";

export type { Language } from "./lang";

type I18nContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  /** Returns the Romanian string when active, otherwise the English source. */
  t: (en: string, ro: string) => string;
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
}: {
  children: ReactNode;
  initialLang?: Language;
}) {
  const router = useRouter({ warn: false });
  const [lang, setLangState] = useState<Language>(initialLang ?? "en");

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

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }
  return ctx;
}

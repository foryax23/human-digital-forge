import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "en" | "ro";

const STORAGE_KEY = "vortex-language";

type I18nContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  /** Returns the Romanian string when active, otherwise the English source. */
  t: (en: string, ro: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ro") return stored;
  } catch {
    /* ignore */
  }
  const nav = window.navigator?.language?.toLowerCase() ?? "";
  return nav.startsWith("ro") ? "ro" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start as "en" so SSR and the first client render match.
  const [lang, setLangState] = useState<Language>("en");

  // After mount, sync to the stored/detected preference.
  useEffect(() => {
    const detected = detectInitialLanguage();
    if (detected !== "en") setLangState(detected);
  }, []);

  // Keep <html lang> and storage in sync with the active language.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (en: string, ro: string) => (lang === "ro" ? ro : en),
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }
  return ctx;
}

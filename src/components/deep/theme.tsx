import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { SegmentedControl } from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import {
  ThemeContext,
  themeClasses as styles,
  useDeepTheme,
  type ThemeChoice,
  type ThemeValue,
} from "./theme-context";

/*
 * Light and dark for the deep page (D10): "system" follows the device setting, with a
 * Sistem / Întunecat / Luminos switch remembered in this browser (try/catch: a private
 * window simply forgets it). Portalled sheets and dialogs take `portalClass` so they match.
 */

const KEY = "vortex-deep:theme";

function readChoice(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "dark" || v === "light" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

/** The page's theme scope: wrap everything under the nav in it. */
export function DeepTheme({ children, forced }: { children: ReactNode; forced?: ThemeChoice }) {
  const [choice, setState] = useState<ThemeChoice>("system");
  const [prefersLight, setPrefersLight] = useState(false);

  useEffect(() => {
    if (forced) return;
    setState(readChoice());
  }, [forced]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setPrefersLight(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const active = forced ?? choice;
  const value = useMemo<ThemeValue>(() => {
    const light = active === "light" || (active === "system" && prefersLight);
    return {
      choice: active,
      setChoice,
      scopeClass: active === "light" ? styles.light : active === "system" ? styles.system : "",
      portalClass: light ? styles.light : "cinematic",
    };
  }, [active, prefersLight, setChoice]);

  return (
    <ThemeContext.Provider value={value}>
      <div className={cn(styles.scope, value.scopeClass, "min-h-screen")}>{children}</div>
    </ThemeContext.Provider>
  );
}

/** "Aspect: Sistem · Întunecat · Luminos". */
export function ThemeSwitch({ className }: { className?: string }) {
  const { t } = useI18n();
  const { choice, setChoice } = useDeepTheme();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-[0.8125rem] text-fg-3">{t("Look", "Aspect")}</span>
      <SegmentedControl<ThemeChoice>
        className="max-sm:h-12 max-sm:[&>button]:h-11"
        label={t("Page look", "Aspectul paginii")}
        value={choice}
        onChange={setChoice}
        options={[
          { value: "system", label: t("System", "Sistem") },
          { value: "dark", label: t("Dark", "Întunecat") },
          { value: "light", label: t("Light", "Luminos") },
        ]}
      />
    </div>
  );
}

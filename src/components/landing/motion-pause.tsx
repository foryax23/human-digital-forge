import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Pause, Play } from "lucide-react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Page-wide "pause motion" switch (WCAG 2.2.2) for the homepage's looping
 * motion: background videos, the rotating hero word, the marquee, the
 * auto-advancing process panel and every CSS animation (via
 * html[data-motion="paused"]). The choice lasts for the browser session.
 */

const STORAGE_KEY = "vortex-motion-paused";

const MotionPauseContext = createContext({
  paused: false,
  setPaused: (_paused: boolean) => {},
});

export function MotionPauseProvider({ children }: { children: ReactNode }) {
  const [paused, setPausedState] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY) === "1") setPausedState(true);
    } catch {
      /* ignore */
    }
  }, []);

  // On <html> so portalled dialogs and sheets freeze too.
  useEffect(() => {
    const root = document.documentElement;
    if (paused) root.dataset.motion = "paused";
    else delete root.dataset.motion;
    return () => {
      delete root.dataset.motion;
    };
  }, [paused]);

  const setPaused = useCallback((next: boolean) => {
    setPausedState(next);
    try {
      if (next) window.sessionStorage.setItem(STORAGE_KEY, "1");
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ paused, setPaused }), [paused, setPaused]);
  return <MotionPauseContext.Provider value={value}>{children}</MotionPauseContext.Provider>;
}

/** Outside a provider (e.g. /portfolio) motion is never paused from here. */
export function useMotionPause() {
  return useContext(MotionPauseContext);
}

/** Round pause/play button for the page-wide motion switch. */
export function MotionPauseToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const { paused, setPaused } = useMotionPause();
  const label = paused
    ? t("Play animations", "Pornește animațiile")
    : t("Pause animations", "Oprește animațiile");

  return (
    <button
      type="button"
      aria-pressed={paused}
      aria-label={label}
      title={label}
      onClick={() => setPaused(!paused)}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/40 text-foreground/85 backdrop-blur transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
    </button>
  );
}

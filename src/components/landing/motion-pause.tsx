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

import { IconButton } from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Page-wide "pause motion" switch (WCAG 2.2.2) for the homepage's looping
 * motion: the ASCII vortex, background videos, the logo band, the brand sign-off and
 * every CSS animation (via html[data-motion="paused"]). The choice lasts for the
 * browser session.
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

/** Outside a provider (the client area) motion is never paused from here. */
export function useMotionPause() {
  return useContext(MotionPauseContext);
}

/**
 * Pause / play button for the page-wide motion switch: a 36 px square icon button on a
 * solid surface, so it stays legible over the hero's vortex without blur.
 */
export function MotionPauseToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const { paused, setPaused } = useMotionPause();
  // A toggle keeps one name and says its state with aria-pressed ("Oprește animațiile,
  // apăsat"); the tooltip says what a click does next.
  const label = t("Pause animations", "Oprește animațiile");
  const hint = paused
    ? t("Play animations", "Pornește animațiile")
    : t("Pause animations", "Oprește animațiile");

  return (
    <IconButton
      size="md"
      variant="secondary"
      aria-pressed={paused}
      label={label}
      title={hint}
      onClick={() => setPaused(!paused)}
      className={cn("bg-s1 hover:bg-s3", className)}
    >
      {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
    </IconButton>
  );
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AnimatePresence } from "motion/react";

import { STORAGE_KEY, STYLE_ID } from "./intro-script";
import { prefersReducedMotion, useIsomorphicLayoutEffect } from "./motion-prefs";

/**
 * Intro gate for the homepage loading screen.
 *
 * The loader plays once per browser session, and never for reduced-motion
 * visitors or deep links to a section. The decision has to be made twice with the same rules:
 *  - before first paint, by INTRO_HEAD_SCRIPT, which injects CSS that shows the
 *    server-rendered loader and pre-hides the hero copy (so nothing flashes);
 *  - after hydration, by useIntroMode(), which React uses to mount the loader.
 */

export type IntroMode = "pending" | "play" | "skip";

function readIntroMode(): IntroMode {
  // Deep links (/#pricing) go straight to their section.
  if (prefersReducedMotion() || window.location.hash) return "skip";
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1" ? "skip" : "play";
  } catch {
    return "skip";
  }
}

const noopSubscribe = () => () => {};

/** "pending" during SSR and hydration, then "play" or "skip" in the browser. */
export function useIntroMode(): IntroMode {
  return useSyncExternalStore(noopSubscribe, readIntroMode, () => "pending" as const);
}

const IntroContext = createContext({ introDone: true });

/** False while the loading screen is still up; entrance animations wait for true. */
export function useIntroDone() {
  return useContext(IntroContext).introDone;
}

export function IntroProvider({
  renderLoader,
  children,
}: {
  /** Must return a keyed motion element with an `exit` animation. */
  renderLoader: (props: { active: boolean; onComplete: () => void }) => ReactNode;
  children: ReactNode;
}) {
  const mode = useIntroMode();
  const [done, setDone] = useState(false);
  const showLoader = mode !== "skip" && !done;
  const introDone = mode === "skip" || done;

  const handleComplete = useCallback(() => setDone(true), []);

  // On client-side navigation to the page the head script hasn't run before
  // first paint, so show the loader from here instead.
  useIsomorphicLayoutEffect(() => {
    if (mode !== "play" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ".intro-loader{display:flex}";
    document.head.appendChild(style);
  }, [mode]);

  // Keep the page still underneath the loader.
  useEffect(() => {
    if (mode !== "play" || done) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [mode, done]);

  const handleExitComplete = useCallback(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    document.querySelectorAll(`#${STYLE_ID}`).forEach((el) => el.remove());
  }, []);

  return (
    <IntroContext.Provider value={{ introDone }}>
      <AnimatePresence onExitComplete={handleExitComplete}>
        {showLoader && renderLoader({ active: mode === "play", onComplete: handleComplete })}
      </AnimatePresence>
      {/* Inert while the loader covers it, so Tab can't land on hidden controls.
          Only in "play": SSR/hydration ("pending") and skipped intros stay live. */}
      <div inert={mode === "play" && !done ? true : undefined}>{children}</div>
    </IntroContext.Provider>
  );
}

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { useI18n } from "@/i18n";

const COUNT_MS = 2700;
const HOLD_MS = 400;
const WORD_MS = 900;

const WORDS = {
  en: ["Design", "Build", "Automate"],
  ro: ["Proiectăm", "Construim", "Automatizăm"],
} as const;
const WORD_COUNT = WORDS.en.length;

const EASE = [0.25, 0.1, 0.25, 1] as const;

/**
 * Homepage intro curtain: a 000 → 100 counter, cycling service words and a
 * brand-gradient progress bar, then the whole screen slides up as the page
 * transition. Rendered by IntroProvider; it only counts once `active` is true.
 */
export function LoadingScreen({ active, onComplete }: { active: boolean; onComplete: () => void }) {
  const { t, lang } = useI18n();
  const [count, setCount] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let start: number | null = null;
    let lastCount = -1;
    let lastWord = -1;

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const nextCount = Math.min(100, Math.round((elapsed / COUNT_MS) * 100));
      // Same clock as the counter, so the last word holds (instead of wrapping
      // back to the first) during the final beat before the curtain lifts.
      const nextWord = Math.floor(Math.min(elapsed, COUNT_MS - 1) / WORD_MS) % WORD_COUNT;

      if (nextCount !== lastCount) {
        lastCount = nextCount;
        setCount(nextCount);
      }
      if (nextWord !== lastWord) {
        lastWord = nextWord;
        setWordIndex(nextWord);
      }

      if (nextCount < 100) {
        frame = requestAnimationFrame(tick);
        return;
      }
      timeout = setTimeout(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        onCompleteRef.current();
      }, HOLD_MS);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [active]);

  // Server render and hydration are inactive: show the resting 000 frame.
  const shownCount = active ? count : 0;
  const shownWord = active ? wordIndex : 0;

  return (
    <motion.div
      className="intro-loader fixed inset-0 z-[9999] bg-background text-foreground"
      // The CSS fail-safe hid the loader (very slow hydration): finish now
      // rather than keep the page locked behind an invisible curtain.
      onAnimationEnd={(event) => {
        if (event.animationName !== "intro-failsafe" || completedRef.current) return;
        completedRef.current = true;
        onCompleteRef.current();
      }}
      exit={{ y: "-100%" }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.p
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="absolute left-0 top-0 px-6 py-6 text-xs uppercase tracking-[0.3em] text-muted-foreground md:px-10 md:py-10"
      >
        Vortex Hub
      </motion.p>

      <div aria-hidden className="absolute inset-0 flex items-center justify-center px-6">
        {/* initial={false}: the first word is part of the server-rendered frame. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            // Keyed by position, so a language switch swaps the text without replaying.
            key={shownWord}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="block font-display text-4xl font-semibold tracking-tight text-foreground/80 md:text-6xl lg:text-7xl"
          >
            {WORDS[lang][shownWord]}
          </motion.span>
        </AnimatePresence>
      </div>

      <div
        aria-hidden
        className="absolute bottom-0 right-0 px-6 py-6 font-display text-6xl font-semibold leading-none tabular-nums md:px-10 md:py-10 md:text-8xl lg:text-9xl"
      >
        {String(shownCount).padStart(3, "0")}
      </div>

      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-border/50">
        <div
          className="accent-gradient h-full w-full"
          style={{
            transform: `scaleX(${shownCount / 100})`,
            transformOrigin: "left",
            boxShadow: "0 0 8px oklch(0.585 0.225 282 / 0.45)",
          }}
        />
      </div>

      <p role="status" className="sr-only">
        {t("Loading Vortex Hub", "Se încarcă Vortex Hub")}
      </p>
    </motion.div>
  );
}

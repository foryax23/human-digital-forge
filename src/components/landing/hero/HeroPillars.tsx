import { useEffect, useId, useRef, useState } from "react";
import { MotionConfig, motion } from "motion/react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { OrbitSector } from "../ascii";
import { useMotionPause } from "../motion-pause";
import { scrollToSection } from "../smooth-scroll";
import { PillarIcon } from "./icons";
import styles from "./HeroPillars.module.css";

/*
 * The four pillars under the hero's search: an icon over a label, each one
 * scrolling to the section that explains it. A violet underline marks the
 * active pillar and glides to whichever one is hovered or keyboard-focused,
 * and each pillar that becomes active plays its icon's short animation.
 * Left alone, it walks through the four every few seconds and each step stirs
 * the matching quarter of the ASCII vortex; the walk waits while the visitor
 * points at a pillar, focuses one, uses the search, or the hero is off screen,
 * and never runs under reduced motion or the pause switch (it rests on the
 * first pillar then).
 */

type Pillar = {
  key: OrbitSector;
  en: string;
  ro: string;
  /** Where the pillar leads, named for screen readers. */
  hint: { en: string; ro: string };
  target: string;
};

const PILLARS: Pillar[] = [
  {
    key: "analyse",
    en: "Analysis",
    ro: "Analiză",
    hint: { en: "what we do", ro: "ce facem" },
    target: "services",
  },
  {
    key: "automate",
    en: "Automation",
    ro: "Automatizare",
    hint: { en: "how it works", ro: "cum funcționează" },
    target: "process",
  },
  {
    key: "growth",
    en: "Growth",
    ro: "Creștere",
    hint: { en: "plans and pricing", ro: "planuri și prețuri" },
    target: "pricing",
  },
  {
    key: "strategy",
    en: "Strategy",
    ro: "Strategie",
    hint: { en: "book a consultation", ro: "programează o consultanță" },
    target: "consultation",
  },
];

/** One step of the idle walk. */
const STEP_MS = 4500;

/**
 * `hold` stops the idle walk and the vortex reaction (the search is in use);
 * `onSectorChange` reports the pillar that should stir the vortex: the one
 * hovered or focused, else the walk's current one (null while held or still).
 */
export function HeroPillars({
  hold = false,
  onSectorChange,
  className,
}: {
  hold?: boolean;
  onSectorChange?: (sector: OrbitSector | null) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const { paused } = useMotionPause();
  const indicatorId = `pillar-indicator-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const navRef = useRef<HTMLElement>(null);
  // The pillar under the pointer or keyboard focus.
  const [lit, setLit] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [onScreen, setOnScreen] = useState(true);
  const [reduced, setReduced] = useState(false);
  // Counts how often each pillar's icon animation was asked for (its parity picks the
  // keyframe twin, see the CSS module); 0 = never, so nothing plays on load.
  const [pulses, setPulses] = useState<number[]>(() => PILLARS.map(() => 0));

  const onSectorChangeRef = useRef(onSectorChange);
  useEffect(() => {
    onSectorChangeRef.current = onSectorChange;
  }, [onSectorChange]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  const still = paused || reduced;
  const walking = !still && !hold && lit === null && onScreen;

  useEffect(() => {
    if (!walking) return;
    const timer = window.setInterval(() => setStep((n) => (n + 1) % PILLARS.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, [walking]);

  const active = lit ?? (still ? 0 : step);
  const pulse = (index: number) =>
    setPulses((counts) => counts.map((count, i) => (i === index ? count + 1 : count)));
  // A pillar that becomes active plays its animation (not the first one on load).
  const shownRef = useRef(active);
  useEffect(() => {
    if (shownRef.current === active) return;
    shownRef.current = active;
    setPulses((counts) => counts.map((count, i) => (i === active ? count + 1 : count)));
  }, [active]);
  const sector = lit !== null ? PILLARS[lit].key : hold || still ? null : PILLARS[step].key;
  useEffect(() => {
    onSectorChangeRef.current?.(sector);
  }, [sector]);

  // The walk carries on from the pillar the visitor left.
  const release = (index: number) => {
    if (lit !== index) return;
    setStep(index);
    setLit(null);
  };

  return (
    <MotionConfig reducedMotion="user">
      <nav
        ref={navRef}
        aria-label={t("Explore Vortex Hub", "Explorează Vortex Hub")}
        className={cn("relative isolate", className)}
      >
        {/* A soft dark plate keeps the labels legible over the vortex's lower rim
            (as wide as the hero's column, so it never widens the page). */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-y-6 inset-x-0 -z-10 bg-[radial-gradient(closest-side,rgb(0_2_15/0.62),rgb(0_2_15/0.45)_65%,transparent)]"
        />
        {/* One row everywhere: four equal columns on phones, spaced out from sm up. */}
        <ul
          role="list"
          className="mx-auto grid w-full max-w-[24rem] grid-cols-4 sm:flex sm:w-fit sm:max-w-none sm:justify-center sm:gap-4 lg:gap-10 2xl:gap-14"
        >
          {PILLARS.map((pillar, index) => {
            const label = t(pillar.en, pillar.ro);
            const on = index === active;
            const count = pulses[index];
            return (
              <li key={pillar.key} className="flex justify-center">
                <button
                  type="button"
                  aria-label={`${label}: ${t(pillar.hint.en, pillar.hint.ro)}`}
                  data-pulse={count === 0 ? undefined : count % 2 ? "a" : "b"}
                  onClick={() => scrollToSection(pillar.target)}
                  onPointerEnter={() => {
                    // Already active: becoming lit changes nothing, so replay it here.
                    if (index === active) pulse(index);
                    setLit(index);
                  }}
                  onPointerLeave={() => release(index)}
                  onFocus={(event) => {
                    // Keyboard focus only; a click's focus shouldn't hold the walk.
                    if (!event.currentTarget.matches(":focus-visible")) return;
                    if (index === active) pulse(index);
                    setLit(index);
                  }}
                  onBlur={() => release(index)}
                  className={cn(
                    styles.pillar,
                    "group/pillar relative flex w-full flex-col items-center gap-2 rounded-lg px-1 pb-4 pt-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c4b5fd]/50 sm:w-28 sm:gap-2.5 sm:px-2 2xl:w-32",
                  )}
                >
                  <PillarIcon
                    sector={pillar.key}
                    className={cn(
                      // A tight dark halo instead of a heavier plate: legible on the vortex's bright arm.
                      "size-7 drop-shadow-[0_0_6px_rgb(0_2_15/0.95)] transition-opacity duration-300 sm:size-10 2xl:size-11",
                      on ? "opacity-100" : "opacity-90 group-hover/pillar:opacity-100",
                    )}
                  />
                  <span
                    className={cn(
                      "type-micro sm:type-body-sm whitespace-nowrap transition-colors duration-300 [text-shadow:0_0_10px_rgb(0_2_15/0.95),0_0_3px_rgb(0_2_15/0.9)]",
                      on ? "text-white" : "text-white/75 group-hover/pillar:text-white",
                    )}
                  >
                    {label}
                  </span>
                  {on && (
                    <motion.span
                      aria-hidden
                      layoutId={indicatorId}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-x-0 bottom-0 mx-auto h-0.5 w-12 rounded-full bg-gradient-to-r from-[#8b7cf6] via-[#d4c9ff] to-[#8b7cf6] shadow-[0_0_10px_1px_rgb(139_124_246/0.55)] sm:w-[4.75rem]"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </MotionConfig>
  );
}

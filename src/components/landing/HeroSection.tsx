import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { AsciiVortexState, OrbitSector } from "./ascii";
import { gsap, prefersReducedMotion, useGsap } from "./gsap";
import { WarpWords } from "./hero/WarpWords";
import { HeroPillars } from "./hero/HeroPillars";
import { ReticleMark } from "./hero/icons";
import { HeroCosmos, VORTEX_CENTRE } from "./HeroCosmos";
import { HeroProof } from "./HeroProof";
import { HeroTelemetry } from "./HeroTelemetry";
import { MotionPauseToggle, useMotionPause } from "./motion-pause";
import { scrollToSection } from "./smooth-scroll";
import { VortexSearch, type SearchFieldState } from "./VortexSearch";

/** The submit transition before /scan opens: visual only, no progress is implied. */
const SCAN_TRANSITION_MS = 800;

/**
 * Search-first hero (Vortex Scan, screen 01), one calm centred column over
 * the vortex: eyebrow, a two-line title, a two-line pitch, the company /
 * website search with two example searches under it, and the four pillars
 * (analyse, automate, growth, strategy) that lead to the sections explaining
 * them. A line of real launched work runs along the bottom. The entrance
 * waits for the intro loader.
 *
 * The vortex follows the search: idle → focus → typing (each keystroke pulses
 * it) → scanning, a short visual transition on submit before /scan opens
 * (skipped for reduced motion and the pause switch). The active pillar stirs
 * its quarter of the vortex.
 */
export function HeroSection() {
  const { t } = useI18n();
  const introDone = useIntroDone();
  const { paused } = useMotionPause();
  const sectionRef = useRef<HTMLElement>(null);
  const [fieldState, setFieldState] = useState<SearchFieldState>("idle");
  const [scanning, setScanning] = useState(false);
  const [typingPulse, setTypingPulse] = useState(0);
  const [sector, setSector] = useState<OrbitSector | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const scanTimer = useRef<number | undefined>(undefined);
  const scanScroll = useRef<gsap.core.Tween | null>(null);

  useGsap(
    () => {
      if (!introDone) return;
      if (prefersReducedMotion()) {
        gsap.set(".name-reveal, .blur-in", { opacity: 1, y: 0, filter: "none" });
        return;
      }
      // fromTo with explicit end values: the head script holds these at opacity 0 in CSS.
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(".name-reveal", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.2 }, 0.1)
        .fromTo(
          ".blur-in",
          { opacity: 0, filter: "blur(10px)", y: 16 },
          {
            opacity: 1,
            filter: "blur(0px)",
            y: 0,
            duration: 1,
            stagger: 0.09,
            clearProps: "filter",
          },
          0.3,
        );
    },
    sectionRef,
    [introDone],
  );

  useEffect(
    () => () => {
      window.clearTimeout(scanTimer.current);
      scanScroll.current?.kill();
    },
    [],
  );

  const searchActive = fieldState !== "idle";
  const asciiState: AsciiVortexState = scanning ? "scanning" : fieldState;

  const pulse = useCallback(() => setTypingPulse((n) => n + 1), []);

  // Every way of starting a scan (Enter, a suggestion, a CUI) arrives here.
  const beforeScan = useCallback(
    (proceed: () => Promise<void>) => {
      if (paused || prefersReducedMotion()) {
        void proceed();
        return;
      }
      setScanning(true);
      // The suggestions may have scrolled the page: bring the vortex back into view.
      if (window.scrollY > 0) {
        scanScroll.current = gsap.to(window, {
          duration: 0.6,
          ease: "power2.out",
          scrollTo: { y: 0, autoKill: true },
          overwrite: "auto",
        });
      }
      window.clearTimeout(scanTimer.current);
      scanTimer.current = window.setTimeout(() => {
        // Back to normal if the navigation doesn't happen (the hero is still here).
        void proceed().finally(() => setScanning(false));
      }, SCAN_TRANSITION_MS);
    },
    [paused],
  );

  return (
    <section
      ref={sectionRef}
      id="top"
      aria-labelledby="hero-title"
      // z-20: the search suggestions may hang over the next section.
      className={cn("relative z-20 flex min-h-[100svh] flex-col bg-background", VORTEX_CENTRE)}
    >
      <HeroCosmos
        hero
        active={searchActive || scanning}
        asciiState={asciiState}
        sector={sector}
        typingPulse={typingPulse}
      />
      <HeroTelemetry state={asciiState} />

      {/* pt clears the fixed ~84px nav. */}
      <div className="pointer-events-none relative z-20 mx-auto flex w-full max-w-[1320px] flex-1 flex-col items-center justify-center px-6 pb-6 pt-24 md:px-10 lg:pb-[clamp(0.25rem,1.5vh,1.25rem)] lg:pt-[clamp(5.5rem,11vh,7rem)]">
        <div className="pointer-events-auto flex w-full max-w-[48rem] flex-col items-center text-center 2xl:max-w-[52rem]">
          <p
            {...reveal}
            className="type-caps blur-in relative isolate mb-4 flex max-w-full items-center justify-center gap-2.5 text-[#c9c4ee]/90 lg:mb-[clamp(0.875rem,2.2vh,1.25rem)]"
          >
            {/* A dark plate keeps the small type legible where the vortex's bright arm crosses it. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -inset-y-6 -z-10 bg-[radial-gradient(closest-side,rgb(0_2_15/0.94),rgb(0_2_15/0.85)_60%,transparent)] sm:-inset-x-16"
            />
            <ReticleMark className="size-4 text-hero-lilac" />
            {t("Intelligence for your business", "Inteligență pentru afacerea ta")}
          </p>

          <h1
            {...reveal}
            id="hero-title"
            className="type-display name-reveal mb-5 text-balance text-white [text-shadow:0_2px_30px_rgb(0_2_15/0.6)] lg:mb-[clamp(1rem,2.6vh,1.5rem)]"
          >
            <span className="block">{t("Discover the potential", "Descoperă potențialul")}</span>
            {/* The site's heading accent (soft lavender), gently warped; pb keeps the descenders inside the clip. */}
            <WarpWords
              text={t("of your business.", "afacerii tale.")}
              className="pb-[0.06em] [text-shadow:none]"
              textClassName="hero-heading-accent"
            />
          </h1>

          <p
            {...reveal}
            className="type-lead blur-in mb-9 text-balance text-white/80 lg:mb-[clamp(1.75rem,5.2vh,3rem)]"
          >
            <span className="block">
              {t("Analyse. Automate. Evolve.", "Analizează. Automatizează. Evoluează.")}
            </span>
            <span className="block">
              {t(
                "We build websites and automations for businesses in Romania.",
                "Facem site-uri și automatizări pentru firme din România.",
              )}
            </span>
          </p>

          {/* z-10: the suggestions open over the examples, the pillars and the bottom bar. */}
          <div
            {...reveal}
            className="blur-in relative z-10 w-full max-w-[42.5rem] 2xl:max-w-[50rem]"
          >
            <VortexSearch
              className="text-left"
              onStateChange={setFieldState}
              onInputPulse={pulse}
              onOpenChange={setSuggestionsOpen}
              onBeforeNavigate={beforeScan}
            />
          </div>

          <div {...reveal} className="blur-in mt-[clamp(1.5rem,4.6vh,3.25rem)] w-full">
            {/* Steps aside while the suggestions cover it, and back while a scan starts. */}
            <HeroPillars
              hold={searchActive || scanning || suggestionsOpen}
              onSectorChange={setSector}
              className={cn(
                "transition-opacity duration-300",
                suggestionsOpen && "pointer-events-none opacity-0",
                scanning && "opacity-40",
              )}
            />
          </div>
        </div>
      </div>

      {/* Bottom bar: real proof · scroll cue · the pause switch. */}
      <div
        {...reveal}
        className="blur-in pointer-events-none relative z-10 mx-auto grid w-full max-w-[1320px] grid-cols-[1fr_auto] items-center gap-4 px-6 pb-6 md:grid-cols-[1fr_auto_1fr] md:px-10 lg:px-12 lg:pb-7 [&>*]:pointer-events-auto"
      >
        <HeroProof className="justify-self-start" />

        <button
          type="button"
          onClick={() => scrollToSection("services")}
          className="type-label group/scroll hidden flex-col items-center gap-2.5 rounded-md px-3 py-1 text-white/60 transition-colors hover:text-white/85 focus-visible:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hero-lilac/75 md:flex"
        >
          {t("Scroll to explore", "Derulează")}
          <span aria-hidden className="relative h-8 w-px overflow-hidden bg-white/15">
            <span className="absolute inset-x-0 top-0 h-1/2 animate-[scroll-down_2.2s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-hero-lilac to-transparent" />
          </span>
        </button>

        <div className="flex items-center justify-end">
          <MotionPauseToggle className="shrink-0" />
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useI18n } from "@/i18n";
import { gsap, prefersReducedMotion, useGsap } from "./gsap";
import { HeroCosmos } from "./HeroCosmos";
import { useIntroDone } from "./intro";
import { HERO_REVEAL_ATTR } from "./intro-script";
import { MotionPauseToggle, useMotionPause } from "./motion-pause";
import { RingButton } from "./RingButton";
import { VortexSearch } from "./VortexSearch";

const ROLES = [
  ["Websites", "Site-uri web"],
  ["AI automation", "Automatizare AI"],
  ["Digital products", "Produse digitale"],
  ["Consultancy", "Consultanță"],
] as const;

const ROLE_INTERVAL_MS = 2000;

/** Spread on every element the head script keeps hidden until the entrance runs. */
const reveal = { [HERO_REVEAL_ATTR]: "" };

/**
 * Search-first hero (Vortex Scan mockup): deep-space vortex backdrop, name,
 * rotating role line, pitch, the company/website search and the two primary
 * CTAs. The entrance waits for the intro loader.
 */
export function HeroSection() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const introDone = useIntroDone();
  const sectionRef = useRef<HTMLElement>(null);
  const [roleIndex, setRoleIndex] = useState(0);

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
        .fromTo(".name-reveal", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.2 }, 0.1)
        .fromTo(
          ".blur-in",
          { opacity: 0, filter: "blur(10px)", y: 20 },
          {
            opacity: 1,
            filter: "blur(0px)",
            y: 0,
            duration: 1,
            stagger: 0.1,
            clearProps: "filter",
          },
          0.3,
        );
    },
    sectionRef,
    [introDone],
  );

  // Rotate the role word while the hero is on screen; reduced motion and the
  // page-wide pause keep the current one.
  const { paused } = useMotionPause();
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !introDone || paused || prefersReducedMotion()) return;
    let timer: number | undefined;
    const start = () => {
      if (timer !== undefined) return;
      timer = window.setInterval(
        () => setRoleIndex((i) => (i + 1) % ROLES.length),
        ROLE_INTERVAL_MS,
      );
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = undefined;
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start();
      else stop();
    });
    observer.observe(section);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [introDone, paused]);

  const [roleEn, roleRo] = ROLES[roleIndex];

  // Until the Vortex Scan engine ships, a search becomes a scan request.
  const handleSearch = (query: string) => {
    navigate({ to: "/contact", search: { scan: query } });
  };

  return (
    <section
      ref={sectionRef}
      id="top"
      aria-labelledby="hero-title"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-background"
    >
      <HeroCosmos />

      {/* pt clears the fixed ~84px nav. */}
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-6 pb-24 pt-32 text-center">
        <p
          {...reveal}
          className="blur-in mb-8 flex items-center gap-4 text-[0.7rem] uppercase tracking-[0.3em] text-foreground/70 sm:text-xs sm:tracking-[0.35em]"
        >
          <span aria-hidden className="hidden h-px w-10 bg-white/25 sm:block" />
          <span>{t("Digital studio", "Studio digital")}</span>
          <span aria-hidden>·</span>
          <span>{t("Est. 2026", "Fondat în 2026")}</span>
          <span aria-hidden className="hidden h-px w-10 bg-white/25 sm:block" />
        </p>

        <h1
          {...reveal}
          id="hero-title"
          className="name-reveal mb-5 font-display text-6xl font-bold leading-[0.95] tracking-tight text-foreground drop-shadow-[0_0_40px_rgb(104_117_239/0.25)] md:text-8xl lg:text-[6.25rem]"
        >
          Vortex <span className="text-gradient-hero">Hub</span>
        </h1>

        <p {...reveal} className="blur-in mb-5 text-lg text-foreground/90 md:text-2xl">
          {/* Fixed two lines on phones, so a longer role never reflows the copy below. */}
          <span aria-hidden>
            <span
              key={roleIndex}
              className="text-gradient-hero inline-block font-display font-semibold animate-role-fade-in"
            >
              {t(roleEn, roleRo)}
            </span>
            <br className="sm:hidden" /> {t("for people with vision.", "pentru oameni cu viziune.")}
          </span>
          <span className="sr-only">
            {t(
              "Websites, AI automation, digital products and consultancy for people with vision.",
              "Site-uri web, automatizare AI, produse digitale și consultanță pentru oameni cu viziune.",
            )}
          </span>
        </p>

        <p
          {...reveal}
          className="blur-in mb-12 max-w-lg text-sm leading-relaxed text-foreground/70 md:text-base"
        >
          {t(
            "Vortex Hub combines strategy, premium web design and practical AI automation into digital solutions that create measurable momentum.",
            "Vortex Hub combină strategia, designul web premium și automatizarea AI practică în soluții digitale care creează progres măsurabil.",
          )}
        </p>

        <div {...reveal} className="blur-in mb-14 w-full max-w-[40rem]">
          <VortexSearch onSubmit={handleSearch} />
        </div>

        <div {...reveal} className="blur-in flex flex-wrap items-center justify-center gap-4">
          <RingButton to="/contact" variant="solid" arrow="up-right">
            {t("Start a project", "Începe un proiect")}
          </RingButton>
          <RingButton
            to="/consultancy"
            variant="outline"
            innerClassName="border border-white/15 bg-black text-foreground"
          >
            {t("Book a consultation", "Programează o consultanță")}
          </RingButton>
        </div>
      </div>

      <MotionPauseToggle className="absolute bottom-6 right-6 z-10 md:right-10" />
    </section>
  );
}

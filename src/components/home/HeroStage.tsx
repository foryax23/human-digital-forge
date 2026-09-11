import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Rocket, ChevronDown, Route, Gauge, Globe, Target } from "lucide-react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";

import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/cinematic/Magnetic";
import { VortexStage } from "@/components/home/VortexStage";
import { useI18n } from "@/i18n";
import swirlAsset from "@/assets/brand/vortex-swirl.png.asset.json";

/**
 * Full-bleed cinematic hero: one motion stage filling the viewport with the
 * statement centred over it. The scene settles and dims on scroll.
 */
export function HeroStage() {
  const reduce = useReducedMotion();
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.4 });

  const sceneOpacity = useTransform(smooth, [0, 1], [1, 0.15]);
  const sceneScale = useTransform(smooth, [0, 1], [1, 1.18]);
  const copyY = useTransform(smooth, [0, 1], [0, -90]);
  const copyOpacity = useTransform(smooth, [0, 0.75], [1, 0]);

  const lines = [
    { text: t("Digital work,", "Muncă digitală,"), accent: false },
    { text: t("built around", "construită în jurul"), accent: false },
    { text: t("real people.", "oamenilor reali."), accent: true },
  ];

  const rise = {
    hidden: { opacity: 0, y: 48, filter: "blur(10px)" },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 1.1,
        delay: 0.15 + i * 0.13,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    }),
  };

  return (
    <section
      ref={ref}
      className="relative isolate flex min-h-[92svh] items-center justify-center overflow-hidden"
    >
      {/* Layer 1 — the motion stage */}
      <motion.div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={reduce ? undefined : { opacity: sceneOpacity, scale: sceneScale }}
      >
        <VortexStage />
      </motion.div>

      {/* Layer 2 — atmospheric wash */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-40" />

      {/* Layer 3 — foreground vignette so the type always reads */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(58%_50%_at_50%_50%,oklch(0.085_0.026_286/0.86)_0%,oklch(0.085_0.026_286/0.5)_58%,oklch(0.085_0.026_286/0.96)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-background"
      />

      <motion.div
        className="relative mx-auto w-full max-w-6xl px-4 py-28 text-center sm:px-6 lg:px-8"
        style={reduce ? undefined : { y: copyY, opacity: copyOpacity }}
      >
        <motion.div
          initial={reduce ? false : "hidden"}
          animate="show"
          variants={{ hidden: {}, show: {} }}
          className="inline-flex items-center gap-3 rounded-full border border-border glass-panel py-1.5 pl-1.5 pr-5"
          custom={0}
        >
          <motion.span variants={rise} custom={0} className="relative grid h-9 w-9 place-items-center">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-gradient-brand opacity-40 blur-md animate-glow-pulse"
            />
            <img src={swirlAsset.url} alt="" aria-hidden className="relative h-8 w-8 animate-spin-slow" />
          </motion.span>
          <motion.span
            variants={rise}
            custom={0}
            className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground"
          >
            {t("Strategy · Design · Automation", "Strategie · Design · Automatizare")}
          </motion.span>
        </motion.div>

        <h1 className="mx-auto mt-9 max-w-5xl text-hero font-bold">
          {lines.map((line, i) => (
            <motion.span
              key={line.text}
              variants={rise}
              custom={i + 1}
              initial={reduce ? false : "hidden"}
              animate="show"
              className="block"
            >
              {line.accent ? <span className="text-gradient-brand">{line.text}</span> : line.text}
            </motion.span>
          ))}
        </h1>

        <motion.p
          variants={rise}
          custom={4}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="mx-auto mt-9 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground"
        >
          {t(
            "Professional digital products, practical websites and thoughtful AI automation — for individuals and businesses.",
            "Produse digitale profesionale, site-uri practice și automatizări AI atent gândite — pentru persoane și companii.",
          )}
        </motion.p>

        <motion.div
          variants={rise}
          custom={5}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="mt-11 flex flex-wrap items-center justify-center gap-3"
        >
          <Magnetic>
            <Button
              asChild
              size="lg"
              className="bg-gradient-brand text-primary-foreground glow-soft hover:opacity-90"
            >
              <Link to="/contact">
                <Rocket />
                {t("Start a project", "Începe un proiect")}
                <ArrowRight />
              </Link>
            </Button>
          </Magnetic>
          <Magnetic>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-border glass-panel hover:bg-accent"
            >
              <Link to="/consultancy">
                <CalendarCheck />
                {t("Book a consultation", "Programează o consultanță")}
              </Link>
            </Button>
          </Magnetic>
        </motion.div>

        <motion.div
          variants={rise}
          custom={6}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3"
        >
          <StatCard
            value={t("5 stages", "5 etape")}
            label={t("Audit to running operation", "De la audit la operare")}
            icon={<Route className="h-5 w-5" />}
          />
          <StatCard
            value={t("2 min", "2 min")}
            label={t("Free infrastructure audit", "Audit gratuit de infrastructură")}
            icon={<Gauge className="h-5 w-5" />}
          />
          <StatCard
            value={t("EN / RO", "EN / RO")}
            label={t("Romanian and international work", "Proiecte din România și internaționale")}
            icon={<Globe className="h-5 w-5" />}
          />
        </motion.div>
      </motion.div>

      <div
        aria-hidden
        className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 text-muted-foreground animate-scroll-cue"
      >
        <ChevronDown className="h-5 w-5" />
      </div>
    </section>
  );
}

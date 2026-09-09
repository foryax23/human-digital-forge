import { Link } from "@tanstack/react-router";
import { ArrowRight, Rocket, CalendarCheck, ShieldCheck, Sparkles, Clock } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/cinematic/Magnetic";
import { HeroBackground } from "@/components/cinematic/HeroBackground";
import { VortexStage } from "@/components/home/VortexStage";
import { useI18n } from "@/i18n";
import heroBg from "@/assets/home/hero-bg.jpg";
import swirlAsset from "@/assets/brand/vortex-swirl.png.asset.json";

/** Brand swirl mark used in the partner badge. */
function PlanetGlyph() {
  return (
    <span className="relative grid h-10 w-10 place-items-center">
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-gradient-brand opacity-40 blur-md animate-glow-pulse"
      />
      <img
        src={swirlAsset.url}
        alt=""
        aria-hidden
        className="relative h-9 w-9 animate-spin-slow"
      />
    </span>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const { t } = useI18n();

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.11, delayChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 26 },
    show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] as const } },
  };

  const trust = [
    { icon: Sparkles, label: t("Design-led delivery", "Livrare orientată pe design") },
    { icon: ShieldCheck, label: t("Private client area", "Zonă privată de client") },
    { icon: Clock, label: t("Clear timelines", "Termene clare") },
  ];

  return (
    <section className="relative isolate overflow-hidden">
      <img
        src={heroBg}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-30"
      />
      <HeroBackground />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_35%,oklch(0.085_0.026_286/0.85)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-background"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-24 pt-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-8 lg:pb-36 lg:pt-32">
        <motion.div variants={container} initial="hidden" animate="show" className="relative z-10">
          <motion.div
            variants={item}
            className="inline-flex items-center gap-3 rounded-full border border-border glass-panel py-1.5 pl-1.5 pr-5"
          >
            <PlanetGlyph />
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {t("Strategy · Design · Automation", "Strategie · Design · Automatizare")}
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-8 max-w-[15ch] text-[clamp(2.5rem,5.6vw,4.75rem)] font-bold leading-[0.98] tracking-[-0.04em]"
          >
            {t("Digital work, built around", "Muncă digitală, construită în jurul")}{" "}
            <span className="text-gradient-brand">{t("real people.", "oamenilor reali.")}</span>
          </motion.h1>


          <motion.p
            variants={item}
            className="mt-7 max-w-lg text-lg leading-relaxed text-muted-foreground"
          >
            {t(
              "Professional digital products, practical websites and thoughtful AI automation — for individuals and businesses.",
              "Produse digitale profesionale, site-uri practice și automatizări AI atent gândite — pentru persoane și companii.",
            )}
          </motion.p>

          <motion.div variants={item} className="mt-10 flex flex-wrap gap-3">
            <Magnetic>
              <Button asChild size="lg" className="bg-gradient-brand text-primary-foreground glow-soft hover:opacity-90">
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

          <motion.ul
            variants={item}
            className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border pt-7"
          >
            {trust.map((point) => (
              <li
                key={point.label}
                className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                <point.icon className="h-4 w-4 shrink-0 text-teal" />
                {point.label}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          className="relative lg:-mr-16 xl:-mr-24"
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <VortexStage />
        </motion.div>
      </div>
    </section>
  );
}

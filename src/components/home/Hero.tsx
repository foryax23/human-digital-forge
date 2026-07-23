import { Link } from "@tanstack/react-router";
import { ArrowRight, Rocket, CalendarCheck, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/cinematic/Magnetic";
import { HeroBackground } from "@/components/cinematic/HeroBackground";
import { AsciiEffect } from "@/components/ui/ascii-effect";
import heroAsciiAsset from "@/assets/home/hero-ascii-source.jpg.asset.json";
import { useI18n } from "@/i18n";
import heroBg from "@/assets/home/hero-bg.jpg";

import { brandAssets } from "@/components/layout/nav-data";

/** Vortex swirl mark used in the partner badge. */
function PlanetGlyph() {
  return (
    <span className="relative grid h-12 w-12 place-items-center">
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-gradient-brand opacity-45 blur-md animate-glow-pulse"
      />
      <img
        src={brandAssets.mark}
        alt=""
        aria-hidden
        width={44}
        height={44}
        className="relative h-11 w-11 object-contain"
      />
    </span>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const { t } = useI18n();

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
  };
  const item = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
  };

  return (
    <section className="relative isolate overflow-hidden">
      <img
        src={heroBg}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
      />
      <HeroBackground />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-32">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div
            variants={item}
            className="inline-flex items-center gap-3 rounded-full border border-border glass-panel py-2 pl-2 pr-5"
          >
            <PlanetGlyph />
            <span className="flex flex-col leading-tight">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
                {t("Your digital partner", "Partenerul tău digital")}
              </span>
              <span className="text-sm font-semibold">
                {t("Strategy • Design • Automation", "Strategie • Design • Automatizare")}
              </span>
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-6 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            {t("Digital work, built around", "Muncă digitală, construită în jurul")}{" "}
            <span className="text-gradient-brand">{t("real people.", "oamenilor reali.")}</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            {t(
              "Vortex Hub creates professional digital products, practical websites and thoughtful AI automations for individuals and businesses.",
              "Vortex Hub creează produse digitale profesionale, site-uri web practice și automatizări AI atent gândite pentru persoane și companii.",
            )}
          </motion.p>

          <motion.div variants={item} className="mt-9 flex flex-wrap gap-4">
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

          <motion.p variants={item} className="mt-7 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 shrink-0" />
            {t(
              "Clear communication. Secure delivery. Human support from idea to completion.",
              "Comunicare clară. Livrare sigură. Sprijin uman de la idee până la finalizare.",
            )}
          </motion.p>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.94 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border glass-panel glow-soft"
        >
          <AsciiEffect
            variant="flow"
            imageSrc={heroAsciiAsset.url}
            alt={t(
              "Animated ASCII rendering of the Vortex Hub automation core",
              "Redare ASCII animată a nucleului de automatizare Vortex Hub",
            )}
            fontSize={10}
            scale={1.1}
            colors={["#2B0E4A", "#6A1B9A", "#9D4EDD", "#C77DFF", "#F5E9FF"]}
            backgroundColor="#0F0620"
            flowSpeed={0.18}
            flowStrength={10}
            flowFrequency={0.02}
            mouseRadius={180}
            mouseStrength={26}
            brightnessBoost={2.4}
            contrast={1.2}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/5" />
        </motion.div>
      </div>
    </section>
  );
}

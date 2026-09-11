import { Link } from "@tanstack/react-router";
import { ArrowRight, Rocket, CalendarCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/cinematic/Magnetic";
import VortexProductMockup from "@/components/home/mockup/VortexProductMockup";
import { HeroProofRow } from "@/components/home/HeroProofRow";
import { AuroraBackground } from "@/components/backgrounds/AuroraBackground";
import { SplitText } from "@/components/cinematic/SplitText";
import { GradientText } from "@/components/cinematic/GradientText";
import { useI18n } from "@/i18n";

/**
 * Hero: statement copy on the left, floating product scene on the right, proof
 * points across the bottom.
 */
export function HeroStage() {
  const reduce = useReducedMotion();
  const { t } = useI18n();

  const lines = [
    { text: t("Digital products", "Produse digitale"), accent: false },
    { text: t("built for", "construite pentru"), accent: false },
    { text: t("real people.", "oameni reali."), accent: true },
  ];

  const rise = {
    hidden: { opacity: 0, y: 34, filter: "blur(8px)" },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.95,
        delay: 0.1 + i * 0.11,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    }),
  };

  const anim = reduce
    ? {}
    : { initial: "hidden" as const, animate: "show" as const, variants: rise };

  return (
    <section className="relative isolate overflow-hidden">
      <AuroraBackground className="-z-10 opacity-70" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-10 -z-10 h-[40rem] w-[40rem] rounded-full bg-gradient-brand opacity-[0.13] blur-[170px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-b from-transparent to-background"
      />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-20 px-4 pb-40 pt-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-24 lg:px-8">
        <div>
          <motion.div {...anim} custom={0} className="flex items-center gap-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-teal">
              {t("Strategy", "Strategie")} <span className="text-muted-foreground">·</span>{" "}
              {t("Design", "Design")} <span className="text-muted-foreground">·</span>{" "}
              {t("Automation", "Automatizare")}
            </p>
            <span aria-hidden className="h-px w-12 bg-gradient-brand" />
          </motion.div>

          <h1 className="mt-7 max-w-2xl text-hero-split font-bold">
            {lines.map((line, i) => (
              <motion.span key={line.text} {...anim} custom={i + 1} className="block">
                {line.accent ? <span className="text-gradient-brand">{line.text}</span> : line.text}
              </motion.span>
            ))}
          </h1>

          <motion.p
            {...anim}
            custom={4}
            className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            {t(
              "We build websites, digital products and practical AI automation that simplify work, bring results and fit the people behind every brand.",
              "Creăm site-uri web, produse digitale și automatizări AI practice care simplifică munca, aduc rezultate și se potrivesc cu oamenii din spatele fiecărui brand.",
            )}
          </motion.p>

          <motion.div {...anim} custom={5} className="mt-10 flex flex-wrap items-center gap-3">
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
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 40 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8"
        >
          <VortexProductMockup />
        </motion.div>
      </div>

      <HeroProofRow />
    </section>
  );
}

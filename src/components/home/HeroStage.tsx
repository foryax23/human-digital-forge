import { Link } from "@tanstack/react-router";
import { ArrowRight, Rocket, CalendarCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/cinematic/Magnetic";
import VortexProductMockup from "@/components/home/mockup/VortexProductMockup";
import { HeroProofRow } from "@/components/home/HeroProofRow";
import { AuroraBackground } from "@/components/backgrounds/AuroraBackground";
import { GradientText } from "@/components/cinematic/GradientText";
import { useI18n } from "@/i18n";

/**
 * Hero: statement copy on the left, floating product scene on the right, proof
 * points across the bottom.
 */
export function HeroStage() {
  const reduce = useReducedMotion();
  const { t } = useI18n();

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

  const anim = { initial: "hidden" as const, animate: "show" as const, variants: rise };

  return (
    <section className="relative isolate overflow-hidden border-b border-border/60">
      <AuroraBackground className="-z-10 opacity-45" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-gradient-to-b from-primary/10 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-b from-transparent to-background"
      />

      <div className="mx-auto w-full max-w-7xl px-4 pb-14 pt-16 sm:px-6 sm:pt-20 lg:px-8 lg:pb-16 lg:pt-24">
        <div className="grid items-start gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:gap-10">
        <div className="relative z-10 pt-4 lg:pt-8">
          <motion.div {...anim} custom={0} className="flex items-center gap-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-teal">
              {t("Websites · Digital products · AI", "Site-uri · Produse digitale · AI")}
            </p>
            <span aria-hidden className="h-px w-12 bg-gradient-brand" />
          </motion.div>

          <h1 className="mt-7 max-w-2xl text-hero-split font-bold">
            <motion.span {...anim} custom={1} className="block">{t("Digital systems", "Sisteme digitale")}</motion.span>
            <motion.span {...anim} custom={2} className="block">{t("built to move", "construite să ducă")}</motion.span>
            <motion.span {...anim} custom={3} className="block"><GradientText>{t("your business forward.", "afacerea înainte.")}</GradientText></motion.span>
          </h1>

          <motion.p
            {...anim}
            custom={4}
            className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            {t(
              "Vortex Hub combines strategy, premium web design and practical AI automation into digital solutions that create measurable momentum.",
              "Vortex Hub combină strategia, designul web premium și automatizarea AI practică în soluții digitale care creează progres măsurabil.",
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
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-0 lg:-mr-10"
        >
          <VortexProductMockup />
        </motion.div>
        </div>
      </div>

      <HeroProofRow />
    </section>
  );
}

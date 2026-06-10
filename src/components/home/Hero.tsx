import { Link } from "@tanstack/react-router";
import { CheckCircle2, FileText, CalendarCheck, ArrowRight, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/cinematic/Magnetic";
import { HeroBackground } from "@/components/cinematic/HeroBackground";
import { useI18n } from "@/i18n";
import heroBg from "@/assets/home/hero-bg.jpg";

function FloatingWorkflow() {
  const { t } = useI18n();
  return (
    <div className="relative animate-float-slow">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2rem] bg-gradient-brand opacity-25 blur-3xl animate-glow-pulse"
      />
      <div className="relative rounded-2xl border border-border glass-panel p-5 glow-soft">
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("Project request", "Cerere de proiect")}
            </span>
            <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
              {t("Proposal in preparation", "Propunere în pregătire")}
            </span>
          </div>
          <h3 className="mt-3 font-sans text-base font-semibold">{t("Website for local business", "Site web pentru afacere locală")}</h3>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/5 rounded-full bg-gradient-brand" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/20 text-teal">
              <CalendarCheck className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-medium">{t("Consultation", "Consultanță")}</p>
            <p className="text-xs text-muted-foreground">{t("14 June, 10:30", "14 iunie, 10:30")}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/40 p-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <p className="mt-3 truncate text-sm font-medium">{t("Brand presentation.pdf", "Prezentare brand.pdf")}</p>
            <p className="text-xs text-muted-foreground">{t("Delivered", "Livrat")}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-border bg-background/30 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-teal" />
          <span className="text-xs text-muted-foreground">
            {t("Request → Proposal → Delivery, in one calm workflow", "Cerere → Propunere → Livrare, într-un flux clar")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const reduce = useReducedMotion();

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
          <motion.span
            variants={item}
            className="inline-flex items-center gap-2 rounded-full border border-border glass-panel px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Digital services & AI consultancy
          </motion.span>

          <motion.h1
            variants={item}
            className="mt-6 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            Digital work, built around{" "}
            <span className="text-gradient-brand">real people.</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Vortex Hub creates professional digital products, practical websites and thoughtful AI
            automations for individuals and businesses.
          </motion.p>

          <motion.div variants={item} className="mt-9 flex flex-wrap gap-4">
            <Magnetic>
              <Button asChild size="lg" className="glow-soft">
                <Link to="/contact">
                  Start a project
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
                <Link to="/consultancy">Book a consultation</Link>
              </Button>
            </Magnetic>
          </motion.div>

          <motion.p variants={item} className="mt-7 text-sm text-muted-foreground">
            Clear communication. Secure delivery. Human support from idea to completion.
          </motion.p>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.94 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <FloatingWorkflow />
        </motion.div>
      </div>
    </section>
  );
}

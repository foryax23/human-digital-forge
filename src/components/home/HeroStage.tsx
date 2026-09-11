import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Clock, FileText, Headphones, Users, Zap } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { HeroShowcase } from "@/components/home/HeroShowcase";
import { useI18n } from "@/i18n";

/**
 * Hero built to the approved reference: left-anchored statement with two
 * actions, a layered product showcase on the right, and a row of plain facts
 * closing the section on a hairline rule.
 */
export function HeroStage() {
  const reduce = useReducedMotion();
  const { t } = useI18n();

  const rise = {
    hidden: { opacity: 0, y: 24 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] as const },
    }),
  };

  const facts = [
    {
      icon: <Clock className="h-4 w-4" />,
      title: t("Clear timelines", "Termene clare"),
      sub: t("No surprises", "Fără surprize"),
    },
    {
      icon: <FileText className="h-4 w-4" />,
      title: t("Transparent pricing", "Prețuri transparente"),
      sub: t("Fair proposals", "Oferte corecte"),
    },
    {
      icon: <Headphones className="h-4 w-4" />,
      title: t("Bilingual support", "Suport bilingv"),
      sub: "RO / EN",
    },
    {
      icon: <Users className="h-4 w-4" />,
      title: t("Private client area", "Zonă privată de client"),
      sub: t("Everything in one place", "Totul într-un singur loc"),
    },
    {
      icon: <Zap className="h-4 w-4" />,
      title: t("AI automation included", "Automatizare AI inclusă"),
      sub: t("Practical, not promises", "Soluții practice, nu promisiuni"),
    },
  ];

  return (
    <section className="relative isolate overflow-hidden pb-10 pt-16 sm:pt-20">
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-15%] top-[-10%] -z-10 h-[70vmax] w-[70vmax] rounded-full bg-[radial-gradient(circle,oklch(0.35_0.16_280/45%),transparent_65%)]"
      />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:px-8">
        <div>
          <motion.div
            variants={rise}
            custom={0}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="flex items-center gap-3"
          >
            <span className="text-[0.7rem] uppercase tracking-[0.3em] text-primary">
              {t("Strategy • Design • Automation", "Strategie • Design • Automatizare")}
            </span>
            <span className="h-px w-10 bg-primary/50" />
          </motion.div>

          <motion.h1
            variants={rise}
            custom={1}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-7 max-w-2xl font-sans text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.2rem]"
          >
            {t("Digital products built for ", "Produse digitale construite pentru ")}
            <span className="bg-[linear-gradient(90deg,oklch(0.58_0.22_285),oklch(0.68_0.14_250))] bg-clip-text text-transparent">
              {t("real people.", "oameni reali.")}
            </span>
          </motion.h1>

          <motion.p
            variants={rise}
            custom={2}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {t(
              "We build websites, digital products and practical AI automation that simplify the work, bring results and fit the people behind every brand.",
              "Creăm site-uri web, produse digitale și automatizări AI practice care simplifică munca, aduc rezultate și se potrivesc cu oamenii din spatele fiecărui brand.",
            )}
          </motion.p>

          <motion.div
            variants={rise}
            custom={3}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Button
              asChild
              size="lg"
              className="rounded-md bg-[linear-gradient(90deg,oklch(0.52_0.23_285),oklch(0.6_0.18_262))] px-7 font-sans text-sm font-semibold"
            >
              <Link to="/contact">
                {t("Start a project", "Începe un proiect")}
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-md border-[oklch(1_0_0/16%)] px-7 font-sans text-sm font-semibold hover:border-primary hover:bg-transparent"
            >
              <Link to="/consultancy">
                <CalendarDays />
                {t("Book a consultation", "Programează o consultație")}
              </Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          variants={rise}
          custom={4}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="mb-28 lg:mb-24"
        >
          <HeroShowcase />
        </motion.div>
      </div>

      {/* Fact row */}
      <div className="mx-auto mt-14 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <ul className="grid gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
          {facts.map((fact, i) => (
            <li
              key={fact.title}
              className={`flex items-center gap-3 px-0 lg:px-5 ${i > 0 ? "lg:border-l lg:border-[oklch(1_0_0/10%)]" : ""}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[oklch(1_0_0/16%)] text-primary">
                {fact.icon}
              </span>
              <span>
                <span className="block font-sans text-sm font-semibold">{fact.title}</span>
                <span className="block text-xs text-muted-foreground">{fact.sub}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex items-center gap-6">
          <span className="h-px flex-1 bg-[oklch(1_0_0/10%)]" />
          <span className="text-[0.62rem] uppercase tracking-[0.3em] text-muted-foreground">
            {t(
              "Technology with meaning. For people with vision.",
              "Tehnologie cu sens. Pentru oameni cu viziune.",
            )}
          </span>
          <span className="h-px flex-1 bg-[oklch(1_0_0/10%)]" />
        </div>
      </div>
    </section>
  );
}

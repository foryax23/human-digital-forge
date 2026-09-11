import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Route, Gauge, Globe } from "lucide-react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";

import { Button } from "@/components/ui/button";
import { VortexStage } from "@/components/home/VortexStage";
import { StatCard } from "@/components/site/StatCard";
import { useI18n } from "@/i18n";

/**
 * Studio hero. Left-anchored statement on an exposed grid, the vortex offset
 * and cropped to the right, and the facts kept as a staggered ledger of
 * squared blocks instead of glass cards.
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
  const sceneOpacity = useTransform(smooth, [0, 1], [1, 0.2]);
  const sceneY = useTransform(smooth, [0, 1], [0, 80]);

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
      index: "01 / method",
      value: t("5 stages", "5 etape"),
      label: t("Audit to running operation", "De la audit la operare"),
      icon: <Route className="h-4 w-4" />,
      className: "sm:mt-10 sm:h-44",
    },
    {
      index: "02 / audit",
      value: t("2 min", "2 min"),
      label: t("Free infrastructure audit", "Audit gratuit de infrastructură"),
      icon: <Gauge className="h-4 w-4" />,
      className: "sm:-mt-2 sm:h-52",
    },
  ];

  return (
    <section
      ref={ref}
      className="relative isolate flex min-h-[88svh] items-center overflow-hidden py-24"
    >
      {/* The vortex, offset and cropped to the right instead of centred */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-[22%] top-1/2 -z-10 h-[130%] w-[85%] -translate-y-1/2 opacity-70"
        style={reduce ? undefined : { opacity: sceneOpacity, y: sceneY }}
      >
        <VortexStage />
      </motion.div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-2/3 bg-gradient-to-r from-background via-background/85 to-transparent"
      />

      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-12 gap-10 px-4 sm:px-6 lg:px-8">
        <div className="col-span-12 border-l border-[oklch(1_0_0/12%)] pl-6 lg:col-span-7 lg:pl-8">
          <motion.div
            variants={rise}
            custom={0}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="flex items-center gap-3"
          >
            <span className="h-px w-10 bg-primary" />
            <span className="mono-label">
              {t("strategy / design / automation", "strategie / design / automatizare")}
            </span>
          </motion.div>

          <motion.h1
            variants={rise}
            custom={1}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-8 max-w-3xl text-hero font-bold"
          >
            {t("We build and run the ", "Construim și operăm ")}
            <span className="text-primary">
              {t("infrastructure", "infrastructura")}
            </span>
            {t(" your business runs on.", " pe care merge afacerea ta.")}
          </motion.h1>

          <motion.p
            variants={rise}
            custom={2}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {t(
              "Websites, internal systems, connected data and supervised AI — designed, built and operated for you, so the business stops depending on manual work.",
              "Site-uri, sisteme interne, date conectate și AI supravegheat — proiectate, construite și operate pentru tine, ca afacerea să nu mai depindă de munca manuală.",
            )}
          </motion.p>

          <motion.div
            variants={rise}
            custom={3}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg" className="rounded-none font-display text-xs tracking-[0.16em]">
              <Link to="/contact">
                {t("START A PROJECT", "ÎNCEPE UN PROIECT")}
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-none border-[oklch(1_0_0/16%)] font-display text-xs tracking-[0.16em] hover:border-primary hover:bg-transparent"
            >
              <Link to="/audit">{t("FREE AUDIT", "AUDIT GRATUIT")}</Link>
            </Button>
          </motion.div>
        </div>

        {/* Fact ledger — staggered heights, squared blocks */}
        <motion.div
          variants={rise}
          custom={4}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="col-span-12 grid grid-cols-2 gap-4 self-center lg:col-span-5"
        >
          {facts.map((fact) => (
            <StatCard key={fact.index} {...fact} />
          ))}
          <div className="plan-block col-span-2 flex items-center justify-between gap-6 p-5">
            <div>
              <span className="mono-label">03 / reach</span>
              <div className="mt-2 font-display text-lg font-bold tracking-tight">
                {t("Romanian and international work", "Proiecte din România și internaționale")}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-bold text-primary">EN / RO</div>
              <div className="mt-1 flex items-center justify-end gap-2 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                {t("Bilingual delivery", "Livrare bilingvă")}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

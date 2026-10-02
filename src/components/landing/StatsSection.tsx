import { useRef } from "react";
import { motion } from "motion/react";

import { useI18n } from "@/i18n";
import { gsap, prefersReducedMotion, useGsap } from "./gsap";
import { Eyebrow } from "./SectionHeader";

/**
 * Three verifiable facts about the studio. The server renders the final
 * numbers; in the browser, numbers still below the fold count up from zero
 * the first time they scroll into view.
 */
export function StatsSection() {
  const { t } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);

  const stats = [
    {
      value: 4,
      label: t("Core services", "Servicii principale"),
      caption: t(
        "Websites, digital products, AI automation and consultancy.",
        "Site-uri web, produse digitale, automatizare AI și consultanță.",
      ),
    },
    {
      value: 5,
      label: t("Delivery steps", "Etape de livrare"),
      caption: t(
        "From your request to the final delivery.",
        "De la cererea ta până la livrarea finală.",
      ),
    },
    {
      value: 2,
      label: t("Languages", "Limbi"),
      caption: t("Full support in Romanian and English.", "Suport complet în română și engleză."),
    },
  ];

  useGsap(
    () => {
      const root = sectionRef.current;
      if (!root || prefersReducedMotion()) return;

      const counters: HTMLElement[] = [];
      root.querySelectorAll<HTMLElement>("[data-count-to]").forEach((el) => {
        // A number the visitor can already see (or has scrolled past) keeps its
        // final value, so nothing on screen ever jumps backwards to zero.
        if (el.getBoundingClientRect().top <= window.innerHeight) return;

        const proxy = { v: 0 };
        el.textContent = "0";
        counters.push(el);
        gsap.to(proxy, {
          v: Number(el.dataset.countTo),
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
          onUpdate: () => {
            el.textContent = String(Math.round(proxy.v));
          },
        });
      });

      // Runs after the tweens are reverted: put the real numbers back.
      return () => {
        counters.forEach((el) => {
          el.textContent = el.dataset.countTo ?? "";
        });
      };
    },
    sectionRef,
    [],
  );

  return (
    <section
      id="stats"
      ref={sectionRef}
      aria-labelledby="stats-heading"
      className="bg-background py-16 md:py-24"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10 lg:px-16">
        <h2 id="stats-heading" className="sr-only">
          {t("At a glance", "Pe scurt")}
        </h2>
        <motion.div
          aria-hidden
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-8"
        >
          <Eyebrow>{t("At a glance", "Pe scurt")}</Eyebrow>
        </motion.div>

        <dl className="grid grid-cols-1 gap-10 border-t border-border pt-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.value}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1, delay: i * 0.12, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex flex-col sm:px-6 sm:first:pl-0 sm:last:pr-0 lg:px-10"
            >
              {/* DOM order is label → value → caption (dt before dd); `order` puts the number on top visually. */}
              <dt className="order-2 mt-5 text-sm uppercase tracking-[0.2em] text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="order-1">
                {/* Screen readers get the static value, never the count-up. */}
                <span
                  aria-hidden
                  data-count-to={stat.value}
                  className="inline-block font-display text-6xl font-semibold leading-none tracking-tight tabular-nums text-gradient-brand md:text-7xl lg:text-8xl"
                >
                  {stat.value}
                </span>
                <span className="sr-only">{stat.value}</span>
              </dd>
              <dd className="order-3 mt-3 max-w-xs text-sm leading-relaxed text-foreground/80 md:text-base">
                {stat.caption}
              </dd>
            </motion.div>
          ))}
        </dl>
      </div>
    </section>
  );
}

import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import aiImg from "@/assets/home/thumbs/service-ai-256x160.webp";
import productsImg from "@/assets/home/thumbs/service-products-256x160.webp";
import websitesImg from "@/assets/home/thumbs/service-websites-256x160.webp";
import consultationImg from "@/assets/home/thumbs/consultation-256x160.webp";
import { RingButton } from "./RingButton";
import { Em, SectionHeader } from "./SectionHeader";

type Service = {
  slug: string;
  to: LinkProps["to"];
  image: string;
  title: string;
  description: string;
  tags: string;
};

const EASE = [0.25, 0.1, 0.25, 1] as const;

/**
 * The template's journal list, repurposed for the four services: one pill per
 * service with a round thumbnail, title, one-line description, tag line and index.
 */
export function ServicesSection() {
  const { t } = useI18n();
  const reduce = useReducedMotion();

  const services: Service[] = [
    {
      slug: "websites",
      to: "/websites",
      image: websitesImg,
      title: t("Websites", "Site-uri web"),
      description: t(
        "Landing pages, business and portfolio websites, website redesign and simple client portals built around your goals.",
        "Pagini de destinație, site-uri de afaceri și de portofoliu, redesign de site-uri și portaluri simple pentru clienți, construite în jurul obiectivelor tale.",
      ),
      tags: t("Design · Build · Launch", "Design · Dezvoltare · Lansare"),
    },
    {
      slug: "digital-products",
      to: "/digital-products",
      image: productsImg,
      title: t("Digital products", "Produse digitale"),
      description: t(
        "Posters, documents and presentations designed with purpose.",
        "Postere, documente și prezentări create cu scop.",
      ),
      tags: t("Posters · Presentations · Documents", "Postere · Prezentări · Documente"),
    },
    {
      slug: "ai-automation",
      to: "/ai-automation",
      image: aiImg,
      title: t("AI automation", "Automatizare AI"),
      description: t(
        "Practical automation that removes repetitive work.",
        "Automatizare practică ce elimină munca repetitivă.",
      ),
      tags: t("Enquiries · Workflows · Follow-ups", "Cereri · Fluxuri · Urmăriri"),
    },
    {
      slug: "consultancy",
      to: "/consultancy",
      image: consultationImg,
      title: t("Consultancy", "Consultanță"),
      description: t(
        "Book a one-to-one conversation and leave with a practical next step, whatever stage your idea is at.",
        "Programează o conversație unu-la-unu și pleacă cu un pas practic următor, indiferent de stadiul în care se află ideea ta.",
      ),
      tags: t("Ideas · Strategy · AI", "Idei · Strategie · AI"),
    },
  ];

  const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
  // The hidden state is identical for every visitor so SSR and hydration match;
  // reduced motion only drops the travel (y snaps) and keeps the fade.
  const row: Variants = {
    hidden: { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduce
        ? { duration: 0.4, ease: EASE, y: { duration: 0 } }
        : { duration: 0.8, ease: EASE },
    },
  };

  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="scroll-mt-24 bg-background py-16 md:py-24"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10 lg:px-16">
        <SectionHeader
          headingId="services-heading"
          eyebrow={t("What we do", "Ce facem")}
          title={
            <>
              {t("Four ways to move ", "Patru moduri de a merge ")}
              <Em>{t("forward", "înainte")}</Em>.
            </>
          }
          description={t(
            "Pick the service that fits, or combine them into one system.",
            "Alege serviciul potrivit sau combină-le într-un singur sistem.",
          )}
          action={{ label: t("All services", "Toate serviciile"), to: "/services" }}
        />

        <motion.ul
          className="flex flex-col gap-4"
          variants={list}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          {services.map((service, index) => {
            const titleId = `service-${service.slug}-title`;
            const descriptionId = `service-${service.slug}-description`;
            return (
              <motion.li key={service.slug} variants={row}>
                <Link
                  to={service.to}
                  aria-labelledby={titleId}
                  aria-describedby={descriptionId}
                  className={cn(
                    "group flex items-center gap-4 rounded-2xl border border-border bg-card/30 p-4 transition-colors duration-300 sm:gap-6 sm:p-5",
                    "hover:bg-card focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  <span
                    aria-hidden
                    className="type-label hidden w-6 shrink-0 tabular-nums text-muted-foreground sm:block"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="aspect-[16/10] w-20 shrink-0 overflow-hidden rounded-[10px] sm:w-32">
                    <img
                      src={service.image}
                      alt=""
                      width={128}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 id={titleId} className="type-h3 text-foreground">
                      {service.title}
                    </h3>
                    <p
                      id={descriptionId}
                      className="type-body-sm mt-1 line-clamp-2 text-muted-foreground sm:line-clamp-none"
                    >
                      {service.description}
                    </p>
                  </div>

                  <span
                    aria-hidden
                    className="type-label hidden shrink-0 whitespace-nowrap text-muted-foreground lg:block"
                  >
                    {service.tags}
                  </span>

                  <ArrowRight
                    aria-hidden
                    className="h-5 w-5 shrink-0 text-muted-foreground transition-[translate,color] duration-300 group-hover:text-foreground group-focus-visible:text-foreground motion-safe:group-hover:translate-x-0.5 motion-safe:group-focus-visible:translate-x-0.5"
                  />
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>

        <div className="mt-10 flex justify-center md:hidden">
          <RingButton to="/services" variant="outline" arrow="right">
            {t("All services", "Toate serviciile")}
          </RingButton>
        </div>
      </div>
    </section>
  );
}

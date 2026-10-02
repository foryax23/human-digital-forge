import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import aiImg from "@/assets/home/thumbs/service-ai-160.webp";
import productsImg from "@/assets/home/thumbs/service-products-160.webp";
import websitesImg from "@/assets/home/thumbs/service-websites-160.webp";
import consultationImg from "@/assets/home/thumbs/consultation-160.webp";
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
            "Pick the service that fits — or combine them into one system.",
            "Alege serviciul potrivit — sau combină-le într-un singur sistem.",
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
                    "group flex items-center gap-4 rounded-[40px] border border-border bg-card/30 p-4 transition-colors duration-300 sm:gap-6 sm:rounded-full",
                    "hover:bg-card focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full sm:h-20 sm:w-20">
                    <img
                      src={service.image}
                      alt=""
                      width={80}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full rounded-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-110"
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3
                      id={titleId}
                      className="font-display text-lg font-semibold tracking-tight text-foreground md:text-2xl"
                    >
                      {service.title}
                    </h3>
                    <p
                      id={descriptionId}
                      className="mt-1 line-clamp-2 text-sm text-muted-foreground sm:line-clamp-none"
                    >
                      {service.description}
                    </p>
                  </div>

                  {/* Template "read time" / "date" slots: tag line and index. */}
                  <div
                    aria-hidden
                    className="hidden shrink-0 flex-col items-end gap-1.5 whitespace-nowrap text-xs uppercase tracking-[0.2em] text-muted-foreground lg:flex"
                  >
                    <span>{service.tags}</span>
                    <span className="tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                  </div>

                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-300 group-hover:border-transparent group-hover:bg-foreground group-hover:text-background group-focus-visible:border-transparent group-focus-visible:bg-foreground group-focus-visible:text-background sm:h-12 sm:w-12"
                  >
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 motion-safe:group-hover:-rotate-45 motion-safe:group-focus-visible:-rotate-45 sm:h-5 sm:w-5" />
                  </span>
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

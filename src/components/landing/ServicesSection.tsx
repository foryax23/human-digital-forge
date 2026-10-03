import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { ButtonLink, SectionHeader } from "@/components/system";
import { useI18n } from "@/i18n";
import { TechGroups } from "./TechStack";

type Service = {
  slug: string;
  to: LinkProps["to"];
  title: string;
  description: string;
  /** What the client gets, as one comma line. */
  deliverables: string;
};

/**
 * The four services as a numbered hairline list, one row per service (number, title and
 * description, what you get, a link to its page). Shared by the homepage and /services.
 */
export function ServiceRows({ headingLevel = "h3" }: { headingLevel?: "h2" | "h3" }) {
  const { t } = useI18n();
  const Heading = headingLevel;

  const services: Service[] = [
    {
      slug: "websites",
      to: "/websites",
      title: t("Websites", "Site-uri web"),
      description: t(
        "Business sites, landing pages and portfolios, new or redesigned, plus simple client portals.",
        "Site-uri de prezentare, pagini de destinație și portofolii, noi sau refăcute, plus portaluri simple pentru clienți.",
      ),
      deliverables: t("Design, build, launch", "Design, dezvoltare, lansare"),
    },
    {
      slug: "digital-products",
      to: "/digital-products",
      title: t("Graphic materials", "Materiale grafice"),
      description: t(
        "Visual materials made for a clear purpose, ready to print or send.",
        "Materiale vizuale create cu un scop clar, gata de tipărit sau de trimis.",
      ),
      deliverables: t("Posters, presentations, documents", "Postere, prezentări, documente"),
    },
    {
      slug: "ai-automation",
      to: "/ai-automation",
      title: t("AI automation", "Automatizare AI"),
      description: t(
        "Practical automation that takes over repetitive work: enquiries, bookings, follow-ups.",
        "Automatizări practice care preiau munca repetitivă: cereri, programări, mesaje de revenire.",
      ),
      deliverables: t(
        "Assessment, setup, team training",
        "Analiză, implementare, instruirea echipei",
      ),
    },
    {
      slug: "consultancy",
      to: "/consultancy",
      title: t("Consultancy", "Consultanță"),
      description: t(
        "A one-to-one conversation you leave with a clear next step, whatever stage your idea is at.",
        "O discuție individuală din care pleci cu următorul pas clar, oricât de avansată e ideea.",
      ),
      deliverables: t(
        "Ideas, website strategy, automation",
        "Idei, strategia site-ului, automatizare",
      ),
    },
  ];

  return (
    <ul role="list" className="border-t border-rule">
      {services.map((service, index) => {
        const titleId = `service-${service.slug}-title`;
        const descriptionId = `service-${service.slug}-description`;
        return (
          <li key={service.slug} className="border-b border-line-1">
            <Link
              to={service.to}
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              className="group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line/55 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:gap-x-6 lg:grid-cols-[3rem_minmax(0,1fr)_17.5rem_auto] lg:gap-x-8 xl:grid-cols-[3rem_minmax(0,1fr)_23.75rem_3rem]"
            >
              <span aria-hidden className="type-num text-[0.8125rem] text-fg-3">
                {index + 1}
              </span>
              <div className="min-w-0">
                <Heading
                  id={titleId}
                  className="type-h3 text-fg decoration-fg/40 underline-offset-4 group-hover:underline group-focus-visible:underline"
                >
                  {service.title}
                </Heading>
                <p id={descriptionId} className="type-body mt-1 max-w-[60ch] text-pretty text-fg-2">
                  {service.description}
                </p>
                <p className="mt-2 text-[0.8125rem] leading-[1.35] text-fg-3 lg:hidden">
                  {service.deliverables}
                </p>
              </div>
              <p className="hidden text-[0.8125rem] leading-[1.35] text-fg-3 lg:block">
                {service.deliverables}
              </p>
              <span
                aria-hidden
                className="justify-self-end text-sm text-fg-2 transition-colors group-hover:text-fg"
              >
                <span className="hidden underline decoration-fg/30 underline-offset-4 group-hover:decoration-fg md:inline">
                  {t("Details", "Detalii")}
                </span>
                <ChevronRight className="size-4 translate-y-0.5 text-fg-3 md:hidden" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * What we do (#services): the split header, the service rows, then the technologies
 * block.
 */
export function ServicesSection() {
  const { t } = useI18n();

  return (
    <section id="services" aria-labelledby="services-heading" className="section-y scroll-mt-20">
      <div className="container-vx">
        <SectionHeader
          layout="split"
          headingId="services-heading"
          className="mb-8 gap-3 md:mb-10 lg:gap-12"
          title={t("How we can help", "Cu ce te putem ajuta")}
        >
          <div className="flex h-full flex-col justify-end gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <p className="type-lead max-w-[48ch] text-pretty text-fg-2">
              {t(
                "Pick one service or combine several in the same project.",
                "Alege un serviciu sau combină mai multe în același proiect.",
              )}
            </p>
            <ButtonLink to="/services" variant="secondary" className="self-start lg:self-auto">
              {t("All services", "Toate serviciile")}
            </ButtonLink>
          </div>
        </SectionHeader>

        <ServiceRows />

        {/* Tech stack block (TechStack.tsx): keep as the last child of this container. */}
        <TechGroups className="mt-12 md:mt-14" />
      </div>
    </section>
  );
}

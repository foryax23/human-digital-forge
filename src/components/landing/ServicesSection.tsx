import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { ButtonLink, SectionHeader } from "@/components/system";
import { useI18n } from "@/i18n";
import { CONSULTANCY_HOUR_LEI, fixedProject, leiText, projectPriceText } from "@/lib/pricing";
import { TechGroups } from "./TechStack";

type Service = {
  /** Also the file name of its icon in /public/media/services. */
  slug: "websites" | "digital-products" | "ai-automation" | "consultancy";
  to: LinkProps["to"];
  title: string;
  description: string;
  /** What the client gets, as one comma line. */
  deliverables: string;
  /** The price line, from src/lib/pricing.ts (no time frames until the owner confirms them). */
  price: string;
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * One rendered icon per service (scripts/brand/render-service-icons.mjs; the owner's choice,
 * plan §2.15): 320 px WebP with a PNG fallback, shown at 44 to 80 px. Every render puts the
 * art's top at 12% of the frame, so the icons line up with the titles. Decorative: the row's
 * link is already named by the title. It never moves; the title underline is the hover state.
 */
function ServiceIcon({ slug }: { slug: Service["slug"] }) {
  return (
    // Phones: the frame's empty lower edge (under the art) tucks into the gap below.
    <picture className="-mb-1.5 md:mb-0 md:self-start">
      <source srcSet={`/media/services/${slug}.webp`} type="image/webp" />
      <img
        src={`/media/services/${slug}.png`}
        width={320}
        height={320}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="block size-11 select-none md:size-16 lg:size-[4.5rem] xl:size-20"
      />
    </picture>
  );
}

/**
 * The four services as a hairline list, one row per service (icon, title and description,
 * what you get, a link to its page). Shared by the homepage and /services. Below 768 px the
 * icon sits beside the title and the description runs the full width under both.
 */
export function ServiceRows({ headingLevel = "h3" }: { headingLevel?: "h2" | "h3" }) {
  const { t, lang } = useI18n();
  const Heading = headingLevel;
  const automationPrice = projectPriceText(fixedProject("automation"))[lang];
  const hourPrice = leiText(CONSULTANCY_HOUR_LEI)[lang];

  const services: Service[] = [
    {
      slug: "websites",
      to: "/websites",
      title: t("Websites", "Site-uri web"),
      description: t(
        "Business sites, landing pages and portfolios, new or redesigned.",
        "Site-uri de prezentare, pagini de destinație și portofolii, noi sau refăcute.",
      ),
      deliverables: t("Design, build, launch", "Design, dezvoltare, lansare"),
      price: capitalize(projectPriceText(fixedProject("site"))[lang]),
    },
    {
      slug: "digital-products",
      to: "/digital-products",
      title: t("Digital products", "Produse digitale"),
      description: t(
        "Custom web apps: client portals, internal tools, dashboards or the first version of a new product.",
        "Aplicații web la comandă: portaluri pentru clienți, instrumente interne, tablouri de bord sau prima versiune a unui produs nou.",
      ),
      deliverables: t("Plan, prototype, launched app", "Plan, prototip, aplicație lansată"),
      price: t("Fixed price after the first call", "Preț fix după prima discuție"),
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
      price: t(`An automation: ${automationPrice}`, `O automatizare: ${automationPrice}`),
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
      price: t(
        `First call free, then ${hourPrice} an hour`,
        `Prima discuție gratuită, apoi ${hourPrice} pe oră`,
      ),
    },
  ];

  return (
    <ul role="list" className="border-t border-rule">
      {services.map((service) => {
        const titleId = `service-${service.slug}-title`;
        const descriptionId = `service-${service.slug}-description`;
        return (
          <li key={service.slug} className="border-b border-line-1">
            {/* Phones: icon | title | chevron, then the text across the full width (the text
                block's wrapper dissolves into the grid). From 768 px: icon | text | (what you
                get, from 1024 px) | Detalii, on the title's baseline. */}
            <Link
              to={service.to}
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              className="group grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-4 py-4 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-line md:grid-cols-[4rem_minmax(0,1fr)_auto] md:items-baseline md:gap-x-6 md:py-5 lg:grid-cols-[4.5rem_minmax(0,1fr)_17.5rem_auto] lg:gap-x-8 xl:grid-cols-[5rem_minmax(0,1fr)_23.75rem_3rem]"
            >
              <ServiceIcon slug={service.slug} />
              <div className="contents md:block md:min-w-0">
                <Heading
                  id={titleId}
                  className="type-h3 col-start-2 row-start-1 text-fg decoration-fg/40 underline-offset-4 group-hover:underline group-focus-visible:underline md:col-start-auto md:row-start-auto"
                >
                  {service.title}
                </Heading>
                <p
                  id={descriptionId}
                  className="type-body col-span-full mt-1.5 max-w-[60ch] text-pretty text-fg-2 md:mt-1"
                >
                  {service.description}
                </p>
                <p className="type-body-sm col-span-full mt-2 text-fg lg:hidden">
                  {service.price}
                  <span className="type-label block font-normal text-fg-3">
                    {service.deliverables}
                  </span>
                </p>
              </div>
              <p className="type-body-sm hidden text-fg lg:block">
                {service.price}
                <span className="type-label mt-0.5 block font-normal text-fg-3">
                  {service.deliverables}
                </span>
              </p>
              <span
                aria-hidden
                className="col-start-3 row-start-1 justify-self-end text-sm text-fg-2 transition-colors group-hover:text-fg md:col-start-auto md:row-start-auto"
              >
                <span className="hidden underline decoration-fg/30 underline-offset-4 group-hover:decoration-fg md:inline">
                  {t("Details", "Detalii")}
                </span>
                <ChevronRight className="block size-4 text-fg-3 md:hidden" />
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

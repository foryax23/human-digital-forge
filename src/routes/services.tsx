import { createFileRoute, Link } from "@tanstack/react-router";
import { Palette, Globe, Workflow, ArrowRight } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { useI18n } from "@/i18n";

const title = "Services | Vortex Hub";
const description =
  "Digital products, websites and AI automation services for individuals and businesses.";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/services" }],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { t } = useI18n();

  const areas = [
    {
      icon: Palette,
      title: t("Digital Products", "Produse digitale"),
      description: t(
        "Posters, social graphics, presentation design, branded documents, digital templates and professional document formatting.",
        "Postere, grafice pentru social media, design de prezentări, documente de marcă, șabloane digitale și formatare profesională de documente."
      ),
      to: "/digital-products",
      linkLabel: t("Explore digital products", "Explorează produsele digitale"),
    },
    {
      icon: Globe,
      title: t("Websites and Digital Solutions", "Site-uri web și soluții digitale"),
      description: t(
        "Landing pages, business and portfolio websites, website redesign and simple client portals built around your goals.",
        "Pagini de destinație, site-uri de afaceri și de portofoliu, redesign de site-uri și portaluri simple pentru clienți, construite în jurul obiectivelor tale."
      ),
      to: "/websites",
      linkLabel: t("Explore websites", "Explorează site-urile web"),
    },
    {
      icon: Workflow,
      title: t("AI Automation and Consultancy", "Automatizare AI și Consultanță"),
      description: t(
        "Workflow automation, AI-assisted enquiry handling, document organisation and one-to-one practical AI guidance.",
        "Automatizarea fluxurilor de lucru, gestionarea cererilor cu ajutorul AI, organizarea documentelor și îndrumare practică AI unu-la-unu."
      ),
      to: "/ai-automation",
      linkLabel: t("Explore AI services", "Explorează serviciile AI"),
    },
  ];

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Our services", "Serviciile noastre")}
        title={t(
          "Clear digital services, from a single design to a complete workflow.",
          "Servicii digitale clare, de la un singur design până la un flux de lucru complet."
        )}
        description={t(
          "Vortex Hub focuses on three core areas. Each one starts with understanding what you actually need, then moves to careful, well-communicated delivery.",
          "Vortex Hub se concentrează pe trei domenii principale. Fiecare începe prin înțelegerea a ceea ce ai cu adevărat nevoie, apoi trece la o livrare atentă și bine comunicată."
        )}
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8">
          {areas.map((area) => (
            <div
              key={area.title}
              className="grid gap-6 rounded-2xl border border-border bg-card p-8 md:grid-cols-[auto_1fr_auto] md:items-center"
            >
              <span className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary">
                <area.icon className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl">{area.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {area.description}
                </p>
              </div>
              <Link
                to={area.to}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
              >
                {area.linkLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>
      <CtaBand
        title={t("Not sure which service fits?", "Nu ești sigur ce serviciu ți se potrivește?")}
        description={t(
          "Start a project or book a consultation and we will help you shape it clearly.",
          "Începe un proiect sau programează o consultanță și te vom ajuta să-l conturezi clar."
        )}
        primaryLabel={t("Start a project", "Începe un proiect")}
        primaryTo="/contact"
        secondaryLabel={t("Book a consultation", "Programează o consultanță")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

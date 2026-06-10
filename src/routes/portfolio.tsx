import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { useI18n } from "@/i18n";

const title = "Portfolio | Vortex Hub";
const description =
  "Selected example projects across websites, digital products, document design and AI automation.";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/portfolio" }],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { t } = useI18n();

  const projects = [
    {
      type: t("Website", "Site web"),
      title: t("Boutique business landing page", "Pagină de destinație pentru afaceri boutique"),
      outcome: t(
        "A clear, single-page site that explains the offer and guides enquiries.",
        "Un site clar, de o singură pagină, care explică oferta și ghidează cererile."
      ),
      accent: "from-primary/25 to-teal/20",
    },
    {
      type: t("Digital Products", "Produse digitale"),
      title: t("Event poster and digital campaign set", "Poster pentru eveniment și set de campanie digitală"),
      outcome: t(
        "A coordinated visual set ready for print and social channels.",
        "Un set vizual coordonat, gata pentru tipărire și canale social media."
      ),
      accent: "from-teal/25 to-primary/15",
    },
    {
      type: t("Document Design", "Design de documente"),
      title: t("Professional report redesign", "Redesign de raport profesional"),
      outcome: t(
        "A dense report restructured into a clear, readable document.",
        "Un raport dens restructurat într-un document clar și ușor de citit."
      ),
      accent: "from-primary/20 to-primary/5",
    },
    {
      type: t("AI Automation", "Automatizare AI"),
      title: t("Small business enquiry automation workflow", "Flux de automatizare a cererilor pentru afaceri mici"),
      outcome: t(
        "Incoming enquiries organised and summarised automatically.",
        "Cererile primite organizate și rezumate automat."
      ),
      accent: "from-teal/20 to-teal/5",
    },
  ];

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Portfolio", "Portofoliu")}
        title={t("Selected work and digital possibilities.", "Lucrări selectate și posibilități digitale.")}
        description={t(
          "These are illustrative example projects. Real client work will be added here with permission.",
          "Acestea sunt proiecte ilustrative. Lucrările reale ale clienților vor fi adăugate aici cu permisiunea lor."
        )}
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2">
          {projects.map((project) => (
            <article
              key={project.title}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div
                className={`relative flex h-48 items-center justify-center bg-gradient-to-br ${project.accent}`}
              >
                <span className="absolute left-4 top-4 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
                  {t("Example Project", "Proiect exemplu")}
                </span>
              </div>
              <div className="p-6">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {project.type}
                </span>
                <h2 className="mt-2 text-xl">{project.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {project.outcome}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <CtaBand
        title={t("Have a project we could feature next?", "Ai un proiect pe care l-am putea prezenta?")}
        primaryLabel={t("Start a project", "Începe un proiect")}
        primaryTo="/contact"
        secondaryLabel={t("Book a consultation", "Programează o consultanță")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

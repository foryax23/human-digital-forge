import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { ItemList } from "@/components/shared/ItemList";
import { ButtonLink, SectionHeader } from "@/components/system";
import { useI18n } from "@/i18n";

const title = "Websites and Digital Solutions | Vortex Hub";
const description =
  "Landing pages, business websites, portfolios and client portals built around your purpose.";

export const Route = createFileRoute("/websites")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/websites" }],
  }),
  component: WebsitesPage,
});

function WebsitesPage() {
  const { t } = useI18n();

  const categories = [
    { title: t("Landing pages", "Pagini de destinație") },
    { title: t("Small business websites", "Site-uri pentru afaceri mici") },
    { title: t("Personal portfolio websites", "Site-uri de portofoliu personal") },
    { title: t("Service websites", "Site-uri de servicii") },
    { title: t("Website redesign", "Refacerea unui site existent") },
    { title: t("Client portal concepts", "Portaluri simple pentru clienți") },
  ];

  const process = [
    t("Discovery", "Descoperire"),
    t("Structure and content", "Structură și conținut"),
    t("Visual design", "Design vizual"),
    t("Development", "Dezvoltare"),
    t("Review and launch", "Verificare și lansare"),
  ];

  return (
    <SiteLayout>
      <PageHero
        kicker={t("Websites", "Site-uri web")}
        title={t(
          "Websites designed around your purpose, not just your presence online.",
          "Site-uri făcute pentru scopul tău, nu doar ca să fii prezent online.",
        )}
        description={t(
          "Simple, effective sites for people and businesses that need to explain their offer clearly and turn interest into enquiries.",
          "Site-uri simple și eficiente pentru oameni și firme care trebuie să-și explice clar oferta și să transforme interesul în cereri.",
        )}
      >
        <ButtonLink to="/portfolio" variant="secondary">
          {t("See launched sites", "Vezi site-uri lansate")}
        </ButtonLink>
      </PageHero>

      <section aria-label={t("What we build", "Ce construim")} className="section-y">
        <div className="container-vx">
          <SectionHeader headingId="websites-build" title={t("What we build", "Ce construim")} />
          <ItemList items={categories} />

          <SectionHeader
            className="mt-16 md:mt-20"
            headingId="websites-path"
            title={t("A clear path to launch.", "Un drum clar spre lansare.")}
            lead={t(
              "Scope, timeline and price are agreed before we start.",
              "Stabilim ce facem, în cât timp și cât costă înainte să începem.",
            )}
          />
          <ol className="border-t border-line-1 lg:grid lg:grid-cols-5 lg:gap-6 lg:border-t-0">
            {process.map((step, index) => (
              <li
                key={step}
                className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line-1 py-4 lg:block lg:border-b-0 lg:border-t lg:border-rule lg:pb-0 lg:pt-4"
              >
                <span className="type-pnum text-[0.8125rem] text-fg-3">{index + 1}</span>
                <h3 className="type-h4 text-fg lg:mt-1.5">{step}</h3>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand
        title={t(
          "Planning a new website or a redesign?",
          "Pregătești un site nou sau vrei să-l refaci pe cel vechi?",
        )}
        primaryLabel={t("Plan a website project", "Planifică proiectul")}
        primaryTo="/contact"
        secondaryLabel={t("Book a call", "Programează o discuție")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

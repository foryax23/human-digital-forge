import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProcessSection } from "@/components/landing/ProcessSection";
import { ServiceRows } from "@/components/landing/ServicesSection";
import { TechGroups } from "@/components/landing/TechStack";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { pageMeta, useI18n } from "@/i18n";
import { canonicalLink } from "@/i18n/seo";

export const Route = createFileRoute("/services")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/services"),
    links: [canonicalLink("/services")],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { t } = useI18n();

  return (
    <SiteLayout>
      <PageHero
        kicker={t("Services", "Servicii")}
        title={t(
          "Clear digital services, from a first website to a complete app.",
          "Servicii digitale clare, de la primul site până la o aplicație completă.",
        )}
        description={t(
          "Four areas. Each starts with what you actually need; timeline and price are agreed before we start.",
          "Patru domenii. Fiecare începe cu ce ai nevoie cu adevărat; termenul și prețul le stabilim înainte să începem.",
        )}
      />
      <section aria-label={t("Our services", "Serviciile noastre")} className="section-y">
        <div className="container-vx">
          <ServiceRows headingLevel="h2" />
          <TechGroups className="mt-12 md:mt-14" />
        </div>
      </section>
      <ProcessSection />
      <CtaBand
        title={t("Not sure which service fits?", "Nu știi ce serviciu ți se potrivește?")}
        description={t(
          "Start a project or book a call and we will help you shape it.",
          "Începe un proiect sau programează o discuție și te ajutăm să-l conturezi.",
        )}
        primaryLabel={t("Start a project", "Începe un proiect")}
        primaryTo="/contact"
        secondaryLabel={t("See the consultancy", "Vezi consultanța")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

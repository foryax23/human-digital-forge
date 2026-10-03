import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PricingSection } from "@/components/home/PricingSection";
import { SessionRows } from "@/components/home/ConsultationSection";
import { PageHero } from "@/components/shared/PageHero";
import { SectionHeader } from "@/components/system";
import { useI18n } from "@/i18n";

const title = "Consultancy | Vortex Hub";
const description =
  "Book a one-to-one consultation for digital ideas, website strategy or AI automation assessment.";

export const Route = createFileRoute("/consultancy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/consultancy" }],
  }),
  component: ConsultancyPage,
});

function ConsultancyPage() {
  const { t } = useI18n();

  return (
    <SiteLayout>
      <PageHero
        kicker={t("Consultancy", "Consultanță")}
        title={t(
          "Clear advice before you invest time and money.",
          "Sfaturi clare înainte să investești timp și bani.",
        )}
        description={t(
          "A one-to-one conversation about your idea, website or a possible automation. You leave with a practical next step, whatever stage the idea is at. The first call is free.",
          "O discuție individuală despre idee, site sau o posibilă automatizare. Pleci cu un pas practic următor, oricât de avansată e ideea. Prima discuție e gratuită.",
        )}
      />

      <section aria-labelledby="consultancy-sessions" className="section-y">
        <div className="container-vx">
          <SectionHeader
            layout="split"
            headingId="consultancy-sessions"
            title={t("Three kinds of session", "Trei tipuri de discuție")}
            lead={t(
              "Pick the one closest to your question. Tell us a little about it and we will propose a time.",
              "Alege-o pe cea mai apropiată de întrebarea ta. Spune-ne pe scurt despre ce e vorba și îți propunem o oră.",
            )}
          >
            <SessionRows />
          </SectionHeader>
        </div>
      </section>

      <PricingSection />
    </SiteLayout>
  );
}

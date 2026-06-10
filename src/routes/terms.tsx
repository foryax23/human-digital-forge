import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { useI18n } from "@/i18n";

const title = "Terms and Conditions | Vortex Hub";
const description = "The terms that will govern the use of Vortex Hub services.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { t } = useI18n();

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Legal", "Legal")}
        title={t("Terms and Conditions", "Termeni și condiții")}
        description={t(
          "This is a placeholder page. Full terms will be published before services and accounts go live.",
          "Aceasta este o pagină substituent. Termenii completi vor fi publicați înainte ca serviciile și conturile să fie activate."
        )}
      />
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            {t(
              "These terms will cover proposals, scope, timelines, payments, revisions, delivery and the responsibilities of both Vortex Hub and its clients.",
              "Acești termeni vor acoperi propunerile, scopul, termenele, plățile, revizuirile, livrarea și responsabilitățile atât ale Vortex Hub, cât și ale clienților săi."
            )}
          </p>
          <p>
            {t("Questions can be sent to", "Întrebările pot fi trimise la")}{" "}
            <a className="text-primary underline-offset-4 hover:underline" href="mailto:hello@vortexhub.ro">
              hello@vortexhub.ro
            </a>
            .
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}

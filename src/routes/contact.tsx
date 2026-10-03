import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";
import { useI18n } from "@/i18n";

const title = "Contact | Vortex Hub";
const description =
  "Tell Vortex Hub about your project, digital product, website or AI automation idea.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  // ?scan=<company or website> comes from the homepage search.
  validateSearch: z.object({ scan: z.string().trim().max(200).optional() }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  const { scan } = Route.useSearch();

  const facts = [
    {
      label: t("E-mail", "E-mail"),
      value: (
        <a
          href="mailto:hello@vortexhub.ro"
          className="underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
        >
          hello@vortexhub.ro
        </a>
      ),
    },
    {
      label: t("Reply", "Răspuns"),
      value: t("usually within two working days", "de obicei în două zile lucrătoare"),
    },
    { label: t("Languages", "Limbi"), value: t("Romanian or English", "română sau engleză") },
    {
      label: t("First call", "Prima discuție"),
      value: t("free, no commitment", "gratuită, fără obligații"),
    },
  ];

  return (
    <SiteLayout>
      <PageHero
        kicker={t("Contact", "Contact")}
        title={t(
          "Tell us what you need. We will help you shape it.",
          "Spune-ne de ce ai nevoie. Te ajutăm să conturezi proiectul.",
        )}
        description={t(
          "A few details about your idea or problem are enough. We reply with a practical next step.",
          "Câteva detalii despre idee sau problemă sunt de ajuns. Îți răspundem cu un pas practic următor.",
        )}
      />
      <section className="section-y">
        <div className="container-vx">
          {scan && (
            <p className="type-body mb-8 max-w-3xl border-l-2 border-brand-line pl-4 text-fg-2">
              {t(
                `Vortex Scan request: “${scan}”. Leave your details and we will send you the analysis and a plan.`,
                `Cerere Vortex Scan: „${scan}”. Lasă-ne datele tale și îți trimitem analiza și un plan.`,
              )}
            </p>
          )}
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
            <ContactForm
              key={scan ?? ""}
              prefill={
                scan
                  ? t(
                      `Please run a Vortex Scan for: ${scan}`,
                      `Vă rog să rulați un Vortex Scan pentru: ${scan}`,
                    )
                  : undefined
              }
            />
            <aside aria-label={t("How we reply", "Cum răspundem")}>
              <dl className="border-t border-rule">
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-b border-line-1 py-3 text-sm"
                  >
                    <dt className="text-fg-3">{fact.label}</dt>
                    <dd className="text-fg">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

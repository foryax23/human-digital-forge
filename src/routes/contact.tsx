import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";
import { pageMeta, useI18n } from "@/i18n";
import { planLine } from "@/lib/pricing";

export const Route = createFileRoute("/contact")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/contact"),
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  // ?scan=<company or website> comes from the homepage search; ?plan= from "Cere contractul".
  validateSearch: z.object({
    scan: z.string().trim().max(200).optional(),
    plan: z.enum(["starter", "growth", "pro"]).optional().catch(undefined),
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  const { scan, plan: planParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  // A Vortex Scan request wins over a plan in the same link.
  const plan = scan ? undefined : planParam;

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
        title={
          plan
            ? t("Request the contract for your plan.", "Cere contractul pentru abonament.")
            : t(
                "Tell us what you need. We will help you shape it.",
                "Spune-ne de ce ai nevoie. Te ajutăm să conturezi proiectul.",
              )
        }
        description={
          plan
            ? t(
                "Your company's details are enough. We send you the contract to read and answer your questions.",
                "Datele firmei sunt de ajuns. Îți trimitem contractul spre citire și îți răspundem la întrebări.",
              )
            : t(
                "A few details about your idea or problem are enough. We reply with a practical next step.",
                "Câteva detalii despre idee sau problemă sunt de ajuns. Îți răspundem cu un pas practic următor.",
              )
        }
      />
      <section className="section-y">
        <div className="container-vx">
          {plan && (
            <p className="type-body mb-8 max-w-3xl border-l-2 border-brand-line pl-4 text-fg-2">
              {t(
                `Contract request: ${planLine(plan).en}. Leave your company's details and we will send you the contract to read. The plan starts only once it is signed.`,
                `Cerere de contract: ${planLine(plan).ro}. Lasă-ne datele firmei și îți trimitem contractul spre citire. Abonamentul începe doar după semnare.`,
              )}
            </p>
          )}
          {scan && (
            <p className="type-body mb-8 max-w-3xl border-l-2 border-brand-line pl-4 text-fg-2">
              {t(
                `Vortex Scan request: “${scan}”. Leave your details and we will send you the analysis and a plan.`,
                `Cerere Vortex Scan: „${scan}”. Lasă-ne datele tale și îți trimitem analiza și un plan.`,
              )}
            </p>
          )}
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
            {/* Keyed on the request kind only: changing the plan keeps what was typed. */}
            <ContactForm
              key={`${scan ?? ""}|${plan ? "plan" : ""}`}
              plan={plan}
              onPlanChange={(next) =>
                void navigate({
                  search: (prev) => ({ ...prev, plan: next }),
                  replace: true,
                  resetScroll: false,
                })
              }
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

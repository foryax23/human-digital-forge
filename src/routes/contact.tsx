import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SIGNATORY, telLink } from "@/components/deep/contact";
import { SESSION_IDS, sessionPrefill } from "@/components/home/consultation-sessions";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CONTACT_SERVICES, ContactForm } from "@/components/forms/ContactForm";
import { pageMeta, useI18n } from "@/i18n";
import { canonicalLink } from "@/i18n/seo";
import { planLine } from "@/lib/pricing";
import { COMPANY } from "@/lib/scan/legal/company";

/** Contact links inside the facts: a 24 px target inside the 21 px row line. */
const FACT_LINK =
  "-my-0.5 inline-flex min-h-6 items-center rounded-sm underline decoration-fg/30 underline-offset-4 hover:decoration-fg";

export const Route = createFileRoute("/contact")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/contact"),
    links: [canonicalLink("/contact")],
  }),
  // ?scan=<company or website> comes from the homepage search; ?plan= from "Cere contractul";
  // ?service= and ?session= from the consultation rows ("Programează").
  validateSearch: z.object({
    scan: z.string().trim().max(200).optional(),
    plan: z.enum(["starter", "growth", "pro"]).optional().catch(undefined),
    service: z.enum(CONTACT_SERVICES).optional().catch(undefined),
    session: z.enum(SESSION_IDS).optional().catch(undefined),
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t, lang } = useI18n();
  const { scan, plan: planParam, service, session } = Route.useSearch();
  const navigate = Route.useNavigate();
  // A Vortex Scan request wins over a plan in the same link; a plan wins over a session.
  const plan = scan ? undefined : planParam;
  const booked = scan || plan ? undefined : session;
  const tel = telLink();

  const facts = [
    {
      label: t("E-mail", "E-mail"),
      value: (
        <a href={`mailto:${COMPANY.email}`} className={FACT_LINK}>
          {COMPANY.email}
        </a>
      ),
    },
    // Phone and WhatsApp appear once the owner fills them in src/components/deep/contact.ts.
    ...(tel && SIGNATORY.phone
      ? [
          {
            label: t("Phone", "Telefon"),
            value: (
              <a href={tel} className={FACT_LINK}>
                {SIGNATORY.phone}
              </a>
            ),
          },
        ]
      : []),
    ...(SIGNATORY.whatsapp
      ? [
          {
            label: "WhatsApp",
            value: (
              <a
                href={`https://wa.me/${SIGNATORY.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className={FACT_LINK}
              >
                {t("Write to us on WhatsApp", "Scrie-ne pe WhatsApp")}
              </a>
            ),
          },
        ]
      : []),
    {
      label: t("Who replies", "Cine răspunde"),
      value: `${COMPANY.signatory}, ${COMPANY.role[lang]}`,
    },
    {
      label: t("Reply to your request", "Răspuns la cerere"),
      // The one reply promise across the site (plan cards keep their own reply times).
      value: t("within one working day", "într-o zi lucrătoare"),
    },
    { label: t("Languages", "Limbi"), value: t("Romanian or English", "română sau engleză") },
    {
      label: t("First call", "Prima discuție"),
      value: t("free, no commitment", "gratuită, fără obligații"),
    },
    // OWNER DECISION: the registered seat in full (as on the legal pages and at ONRC).
    { label: t("Registered office", "Sediu"), value: COMPANY.seat },
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
            {/* On phones the facts follow the form: the two promises go above it. */}
            <p className="type-body-sm -mb-6 text-fg-2 lg:hidden">
              {t(
                "We reply within one working day. The first call is free.",
                "Răspundem într-o zi lucrătoare. Prima discuție e gratuită.",
              )}
            </p>
            {/* Keyed on the request kind only: changing the plan keeps what was typed. */}
            <ContactForm
              key={`${scan ?? ""}|${plan ? "plan" : ""}|${booked ?? ""}`}
              service={plan ? undefined : (service ?? (booked ? "consultancy" : undefined))}
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
                  : booked
                    ? sessionPrefill(booked, lang)
                    : undefined
              }
            />
            <aside aria-label={t("How we reply", "Cum răspundem")}>
              <dl className="border-t border-rule">
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="type-body-sm grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-b border-line-1 py-3"
                  >
                    <dt className="text-fg-3">{fact.label}</dt>
                    <dd className="min-w-0 text-pretty text-fg">{fact.value}</dd>
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

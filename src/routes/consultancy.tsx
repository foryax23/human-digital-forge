import { createFileRoute, Link } from "@tanstack/react-router";
import { Lightbulb, LayoutTemplate, Workflow, Calendar } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { Button } from "@/components/ui/button";
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

  const sessions = [
    {
      icon: Lightbulb,
      title: t("Digital Idea Consultation", "Consultanță pentru idei digitale"),
      description: t(
        "For individuals planning a digital product, personal website or creative project.",
        "Pentru persoane care planifică un produs digital, un site web personal sau un proiect creativ."
      ),
    },
    {
      icon: LayoutTemplate,
      title: t("Website Strategy Consultation", "Consultanță pentru strategia site-ului web"),
      description: t(
        "For clients requiring help with pages, features, branding and user journeys.",
        "Pentru clienți care au nevoie de ajutor cu paginile, funcționalitățile, brandingul și parcursurile utilizatorilor."
      ),
    },
    {
      icon: Workflow,
      title: t("AI Automation Assessment", "Evaluare Automatizare AI"),
      description: t(
        "For businesses wanting to identify tasks that could be improved through automation.",
        "Pentru afaceri care doresc să identifice sarcini ce ar putea fi îmbunătățite prin automatizare."
      ),
    },
  ];

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Consultancy", "Consultanță")}
        title={t(
          "Clear advice before you invest time and money.",
          "Sfaturi clare înainte să investești timp și bani."
        )}
        description={t(
          "Book a one-to-one conversation and leave with a practical next step, whatever stage your idea is at.",
          "Programează o conversație unu-la-unu și pleacă cu un pas practic următor, indiferent de stadiul în care se află ideea ta."
        )}
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {sessions.map((session) => (
            <div
              key={session.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-7"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <session.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-5 text-xl">{session.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {session.description}
              </p>
              <Button asChild className="mt-6">
                <Link to="/contact">{t("Book this session", "Rezervă această sesiune")}</Link>
              </Button>
            </div>
          ))}
        </div>

        {/* Booking placeholder */}
        <div className="mt-12 rounded-2xl border border-dashed border-border bg-card p-8">
          <div className="flex items-center gap-2 text-base font-medium">
            <Calendar className="h-5 w-5 text-primary" />
            {t("Select a time", "Selectează o oră")}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "This is a booking interface placeholder. Live scheduling will be connected once the design is approved.",
              "Acesta este un substituent pentru interfața de rezervare. Programarea în timp real va fi conectată odată ce designul este aprobat."
            )}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {["09:00", "10:30", "12:00", "13:30", "15:00", "16:30"].map((slot, i) => (
              <button
                key={slot}
                type="button"
                className={`rounded-lg border px-3 py-3 text-sm transition-colors ${
                  i === 1
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

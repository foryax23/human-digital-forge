import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { ItemList } from "@/components/shared/ItemList";
import { ButtonLink, SectionHeader } from "@/components/system";
import { pageMeta, useI18n } from "@/i18n";

export const Route = createFileRoute("/ai-automation")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/ai-automation"),
    links: [{ rel: "canonical", href: "/ai-automation" }],
  }),
  component: AiAutomationPage,
});

function AiAutomationPage() {
  const { t } = useI18n();

  const solutions = [
    {
      title: t(
        "Form submissions organised automatically",
        "Formulare primite și organizate automat",
      ),
    },
    { title: t("Client enquiry summaries", "Rezumate ale cererilor de la clienți") },
    { title: t("Document handling workflows", "Fluxuri pentru gestionarea documentelor") },
    { title: t("Content preparation support", "Ajutor la pregătirea conținutului") },
    { title: t("Appointment and follow-up assistance", "Programări și mesaje de revenire") },
    { title: t("Internal knowledge organisation", "Informațiile interne puse în ordine") },
  ];

  return (
    <SiteLayout>
      <PageHero
        kicker={t("AI automation", "Automatizare AI")}
        title={t(
          "Useful AI solutions for real tasks and real businesses.",
          "Soluții AI utile, pentru sarcini reale și afaceri reale.",
        )}
        description={t(
          "Automation can take over repetitive work, keep things organised and give your team time for the work that matters. We start with what is worth automating.",
          "Automatizarea poate prelua munca repetitivă, poate ține lucrurile în ordine și îi lasă echipei timp pentru ce contează. Pornim de la ce merită automatizat.",
        )}
      >
        <ButtonLink to="/scan" variant="secondary">
          {t("Try Vortex Scan", "Încearcă Vortex Scan")}
        </ButtonLink>
        <span className="type-body-sm text-fg-3">
          {t(
            "See what could be automated in your business.",
            "Vezi ce s-ar putea automatiza în firma ta.",
          )}
        </span>
      </PageHero>

      <section aria-labelledby="ai-list" className="section-y">
        <div className="container-vx">
          <SectionHeader headingId="ai-list" title={t("What we automate", "Ce automatizăm")} />
          <ItemList items={solutions} />

          <figure className="mt-12 max-w-3xl border-l-2 border-rule pl-5 md:mt-16">
            <blockquote className="type-h3 text-pretty text-fg">
              {t(
                "AI solutions should be transparent, appropriate and supported by human judgement.",
                "Soluțiile AI trebuie să fie transparente, potrivite și verificate de oameni.",
              )}
            </blockquote>
            <figcaption className="type-body-sm mt-2 text-fg-3">
              {t("How we work with AI", "Cum lucrăm cu AI")}
            </figcaption>
          </figure>
        </div>
      </section>

      <CtaBand
        title={t("Exploring practical automation?", "Te gândești la o automatizare practică?")}
        primaryLabel={t("Book an automation assessment", "Programează o evaluare")}
        primaryTo="/contact"
        secondaryLabel={t("See the consultancy", "Vezi consultanța")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

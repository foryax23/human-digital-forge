import { createFileRoute } from "@tanstack/react-router";
import {
  FileInput,
  MessagesSquare,
  FolderCog,
  PenLine,
  CalendarClock,
  Library,
  ShieldCheck,
} from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { useI18n } from "@/i18n";

const title = "AI Automation and Consultancy | Vortex Hub";
const description =
  "Practical AI automation for real tasks: enquiries, documents, follow-ups and internal organisation.";

export const Route = createFileRoute("/ai-automation")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/ai-automation" }],
  }),
  component: AiAutomationPage,
});

function AiAutomationPage() {
  const { t } = useI18n();

  const solutions = [
    { icon: FileInput, title: t("Form submissions organised automatically", "Trimiteri de formulare organizate automat") },
    { icon: MessagesSquare, title: t("Client enquiry summaries", "Rezumate ale cererilor clienților") },
    { icon: FolderCog, title: t("Document handling workflows", "Fluxuri de gestionare a documentelor") },
    { icon: PenLine, title: t("Content preparation support", "Suport pentru pregătirea conținutului") },
    { icon: CalendarClock, title: t("Appointment and follow-up assistance", "Asistență pentru programări și urmăriri") },
    { icon: Library, title: t("Internal knowledge organisation", "Organizarea cunoștințelor interne") },
  ];

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("AI automation and consultancy", "Automatizare AI și consultanță")}
        title={t(
          "Useful AI solutions for real tasks and real businesses.",
          "Soluții AI utile pentru sarcini reale și afaceri reale."
        )}
        description={t(
          "AI automation can support repetitive activities, improve organisation and help teams spend more time on valuable work. Vortex Hub provides practical guidance and carefully planned solutions.",
          "Automatizarea AI poate sprijini activitățile repetitive, îmbunătăți organizarea și ajuta echipele să petreacă mai mult timp pe muncă valoroasă. Vortex Hub oferă îndrumare practică și soluții planificate cu atenție."
        )}
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((solution) => (
            <div key={solution.title} className="rounded-sm border border-border bg-card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
                <solution.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg leading-snug">{solution.title}</h2>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-start gap-4 rounded-sm border border-teal/30 bg-teal/5 p-8">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal/15 text-teal">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <p className="text-lg leading-relaxed text-foreground">
            {t(
              '"AI solutions should be transparent, appropriate and supported by human judgement."',
              '"Soluțiile AI trebuie să fie transparente, adecvate și susținute de judecata umană."'
            )}
          </p>
        </div>
      </section>
      <CtaBand
        title={t("Exploring practical automation?", "Explorezi automatizarea practică?")}
        primaryLabel={t("Book an AI workflow review", "Programează o analiză a fluxului AI")}
        primaryTo="/consultancy"
        secondaryLabel={t("Send an enquiry", "Trimite o cerere")}
        secondaryTo="/contact"
      />
    </SiteLayout>
  );
}

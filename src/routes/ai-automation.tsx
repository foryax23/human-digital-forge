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

const solutions = [
  { icon: FileInput, title: "Form submissions organised automatically" },
  { icon: MessagesSquare, title: "Client enquiry summaries" },
  { icon: FolderCog, title: "Document handling workflows" },
  { icon: PenLine, title: "Content preparation support" },
  { icon: CalendarClock, title: "Appointment and follow-up assistance" },
  { icon: Library, title: "Internal knowledge organisation" },
];

function AiAutomationPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="AI automation and consultancy"
        title="Useful AI solutions for real tasks and real businesses."
        description="AI automation can support repetitive activities, improve organisation and help teams spend more time on valuable work. Vortex Hub provides practical guidance and carefully planned solutions."
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((solution) => (
            <div key={solution.title} className="rounded-xl border border-border bg-card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
                <solution.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg leading-snug">{solution.title}</h2>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-start gap-4 rounded-2xl border border-teal/30 bg-teal/5 p-8">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal/15 text-teal">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <p className="text-lg leading-relaxed text-foreground">
            “AI solutions should be transparent, appropriate and supported by human judgement.”
          </p>
        </div>
      </section>
      <CtaBand
        title="Exploring practical automation?"
        primaryLabel="Book an AI workflow review"
        primaryTo="/consultancy"
        secondaryLabel="Send an enquiry"
        secondaryTo="/contact"
      />
    </SiteLayout>
  );
}

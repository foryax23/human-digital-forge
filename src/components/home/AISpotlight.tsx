import { Link } from "@tanstack/react-router";
import { Inbox, FileStack, CalendarClock, Boxes } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/shared/SectionHeading";

const useCases = [
  { icon: Inbox, label: "Enquiry and lead organisation." },
  { icon: FileStack, label: "Document workflow support." },
  { icon: CalendarClock, label: "Appointment and follow-up processes." },
  { icon: Boxes, label: "Internal productivity systems." },
];

export function AISpotlight() {
  return (
    <section className="bg-ink text-ink-foreground">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow className="text-teal">AI automation</Eyebrow>
            <h2 className="mt-4 text-3xl leading-tight sm:text-4xl">
              Technology should remove unnecessary work, not remove the human relationship.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-foreground/70">
              We help individuals and businesses explore useful AI workflows, from organising
              enquiries and documents to improving repetitive internal processes. Every solution
              begins with a real need, not with technology for its own sake.
            </p>
            <Button asChild className="mt-8">
              <Link to="/ai-automation">Discuss an automation idea</Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {useCases.map((useCase) => (
              <div
                key={useCase.label}
                className="rounded-xl border border-ink-foreground/15 bg-ink-foreground/5 p-6"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal/20 text-teal">
                  <useCase.icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-medium text-ink-foreground">{useCase.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

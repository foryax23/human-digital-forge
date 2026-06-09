import { Link } from "@tanstack/react-router";
import { Inbox, FileStack, CalendarClock, Boxes } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/shared/SectionHeading";
import { GlowCard } from "@/components/cinematic/GlowCard";
import { Reveal } from "@/components/cinematic/Reveal";
import { Magnetic } from "@/components/cinematic/Magnetic";

const useCases = [
  { icon: Inbox, label: "Enquiry and lead organisation." },
  { icon: FileStack, label: "Document workflow support." },
  { icon: CalendarClock, label: "Appointment and follow-up processes." },
  { icon: Boxes, label: "Internal productivity systems." },
];

export function AISpotlight() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-ink text-ink-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-aurora opacity-40" />
      <div className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <Eyebrow className="text-teal">AI automation</Eyebrow>
              <h2 className="mt-4 text-3xl leading-tight sm:text-4xl lg:text-5xl">
                Technology should remove unnecessary work, not remove the human relationship.
              </h2>
              <p className="mt-6 text-base leading-relaxed text-ink-foreground/70">
                We help individuals and businesses explore useful AI workflows, from organising
                enquiries and documents to improving repetitive internal processes. Every solution
                begins with a real need, not with technology for its own sake.
              </p>
              <Magnetic>
                <Button asChild className="mt-9 glow-soft">
                  <Link to="/ai-automation">Discuss an automation idea</Link>
                </Button>
              </Magnetic>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {useCases.map((useCase, i) => (
              <Reveal key={useCase.label} delay={i * 0.1}>
                <GlowCard className="h-full">
                  <div className="p-6">
                    <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal/20 text-teal">
                      <useCase.icon className="h-5 w-5" />
                    </span>
                    <p className="mt-4 text-sm font-medium text-ink-foreground">{useCase.label}</p>
                  </div>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

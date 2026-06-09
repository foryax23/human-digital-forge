import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { GlowCard } from "@/components/cinematic/GlowCard";
import { Reveal } from "@/components/cinematic/Reveal";

const individuals = [
  "Professional documents and presentations.",
  "Personal portfolio websites.",
  "Posters and visual projects.",
  "One-to-one AI guidance.",
];

const businesses = [
  "Business websites and landing pages.",
  "Marketing and design materials.",
  "AI workflow planning.",
  "Digital process consultancy.",
];

function AudienceColumn({
  title,
  items,
  buttonLabel,
}: {
  title: string;
  items: string[];
  buttonLabel: string;
}) {
  return (
    <GlowCard className="h-full">
      <div className="p-8">
        <h3 className="text-2xl">{title}</h3>
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal/20 text-teal">
                <Check className="h-3 w-3" />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <Button asChild variant="outline" className="mt-8 border-border glass-panel">
          <Link to="/services">{buttonLabel}</Link>
        </Button>
      </div>
    </GlowCard>
  );
}

export function AudienceSection() {
  return (
    <section className="relative overflow-hidden border-y border-border">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-aurora opacity-30" />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading align="center" title="Built for individuals and growing businesses." />
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <Reveal>
            <AudienceColumn
              title="For Individuals"
              items={individuals}
              buttonLabel="View individual services"
            />
          </Reveal>
          <Reveal delay={0.12}>
            <AudienceColumn
              title="For Businesses"
              items={businesses}
              buttonLabel="View business services"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

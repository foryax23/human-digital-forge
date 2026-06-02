import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";

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
    <div className="rounded-2xl border border-border bg-background p-8">
      <h3 className="text-2xl">{title}</h3>
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal/15 text-teal">
              <Check className="h-3 w-3" />
            </span>
            {item}
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" className="mt-8">
        <Link to="/services">{buttonLabel}</Link>
      </Button>
    </div>
  );
}

export function AudienceSection() {
  return (
    <section className="bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          align="center"
          title="Built for individuals and growing businesses."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <AudienceColumn
            title="For Individuals"
            items={individuals}
            buttonLabel="View individual services"
          />
          <AudienceColumn
            title="For Businesses"
            items={businesses}
            buttonLabel="View business services"
          />
        </div>
      </div>
    </section>
  );
}

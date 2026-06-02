import { FileCheck2, Lock, ShieldCheck, UserCheck } from "lucide-react";

import { SectionHeading } from "@/components/shared/SectionHeading";

const points = [
  { icon: FileCheck2, label: "Clear proposals before work begins." },
  { icon: Lock, label: "Private project communication." },
  { icon: ShieldCheck, label: "Secure file delivery." },
  { icon: UserCheck, label: "Human review throughout the process." },
];

export function TrustSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeading
        align="center"
        title="Designed for a straightforward and secure client experience."
      />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {points.map((point) => (
          <div
            key={point.label}
            className="rounded-xl border border-border bg-card p-6 text-center"
          >
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-teal/15 text-teal">
              <point.icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm font-medium">{point.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm font-medium text-foreground">Client feedback</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          A reserved space for approved client feedback. Real testimonials will appear here once
          client work is shared with permission.
        </p>
      </div>
    </section>
  );
}

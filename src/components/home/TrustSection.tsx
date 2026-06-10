import { FileCheck2, Lock, ShieldCheck, UserCheck } from "lucide-react";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { GlowCard } from "@/components/cinematic/GlowCard";
import { Reveal } from "@/components/cinematic/Reveal";

const points = [
  { icon: FileCheck2, label: "Clear proposals before work begins." },
  { icon: Lock, label: "Private project communication." },
  { icon: ShieldCheck, label: "Secure file delivery." },
  { icon: UserCheck, label: "Human review throughout the process." },
];

export function TrustSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <Reveal>
        <SectionHeading
          align="center"
          eyebrow="Why Vortex Hub"
          title="Designed for a straightforward and secure client experience."
        />
      </Reveal>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {points.map((point, i) => (
          <Reveal key={point.label} delay={i * 0.1}>
            <GlowCard className="h-full">
              <div className="p-7 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-teal/20 text-teal glow-teal">
                  <point.icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-medium">{point.label}</p>
              </div>
            </GlowCard>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className="mt-10 rounded-2xl border border-dashed border-border glass-panel p-8 text-center">
          <p className="text-sm font-medium text-foreground">Client feedback</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            A reserved space for approved client feedback. Real testimonials will appear here once
            client work is shared with permission.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

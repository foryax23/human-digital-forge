import { SectionHeading } from "@/components/shared/SectionHeading";
import { GlowCard } from "@/components/cinematic/GlowCard";
import { Reveal } from "@/components/cinematic/Reveal";

const projects = [
  {
    type: "Website",
    title: "Boutique business landing page",
    outcome: "A clear, single-page site that explains the offer and guides enquiries.",
    accent: "from-primary/35 to-teal/25",
  },
  {
    type: "Digital Products",
    title: "Event poster and digital campaign set",
    outcome: "A coordinated visual set ready for print and social channels.",
    accent: "from-teal/35 to-primary/20",
  },
  {
    type: "Document Design",
    title: "Professional report redesign",
    outcome: "A dense report restructured into a clear, readable document.",
    accent: "from-primary/30 to-primary/5",
  },
  {
    type: "AI Automation",
    title: "Small business enquiry automation workflow",
    outcome: "Incoming enquiries organised and summarised automatically.",
    accent: "from-teal/30 to-teal/5",
  },
];

export function PortfolioPreview() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <Reveal>
        <SectionHeading title="Selected work and digital possibilities." />
      </Reveal>
      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {projects.map((project, i) => (
          <Reveal key={project.title} delay={i * 0.08}>
            <GlowCard className="h-full">
              <article className="h-full">
                <div
                  className={`relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br ${project.accent}`}
                >
                  <div aria-hidden className="absolute inset-0 bg-aurora opacity-40" />
                  <span className="absolute left-4 top-4 rounded-full border border-border glass-panel px-3 py-1 text-xs font-medium text-foreground">
                    Example Project
                  </span>
                </div>
                <div className="p-7">
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {project.type}
                  </span>
                  <h3 className="mt-2 text-xl">{project.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {project.outcome}
                  </p>
                </div>
              </article>
            </GlowCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

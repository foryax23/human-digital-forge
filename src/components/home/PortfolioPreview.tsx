import { SectionHeading } from "@/components/shared/SectionHeading";

const projects = [
  {
    type: "Website",
    title: "Boutique business landing page",
    outcome: "A clear, single-page site that explains the offer and guides enquiries.",
    accent: "from-primary/25 to-teal/20",
  },
  {
    type: "Digital Products",
    title: "Event poster and digital campaign set",
    outcome: "A coordinated visual set ready for print and social channels.",
    accent: "from-teal/25 to-primary/15",
  },
  {
    type: "Document Design",
    title: "Professional report redesign",
    outcome: "A dense report restructured into a clear, readable document.",
    accent: "from-primary/20 to-primary/5",
  },
  {
    type: "AI Automation",
    title: "Small business enquiry automation workflow",
    outcome: "Incoming enquiries organised and summarised automatically.",
    accent: "from-teal/20 to-teal/5",
  },
];

export function PortfolioPreview() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeading title="Selected work and digital possibilities." />
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {projects.map((project) => (
          <article
            key={project.title}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div
              className={`relative flex h-44 items-center justify-center bg-gradient-to-br ${project.accent}`}
            >
              <span className="absolute left-4 top-4 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
                Example Project
              </span>
            </div>
            <div className="p-6">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                {project.type}
              </span>
              <h3 className="mt-2 text-xl">{project.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {project.outcome}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";

const title = "Portfolio | Vortex Hub";
const description =
  "Selected example projects across websites, digital products, document design and AI automation.";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/portfolio" }],
  }),
  component: PortfolioPage,
});

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

function PortfolioPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Portfolio"
        title="Selected work and digital possibilities."
        description="These are illustrative example projects. Real client work will be added here with permission."
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2">
          {projects.map((project) => (
            <article
              key={project.title}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div
                className={`relative flex h-48 items-center justify-center bg-gradient-to-br ${project.accent}`}
              >
                <span className="absolute left-4 top-4 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
                  Example Project
                </span>
              </div>
              <div className="p-6">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {project.type}
                </span>
                <h2 className="mt-2 text-xl">{project.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {project.outcome}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <CtaBand
        title="Have a project we could feature next?"
        primaryLabel="Start a project"
        primaryTo="/contact"
        secondaryLabel="Book a consultation"
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

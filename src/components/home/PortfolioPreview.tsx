import { ArrowUpRight } from "lucide-react";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { GlowCard } from "@/components/cinematic/GlowCard";
import { Reveal } from "@/components/cinematic/Reveal";
import project1 from "@/assets/home/portfolio-1.jpg";
import project2 from "@/assets/home/portfolio-2.jpg";
import project3 from "@/assets/home/portfolio-3.jpg";
import project4 from "@/assets/home/portfolio-4.jpg";

const projects = [
  {
    type: "Website",
    title: "Boutique business landing page",
    outcome: "A clear, single-page site that explains the offer and guides enquiries.",
    image: project1,
  },
  {
    type: "Digital Products",
    title: "Event poster and digital campaign set",
    outcome: "A coordinated visual set ready for print and social channels.",
    image: project2,
  },
  {
    type: "Document Design",
    title: "Professional report redesign",
    outcome: "A dense report restructured into a clear, readable document.",
    image: project3,
  },
  {
    type: "AI Automation",
    title: "Small business enquiry automation workflow",
    outcome: "Incoming enquiries organised and summarised automatically.",
    image: project4,
  },
];

export function PortfolioPreview() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <Reveal>
        <SectionHeading eyebrow="Selected work" title="Selected work and digital possibilities." />
      </Reveal>
      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {projects.map((project, i) => (
          <Reveal key={project.title} delay={i * 0.08}>
            <GlowCard className="h-full">
              <article className="h-full">
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={project.image}
                    alt={project.title}
                    loading="lazy"
                    width={1024}
                    height={768}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-aurora opacity-0 transition-opacity duration-500 group-hover:opacity-40"
                  />
                  <span className="absolute left-4 top-4 rounded-full border border-border glass-panel px-3 py-1 text-xs font-medium text-foreground">
                    {project.type}
                  </span>
                  <span className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-border glass-panel text-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
                <div className="p-7">
                  <h3 className="text-xl">{project.title}</h3>
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { Palette, Globe, Workflow, ArrowRight } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";

const title = "Services | Vortex Hub";
const description =
  "Digital products, websites and AI automation services for individuals and businesses.";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/services" }],
  }),
  component: ServicesPage,
});

const areas = [
  {
    icon: Palette,
    title: "Digital Products",
    description:
      "Posters, social graphics, presentation design, branded documents, digital templates and professional document formatting.",
    to: "/digital-products",
    linkLabel: "Explore digital products",
  },
  {
    icon: Globe,
    title: "Websites and Digital Solutions",
    description:
      "Landing pages, business and portfolio websites, website redesign and simple client portals built around your goals.",
    to: "/websites",
    linkLabel: "Explore websites",
  },
  {
    icon: Workflow,
    title: "AI Automation and Consultancy",
    description:
      "Workflow automation, AI-assisted enquiry handling, document organisation and one-to-one practical AI guidance.",
    to: "/ai-automation",
    linkLabel: "Explore AI services",
  },
];

function ServicesPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Our services"
        title="Clear digital services, from a single design to a complete workflow."
        description="Vortex Hub focuses on three core areas. Each one starts with understanding what you actually need, then moves to careful, well-communicated delivery."
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8">
          {areas.map((area) => (
            <div
              key={area.title}
              className="grid gap-6 rounded-2xl border border-border bg-card p-8 md:grid-cols-[auto_1fr_auto] md:items-center"
            >
              <span className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary">
                <area.icon className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl">{area.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {area.description}
                </p>
              </div>
              <Link
                to={area.to}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
              >
                {area.linkLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>
      <CtaBand
        title="Not sure which service fits?"
        description="Start a project or book a consultation and we will help you shape it clearly."
        primaryLabel="Start a project"
        primaryTo="/contact"
        secondaryLabel="Book a consultation"
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

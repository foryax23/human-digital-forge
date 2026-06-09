import { Link } from "@tanstack/react-router";
import { Palette, Globe, Workflow, ArrowRight } from "lucide-react";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { GlowCard } from "@/components/cinematic/GlowCard";
import { Reveal } from "@/components/cinematic/Reveal";

const services = [
  {
    icon: Palette,
    title: "Digital Products",
    description:
      "Posters, documents, presentations and visual materials designed with purpose and attention to detail.",
    linkLabel: "Explore digital products",
    to: "/digital-products",
  },
  {
    icon: Globe,
    title: "Websites and Digital Solutions",
    description:
      "Landing pages, business websites and client-focused digital experiences built around your goals.",
    linkLabel: "Explore websites",
    to: "/websites",
  },
  {
    icon: Workflow,
    title: "AI Automation and Consultancy",
    description:
      "Practical guidance and automation solutions that reduce repetitive work and support better organisation.",
    linkLabel: "Explore AI services",
    to: "/ai-automation",
  },
] as const;

export function ServicesIntro() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <Reveal>
        <SectionHeading
          title="Practical digital support for ideas, projects and businesses."
          description="Whether you need one carefully designed document or a complete digital workflow, Vortex Hub helps you move from idea to delivery with clarity."
        />
      </Reveal>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {services.map((service, i) => (
          <Reveal key={service.title} delay={i * 0.1}>
            <GlowCard className="h-full">
              <Link to={service.to} className="flex h-full flex-col p-7">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary glow-soft">
                  <service.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-6 text-xl">{service.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {service.description}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  {service.linkLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </GlowCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

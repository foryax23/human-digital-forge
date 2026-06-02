import { Palette, Globe, Workflow } from "lucide-react";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { ServiceCard } from "@/components/shared/ServiceCard";

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
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeading
        title="Practical digital support for ideas, projects and businesses."
        description="Whether you need one carefully designed document or a complete digital workflow, Vortex Hub helps you move from idea to delivery with clarity."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {services.map((service) => (
          <ServiceCard key={service.title} {...service} />
        ))}
      </div>
    </section>
  );
}

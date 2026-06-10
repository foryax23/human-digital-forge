import { Link } from "@tanstack/react-router";
import { Palette, Globe, Workflow, ArrowRight } from "lucide-react";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { GlowCard } from "@/components/cinematic/GlowCard";
import { Reveal } from "@/components/cinematic/Reveal";
import productsImg from "@/assets/home/service-products.jpg";
import websitesImg from "@/assets/home/service-websites.jpg";
import aiImg from "@/assets/home/service-ai.jpg";

const services = [
  {
    icon: Palette,
    image: productsImg,
    title: "Digital Products",
    description:
      "Posters, documents, presentations and visual materials designed with purpose and attention to detail.",
    linkLabel: "Explore digital products",
    to: "/digital-products",
  },
  {
    icon: Globe,
    image: websitesImg,
    title: "Websites and Digital Solutions",
    description:
      "Landing pages, business websites and client-focused digital experiences built around your goals.",
    linkLabel: "Explore websites",
    to: "/websites",
  },
  {
    icon: Workflow,
    image: aiImg,
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
          eyebrow="What we do"
          title="Practical digital support for ideas, projects and businesses."
          description="Whether you need one carefully designed document or a complete digital workflow, Vortex Hub helps you move from idea to delivery with clarity."
        />
      </Reveal>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {services.map((service, i) => (
          <Reveal key={service.title} delay={i * 0.1}>
            <GlowCard className="h-full">
              <Link to={service.to} className="flex h-full flex-col">
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={service.image}
                    alt={service.title}
                    loading="lazy"
                    width={1024}
                    height={768}
                    className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                  <span className="absolute bottom-4 left-5 grid h-12 w-12 place-items-center rounded-xl bg-primary/20 text-primary backdrop-blur-sm glow-soft">
                    <service.icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-7 pt-5">
                  <h3 className="text-xl">{service.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    {service.linkLabel}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </GlowCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

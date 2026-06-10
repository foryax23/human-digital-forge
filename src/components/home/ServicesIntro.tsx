import { Link } from "@tanstack/react-router";
import { Palette, Globe, Workflow, ArrowRight } from "lucide-react";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { GlowCard } from "@/components/cinematic/GlowCard";
import { Reveal } from "@/components/cinematic/Reveal";
import { useI18n } from "@/i18n";
import productsImg from "@/assets/home/service-products.jpg";
import websitesImg from "@/assets/home/service-websites.jpg";
import aiImg from "@/assets/home/service-ai.jpg";

export function ServicesIntro() {
  const { t } = useI18n();

  const services = [
    {
      icon: Palette,
      image: productsImg,
      title: t("Digital Products", "Produse digitale"),
      description: t(
        "Posters, documents, presentations and visual materials designed with purpose and attention to detail.",
        "Postere, documente, prezentări și materiale vizuale create cu scop și atenție la detalii.",
      ),
      linkLabel: t("Explore digital products", "Explorează produsele digitale"),
      to: "/digital-products",
    },
    {
      icon: Globe,
      image: websitesImg,
      title: t("Websites and Digital Solutions", "Site-uri web și soluții digitale"),
      description: t(
        "Landing pages, business websites and client-focused digital experiences built around your goals.",
        "Pagini de prezentare, site-uri de business și experiențe digitale orientate spre client, construite în jurul obiectivelor tale.",
      ),
      linkLabel: t("Explore websites", "Explorează site-urile"),
      to: "/websites",
    },
    {
      icon: Workflow,
      image: aiImg,
      title: t("AI Automation and Consultancy", "Automatizare AI și consultanță"),
      description: t(
        "Practical guidance and automation solutions that reduce repetitive work and support better organisation.",
        "Îndrumare practică și soluții de automatizare care reduc munca repetitivă și sprijină o organizare mai bună.",
      ),
      linkLabel: t("Explore AI services", "Explorează serviciile AI"),
      to: "/ai-automation",
    },
  ];

  return (
    <section className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <Reveal>
        <SectionHeading
          eyebrow={t("What we do", "Ce facem")}
          title={t("Practical digital support for ideas, projects and businesses.", "Sprijin digital practic pentru idei, proiecte și afaceri.")}
          description={t(
            "Whether you need one carefully designed document or a complete digital workflow, Vortex Hub helps you move from idea to delivery with clarity.",
            "Fie că ai nevoie de un singur document atent realizat sau de un flux digital complet, Vortex Hub te ajută să treci de la idee la livrare cu claritate.",
          )}
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

import { Link } from "@tanstack/react-router";
import { Palette, Globe, Workflow, ArrowRight } from "lucide-react";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/cinematic/Reveal";
import { useI18n } from "@/i18n";
import productsImg from "@/assets/home/service-products.jpg";
import websitesImg from "@/assets/home/service-websites.jpg";
import aiImg from "@/assets/home/service-ai.jpg";

export function ServicesIntro() {
  const { t } = useI18n();

  const feature = {
    icon: Globe,
    image: websitesImg,
    title: t("Websites and digital solutions", "Site-uri web și soluții digitale"),
    description: t(
      "Landing pages, business websites and client-focused digital experiences built around your goals — fast, accessible and easy to maintain.",
      "Pagini de prezentare, site-uri de business și experiențe digitale orientate spre client, construite în jurul obiectivelor tale — rapide, accesibile și ușor de întreținut.",
    ),
    linkLabel: t("Explore websites", "Explorează site-urile"),
    to: "/websites",
  };

  const supporting = [
    {
      icon: Palette,
      image: productsImg,
      title: t("Digital products", "Produse digitale"),
      description: t(
        "Posters, documents and presentations designed with purpose.",
        "Postere, documente și prezentări create cu scop.",
      ),
      to: "/digital-products",
    },
    {
      icon: Workflow,
      image: aiImg,
      title: t("AI automation", "Automatizare AI"),
      description: t(
        "Practical automation that removes repetitive work.",
        "Automatizare practică ce elimină munca repetitivă.",
      ),
      to: "/ai-automation",
    },
  ];

  return (
    <section className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
      <Reveal>
        <SectionHeading
          eyebrow={t("What we do", "Ce facem")}
          title={t(
            "Practical digital support for ideas, projects and businesses.",
            "Sprijin digital practic pentru idei, proiecte și afaceri.",
          )}
          description={t(
            "Whether you need one carefully designed document or a complete digital workflow, we help you move from idea to delivery with clarity.",
            "Fie că ai nevoie de un singur document atent realizat sau de un flux digital complet, te ajutăm să treci de la idee la livrare cu claritate.",
          )}
        />
      </Reveal>

      <div className="mt-16 grid gap-5 lg:grid-cols-3">
        {/* Large feature tile */}
        <Reveal className="lg:col-span-2">
          <Link
            to={feature.to}
            className="group relative flex h-full min-h-[24rem] flex-col justify-end overflow-hidden rounded-[1.75rem] bento-panel p-8 sm:p-10"
          >
            <img
              src={feature.image}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-[1200ms] group-hover:scale-105"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-transparent"
            />
            <div className="relative">
              <span className="grid h-12 w-12 place-items-center rounded-sm bg-primary/25 text-primary-foreground backdrop-blur glow-soft">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-6 max-w-md text-3xl sm:text-4xl">{feature.title}</h3>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
              <span className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-teal">
                {feature.linkLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        </Reveal>

        {/* Two stacked supporting tiles */}
        <div className="grid gap-5">
          {supporting.map((service, i) => (
            <Reveal key={service.title} delay={0.1 + i * 0.1}>
              <Link
                to={service.to}
                className="group relative flex h-full min-h-[11.5rem] flex-col justify-end overflow-hidden rounded-[1.75rem] bento-panel p-7"
              >
                <img
                  src={service.image}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-20 transition-transform duration-[1200ms] group-hover:scale-105"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent"
                />
                <div className="relative">
                  <span className="inline-grid h-10 w-10 place-items-center rounded-sm bg-teal/20 text-teal">
                    <service.icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="mt-4 text-xl">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

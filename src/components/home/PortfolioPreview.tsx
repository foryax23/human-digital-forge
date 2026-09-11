import { ArrowUpRight } from "lucide-react";

import { SectionHeading } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/cinematic/Reveal";
import { ParticlesBackground } from "@/components/backgrounds/ParticlesBackground";
import { useI18n } from "@/i18n";
import project1 from "@/assets/home/portfolio-1.jpg";
import project2 from "@/assets/home/portfolio-2.jpg";
import project3 from "@/assets/home/portfolio-3.jpg";
import project4 from "@/assets/home/portfolio-4.jpg";

export function PortfolioPreview() {
  const { t } = useI18n();

  const projects = [
    {
      type: t("Website", "Site web"),
      title: t("Boutique business landing page", "Pagină de prezentare pentru afacere boutique"),
      outcome: t(
        "A clear, single-page site that explains the offer and guides enquiries.",
        "Un site clar, pe o singură pagină, care explică oferta și ghidează cererile.",
      ),
      image: project1,
      span: "sm:col-span-2 sm:row-span-2 min-h-[24rem]",
    },
    {
      type: t("Digital Products", "Produse digitale"),
      title: t("Event poster and campaign set", "Poster de eveniment și set de campanie"),
      outcome: t(
        "A coordinated visual set ready for print and social.",
        "Un set vizual coordonat, gata pentru tipar și social media.",
      ),
      image: project2,
      span: "min-h-[15rem]",
    },
    {
      type: t("Document Design", "Design de documente"),
      title: t("Professional report redesign", "Reproiectarea unui raport profesional"),
      outcome: t(
        "A dense report restructured into a readable document.",
        "Un raport stufos restructurat într-un document ușor de citit.",
      ),
      image: project3,
      span: "min-h-[15rem]",
    },
    {
      type: t("AI Automation", "Automatizare AI"),
      title: t("Enquiry automation workflow", "Flux de automatizare a cererilor"),
      outcome: t(
        "Incoming enquiries organised and summarised automatically.",
        "Cererile primite sunt organizate și rezumate automat.",
      ),
      image: project4,
      span: "sm:col-span-2 min-h-[15rem]",
    },
  ];

  return (
    <section className="relative isolate mx-auto max-w-7xl overflow-hidden px-4 py-28 sm:px-6 lg:px-8">
      <ParticlesBackground className="-z-10" count={40} />
      <Reveal>
        <SectionHeading
          eyebrow={t("Selected work", "Lucrări selectate")}
          title={t("Selected work and digital possibilities.", "Lucrări selectate și posibilități digitale.")}
        />
      </Reveal>
      <div className="mt-16 grid gap-5 sm:grid-cols-4">
        {projects.map((project, i) => (
          <Reveal key={project.title} delay={i * 0.08} className={project.span}>
            <article className="group relative flex h-full flex-col justify-end overflow-hidden rounded-[1.75rem] bento-panel p-7 transition-transform duration-500 hover:-translate-y-1.5">
              <img
                src={project.image}
                alt={project.title}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-45 transition-all duration-[1200ms] group-hover:scale-105 group-hover:opacity-60"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent"
              />
              <span className="absolute left-6 top-6 rounded-full border border-border glass-panel px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.14em]">
                {project.type}
              </span>
              <span className="absolute right-6 top-6 grid h-9 w-9 place-items-center rounded-full border border-border glass-panel opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <ArrowUpRight className="h-4 w-4" />
              </span>
              <div className="relative">
                <h3 className="text-xl sm:text-2xl">{project.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground opacity-80 transition-opacity duration-300 group-hover:opacity-100">
                  {project.outcome}
                </p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

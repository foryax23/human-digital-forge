import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { ProjectPreview } from "@/components/landing/ProjectPreview";
import { PROJECTS, projectTitle } from "@/components/landing/projects";
import { WorkCard } from "@/components/landing/WorkSection";
import { pageMeta, useI18n } from "@/i18n";
import { absoluteUrl, canonicalLink, jsonLdScript } from "@/i18n/seo";

export const Route = createFileRoute("/portfolio")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/portfolio"),
    links: [canonicalLink("/portfolio")],
    scripts: [
      jsonLdScript({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Vortex Hub portfolio",
        itemListElement: PROJECTS.map((project, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "CreativeWork",
            name: projectTitle(project, "en"),
            url: project.url,
            description: project.tagline.en,
            genre: project.category.en,
            creator: { "@type": "Organization", name: "Vortex Hub", url: absoluteUrl("/") },
          },
        })),
      }),
    ],
  }),
  component: PortfolioPage,
});

/*
 * Grid placement in project order, the homepage's frame rhythm extended to every project.
 * lg: 7/5 (the pair shares the 7-column frame's height), 4/4/4, then 6/6. md: the first
 * frame full width, then two by two. Phones: one column. Every other frame keeps 16:10.
 */
const SPANS = [
  "md:col-span-12 lg:col-span-7",
  "md:col-span-6 lg:col-span-5",
  "md:col-span-6 lg:col-span-4",
  "md:col-span-6 lg:col-span-4",
  "md:col-span-6 lg:col-span-4",
  "md:col-span-6 lg:col-span-6",
  "md:col-span-6 lg:col-span-6",
];

function PortfolioPage() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SiteLayout>
      <PageHero
        kicker={t("Projects", "Proiecte")}
        title={t("Projects we've built and launched.", "Proiecte construite și lansate de noi.")}
        description={t(
          "Seven live products, from student-recruitment platforms and corporate sites to private dashboards. Open any project for a quick look, or visit it live.",
          "Șapte produse online, de la platforme de recrutare a studenților și site-uri de firmă la aplicații private. Deschide oricare pentru o privire rapidă sau vizitează-l.",
        )}
      />
      <section aria-label={t("Projects", "Proiecte")} className="section-y">
        <div className="container-vx">
          <ul role="list" className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-12 md:gap-y-10">
            {PROJECTS.map((project, index) => (
              <WorkCard
                key={project.slug}
                project={project}
                fill={index === 1}
                spanClass={SPANS[index % SPANS.length]}
                onOpen={() => setOpenIndex(index)}
              />
            ))}
          </ul>
        </div>
      </section>
      <CtaBand
        title={t(
          "Have a project we could feature next?",
          "Ai un proiect pe care l-am putea prezenta?",
        )}
        primaryLabel={t("Start a project", "Începe un proiect")}
        primaryTo="/contact"
        secondaryLabel={t("Book a call", "Programează o discuție")}
        secondaryTo="/consultancy"
      />
      <ProjectPreview projects={PROJECTS} index={openIndex} onIndexChange={setOpenIndex} />
    </SiteLayout>
  );
}

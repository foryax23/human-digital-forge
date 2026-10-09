import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { ProjectPreview } from "@/components/landing/ProjectPreview";
import { PROJECTS, projectTitle } from "@/components/landing/projects";
import { WorkCard } from "@/components/landing/WorkSection";
import { ButtonLink, SectionHeader } from "@/components/system";
import { pageMeta, useI18n } from "@/i18n";
import { absoluteUrl, canonicalLink, jsonLdScript } from "@/i18n/seo";
import { VORTEXPOINT_ICON } from "@/lib/vortexpoint";

export const Route = createFileRoute("/portfolio")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/portfolio"),
    links: [canonicalLink("/portfolio")],
    scripts: [
      jsonLdScript({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Vortex Hub portfolio",
        itemListElement: [
          ...PROJECTS.map((project, i) => ({
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
          // Vortex Hub's own app, after the client work (its page has the full details).
          {
            "@type": "ListItem",
            position: PROJECTS.length + 1,
            item: {
              "@type": "SoftwareApplication",
              name: "VortexPoint",
              url: absoluteUrl("/vortexpoint"),
              operatingSystem: "macOS 26 or later",
              applicationCategory: "UtilitiesApplication",
              creator: { "@type": "Organization", name: "Vortex Hub", url: absoluteUrl("/") },
            },
          },
        ],
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
          "Fourteen live products, from student-recruitment platforms and corporate sites to analytics terminals and private dashboards. Open any project for a quick look, or visit it live.",
          "Paisprezece produse online, de la platforme de recrutare a studenților și site-uri de firmă la terminale de analiză și aplicații private. Deschide oricare pentru o privire rapidă sau vizitează-l.",
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
          <OwnApps />
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

/**
 * Vortex Hub's own software, after the client work: the project frame (16:10, hairline,
 * panel surface) with the app icon in place of a capture, beside the project details in the
 * preview's order (category, name, tagline, what it does, facts) and a link to its page. A
 * Mac app has no site to capture or open, so it does not join PROJECTS and the preview.
 */
function OwnApps() {
  const { t } = useI18n();

  const features = [
    t("Now playing, with music controls", "Muzica din orice aplicație, cu butoane"),
    t("A shelf for the files you need at hand", "Un raft pentru fișierele de care ai nevoie"),
    t(
      "Mac Health: memory, CPU, heavy apps, caches",
      "Mac Health: memorie, procesor, aplicații grele, cache",
    ),
    t("An AI agent (Beta) with your own Claude key", "Un agent AI (Beta) cu cheia ta Claude"),
  ];
  const facts = [
    [t("Price", "Preț"), t("Free", "Gratuit")],
    [
      t("Requires", "Necesită"),
      t("macOS 26 or later, Apple Silicon", "macOS 26 sau mai nou, Apple Silicon"),
    ],
  ];

  return (
    <>
      <SectionHeader
        className="mt-16 md:mt-20"
        headingId="portfolio-own"
        title={t("Our own apps", "Aplicațiile noastre")}
        lead={t(
          "Besides client work, we make and publish software of our own.",
          "Pe lângă proiectele pentru clienți, facem și publicăm aplicații proprii.",
        )}
      />
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-12">
        {/* The frame repeats the link below for pointers; keyboards and screen readers get
            the one named link. */}
        <Link
          to="/vortexpoint"
          tabIndex={-1}
          aria-hidden
          className="group block min-w-0 md:col-span-6"
        >
          <span className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl border border-line-2 bg-s1">
            <img
              src={VORTEXPOINT_ICON.web}
              alt=""
              width={256}
              height={256}
              loading="lazy"
              decoding="async"
              className="size-28 transition-[filter] duration-200 group-hover:brightness-[1.06] md:size-36"
            />
          </span>
        </Link>
        <div className="flex min-w-0 flex-col md:col-span-6 md:pt-1">
          <p className="text-[0.8125rem] leading-[1.35] text-fg-3">
            {t("Mac app for the notch", "Aplicație de Mac pentru notch")}
          </p>
          <h3 className="type-h3 mt-1 text-fg">VortexPoint</h3>
          <p className="mt-1.5 text-pretty text-[0.9375rem] leading-[1.5] text-fg-2">
            {t(
              "Your notch, alive: hover it and it opens into a small home for your music, files and Mac.",
              "Notch-ul tău, viu: treci cu mouse-ul peste el și se deschide un loc pentru muzică, fișiere și Mac.",
            )}
          </p>
          <ul className="mt-4 space-y-1.5">
            {features.map((item) => (
              <li key={item} className="type-body-sm flex gap-2 text-fg-2">
                <span aria-hidden className="text-fg-3">
                  –
                </span>
                {item}
              </li>
            ))}
          </ul>
          <dl className="mt-4 border-t border-line-1 text-[0.8125rem] leading-[1.35]">
            {facts.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-line-1 py-2.5"
              >
                <dt className="text-fg-3">{label}</dt>
                <dd className="text-pretty text-fg-2">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5">
            <ButtonLink to="/vortexpoint" variant="secondary">
              {t("See VortexPoint", "Vezi VortexPoint")}
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Eye, Lock } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { Reveal } from "@/components/cinematic/Reveal";
import { ProjectPreview } from "@/components/landing/ProjectPreview";
import { PROJECTS, projectImages, projectTitle, type Project } from "@/components/landing/projects";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

const title = "Portfolio | Vortex Hub";
const description =
  "Live websites, platforms and web apps designed and built by Vortex Hub, including Momentum One, Bridge Gateway, ORBISGRID, Harvard of Sales, MetaFit and FaneaProperties.";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/portfolio" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
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
              creator: { "@type": "Organization", name: "Vortex Hub" },
            },
          })),
        }),
      },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Portfolio", "Portofoliu")}
        title={t("Projects we've built and launched.", "Proiecte construite și lansate de noi.")}
        description={t(
          "Seven live products, from student-recruitment platforms and corporate sites to private dashboards. Open any project for a sneak peek of its landing page, or visit it live.",
          "Șapte produse live, de la platforme de recrutare a studenților și site-uri corporative la aplicații private. Deschide orice proiect pentru o privire în pagina de prezentare sau vizitează-l live.",
        )}
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <ul role="list" className="grid gap-6 md:grid-cols-2">
          {PROJECTS.map((project, index) => {
            // An odd last card spans the row in a side-by-side layout.
            const wide = index === PROJECTS.length - 1 && PROJECTS.length % 2 === 1;
            return (
              <li key={project.slug} className={cn(wide && "md:col-span-2")}>
                <Reveal delay={(index % 2) * 0.08} className="h-full">
                  <ProjectCard project={project} wide={wide} onOpen={() => setOpenIndex(index)} />
                </Reveal>
              </li>
            );
          })}
        </ul>
      </section>
      <CtaBand
        title={t(
          "Have a project we could feature next?",
          "Ai un proiect pe care l-am putea prezenta?",
        )}
        primaryLabel={t("Start a project", "Începe un proiect")}
        primaryTo="/contact"
        secondaryLabel={t("Book a consultation", "Programează o consultanță")}
        secondaryTo="/consultancy"
      />
      <ProjectPreview projects={PROJECTS} index={openIndex} onIndexChange={setOpenIndex} />
    </SiteLayout>
  );
}

function ProjectCard({
  project,
  wide,
  onOpen,
}: {
  project: Project;
  wide: boolean;
  onOpen: () => void;
}) {
  const { t, lang } = useI18n();
  const pick = (value: { en: string; ro: string }) => (lang === "ro" ? value.ro : value.en);
  const highlights = lang === "ro" ? project.highlights.ro : project.highlights.en;
  const title = projectTitle(project, lang);

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card",
        wide && "md:grid md:grid-cols-2",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={t(`Peek inside ${title}`, `Privește în ${title}`)}
        className={cn(
          "relative block aspect-[16/10] overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          // The wide card's image fills the row next to its text column.
          wide && "md:aspect-auto md:h-full",
        )}
      >
        <img
          src={projectImages(project.slug).hero}
          alt=""
          width={1280}
          height={800}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: project.heroPosition }}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-white/90 backdrop-blur">
          {project.access === "private" ? (
            <>
              <Lock aria-hidden className="h-3 w-3" />
              {t("Members-only", "Acces privat")}
            </>
          ) : (
            <>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {t("Live", "Live")}
            </>
          )}
        </span>
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black">
            <Eye className="h-4 w-4" />
            {t("Peek inside", "Privește în interior")}
          </span>
        </span>
      </button>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: project.accent }}
          />
          {pick(project.category)}
        </p>
        <h2 className="mt-2 text-xl sm:text-2xl">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {pick(project.tagline)}
        </p>
        <ul className="mt-4 flex flex-wrap gap-2" aria-label={t("Highlights", "Repere")}>
          {highlights.map((chip) => (
            <li
              key={chip}
              className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
            >
              {chip}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-6">
          <button
            type="button"
            onClick={onOpen}
            aria-haspopup="dialog"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Eye className="h-4 w-4" />
            {t("Peek inside", "Privește în interior")}
          </button>
          <a
            href={project.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("Visit site", "Vizitează site-ul")}
            <span className="text-muted-foreground">{project.domain}</span>
            <ArrowUpRight aria-hidden className="h-4 w-4" />
            <span className="sr-only">
              {t("(opens in a new tab)", "(se deschide într-o filă nouă)")}
            </span>
          </a>
        </div>
      </div>
    </article>
  );
}

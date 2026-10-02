import { useId, useState } from "react";
import { MotionConfig, motion } from "motion/react";
import { Eye, Lock } from "lucide-react";

import { RingButton } from "@/components/landing/RingButton";
import { Em, SectionHeader } from "@/components/landing/SectionHeader";
import { ProjectPreview } from "@/components/landing/ProjectPreview";
import {
  FEATURED_PROJECTS,
  PROJECTS,
  projectImages,
  projectTitle,
  type Project,
} from "@/components/landing/projects";
import { useI18n } from "@/i18n";

/** Bento spans in card order: 7/5 · 5/7, then a full-width closer. */
const SPANS = [
  "md:col-span-7",
  "md:col-span-5",
  "md:col-span-5",
  "md:col-span-7",
  "md:col-span-12",
];

/**
 * Selected work (#work): the featured published projects as a bento. Each
 * card opens the sneak-peek popup, which pages through every project.
 */
export function WorkSection() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="work"
      aria-labelledby="work-heading"
      className="scroll-mt-24 bg-background py-12 md:py-16"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10 lg:px-16">
        <SectionHeader
          headingId="work-heading"
          eyebrow={t("Selected work", "Lucrări selectate")}
          title={
            <>
              {t("Work designed around an", "Lucrări construite în jurul unui")}{" "}
              <Em>{t("outcome", "rezultat")}</Em>.
            </>
          }
          description={t(
            "Live products we've designed, built and launched — from student-recruitment platforms to private dashboards. Open any of them for a quick look.",
            "Produse live pe care le-am proiectat, construit și lansat — de la platforme de recrutare a studenților la aplicații private. Deschide oricare dintre ele pentru o privire rapidă.",
          )}
          action={{ label: t("View all work", "Vezi toate lucrările"), to: "/portfolio" }}
        />

        {/* "user": reduced-motion visitors get the fade without the slide; markup stays SSR-identical. */}
        <MotionConfig reducedMotion="user">
          <ul role="list" className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6">
            {FEATURED_PROJECTS.map((project, index) => (
              <WorkCard
                key={project.slug}
                project={project}
                index={index}
                onOpen={() => setOpenIndex(PROJECTS.indexOf(project))}
              />
            ))}
          </ul>
        </MotionConfig>

        <div className="mt-10 flex justify-center md:hidden">
          <RingButton to="/portfolio" variant="outline" arrow="right">
            {t("View all work", "Vezi toate lucrările")}
          </RingButton>
        </div>
      </div>

      <ProjectPreview projects={PROJECTS} index={openIndex} onIndexChange={setOpenIndex} />
    </section>
  );
}

function WorkCard({
  project,
  index,
  onOpen,
}: {
  project: Project;
  index: number;
  onOpen: () => void;
}) {
  const { t, lang } = useI18n();
  const id = useId();
  const titleId = `${id}-title`;
  const metaId = `${id}-meta`;
  const category = lang === "ro" ? project.category.ro : project.category.en;
  const title = projectTitle(project, lang);

  return (
    <motion.li
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay: (index % 2) * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
      className={SPANS[index % SPANS.length]}
    >
      {/* Named by the caption only, so the hover label doesn't repeat the title. */}
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-labelledby={`${titleId} ${metaId}`}
        className="group relative isolate block aspect-[16/10] w-full overflow-hidden rounded-3xl border border-border bg-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:aspect-auto md:h-[400px] lg:h-[460px]"
      >
        <img
          src={projectImages(project.slug).hero}
          alt=""
          width={1280}
          height={800}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: project.heroPosition }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 halftone opacity-20 mix-blend-multiply"
        />

        <span
          aria-hidden
          className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-white/90 backdrop-blur md:left-5 md:top-5"
        >
          {project.access === "private" ? (
            <>
              <Lock className="h-3 w-3" />
              {t("Members-only", "Acces privat")}
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {t("Live", "Live")}
            </>
          )}
        </span>

        {/* Always-visible caption for touch screens; gives way to the hover label. */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 block bg-gradient-to-t from-background/95 via-background/60 to-transparent px-5 pb-5 pt-16 transition-opacity duration-500 group-hover:opacity-0 group-focus-visible:opacity-0 md:px-6 md:pb-6 md:pt-20">
          <span
            id={metaId}
            className="block text-[0.68rem] font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            {category} · {project.domain}
          </span>
          <span
            id={titleId}
            className="mt-1.5 block font-display text-base font-semibold leading-snug text-foreground md:text-lg"
          >
            {title}
          </span>
        </span>

        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center bg-background/70 p-6 opacity-0 backdrop-blur-lg transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span className="accent-gradient-animated inline-flex max-w-full rounded-full p-[1.5px]">
            <span className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-center text-sm text-background">
              <Eye className="h-4 w-4 shrink-0" />
              <span>
                {t("Peek", "Privește")} — <span className="font-semibold">{title}</span>
              </span>
            </span>
          </span>
        </span>
      </button>
    </motion.li>
  );
}

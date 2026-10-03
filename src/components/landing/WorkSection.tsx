import { useId, useState } from "react";

import { ProjectPreview } from "@/components/landing/ProjectPreview";
import {
  FEATURED_PROJECTS,
  PROJECTS,
  projectImages,
  projectTitle,
  type Project,
} from "@/components/landing/projects";
import { ButtonLink, Muted, SectionHeader, Status } from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/*
 * Grid placement in card order. lg+: two large frames side by side (7/5, the pair
 * shares the height of the 7-column 16:10 frame), then three 16:10 frames (4/4/4).
 * md: the first frame full width, then two by two. Phones: one column.
 */
const SPANS = [
  "md:col-span-12 lg:col-span-7",
  "md:col-span-6 lg:col-span-5",
  "md:col-span-6 lg:col-span-4",
  "md:col-span-6 lg:col-span-4",
  "md:col-span-6 lg:col-span-4",
];

/**
 * Selected work (#work): the featured published projects as plain image frames with
 * the caption under the image. Each card opens the preview, which pages through every
 * project.
 */
export function WorkSection() {
  const { t, lang } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="work" aria-labelledby="work-heading" className="section-y scroll-mt-20">
      <div className="container-vx">
        <SectionHeader
          headingId="work-heading"
          title={
            <>
              {t("Launched projects,", "Proiecte lansate,")}{" "}
              <Muted>
                {lang === "ro" ? (
                  // Keeps "site-uri" whole: the hyphen is not a line-break point here.
                  <>
                    de la <span className="whitespace-nowrap">site-uri</span> la aplicații private.
                  </>
                ) : (
                  "from websites to private apps."
                )}
              </Muted>
            </>
          }
          lead={t(
            "We designed, built and launched each of them. Open any one for a quick look.",
            "Le-am proiectat, construit și lansat noi. Deschide oricare pentru o privire rapidă.",
          )}
          actions={
            // The count matches the hero's "N proiecte lansate" (every project, not only these).
            <ButtonLink to="/portfolio" variant="secondary">
              {t(`All projects (${PROJECTS.length})`, `Toate proiectele (${PROJECTS.length})`)}
            </ButtonLink>
          }
        />

        <ul role="list" className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-12 md:gap-y-10">
          {FEATURED_PROJECTS.map((project, index) => (
            <WorkCard
              key={project.slug}
              project={project}
              // The second frame matches the first one's height on lg+ instead of keeping 16:10.
              fill={index === 1}
              spanClass={SPANS[index % SPANS.length]}
              onOpen={() => setOpenIndex(PROJECTS.indexOf(project))}
            />
          ))}
        </ul>
      </div>

      <ProjectPreview projects={PROJECTS} index={openIndex} onIndexChange={setOpenIndex} />
    </section>
  );
}

/** One project as an image frame with its caption below; opens the preview. Shared with /portfolio. */
export function WorkCard({
  project,
  fill,
  spanClass,
  onOpen,
}: {
  project: Project;
  fill: boolean;
  spanClass: string;
  onOpen: () => void;
}) {
  const { t, lang } = useI18n();
  const id = useId();
  const titleId = `${id}-title`;
  const metaId = `${id}-meta`;
  const category = lang === "ro" ? project.category.ro : project.category.en;
  const title = projectTitle(project, lang);

  return (
    <li className={cn("min-w-0", spanClass)}>
      {/* One control for image and caption; named by the title, described by the category. */}
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-labelledby={titleId}
        aria-describedby={metaId}
        className="group flex h-full w-full cursor-pointer flex-col rounded-xl text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-line/55"
      >
        <span
          className={cn(
            "relative block aspect-[16/10] w-full overflow-hidden rounded-xl border border-line-2 bg-s1",
            fill && "lg:aspect-auto lg:min-h-0 lg:flex-1",
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
            className="absolute inset-0 h-full w-full object-cover transition-[filter] duration-200 group-hover:brightness-[1.04] group-focus-visible:brightness-[1.04]"
          />
        </span>

        <span className="mt-3 block">
          <span className="flex items-baseline justify-between gap-4">
            <span
              id={titleId}
              className="type-h4 min-w-0 truncate text-[1.0625rem] text-fg decoration-fg/40 underline-offset-4 group-hover:underline group-focus-visible:underline"
            >
              {title}
            </span>
            {project.access === "private" ? (
              <span className="shrink-0 text-[0.8125rem] text-fg-3">
                {t("private access", "acces privat")}
              </span>
            ) : (
              <Status tone="ok" className="shrink-0">
                online
              </Status>
            )}
          </span>
          <span
            id={metaId}
            className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-[0.8125rem] leading-[1.35] text-fg-3"
          >
            <span className="min-w-0">{category}</span>
            <span className="type-code">{project.domain}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

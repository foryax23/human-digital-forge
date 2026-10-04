import { useId } from "react";

import { projectImages, projectTitle, type Project } from "@/components/landing/projects";
import { Status } from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * One project as an image frame with its caption below; opens the preview. Used by
 * /portfolio, the one page that shows the work (the homepage section was removed).
 */
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
        className="group flex h-full w-full cursor-pointer flex-col rounded-xl text-left focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-brand-line"
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

import { Link } from "@tanstack/react-router";

import { FOCUS_RING } from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { PROJECTS } from "./projects";

/**
 * The hero's proof line: how many live projects the studio has launched (the
 * real count from PROJECTS), linking to /portfolio, where they live. No
 * thumbnails, stock avatars or claims.
 */
export function HeroProof({ className }: { className?: string }) {
  const { t } = useI18n();
  const count = PROJECTS.length;

  return (
    <Link
      to="/portfolio"
      className={cn("group/proof flex flex-col gap-1 rounded-md py-1 pr-2", FOCUS_RING, className)}
    >
      <span className="type-body-sm flex items-center gap-2 whitespace-nowrap text-white/85">
        {/* A still dot in the hero's cyan: a live count, never a pulsing light. */}
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-echo" /* dot */ />
        {t(`${count} live projects launched`, `${count} proiecte lansate`)}
      </span>
      <span className="type-label flex items-center gap-1.5 pl-3.5 text-white/45 transition-colors group-hover/proof:text-white/80">
        {t("See the projects", "Vezi proiectele")}
        <span
          aria-hidden
          className="transition-[translate] duration-300 group-hover/proof:translate-x-0.5 motion-reduce:transition-none"
        >
          →
        </span>
      </span>
    </Link>
  );
}

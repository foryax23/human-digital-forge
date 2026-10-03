import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { PROJECTS } from "./projects";
import { scrollToSection } from "./smooth-scroll";

/**
 * The hero's proof line: how many live projects the studio has launched (the
 * real count from PROJECTS), linking to the work section. No thumbnails, stock
 * avatars or claims.
 */
export function HeroProof({ className }: { className?: string }) {
  const { t } = useI18n();
  const count = PROJECTS.length;

  return (
    <a
      href="#work"
      onClick={(event) => {
        event.preventDefault();
        scrollToSection("work");
      }}
      className={cn(
        "group/proof flex flex-col gap-1 rounded-md py-1 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89cbf6] focus-visible:ring-offset-4 focus-visible:ring-offset-[#00020f]",
        className,
      )}
    >
      <span className="type-body-sm flex items-center gap-2 whitespace-nowrap text-white/85">
        <span aria-hidden className="relative flex h-1.5 w-1.5">
          <span className="animate-pulse-dot absolute inset-0 rounded-full bg-[#67e8f9]/60" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-[#67e8f9]" />
        </span>
        {t(`${count} live projects launched`, `${count} proiecte lansate`)}
      </span>
      <span className="type-label flex items-center gap-1.5 pl-3.5 text-white/45 transition-colors group-hover/proof:text-white/80">
        {t("See the work", "Vezi lucrările")}
        <span
          aria-hidden
          className="transition-[translate] duration-300 group-hover/proof:translate-x-0.5 motion-reduce:transition-none"
        >
          →
        </span>
      </span>
    </a>
  );
}

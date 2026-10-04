import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { FOCUS_RING } from "./tone";

/** The id of each page's <main> (with tabIndex={-1}): where the skip link lands. */
export const MAIN_ID = "main";

/**
 * "Sari la conținut": the first Tab stop on every page (WCAG 2.4.1). Out of view until it
 * has focus, then a solid button at the top left, above the fixed nav. Enter moves focus
 * to the page's <main> (its first heading on a page without one), so the next Tab
 * continues inside the content instead of the nav.
 */
export function SkipLink() {
  const { t } = useI18n();
  return (
    <a
      href={`#${MAIN_ID}`}
      onClick={(event) => {
        const target =
          document.getElementById(MAIN_ID) ??
          document.querySelector("main") ??
          document.querySelector("h1");
        if (!(target instanceof HTMLElement)) return;
        // No #main in the address bar (the homepage keeps its section hash there).
        event.preventDefault();
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus();
      }}
      className={cn(
        "type-button fixed left-4 top-0 z-[100] inline-flex h-11 -translate-y-full items-center rounded-lg bg-brand px-4 text-white focus:translate-y-3",
        FOCUS_RING,
      )}
    >
      {t("Skip to content", "Sari la conținut")}
    </a>
  );
}

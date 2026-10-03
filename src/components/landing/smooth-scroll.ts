import { gsap, prefersReducedMotion } from "./gsap";

/** Space kept above a section when scrolling to it: the 64 px nav plus 16 px. */
export const NAV_OFFSET = 80;

/** Section ids on the homepage, in page order. "top" is the hero. (The projects live on /portfolio.) */
export const SECTION_IDS = ["top", "services", "pricing", "contact"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/**
 * Moves keyboard focus to a section without scrolling, so the next Tab
 * continues from there (WCAG 2.4.3).
 */
function focusSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}

/**
 * Smoothly scrolls to a homepage section, mirrors it in the URL hash and moves
 * focus there. Falls back to an instant jump for reduced-motion visitors.
 */
export function scrollToSection(id: string) {
  if (typeof window === "undefined") return;
  const target = id === "top" ? 0 : document.getElementById(id);
  if (target === null) return;

  if (prefersReducedMotion()) {
    const y =
      typeof target === "number"
        ? target
        : target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
    window.scrollTo({ top: y, behavior: "auto" });
    focusSection(id);
  } else {
    gsap.to(window, {
      duration: 1.1,
      ease: "power3.inOut",
      scrollTo: { y: target, offsetY: id === "top" ? 0 : NAV_OFFSET, autoKill: true },
      overwrite: "auto",
      onComplete: () => focusSection(id),
    });
  }

  const hash = id === "top" ? "" : `#${id}`;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", `${pathname}${search}${hash}`);
}

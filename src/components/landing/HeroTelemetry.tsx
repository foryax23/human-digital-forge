import { cn } from "@/lib/utils";
import type { AsciiVortexState } from "./ascii";
import styles from "./HeroTelemetry.module.css";

/*
 * The hero's perimeter: a faint grid that fades in away from the copy and out
 * towards the nav and the page below. Decorative only: no type, no counts, no
 * scan-lines, nothing in the centre. The darker edges come from HeroCosmos's
 * vignette.
 */

/**
 * Perimeter grid for the hero. Place it inside the hero section, right after
 * HeroCosmos (behind the content). `state` is the hero's: the grid lifts a
 * little while the search is in use and is drawn in towards the eye on submit.
 */
export function HeroTelemetry({ state = "idle" }: { state?: AsciiVortexState }) {
  return (
    <div
      aria-hidden
      data-state={state}
      className={cn(styles.root, "pointer-events-none absolute inset-0 overflow-hidden")}
    >
      <div className={styles.grid} />
    </div>
  );
}

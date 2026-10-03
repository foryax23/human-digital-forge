import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { OrbitSector } from "../ascii";
import styles from "./HeroPillars.module.css";

/*
 * The hero's own marks: the eyebrow's reticle, the search's spark and the four
 * pillar icons. The pillar icons are one family drawn after the owner's
 * reference: a 32-unit grid with a live area of about 24 × 24, 1.75 strokes
 * with round caps and joins, and a violet-300 → white gradient (bottom-left to
 * top-right) whose id is unique per instance (the same icon can render twice
 * on a page). Only one accent part per icon is dimmer than full strength. Their
 * motion lives in HeroPillars.module.css.
 */

/** A gradient id that is unique per rendered icon and safe inside url(#…). */
function useGradientId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** Bottom-left violet-300 to top-right white, in the icon's own units. */
function Gradient({ id, size = 32 }: { id: string; size?: number }) {
  const inset = size * 0.16;
  return (
    <linearGradient
      id={id}
      x1={inset}
      y1={size - inset}
      x2={size - inset}
      y2={inset}
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0" style={{ stopColor: "var(--hero-lilac)" }} />
      <stop offset="0.5" stopColor="#e4ddff" />
      <stop offset="1" stopColor="#ffffff" />
    </linearGradient>
  );
}

/** The eyebrow's reticle: a ring, four ticks and a centre dot, in currentColor. */
export function ReticleMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      className={cn("shrink-0", className)}
    >
      <circle cx="8" cy="8" r="3.75" />
      <path d="M8 .75v2M8 13.25v2M.75 8h2M13.25 8h2" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The search's four-point spark, filled violet-200 → white. */
export function SparkMark({ className }: { className?: string }) {
  const id = useGradientId("spark");
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={id} x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ddd6fe" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 1.75c.62 5.86 4.39 9.63 10.25 10.25-5.86.62-9.63 4.39-10.25 10.25C11.38 16.39 7.61 12.62 1.75 12 7.61 11.38 11.38 7.61 12 1.75Z"
      />
    </svg>
  );
}

/** The pillar icons' shared frame: 32-unit grid, gradient stroke. */
function PillarFrame({
  prefix,
  className,
  children,
}: {
  prefix: string;
  className?: string;
  children: (paint: string) => ReactNode;
}) {
  const id = useGradientId(prefix);
  const paint = `url(#${id})`;
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      fill="none"
      stroke={paint}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(styles.icon, "shrink-0", className)}
    >
      <defs>
        <Gradient id={id} />
      </defs>
      {children(paint)}
    </svg>
  );
}

/**
 * Analiză: a ring cut into four arcs (gaps at the cardinal points) around a
 * solid core, a lens locking on. pathLength 4 makes each quarter one unit:
 * 0.66 arc + 0.34 gap, offset so a gap is centred on each axis.
 */
function AnalyseIcon({ className }: { className?: string }) {
  return (
    <PillarFrame prefix="pillar-analyse" className={className}>
      {(paint) => (
        <>
          <circle
            className={styles.ring}
            cx="16"
            cy="16"
            r="9.5"
            pathLength={4}
            strokeDasharray="0.66 0.34"
            strokeDashoffset={0.83}
          />
          <circle className={styles.dot} cx="16" cy="16" r="3" fill={paint} stroke="none" />
        </>
      )}
    </PillarFrame>
  );
}

/** Automatizare: two angular halves of a chain link, each one the other turned 180°. */
const LINK = [
  "M12.25 21.75H7.75L4.25 16l3.5-5.75h7l3.75 4",
  "M19.75 10.25h4.5L27.75 16l-3.5 5.75h-7l-3.75-4",
];

/** Automatizare: an angular link loop with joints at its ends and a light running through it. */
function AutomateIcon({ className }: { className?: string }) {
  return (
    <PillarFrame prefix="pillar-automate" className={className}>
      {(paint) => (
        <>
          {LINK.map((d) => (
            <path key={d} d={d} />
          ))}
          {LINK.map((d) => (
            <path key={`light-${d}`} className={styles.comet} d={d} pathLength={1} stroke="#fff" />
          ))}
          <circle className={styles.joint} cx="4.25" cy="16" r="1.75" fill={paint} stroke="none" />
          <circle className={styles.joint} cx="27.75" cy="16" r="1.75" fill={paint} stroke="none" />
        </>
      )}
    </PillarFrame>
  );
}

/** Creștere: a rising line through two solid nodes to a larger end point. */
function GrowthIcon({ className }: { className?: string }) {
  return (
    <PillarFrame prefix="pillar-growth" className={className}>
      {(paint) => (
        <>
          <path
            className={styles.trend}
            d="M4.75 24.25 12.5 16.5l5 4.25 8.75-10.5"
            pathLength={1}
          />
          <circle className={styles.node} cx="12.5" cy="16.5" r="2.25" fill={paint} stroke="none" />
          <circle
            className={styles.node}
            cx="17.5"
            cy="20.75"
            r="2.25"
            fill={paint}
            stroke="none"
          />
          <circle
            className={styles.tip}
            cx="26.25"
            cy="10.25"
            r="2.75"
            fill={paint}
            stroke="none"
          />
        </>
      )}
    </PillarFrame>
  );
}

/** The orbit around the strategy gem, split at its widest point. */
const ORBIT_BACK = "M4 18.5a12 3.75 0 0 1 24 0";
const ORBIT_FRONT = "M4 18.5a12 3.75 0 0 0 24 0";

/**
 * Strategie: a gem (rhombus) inside a tilted orbit, the back of the ring
 * dimmed and hidden behind the gem, a point under it. The gem's dark fill is
 * what hides the ring's back arc.
 */
function StrategyIcon({ className }: { className?: string }) {
  return (
    <PillarFrame prefix="pillar-strategy" className={className}>
      {(paint) => (
        <>
          <path d={ORBIT_BACK} strokeOpacity={0.45} />
          <path
            className={styles.gem}
            d="M16 6.75 24 14.75 16 22.75 8 14.75Z"
            fill="#05071a"
            fillOpacity={0.92}
          />
          <path d={ORBIT_FRONT} />
          <path className={styles.comet} d={ORBIT_FRONT} pathLength={1} stroke="#fff" />
          <circle className={styles.shadow} cx="16" cy="26" r="1" fill={paint} stroke="none" />
        </>
      )}
    </PillarFrame>
  );
}

const PILLAR_ICONS: Record<OrbitSector, (props: { className?: string }) => ReactNode> = {
  analyse: AnalyseIcon,
  automate: AutomateIcon,
  growth: GrowthIcon,
  strategy: StrategyIcon,
};

/** The icon of one pillar (analyse, automate, growth, strategy). */
export function PillarIcon({ sector, className }: { sector: OrbitSector; className?: string }) {
  const Icon = PILLAR_ICONS[sector];
  return <Icon className={className} />;
}

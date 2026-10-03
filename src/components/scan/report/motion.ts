import { useReducedMotion, type Variants } from "motion/react";

import { useMotionPause } from "@/components/landing/motion-pause";

/** Soft "expo out" used by every scan report reveal. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/**
 * `reduce`: the OS asked for reduced motion, so one-shot movement (count-ups,
 * draws, slides) is skipped. `still`: also true under the page-wide pause
 * switch, so looping motion stops.
 */
export function useScanMotion() {
  const reduce = Boolean(useReducedMotion());
  const { paused } = useMotionPause();
  return { reduce, still: reduce || paused };
}

/** Parent of a staggered reveal. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

/** Child of a staggered reveal: rises and fades in. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

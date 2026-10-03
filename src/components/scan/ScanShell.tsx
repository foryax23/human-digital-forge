import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowRight } from "lucide-react";

import { MotionPauseToggle } from "@/components/landing/motion-pause";
import { prefersReducedMotion } from "@/components/landing/motion-prefs";
import type { ScanStage } from "@/components/scan/scan-state";
import { ScanStepper } from "@/components/scan/ScanStepper";
import { SCAN_STAGES } from "@/components/scan/useVortexScan";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/**
 * Layout of every scan screen: the 01–04 stepper under the nav, then the
 * current stage, cross-faded on change (focus moves to it and the page
 * returns to the top). `activity` shows a floating status while an edit
 * re-runs part of the scan. The page-wide pause switch sits in the bottom-right
 * corner, as on the homepage, so it never reads as a fifth step.
 */
export function ScanShell({
  stage,
  completed,
  reachable,
  onStageSelect,
  contentKey,
  activity,
  children,
}: {
  stage: ScanStage;
  completed: ScanStage[];
  reachable: ScanStage[];
  onStageSelect: (stage: ScanStage) => void;
  /** Changes whenever the visible screen changes (stage or sub-view). */
  contentKey: string;
  activity?: { label: string; detail?: string; onView?: () => void } | null;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement>(null);
  const firstKey = useRef(contentKey);

  useEffect(() => {
    if (contentKey === firstKey.current) return;
    firstKey.current = "";
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    contentRef.current?.focus({ preventScroll: true });
  }, [contentKey]);

  const index = SCAN_STAGES.findIndex((item) => item.id === stage);
  const current = SCAN_STAGES[index];

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative z-10 mx-auto w-full max-w-[80rem] px-4 pb-24 pt-[5.5rem] sm:px-5 md:px-8 md:pt-[6.75rem] lg:px-12">
        <h1 className="sr-only">Vortex Scan</h1>

        <div className="relative isolate border-b border-white/[0.07] pb-5">
          {/* A dark strip keeps the step names legible where the vortex's arm runs behind them. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-x-4 -bottom-px -top-4 -z-10 bg-[linear-gradient(to_bottom,transparent,rgb(0_2_15/0.7)_30%,rgb(0_2_15/0.7)_80%,transparent)] [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
          />
          <ScanStepper
            current={stage}
            completed={completed}
            reachable={reachable}
            onSelect={onStageSelect}
          />
        </div>

        <p aria-live="polite" className="sr-only">
          {t(`Step ${index + 1} of 4: ${current.en}`, `Pasul ${index + 1} din 4: ${current.ro}`)}
        </p>

        <div ref={contentRef} tabIndex={-1} className="mt-8 outline-none md:mt-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={contentKey}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Steps up on phones while the activity status spans the bottom edge. */}
        <MotionPauseToggle
          className={cn(
            "fixed right-4 z-40 h-9 w-9 transition-[bottom] duration-300 sm:bottom-6 md:right-8",
            activity ? "bottom-[4.75rem]" : "bottom-5",
          )}
        />

        <AnimatePresence>
          {activity && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="fixed inset-x-4 bottom-5 z-40 mx-auto flex max-w-md items-center gap-3 rounded-full border border-white/10 bg-[#070a1f]/85 py-2 pl-3 pr-2 shadow-[0_20px_60px_-24px_rgb(0_0_0/0.9)] backdrop-blur-xl"
            >
              <span
                aria-hidden
                className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-[#89cbf6] motion-reduce:animate-none"
              />
              <span className="type-body-sm min-w-0 flex-1 truncate text-white/85">
                {activity.label}
                {activity.detail && <span className="text-white/50"> · {activity.detail}</span>}
              </span>
              {activity.onView && (
                <button
                  type="button"
                  onClick={activity.onView}
                  className="type-button inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[#89cbf6] transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89cbf6]/80"
                >
                  {t("View progress", "Vezi progresul")}
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}

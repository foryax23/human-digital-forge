import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";

import { useMotionPause } from "@/components/landing/motion-pause";
import { prefersReducedMotion } from "@/components/landing/motion-prefs";
import type { ScanStage } from "@/components/scan/scan-state";
import { ScanStepper } from "@/components/scan/ScanStepper";
import { Button, IconButton, MAIN_ID, Spinner } from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** Where a step's own actions render: the right side of the step bar. */
const ActionsSlot = createContext<HTMLElement | null>(null);

/**
 * A step's actions in the step bar (results: "Copiază linkul" + "Descarcă raportul"):
 * render it anywhere inside the step and it portals into the bar, so the actions stay in
 * reach while the page scrolls. Small buttons only; one primary at most.
 */
export function StepBarActions({ children }: { children: ReactNode }) {
  const slot = useContext(ActionsSlot);
  return slot ? createPortal(children, slot) : null;
}

/**
 * Height of the fixed site nav, so the step bar can stick right under it whatever the nav
 * measures at this width. Null until measured (the class fallbacks hold the first paint).
 */
function useNavHeight() {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>("header.fixed");
    if (!nav) return;
    const update = () => setHeight(Math.round(nav.getBoundingClientRect().height));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);
  return height;
}

/** The page-wide motion switch as a quiet 28 px icon button in the bar. */
function PauseButton() {
  const { t } = useI18n();
  const { paused, setPaused } = useMotionPause();
  return (
    <IconButton
      label={
        paused
          ? t("Play the animation", "Pornește animația")
          : t("Pause the animation", "Oprește animația")
      }
      aria-pressed={paused}
      onClick={() => setPaused(!paused)}
    >
      {paused ? <Play /> : <Pause />}
    </IconButton>
  );
}

/**
 * Layout of every scan screen: the step bar sticky under the nav (steps on the left; the
 * step's actions, an inline "Actualizăm analiza…" status and the motion switch on the
 * right), then the current stage 24 px below, cross-faded on change (focus moves to it
 * and the page returns to the top).
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
  /** An edit re-running part of the scan: shown inline in the step bar. */
  activity?: {
    label: string;
    detail?: string;
    onView?: () => void;
    onCancel?: () => void;
  } | null;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement>(null);
  const firstKey = useRef(contentKey);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const navHeight = useNavHeight();
  // Reduced motion: the screen swaps instantly.
  const reduce = Boolean(useReducedMotion());

  useEffect(() => {
    if (contentKey === firstKey.current) return;
    firstKey.current = "";
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    contentRef.current?.focus({ preventScroll: true });
  }, [contentKey]);

  return (
    <MotionConfig reducedMotion="user">
      <ActionsSlot.Provider value={slot}>
        <main
          id={MAIN_ID}
          tabIndex={-1}
          // Nav height + 16 px; the classes hold the first paint until the nav is measured.
          className="container-vx relative z-10 pb-20 pt-[5.5rem] md:pt-[6.25rem]"
          style={navHeight ? { paddingTop: navHeight + 16 } : undefined}
        >
          <h1 className="sr-only">Vortex Scan</h1>

          <div
            className="sticky top-[4.5rem] z-30 bg-background md:top-[5.25rem]"
            style={navHeight ? { top: navHeight } : undefined}
          >
            <div className="flex h-12 items-stretch justify-between gap-3 border-b border-line-1">
              <ScanStepper
                current={stage}
                completed={completed}
                reachable={reachable}
                onSelect={onStageSelect}
              />
              <div className="flex min-w-0 items-center justify-end gap-2">
                {activity ? (
                  <div
                    role="status"
                    className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-fg-2"
                  >
                    <Spinner size={12} className="text-brand-line" />
                    <span className="min-w-0 truncate">
                      {activity.label}
                      {activity.detail ? (
                        <span className="hidden text-fg-3 lg:inline"> {activity.detail}</span>
                      ) : null}
                    </span>
                    {activity.onView ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={activity.onView}
                        className="hidden sm:inline-flex"
                      >
                        {t("View progress", "Vezi progresul")}
                      </Button>
                    ) : null}
                    {activity.onCancel ? (
                      <Button variant="ghost" size="sm" onClick={activity.onCancel}>
                        {t("Cancel", "Anulează")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                <div
                  ref={setSlot}
                  className={cn(
                    "flex items-center gap-2 empty:hidden",
                    activity && "max-sm:hidden",
                  )}
                />
                <PauseButton />
              </div>
            </div>
          </div>

          <div ref={contentRef} tabIndex={-1} className="mt-6 outline-none">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={contentKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.16, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </ActionsSlot.Provider>
    </MotionConfig>
  );
}

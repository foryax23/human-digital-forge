import { motion } from "motion/react";
import { Check } from "lucide-react";

import type { ScanStage } from "@/components/scan/scan-state";
import { SCAN_STAGES } from "@/components/scan/useVortexScan";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * The 01–04 progress header under the nav. Finished stages are buttons that
 * jump back; the current one glows; later ones stay dim until reached.
 */
export function ScanStepper({
  current,
  completed,
  reachable,
  onSelect,
  className,
}: {
  current: ScanStage;
  /** Stages that are finished (they get a mint tick). */
  completed: ScanStage[];
  /** Stages the visitor may jump to. */
  reachable: ScanStage[];
  onSelect: (stage: ScanStage) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const currentIndex = SCAN_STAGES.findIndex((stage) => stage.id === current);
  const currentStage = SCAN_STAGES[currentIndex];

  return (
    <nav aria-label={t("Scan progress", "Progresul scanării")} className={className}>
      <ol className="flex items-center gap-2 sm:gap-3">
        {SCAN_STAGES.map((stage, index) => {
          const isCurrent = stage.id === current;
          const isDone = completed.includes(stage.id) && !isCurrent;
          const canSelect = !isCurrent && reachable.includes(stage.id);
          const number = String(index + 1).padStart(2, "0");
          const label = t(stage.en, stage.ro);

          const content = (
            <>
              <span
                className={cn(
                  "type-label relative grid h-9 w-9 shrink-0 place-items-center rounded-full tabular-nums transition-colors duration-300",
                  isCurrent && "text-white",
                  isDone && "bg-[#5fe3d0]/12 text-[#5fe3d0] ring-1 ring-[#5fe3d0]/40",
                  !isCurrent && !isDone && "ring-1",
                  !isCurrent &&
                    !isDone &&
                    (canSelect ? "text-white/70 ring-white/25" : "text-white/40 ring-white/12"),
                )}
              >
                {isCurrent && (
                  <>
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,#6c63ff,#5b8cf0,#89cbf6,#6c63ff)] p-[1.5px] shadow-[0_0_22px_rgb(108_99_255/0.55)]"
                    >
                      <span className="block h-full w-full rounded-full bg-[#070a1f]" />
                    </span>
                    <span className="relative">{number}</span>
                  </>
                )}
                {isDone && <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />}
                {!isCurrent && !isDone && number}
              </span>
              <span
                className={cn(
                  "type-body-sm whitespace-nowrap transition-colors duration-300",
                  isCurrent
                    ? "font-medium text-white"
                    : isDone || canSelect
                      ? "text-white/75"
                      : "text-white/40",
                  // Phones show only the current stage's name, under the row.
                  "sr-only md:not-sr-only",
                )}
              >
                {label}
              </span>
              {isDone && <span className="sr-only">{t(", done", ", finalizat")}</span>}
            </>
          );

          return (
            <li
              key={stage.id}
              className={cn("flex min-w-0 items-center gap-2 sm:gap-3", index > 0 && "flex-1")}
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className="relative h-px min-w-4 flex-1 overflow-hidden rounded-full bg-white/10"
                >
                  <motion.span
                    className="absolute inset-y-0 left-0 w-full origin-left bg-gradient-to-r from-[#6c63ff] via-[#5b8cf0] to-[#89cbf6]"
                    initial={false}
                    animate={{ scaleX: index <= currentIndex ? 1 : 0 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
              )}
              {canSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(stage.id)}
                  className="group flex items-center gap-2.5 rounded-full pr-1 outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-[#89cbf6]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04061a] [&>span:last-child]:group-hover:text-white"
                >
                  {content}
                </button>
              ) : (
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className="flex items-center gap-2.5"
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="type-label mt-3 text-white/55 md:hidden">
        {t(
          `Step ${currentIndex + 1} of 4 · ${currentStage.en}`,
          `Pasul ${currentIndex + 1} din 4 · ${currentStage.ro}`,
        )}
      </p>
    </nav>
  );
}

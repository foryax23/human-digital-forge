import { Check } from "lucide-react";

import type { ScanStage } from "@/components/scan/scan-state";
import { SCAN_STAGES } from "@/components/scan/useVortexScan";
import { FOCUS_RING } from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** The step names in the bar: short nouns, so all four fit next to the actions. */
const STEP_LABELS: Record<ScanStage, { en: string; ro: string }> = {
  find: { en: "Company", ro: "Firma" },
  analyse: { en: "Analysis", ro: "Analiză" },
  strategy: { en: "Strategy", ro: "Strategie" },
  results: { en: "Results", ro: "Rezultate" },
};

/**
 * The four steps as text in the 48 px step bar: "1 Firma  2 Analiză  3 Strategie
 * 4 Rezultate". The current step is in the text colour with a 2 px cyan underline flush
 * with the bar's bottom edge (the hero indicator's echo); finished steps swap the number
 * for a check and jump back; later steps stay dim. Phones show the current step's name
 * only, the others as numbers.
 */
export function ScanStepper({
  current,
  completed,
  reachable,
  onSelect,
  className,
}: {
  current: ScanStage;
  /** Finished stages (a check replaces the number). */
  completed: ScanStage[];
  /** Stages the visitor may jump to. */
  reachable: ScanStage[];
  onSelect: (stage: ScanStage) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const currentIndex = SCAN_STAGES.findIndex((stage) => stage.id === current);
  const currentLabel = STEP_LABELS[current];

  return (
    <nav
      aria-label={t("Scan progress", "Progresul scanării")}
      className={cn("flex h-full min-w-0", className)}
    >
      <ol className="flex h-full min-w-0 items-stretch gap-5 sm:gap-6">
        {SCAN_STAGES.map((stage, index) => {
          const isCurrent = stage.id === current;
          const isDone = completed.includes(stage.id) && !isCurrent;
          const canSelect = !isCurrent && reachable.includes(stage.id);
          const label = t(STEP_LABELS[stage.id].en, STEP_LABELS[stage.id].ro);

          const content = (
            <>
              {isDone ? (
                <>
                  {/* The check replaces the number from 640 px up; phones keep the number. */}
                  <Check
                    aria-hidden
                    strokeWidth={2.25}
                    className="hidden size-3 shrink-0 text-fg-3 sm:block"
                  />
                  <span aria-hidden className="type-pnum text-[0.8125rem] sm:hidden">
                    {index + 1}
                  </span>
                </>
              ) : (
                <span aria-hidden className="type-pnum text-[0.8125rem]">
                  {index + 1}
                </span>
              )}
              <span
                className={cn(
                  "whitespace-nowrap text-sm font-medium",
                  // Phones name the current step only.
                  !isCurrent && "sr-only sm:not-sr-only",
                )}
              >
                {label}
              </span>
              {isDone ? <span className="sr-only">{t(", done", ", finalizat")}</span> : null}
              {isCurrent ? (
                <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-echo" />
              ) : null}
            </>
          );

          const base = "relative flex h-full items-center gap-1.5";
          return (
            <li key={stage.id} className="flex">
              {canSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(stage.id)}
                  className={cn(
                    base,
                    "cursor-pointer rounded-sm text-fg-2 transition-colors duration-150 hover:text-fg",
                    FOCUS_RING,
                    "focus-visible:outline-offset-[-2px]",
                  )}
                >
                  {content}
                </button>
              ) : (
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  aria-disabled={isCurrent ? undefined : true}
                  className={cn(base, isCurrent ? "text-fg" : "text-fg-4")}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="sr-only">
        {t(
          `Step ${currentIndex + 1} of 4: ${currentLabel.en}`,
          `Pasul ${currentIndex + 1} din 4: ${currentLabel.ro}`,
        )}
      </p>
    </nav>
  );
}

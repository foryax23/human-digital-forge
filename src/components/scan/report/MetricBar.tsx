import { cn } from "@/lib/utils";
import { scoreTier, useTierLabel } from "./tiers";

/**
 * One 0–100 score as a table row: label 13 px, a 2 px neutral bar, the value in aligned
 * figures. No colour, no count-up and no fill animation: the number is the message.
 */
export function MetricBar({
  label,
  value,
  hint,
  highlight = false,
  className,
}: {
  label: string;
  value: number;
  /** One 12 px line under the row (the source, e.g. "Lighthouse, mobil"). */
  hint?: string;
  /** Brighter fill, e.g. for "Tu" in a comparison. */
  highlight?: boolean;
  className?: string;
}) {
  const tierLabel = useTierLabel();
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const tier = tierLabel(scoreTier(clamped));

  return (
    <div className={cn("min-w-0", className)}>
      <div className="grid min-h-8 grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2rem] items-center gap-3">
        <span className="min-w-0 truncate text-[0.8125rem] leading-[1.35] text-fg-2">{label}</span>
        <span aria-hidden className="relative h-0.5 overflow-hidden bg-line-1">
          <span
            className={cn("absolute inset-y-0 left-0", highlight ? "bg-fg" : "bg-fg-2")}
            style={{ width: `${clamped}%` }}
          />
        </span>
        <span className="type-num text-right text-[0.8125rem] text-fg">
          <span className="sr-only">{tier.label}, </span>
          {clamped}
        </span>
      </div>
      {hint ? <p className="text-xs leading-[1.45] text-fg-3">{hint}</p> : null}
    </div>
  );
}

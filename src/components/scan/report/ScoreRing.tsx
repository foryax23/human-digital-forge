import type { ReactNode } from "react";

import { Status } from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { scoreTier, useTierLabel } from "./tiers";

/**
 * A 0–100 score as a figure: label, the number in aligned Space Grotesk at 40 px with
 * "/100", then the tier as a status square and a word (Bun / Acceptabil / Slab). It
 * replaced the animated ring: no arc, no glow, no count-up.
 */
export function ScoreFigure({
  value,
  label,
  sub,
  className,
}: {
  value: number;
  /** "Scorul site-ului". */
  label: ReactNode;
  /** One 12 px line under the tier (what was checked). */
  sub?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const tierLabel = useTierLabel();
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const tier = tierLabel(scoreTier(clamped));

  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[0.8125rem] font-medium leading-[1.35] text-fg-2">{label}</p>
      <p className="mt-1 flex items-baseline gap-1 text-fg">
        <span className="type-num text-[2.5rem] font-semibold leading-none">{clamped}</span>
        <span className="text-[0.9375rem] text-fg-3">
          /100<span className="sr-only">{t(" points", " de puncte")}</span>
        </span>
      </p>
      <Status tone={tier.tone} className="mt-2">
        {tier.label}
      </Status>
      {sub ? <p className="mt-1 text-xs leading-[1.45] text-fg-3">{sub}</p> : null}
    </div>
  );
}

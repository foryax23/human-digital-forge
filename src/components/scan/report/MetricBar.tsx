import { useRef } from "react";
import { motion, useInView } from "motion/react";

import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";
import { EASE_OUT, useScanMotion } from "./motion";
import { scoreTier, useTierLabel } from "./tiers";

/** Labelled 0–100 bar that fills when it scrolls into view. */
export function MetricBar({
  label,
  value,
  hint,
  delay = 0,
  highlight = false,
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  delay?: number;
  /** Brighter fill, e.g. for "you" in a comparison. */
  highlight?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -30px 0px" });
  const { reduce } = useScanMotion();
  const tierLabel = useTierLabel();
  const clamped = Math.max(0, Math.min(100, value));
  const tier = tierLabel(scoreTier(clamped));
  const TierIcon = tier.icon;

  return (
    <div ref={ref} className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-body-sm min-w-0 truncate text-white/80">{label}</span>
        <span className="type-body-sm flex shrink-0 items-center gap-1.5">
          <TierIcon aria-hidden className={cn("h-3.5 w-3.5", tier.text)} />
          <span className="sr-only">{tier.label}: </span>
          <AnimatedNumber
            value={clamped}
            format={(v) => String(Math.round(v))}
            delay={delay}
            className="font-semibold text-white"
          />
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden>
        <motion.div
          className={cn(
            "h-full rounded-full",
            highlight
              ? "bg-gradient-to-r from-[#6c63ff] via-[#5b8cf0] to-[#89cbf6] shadow-[0_0_14px_rgb(108_99_255/0.6)]"
              : "bg-gradient-to-r from-[#6c63ff]/85 to-[#5b8cf0]/85",
          )}
          initial={{ width: reduce ? `${clamped}%` : "0%" }}
          animate={{ width: inView || reduce ? `${clamped}%` : "0%" }}
          transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : delay, ease: EASE_OUT }}
        />
      </div>
      {hint && <p className="type-micro mt-1.5 text-white/45">{hint}</p>}
    </div>
  );
}

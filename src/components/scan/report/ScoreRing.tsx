import { useId, useRef } from "react";
import { motion, useInView } from "motion/react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";
import { EASE_OUT, useScanMotion } from "./motion";
import { scoreTier, useTierLabel } from "./tiers";

/**
 * Circular 0–100 score: the arc draws in and the number counts up when it
 * scrolls into view; a tier label (Good / Fair / Needs work) sits under it.
 */
export function ScoreRing({
  value,
  size = 168,
  stroke = 12,
  caption,
  showTier = true,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  /** Small text under the number, e.g. "Website score". */
  caption?: string;
  showTier?: boolean;
  className?: string;
}) {
  const { lang } = useI18n();
  const tierLabel = useTierLabel();
  const { reduce } = useScanMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const gradientId = `ring-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const tier = tierLabel(scoreTier(clamped));
  const TierIcon = tier.icon;
  const big = size >= 140;

  return (
    <div ref={ref} className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Soft glow behind the ring. */}
        <span aria-hidden className="absolute inset-[18%] rounded-full bg-[#6c63ff]/25 blur-2xl" />
        <svg
          aria-hidden
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="relative -rotate-90"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6c63ff" />
              <stop offset="55%" stopColor="#5b8cf0" />
              <stop offset="100%" stopColor="#89cbf6" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(255 255 255 / 0.08)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            initial={{ pathLength: reduce ? clamped / 100 : 0 }}
            animate={{ pathLength: inView || reduce ? Math.max(clamped / 100, 0.001) : 0 }}
            transition={{ duration: reduce ? 0 : 1.4, ease: EASE_OUT, delay: 0.1 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("tabular-nums text-white", big ? "type-h2" : "type-h3")}>
            <AnimatedNumber value={clamped} format={(v) => String(Math.round(v))} delay={0.1} />
          </span>
          <span className="type-tech mt-1 text-white/45">/100</span>
          {caption && big && (
            <span className="type-tech mt-1.5 max-w-[6.5rem] text-balance text-center text-white/55">
              {caption}
            </span>
          )}
        </div>
      </div>
      {showTier && (
        <span
          className={cn(
            "type-label mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1",
            tier.text,
          )}
        >
          <TierIcon aria-hidden className="h-3.5 w-3.5" />
          {tier.label}
          <span className="sr-only">
            {lang === "ro"
              ? `, scor ${Math.round(clamped)} din 100`
              : `, ${Math.round(clamped)} out of 100`}
          </span>
        </span>
      )}
    </div>
  );
}

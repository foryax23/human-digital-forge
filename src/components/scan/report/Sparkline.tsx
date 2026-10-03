import { useId, useRef } from "react";
import { motion, useInView } from "motion/react";

import { cn } from "@/lib/utils";
import { EASE_OUT, useScanMotion } from "./motion";

const W = 132;
const H = 44;
const PAD = 4;

function toPoints(values: number[], max: number) {
  const n = Math.max(values.length - 1, 1);
  return values.map((value, i) => [
    PAD + (i / n) * (W - PAD * 2),
    H - PAD - (max > 0 ? value / max : 0) * (H - PAD * 2),
  ]);
}

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
function smoothPath(points: number[][]) {
  if (!points.length) return "";
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * Decorative trend line with an optional low–high band; draws itself in when
 * it scrolls into view. The numbers it illustrates are always stated in text
 * next to it, so it is hidden from assistive tech.
 */
export function Sparkline({
  values,
  low,
  high,
  className,
  delay = 0,
}: {
  values: number[];
  low?: number[];
  high?: number[];
  className?: string;
  delay?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20px 0px" });
  const { reduce } = useScanMotion();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const max = Math.max(...values, ...(high ?? []), 1) * 1.08;
  const line = toPoints(values, max);
  const lastPoint = line[line.length - 1];

  let band = "";
  if (low && high && low.length === high.length && low.length > 1) {
    const top = toPoints(high, max);
    const bottom = toPoints(low, max).reverse();
    band = `${smoothPath(top)} L${bottom.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L")} Z`;
  }

  const drawn = inView || reduce;

  return (
    <svg
      ref={ref}
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-11 w-[132px] overflow-visible", className)}
    >
      <defs>
        <linearGradient id={`spark-line-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6c63ff" />
          <stop offset="60%" stopColor="#5b8cf0" />
          <stop offset="100%" stopColor="#89cbf6" />
        </linearGradient>
        <linearGradient id={`spark-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b8cf0" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#5b8cf0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1={PAD}
        x2={W - PAD}
        y1={H - PAD}
        y2={H - PAD}
        stroke="rgb(255 255 255 / 0.1)"
        strokeDasharray="2 4"
      />
      {band && (
        <motion.path
          d={band}
          fill={`url(#spark-fill-${id})`}
          initial={{ opacity: reduce ? 1 : 0 }}
          animate={{ opacity: drawn ? 1 : 0 }}
          transition={{ duration: 0.8, delay: delay + 0.5 }}
        />
      )}
      <motion.path
        d={smoothPath(line)}
        fill="none"
        stroke={`url(#spark-line-${id})`}
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: drawn ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 1.2, delay, ease: EASE_OUT }}
      />
      {lastPoint && (
        <motion.circle
          cx={lastPoint[0]}
          cy={lastPoint[1]}
          r={3.5}
          fill="#89cbf6"
          stroke="#070a1f"
          strokeWidth={2}
          initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.4 }}
          animate={{ opacity: drawn ? 1 : 0, scale: drawn ? 1 : 0.4 }}
          transition={{ duration: 0.35, delay: reduce ? 0 : delay + 1.05 }}
        />
      )}
    </svg>
  );
}

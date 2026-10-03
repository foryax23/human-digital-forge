import type { ProjectionPoint } from "@/lib/scan/types";
import { midpoint } from "./format";

/**
 * Month where cumulative savings first catch up with cumulative cost
 * (midpoints, interpolated between months). Months before anything is spent
 * or saved don't count, so an idle first month never reads as "paid back".
 */
export function findPayback(points: ProjectionPoint[]): number | null {
  let prev: { month: number; gap: number } | null = null;
  for (const point of points) {
    const saved = midpoint(point.cumulativeSavingsRon);
    const spent = midpoint(point.cumulativeCostRon);
    if (spent <= 0 && saved <= 0) continue;
    const gap = saved - spent;
    if (gap >= 0) {
      if (!prev) return point.month;
      return prev.month + (-prev.gap / (gap - prev.gap)) * (point.month - prev.month);
    }
    prev = { month: point.month, gap };
  }
  return null;
}

/** Points up to and including `horizon` months, in month order. */
export function projectionUntil(points: ProjectionPoint[], horizon: number): ProjectionPoint[] {
  return points.filter((p) => p.month >= 1 && p.month <= horizon).sort((a, b) => a.month - b.month);
}

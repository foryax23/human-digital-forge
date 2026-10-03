import type { ProjectionPoint } from "@/lib/scan/types";
import { crossingMonth } from "@/lib/scan/blueprint/economics";

/**
 * Where cumulative value first catches up with cumulative cost (central
 * values, interpolated between months), for drawing the chart's break-even
 * line. The month a visitor reads is `displayPlan(blueprint).breakEven.month`
 * (the first month-end in profit), never this interpolated value.
 */
export function findPayback(points: ProjectionPoint[]): number | null {
  return crossingMonth(points);
}

/** Points up to and including `horizon` months, in month order. */
export function projectionUntil(points: ProjectionPoint[], horizon: number): ProjectionPoint[] {
  return points.filter((p) => p.month >= 1 && p.month <= horizon).sort((a, b) => a.month - b.month);
}

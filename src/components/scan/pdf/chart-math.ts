import type { ProjectionPoint } from "@/lib/scan/types";

/* Geometry and projection maths shared by the PDF charts. */

/* ---------------------------------------------------------------- geometry */

/** Point on a circle; 0° is 12 o'clock and angles run clockwise. */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/** Rounds coordinates so path strings stay short. */
export const f = (n: number) => Number(n.toFixed(2));

/** A thick arc as a closed shape, optionally with round caps. */
export function arcBand(
  cx: number,
  cy: number,
  r: number,
  thickness: number,
  start: number,
  end: number,
  roundCaps = true,
): string {
  const sweep = Math.min(359.99, Math.max(0.01, end - start));
  const stop = start + sweep;
  const ro = r + thickness / 2;
  const ri = r - thickness / 2;
  const cap = thickness / 2;
  const large = sweep > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, ro, start);
  const [x2, y2] = polar(cx, cy, ro, stop);
  const [x3, y3] = polar(cx, cy, ri, stop);
  const [x4, y4] = polar(cx, cy, ri, start);
  const endCap = roundCaps
    ? `A ${f(cap)} ${f(cap)} 0 0 1 ${f(x3)} ${f(y3)}`
    : `L ${f(x3)} ${f(y3)}`;
  const startCap = roundCaps
    ? `A ${f(cap)} ${f(cap)} 0 0 1 ${f(x1)} ${f(y1)}`
    : `L ${f(x1)} ${f(y1)}`;
  return [
    `M ${f(x1)} ${f(y1)}`,
    `A ${f(ro)} ${f(ro)} 0 ${large} 1 ${f(x2)} ${f(y2)}`,
    endCap,
    `A ${f(ri)} ${f(ri)} 0 ${large} 0 ${f(x4)} ${f(y4)}`,
    startCap,
    "Z",
  ].join(" ");
}

/** First (fractional) month where savings catch up with cost, by linear interpolation. */
export function breakEvenMonth(
  points: ProjectionPoint[],
  savings: (point: ProjectionPoint) => number,
  cost: (point: ProjectionPoint) => number,
): number | null {
  let previous: { month: number; diff: number } | null = null;
  for (const point of points) {
    const saved = savings(point);
    const diff = saved - cost(point);
    // Nothing saved yet is not a break-even, even when nothing has been spent either.
    if (diff >= 0 && saved > 0) {
      if (!previous) return point.month;
      const t = -previous.diff / (diff - previous.diff);
      return previous.month + t * (point.month - previous.month);
    }
    if (diff < 0) previous = { month: point.month, diff };
  }
  return null;
}

/** Position of parameter `t` (radians) on a rotated ellipse. */
export function orbitPoint(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotateDeg: number,
  t: number,
): [number, number] {
  const ex = rx * Math.cos(t);
  const ey = ry * Math.sin(t);
  const a = (rotateDeg * Math.PI) / 180;
  return [cx + ex * Math.cos(a) - ey * Math.sin(a), cy + ex * Math.sin(a) + ey * Math.cos(a)];
}

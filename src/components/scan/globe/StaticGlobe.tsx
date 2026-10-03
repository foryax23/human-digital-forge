import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { ARC_HUBS, landDots, toVector, type LatLon } from "./geo";

/*
 * SVG stand-in for the 3D globe (tablets, reduced motion, no WebGL, and the
 * first paint before three.js loads): the same dotted Earth, orthographic,
 * turned to the same pose, with static arcs and the home marker. Neutral dots on
 * a solid disc; no halo or rim glow.
 */

const SIZE = 400;
const CENTRE = SIZE / 2;
/** Globe radius as a share of its square box; the 3D camera is set to match. */
export const GLOBE_RADIUS_RATIO = 0.3;
const R = SIZE * GLOBE_RADIUS_RATIO;

type Rotated = { x: number; y: number; z: number };

/** Applies the 3D scene's yaw (home longitude) then tilt (home latitude − 16°). */
function makeProjector(home: LatLon) {
  const yaw = (-home[1] * Math.PI) / 180;
  const tilt = ((home[0] - 16) * Math.PI) / 180;
  const [cy, sy, ct, st] = [Math.cos(yaw), Math.sin(yaw), Math.cos(tilt), Math.sin(tilt)];
  return ([x, y, z]: [number, number, number]): Rotated => {
    const x1 = cy * x + sy * z;
    const z1 = -sy * x + cy * z;
    return { x: x1, y: ct * y - st * z1, z: st * y + ct * z1 };
  };
}

const fmt = (n: number) => Math.round(n * 10) / 10;

function dotsPath(points: Rotated[]) {
  return points.map((p) => `M${fmt(CENTRE + p.x * R)} ${fmt(CENTRE - p.y * R)}h0`).join("");
}

export function StaticGlobe({
  home,
  done = false,
  showDots = true,
  className,
}: {
  home: LatLon;
  done?: boolean;
  /** Off during SSR/hydration to keep the server markup light. */
  showDots?: boolean;
  className?: string;
}) {
  const shape = useMemo(() => {
    if (!showDots) return null;
    const project = makeProjector(home);
    const front: Rotated[] = [];
    const limb: Rotated[] = [];
    const romania: Rotated[] = [];
    for (const dot of landDots(2)) {
      const p = project(toVector(dot.lat, dot.lon));
      if (p.z <= 0.02) continue;
      if (dot.romania) romania.push(p);
      else if (p.z < 0.35) limb.push(p);
      else front.push(p);
    }
    // Romania is small at 2°, so add its 1° dots for a readable highlight.
    for (const dot of landDots(1)) {
      if (!dot.romania) continue;
      const p = project(toVector(dot.lat, dot.lon));
      if (p.z > 0.02) romania.push(p);
    }

    const from = toVector(home[0], home[1]);
    const arcs = ARC_HUBS.slice(0, 5).map((hub) => {
      const to = toVector(hub[0], hub[1]);
      const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
      const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
      const lift = 0.04 + angle * 0.45;
      const parts: string[] = [];
      for (let i = 0; i <= 32; i++) {
        const t = i / 32;
        const a = Math.sin((1 - t) * angle) / Math.sin(angle);
        const b = Math.sin(t * angle) / Math.sin(angle);
        const k = 1 + lift * Math.sin(Math.PI * t);
        const p = project([
          (from[0] * a + to[0] * b) * k,
          (from[1] * a + to[1] * b) * k,
          (from[2] * a + to[2] * b) * k,
        ]);
        parts.push(`${i ? "L" : "M"}${fmt(CENTRE + p.x * R)} ${fmt(CENTRE - p.y * R)}`);
      }
      return parts.join("");
    });

    const homePoint = project(from);
    return {
      front: dotsPath(front),
      limb: dotsPath(limb),
      romania: dotsPath(romania),
      arcs,
      home: { x: CENTRE + homePoint.x * R, y: CENTRE - homePoint.y * R },
    };
  }, [home, showDots]);

  // One accent: Romania and the home marker in the brand line; the rest is neutral.
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      data-done={done || undefined}
      className={cn("h-full w-full overflow-visible", className)}
    >
      <circle cx={CENTRE} cy={CENTRE} r={R} className="fill-s1 stroke-line-2" strokeWidth="1" />

      {shape && (
        <>
          <path
            d={shape.limb}
            className="stroke-fg-4"
            strokeWidth="1.7"
            strokeLinecap="round"
            opacity="0.6"
          />
          <path d={shape.front} className="stroke-fg-3" strokeWidth="2" strokeLinecap="round" />
          <path
            d={shape.romania}
            className="stroke-brand-line"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {shape.arcs.map((d, i) => (
            <path key={i} d={d} fill="none" className="stroke-line-3" strokeWidth="0.9" />
          ))}
          <g transform={`translate(${fmt(shape.home.x)} ${fmt(shape.home.y)})`}>
            <circle r="9" fill="none" className="stroke-brand-line" strokeOpacity="0.45" />
            <circle r="4" className="fill-brand-line" />
          </g>
        </>
      )}
    </svg>
  );
}

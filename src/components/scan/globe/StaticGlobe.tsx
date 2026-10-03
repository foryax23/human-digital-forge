import { useId, useMemo } from "react";

import { cn } from "@/lib/utils";
import { ARC_HUBS, landDots, toVector, type LatLon } from "./geo";

/*
 * SVG stand-in for the 3D globe (phones, reduced motion, no WebGL, and the
 * first paint before three.js loads): the same dotted Earth, orthographic,
 * turned to the same pose, with static arcs and the home marker.
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
  const id = useId().replace(/:/g, "");

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

  const accent = done ? "#5fe3d0" : "#89cbf6";

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      className={cn("h-full w-full overflow-visible", className)}
    >
      <defs>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset={`${(R / (R * 1.24)) * 100 - 6}%`} stopColor="#6c63ff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#5b8cf0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-body`} cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#0b1033" />
          <stop offset="70%" stopColor="#04061a" />
          <stop offset="100%" stopColor="#1b1957" />
        </radialGradient>
        <linearGradient id={`${id}-dots`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#6c63ff" />
          <stop offset="55%" stopColor="#5b8cf0" />
          <stop offset="100%" stopColor="#89cbf6" />
        </linearGradient>
        <linearGradient id={`${id}-arc`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#89cbf6" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#6c63ff" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      <circle cx={CENTRE} cy={CENTRE} r={R * 1.24} fill={`url(#${id}-halo)`} />
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={R}
        fill={`url(#${id}-body)`}
        stroke="#6c63ff"
        strokeOpacity="0.35"
      />

      {shape && (
        <>
          <path
            d={shape.limb}
            stroke={`url(#${id}-dots)`}
            strokeWidth="1.7"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d={shape.front}
            stroke={`url(#${id}-dots)`}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path d={shape.romania} stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
          {shape.arcs.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={`url(#${id}-arc)`} strokeWidth="0.9" />
          ))}
          <g transform={`translate(${fmt(shape.home.x)} ${fmt(shape.home.y)})`}>
            <circle r="9" fill="none" stroke={accent} strokeOpacity="0.45" />
            <circle r="4" fill={accent} />
          </g>
        </>
      )}
    </svg>
  );
}

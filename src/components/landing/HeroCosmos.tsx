import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { HlsVideo } from "./HlsVideo";
import { SWIRL_VIDEO } from "./media";

/*
 * Deep-space backdrop for the search-first hero: the Vortex swirl as the
 * vortex, a nebula ring around the copy, a star field, drifting asteroids and
 * two small planets. It approximates the hero mockup until a clean render of
 * that scene is supplied (pass it as `still`). Everything is generated from a
 * fixed seed, so server and client render identical markup.
 */

/** Small deterministic PRNG (mulberry32). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seeded(2026);
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Static stars as one element's box-shadows (cheap), plus a few twinkling ones. */
const STAR_SHADOWS = Array.from({ length: 160 }, () => {
  const x = round(rand() * 100);
  const y = round(rand() * 100);
  const alpha = round(0.25 + rand() * 0.6);
  return `${x}vw ${y}vh 0 ${rand() > 0.85 ? 1 : 0}px rgb(255 255 255 / ${alpha})`;
}).join(", ");

const TWINKLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: round(rand() * 100),
  top: round(rand() * 100),
  size: rand() > 0.7 ? 2 : 1.5,
  delay: round(rand() * 3.6),
}));

/** Irregular rock outline: a jittered polygon in a -50..50 box. */
function rockPath(r: () => number) {
  const points = 9 + Math.floor(r() * 5);
  const coords = Array.from({ length: points }, (_, i) => {
    const angle = (i / points) * Math.PI * 2;
    const radius = 34 + r() * 14;
    return `${round(Math.cos(angle) * radius, 1)},${round(Math.sin(angle) * radius, 1)}`;
  });
  return `M${coords.join(" L")} Z`;
}

type Rock = {
  id: number;
  left: string;
  top: string;
  size: number;
  /** Out-of-focus foreground rocks are larger, blurred and darker. */
  blur: number;
  opacity: number;
  path: string;
  rotate: number;
  drift: CSSProperties;
  delay: number;
};

const ROCK_SPOTS: Array<[left: number, top: number, size: number, blur: number]> = [
  // foreground, out of focus, in the corners
  [-4, 74, 230, 6],
  [86, 80, 260, 7],
  [-6, 8, 170, 5],
  [92, 2, 120, 4],
  // mid-field, around the ring
  [14, 30, 46, 0],
  [21, 58, 34, 0],
  [8, 46, 26, 0],
  [79, 26, 40, 0],
  [86, 54, 52, 0],
  [74, 70, 30, 0],
  [30, 82, 22, 0],
  [66, 12, 18, 0],
  [40, 16, 14, 0],
  [58, 88, 26, 0],
];

const ROCKS: Rock[] = ROCK_SPOTS.map(([left, top, size, blur], id) => ({
  id,
  left: `${left}%`,
  top: `${top}%`,
  size,
  blur,
  opacity: blur ? 0.9 : round(0.75 + rand() * 0.25),
  path: rockPath(rand),
  rotate: Math.floor(rand() * 360),
  drift: {
    "--drift-x": `${Math.round((rand() - 0.5) * 30)}px`,
    "--drift-y": `${Math.round((rand() - 0.5) * 30)}px`,
    "--drift-r": `${Math.round((rand() - 0.5) * 16)}deg`,
  } as CSSProperties,
  delay: round(-rand() * 26),
}));

function Asteroid({ rock }: { rock: Rock }) {
  const gradientId = `rock-shade-${rock.id}`;
  const rimId = `rock-rim-${rock.id}`;
  return (
    <span
      className="animate-asteroid-drift absolute block"
      style={{
        left: rock.left,
        top: rock.top,
        width: rock.size,
        height: rock.size,
        filter: rock.blur ? `blur(${rock.blur}px)` : undefined,
        opacity: rock.opacity,
        animationDelay: `${rock.delay}s`,
        ...rock.drift,
      }}
    >
      <svg
        viewBox="-50 -50 100 100"
        className="h-full w-full"
        style={{ rotate: `${rock.rotate}deg` }}
      >
        <defs>
          <radialGradient id={gradientId} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#2a2640" />
            <stop offset="55%" stopColor="#121020" />
            <stop offset="100%" stopColor="#05040b" />
          </radialGradient>
          <linearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a99bff" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#7b6cf6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={rock.path} fill={`url(#${gradientId})`} />
        <path d={rock.path} fill="none" stroke={`url(#${rimId})`} strokeWidth="2.5" />
        <circle cx="-8" cy="6" r="5" fill="#000" opacity="0.25" />
        <circle cx="12" cy="-10" r="3" fill="#000" opacity="0.2" />
      </svg>
    </span>
  );
}

export function HeroCosmos({ still, className }: { still?: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-[#00020f]", className)}
    >
      {still ? (
        <img src={still} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          {/* Nebula haze in the corners. */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: [
                "radial-gradient(40% 35% at 12% 22%, rgb(86 72 200 / 0.28), transparent 70%)",
                "radial-gradient(38% 34% at 88% 30%, rgb(70 110 220 / 0.22), transparent 70%)",
                "radial-gradient(45% 40% at 70% 85%, rgb(170 90 210 / 0.18), transparent 70%)",
              ].join(", "),
            }}
          />

          {/* The vortex: the swirl stretched into a ring around the copy, fading
              into open space towards the edges. */}
          <div className="absolute left-1/2 top-[47%] aspect-square w-[max(96vw,96vh)] -translate-x-1/2 -translate-y-1/2 scale-x-[1.32] [mask-image:radial-gradient(closest-side,black_45%,rgb(0_0_0/0.55)_68%,transparent_92%)]">
            <HlsVideo
              src={SWIRL_VIDEO.hls}
              fallbackSrc={SWIRL_VIDEO.mp4}
              poster={SWIRL_VIDEO.poster}
              className="h-full w-full object-cover opacity-80 mix-blend-screen brightness-[0.8] saturate-[0.9]"
            />
          </div>

          {/* The dark eye behind the copy and a soft glow on the ring's rim. */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: [
                "radial-gradient(ellipse 27% 31% at 50% 47%, rgb(0 2 15 / 0.97) 0%, rgb(0 2 15 / 0.88) 55%, rgb(0 2 15 / 0.45) 82%, transparent 100%)",
                "radial-gradient(ellipse 44% 42% at 50% 47%, transparent 58%, rgb(132 108 255 / 0.16) 70%, rgb(110 150 255 / 0.08) 78%, transparent 88%)",
              ].join(", "),
            }}
          />

          {/* Stars. */}
          <span
            className="absolute left-0 top-0 h-px w-px rounded-full"
            style={{ boxShadow: STAR_SHADOWS }}
          />
          {TWINKLES.map((star) => (
            <span
              key={star.id}
              className="animate-twinkle absolute rounded-full bg-white"
              style={{
                left: `${star.left}%`,
                top: `${star.top}%`,
                width: star.size,
                height: star.size,
                animationDelay: `${star.delay}s`,
              }}
            />
          ))}

          {/* Planets. */}
          <span className="absolute right-[19%] top-[13%] block h-7 w-7 rounded-full bg-[radial-gradient(circle_at_32%_30%,#6d6b85,#1b1a2a_58%,#06060d)] shadow-[inset_-3px_-3px_6px_rgb(0_0_0/0.6),0_0_12px_rgb(150_140_255/0.25)]" />
          <span className="absolute right-[2%] top-[47%] block h-16 w-16 rounded-full bg-[radial-gradient(circle_at_30%_28%,#7b7896,#22203a_55%,#05050c)] shadow-[inset_-6px_-6px_12px_rgb(0_0_0/0.65),0_0_24px_rgb(150_140_255/0.25)] md:h-20 md:w-20" />

          {/* Asteroids. */}
          {ROCKS.map((rock) => (
            <Asteroid key={rock.id} rock={rock} />
          ))}
        </>
      )}

      {/* Vignette and a fade into the page below. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_75%_at_50%_45%,transparent_55%,rgb(0_2_15/0.85)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

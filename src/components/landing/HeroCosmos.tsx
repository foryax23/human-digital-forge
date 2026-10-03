import { cn } from "@/lib/utils";
import { AsciiVortexBackground, type AsciiVortexState, type OrbitSector } from "./ascii";

/*
 * Deep-space backdrop for the search-first hero: the Vortex swirl as a ring
 * around the centred copy over a faint nebula haze and a few quiet stars.
 * With `hero`, the vortex's eye sits on the point set by VORTEX_CENTRE and a
 * dark eye keeps the copy and the search legible. The stars come from a fixed
 * seed, so server and client render identical markup.
 */

/**
 * Where the vortex's eye sits inside the hero, as CSS variables: under the
 * centred column (higher on phones, where the column starts under the nav).
 * Put it on the element that contains HeroCosmos.
 */
export const VORTEX_CENTRE = "[--vortex-x:50%] [--vortex-y:44%] lg:[--vortex-y:50%]";

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

/** Static stars as one element's box-shadows: few and faint, so they stay behind the glyphs. */
const STAR_SHADOWS = Array.from({ length: 70 }, () => {
  const x = round(rand() * 100);
  const y = round(rand() * 100);
  const alpha = round(0.12 + rand() * 0.28);
  return `${x}vw ${y}vh 0 0 rgb(220 226 255 / ${alpha})`;
}).join(", ");

/**
 * `hero` lays the scene out for the homepage hero (the vortex centred on
 * VORTEX_CENTRE behind the copy); `active` (the hero search is focused) lights
 * the vortex's rim a little brighter. `asciiState`, `sector`, `typingPulse` and
 * `progress` drive the ASCII vortex (see AsciiVortexBackground); the rim glow
 * follows `asciiState` too, and contracts while the hero is scanning.
 */
export function HeroCosmos({
  still,
  hero = false,
  active = false,
  asciiState,
  sector,
  typingPulse,
  progress,
  className,
}: {
  still?: string;
  hero?: boolean;
  active?: boolean;
  asciiState?: AsciiVortexState;
  sector?: OrbitSector | null;
  typingPulse?: number;
  progress?: number;
  className?: string;
}) {
  const look = asciiState ?? (active ? "focus" : "idle");

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
                "radial-gradient(40% 35% at 12% 22%, rgb(86 72 200 / 0.2), transparent 70%)",
                "radial-gradient(38% 34% at 88% 30%, rgb(70 110 220 / 0.16), transparent 70%)",
                "radial-gradient(45% 40% at 70% 85%, rgb(120 90 220 / 0.12), transparent 70%)",
              ].join(", "),
            }}
          />

          {/* The vortex: the swirl stretched into a ring around the copy. */}
          <AsciiVortexBackground
            variant={hero ? "hero" : "backdrop"}
            state={look}
            sector={sector}
            typingPulse={typingPulse}
            progress={progress}
          />
          {hero && (
            // Rim glow: brighter while the visitor is searching, drawn in towards
            // the eye on submit.
            <div
              className={cn(
                "absolute aspect-square -translate-x-1/2 -translate-y-1/2 scale-x-[1.32] left-[var(--vortex-x,50%)] top-[var(--vortex-y,47%)] w-[max(110vw,96vh)] lg:w-[max(92vw,100vh)]",
              )}
            >
              <div
                className={cn(
                  "absolute inset-[6%] rounded-full bg-[radial-gradient(closest-side,transparent_56%,rgb(132_108_255/0.2)_70%,rgb(110_150_255/0.1)_80%,transparent_94%)] transition-[opacity,scale] duration-700 ease-out",
                  look === "idle" && "opacity-55",
                  (look === "focus" || look === "typing") && "opacity-100",
                  look === "scanning" && "scale-[0.86] opacity-80",
                )}
              />
            </div>
          )}

          {hero ? (
            // The dark eye behind the centred copy: wide on phones, where the
            // copy spans the screen; an oval around the column from lg up.
            <div
              className="absolute inset-0 [--eye-h:40%] [--eye-w:64%] lg:[--eye-h:40%] lg:[--eye-w:36%]"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse var(--eye-w) var(--eye-h) at var(--vortex-x, 50%) var(--vortex-y, 47%), rgb(0 2 15 / 0.94) 0%, rgb(0 2 15 / 0.84) 52%, rgb(0 2 15 / 0.42) 80%, transparent 100%)",
              }}
            />
          ) : (
            // The dark eye behind centred copy and a soft glow on the ring's rim.
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: [
                  "radial-gradient(ellipse 27% 31% at 50% 47%, rgb(0 2 15 / 0.97) 0%, rgb(0 2 15 / 0.88) 55%, rgb(0 2 15 / 0.45) 82%, transparent 100%)",
                  "radial-gradient(ellipse 44% 42% at 50% 47%, transparent 58%, rgb(132 108 255 / 0.16) 70%, rgb(110 150 255 / 0.08) 78%, transparent 88%)",
                ].join(", "),
              }}
            />
          )}

          {/* Stars. */}
          <span
            className="absolute left-0 top-0 h-px w-px rounded-full"
            style={{ boxShadow: STAR_SHADOWS }}
          />
        </>
      )}

      {/* Vignette and a fade into the page below. */}
      <div
        className={cn(
          "absolute inset-0 bg-[radial-gradient(ellipse_80%_75%_at_50%_45%,transparent_55%,rgb(0_2_15/0.85)_100%)]",
          hero &&
            "bg-[radial-gradient(ellipse_80%_75%_at_var(--vortex-x,50%)_var(--vortex-y,45%),transparent_55%,rgb(0_2_15/0.85)_100%)]",
        )}
      />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

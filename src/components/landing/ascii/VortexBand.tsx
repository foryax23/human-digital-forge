import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { AsciiVortexBackground } from "./AsciiVortexBackground";

/** Mount the band once it is this close to the viewport... */
const NEAR = "600px 0px";
/** ...and tear it down (WebGL context, video decoder) once it is this far away again. */
const FAR = "1600px 0px";

/**
 * The quiet ASCII vortex band behind the homepage footer: the hero's engine with
 * the `footer` variant. It renders nothing until the footer comes near and is torn
 * down again far off screen, so the page never carries a second idle canvas; the
 * engine itself pauses off screen, on a hidden tab, under the pause switch and
 * while the hero is drawing, and draws one still frame under reduced motion.
 *
 * Absolutely positioned: give it a box (inset, height) and the ring variables
 * `--band-x`, `--band-y` (ring centre), `--band-w` (ring height) and `--band-sx`
 * (horizontal stretch), plus `--band-opacity`.
 */
export function VortexBand({ className }: { className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof IntersectionObserver === "undefined") return;
    const near = new IntersectionObserver(([entry]) => entry.isIntersecting && setMounted(true), {
      rootMargin: NEAR,
    });
    const far = new IntersectionObserver(([entry]) => !entry.isIntersecting && setMounted(false), {
      rootMargin: FAR,
    });
    near.observe(box);
    far.observe(box);
    return () => {
      near.disconnect();
      far.disconnect();
    };
  }, []);

  return (
    <div ref={boxRef} aria-hidden className={cn("pointer-events-none absolute", className)}>
      {mounted && <AsciiVortexBackground variant="footer" />}
    </div>
  );
}

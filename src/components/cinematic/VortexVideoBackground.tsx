import { useEffect, useState } from "react";

import vortexVideo from "@/assets/home/vortex-hero.mp4.asset.json";
import vortexPoster from "@/assets/home/vortex-hero-poster.jpg";

/**
 * Looping vortex black-hole video used as the hero background.
 *
 * - SSR / initial paint ships the poster only (fast LCP).
 * - Video mounts client-side, autoplay muted+inline+loop.
 * - `prefers-reduced-motion` users stay on the poster.
 * - A radial scrim + bottom fade keeps hero text AAA-legible.
 */
export function VortexVideoBackground() {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) setPlay(true);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Poster — always rendered, provides SSR fallback + fast LCP */}
      <img
        src={vortexPoster}
        alt=""
        aria-hidden
        width={1920}
        height={1088}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {play && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={vortexPoster}
          aria-hidden
        >
          <source src={vortexVideo.url} type="video/mp4" />
        </video>
      )}

      {/* Purple color-grade wash */}
      <div
        aria-hidden
        className="absolute inset-0 mix-blend-color"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.42 0.22 305 / 55%), oklch(0.78 0.16 310 / 35%))",
        }}
      />

      {/* Radial vignette so the vortex reads as depth, not noise */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, oklch(0.1 0.06 295 / 70%) 100%)",
        }}
      />

      {/* Bottom fade into the flowing page background */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-background"
      />
    </div>
  );
}

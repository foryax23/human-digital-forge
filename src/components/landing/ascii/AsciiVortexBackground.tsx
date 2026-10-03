import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { HlsVideo } from "../HlsVideo";
import { SWIRL_VIDEO } from "../media";
import { useMotionPause } from "../motion-pause";
import { prefersReducedMotion, useIsomorphicLayoutEffect } from "../motion-prefs";
import { createAsciiEngine, type AsciiEngine } from "./engine";
import type { AsciiVortexBackgroundProps, AsciiVortexVariant } from "./types";

/** The ring box: square, centred on its point; the engine measures its transformed rect. */
const RING_BOX = "absolute aspect-square -translate-x-1/2 -translate-y-1/2";
/**
 * Hero and /scan: the old video ring, stretched 1.32x. Footer: a wide, flattened ring placed
 * by the band's own variables (VortexBand sets them per breakpoint).
 */
const RING_PLACE: Record<AsciiVortexVariant, string> = {
  hero: "scale-x-[1.32] left-[var(--vortex-x,50%)] top-[var(--vortex-y,47%)] w-[max(110vw,96vh)] lg:w-[max(92vw,100vh)]",
  backdrop: "scale-x-[1.32] left-1/2 top-[47%] w-[max(96vw,96vh)] opacity-60",
  footer:
    "left-[var(--band-x,50%)] top-[var(--band-y,50%)] w-[var(--band-w,60vw)] scale-x-[var(--band-sx,2.4)]",
};
const RING_MASK =
  "absolute inset-0 [mask-image:radial-gradient(closest-side,black_45%,rgb(0_0_0/0.55)_68%,transparent_92%)]";
/** The canvas once drawn: the /scan backdrop sits dimmer behind its steps, the footer band dimmer still. */
const HOST_SHOWN: Record<AsciiVortexVariant, string> = {
  hero: "opacity-100",
  backdrop: "opacity-[0.62]",
  footer: "opacity-[var(--band-opacity,0.5)]",
};
const RING_MEDIA =
  "h-full w-full object-cover opacity-80 mix-blend-screen brightness-[0.8] saturate-[0.9]";

/**
 * The Vortex swirl as a full-bleed, decorative layer: the looping swirl video
 * re-drawn live as fine coloured ASCII glyphs (see engine.ts), landing exactly
 * where the video ring sat. The server renders the poster ring, which the
 * canvas replaces once its first frame is drawn; without a usable canvas, or if
 * the sampling video fails, the original video ring comes back. The footer band
 * never shows the poster or the video ring: it stays empty until its glyphs are
 * drawn, and stays empty if they can't be.
 */
export function AsciiVortexBackground({
  state = "idle",
  sector = null,
  typingPulse = 0,
  progress = 0,
  variant = "hero",
  className,
}: AsciiVortexBackgroundProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<AsciiEngine | null>(null);
  const [mode, setMode] = useState<"ascii" | "video">("ascii");
  const [ready, setReady] = useState(false);
  const { paused } = useMotionPause();

  // Latest props for a freshly created engine (the prop effects below only run on change).
  const latest = useRef({ state, sector, progress, paused });
  useIsomorphicLayoutEffect(() => {
    latest.current = { state, sector, progress, paused };
  });

  useEffect(() => {
    if (mode !== "ascii") return;
    const layer = layerRef.current;
    const ring = ringRef.current;
    const host = hostRef.current;
    const video = videoRef.current;
    const poster = posterRef.current;
    if (!layer || !ring || !host || !video || !poster) return;
    const engine = createAsciiEngine({
      layer,
      ring,
      host,
      video,
      poster,
      src: SWIRL_VIDEO.ascii,
      variant,
      reducedMotion: prefersReducedMotion(),
      onReady: () => setReady(true),
      onFail: () => setMode("video"),
    });
    if (!engine) {
      setMode("video");
      return;
    }
    const now = latest.current;
    engine.setState(now.state);
    engine.setSector(now.sector);
    engine.setProgress(now.progress);
    engine.setPaused(now.paused);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
      setReady(false);
    };
  }, [mode, variant]);

  useEffect(() => engineRef.current?.setState(state), [state]);
  useEffect(() => engineRef.current?.setSector(sector), [sector]);
  useEffect(() => engineRef.current?.setProgress(progress), [progress]);
  useEffect(() => engineRef.current?.setPaused(paused), [paused]);
  useEffect(() => {
    if (typingPulse) engineRef.current?.pulse();
  }, [typingPulse]);

  const ascii = mode === "ascii";
  const footer = variant === "footer";
  if (footer && !ascii) return null;
  return (
    <div
      ref={layerRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      {/* The ring box: sized like the old video ring, measured by the engine. */}
      <div ref={ringRef} className={cn(RING_BOX, RING_PLACE[variant])}>
        <div
          className={cn(
            RING_MASK,
            "transition-opacity duration-700",
            ((ascii && ready) || footer) && "opacity-0",
          )}
        >
          {ascii ? (
            <img ref={posterRef} src={SWIRL_VIDEO.poster} alt="" className={RING_MEDIA} />
          ) : (
            <HlsVideo
              src={SWIRL_VIDEO.hls}
              fallbackSrc={SWIRL_VIDEO.mp4}
              poster={SWIRL_VIDEO.poster}
              className={RING_MEDIA}
            />
          )}
        </div>
      </div>
      {ascii && (
        <>
          {/* The engine's canvas goes in here (WebGL2, or a 2D canvas as the fallback). */}
          <div
            ref={hostRef}
            className={cn(
              "absolute inset-0 opacity-0 transition-opacity duration-700",
              ready && HOST_SHOWN[variant],
            )}
          />
          {/* The sampling source: decoding, but never seen (a 1px speck behind the dark eye). */}
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            tabIndex={-1}
            className="absolute left-1/2 top-1/2 h-px w-px opacity-[0.01]"
          />
        </>
      )}
    </div>
  );
}

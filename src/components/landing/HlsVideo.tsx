import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useMotionPause } from "./motion-pause";
import { prefersReducedMotion } from "./motion-prefs";

type HlsVideoProps = {
  /** HLS playlist (.m3u8). */
  src: string;
  /** Progressive file used when neither hls.js nor native HLS is available. */
  fallbackSrc?: string;
  poster?: string;
  className?: string;
};

/**
 * Decorative background video streamed over HLS.
 *
 * hls.js is imported on demand, and the stream only attaches once the video is
 * near the viewport. Playback pauses off-screen; reduced-motion visitors get
 * the poster frame only.
 */
export function HlsVideo({ src, fallbackSrc, poster, className }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [visible, setVisible] = useState(false);
  const [attached, setAttached] = useState(false);
  const { paused } = useMotionPause();

  // Track whether the video is (nearly) on screen.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || prefersReducedMotion()) return;
    const near = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setNearViewport(true),
      { rootMargin: "300px 0px" },
    );
    const onScreen = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    near.observe(video);
    onScreen.observe(video);
    return () => {
      near.disconnect();
      onScreen.disconnect();
    };
  }, []);

  // Attach the stream once.
  useEffect(() => {
    // Lets the server build drop the hls.js import entirely.
    if (import.meta.env.SSR) return;
    const video = videoRef.current;
    if (!video || !nearViewport) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    import("hls.js/light")
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ capLevelToPlayerSize: true, maxBufferLength: 12 });
          hls.loadSource(src);
          hls.attachMedia(video);
          destroy = () => hls.destroy();
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        } else if (fallbackSrc) {
          video.src = fallbackSrc;
        } else {
          return;
        }
        setAttached(true);
      })
      .catch(() => {
        if (cancelled || !fallbackSrc) return;
        video.src = fallbackSrc;
        setAttached(true);
      });

    return () => {
      cancelled = true;
      destroy?.();
      setAttached(false);
    };
  }, [nearViewport, src, fallbackSrc]);

  // Play only while visible and not paused page-wide. (No autoPlay attribute: it would start playback
  // off-screen as soon as the stream attaches.)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !attached) return;
    if (visible && !paused) {
      video.play().catch(() => {
        /* autoplay can be refused; the poster stays up */
      });
    } else {
      video.pause();
    }
  }, [visible, attached, paused]);

  return (
    <video
      ref={videoRef}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      aria-hidden
      tabIndex={-1}
      className={cn("pointer-events-none", className)}
    />
  );
}

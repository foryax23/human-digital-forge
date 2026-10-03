import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { Button, Kbd } from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { INTRO_VIDEO, LOGO_WORDMARK, SIGNOFF_VIDEO } from "./media";
import { useMotionPause } from "./motion-pause";

/** The assemble animation settles on the held wordmark here (seconds). */
const INTRO_HOLD_AT = 4.3;
/** How long the hold shows before the curtain lifts (seconds). */
const HOLD_BEAT = 0.3;
/** The video must be playing by then, or the counter takes over (ms). */
const START_TIMEOUT_MS = 2500;
/** A playing video that stops advancing this long hands over to the counter (ms). */
const STALL_MS = 2500;
/** Fallback counter: 000 → 100 in this long, then a short hold (ms). */
const COUNT_MS = 2700;
const COUNT_HOLD_MS = 400;

const EASE = [0.25, 0.1, 0.25, 1] as const;

type IntroClip = {
  src: string;
  /** Portrait phones get the vertical logo animation, which runs to its end. */
  portrait: boolean;
};

/**
 * Chosen after mount: orientation, screen size and codec support decide. The
 * WebM files are 1080p VP9: the lightest choice for big screens and for the
 * vertical clip; smaller landscape screens get the 720p MP4 (lighter still).
 */
function pickClip(): IntroClip {
  const portrait = window.matchMedia("(orientation: portrait) and (max-width: 767px)").matches;
  const webm = document.createElement("video").canPlayType('video/webm; codecs="vp9"') !== "";
  if (portrait) {
    return { src: webm ? SIGNOFF_VIDEO.portrait.webm : SIGNOFF_VIDEO.portrait.mp4, portrait };
  }
  const large = window.innerWidth * (window.devicePixelRatio || 1) > 1600;
  return {
    src: !large ? INTRO_VIDEO.mp4_720 : webm ? INTRO_VIDEO.webm : INTRO_VIDEO.mp4_1080,
    portrait,
  };
}

/**
 * Homepage intro curtain: the owner's brand animation (the swirl gathers into
 * the Vortex Hub wordmark) over the night background, a slim brand progress
 * bar and a small counter that follow the video, and a skip button (or Esc).
 * The whole screen slides up as the page transition once the wordmark holds.
 * If the video can't start (or stalls), a 2.7 s counter finishes the intro, so
 * it never hangs. Rendered by IntroProvider; it only runs once `active` is true.
 */
export function LoadingScreen({ active, onComplete }: { active: boolean; onComplete: () => void }) {
  const { t } = useI18n();
  const { paused } = useMotionPause();
  const [clip, setClip] = useState<IntroClip | null>(null);
  const [fallback, setFallback] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

  /** Progress 0 … 1 on the bar and the counter, written straight to the DOM. */
  const show = useCallback((progress: number) => {
    progressRef.current = progress;
    if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
    if (counterRef.current) {
      counterRef.current.textContent = String(Math.round(progress * 100)).padStart(3, "0");
    }
  }, []);

  // Pick the clip once the loader runs; the pause switch means no video at all.
  useEffect(() => {
    if (!active) return;
    if (paused) setFallback(true);
    else setClip((current) => current ?? pickClip());
  }, [active, paused]);

  // Follow the video: progress, hold, failure to start, stalls.
  useEffect(() => {
    const video = videoRef.current;
    if (!active || !clip || fallback || !video) return;

    const startedAt = performance.now();
    let frame = 0;
    let started = false;
    let lastTime = -1;
    let lastChange = startedAt;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = performance.now();
      const time = video.currentTime;
      if (time !== lastTime) {
        lastTime = time;
        lastChange = now;
        if (time > 0 && !started) {
          started = true;
          setPlaying(true);
        }
      }
      if (!started) {
        if (now - startedAt > START_TIMEOUT_MS) setFallback(true);
        return;
      }
      if (!video.ended && now - lastChange > STALL_MS) {
        setFallback(true);
        return;
      }
      const end = clip.portrait
        ? Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : SIGNOFF_VIDEO.durationSec
        : INTRO_HOLD_AT + HOLD_BEAT;
      show(Math.min(1, time / end));
      if (video.ended || time >= end) {
        cancelAnimationFrame(frame);
        finish();
      }
    };

    const onError = () => setFallback(true);
    video.addEventListener("error", onError);
    frame = requestAnimationFrame(tick);
    video.play().catch(() => setFallback(true));

    return () => {
      cancelAnimationFrame(frame);
      video.removeEventListener("error", onError);
    };
  }, [active, clip, fallback, finish, show]);

  // Fallback: the counter runs on from wherever the video got to.
  useEffect(() => {
    if (!active || !fallback) return;
    videoRef.current?.pause();
    const from = progressRef.current;
    let frame = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let start: number | null = null;

    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min(1, from + (now - start) / COUNT_MS);
      show(progress);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      timeout = setTimeout(finish, COUNT_HOLD_MS);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [active, fallback, finish, show]);

  // Esc skips, like the button.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, finish]);

  return (
    <motion.div
      className="intro-loader fixed inset-0 z-[9999] bg-background text-foreground"
      // The CSS fail-safe hid the loader (very slow hydration): finish now
      // rather than keep the page locked behind an invisible curtain.
      onAnimationEnd={(event) => {
        if (event.animationName !== "intro-failsafe" || completedRef.current) return;
        completedRef.current = true;
        onCompleteRef.current();
      }}
      exit={{ y: "-100%" }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* The brand animation; its black background drops out with `screen`. The
          edges fade so particles never end on a hard line. */}
      {active && clip && !fallback && (
        <div aria-hidden className="absolute inset-0 flex items-center justify-center">
          <video
            ref={videoRef}
            src={clip.src}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            tabIndex={-1}
            className={cn(
              "pointer-events-none h-full w-full object-contain mix-blend-screen transition-opacity duration-300 [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_72%)]",
              !clip.portrait && "max-w-[1120px]",
              playing ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      )}

      {/* Without the video: the wordmark itself, while the counter runs. */}
      {fallback && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="absolute inset-0 flex items-center justify-center px-8"
        >
          <picture className="contents">
            <source type="image/webp" srcSet={LOGO_WORDMARK.webp} />
            <img
              src={LOGO_WORDMARK.png}
              alt=""
              width={LOGO_WORDMARK.width}
              height={LOGO_WORDMARK.height}
              className="h-auto w-full max-w-[min(34rem,80vw)]"
            />
          </picture>
        </motion.div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 px-6 pb-6 md:px-10 md:pb-9">
        <span ref={counterRef} aria-hidden className="type-code text-fg-3">
          000
        </span>
        <Button variant="secondary" size="sm" onClick={finish} className="pr-1.5">
          {t("Skip intro", "Sari peste")}
          <Kbd className="hidden md:inline-flex">esc</Kbd>
        </Button>
      </div>

      <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-line-1">
        <div
          ref={barRef}
          className="h-full w-full bg-brand-line"
          style={{ transform: "scaleX(0)", transformOrigin: "left" }}
        />
      </div>

      <p role="status" className="sr-only">
        {t("Loading Vortex Hub", "Se încarcă Vortex Hub")}
      </p>
    </motion.div>
  );
}

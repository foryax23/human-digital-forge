"use client";

import * as React from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface FeatureItem {
  title: React.ReactNode;
  /** Revealed under the title when the item is active. */
  description?: React.ReactNode;
  /** Image or video URL, or any node, shown in the panel. */
  content: string | React.ReactNode;
  alt?: string;
  /** Responsive sources for image content. */
  srcSet?: string;
}

interface FeaturesWithPanelProps {
  items: FeatureItem[];
  /** Rendered above the list in the left column (e.g. a section header). */
  header?: React.ReactNode;
  /** Rendered below the list (e.g. calls to action). */
  footer?: React.ReactNode;
  /** Cycle through the items until the visitor picks one. Off for reduced motion. */
  autoAdvanceMs?: number;
  /** Hold the auto-advance (e.g. a page-wide "pause animations" switch). */
  paused?: boolean;
  /** Grade photos towards the surrounding dark brand palette. */
  tone?: "brand" | "none";
  /** Accessible name for the list of items. */
  label?: string;
  className?: string;
}

const isVideo = (src: string) => /\.(mp4|webm|ogg)(\?|$)/i.test(src);
const isImage = (src: string) =>
  /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?|$)/i.test(src) || /unsplash|images\./i.test(src);

function FeatureMedia({ item, tone }: { item: FeatureItem; tone: "brand" | "none" }) {
  const { content, alt, srcSet } = item;
  let media: React.ReactNode;

  if (typeof content !== "string") {
    media = <div className="h-full w-full">{content}</div>;
  } else if (isVideo(content)) {
    media = (
      <video
        src={content}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        className="h-full w-full object-cover"
      />
    );
  } else if (isImage(content)) {
    media = (
      <img
        src={content}
        srcSet={srcSet}
        sizes="(min-width: 1024px) 560px, 100vw"
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className={cn(
          "h-full w-full object-cover",
          tone === "brand" && "brightness-[0.82] saturate-[0.85]",
        )}
      />
    );
  } else {
    media = (
      <div className="flex h-full w-full items-center justify-center p-8">
        <p className="type-body-sm text-muted-foreground">{content}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {media}
      {tone === "brand" && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[oklch(0.585_0.225_282/0.3)] mix-blend-soft-light"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent"
          />
        </>
      )}
    </div>
  );
}

/**
 * Numbered list on the left, a sticky media panel on the right that swaps
 * with a blur crossfade. Below lg the panel folds into the active item.
 */
export default function FeaturesWithPanel({
  items,
  header,
  footer,
  autoAdvanceMs,
  paused = false,
  tone = "brand",
  label,
  className,
}: FeaturesWithPanelProps) {
  const [active, setActive] = React.useState(0);
  const [autoplay, setAutoplay] = React.useState(Boolean(autoAdvanceMs));
  // Starts false on the server and in the hydration render (motion's
  // useReducedMotion differs between them), then follows the OS setting.
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const panelId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const barRef = React.useRef<HTMLSpanElement>(null);
  const pausedRef = React.useRef(false);

  const cycling = autoplay && Boolean(autoAdvanceMs) && !reduced && !paused;

  // Advance after autoAdvanceMs of visible, un-hovered time, filling the bar. The
  // frame loop only runs while the list is on screen and the tab is visible.
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !cycling || !autoAdvanceMs) return;
    let frame = 0;
    let last = 0;
    let elapsed = 0;
    let inView = false;
    const tick = (now: number) => {
      const dt = Math.max(0, now - last);
      last = now;
      if (!pausedRef.current) elapsed += dt;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${Math.min(1, elapsed / autoAdvanceMs)})`;
      }
      if (elapsed >= autoAdvanceMs) {
        frame = 0;
        setActive((index) => (index + 1) % items.length);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      const run = inView && !document.hidden;
      if (run && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      } else if (!run && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    observer.observe(root);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      cancelAnimationFrame(frame);
    };
  }, [active, cycling, autoAdvanceMs, items.length]);

  const select = (index: number) => {
    setAutoplay(false);
    setActive(index);
  };

  const pause = (paused: boolean) => () => {
    pausedRef.current = paused;
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        onPointerEnter={pause(true)}
        onPointerLeave={pause(false)}
        onFocus={pause(true)}
        onBlur={pause(false)}
        className={cn("grid grid-cols-1 lg:grid-cols-2 lg:items-start lg:gap-16", className)}
      >
        <div>
          {header}

          <ul aria-label={label} className="flex flex-col gap-1.5">
            {items.map((item, index) => {
              const isActive = active === index;
              return (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
                  className={cn(
                    "relative overflow-hidden rounded-2xl transition-colors duration-300",
                    isActive
                      ? "bg-white/[0.04] ring-1 ring-white/15"
                      : "ring-1 ring-transparent hover:bg-white/[0.02]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => select(index)}
                    aria-expanded={isActive}
                    aria-controls={isActive ? `${panelId}-${index}` : undefined}
                    className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    {/* A plain index, lavender while active (no disc). */}
                    <span
                      className={cn(
                        "type-label w-8 shrink-0 tabular-nums transition-colors duration-300",
                        isActive ? "text-[#c4b5fd]" : "text-muted-foreground",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "type-h3 transition-colors duration-300",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {item.title}
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isActive && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                        id={`${panelId}-${index}`}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pl-16">
                          {item.description && (
                            <p className="type-body-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        <div className="px-4 pb-4 lg:hidden">
                          <Card className="relative aspect-4/3 w-full overflow-hidden rounded-2xl border-border p-0">
                            <div className="absolute inset-0">
                              <FeatureMedia item={item} tone={tone} />
                            </div>
                          </Card>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {isActive && cycling && (
                    <span
                      ref={barRef}
                      aria-hidden
                      className="accent-gradient absolute inset-x-4 bottom-0 h-px origin-left"
                      style={{ transform: "scaleX(0)" }}
                    />
                  )}
                </motion.li>
              );
            })}
          </ul>

          {footer && <div className="mt-8">{footer}</div>}
        </div>

        <div className="sticky top-28 hidden lg:block">
          <Card
            id={panelId}
            className="relative aspect-4/3 w-full overflow-hidden rounded-3xl border-border bg-card p-0 shadow-2xl shadow-black/40"
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, scale: 1.08, filter: "blur(16px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.98, filter: "blur(16px)" }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0"
              >
                <FeatureMedia item={items[active]} tone={tone} />
              </motion.div>
            </AnimatePresence>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3 p-6"
            >
              <span className="h-px w-8 bg-foreground/40" />
              <span className="type-label tabular-nums text-foreground/80">
                {String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
              </span>
            </div>
          </Card>
        </div>
      </div>
    </MotionConfig>
  );
}

import { Component, useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Painter = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
) => void;

/** A canvas failure must never take a section down. */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Surface({ paint, className }: { paint: Painter; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
      },
      { rootMargin: "120px" },
    );
    io.observe(canvas);

    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      ctx.clearRect(0, 0, width, height);
      paint(ctx, width, height, (now - start) / 1000);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [paint]);

  return <canvas ref={ref} aria-hidden className={cn("block h-full w-full", className)} />;
}

/**
 * Shared shell for the animated section backdrops: client-only, DPR-capped,
 * paused off-screen and skipped entirely for reduced-motion users, who get the
 * static gradient fallback instead.
 */
export function CanvasBackground({
  paint,
  className,
  fallback,
}: {
  paint: Painter;
  className?: string;
  fallback?: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {fallback && <div className={cn("absolute inset-0", fallback)} />}
      <CanvasBoundary>
        <Surface paint={paint} />
      </CanvasBoundary>
    </div>
  );
}

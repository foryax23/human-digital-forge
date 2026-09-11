import { useCallback } from "react";

import { CanvasBackground, type Painter } from "./CanvasBackground";
import { palette, rgba } from "./palette";

/** Thin drifting light threads. Used behind the process rail. */
export function ThreadsBackground({ className }: { className?: string }) {
  const paint = useCallback<Painter>((ctx, w, h, t) => {
    const lines = 22;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 1;

    for (let i = 0; i < lines; i++) {
      const p0 = i / (lines - 1);
      const phase = t * 0.5 + i * 0.5;
      const alpha = 0.06 + 0.14 * (0.5 + 0.5 * Math.sin(phase * 0.8));
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, rgba(palette.indigo, 0));
      grad.addColorStop(0.5, rgba(i % 3 === 0 ? palette.periwinkle : palette.indigo, alpha));
      grad.addColorStop(1, rgba(palette.indigo, 0));
      ctx.strokeStyle = grad;

      ctx.beginPath();
      for (let x = 0; x <= w; x += 10) {
        const p = x / w;
        const y =
          h * (0.08 + p0 * 0.84) +
          Math.sin(p * 5 + phase) * 16 * (0.4 + p0 * 0.8) +
          Math.sin(p * 11 - phase * 0.4) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";
  }, []);

  return (
    <CanvasBackground
      paint={paint}
      className={className}
      fallback="bg-gradient-to-b from-transparent via-primary/5 to-transparent"
    />
  );
}

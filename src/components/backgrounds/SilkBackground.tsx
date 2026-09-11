import { useCallback } from "react";

import { CanvasBackground, type Painter } from "./CanvasBackground";
import { palette, rgba } from "./palette";

/** Slow fabric-like diagonal sheen. Used behind the AI and consultation bands. */
export function SilkBackground({ className }: { className?: string }) {
  const paint = useCallback<Painter>((ctx, w, h, t) => {
    const step = 26;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 14;

    for (let i = -2; i < h / step + 2; i++) {
      const base = i * step;
      const phase = t * 0.35 + i * 0.24;
      const alpha = 0.05 + 0.05 * (0.5 + 0.5 * Math.sin(phase));
      const grad = ctx.createLinearGradient(0, base, w, base + step * 3);
      grad.addColorStop(0, rgba(palette.violet, alpha * 0.6));
      grad.addColorStop(0.45, rgba(palette.indigo, alpha));
      grad.addColorStop(1, rgba(palette.periwinkle, alpha * 0.7));
      ctx.strokeStyle = grad;

      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const p = x / w;
        const y = base + Math.sin(p * 4.2 + phase) * 22 + Math.cos(p * 2.1 - phase * 0.6) * 12;
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
      fallback="bg-gradient-to-br from-primary/10 via-transparent to-teal/10"
    />
  );
}

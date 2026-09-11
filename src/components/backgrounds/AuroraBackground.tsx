import { useCallback } from "react";

import { CanvasBackground, type Painter } from "./CanvasBackground";
import { palette, rgba } from "./palette";

/** Flowing light bands — the widest, softest backdrop. Used behind the hero. */
export function AuroraBackground({ className }: { className?: string }) {
  const paint = useCallback<Painter>((ctx, w, h, t) => {
    const bands = [
      { color: palette.indigo, amp: 0.1, speed: 0.16, y: 0.32, alpha: 0.3 },
      { color: palette.periwinkle, amp: 0.08, speed: 0.11, y: 0.5, alpha: 0.22 },
      { color: palette.violet, amp: 0.13, speed: 0.08, y: 0.68, alpha: 0.4 },
    ];

    ctx.globalCompositeOperation = "lighter";
    try {
      ctx.filter = "blur(46px)";
    } catch {
      /* filter unsupported — bands simply render crisper */
    }

    for (const band of bands) {
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, rgba(band.color, 0));
      grad.addColorStop(0.5, rgba(band.color, band.alpha));
      grad.addColorStop(1, rgba(band.color, 0));
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 12) {
        const p = x / w;
        const y =
          h * band.y +
          Math.sin(p * 3.1 + t * band.speed * 2) * h * band.amp +
          Math.sin(p * 6.4 - t * band.speed) * h * band.amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }

    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
  }, []);

  return <CanvasBackground paint={paint} className={className} fallback="bg-aurora opacity-40" />;
}

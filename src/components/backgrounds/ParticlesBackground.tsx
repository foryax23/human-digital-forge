import { useCallback, useMemo } from "react";

import { CanvasBackground, type Painter } from "./CanvasBackground";
import { palette, rgba } from "./palette";

type Dot = { x: number; y: number; r: number; sx: number; sy: number; tw: number };

/** Slow floating dust. Used behind the trust band and the final CTA. */
export function ParticlesBackground({
  className,
  count = 70,
}: {
  className?: string;
  count?: number;
}) {
  const dots = useMemo<Dot[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random(),
        y: Math.random(),
        r: 0.6 + Math.random() * 1.9,
        sx: (Math.random() - 0.5) * 0.012,
        sy: -0.006 - Math.random() * 0.016,
        tw: i * 0.7,
      })),
    [count],
  );

  const paint = useCallback<Painter>(
    (ctx, w, h, t) => {
      ctx.globalCompositeOperation = "lighter";
      for (const d of dots) {
        let x = (d.x + d.sx * t) % 1;
        let y = (d.y + d.sy * t) % 1;
        if (x < 0) x += 1;
        if (y < 0) y += 1;
        const alpha = 0.18 + 0.42 * (0.5 + 0.5 * Math.sin(t * 1.1 + d.tw));
        const color = d.r > 1.8 ? palette.periwinkle : palette.indigo;
        const cx = x * w;
        const cy = y * h;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, d.r * 6);
        glow.addColorStop(0, rgba(color, alpha));
        glow.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, d.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    },
    [dots],
  );

  return <CanvasBackground paint={paint} className={className} />;
}

import { useCallback } from "react";

import { CanvasBackground, type Painter } from "./CanvasBackground";
import { palette, rgba } from "./palette";

/** Animated grid with cells lighting up in waves. Used behind pricing. */
export function SquaresBackground({
  className,
  size = 58,
}: {
  className?: string;
  size?: number;
}) {
  const paint = useCallback<Painter>(
    (ctx, w, h, t) => {
      const cols = Math.ceil(w / size) + 1;
      const rows = Math.ceil(h / size) + 1;
      const drift = (t * 8) % size;

      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(palette.periwinkle, 0.07);
      ctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        const x = c * size - drift;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let r = 0; r <= rows; r++) {
        const y = r * size;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      ctx.globalCompositeOperation = "lighter";
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const wave = Math.sin(c * 0.7 + r * 0.5 - t * 1.2);
          if (wave < 0.86) continue;
          const alpha = (wave - 0.86) * 1.1;
          ctx.fillStyle = rgba((c + r) % 2 ? palette.indigo : palette.periwinkle, alpha * 0.5);
          ctx.fillRect(c * size - drift + 1, r * size + 1, size - 2, size - 2);
        }
      }
      ctx.globalCompositeOperation = "source-over";
    },
    [size],
  );

  return <CanvasBackground paint={paint} className={className} />;
}

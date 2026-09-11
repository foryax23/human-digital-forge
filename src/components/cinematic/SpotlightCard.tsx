import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A panel where a soft light follows the cursor and the border picks up the
 * brand glow on hover.
 */
export function SpotlightCard({
  children,
  className,
  radius = 300,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-border bento-panel transition-all duration-500",
        "hover:-translate-y-1.5 hover:border-primary/40",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-400 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${radius}px circle at var(--mx, 50%) var(--my, 0%), color-mix(in oklab, var(--primary) 26%, transparent), transparent 68%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

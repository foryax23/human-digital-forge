import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion, useTransform } from "motion/react";

import { cn } from "@/lib/utils";

/** 3D tilt toward the cursor with a moving glare highlight. */
export function TiltedCard({
  children,
  className,
  max = 11,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const opacity = useMotionValue(0);

  const springRx = useSpring(rx, { stiffness: 180, damping: 18 });
  const springRy = useSpring(ry, { stiffness: 180, damping: 18 });
  const glare = useTransform(
    [gx, gy],
    ([x, y]: number[]) =>
      `radial-gradient(340px circle at ${x}% ${y}%, color-mix(in oklab, white 24%, transparent), transparent 62%)`,
  );

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    ry.set((px - 0.5) * max * 2);
    rx.set(-(py - 0.5) * max * 2);
    gx.set(px * 100);
    gy.set(py * 100);
    opacity.set(1);
  }

  function onLeave() {
    rx.set(0);
    ry.set(0);
    opacity.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={
        reduce
          ? undefined
          : { rotateX: springRx, rotateY: springRy, transformPerspective: 900 }
      }
      className={cn("relative", className)}
    >
      {children}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light"
        style={reduce ? { display: "none" } : { backgroundImage: glare, opacity }}
      />
    </motion.div>
  );
}

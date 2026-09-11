import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * Sticky stacked panels: each child pins near the top and the ones behind it
 * scale down and fade as you scroll through the block.
 */
export function ScrollStack({
  children,
  className,
  itemClassName,
  top = 120,
}: {
  children: ReactNode[];
  className?: string;
  itemClassName?: string;
  top?: number;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className={cn("space-y-6", className)}>
        {children.map((child, i) => (
          <div key={i} className={itemClassName}>
            {child}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {children.map((child, i) => (
        <StackItem
          key={i}
          index={i}
          total={children.length}
          top={top}
          className={itemClassName}
        >
          {child}
        </StackItem>
      ))}
    </div>
  );
}

function StackItem({
  children,
  index,
  total,
  top,
  className,
}: {
  children: ReactNode;
  index: number;
  total: number;
  top: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.22", "end 0.05"],
  });

  const last = index === total - 1;
  const scale = useTransform(scrollYProgress, [0, 1], [1, last ? 1 : 0.92]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, last ? 1 : 0.35]);

  return (
    <div
      ref={ref}
      className="sticky"
      style={{ top: top + index * 18, zIndex: index + 1 }}
    >
      <motion.div style={{ scale, opacity }} className={cn("origin-top", className)}>
        {children}
      </motion.div>
    </div>
  );
}

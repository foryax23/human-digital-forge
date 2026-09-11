import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Staggered list reveal used for feature and plan bullet lists. */
export function AnimatedList({
  children,
  className,
  stagger = 0.07,
  delay = 0,
  as: Tag = "ul",
}: {
  children: ReactNode[];
  className?: string;
  stagger?: number;
  delay?: number;
  as?: "ul" | "div";
}) {
  const reduce = useReducedMotion();
  const Container = Tag === "ul" ? motion.ul : motion.div;
  const Item = Tag === "ul" ? motion.li : motion.div;

  if (reduce) {
    const Plain = Tag;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Container
      className={cn(className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
    >
      {children.map((child, i) => (
        <Item
          key={i}
          variants={{
            hidden: { opacity: 0, x: -14, filter: "blur(6px)" },
            show: {
              opacity: 1,
              x: 0,
              filter: "blur(0px)",
              transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          {child}
        </Item>
      ))}
    </Container>
  );
}

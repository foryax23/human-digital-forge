import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * Reveals a line character by character with a blur-to-focus rise.
 * Whole words stay together so wrapping still behaves.
 */
export function SplitText({
  text,
  className,
  delay = 0,
  stagger = 0.028,
  inView = false,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  inView?: boolean;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <span className={className}>{text}</span>;

  const words = text.split(" ");
  let index = -1;

  const motionProps = inView
    ? { initial: "hidden" as const, whileInView: "show" as const, viewport: { once: true, margin: "-70px" } }
    : { initial: "hidden" as const, animate: "show" as const };

  return (
    <motion.span
      {...motionProps}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      className={cn("inline-block", className)}
      aria-label={text}
    >
      {words.map((word, w) => (
        <span key={`${word}-${w}`} className="inline-block whitespace-nowrap">
          {Array.from(word).map((char, c) => {
            index += 1;
            return (
              <motion.span
                key={`${char}-${c}-${index}`}
                aria-hidden
                className="inline-block"
                variants={{
                  hidden: { opacity: 0, y: "0.5em", filter: "blur(10px)" },
                  show: {
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
              >
                {char}
              </motion.span>
            );
          })}
          {w < words.length - 1 && <span aria-hidden>&nbsp;</span>}
        </span>
      ))}
    </motion.span>
  );
}

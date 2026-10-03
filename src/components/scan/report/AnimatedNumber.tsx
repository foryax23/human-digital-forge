import { useEffect, useRef, useState } from "react";
import { animate, useInView, useMotionValue } from "motion/react";

import type { Range } from "@/lib/scan/types";
import { useIsomorphicLayoutEffect } from "@/components/landing/motion-prefs";
import { cn } from "@/lib/utils";
import { EASE_OUT, useScanMotion } from "./motion";

/**
 * A number that counts up the first time it scrolls into view, then tweens
 * smoothly whenever `value` changes (simulation sliders, horizon toggles).
 * Screen readers get the final value only; reduced motion jumps straight to it.
 */
export function AnimatedNumber({
  value,
  format,
  from = 0,
  duration = 1.2,
  delay = 0,
  className,
}: {
  value: number;
  format: (value: number) => string;
  /** Where the first count-up starts; pass `value` to skip it. */
  from?: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const formatRef = useRef(format);
  formatRef.current = format;
  const { reduce } = useScanMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const motionValue = useMotionValue(from);
  const started = useRef(false);
  // Rendered once; afterwards the text node is written directly, so React
  // never re-renders 60 times a second during a tween.
  const [initialText] = useState(() => format(from));

  useEffect(
    () =>
      motionValue.on("change", (latest) => {
        if (ref.current) ref.current.textContent = formatRef.current(latest);
      }),
    [motionValue],
  );

  // Keeps the text right when only the formatting changes (language switch).
  useIsomorphicLayoutEffect(() => {
    if (ref.current) ref.current.textContent = formatRef.current(motionValue.get());
  });

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      motionValue.jump(value);
      if (ref.current) ref.current.textContent = formatRef.current(value);
      started.current = true;
      return;
    }
    const first = !started.current;
    started.current = true;
    const controls = animate(motionValue, value, {
      duration: first ? duration : 0.65,
      delay: first ? delay : 0,
      ease: EASE_OUT,
    });
    return () => controls.stop();
  }, [inView, value, reduce, duration, delay, motionValue]);

  return (
    <span className={cn("tabular-nums", className)}>
      <span ref={ref} aria-hidden>
        {initialText}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

/** "low–high" pair of animated numbers. */
export function AnimatedRange({
  range,
  format,
  delay = 0,
  className,
}: {
  range: Range;
  format: (value: number) => string;
  delay?: number;
  className?: string;
}) {
  const same = format(range.low) === format(range.high);
  return (
    <span className={cn("tabular-nums", className)}>
      {!same && (
        <>
          <AnimatedNumber value={range.low} format={format} delay={delay} />
          <span aria-hidden>–</span>
          <span className="sr-only"> – </span>
        </>
      )}
      <AnimatedNumber value={range.high} format={format} delay={delay} />
    </span>
  );
}

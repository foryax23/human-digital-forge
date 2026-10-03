import { Fragment } from "react";

import { cn } from "@/lib/utils";

/*
 * How a displayPlan() sentence is set on screen in the strategy and results
 * steps: figures picked out in meta lines, the first figure of a result set
 * large. The plain-text helpers live in plan-copy.ts.
 */

const NUMBER = /([+−-]?\d[\d.,]*)/;

/** Every figure in a 13 px meta line one step brighter than its unit ("cam **35** de ore pe lună"). */
export function Figures({ text, className }: { text: string; className?: string }) {
  const parts = text.split(NUMBER);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="text-fg-2">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </span>
  );
}

/** A result statement with its first figure set large ("cam **40** de ore pe lună"). */
export function Statement({ text, className }: { text: string; className?: string }) {
  const parts = text.split(NUMBER);
  return (
    <span className={cn("font-display text-[1.0625rem] font-semibold leading-[1.3]", className)}>
      {parts.map((part, i) =>
        i === 1 ? (
          <span key={i} className="type-figure">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </span>
  );
}

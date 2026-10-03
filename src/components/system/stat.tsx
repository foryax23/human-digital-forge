import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One number with its meaning: label 13 px (optional 10 × 2 px swatch, so a strip under a
 * chart doubles as its legend), value in aligned Space Grotesk + unit 13 px, an optional
 * NoteRef, and a sub-line that wraps and never truncates.
 */
export function Stat({
  label,
  value,
  unit,
  note,
  sub,
  swatch,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Written after a non-breaking space ("63.000 lei"). */
  unit?: ReactNode;
  /** A <NoteRef n={1} /> after the value. */
  note?: ReactNode;
  sub?: ReactNode;
  /** Background class of the legend swatch, e.g. "bg-brand-line" or "bg-white/45". */
  swatch?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 bg-s1 px-4 py-3", className)}>
      <dt className="flex items-center gap-2 text-[0.8125rem] leading-[1.35] text-fg-3">
        {swatch ? <span aria-hidden className={cn("h-0.5 w-2.5 shrink-0", swatch)} /> : null}
        {label}
      </dt>
      <dd className="text-fg">
        <span className="type-figure">{value}</span>
        {unit ? <span className="text-[0.8125rem] text-fg-3">&nbsp;{unit}</span> : null}
        {note}
      </dd>
      {sub ? <dd className="text-xs leading-[1.45] text-fg-3">{sub}</dd> : null}
    </div>
  );
}

const COLUMNS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-1 @[26rem]:grid-cols-3",
  4: "grid-cols-2 @[36rem]:grid-cols-4",
};

/**
 * A row of Stats split by 1 px hairlines (a grid on line-1 with 1 px gaps). Columns follow
 * the strip's own width: 4 → 2 × 2 under 576 px, 3 → stacked under 416 px.
 * Cells are panel-coloured; pass surface="page" when the strip sits on the bare page.
 * `bleed` pulls the strip out by the cells' 16 px padding, so the figures line up with the
 * text around them inside a panel body.
 */
export function StatStrip({
  columns = 4,
  surface = "panel",
  bleed = false,
  label,
  className,
  children,
}: {
  columns?: 2 | 3 | 4;
  surface?: "panel" | "page";
  bleed?: boolean;
  /** Accessible name of the group. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("@container", bleed && "-mx-4")}>
      <dl
        aria-label={label}
        className={cn(
          "grid gap-px overflow-hidden bg-line-1",
          COLUMNS[columns],
          surface === "page" && "[&>div]:bg-background",
          className,
        )}
      >
        {children}
      </dl>
    </div>
  );
}

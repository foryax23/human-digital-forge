import type { CSSProperties } from "react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { formatNumber, NBSP } from "./format";

/*
 * The plan as a month-by-month calendar table (spec §2.13): one row per stage
 * with its bar, hours a month and one-off cost, then a Total row. Read by the
 * results step (regular) and the strategy step's "Plan pe luni" (compact).
 * Figures arrive already rounded from displayPlan(), so rows add up to the
 * total and match every other surface.
 *
 * From 35rem of its own width it is a grid table; narrower, each row stacks:
 * name and hours, a full-width bar track, then the cost written out.
 */

export type GanttRow = {
  key: string;
  /** The stage name, exactly as in the phase rows, the strategy cards and the PDF. */
  name: string;
  /** Plan months the bar covers, inclusive ([[2, 3]]); several for a split row. */
  segments: [number, number][];
  /** The starting stage: violet bar. */
  start?: boolean;
  /** An 8 px diamond at the end of the last bar ("site online"). */
  milestone?: boolean;
  /** null: the stage brings enquiries, not hours (the cell shows "–"). */
  hours: number | null;
  /** Hours written out for narrow layouts ("cam 40 de ore pe lună", "aduce solicitări, nu ore"). */
  hoursText: string;
  /** One-off cost in lei. */
  cost: number;
  /** Cost written out for narrow layouts ("≈ 8.000 lei, apoi 600 lei pe lună"). */
  costText: string;
  /** When it runs, for screen readers ("Lunile 2–3"). */
  when: string;
  /** Shown in the bar cell when the row has no months ("opțional"). */
  empty?: string;
};

export type GanttTotal = {
  hours: number;
  cost: number;
  /** Middle cell: "Apoi cam 1.100 lei pe lună pentru instrumente." */
  note?: string;
  /** Narrow layouts: hours and cost written out. */
  hoursText: string;
  costText: string;
};

/** Month gridlines inside the bar track (4.5% of the text colour, so both themes work). */
const gridlines = (months: number): CSSProperties => ({
  backgroundImage:
    "linear-gradient(to right, color-mix(in srgb, var(--vx-fg) 4.5%, transparent) 1px, transparent 1px)",
  backgroundSize: `${100 / months}% 100%`,
});

export function Gantt({
  rows,
  months = 6,
  density = "regular",
  total,
  label,
  nameHeader,
  legend = true,
  className,
}: {
  rows: GanttRow[];
  months?: number;
  /** compact: 32 px rows (strategy step); regular: 36 px rows (results). */
  density?: "regular" | "compact";
  total?: GanttTotal;
  /** Accessible name of the table. */
  label: string;
  /** Head of the name column (default "Etapă"). */
  nameHeader?: string;
  legend?: boolean;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const span = Math.max(1, months);
  const monthList = Array.from({ length: span }, (_, i) => i + 1);
  const rowHeight = density === "compact" ? "min-h-8" : "min-h-9";
  // Name column sized to the longest name (then it wraps); months share the rest. Month 1
  // has room for "Luna 1" on one line even when the columns are at their narrowest.
  const columns: CSSProperties = {
    gridTemplateColumns: `minmax(12rem, max-content) minmax(2.875rem, 1fr)${span > 1 ? ` repeat(${span - 1}, minmax(2.25rem, 1fr))` : ""} 4rem 5.5rem`,
  };
  const hoursCell = (hours: number | null) =>
    hours === null ? "–" : hours === 0 ? "< 5" : `≈${NBSP}${formatNumber(hours, lang)}`;
  const hasMilestone = rows.some((row) => row.milestone);
  const hasStart = rows.some((row) => row.start);

  return (
    <div className={cn("@container min-w-0", className)}>
      {/* ------------------------------------------------ grid table (≥ 35rem) */}
      <div role="table" aria-label={label} className="hidden text-sm @[35rem]:grid" style={columns}>
        <div role="row" className="col-span-full grid grid-cols-subgrid">
          <span
            role="columnheader"
            className="flex items-end border-b border-rule pb-2 pr-3 text-xs font-medium leading-[1.3] text-fg-3"
          >
            {nameHeader ?? t("Stage", "Etapă")}
          </span>
          {monthList.map((month) => (
            <span
              key={month}
              role="columnheader"
              className="type-pnum flex items-end whitespace-nowrap border-b border-rule pb-2 pl-1.5 text-xs font-medium leading-[1.3] text-fg-3"
            >
              {/* "Luna 1" on one line, then the bare numbers. */}
              {month === 1 ? t("Month 1", "Luna 1") : month}
            </span>
          ))}
          <span
            role="columnheader"
            className="flex items-end justify-end border-b border-rule pb-2 pl-2 text-right text-xs font-medium leading-[1.3] text-fg-3"
          >
            {t("Hours / month", "Ore / lună")}
          </span>
          <span
            role="columnheader"
            data-gantt-head
            className="flex items-end justify-end border-b border-rule pb-2 pl-2 text-right text-xs font-medium leading-[1.3] text-fg-3"
          >
            {t("One-off, RON", "Cost unic, lei")}
          </span>
        </div>

        {rows.map((row, index) => (
          <div role="row" key={row.key} className="col-span-full grid grid-cols-subgrid">
            <span
              role="rowheader"
              className={cn(
                "flex items-center gap-2 border-b border-line-1 py-2 pr-3 leading-[1.35] text-fg",
                rowHeight,
              )}
            >
              <span className="type-pnum w-3 shrink-0 text-[0.8125rem] text-fg-3">{index + 1}</span>
              <span className="min-w-0">{row.name}</span>
            </span>
            <span
              role="cell"
              aria-colspan={span}
              className={cn("relative border-b border-line-1", rowHeight)}
              style={{ gridColumn: `span ${span}`, ...gridlines(span) }}
            >
              <span className="sr-only">{row.when}</span>
              <Bars row={row} months={span} />
            </span>
            <span
              role="cell"
              className={cn(
                "type-num flex items-center justify-end border-b border-line-1 pl-2 text-fg",
                rowHeight,
              )}
            >
              {row.hours === null ? (
                <>
                  <span aria-hidden>–</span>
                  <span className="sr-only">{row.hoursText}</span>
                </>
              ) : (
                hoursCell(row.hours)
              )}
            </span>
            <span
              role="cell"
              className={cn(
                "type-num flex items-center justify-end border-b border-line-1 pl-2 text-fg",
                rowHeight,
              )}
            >
              {row.cost > 0 ? formatNumber(row.cost, lang) : "–"}
            </span>
          </div>
        ))}

        {total ? (
          <div role="row" className="col-span-full grid grid-cols-subgrid">
            <span
              role="rowheader"
              className="flex min-h-9 items-center border-t border-rule py-2 pr-3 font-medium text-fg"
            >
              {t("Total", "Total")}
            </span>
            <span
              role="cell"
              aria-colspan={span}
              className="flex min-h-9 items-center border-t border-rule py-2 pl-1.5 text-[0.8125rem] leading-[1.35] text-fg-3"
              style={{ gridColumn: `span ${span}` }}
            >
              {total.note}
            </span>
            <span
              role="cell"
              className="type-num flex min-h-9 items-center justify-end border-t border-rule pl-2 font-semibold text-fg"
            >
              {hoursCell(total.hours)}
            </span>
            <span
              role="cell"
              className="type-num flex min-h-9 items-center justify-end border-t border-rule pl-2 font-semibold text-fg"
            >
              {formatNumber(total.cost, lang)}
            </span>
          </div>
        ) : null}
      </div>

      {/* ------------------------------------------------- stacked (< 35rem) */}
      <div className="@[35rem]:hidden">
        <div
          aria-hidden
          className="grid border-b border-rule pb-2"
          style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }}
        >
          {monthList.map((month) => (
            <span
              key={month}
              className="type-pnum pl-1 text-xs font-medium leading-[1.3] text-fg-3"
            >
              {month === 1 ? t("Month 1", "Luna 1") : month}
            </span>
          ))}
        </div>
        <ol aria-label={label}>
          {rows.map((row, index) => (
            <li key={row.key} className="border-b border-line-1 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex min-w-0 gap-2 text-sm leading-[1.35] text-fg">
                  <span className="type-pnum w-3 shrink-0 text-[0.8125rem] text-fg-3">
                    {index + 1}
                  </span>
                  <span className="min-w-0">{row.name}</span>
                </p>
                <p className="shrink-0 text-right text-[0.8125rem] leading-[1.35] text-fg-2">
                  {row.hoursText}
                </p>
              </div>
              <div className="relative mt-2 h-3" style={gridlines(span)}>
                <span className="sr-only">{row.when}</span>
                <Bars row={row} months={span} />
              </div>
              <p className="mt-1.5 text-[0.8125rem] leading-[1.4] text-fg-3">{row.costText}</p>
            </li>
          ))}
        </ol>
        {total ? (
          <div className="border-t border-rule pt-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-fg">{t("Total", "Total")}</p>
              <p className="text-right text-[0.8125rem] font-medium text-fg-2">{total.hoursText}</p>
            </div>
            <p className="mt-1 text-[0.8125rem] leading-[1.4] text-fg-3">
              {total.costText}
              {total.note ? ` ${total.note}` : null}
            </p>
          </div>
        ) : null}
      </div>

      {legend ? (
        <ul
          aria-hidden
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs leading-[1.3] text-fg-3"
        >
          {hasStart ? (
            <li className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-[2px] bg-brand-line" />
              {t("we start here", "începem aici")}
            </li>
          ) : null}
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-[2px] bg-[color-mix(in_srgb,var(--vx-fg)_30%,var(--vx-s1))]" />
            {t("build", "implementare")}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-fg-4" />
            {t("running", "în funcțiune")}
          </li>
          {hasMilestone ? (
            <li className="inline-flex items-center gap-1.5">
              <span className="size-2 rotate-45 bg-fg" />
              {t("website live", "site online")}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The bars of one row: 8 px, 2 px corners, 30% of the text colour mixed onto
 * the panel (opaque, so the month gridlines never show through); a dashed
 * "running" line to the end of the plan.
 */
function Bars({ row, months }: { row: GanttRow; months: number }) {
  const pct = (month: number) => `${(Math.min(Math.max(month, 0), months) / months) * 100}%`;
  if (!row.segments.length) {
    return row.empty ? (
      <span
        aria-hidden
        className="absolute inset-y-0 left-1.5 flex items-center text-[0.8125rem] text-fg-3"
      >
        {row.empty}
      </span>
    ) : null;
  }
  const lastEnd = row.segments[row.segments.length - 1][1];
  // The dashed "running" line fills the gaps after each bar, never under one.
  const gaps = row.segments
    .map(([, to], i) => {
      const next = row.segments[i + 1];
      return [to, next ? next[0] - 1 : months] as const;
    })
    .filter(([from, to]) => to > from);

  return (
    <span aria-hidden className="absolute inset-0">
      {gaps.map(([from, to]) => (
        <span
          key={`gap-${from}`}
          className="absolute top-1/2 h-0 border-t border-dashed border-fg-4"
          style={{ left: pct(from), width: pct(to - from) }}
        />
      ))}
      {row.segments.map(([from, to]) => (
        <span
          key={`${from}-${to}`}
          className={cn(
            "absolute top-1/2 h-2 -translate-y-1/2 rounded-[2px]",
            row.start ? "bg-brand-line" : "bg-[color-mix(in_srgb,var(--vx-fg)_30%,var(--vx-s1))]",
          )}
          style={{
            left: `calc(${pct(from - 1)} + 2px)`,
            width: `calc(${pct(to - from + 1)} - 4px)`,
          }}
        />
      ))}
      {row.milestone ? (
        <span
          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-fg"
          style={{ left: `calc(${pct(lastEnd)} - 2px)` }}
        />
      ) : null}
    </span>
  );
}

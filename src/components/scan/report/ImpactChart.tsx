import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";

import { useI18n } from "@/i18n";
import type { ProjectionPoint } from "@/lib/scan/types";
import { cn } from "@/lib/utils";
import { compactNumber, formatRange, formatNumber, midpoint } from "./format";
import { EASE_OUT, useScanMotion } from "./motion";
import { findPayback, projectionUntil } from "./projection";

/* Series colours validated for a 2-series chart on the #070a1f surface
   (OKLCH lightness band, CVD and contrast checks): brand mint and violet. */
const SAVINGS = "#1fa898";
const COST = "#6c63ff";

type Datum = {
  month: number;
  savings: { low: number; high: number; mid: number };
  cost: { low: number; high: number; mid: number };
};

function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round the top of the axis up to a friendly value (1, 2, 2.5, 5 × 10ⁿ). */
function niceCeil(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const n = value / power;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * power;
}

/** Axis top and 3–6 evenly spaced ticks that land on friendly numbers. */
function niceTicks(value: number) {
  const max = niceCeil(value);
  for (const count of [5, 4, 6, 3]) {
    const step = max / count;
    const n = step / 10 ** Math.floor(Math.log10(step));
    if ([1, 2, 2.5, 5].some((nice) => Math.abs(n - nice) < 1e-9)) {
      return { max, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
    }
  }
  return { max, ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => f * max) };
}

function monthTicks(first: number, last: number) {
  const span = last - first;
  if (span <= 6) return Array.from({ length: span + 1 }, (_, i) => first + i);
  const step = span <= 12 ? 3 : 6;
  const ticks = [first];
  for (let m = step; m <= last; m += step) if (m > first) ticks.push(m);
  if (ticks[ticks.length - 1] !== last) ticks.push(last);
  return ticks;
}

/**
 * Cumulative savings vs. cost (both as estimate bands with a midline) over the
 * chosen horizon, with the payback point marked. Lines draw on when the chart
 * scrolls into view and again when the horizon changes. Hover, touch or the
 * arrow keys read out any month; a table view carries every value.
 */
export function ImpactChart({
  projection,
  horizon,
  className,
}: {
  projection: ProjectionPoint[];
  horizon: number;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const { reduce } = useScanMotion();
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(560);
  const inView = useInView(wrapRef, { once: true, margin: "0px 0px -60px 0px" });
  const titleId = useId();
  const descId = useId();
  const clipId = `impact-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [active, setActive] = useState<number | null>(null);

  const data: Datum[] = useMemo(
    () =>
      projectionUntil(projection, horizon).map((p) => ({
        month: p.month,
        savings: { ...p.cumulativeSavingsRon, mid: midpoint(p.cumulativeSavingsRon) },
        cost: { ...p.cumulativeCostRon, mid: midpoint(p.cumulativeCostRon) },
      })),
    [projection, horizon],
  );
  const payback = useMemo(
    () => findPayback(projectionUntil(projection, horizon)),
    [projection, horizon],
  );

  useEffect(() => setActive(null), [horizon]);

  if (data.length < 2) {
    return (
      <p
        className={cn(
          "type-body-sm rounded-2xl border border-dashed border-white/12 p-6 text-white/55",
          className,
        )}
      >
        {t(
          "There isn't enough data to project savings for this business yet.",
          "Nu avem încă destule date ca să estimăm economiile acestei afaceri.",
        )}
      </p>
    );
  }

  const narrow = width < 440;
  const height = narrow ? 230 : 270;
  // The right margin holds the mono line labels ("ECONOMII").
  const m = { top: 30, right: narrow ? 66 : 76, bottom: 30, left: narrow ? 38 : 46 };
  const innerW = Math.max(width - m.left - m.right, 40);
  const innerH = height - m.top - m.bottom;
  const first = data[0].month;
  const last = data[data.length - 1].month;
  const { max: yMax, ticks: yTicks } = niceTicks(
    Math.max(...data.map((d) => Math.max(d.savings.high, d.cost.high))) * 1.05,
  );
  const x = (month: number) => m.left + ((month - first) / Math.max(last - first, 1)) * innerW;
  const y = (value: number) => m.top + innerH - (value / yMax) * innerH;
  const xTicks = monthTicks(first, last);

  const line = (pick: (d: Datum) => number) =>
    data
      .map((d, i) => `${i ? "L" : "M"}${x(d.month).toFixed(1)},${y(pick(d)).toFixed(1)}`)
      .join(" ");
  const band = (hi: (d: Datum) => number, lo: (d: Datum) => number) =>
    `${line(hi)} ${[...data]
      .reverse()
      .map((d) => `L${x(d.month).toFixed(1)},${y(lo(d)).toFixed(1)}`)
      .join(" ")} Z`;

  const end = data[data.length - 1];
  // Direct labels at the line ends, nudged apart when they'd overlap.
  let savingsLabelY = y(end.savings.mid);
  let costLabelY = y(end.cost.mid);
  if (Math.abs(savingsLabelY - costLabelY) < 16) {
    const midY = (savingsLabelY + costLabelY) / 2;
    const up = savingsLabelY <= costLabelY;
    savingsLabelY = midY + (up ? -9 : 9);
    costLabelY = midY + (up ? 9 : -9);
  }

  const paybackX = payback !== null && payback <= last ? x(Math.max(payback, first)) : null;
  const paybackLabel =
    payback !== null
      ? `${t("Break-even", "Recuperare")} ≈ ${lang === "ro" ? "L" : "M"}${formatNumber(payback, lang, 1)}`
      : "";
  // Half the label pill: about 7.4px per mono character at type-tech, plus padding.
  const pillHalf = Math.round(paybackLabel.length * 3.7 + 9);
  const ron = (r: { low: number; high: number }) => `${formatRange(r, lang)} RON`;
  const monthLabel = (month: number) => (lang === "ro" ? `Luna ${month}` : `Month ${month}`);
  const activeDatum = active !== null ? data[active] : null;
  const drawn = inView || reduce;

  const summary =
    lang === "ro"
      ? `Până în luna ${last}: economii cumulate estimate ${ron(end.savings)}, cost cumulat ${ron(end.cost)}.` +
        (payback !== null && payback <= last
          ? ` Economiile depășesc costul în jurul lunii ${formatNumber(payback, lang, 1)} a planului.`
          : ` Economiile nu depășesc costul în primele ${last} ${last >= 20 ? "de " : ""}luni.`)
      : `By month ${last}: estimated cumulative savings ${ron(end.savings)}, cumulative cost ${ron(end.cost)}.` +
        (payback !== null && payback <= last
          ? ` Savings overtake cost around month ${formatNumber(payback, lang, 1)} of the plan.`
          : ` Savings overtake cost after month ${last}.`);

  const indexFromClientX = (clientX: number, target: Element) => {
    const rect = target.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * width;
    const month = first + ((px - m.left) / innerW) * (last - first);
    let best = 0;
    data.forEach((d, i) => {
      if (Math.abs(d.month - month) < Math.abs(data[best].month - month)) best = i;
    });
    return best;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const dir = event.key === "ArrowRight" ? 1 : -1;
      setActive((current) =>
        Math.max(0, Math.min(data.length - 1, (current ?? (dir > 0 ? -1 : data.length)) + dir)),
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(data.length - 1);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  };

  const tooltipLeft = activeDatum ? Math.min(Math.max(x(activeDatum.month), 96), width - 96) : 0;

  return (
    <div className={cn("min-w-0", className)}>
      {/* Legend: line keys, values stay in text colour. */}
      <ul className="type-micro mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-white/70">
        <li className="inline-flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: SAVINGS }} />
          {t("Cumulative savings (estimate)", "Economii cumulate (estimare)")}
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: COST }} />
          {t("Cumulative cost (setup + tools)", "Cost cumulat (implementare + instrumente)")}
        </li>
      </ul>

      <div
        ref={wrapRef}
        tabIndex={0}
        role="group"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        className="relative rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89cbf6]/70"
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          className="block max-w-full touch-pan-y select-none"
          onPointerMove={(event) => setActive(indexFromClientX(event.clientX, event.currentTarget))}
          onPointerDown={(event) => setActive(indexFromClientX(event.clientX, event.currentTarget))}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setActive(null);
          }}
        >
          <title id={titleId}>
            {t(
              `Estimated savings vs. cost over ${last} months`,
              `Economii estimate față de cost, pe ${last} ${last >= 20 ? "de " : ""}luni`,
            )}
          </title>
          <desc id={descId}>{summary}</desc>
          <defs>
            <clipPath id={clipId}>
              <rect x={m.left} y={0} width={innerW + 2} height={height} />
            </clipPath>
          </defs>

          {/* Grid + y axis */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={m.left}
                x2={m.left + innerW}
                y1={y(tick)}
                y2={y(tick)}
                stroke="rgb(255 255 255 / 0.07)"
                strokeDasharray={tick === 0 ? undefined : "3 5"}
              />
              <text
                x={m.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="type-tech fill-white/40 tabular-nums"
              >
                {compactNumber(tick, lang)}
              </text>
            </g>
          ))}
          <text x={m.left - 8} y={m.top - 14} textAnchor="end" className="type-tech fill-white/40">
            RON
          </text>

          {/* X axis */}
          {xTicks.map((tick) => (
            <text
              key={tick}
              x={x(tick)}
              y={height - 10}
              textAnchor="middle"
              className="type-tech fill-white/40 tabular-nums"
            >
              {lang === "ro" ? `L${tick}` : `M${tick}`}
            </text>
          ))}

          <g clipPath={`url(#${clipId})`} key={`series-${horizon}`}>
            <motion.path
              d={band(
                (d) => d.cost.high,
                (d) => d.cost.low,
              )}
              fill={COST}
              initial={{ opacity: reduce ? 0.16 : 0 }}
              animate={{ opacity: drawn ? 0.16 : 0 }}
              transition={{ duration: 0.8, delay: reduce ? 0 : 0.5 }}
            />
            <motion.path
              d={band(
                (d) => d.savings.high,
                (d) => d.savings.low,
              )}
              fill={SAVINGS}
              initial={{ opacity: reduce ? 0.2 : 0 }}
              animate={{ opacity: drawn ? 0.2 : 0 }}
              transition={{ duration: 0.8, delay: reduce ? 0 : 0.7 }}
            />
            <motion.path
              d={line((d) => d.cost.mid)}
              fill="none"
              stroke={COST}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: reduce ? 1 : 0 }}
              animate={{ pathLength: drawn ? 1 : 0 }}
              transition={{ duration: reduce ? 0 : 1.3, ease: EASE_OUT }}
            />
            <motion.path
              d={line((d) => d.savings.mid)}
              fill="none"
              stroke={SAVINGS}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: reduce ? 1 : 0 }}
              animate={{ pathLength: drawn ? 1 : 0 }}
              transition={{ duration: reduce ? 0 : 1.5, ease: EASE_OUT, delay: reduce ? 0 : 0.15 }}
            />
          </g>

          {/* Direct labels */}
          <motion.g
            initial={{ opacity: reduce ? 1 : 0 }}
            animate={{ opacity: drawn ? 1 : 0 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 1.4 }}
          >
            <text
              x={x(end.month) + 8}
              y={savingsLabelY}
              dy="0.32em"
              className="type-tech fill-white/80"
            >
              {t("Savings", "Economii")}
            </text>
            <text
              x={x(end.month) + 8}
              y={costLabelY}
              dy="0.32em"
              className="type-tech fill-white/60"
            >
              {t("Cost", "Cost")}
            </text>
          </motion.g>

          {/* Payback marker */}
          {paybackX !== null && payback !== null && (
            <motion.g
              key={`payback-${horizon}`}
              initial={{ opacity: reduce ? 1 : 0 }}
              animate={{ opacity: drawn ? 1 : 0 }}
              transition={{ duration: 0.5, delay: reduce ? 0 : 1.2 }}
            >
              <line
                x1={paybackX}
                x2={paybackX}
                y1={m.top - 4}
                y2={m.top + innerH}
                stroke="rgb(255 255 255 / 0.35)"
                strokeDasharray="3 4"
              />
              <circle
                cx={paybackX}
                cy={y(
                  // Height of the crossing, read off the cost midline.
                  (() => {
                    const i = data.findIndex((d) => d.month >= payback);
                    if (i <= 0) return data[0].cost.mid;
                    const a = data[i - 1];
                    const b = data[i];
                    const f = (payback - a.month) / (b.month - a.month);
                    return a.cost.mid + f * (b.cost.mid - a.cost.mid);
                  })(),
                )}
                r={5}
                fill="#ffffff"
                stroke="#070a1f"
                strokeWidth={2}
              />
              <g
                transform={`translate(${Math.min(Math.max(paybackX, m.left + pillHalf), m.left + innerW - pillHalf)}, ${m.top - 16})`}
              >
                <rect
                  x={-pillHalf}
                  y={-10}
                  width={pillHalf * 2}
                  height={20}
                  rx={10}
                  fill="#0b0e26"
                  stroke="rgb(255 255 255 / 0.18)"
                />
                <text textAnchor="middle" dy="0.32em" className="type-tech fill-white">
                  {paybackLabel}
                </text>
              </g>
            </motion.g>
          )}

          {/* Crosshair */}
          {activeDatum && (
            <g pointerEvents="none">
              <line
                x1={x(activeDatum.month)}
                x2={x(activeDatum.month)}
                y1={m.top}
                y2={m.top + innerH}
                stroke="rgb(255 255 255 / 0.4)"
              />
              <circle
                cx={x(activeDatum.month)}
                cy={y(activeDatum.cost.mid)}
                r={4.5}
                fill={COST}
                stroke="#070a1f"
                strokeWidth={2}
              />
              <circle
                cx={x(activeDatum.month)}
                cy={y(activeDatum.savings.mid)}
                r={4.5}
                fill={SAVINGS}
                stroke="#070a1f"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        <AnimatePresence>
          {activeDatum && (
            <motion.div
              key="tooltip"
              aria-live="polite"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="type-micro pointer-events-none absolute top-1 z-10 w-48 -translate-x-1/2 rounded-xl border border-white/12 bg-[#0b0e26]/95 px-3 py-2 shadow-[0_16px_40px_-18px_rgb(0_0_0/0.9)] backdrop-blur"
              style={{ left: tooltipLeft }}
            >
              <p className="font-medium text-white/60">{monthLabel(activeDatum.month)}</p>
              <p className="mt-1 flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-0.5 w-3 rounded-full"
                  style={{ background: SAVINGS }}
                />
                <span className="font-semibold tabular-nums text-white">
                  {ron(activeDatum.savings)}
                </span>
              </p>
              <p className="type-tech pl-5 text-white/50">{t("savings", "economii")}</p>
              <p className="mt-1 flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: COST }} />
                <span className="font-semibold tabular-nums text-white">
                  {ron(activeDatum.cost)}
                </span>
              </p>
              <p className="type-tech pl-5 text-white/50">{t("cost", "cost")}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <details className="type-micro group mt-3 text-white/55">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89cbf6]/70 [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="transition-transform group-open:rotate-90">
            ›
          </span>
          {t("View the numbers as a table", "Vezi cifrele într-un tabel")}
        </summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-white/10">
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">{summary}</caption>
            <thead className="sticky top-0 bg-[#0b0e26] text-white/60">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("Month", "Luna")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("Savings (RON)", "Economii (RON)")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("Cost (RON)", "Cost (RON)")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.month} className="border-t border-white/[0.06] text-white/75">
                  <th scope="row" className="px-3 py-1.5 font-normal">
                    {d.month}
                  </th>
                  <td className="px-3 py-1.5">{formatRange(d.savings, lang)}</td>
                  <td className="px-3 py-1.5">{formatRange(d.cost, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

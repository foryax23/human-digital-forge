import { useEffect, useId, useRef, useState } from "react";

import { useI18n } from "@/i18n";
import { outOfWindowNote, type DisplayPlan, type Horizon } from "@/lib/scan/blueprint/display";
import { cn } from "@/lib/utils";
import { formatNumber, lei, monthLabel, pick } from "./format";

/*
 * The impact chart (spec §2.13): cumulative value of the hours won back
 * against cumulative cost, from displayPlan().series, so every point equals
 * the KPI strip and the table. The lines carry their own names, the gap before
 * the crossing is hatched ("Încă nerecuperat"), the gain after it is tinted
 * ("Câștig net"), and a dashed line marks the break-even. Labels are drawn at
 * the container's own width, so they never scale, and each one is left out
 * when there is no room for it. No draw-on, no hover readout: the KPI strip
 * and the table carry the values.
 */

type Point = { x: number; value: number; cost: number };
type Run = { kind: "gap" | "net"; points: Point[] };

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

/** Axis top and a step of 1 / 2 / 5 × 10ⁿ lei (never under 1.000), with a little headroom. */
function axis(max: number) {
  const target = Math.max(max * 1.04, 1000);
  const raw = target / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const n = raw / power;
  const step = Math.max(1000, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power);
  const top = Math.ceil(target / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

/** 6 → 1…6; 12 → 1, 3, 6, 9, 12; 24 → 1, 6, 12, 18, 24. */
function monthTicks(horizon: number) {
  if (horizon <= 6) return Array.from({ length: horizon }, (_, i) => i + 1);
  const step = horizon <= 12 ? 3 : 6;
  const ticks = [1];
  for (let m = step; m <= horizon; m += step) ticks.push(m);
  return ticks;
}

/** The points with the crossings put in, split into runs where cost is above (gap) or below (net). */
function runsOf(points: Point[]): Run[] {
  const dense: Point[] = [];
  points.forEach((p, i) => {
    dense.push(p);
    const next = points[i + 1];
    if (!next) return;
    const d0 = p.cost - p.value;
    const d1 = next.cost - next.value;
    if (d0 * d1 < 0) {
      const f = d0 / (d0 - d1);
      const level = p.value + f * (next.value - p.value);
      dense.push({ x: p.x + f * (next.x - p.x), value: level, cost: level });
    }
  });
  const runs: Run[] = [];
  let current: Point[] = [];
  let sign = 0;
  for (const p of dense) {
    const s = Math.sign(p.cost - p.value);
    if (s === 0) {
      if (sign !== 0) runs.push({ kind: sign > 0 ? "gap" : "net", points: [...current, p] });
      current = [p];
      sign = 0;
    } else if (sign === 0 || s === sign) {
      current.push(p);
      sign = s;
    }
  }
  if (sign !== 0 && current.length > 1)
    runs.push({ kind: sign > 0 ? "gap" : "net", points: current });
  return runs.filter((run) => run.points.length > 1);
}

/** Linear read of a series between points. */
function at(points: Point[], x: number, key: "value" | "cost") {
  const i = points.findIndex((p) => p.x >= x);
  if (i <= 0) return points[Math.max(i, 0)][key];
  const a = points[i - 1];
  const b = points[i];
  const f = (x - a.x) / (b.x - a.x || 1);
  return a[key] + f * (b[key] - a[key]);
}

export function ImpactChart({
  plan,
  horizon,
  className,
}: {
  plan: DisplayPlan;
  horizon: Horizon;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(440);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `impact-title-${uid}`;
  const descId = `impact-desc-${uid}`;
  const hatchId = `impact-hatch-${uid}`;

  const series = plan.series.filter((p) => p.month >= 1 && p.month <= horizon);
  if (series.length < 2) {
    return (
      <p className={cn("text-sm text-fg-3", className)}>
        {t(
          "There isn't enough data to chart this plan yet.",
          "Nu avem încă destule date ca să desenăm acest plan.",
        )}
      </p>
    );
  }

  const narrow = width < 400;
  const height = narrow ? 200 : 240;
  const m = { top: 20, right: narrow ? 76 : 104, bottom: 28, left: 36 };
  const innerW = Math.max(width - m.left - m.right, 40);
  const innerH = height - m.top - m.bottom;
  const last = series[series.length - 1].month;
  const { top, ticks } = axis(Math.max(...series.map((p) => Math.max(p.value, p.cost))));
  const x = (month: number) => m.left + ((month - 1) / Math.max(last - 1, 1)) * innerW;
  const y = (amount: number) => m.top + innerH - (amount / top) * innerH;

  const points: Point[] = series.map((p) => ({ x: p.month, value: p.value, cost: p.cost }));
  const path = (key: "value" | "cost") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const runs = runsOf(points);
  const polygon = (run: Run) => {
    const upper: "value" | "cost" = run.kind === "gap" ? "cost" : "value";
    const lower: "value" | "cost" = run.kind === "gap" ? "value" : "cost";
    const forward = run.points.map((p) => `${x(p.x).toFixed(1)},${y(p[upper]).toFixed(1)}`);
    const back = [...run.points]
      .reverse()
      .map((p) => `${x(p.x).toFixed(1)},${y(p[lower]).toFixed(1)}`);
    return `M${[...forward, ...back].join(" L")} Z`;
  };
  /** Pixel height of the band between the two lines at `month`. */
  const gapPx = (month: number, run: Run) =>
    Math.abs(y(at(run.points, month, "cost")) - y(at(run.points, month, "value")));

  /*
   * Area labels: a 12 px label is drawn only where the band between the two
   * lines holds its whole box (and is at least 28 px tall at its centre).
   * Candidates are scanned across the run; the label is left out when none fits.
   */
  const monthAt = (px: number) => 1 + ((px - m.left) / innerW) * Math.max(last - 1, 1);
  const fit = (run: Run, centre: number, labelW: number, half: number) => {
    const from = x(run.points[0].x);
    const to = x(run.points[run.points.length - 1].x);
    if (centre - labelW / 2 < from + 2 || centre + labelW / 2 > to - 2) return null;
    if (gapPx(monthAt(centre), run) < Math.max(28, 2 * half + 8)) return null;
    // The box must clear both lines at every sample; the band slopes, so take
    // the vertical range that works for all of them.
    let lo = -Infinity;
    let hi = Infinity;
    for (const k of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const mk = monthAt(centre + k * labelW);
      const a = y(at(run.points, mk, "cost"));
      const b = y(at(run.points, mk, "value"));
      lo = Math.max(lo, Math.min(a, b) + half + 1);
      hi = Math.min(hi, Math.max(a, b) - half - 1);
    }
    return hi >= lo ? { y: (lo + hi) / 2, room: (hi - lo) / 2 } : null;
  };
  const place = (run: Run, labelW: number, anchor: "middle" | "end", half = 7) => {
    const from = x(run.points[0].x);
    const to = x(run.points[run.points.length - 1].x);
    let best: { x: number; y: number; room: number } | null = null;
    for (let i = 0; i <= 24; i++) {
      const centre = from + labelW / 2 + ((to - from - labelW) * i) / 24;
      const hit = fit(run, centre, labelW, half);
      if (!hit) continue;
      // The gain label prefers the right end; the gap label the most room.
      if (!best || (anchor === "end" ? centre >= best.x : hit.room >= best.room)) {
        best = { x: centre, y: hit.y, room: hit.room };
      }
    }
    if (!best) return null;
    return { x: anchor === "end" ? best.x + labelW / 2 - 4 : best.x, y: best.y };
  };
  const textW = (text: string) => text.length * 6 + 6;

  const gapLabel = (() => {
    const text = t("Not yet recovered", "Încă nerecuperat");
    const run = runs
      .filter((r) => r.kind === "gap")
      .sort((p, q) => q.points.length - p.points.length)[0];
    const spot = run ? place(run, textW(text), "middle") : null;
    return spot ? { ...spot, text } : null;
  })();

  /* End labels, nudged apart when they would touch. */
  const end = series[series.length - 1];
  let valueY = y(end.value);
  let costY = y(end.cost);
  const valueName = t("Value of the hours", "Valoarea orelor");
  // Two lines when the name does not fit the right margin ("Valoarea" / "orelor").
  const valueLines = (() => {
    // 12 px DM Sans averages under 5.6 px a character.
    if (valueName.length * 5.6 + 4 <= m.right - 10) return [valueName];
    const words = valueName.split(" ");
    const cut = Math.max(1, Math.round(words.length / 2));
    return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")].filter(Boolean);
  })();
  // A two-line name needs more room from the "Cost" label.
  const apart = valueLines.length > 1 ? 30 : 16;
  if (Math.abs(valueY - costY) < apart) {
    const midY = (valueY + costY) / 2;
    const valueUp = valueY <= costY;
    valueY = midY + (valueUp ? -apart / 2 : apart / 2);
    costY = midY + (valueUp ? apart / 2 : -apart / 2);
  }

  /*
   * "Câștig net ≈ …" inside the gain near the right end; when the band slopes
   * too much for that, between the two end labels in the right margin, which
   * is where the gain is measured.
   */
  const netLabel = (() => {
    const run = runs.find((r) => r.kind === "net" && r.points[r.points.length - 1].x === last);
    if (!run || end.net <= 0) return null;
    const lines = [t("Net gain", "Câștig net"), `≈ ${pick(lei(end.net), lang)}`];
    const one = place(run, textW(lines.join(" ")), "end");
    if (one) return { ...one, anchor: "end" as const, lines: [lines.join(" ")] };
    const two = place(run, Math.max(...lines.map(textW)), "end", 13);
    if (two) return { ...two, anchor: "end" as const, lines };
    const fitsMargin = Math.max(...lines.map(textW)) <= m.right - 8;
    if (!fitsMargin || valueLines.length > 1 || costY - valueY < 28 + 28) return null;
    return { x: x(last) + 8, y: (valueY + costY) / 2, anchor: "start" as const, lines };
  })();

  /* Break-even inside the window: drawn at the month it is labelled with (the first
     month-end in profit), so the line sits on its tick, never a little before it. */
  const n = plan.breakEven.month;
  const crossing = n !== null && n <= last ? Math.min(Math.max(n, 1), last) : null;
  const crossingX = crossing !== null ? x(crossing) : null;
  const crossingY = crossing !== null ? y(at(points, crossing, "value")) : null;
  const note = outOfWindowNote(plan, horizon);

  const firstTick = (tick: number) =>
    tick === 1 ? pick(monthLabel(1), lang) : formatNumber(tick, lang);
  // "luna 1" is written out; a tick too close to it is left out.
  const firstW = firstTick(1).length * 6 + 8;
  const xTicks = monthTicks(last).filter((tick) => tick === 1 || x(tick) - 8 > x(1) + firstW);
  const summary = (() => {
    const value = pick(lei(end.value), lang);
    const cost = pick(lei(end.cost), lang);
    const month = pick(monthLabel(last), lang);
    const lead = t(
      `By ${month}: value of the hours ${value}, cost ${cost}.`,
      `Până în ${month}: valoarea orelor ${value}, cost ${cost}.`,
    );
    const close = note ? pick(note, lang) : `${pick(plan.text.conclusion, lang)}.`;
    return `${lead} ${close}`;
  })();

  return (
    <div ref={wrapRef} className={cn("relative min-w-0", className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        className="block max-w-full select-none"
      >
        <title id={titleId}>{pick(plan.text.chartLead, lang)}</title>
        <desc id={descId}>{summary}</desc>
        <defs>
          <pattern
            id={hatchId}
            width={5}
            height={5}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={5} className="stroke-fg/14" strokeWidth={1} />
          </pattern>
        </defs>

        {/* Grid and y axis, in thousands of lei. */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={m.left}
              x2={m.left + innerW}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-fg/6"
              strokeWidth={1}
            />
            <text
              x={m.left - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              className="type-num fill-fg-3 text-[11px]"
            >
              {formatNumber(tick / 1000, lang)}
            </text>
          </g>
        ))}
        <text x={m.left + 4} y={m.top + 12} className="fill-fg-3 text-[11px]">
          {t("thousand RON", "mii lei")}
        </text>

        {/* X axis. */}
        {xTicks.map((tick) => (
          <text
            key={tick}
            x={x(tick)}
            y={height - 8}
            textAnchor={tick === 1 ? "start" : "middle"}
            className="type-num fill-fg-3 text-[11px]"
          >
            {firstTick(tick)}
          </text>
        ))}
        {/* No axis title after the last tick: the first one already reads "luna 1". */}

        {/* Series and areas: a 200 ms fade when the window changes. */}
        <g key={horizon} className="duration-200 animate-in fade-in-0 motion-reduce:animate-none">
          {runs.map((run, i) => (
            <path
              key={`${run.kind}-${i}`}
              d={polygon(run)}
              fill={run.kind === "gap" ? `url(#${hatchId})` : undefined}
              className={run.kind === "net" ? "fill-brand-line/10" : undefined}
            />
          ))}
          <path
            d={path("cost")}
            fill="none"
            className="stroke-fg/45"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <path
            d={path("value")}
            fill="none"
            className="stroke-brand-line"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {gapLabel ? (
            <text
              x={gapLabel.x}
              y={gapLabel.y}
              dy="0.32em"
              textAnchor="middle"
              className="fill-fg-2 text-xs"
            >
              {gapLabel.text}
            </text>
          ) : null}
          {netLabel ? (
            <text
              x={netLabel.x}
              y={netLabel.y}
              textAnchor={netLabel.anchor}
              className="fill-brand-fg text-xs"
            >
              {netLabel.lines.map((line, i) => (
                <tspan
                  key={line}
                  x={netLabel.x}
                  dy={i > 0 ? "1.2em" : netLabel.lines.length > 1 ? "-0.28em" : "0.32em"}
                >
                  {line}
                </tspan>
              ))}
            </text>
          ) : null}

          <text x={x(last) + 8} y={valueY} className="fill-brand-line text-xs">
            {valueLines.map((line, i) => (
              <tspan
                key={`${i}-${line}`}
                x={x(last) + 8}
                // One line sits on the line end; two are centred on it.
                dy={i > 0 ? "1.2em" : valueLines.length > 1 ? "-0.28em" : "0.32em"}
              >
                {line}
              </tspan>
            ))}
          </text>
          <text x={x(last) + 8} y={costY} dy="0.32em" className="fill-fg-3 text-xs">
            {t("Cost", "Cost")}
          </text>

          {crossingX !== null && crossingY !== null && n !== null ? (
            <g>
              <line
                x1={crossingX}
                x2={crossingX}
                y1={m.top}
                y2={m.top + innerH}
                className="stroke-fg-3"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={crossingX}
                cy={crossingY}
                r={3}
                className="fill-s1 stroke-fg"
                strokeWidth={1.5}
              />
              <text
                x={Math.min(Math.max(crossingX, m.left + 24), m.left + innerW - 24)}
                y={m.top - 7}
                textAnchor="middle"
                className="fill-fg text-xs"
              >
                {pick(monthLabel(n), lang)}
              </text>
            </g>
          ) : null}
        </g>
      </svg>

      {/* Break-even outside the window: a plain note at the top right of the plot. */}
      {note ? (
        <p
          className="pointer-events-none absolute max-w-[60%] text-right text-xs leading-[1.35] text-fg-3"
          style={{ top: m.top + 2, right: m.right + 4 }}
        >
          {pick(note, lang)}
        </p>
      ) : null}
    </div>
  );
}

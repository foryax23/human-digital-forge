import type { ReactNode } from "react";

import {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import { outOfWindowNote, type DisplayPlan, type Horizon } from "@/lib/scan/blueprint/display";
import type { Lang } from "@/lib/scan/types";

import { f } from "./chart-math";
import { formatNumber, lei, monthLabel, NBSP, pick, tr } from "./format";
import { FONT, INK, text } from "./theme";

/*
 * Vector charts for the blueprint PDF, drawn like the scan screens: flat
 * fills, one accent, labels on the marks instead of legends, no gradients.
 */

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

/* ------------------------------------------------------------------- bars */

/** Horizontal 0–100 bar: a flat fill on a light track. */
export function ScoreBar({
  value,
  width,
  height = 4,
  color = INK.body,
}: {
  value: number | undefined;
  width: number;
  height?: number;
  color?: string;
}) {
  const v = value === undefined ? 0 : clamp(value);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={0} y={0} width={width} height={height} rx={1} fill={INK.track} />
      {value !== undefined && v > 0 ? (
        <Rect
          x={0}
          y={0}
          width={f(Math.max(height, (width * v) / 100))}
          height={height}
          rx={1}
          fill={color}
        />
      ) : null}
    </Svg>
  );
}

/* ------------------------------------------------------------------ gantt */

export type GanttRow = {
  key: string;
  /** The stage name, exactly as in the phase rows, the strategy cards and the screens. */
  name: string;
  /** Plan months the bar covers, inclusive. */
  months: [number, number];
  /** The starting stage: violet bar. */
  start?: boolean;
  /** A diamond at the end of the bar ("site online"). */
  milestone?: boolean;
  /** null: the stage brings enquiries, not hours (the cell shows "–"). */
  hours: number | null;
  /** One-off cost in lei. */
  cost: number;
};

export type GanttTotal = { hours: number; cost: number; note?: string };

const GANTT = { month: 34, hours: 46, cost: 62, row: 20 } as const;

/**
 * The plan as a month-by-month calendar table (spec §2.13): one row per stage
 * with its bar, hours a month and one-off cost, then the Total row. Figures
 * arrive rounded from displayPlan(), so rows add up to the total.
 */
export function Gantt({
  rows,
  months,
  total,
  width,
  lang,
}: {
  rows: GanttRow[];
  months: number;
  total?: GanttTotal;
  width: number;
  lang: Lang;
}) {
  const t = tr(lang);
  const track = months * GANTT.month;
  const nameW = width - track - GANTT.hours - GANTT.cost;
  const hoursCell = (hours: number | null) =>
    hours === null ? "–" : hours === 0 ? "< 5" : `≈${NBSP}${formatNumber(hours, lang)}`;
  const head = { ...text.label, fontSize: 6.8 };
  const hasStart = rows.some((r) => r.start);
  const hasMilestone = rows.some((r) => r.milestone);

  return (
    <View wrap={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          paddingBottom: 4,
          borderBottomWidth: 0.75,
          borderBottomColor: INK.rule,
        }}
      >
        <Text style={{ ...head, width: nameW }}>{t("Stage", "Etapă")}</Text>
        {Array.from({ length: months }, (_, i) => (
          <Text key={i} style={{ ...head, width: GANTT.month, paddingLeft: 3 }}>
            {i === 0 ? t("Month 1", "Luna 1") : String(i + 1)}
          </Text>
        ))}
        <Text style={{ ...head, width: GANTT.hours, textAlign: "right" }}>
          {t("Hours / month", "Ore / lună")}
        </Text>
        <Text style={{ ...head, width: GANTT.cost, textAlign: "right" }}>
          {t("One-off, RON", "Cost unic, lei")}
        </Text>
      </View>

      {rows.map((row, index) => (
        <View
          key={row.key}
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: GANTT.row,
            borderBottomWidth: 0.5,
            borderBottomColor: INK.hairline,
          }}
        >
          <View style={{ width: nameW, flexDirection: "row", paddingVertical: 4, paddingRight: 8 }}>
            <Text style={{ fontFamily: FONT.display, fontSize: 7.6, color: INK.muted, width: 10 }}>
              {index + 1}
            </Text>
            <Text style={{ fontFamily: FONT.body, fontSize: 7.8, color: INK.strong, flex: 1 }}>
              {row.name}
            </Text>
          </View>
          <GanttBars row={row} months={months} />
          <Text style={{ ...text.num, width: GANTT.hours, textAlign: "right" }}>
            {hoursCell(row.hours)}
          </Text>
          <Text style={{ ...text.num, width: GANTT.cost, textAlign: "right" }}>
            {row.cost > 0 ? formatNumber(row.cost, lang) : "–"}
          </Text>
        </View>
      ))}

      {total ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: GANTT.row,
            borderTopWidth: 0.75,
            borderTopColor: INK.rule,
            marginTop: -0.5,
          }}
        >
          <Text
            style={{
              fontFamily: FONT.body,
              fontWeight: 500,
              fontSize: 7.8,
              color: INK.strong,
              width: nameW,
            }}
          >
            {t("Total", "Total")}
          </Text>
          <Text style={{ ...text.small, width: track, paddingLeft: 3, paddingVertical: 4 }}>
            {total.note ?? ""}
          </Text>
          <Text style={{ ...text.num, fontWeight: 700, width: GANTT.hours, textAlign: "right" }}>
            {hoursCell(total.hours)}
          </Text>
          <Text style={{ ...text.num, fontWeight: 700, width: GANTT.cost, textAlign: "right" }}>
            {formatNumber(total.cost, lang)}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
        {hasStart ? (
          <LegendItem label={t("we start here", "începem aici")}>
            <View
              style={{ width: 11, height: 5, borderRadius: 1.2, backgroundColor: INK.violet }}
            />
          </LegendItem>
        ) : null}
        <LegendItem label={t("build", "implementare")}>
          <View style={{ width: 11, height: 5, borderRadius: 1.2, backgroundColor: INK.bar }} />
        </LegendItem>
        <LegendItem label={t("running", "în funcțiune")}>
          <View
            style={{
              width: 11,
              height: 0,
              borderTopWidth: 0.7,
              borderTopColor: INK.muted,
              borderStyle: "dashed",
            }}
          />
        </LegendItem>
        {hasMilestone ? (
          <LegendItem label={t("website live", "site online")}>
            <Svg width={6} height={6} viewBox="0 0 6 6">
              <Polygon points="3,0 6,3 3,6 0,3" fill={INK.strong} />
            </Svg>
          </LegendItem>
        ) : null}
      </View>
    </View>
  );
}

function LegendItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 12 }}>
      {children}
      <Text style={{ ...text.tiny, marginLeft: 4 }}>{label}</Text>
    </View>
  );
}

/** One row's track: month gridlines, the bar, the dashed "running" line, the milestone. */
function GanttBars({ row, months }: { row: GanttRow; months: number }) {
  const w = months * GANTT.month;
  const h = GANTT.row;
  const mid = h / 2;
  const [from, to] = row.months;
  const x0 = (Math.max(1, from) - 1) * GANTT.month + 1.5;
  const x1 = Math.min(months, to) * GANTT.month - 1.5;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {Array.from({ length: months - 1 }, (_, i) => (
        <Line
          key={i}
          x1={(i + 1) * GANTT.month}
          x2={(i + 1) * GANTT.month}
          y1={0}
          y2={h}
          stroke={INK.track}
          strokeWidth={0.6}
        />
      ))}
      {to < months ? (
        <Line
          x1={f(x1 + 1.5)}
          x2={w}
          y1={mid}
          y2={mid}
          stroke={INK.muted}
          strokeWidth={0.6}
          strokeDasharray="1.6 1.6"
        />
      ) : null}
      <Rect
        x={f(x0)}
        y={mid - 3}
        width={f(Math.max(2, x1 - x0))}
        height={6}
        rx={1.2}
        fill={row.start ? INK.violet : INK.bar}
      />
      {row.milestone ? (
        <Polygon
          points={`${f(x1)},${mid - 3.4} ${f(x1 + 3.4)},${mid} ${f(x1)},${mid + 3.4} ${f(x1 - 3.4)},${mid}`}
          fill={INK.strong}
        />
      ) : null}
    </Svg>
  );
}

/* ----------------------------------------------------------------- impact */

type Point = { x: number; value: number; cost: number };
type Run = { kind: "gap" | "net"; points: Point[] };

/** Axis top and a step of 1 / 2 / 5 × 10ⁿ lei (never under 1.000), as on the screen. */
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
      const k = d0 / (d0 - d1);
      const level = p.value + k * (next.value - p.value);
      dense.push({ x: p.x + k * (next.x - p.x), value: level, cost: level });
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
  const k = (x - a.x) / (b.x - a.x || 1);
  return a[key] + k * (b[key] - a[key]);
}

/** 7 pt DM Sans averages about 3.6 pt a character. */
const textW = (value: string) => value.length * 3.6 + 4;

/**
 * The impact chart (spec §6): cumulative value of the hours won back against
 * cumulative cost, from displayPlan().series, so every point equals the KPI
 * strip and the table. The lines carry their names; the gap before the
 * crossing is hatched ("Încă nerecuperat": react-pdf has no <pattern>, so
 * diagonal lines are clipped to the gap); the gain after it is tinted ("Câștig
 * net"); a dashed line marks the break-even. Each area label is left out when
 * the band is too thin to hold it.
 */
export function ImpactChart({
  plan,
  horizon,
  width,
  height,
  lang,
}: {
  plan: DisplayPlan;
  horizon: Horizon;
  width: number;
  height: number;
  lang: Lang;
}) {
  const t = tr(lang);
  const series = plan.series.filter((p) => p.month >= 1 && p.month <= horizon);
  if (series.length < 2) return null;

  const m = { top: 18, right: 72, bottom: 20, left: 26 };
  const innerW = width - m.left - m.right;
  const innerH = height - m.top - m.bottom;
  const last = series[series.length - 1].month;
  const { top, ticks } = axis(Math.max(...series.map((p) => Math.max(p.value, p.cost))));
  const x = (month: number) => m.left + ((month - 1) / Math.max(last - 1, 1)) * innerW;
  const y = (amount: number) => m.top + innerH - (amount / top) * innerH;

  const points: Point[] = series.map((p) => ({ x: p.month, value: p.value, cost: p.cost }));
  const line = (key: "value" | "cost") =>
    points.map((p) => `${f(x(p.x))},${f(y(p[key]))}`).join(" ");
  const runs = runsOf(points);
  const outline = (run: Run) => {
    const upper: "value" | "cost" = run.kind === "gap" ? "cost" : "value";
    const lower: "value" | "cost" = run.kind === "gap" ? "value" : "cost";
    const forward = run.points.map((p) => `${f(x(p.x))},${f(y(p[upper]))}`);
    const back = [...run.points].reverse().map((p) => `${f(x(p.x))},${f(y(p[lower]))}`);
    return `M${[...forward, ...back].join(" L")} Z`;
  };

  /* Area labels: drawn only where the band holds the whole label box. */
  const monthAt = (px: number) => 1 + ((px - m.left) / innerW) * Math.max(last - 1, 1);
  const half = 4.5;
  const fit = (run: Run, centre: number, labelW: number, rows = 1) => {
    const from = x(run.points[0].x);
    const to = x(run.points[run.points.length - 1].x);
    if (centre - labelW / 2 < from + 2 || centre + labelW / 2 > to - 2) return null;
    const h = half * rows;
    let lo = -Infinity;
    let hi = Infinity;
    for (const k of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const mk = monthAt(centre + k * labelW);
      const a = y(at(run.points, mk, "cost"));
      const b = y(at(run.points, mk, "value"));
      lo = Math.max(lo, Math.min(a, b) + h + 1.5);
      hi = Math.min(hi, Math.max(a, b) - h - 1.5);
    }
    return hi >= lo ? { y: (lo + hi) / 2, room: (hi - lo) / 2 } : null;
  };
  const place = (run: Run, labelW: number, prefer: "room" | "end", rows = 1) => {
    const from = x(run.points[0].x);
    const to = x(run.points[run.points.length - 1].x);
    let best: { x: number; y: number; room: number } | null = null;
    for (let i = 0; i <= 24; i++) {
      const centre = from + labelW / 2 + ((to - from - labelW) * i) / 24;
      const hit = fit(run, centre, labelW, rows);
      if (!hit) continue;
      if (!best || (prefer === "end" ? centre >= best.x : hit.room >= best.room)) {
        best = { x: centre, y: hit.y, room: hit.room };
      }
    }
    return best;
  };

  const gapLabel = (() => {
    const label = t("Not yet recovered", "Încă nerecuperat");
    const run = runs
      .filter((r) => r.kind === "gap")
      .sort((p, q) => q.points.length - p.points.length)[0];
    const spot = run ? place(run, textW(label), "room") : null;
    return spot ? { ...spot, label, w: textW(label) } : null;
  })();

  const end = series[series.length - 1];
  // One line where the gain is wide enough, else two ("Câștig net" / "≈ 19.000 lei").
  const netLabel = (() => {
    const run = runs.find((r) => r.kind === "net" && r.points[r.points.length - 1].x === last);
    if (!run || end.net <= 0) return null;
    const lines = [t("Net gain", "Câștig net"), `≈${NBSP}${pick(lei(end.net), lang)}`];
    const one = place(run, textW(lines.join(" ")), "end");
    if (one) return { ...one, lines: [lines.join(" ")], w: textW(lines.join(" ")) };
    const w = Math.max(...lines.map(textW));
    const two = place(run, w, "end", 2);
    return two ? { ...two, lines, w } : null;
  })();

  /* End labels, nudged apart when they would touch. */
  let valueY = y(end.value);
  let costY = y(end.cost);
  if (Math.abs(valueY - costY) < 11) {
    const midY = (valueY + costY) / 2;
    const up = valueY <= costY;
    valueY = midY + (up ? -5.5 : 5.5);
    costY = midY + (up ? 5.5 : -5.5);
  }

  /* Break-even inside the window, or a plain note when it falls after it. */
  const n = plan.breakEven.month;
  const crossing =
    n !== null && n <= last && plan.breakEven.x !== null
      ? Math.min(Math.max(plan.breakEven.x, 1), last)
      : null;
  // After the window: a plain note. Never within 24 months: the page title already says so.
  const note = n !== null ? outOfWindowNote(plan, horizon) : null;

  const firstTick = (tick: number) =>
    tick === 1 ? pick(monthLabel(1), lang) : formatNumber(tick, lang);
  const firstW = textW(firstTick(1));
  const xTicks = monthTicks(last).filter((tick) => tick === 1 || x(tick) - 6 > x(1) + firstW);
  const tick = { fontFamily: FONT.display, fontSize: 6.4, color: INK.muted } as const;
  const small = { fontFamily: FONT.body, fontSize: 7 } as const;

  return (
    <View style={{ width, height, position: "relative" }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          {runs.map((run, i) =>
            run.kind === "gap" ? (
              <ClipPath key={i} id={`gap-${i}`}>
                <Path d={outline(run)} />
              </ClipPath>
            ) : null,
          )}
        </Defs>
        {ticks.map((value) => (
          <Line
            key={value}
            x1={m.left}
            x2={m.left + innerW}
            y1={f(y(value))}
            y2={f(y(value))}
            stroke={value === 0 ? INK.line : INK.hairline}
            strokeWidth={0.5}
          />
        ))}
        {runs.map((run, i) => {
          if (run.kind === "net") {
            return <Path key={i} d={outline(run)} fill={INK.violet} fillOpacity={0.1} />;
          }
          // Hatch: 45° lines 4 pt apart over the gap's box, clipped to the gap.
          const xs = run.points.map((p) => x(p.x));
          const ys = run.points.flatMap((p) => [y(p.value), y(p.cost)]);
          const x0 = Math.min(...xs);
          const x1 = Math.max(...xs);
          const y0 = Math.min(...ys);
          const y1 = Math.max(...ys);
          const span = y1 - y0;
          const hatch: number[] = [];
          for (let s = x0 - span; s <= x1; s += 4) hatch.push(s);
          return (
            <G key={i} clipPath={`url(#gap-${i})`}>
              {hatch.map((s) => (
                <Line
                  key={s}
                  x1={f(s)}
                  y1={f(y1)}
                  x2={f(s + span)}
                  y2={f(y0)}
                  stroke={INK.strong}
                  strokeOpacity={0.22}
                  strokeWidth={0.5}
                />
              ))}
            </G>
          );
        })}
        <Polyline
          points={line("cost")}
          stroke={INK.strong}
          strokeOpacity={0.45}
          strokeWidth={1.1}
          strokeLinejoin="round"
          fill="none"
        />
        <Polyline
          points={line("value")}
          stroke={INK.violet}
          strokeWidth={1.6}
          strokeLinejoin="round"
          fill="none"
        />
        {crossing !== null ? (
          <G>
            <Line
              x1={f(x(crossing))}
              x2={f(x(crossing))}
              y1={m.top}
              y2={m.top + innerH}
              stroke={INK.muted}
              strokeWidth={0.6}
              strokeDasharray="2 2"
            />
            <Circle
              cx={f(x(crossing))}
              cy={f(y(at(points, crossing, "value")))}
              r={2.4}
              fill={INK.white}
              stroke={INK.strong}
              strokeWidth={1}
            />
          </G>
        ) : null}
      </Svg>

      {ticks.map((value) => (
        <Text
          key={value}
          style={{
            ...tick,
            position: "absolute",
            left: 0,
            width: m.left - 5,
            textAlign: "right",
            top: y(value) - 3.6,
          }}
        >
          {formatNumber(value / 1000, lang)}
        </Text>
      ))}
      <Text
        style={{
          ...tick,
          fontFamily: FONT.body,
          position: "absolute",
          left: m.left + 3,
          top: m.top + 1,
        }}
      >
        {t("thousand RON", "mii lei")}
      </Text>
      {xTicks.map((value) => (
        <Text
          key={value}
          style={{
            ...tick,
            position: "absolute",
            top: m.top + innerH + 6,
            left: value === 1 ? x(1) : x(value) - 10,
            width: value === 1 ? firstW + 4 : 20,
            textAlign: value === 1 ? "left" : "center",
          }}
        >
          {firstTick(value)}
        </Text>
      ))}
      <Text
        style={{
          ...tick,
          fontFamily: FONT.body,
          position: "absolute",
          top: m.top + innerH + 6,
          left: x(last) + 12,
        }}
      >
        {t("month", "luna")}
      </Text>

      <Text
        style={{
          ...small,
          color: INK.violet,
          position: "absolute",
          left: x(last) + 6,
          top: valueY - 4.2,
        }}
      >
        {t("Value of the hours", "Valoarea orelor")}
      </Text>
      <Text
        style={{
          ...small,
          color: INK.muted,
          position: "absolute",
          left: x(last) + 6,
          top: costY - 4.2,
        }}
      >
        {t("Cost", "Cost")}
      </Text>

      {gapLabel ? (
        <Text
          style={{
            ...small,
            color: INK.body,
            position: "absolute",
            left: gapLabel.x - gapLabel.w / 2,
            width: gapLabel.w,
            textAlign: "center",
            top: gapLabel.y - half,
          }}
        >
          {gapLabel.label}
        </Text>
      ) : null}
      {netLabel ? (
        <Text
          style={{
            ...small,
            lineHeight: 1.25,
            color: INK.violet,
            position: "absolute",
            left: netLabel.x - netLabel.w / 2,
            width: netLabel.w,
            textAlign: "center",
            top: netLabel.y - half * netLabel.lines.length,
          }}
        >
          {netLabel.lines.join("\n")}
        </Text>
      ) : null}
      {crossing !== null && n !== null ? (
        <Text
          style={{
            ...small,
            color: INK.strong,
            position: "absolute",
            top: m.top - 11,
            left: x(crossing) - 30,
            width: 60,
            textAlign: "center",
          }}
        >
          {pick(monthLabel(n), lang)}
        </Text>
      ) : note ? (
        <Text
          style={{
            ...small,
            color: INK.muted,
            position: "absolute",
            top: m.top + 2,
            right: m.right + 4,
            width: 200,
            textAlign: "right",
          }}
        >
          {pick(note, lang)}
        </Text>
      ) : null}
    </View>
  );
}

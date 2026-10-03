import type { ReactNode } from "react";

import {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import type { Lang, ProjectionPoint, Range, Severity } from "@/lib/scan/types";

import { arcBand, breakEvenMonth, f, polar } from "./chart-math";
import { formatCompact, formatDecimal, midpoint } from "./format";
import { BRAND, FONT, INK, NIGHT_INK } from "./theme";

/*
 * Vector charts for the blueprint PDF. react-pdf fills (not strokes) accept
 * gradients, so arcs are drawn as filled bands rather than stroked paths.
 */

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

/* ------------------------------------------------------------------- gauge */

const GAUGE_START = -120;
const GAUGE_SWEEP = 240;

/** 240° score gauge with a gradient value band, ticks and the score in the middle. */
export function Gauge({
  id,
  value,
  size = 128,
}: {
  id: string;
  /** null when the score couldn't be measured: an empty dial with a dash. */
  value: number | null;
  size?: number;
}) {
  const v = value === null ? 0 : clamp(Math.round(value));
  const cx = size / 2;
  const cy = size / 2 + size * 0.04;
  const r = size / 2 - size * 0.11;
  const thickness = size * 0.09;
  const end = GAUGE_START + (GAUGE_SWEEP * v) / 100;
  const [kx, ky] = polar(cx, cy, r, end);
  const ticks = Array.from({ length: 25 }, (_, i) => i);

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id={`${id}-g`} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={BRAND.violet} />
            <Stop offset="0.55" stopColor={BRAND.blue} />
            <Stop offset="1" stopColor={BRAND.sky} />
          </LinearGradient>
        </Defs>
        {ticks.map((i) => {
          const deg = GAUGE_START + (GAUGE_SWEEP * i) / 24;
          const major = i % 6 === 0;
          const [x1, y1] = polar(cx, cy, r + thickness / 2 + size * 0.025, deg);
          const [x2, y2] = polar(cx, cy, r + thickness / 2 + size * (major ? 0.065 : 0.045), deg);
          const lit = (i / 24) * 100 <= v;
          return (
            <Line
              key={i}
              x1={f(x1)}
              y1={f(y1)}
              x2={f(x2)}
              y2={f(y2)}
              stroke={lit ? BRAND.violet : INK.hairline}
              strokeOpacity={lit ? (major ? 0.9 : 0.45) : 1}
              strokeWidth={major ? 1 : 0.6}
              strokeLinecap="round"
            />
          );
        })}
        <Path
          d={arcBand(cx, cy, r, thickness, GAUGE_START, GAUGE_START + GAUGE_SWEEP)}
          fill={INK.track}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={r - thickness / 2 - size * 0.055}
          stroke={INK.hairline}
          strokeWidth={0.6}
          strokeDasharray="1 2.4"
          fill="none"
        />
        {v > 0 ? (
          <Path d={arcBand(cx, cy, r, thickness, GAUGE_START, end)} fill={`url(#${id}-g)`} />
        ) : null}
        {value !== null ? (
          <Circle
            cx={f(kx)}
            cy={f(ky)}
            r={thickness * 0.72}
            fill={INK.white}
            stroke={BRAND.violet}
            strokeWidth={1.4}
          />
        ) : null}
      </Svg>
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: cy - size * 0.17,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: size * 0.25,
            color: value === null ? INK.faint : INK.strong,
            lineHeight: 1,
          }}
        >
          {value === null ? "–" : v}
        </Text>
        <Text
          style={{
            fontFamily: FONT.display,
            fontWeight: 500,
            fontSize: Math.max(5.2, size * 0.058),
            color: INK.faint,
            marginTop: size * 0.02,
            letterSpacing: 0.8,
          }}
        >
          / 100
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------- bars */

/** Horizontal 0–100 bar with a gradient fill on a soft track. */
export function ScoreBar({
  id,
  value,
  width,
  height = 6,
  track = INK.track,
}: {
  id: string;
  value: number | undefined;
  width: number;
  height?: number;
  track?: string;
}) {
  const v = value === undefined ? 0 : clamp(value);
  const w = Math.max(height, (width * v) / 100);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={BRAND.violet} />
          <Stop offset="1" stopColor={BRAND.sky} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} rx={height / 2} fill={track} />
      {value !== undefined && v > 0 ? (
        <Rect x={0} y={0} width={w} height={height} rx={height / 2} fill={`url(#${id}-b)`} />
      ) : null}
    </Svg>
  );
}

/** Low–high range on a shared scale: a soft band with solid end caps. */
export function RangeBar({
  range,
  max,
  width,
  color = BRAND.violet,
}: {
  range: Range;
  max: number;
  width: number;
  color?: string;
}) {
  const height = 8;
  const x1 = max > 0 ? (width * Math.max(0, range.low)) / max : 0;
  const x2 = max > 0 ? Math.max(x1 + 3, (width * Math.max(0, range.high)) / max) : 3;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={0} y={3} width={width} height={2} rx={1} fill={INK.track} />
      <Rect x={f(x1)} y={1} width={f(x2 - x1)} height={6} rx={3} fill={color} fillOpacity={0.28} />
      <Circle cx={f(x1 + 3)} cy={4} r={3} fill={color} />
      <Circle cx={f(x2 - 3)} cy={4} r={3} fill={color} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ donut */

export type DonutSlice = { value: number; color: string };

/** Donut with 2-pt surface gaps between slices; content goes in the hole. */
export function Donut({
  slices,
  size = 140,
  thickness = 18,
  children,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  children?: ReactNode;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - thickness / 2 - 1;
  const gapDeg = slices.length > 1 ? (2 / (2 * Math.PI * r)) * 360 : 0;
  let angle = 0;

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={r} stroke={INK.track} strokeWidth={thickness} fill="none" />
        {total > 0
          ? slices.map((slice, index) => {
              const sweep = (Math.max(0, slice.value) / total) * 360;
              const start = angle + gapDeg / 2;
              const end = angle + sweep - gapDeg / 2;
              angle += sweep;
              if (end - start <= 0.2) return null;
              return (
                <Path
                  key={index}
                  d={arcBand(cx, cy, r, thickness, start, end, false)}
                  fill={slice.color}
                />
              );
            })
          : null}
        <Circle
          cx={cx}
          cy={cy}
          r={r - thickness / 2 - 5}
          stroke={INK.hairline}
          strokeWidth={0.6}
          strokeDasharray="1 2.4"
          fill="none"
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- projection */

function niceMax(value: number): { max: number; step: number } {
  if (value <= 0) return { max: 1000, step: 250 };
  const rough = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  return { max: Math.ceil(value / step) * step, step };
}

/**
 * Cumulative savings band vs cumulative cost band over the first months of
 * `points`, with the mid-estimate break-even marked.
 */
export function ProjectionChart({
  id,
  points,
  width,
  height,
  lang,
  monthLabel,
  breakEvenLabel,
  laterLabel,
}: {
  id: string;
  points: ProjectionPoint[];
  width: number;
  height: number;
  lang: Lang;
  monthLabel: string;
  breakEvenLabel: (month: string) => string;
  /** Shown instead of the marker when the mid estimate doesn't break even in the window. */
  laterLabel?: string;
}) {
  const data = [...points].sort((a, b) => a.month - b.month).slice(0, 12);
  if (data.length < 2) return null;

  const padL = 34;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const first = data[0].month;
  const last = data[data.length - 1].month;
  const peak = Math.max(
    ...data.map((p) => Math.max(p.cumulativeSavingsRon.high, p.cumulativeCostRon.high)),
  );
  const { max, step } = niceMax(peak);
  const x = (month: number) => padL + ((month - first) / Math.max(1, last - first)) * plotW;
  const y = (value: number) => padT + plotH - (Math.max(0, value) / max) * plotH;
  const pts = (pick: (p: ProjectionPoint) => number) =>
    data.map((p) => `${f(x(p.month))},${f(y(pick(p)))}`).join(" ");
  const band = (pick: (p: ProjectionPoint) => Range) =>
    [
      ...data.map((p) => `${f(x(p.month))},${f(y(pick(p).high))}`),
      ...[...data].reverse().map((p) => `${f(x(p.month))},${f(y(pick(p).low))}`),
    ].join(" ");

  const ticks: number[] = [];
  for (let v = 0; v <= max + 0.5; v += step) ticks.push(v);

  const breakEven = breakEvenMonth(
    data,
    (p) => midpoint(p.cumulativeSavingsRon),
    (p) => midpoint(p.cumulativeCostRon),
  );
  const earliest = breakEvenMonth(
    data,
    (p) => p.cumulativeSavingsRon.high,
    (p) => p.cumulativeCostRon.low,
  );
  const latest = breakEvenMonth(
    data,
    (p) => p.cumulativeSavingsRon.low,
    (p) => p.cumulativeCostRon.high,
  );
  const beX = breakEven !== null ? x(breakEven) : null;
  const beY =
    breakEven !== null
      ? y(
          (() => {
            const i = data.findIndex((p) => p.month >= breakEven);
            const a = data[Math.max(0, i - 1)];
            const b = data[Math.max(0, i)];
            const t = b.month === a.month ? 0 : (breakEven - a.month) / (b.month - a.month);
            const ma = midpoint(a.cumulativeCostRon);
            const mb = midpoint(b.cumulativeCostRon);
            return ma + (mb - ma) * t;
          })(),
        )
      : null;

  const labelText = { fontFamily: FONT.body, fontSize: 6.5, color: INK.faint } as const;
  const markerLabelW = 156;

  return (
    <View style={{ width, height, position: "relative" }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BRAND.violet} stopOpacity={0.42} />
            <Stop offset="1" stopColor={BRAND.sky} stopOpacity={0.12} />
          </LinearGradient>
        </Defs>
        {ticks.map((v) => (
          <Line
            key={v}
            x1={padL}
            x2={padL + plotW}
            y1={f(y(v))}
            y2={f(y(v))}
            stroke={INK.hairline}
            strokeWidth={v === 0 ? 0.9 : 0.5}
          />
        ))}
        {earliest !== null ? (
          <Rect
            x={f(x(earliest))}
            y={padT}
            width={f(Math.max(1, (latest !== null ? x(latest) : padL + plotW) - x(earliest)))}
            height={plotH}
            fill={BRAND.mint}
            fillOpacity={0.1}
          />
        ) : null}
        <Polygon points={band((p) => p.cumulativeCostRon)} fill={INK.muted} fillOpacity={0.1} />
        <Polygon points={band((p) => p.cumulativeSavingsRon)} fill={`url(#${id}-s)`} />
        <Polyline
          points={pts((p) => midpoint(p.cumulativeCostRon))}
          stroke={INK.muted}
          strokeWidth={1.4}
          strokeDasharray="3 2.5"
          fill="none"
        />
        <Polyline
          points={pts((p) => midpoint(p.cumulativeSavingsRon))}
          stroke={BRAND.violet}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
        {beX !== null && beY !== null ? (
          <G>
            <Line
              x1={f(beX)}
              x2={f(beX)}
              y1={padT}
              y2={padT + plotH}
              stroke={INK.mintText}
              strokeWidth={0.9}
              strokeDasharray="2 2"
            />
            <Circle
              cx={f(beX)}
              cy={f(beY)}
              r={5.5}
              fill={INK.white}
              stroke={INK.mintText}
              strokeWidth={1.4}
            />
            <Circle cx={f(beX)} cy={f(beY)} r={2.2} fill={INK.mintText} />
          </G>
        ) : null}
      </Svg>
      {ticks.map((v) => (
        <Text
          key={v}
          style={{
            ...labelText,
            position: "absolute",
            left: 0,
            width: padL - 6,
            textAlign: "right",
            top: y(v) - 4,
          }}
        >
          {formatCompact(v, lang)}
        </Text>
      ))}
      {data.map((p) => (
        <Text
          key={p.month}
          style={{
            ...labelText,
            position: "absolute",
            top: padT + plotH + 6,
            left: x(p.month) - 10,
            width: 20,
            textAlign: "center",
          }}
        >
          {p.month}
        </Text>
      ))}
      <Text
        style={{
          ...labelText,
          position: "absolute",
          right: padR,
          top: padT + plotH + 14,
          textAlign: "right",
        }}
      >
        {monthLabel}
      </Text>
      {beX !== null ? (
        <View
          style={{
            position: "absolute",
            top: padT + 4,
            left: Math.min(Math.max(padL + 4, beX + 6), padL + plotW - markerLabelW),
            width: markerLabelW,
            paddingVertical: 3,
            paddingHorizontal: 6,
            borderRadius: 6,
            backgroundColor: INK.white,
            borderWidth: 0.7,
            borderColor: INK.mintText,
          }}
        >
          <Text
            style={{ fontFamily: FONT.display, fontWeight: 500, fontSize: 7, color: INK.mintText }}
          >
            {breakEvenLabel(formatDecimal(breakEven ?? 0, lang))}
          </Text>
        </View>
      ) : laterLabel ? (
        <View
          style={{
            position: "absolute",
            top: padT + 4,
            left: padL + 4,
            paddingVertical: 3,
            paddingHorizontal: 6,
            borderRadius: 6,
            backgroundColor: INK.white,
            borderWidth: 0.7,
            borderColor: INK.hairline,
          }}
        >
          <Text
            style={{ fontFamily: FONT.display, fontWeight: 500, fontSize: 7, color: INK.muted }}
          >
            {laterLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------------- severity */

const SEVERITY_LEVEL: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/** Four ascending bars, filled up to the severity level (signal-strength style). */
export function SeverityMeter({ severity, color }: { severity: Severity; color: string }) {
  const level = SEVERITY_LEVEL[severity];
  return (
    <Svg width={13} height={9} viewBox="0 0 13 9">
      {[0, 1, 2, 3].map((i) => (
        <Rect
          key={i}
          x={i * 3.4}
          y={9 - (3 + i * 2)}
          width={2.2}
          height={3 + i * 2}
          rx={0.8}
          fill={i < level ? color : INK.hairline}
        />
      ))}
    </Svg>
  );
}

/** Three dots, filled to the level (implementation effort, impact…). */
export function LevelDots({
  level,
  color = BRAND.violet,
  empty = INK.hairline,
}: {
  level: 1 | 2 | 3;
  color?: string;
  empty?: string;
}) {
  return (
    <Svg width={22} height={6} viewBox="0 0 22 6">
      {[0, 1, 2].map((i) => (
        <Circle key={i} cx={3 + i * 8} cy={3} r={2.6} fill={i < level ? color : empty} />
      ))}
    </Svg>
  );
}

/* ------------------------------------------------------------ atmosphere */

/** Soft radial glow; place absolutely behind content. */
export function Glow({
  id,
  width,
  height,
  color,
  opacity,
  cx = 0.5,
  cy = 0.5,
  r = 0.5,
}: {
  id: string;
  width: number;
  height: number;
  color: string;
  opacity: number;
  cx?: number;
  cy?: number;
  r?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <RadialGradient id={id} cx={cx} cy={cy} r={r}>
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Circular vignette: clear in the middle, `color` at the rim. Drawn as a
 * circle (not a rect) so nothing outside the artwork gets painted.
 */
export function Vignette({
  id,
  size,
  color,
  clear = 0.62,
}: {
  id: string;
  size: number;
  color: string;
  clear?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id={id} cx={0.5} cy={0.5} r={0.5}>
          <Stop offset="0" stopColor={color} stopOpacity={0} />
          <Stop offset={String(clear)} stopColor={color} stopOpacity={0} />
          <Stop offset={String(clear + (1 - clear) * 0.55)} stopColor={color} stopOpacity={0.55} />
          <Stop offset="1" stopColor={color} stopOpacity={1} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Rounded bar with a left → right gradient. */
export function GradientBar({
  id,
  width,
  height,
  from,
  to,
}: {
  id: string;
  width: number;
  height: number;
  from: string;
  to: string;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} rx={height / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Horizontal violet → sky hairline. */
export function GradientRule({
  id,
  width,
  height = 1,
}: {
  id: string;
  width: number;
  height?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={BRAND.violet} />
          <Stop offset="0.5" stopColor={BRAND.blue} />
          <Stop offset="1" stopColor={BRAND.sky} stopOpacity={0.2} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} rx={height / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Concentric "vortex" rings bleeding off a corner of the light pages. */
export function CornerRings({
  size = 220,
  color = BRAND.violet,
}: {
  size?: number;
  color?: string;
}) {
  const c = size;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.36, 0.52, 0.68, 0.84, 1].map((k, i) => (
        <Circle
          key={k}
          cx={c}
          cy={0}
          r={size * k}
          stroke={color}
          strokeOpacity={0.05 + i * 0.012}
          strokeWidth={i === 2 ? 1.2 : 0.6}
          strokeDasharray={i % 2 ? "1 3" : undefined}
          fill="none"
        />
      ))}
      <Circle
        cx={c - size * 0.52 * Math.cos(0.5)}
        cy={size * 0.52 * Math.sin(0.5)}
        r={2.2}
        fill={color}
        fillOpacity={0.35}
      />
      <Circle
        cx={c - size * 0.84 * Math.cos(1.05)}
        cy={size * 0.84 * Math.sin(1.05)}
        r={1.6}
        fill={BRAND.sky}
        fillOpacity={0.6}
      />
    </Svg>
  );
}

/** Orbit ellipses with node dots around the cover vortex. */
export function OrbitLines({
  width,
  height,
  cx,
  cy,
  orbits,
}: {
  width: number;
  height: number;
  cx: number;
  cy: number;
  orbits: Array<{ rx: number; ry: number; rotate: number; dashed?: boolean }>;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {orbits.map((o, i) => (
        <Ellipse
          key={i}
          cx={cx}
          cy={cy}
          rx={o.rx}
          ry={o.ry}
          transform={`rotate(${o.rotate} ${cx} ${cy})`}
          stroke={i % 2 ? BRAND.sky : NIGHT_INK.strong}
          strokeOpacity={i % 2 ? 0.22 : 0.14}
          strokeWidth={0.7}
          strokeDasharray={o.dashed ? "2 4" : undefined}
          fill="none"
        />
      ))}
    </Svg>
  );
}

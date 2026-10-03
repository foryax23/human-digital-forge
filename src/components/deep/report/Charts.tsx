import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/*
 * Two small hand-written SVG charts for the "Cifre" tab (plan A10: no chart library): bars
 * and one line, the conclusion as the title, direct labels, year ticks thinned below 480 px.
 * The chart is decorative for screen readers (aria-hidden): the money table next to it is
 * the accessible version.
 */

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export type Point = { year: number; value: number; label: string };

/** Bars per year; the latest year in the accent, labels on the first, the last and the top. */
export function BarChart({
  title,
  points,
  highlightFrom,
  className,
}: {
  title: string;
  points: Point[];
  /** Years from this one on (the ones the title's "last 3 years" covers) are drawn darker. */
  highlightFrom?: number;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 180;
  const pad = { top: 22, bottom: 24, side: 4 };
  const max = Math.max(1, ...points.map((p) => Math.max(0, p.value)));
  const n = points.length || 1;
  const slot = (width - pad.side * 2) / n;
  const bar = Math.min(44, slot * 0.62);
  const thin = width < 480;
  const top = points.reduce(
    (best, p, i) => (p.value > (points[best]?.value ?? -Infinity) ? i : best),
    0,
  );
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="type-h4 text-fg">{title}</figcaption>
      <div ref={ref} className="mt-3 w-full">
        <svg
          aria-hidden
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block max-w-full"
        >
          <line
            x1={pad.side}
            x2={width - pad.side}
            y1={height - pad.bottom}
            y2={height - pad.bottom}
            stroke="var(--vx-rule)"
            strokeWidth="1"
          />
          {points.map((p, i) => {
            const h = (Math.max(0, p.value) / max) * (height - pad.top - pad.bottom);
            const x = pad.side + slot * i + (slot - bar) / 2;
            const y = height - pad.bottom - h;
            const last = i === points.length - 1;
            const label = i === 0 || last || i === top;
            return (
              <g key={p.year}>
                <rect
                  x={x}
                  y={p.value < 0 ? height - pad.bottom : y}
                  width={bar}
                  height={Math.max(p.value < 0 ? 2 : 1, h)}
                  rx="2"
                  // Grey bars at ≥ 3:1 against the page in both themes (WCAG 1.4.11).
                  fill={
                    p.value < 0 ? "var(--vx-bad)" : last ? "var(--vx-brand-line)" : "var(--vx-fg-3)"
                  }
                  fillOpacity={
                    p.value < 0 || last
                      ? 1
                      : highlightFrom !== undefined && p.year >= highlightFrom
                        ? 1
                        : 0.75
                  }
                />
                {label ? (
                  <text
                    x={x + bar / 2}
                    y={Math.max(12, y - 6)}
                    textAnchor="middle"
                    fontSize="12"
                    fill="var(--vx-fg-2)"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {p.label}
                  </text>
                ) : null}
                {!thin || i % 2 === (points.length - 1) % 2 ? (
                  <text
                    x={x + bar / 2}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize="12"
                    fill="var(--vx-fg-3)"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {p.year}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}

/** One line per year with a dot and a label on each point. */
export function LineChart({
  title,
  points,
  className,
}: {
  title: string;
  points: Point[];
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 160;
  const pad = { top: 24, bottom: 24, side: 18 };
  const values = points.map((p) => p.value);
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values, lo + 0.01);
  const n = Math.max(1, points.length - 1);
  const x = (i: number) => pad.side + ((width - pad.side * 2) * i) / n;
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * (height - pad.top - pad.bottom);
  const thin = width < 480;
  const topIndex = points.reduce(
    (best, p, i) => (p.value > (points[best]?.value ?? -Infinity) ? i : best),
    0,
  );
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="type-h4 text-fg">{title}</figcaption>
      <div ref={ref} className="mt-3 w-full">
        <svg
          aria-hidden
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block max-w-full"
        >
          {lo < 0 ? (
            <line
              x1={pad.side}
              x2={width - pad.side}
              y1={y(0)}
              y2={y(0)}
              stroke="var(--vx-rule)"
              strokeDasharray="3 3"
            />
          ) : null}
          <path d={path} fill="none" stroke="var(--vx-brand-line)" strokeWidth="2" />
          {points.map((p, i) => (
            <g key={p.year}>
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r="3.5"
                fill="var(--vx-s1)"
                stroke="var(--vx-brand-line)"
                strokeWidth="2"
              />
              {/* The first, the highest and the last point always keep their label. */}
              {!thin || i === 0 || i === topIndex || i === points.length - 1 ? (
                <text
                  x={x(i)}
                  y={y(p.value) - 9}
                  textAnchor="middle"
                  fontSize="12"
                  fill="var(--vx-fg-2)"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {p.label}
                </text>
              ) : null}
              {!thin || i % 2 === (points.length - 1) % 2 || i === topIndex ? (
                <text
                  x={x(i)}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize="12"
                  fill="var(--vx-fg-3)"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {p.year}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}

/** A peer band on one track: most firms between the quarters, the typical one, and you. */
export function BandTrack({
  p25,
  p50,
  p75,
  you,
  className,
}: {
  p25: number;
  p50: number;
  p75: number;
  you?: number;
  className?: string;
}) {
  const lo = Math.min(p25, you ?? p25) - Math.abs(p75 - p25) * 0.35;
  const hi = Math.max(p75, you ?? p75) + Math.abs(p75 - p25) * 0.35;
  const at = (v: number) => `${(((v - lo) / (hi - lo || 1)) * 100).toFixed(2)}%`;
  return (
    <div aria-hidden className={cn("relative h-5 w-full", className)}>
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-2" />
      <div
        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-[2px] bg-fg-3/75"
        style={{ left: at(p25), width: `calc(${at(p75)} - ${at(p25)})` }}
      />
      <div
        className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-fg"
        style={{ left: at(p50) }}
      />
      {you !== undefined ? (
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-brand-line"
          style={{ left: at(you) }}
        />
      ) : null}
    </div>
  );
}

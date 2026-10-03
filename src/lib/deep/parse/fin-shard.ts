import type { PeerBand } from "../contracts";

import { quantile } from "./format";
import { fold } from "./text";

/*
 * Peers from the Ministry of Finance shard (client-safe, pure). The shard is
 * built by Eng 4 (scripts/scan/build-fin-shards.mjs) from the official annual
 * accounts; this module reads its line format, picks the scope and size band
 * and computes the bands. When the shard is missing, peers are a gap: there is
 * never a fallback to name matches (D5).
 *
 * Line: cui36 \t countyCode \t locality \t turnover25 \t turnover24 \t
 *       profitPretax25 \t profitNet25 \t staff25 \t receivables25 \t expenses25
 */

export type FinRow = {
  cui: string;
  county: string;
  locality: string;
  turnover: number;
  turnoverPrev?: number;
  profitPretax?: number;
  profitNet?: number;
  employees?: number;
  receivables?: number;
  expenses?: number;
};

const num = (s: string | undefined) => {
  if (s === undefined || s === "" || s === "-") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

export function parseFinShard(text: string): FinRow[] {
  const rows: FinRow[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const f = line.split("\t");
    if (f.length < 4) continue;
    const cui = parseInt(f[0], 36);
    const turnover = num(f[3]);
    if (!Number.isFinite(cui) || turnover === undefined) continue;
    rows.push({
      cui: String(cui),
      county: f[1] ?? "",
      locality: f[2] ?? "",
      turnover,
      turnoverPrev: num(f[4]),
      profitPretax: num(f[5]),
      profitNet: num(f[6]),
      employees: num(f[7]),
      receivables: num(f[8]),
      expenses: num(f[9]),
    });
  }
  return rows;
}

export type PeerSubject = {
  cui: string;
  county?: string;
  countyCode?: string;
  city?: string;
  turnover?: number;
  turnoverPrev?: number;
  profitPretax?: number;
  employees?: number;
  receivables?: number;
};

export type PeerSelection = {
  scope: "oras" | "judet" | "national";
  band: [number, number];
  peers: FinRow[];
};

const BAND_STEPS: Array<[number, number]> = [
  [1 / 3, 3],
  [1 / 5, 5],
  [1 / 10, 10],
];
export const MIN_PEERS = 10;
/** Below this, comparisons are not shown (gap). */
export const MIN_PEERS_SHOWN = 5;

const isDormant = (row: FinRow) => row.turnover < 50_000 && !(row.employees && row.employees >= 1);

/**
 * Same activity, similar size, near you: the seat's town, then its county,
 * then the whole country, at 0.33×–3× turnover; at national scope the band
 * widens (5×, then 10×) until at least 10 firms remain. New firms (no
 * turnover) get the county or national population without a band.
 */
export function selectPeers(rows: FinRow[], subject: PeerSubject): PeerSelection | null {
  const pool = rows.filter((r) => r.cui !== subject.cui && !isDormant(r));
  if (!pool.length) return null;
  const sameCounty = (r: FinRow) =>
    Boolean(subject.countyCode && r.county && fold(r.county) === fold(subject.countyCode));
  const sameTown = (r: FinRow) =>
    sameCounty(r) && Boolean(subject.city && fold(r.locality) === fold(subject.city));
  const t = subject.turnover;
  if (!t || t <= 0) {
    const county = pool.filter(sameCounty);
    const peers = county.length >= MIN_PEERS ? county : pool;
    return { scope: county.length >= MIN_PEERS ? "judet" : "national", band: [0, Infinity], peers };
  }
  const inBand = (r: FinRow, [lo, hi]: [number, number]) =>
    r.turnover >= t * lo && r.turnover <= t * hi;
  const attempts: Array<[PeerSelection["scope"], [number, number], (r: FinRow) => boolean]> = [
    ["oras", BAND_STEPS[0], sameTown],
    ["judet", BAND_STEPS[0], sameCounty],
    ["national", BAND_STEPS[0], () => true],
    ["national", BAND_STEPS[1], () => true],
    ["national", BAND_STEPS[2], () => true],
  ];
  let best: PeerSelection | null = null;
  for (const [scope, factors, where] of attempts) {
    const peers = pool.filter((r) => where(r) && inBand(r, factors));
    const band: [number, number] = [Math.round(t * factors[0]), Math.round(t * factors[1])];
    if (peers.length >= MIN_PEERS) return { scope, band, peers };
    if (!best || peers.length > best.peers.length) best = { scope, band, peers };
  }
  return best && best.peers.length ? best : null;
}

function band(
  values: number[],
  you: number | undefined,
  higherIsBetter = true,
): PeerBand | undefined {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length < MIN_PEERS_SHOWN) return undefined;
  const out: PeerBand = {
    p25: quantile(sorted, 0.25),
    p50: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    n: sorted.length,
  };
  if (you !== undefined && Number.isFinite(you)) {
    out.you = you;
    const better = sorted.filter((v) => (higherIsBetter ? v < you : v > you)).length;
    if (sorted.length >= 20) {
      out.betterThanOf100 = Math.round((better / sorted.length) * 100);
    } else {
      const ahead = sorted.filter((v) => (higherIsBetter ? v > you : v < you)).length;
      out.rank = { position: ahead + 1, of: sorted.length + 1 };
    }
  }
  return out;
}

export type PeerBands = Partial<
  Record<
    "turnover" | "marginPretax" | "employees" | "revPerEmp" | "growth3y" | "daysToCollect",
    PeerBand
  >
>;

/** Days to collect, comparison only: dropped when receivables exceed 60% of turnover (A8). */
export function daysToCollect(receivables?: number, turnover?: number): number | undefined {
  if (!receivables || !turnover || turnover <= 0) return undefined;
  if (receivables > turnover * 0.6) return undefined;
  return (receivables / turnover) * 365;
}

export function peerBands(peers: FinRow[], subject: PeerSubject): PeerBands {
  const margin = (p?: number, t?: number) => (p !== undefined && t && t > 0 ? p / t : undefined);
  const rpe = (t?: number, e?: number) => (t && e && e > 0 ? t / e : undefined);
  const growth = (t?: number, prev?: number) => (t && prev && prev > 0 ? t / prev - 1 : undefined);
  const pick = (f: (r: FinRow) => number | undefined) =>
    peers.map(f).filter((v): v is number => v !== undefined && Number.isFinite(v));
  return {
    turnover: band(
      pick((r) => r.turnover),
      subject.turnover,
    ),
    marginPretax: band(
      pick((r) => margin(r.profitPretax, r.turnover)),
      margin(subject.profitPretax, subject.turnover),
    ),
    employees: band(
      pick((r) => r.employees),
      subject.employees,
    ),
    revPerEmp: band(
      pick((r) => rpe(r.turnover, r.employees)),
      rpe(subject.turnover, subject.employees),
    ),
    // The shard carries two years: this band is one-year growth (kept under the contract's key).
    growth3y: band(
      pick((r) => growth(r.turnover, r.turnoverPrev)),
      growth(subject.turnover, subject.turnoverPrev),
    ),
    daysToCollect: band(
      pick((r) => daysToCollect(r.receivables, r.turnover)),
      daysToCollect(subject.receivables, subject.turnover),
      false,
    ),
  };
}

/** Five named rivals: closest in size, same county first, then the rest of the scope. */
export function pickRivals(peers: FinRow[], subject: PeerSubject, n = 5): FinRow[] {
  const t = subject.turnover && subject.turnover > 0 ? subject.turnover : undefined;
  const distance = (r: FinRow) => (t ? Math.abs(Math.log(r.turnover / t)) : -r.turnover);
  const sameCounty = (r: FinRow) =>
    Boolean(subject.countyCode && fold(r.county) === fold(subject.countyCode));
  return [...peers]
    .sort((a, b) => Number(sameCounty(b)) - Number(sameCounty(a)) || distance(a) - distance(b))
    .slice(0, n);
}

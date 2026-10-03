import type { Fact, PeerBand, WebsiteStatus } from "../contracts";

/*
 * Reading the merged facts of a run (client-safe). Every rule in report/**
 * reads facts through these helpers, so a predicate or ID convention changes
 * in one place. Per-year facts carry the year in the ID ("money.turnover.2025").
 */

export type YearValue = { year: number; value: number; fact: Fact };
export type BandMetric =
  | "turnover"
  | "marginPretax"
  | "employees"
  | "revPerEmp"
  | "growth3y"
  | "daysToCollect";

export type FactReader = {
  facts: Fact[];
  get(id: string): Fact | undefined;
  has(id: string): boolean;
  /** A fact's value when it has the expected primitive type. */
  num(id: string): number | undefined;
  bool(id: string): boolean | undefined;
  /** Per-year facts of a predicate, newest first. */
  series(predicate: string): YearValue[];
  latest(predicate: string): YearValue | undefined;
  /** The peers band of a metric (peers.band.<metric>), with its fact. */
  band(metric: BandMetric): (PeerBand & { fact: Fact }) | undefined;
  /** The money.filed state: true (filed), false (new firm), null (ANAF did not answer), undefined (not run). */
  filed(): boolean | null | undefined;
  websiteStatus(): WebsiteStatus | undefined;
  byPredicate(predicate: string): Fact[];
};

const YEAR_ID = /\.(\d{4})$/;

export function readFacts(facts: Fact[]): FactReader {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const series = (predicate: string): YearValue[] =>
    facts
      .filter((f) => f.predicate === predicate && YEAR_ID.test(f.id) && typeof f.value === "number")
      .map((f) => ({ year: Number(YEAR_ID.exec(f.id)![1]), value: f.value as number, fact: f }))
      .sort((a, b) => b.year - a.year);
  return {
    facts,
    get: (id) => byId.get(id),
    has: (id) => byId.has(id),
    num(id) {
      const v = byId.get(id)?.value;
      return typeof v === "number" && Number.isFinite(v) ? v : undefined;
    },
    bool(id) {
      const v = byId.get(id)?.value;
      return typeof v === "boolean" ? v : undefined;
    },
    series,
    latest: (predicate) => series(predicate)[0],
    band(metric) {
      const fact = byId.get(`peers.band.${metric}`);
      const v = fact?.value as (Partial<PeerBand> & { metric?: string }) | undefined;
      if (!fact || !v || typeof v.p25 !== "number" || typeof v.p50 !== "number") return undefined;
      if (typeof v.p75 !== "number" || typeof v.n !== "number") return undefined;
      return {
        p25: v.p25,
        p50: v.p50,
        p75: v.p75,
        n: v.n,
        you: typeof v.you === "number" ? v.you : undefined,
        rank: v.rank,
        betterThanOf100: v.betterThanOf100,
        fact,
      };
    },
    filed() {
      const v = byId.get("money.filed")?.value as { filed?: boolean | null } | undefined;
      if (!v || !("filed" in v)) return undefined;
      return v.filed === true ? true : v.filed === false ? false : null;
    },
    websiteStatus: () => byId.get("site.status")?.value as WebsiteStatus | undefined,
    byPredicate: (predicate) => facts.filter((f) => f.predicate === predicate),
  };
}

/** Strictly moving the same way over the last three consecutive years (newest first input). */
export function sameDirection3y(series: YearValue[]): "up" | "down" | null {
  const s = series.slice(0, 3);
  if (s.length < 3 || s[0].year - s[2].year !== 2) return null;
  const [c, b, a] = s.map((x) => x.value);
  if (a < b && b < c) return "up";
  if (a > b && b > c) return "down";
  return null;
}

/**
 * Romanian counts: from 20 up (and for round hundreds) the noun takes "de":
 * "12 salariați", "25 de salariați", "101 salariați", "120 de salariați".
 */
export function roCount(n: number, noun: string): string {
  const abs = Math.abs(Math.round(n));
  const rest = abs % 100;
  const de = abs >= 20 && (rest === 0 || rest >= 20);
  return `${n}${de ? " de" : ""} ${noun}`;
}

/** "9 lei din 100" from a pre-tax margin ratio (rounded to whole lei). */
export const keptOf100 = (margin: number) => Math.round(margin * 100);

/** Sites that work and were confirmed as the company's (or declared by the owner). */
export const SITE_OK: WebsiteStatus[] = ["verified", "declared"];
/** Sites that show customers an error or a for-sale page. */
export const SITE_BROKEN: WebsiteStatus[] = ["parked", "dead", "broken_certificate"];

/**
 * A change as a percent, the same everywhere on a page (headline, findings, meaning): whole
 * numbers from 5% up ("9%"), one decimal below ("4,3%"); no sign (the verb carries it).
 */
export function changePct(ratio: number): { en: string; ro: string } {
  const v = Math.abs(ratio * 100);
  const digits = v >= 5 ? 0 : 1;
  const fmt = (sep: string) => {
    const fixed = v.toFixed(digits).replace(/\.0$/, "");
    return `${fixed.replace(".", sep)}%`;
  };
  return { en: fmt("."), ro: fmt(",") };
}

/** "de la 7,05 la 8,41 mil. lei" (one unit, two decimals), else each amount in short form. */
export function leiFromTo(
  a: number,
  b: number,
  short: (v: number) => { en: string; ro: string },
): { en: string; ro: string } {
  if (Math.abs(a) >= 1_000_000 && Math.abs(b) >= 1_000_000) {
    const m = (v: number, sep: string) => (v / 1_000_000).toFixed(2).replace(".", sep);
    return {
      en: `from ${m(a, ".")}M to ${m(b, ".")}M lei`,
      ro: `de la ${m(a, ",")} la ${m(b, ",")} mil. lei`,
    };
  }
  const sa = short(a);
  const sb = short(b);
  return { en: `from ${sa.en} to ${sb.en}`, ro: `de la ${sa.ro} la ${sb.ro}` };
}

/*
 * Fact builders for the report-logic tests (no network, no engine run): the
 * money facts come from the engine's own pure moneyFacts(), the rest are made
 * here with the same IDs and value shapes the steps emit.
 */
import type {
  DeepReport,
  Fact,
  FactValue,
  SectionId,
  WebsiteStatus,
} from "../../../src/lib/deep/contracts";
import type { ReportPartsInput } from "../../../src/lib/deep/report/index";
import { moneyFacts } from "../../../src/lib/deep/steps/money.server";

export function f(
  id: string,
  value: FactValue,
  opts: Partial<Fact> & { section?: SectionId; predicate?: string } = {},
): Fact {
  const section = opts.section ?? (id.split(".")[0] as SectionId);
  return {
    id,
    section,
    predicate: opts.predicate ?? id,
    value,
    display: opts.display ?? { ro: String(value), en: String(value) },
    source: opts.source ?? "site",
    asOf: opts.asOf ?? "2026-10-03",
    confidence: opts.confidence ?? "confirmat",
    score: opts.score ?? 1,
    method: opts.method ?? "html",
    gdpr: "G0",
    ...(opts.short ? { short: opts.short } : {}),
    ...(opts.observed ? { observed: opts.observed } : {}),
  };
}

export type YearRow = {
  year: number;
  turnover?: number;
  profitPretax?: number;
  profitNet?: number;
  expenses?: number;
  employees?: number;
  receivables?: number;
  caen2?: string;
};

/** money.* and people.* facts for the given years, plus money.filed = true. */
export function money(rows: YearRow[]): Fact[] {
  const facts = moneyFacts(
    rows.map((r) => ({ caenLabel: "Activitate", ...r })),
    "2026-10-03",
  );
  facts.push(
    f(
      "money.filed",
      { filed: true, years: rows.map((r) => r.year).sort(), checked: [], unchecked: [] },
      { section: "money", source: "anaf_bilant", method: "api" },
    ),
  );
  return facts;
}

/** A firm with no filing at all (new). */
export const newFirm = (): Fact[] => [
  f(
    "money.filed",
    { filed: false, years: [], checked: [2025], unchecked: [] },
    { section: "money" },
  ),
];

export function site(
  status: WebsiteStatus,
  presence: Partial<
    Record<"cui" | "reg_no" | "contact" | "contact_form" | "booking" | "google", boolean>
  > = {},
  pages = 12,
): Fact[] {
  const out: Fact[] = [f("site.status", status, { section: "site" })];
  const p = (key: string, id: string) => {
    const v = presence[key as keyof typeof presence];
    if (v !== undefined)
      out.push(
        f(id, v, {
          section: id.startsWith("presence") ? "presence" : "site",
          observed: { pagesRead: pages },
          display: v
            ? { ro: "Da", en: "Yes" }
            : {
                ro: `Nu am găsit pe cele ${pages} pagini citite`,
                en: `Not found on the ${pages} pages we read`,
              },
        }),
      );
  };
  p("cui", "site.cui.present");
  p("reg_no", "site.reg_no.present");
  p("contact", "site.contact.present");
  p("contact_form", "site.contact_form.present");
  p("booking", "site.booking.present");
  p("google", "presence.google_profile_linked");
  out.push(f("site.pages_read", pages, { section: "site" }));
  return out;
}

export function band(
  metric: string,
  b: { p25: number; p50: number; p75: number; n: number; you?: number },
  confidence: Fact["confidence"] = "calculat",
): Fact {
  return f(
    `peers.band.${metric}`,
    { metric, ...b },
    { section: "peers", predicate: "peers.band", source: "mf_bulk", confidence, method: "bulk" },
  );
}

export const status = (value: "activ" | "inactiv" | "radiat"): Fact =>
  f("identity.status", value, { section: "identity", source: "anaf_v9", method: "api" });

export const courtsChecked = (): Fact =>
  f("risk.courts.checked", true, { section: "risk", source: "courts", method: "api" });

export function company(caen2?: string): DeepReport["company"] {
  return {
    name: "EXEMPLU SRL",
    displayName: "Exemplu SRL",
    cui: "9259999",
    caen2,
    activity: { ro: "Activitate", en: "Activity" },
  };
}

export function input(
  facts: Fact[],
  opts: Partial<ReportPartsInput> & { caen2?: string } = {},
): ReportPartsInput {
  return {
    facts,
    gaps: opts.gaps ?? [],
    company: opts.company ?? company(opts.caen2),
    relationship: opts.relationship ?? "proprietar",
    lang: opts.lang ?? "ro",
    peers: opts.peers,
    competitors: opts.competitors ?? [],
    owner: opts.owner,
  };
}

/** Five years of a growing, profitable firm. */
export const healthyYears = (caen2 = "8623"): YearRow[] =>
  [2025, 2024, 2023, 2022].map((year, i) => ({
    year,
    caen2,
    turnover: 2_000_000 - i * 150_000,
    profitPretax: 300_000 - i * 20_000,
    profitNet: 250_000 - i * 15_000,
    expenses: 1_700_000 - i * 130_000,
    employees: 12,
  }));

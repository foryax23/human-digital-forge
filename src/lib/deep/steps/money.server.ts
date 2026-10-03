import { AnafLimitError } from "../anaf-pacer.server";
import type { Fact, Gap } from "../contracts";
import type { StepEnv } from "../env.server";
import { bi, count, lei, leiShort, pct } from "../parse/format";
import { parseBilant, type BilantYear } from "../parse/registry";

import { fact, gap, isoDay, type StepDraft } from "./common.server";

/*
 * Step 1, "money" (plan A3): up to 7 ANAF bilanț calls (2019 to the latest
 * filed year, newest first), paced by the run-wide ANAF pacer. Every figure is
 * an official fact with its year; margins, growth and per-employee values are
 * our arithmetic on those facts ("Calculat"). A year without a filing is a gap;
 * a firm with no filing in any year ANAF answered for is the new-firm variant
 * only when every year was checked; years ANAF did not answer for (or that the
 * quota or step time skipped) leave `money.filed` null: "neverificat", never
 * "firmă nouă".
 */

export const FIRST_YEAR = 2019;

/** The latest year whose accounts are published: filed by end of May, online over the summer. */
export function latestFiledYear(nowMs: number): number {
  const d = new Date(nowMs);
  return d.getUTCFullYear() - (d.getUTCMonth() >= 6 ? 1 : 2);
}

const MONEY_FIELDS: Array<{
  key: keyof BilantYear;
  predicate: string;
  section: "money" | "people";
  /** Kept for every year (true) or only the latest two. */
  allYears: boolean;
}> = [
  { key: "turnover", predicate: "money.turnover", section: "money", allYears: true },
  { key: "profitPretax", predicate: "money.profit_pretax", section: "money", allYears: true },
  { key: "profitNet", predicate: "money.profit_net", section: "money", allYears: true },
  { key: "expenses", predicate: "money.expenses", section: "money", allYears: true },
  { key: "employees", predicate: "people.employees", section: "people", allYears: true },
  { key: "revenueTotal", predicate: "money.revenue_total", section: "money", allYears: false },
  { key: "receivables", predicate: "money.receivables", section: "money", allYears: false },
  { key: "debts", predicate: "money.debts", section: "money", allYears: false },
  { key: "equity", predicate: "money.equity", section: "money", allYears: false },
  { key: "cash", predicate: "money.cash", section: "money", allYears: false },
];

const change = (now?: number, before?: number) =>
  now !== undefined && before !== undefined && before !== 0
    ? now / Math.abs(before) - (before < 0 ? -1 : 1)
    : undefined;

function signedPct(ratio: number) {
  const p = pct(Math.abs(ratio));
  return ratio >= 0 ? bi(`+${p.en}`, `+${p.ro}`) : bi(`-${p.en}`, `-${p.ro}`);
}

export function moneyFacts(years: BilantYear[], retrievedOn: string): Fact[] {
  const facts: Fact[] = [];
  const sorted = [...years].sort((a, b) => b.year - a.year);
  const latest = sorted[0];
  const official = (y: number) => ({
    source: "anaf_bilant" as const,
    asOf: `FY${y}`,
    confidence: "confirmat" as const,
    method: "api" as const,
  });
  sorted.forEach((y, index) => {
    for (const field of MONEY_FIELDS) {
      if (!field.allYears && index > 1) continue;
      const value = y[field.key];
      if (typeof value !== "number") continue;
      const isPeople = field.section === "people";
      facts.push(
        fact({
          ...official(y.year),
          id: `${field.predicate}.${y.year}`,
          section: field.section,
          predicate: field.predicate,
          value,
          display: isPeople ? count(value) : lei(value),
          short: isPeople ? undefined : leiShort(value),
        }),
      );
    }
  });
  if (!latest) return facts;
  if (latest.caen2) {
    facts.push(
      fact({
        ...official(latest.year),
        id: "money.caen_rev2",
        section: "money",
        predicate: "money.caen_rev2",
        value: { code: latest.caen2, label: latest.caenLabel, revision: 2 },
        display: bi(
          `${latest.caen2} · ${latest.caenLabel ?? ""}`.trim(),
          `${latest.caen2} · ${latest.caenLabel ?? ""}`.trim(),
        ),
      }),
    );
  }
  const calc = (y: number) => ({
    source: "calc" as const,
    asOf: `FY${y}`,
    confidence: "calculat" as const,
    method: "derived" as const,
  });
  for (const y of sorted.slice(0, 3)) {
    if (y.turnover && y.turnover > 0 && y.profitPretax !== undefined) {
      const margin = y.profitPretax / y.turnover;
      const kept = Math.round(margin * 100);
      facts.push(
        fact({
          ...calc(y.year),
          id: `money.margin_pretax.${y.year}`,
          section: "money",
          predicate: "money.margin_pretax",
          value: margin,
          display: pct(margin),
          short: bi(
            `${kept} lei from every 100 lei invoiced`,
            `${kept} lei din fiecare 100 de lei facturați`,
          ),
        }),
      );
    }
  }
  const prev = sorted.find((y) => y.year === latest.year - 1);
  const three = sorted.find((y) => y.year === latest.year - 2);
  const growth = change(latest.turnover, prev?.turnover);
  if (growth !== undefined && prev) {
    facts.push(
      fact({
        ...calc(latest.year),
        id: "money.growth_turnover",
        section: "money",
        predicate: "money.growth_turnover",
        value: { ratio: growth, from: prev.year, to: latest.year },
        display: bi(
          `${signedPct(growth).en} (${prev.year}–${latest.year})`,
          `${signedPct(growth).ro} (${prev.year}–${latest.year})`,
        ),
      }),
    );
  }
  const oldest3 = sorted.find((y) => y.year === latest.year - 3);
  const growth3 = change(latest.turnover, oldest3?.turnover);
  if (growth3 !== undefined && oldest3) {
    facts.push(
      fact({
        ...calc(latest.year),
        id: "money.growth_turnover_3y",
        section: "money",
        predicate: "money.growth_turnover_3y",
        value: { ratio: growth3, from: oldest3.year, to: latest.year },
        display: bi(
          `${signedPct(growth3).en} (${oldest3.year}–${latest.year})`,
          `${signedPct(growth3).ro} (${oldest3.year}–${latest.year})`,
        ),
      }),
    );
  }
  if (three && latest.expenses && three.expenses && latest.turnover && three.turnover) {
    const exp = change(latest.expenses, three.expenses)!;
    const rev = change(latest.turnover, three.turnover)!;
    const expD = pct(Math.abs(exp));
    const revD = pct(Math.abs(rev));
    const verb = (r: number, ro: [string, string], en: [string, string]) => ({
      ro: r >= 0 ? ro[0] : ro[1],
      en: r >= 0 ? en[0] : en[1],
    });
    const ve = verb(exp, ["au crescut", "au scăzut"], ["rose", "fell"]);
    // "cifra de afaceri" is singular: "a crescut", never "au crescut".
    const vr = verb(rev, ["a crescut", "a scăzut"], ["rose", "fell"]);
    facts.push(
      fact({
        ...calc(latest.year),
        id: "money.expenses_vs_revenue",
        section: "money",
        predicate: "money.expenses_vs_revenue",
        value: { expenses: exp, revenue: rev, from: three.year, to: latest.year },
        display: bi(
          `${three.year}–${latest.year}: expenses ${ve.en} ${expD.en}, turnover ${vr.en} ${revD.en}`,
          `${three.year}–${latest.year}: cheltuielile ${ve.ro} cu ${expD.ro}, cifra de afaceri ${vr.ro} cu ${revD.ro}`,
        ),
      }),
    );
  }
  const profitChange = change(latest.profitPretax, prev?.profitPretax);
  if (profitChange !== undefined && prev) {
    facts.push(
      fact({
        ...calc(latest.year),
        id: "money.profit_change",
        section: "money",
        predicate: "money.profit_change",
        value: { ratio: profitChange, from: prev.year, to: latest.year },
        display: bi(
          `${signedPct(profitChange).en} (${prev.year}–${latest.year})`,
          `${signedPct(profitChange).ro} (${prev.year}–${latest.year})`,
        ),
      }),
    );
  }
  const staffChange = change(latest.employees, prev?.employees);
  if (
    staffChange !== undefined &&
    prev &&
    latest.employees !== undefined &&
    prev.employees !== undefined
  ) {
    facts.push(
      fact({
        ...calc(latest.year),
        id: "people.employees_change",
        section: "people",
        predicate: "people.employees_change",
        value: {
          ratio: staffChange,
          from: prev.employees,
          to: latest.employees,
          fromYear: prev.year,
          toYear: latest.year,
        },
        display: bi(
          `${prev.employees} → ${latest.employees} (${prev.year}–${latest.year})`,
          `${prev.employees} → ${latest.employees} (${prev.year}–${latest.year})`,
        ),
      }),
    );
  }
  if (latest.turnover && latest.employees && latest.employees > 0) {
    const rpe = latest.turnover / latest.employees;
    facts.push(
      fact({
        ...calc(latest.year),
        id: "people.revenue_per_employee",
        section: "people",
        predicate: "people.revenue_per_employee",
        value: rpe,
        display: lei(Math.round(rpe)),
        short: leiShort(Math.round(rpe)),
      }),
    );
  }
  return facts;
}

export async function runMoney(env: StepEnv): Promise<StepDraft> {
  const today = isoDay(env.now());
  const latestYear = latestFiledYear(env.now());
  const years: BilantYear[] = [];
  const gaps: Gap[] = [];
  /** Years ANAF answered for with no filing. */
  const notFiled: number[] = [];
  /** Years we could not check: ANAF did not answer, or the quota or step time ran out. */
  const unchecked: number[] = [];
  let unavailable = 0;
  /** Why the remaining years were skipped: the step's time, or the run's ANAF call limit. */
  let stopped: "deadline" | "quota" | null = null;
  // No accounts exist for years before the company was registered: no ANAF call for them.
  const registeredYear = Number(env.identity.registeredAt?.slice(0, 4)) || 0;
  const firstYear = Math.max(FIRST_YEAR, registeredYear);
  for (let year = latestYear; year >= firstYear; year--) {
    if (stopped) {
      unchecked.push(year);
      continue;
    }
    try {
      const raw = await env.anaf.bilant(env.cui, year);
      const parsed = parseBilant(raw);
      if (parsed) years.push(parsed);
      else notFiled.push(year);
    } catch (error) {
      if (error instanceof AnafLimitError && error.kind !== "unavailable") stopped = error.kind;
      else unavailable++;
      unchecked.push(year);
      env.log({ money: year, error: String((error as Error)?.message ?? error) });
    }
  }
  const facts = moneyFacts(years, today);
  const anyFiled = years.length > 0;
  /*
   * true: at least one filing; false: every year was checked and none was filed (a new
   * firm); null: nothing filed among the years ANAF answered for, but some years could not
   * be checked, so nothing is concluded ("neverificat", never "firmă nouă").
   */
  const filed: boolean | null = anyFiled ? true : unchecked.length ? null : false;
  const span = Math.max(1, latestYear - firstYear + 1);
  const uncheckedList = [...unchecked].sort().join(", ");
  facts.push(
    fact({
      id: "money.filed",
      section: "money",
      predicate: "money.filed",
      value: {
        filed,
        years: years.map((y) => y.year).sort(),
        checked: [...years.map((y) => y.year), ...notFiled].sort(),
        unchecked: [...unchecked].sort(),
      },
      display:
        filed === true
          ? bi(
              `Annual accounts for ${years.length} of ${span} years`,
              `Bilanțuri pentru ${years.length} din ${span} ani`,
            )
          : filed === false
            ? bi("No annual accounts filed yet", "Încă nu are bilanț depus")
            : bi(
                `Annual accounts could not be checked for ${uncheckedList}`,
                `Bilanțul nu a putut fi verificat pentru ${uncheckedList}`,
              ),
      source: "anaf_bilant",
      asOf: `FY${latestYear}`,
      confidence: "confirmat",
      method: "api",
    }),
  );
  if (filed === false) {
    gaps.push(
      gap(
        "money",
        bi("Official figures", "Cifrele oficiale"),
        bi(
          "No annual accounts filed yet (a new company)",
          "Încă nu există bilanț depus (firmă nouă)",
        ),
        today,
      ),
    );
  }
  if (anyFiled) {
    const firstFiled = Math.min(...years.map((y) => y.year));
    const quiet = notFiled.filter((y) => y > firstFiled).sort();
    if (quiet.length) {
      gaps.push(
        gap(
          "money",
          bi(`Accounts for ${quiet.join(", ")}`, `Bilanțul pentru ${quiet.join(", ")}`),
          bi("No filing published for these years", "Nu apare bilanț publicat pentru acești ani"),
          today,
          "https://www.mfinante.gov.ro/apps/infocodfiscal.html",
        ),
      );
    }
  }
  if (unchecked.length) {
    const stopText =
      stopped === "quota"
        ? bi("the run's limit of ANAF requests was reached", "limita de cereri ANAF a rulării")
        : bi("the step ran out of time", "pasul a rămas fără timp");
    const why =
      unavailable && stopped
        ? bi(`ANAF did not answer, then ${stopText.en}`, `ANAF nu a răspuns, apoi ${stopText.ro}`)
        : unavailable
          ? bi("ANAF did not answer", "ANAF nu a răspuns")
          : stopText;
    gaps.push(
      gap(
        "money",
        bi(`Accounts for ${uncheckedList}`, `Bilanțul pentru ${uncheckedList}`),
        bi(
          `Could not be checked (${why.en}); check at the source`,
          `Nu am putut verifica (${why.ro}); de verificat la sursă`,
        ),
        today,
        "https://www.mfinante.gov.ro/apps/infocodfiscal.html",
      ),
    );
  }
  return {
    status: unchecked.length ? (anyFiled ? "partial" : "failed") : "done",
    facts,
    gaps,
    counters: {
      anafCalls: env.anaf.calls(),
      yearsFiled: years.length,
      yearsUnchecked: unchecked.length,
      sourcesOk: anyFiled ? 1 : 0,
    },
    next: { anafNextAt: env.anaf.nextAt() },
  };
}

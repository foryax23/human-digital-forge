/**
 * Sanity checks for displayPlan() (src/lib/scan/blueprint/display.ts), the one
 * place that turns a blueprint into displayed figures. Checks the plan's
 * acceptance "numbers gates" and "copy gates" on the fixtures, simulated
 * blueprints and a blueprint stored before the central values existed, and
 * the base case (§3.9) against its reference figures.
 *
 *   npx tsx scripts/scan/check-display.ts            # checks only
 *   npx tsx scripts/scan/check-display.ts --print    # also print the base case plan
 */
import { buildRulesBlueprint, simulateBlueprint } from "../../src/lib/scan/blueprint";
import { shownHours } from "../../src/lib/scan/blueprint/copy";
import {
  displayPlan,
  kpiCells,
  outOfWindowNote,
  tableRows,
  type DisplayPlan,
} from "../../src/lib/scan/blueprint/display";
import { breakEvenMonth } from "../../src/lib/scan/blueprint/economics";
import { BASE_CASE_BLUEPRINT } from "../../src/lib/scan/fixtures/base-case-blueprint";
import { SAMPLE_BLUEPRINT } from "../../src/lib/scan/fixtures/sample-blueprint";
import type { Bilingual, Blueprint } from "../../src/lib/scan/types";

const print = process.argv.includes("--print");
const problems: string[] = [];
const fail = (key: string, message: string) => problems.push(`[${key}] ${message}`);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/* ------------------------------------------------------------- cases */

const NOW = "2026-10-03T09:00:00.000Z";
const cases: Array<{ key: string; blueprint: Blueprint }> = [
  { key: "base case", blueprint: BASE_CASE_BLUEPRINT },
  { key: "demo fixture", blueprint: SAMPLE_BLUEPRINT },
  {
    key: "base case, simulated",
    blueprint: simulateBlueprint(BASE_CASE_BLUEPRINT, {
      teamSize: 10,
      hourlyCostRon: 80,
      volumeFactor: 1.5,
    }),
  },
  {
    key: "demo, quiet simulation",
    blueprint: simulateBlueprint(SAMPLE_BLUEPRINT, {
      teamSize: 2,
      hourlyCostRon: 40,
      volumeFactor: 0.5,
    }),
  },
  {
    key: "construction, no website",
    blueprint: buildRulesBlueprint({
      target: { cui: "56781234" },
      company: {
        cui: "56781234",
        name: "CONSTRUCT MODERN BIHOR S.R.L.",
        displayName: "Construct Modern Bihor SRL",
        city: "Oradea",
        caen: "4120",
        sources: ["anaf"],
      },
      now: NOW,
    }),
  },
  {
    key: "consulting with a site",
    blueprint: buildRulesBlueprint({
      target: { cui: "54747928", url: "https://vortexhub.dev" },
      company: {
        cui: "54747928",
        name: "VORTEX HUB S.R.L.",
        displayName: "Vortex Hub SRL",
        city: "București",
        caen: "7020",
        website: "https://vortexhub.dev",
        sources: ["anaf"],
      },
      now: NOW,
    }),
  },
  { key: "stored before central values", blueprint: legacy(SAMPLE_BLUEPRINT) },
];

/** A blueprint as stored before `mid`, `breakEven`, phase keys and start reasons existed. */
function legacy(blueprint: Blueprint): Blueprint {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([k]) => !["mid", "breakEven", "key", "websiteCostRon", "startReason"].includes(k),
          )
          .map(([k, v]) => [k, strip(v)]),
      );
    }
    return value;
  };
  return strip(blueprint) as Blueprint;
}

/* ------------------------------------------------------------- checks */

const BANNED_RO: Array<[RegExp, string]> = [
  [/\bRON\b/, "RON in Romanian"],
  [/\bLEI\b/, "LEI"],
  [/€/, "€"],
  [/\d+K\b/, "50K-style figure"],
  [/\bL\d+\b/, "L14-style month"],
  [/\d h\b/, '"h" as a unit'],
  [
    /Esențial|Impact mare|Recomandat|Oportunitate|Prioritar|Potențial ridicat/i,
    "banned badge word",
  ],
  [/[Ee]conomis/, "economisit"],
  [/Pragul de rentabilitate/i, "second payback concept"],
  [/aplicații/i, "aplicații (use instrumente)"],
  [/[şţŞŢ]/, "cedilla letter"],
  [/—/, "em dash"],
  [/\bemail/i, "email (use e-mail)"],
  [/ · /, "middle-dot meta string"],
];
const ALLOWED_PERCENT = /\b(20|2,25)%/g;

function texts(value: unknown, out: Bilingual[] = []): Bilingual[] {
  if (Array.isArray(value)) value.forEach((v) => texts(v, out));
  else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.en === "string" && typeof o.ro === "string") out.push(o as Bilingual);
    else Object.values(o).forEach((v) => texts(v, out));
  }
  return out;
}

function checkCopy(key: string, plan: DisplayPlan) {
  const all = [
    ...texts(plan),
    ...([6, 12, 24] as const).flatMap((h) => [
      ...texts(kpiCells(plan, h)),
      ...texts(tableRows(plan, h)),
      ...texts(outOfWindowNote(plan, h)),
    ]),
  ];
  // Assumption notes quote the engine's own notes, which name tools in English on purpose.
  for (const text of all) {
    for (const [pattern, label] of BANNED_RO) {
      if (pattern.test(text.ro)) fail(key, `${label}: "${text.ro}"`);
    }
    if (/%/.test(text.ro.replace(ALLOWED_PERCENT, ""))) fail(key, `percentage: "${text.ro}"`);
    if (/\blei\b/.test(text.en)) fail(key, `lei in English: "${text.en}"`);
    if (!text.en.trim() || !text.ro.trim()) fail(key, "empty text");
  }
}

function checkNumbers(key: string, blueprint: Blueprint, plan: DisplayPlan) {
  const { phases, totals, strategies } = plan;

  // Groups add up.
  const hours = phases.flatMap((p) => (p.hoursPerMonth === null ? [] : [p.hoursPerMonth]));
  if (sum(hours) !== totals.hoursPerMonth)
    fail(key, `phase hours ${sum(hours)} ≠ total ${totals.hoursPerMonth}`);
  if (totals.hoursPerMonth !== shownHours(blueprint.opportunities))
    fail(key, "total hours differ from the headline figure");
  if (sum(phases.map((p) => p.setupLei)) !== totals.setupLei)
    fail(key, `phase setup ≠ total ${totals.setupLei}`);
  if ((totals.siteLei ?? 0) + totals.automationsSetupLei !== totals.setupLei)
    fail(key, "site + automations ≠ setup total");
  if (sum(phases.map((p) => p.toolsLeiPerMonth)) !== totals.toolsLeiPerMonth)
    fail(key, "phase tools ≠ total");
  for (const p of phases) {
    const autos = plan.automations.filter((a) => a.phase === p.key);
    if (autos.length && sum(autos.map((a) => a.hoursPerMonth)) !== (p.hoursPerMonth ?? 0))
      fail(key, `${p.key}: automations' hours ≠ phase row`);
    if (sum(autos.map((a) => a.toolsLeiPerMonth)) !== p.toolsLeiPerMonth)
      fail(key, `${p.key}: automations' tools ≠ phase row`);
  }
  if (sum(plan.automations.map((a) => a.setupLei)) !== totals.automationsSetupLei)
    fail(key, "automations' setup ≠ automations total");
  const rules = blueprint.engine === "rules";
  const headlineHours = blueprint.headline.ro.match(/cam (\d+)/)?.[1];
  if (rules && totals.hoursPerMonth >= 10 && Number(headlineHours) !== totals.hoursPerMonth)
    fail(key, `headline says ${headlineHours}, total is ${totals.hoursPerMonth}`);
  if (totals.hoursPerMonth >= 10 && !plan.summary[1].ro.includes(`${totals.hoursPerMonth}`))
    fail(key, "Pe scurt 2 does not repeat the total hours");

  // Each strategy card reads its Gantt rows.
  for (const s of strategies) {
    const own = phases.filter((p) => s.phases.some((sp) => sp.key === p.key));
    if (!s.optional && sum(own.map((p) => p.setupLei)) !== s.setupLei)
      fail(key, `${s.id}: card investment ≠ its rows`);
    for (const sp of s.phases) {
      const row = phases.find((p) => p.key === sp.key);
      if (!row || row.title.ro !== sp.title.ro || row.title.en !== sp.title.en)
        fail(key, `${s.id}: phase title differs from the Gantt`);
    }
    if (s.id === "automate" && s.hoursPerMonth !== null) {
      const row = phases.find((p) => p.key === "automation");
      if (row?.hoursPerMonth !== s.hoursPerMonth) fail(key, "automate card ≠ automation row");
    }
  }
  blueprint.roadmap.forEach((r, i) => {
    if (r.title.ro !== phases[i]?.title.ro) fail(key, `roadmap title ${i} ≠ display title`);
  });
  if (strategies.filter((s) => s.start).length > 1) fail(key, "more than one starting card");
  if (phases.filter((p) => p.start).length > 1) fail(key, "more than one starting phase");

  // Series, KPIs and the table agree; net is derived.
  for (const p of plan.series) {
    if (p.net !== p.value - p.cost) fail(key, `month ${p.month}: net not value − cost`);
    if (p.value % 1000 || p.cost % 1000) fail(key, `month ${p.month}: not rounded to 1.000`);
  }
  for (const h of [6, 12, 24] as const) {
    const cells = kpiCells(plan, h);
    const point = plan.series[h - 1];
    const value = cells.find((c) => c.key === "value")?.value.ro ?? "";
    const net = cells.find((c) => c.key === "net")?.value.ro ?? "";
    const digits = (s: string) => Number(s.replace(/[^\d]/g, ""));
    if (digits(value) !== point.value) fail(key, `${h}: KPI value ≠ series`);
    if (digits(net) !== Math.abs(point.net)) fail(key, `${h}: KPI net ≠ series`);
    const row = tableRows(plan, h).find((r) => r.month === h);
    if (row && (row.value !== point.value || row.net !== point.net))
      fail(key, `${h}: table ≠ series`);
  }

  // One break-even month, everywhere.
  const n = plan.breakEven.month;
  if (n !== breakEvenMonth(blueprint.projection))
    fail(key, "break-even ≠ first month-end in profit");
  if (n !== null) {
    const word = `luna ${n}`.replace(" ", " ");
    for (const [where, text] of [
      ["conclusion", plan.text.conclusion.ro],
      ["Pe scurt 3", plan.summary[2].ro],
      ["note 1", plan.notes.payback.ro.toLowerCase()],
    ] as const) {
      if (!text.includes(word)) fail(key, `${where} does not say ${word}`);
    }
    if (!tableRows(plan, 24).some((r) => r.breakEven && r.month === n))
      fail(key, "table does not highlight the break-even month");
    const kpi = kpiCells(plan, 24).find((c) => c.key === "payback")?.value.ro;
    if (kpi !== word) fail(key, `KPI says ${kpi}`);
  }
  if (JSON.stringify(JSON.parse(JSON.stringify(plan))) !== JSON.stringify(plan))
    fail(key, "plan is not JSON-stable");
}

/* ---------------------------------------------------------------- run */

for (const { key, blueprint } of cases) {
  const plan = displayPlan(blueprint);
  checkNumbers(key, blueprint, plan);
  checkCopy(key, plan);
  const t = plan.totals;
  console.log(
    `■ ${key.padEnd(30)} ${t.hoursPerMonth} h · setup ${t.setupLei} (site ${t.siteLei ?? 0}) · tools ${t.toolsLeiPerMonth} · value ${t.monthlyValueLei}/mo · break-even ${plan.breakEven.month ?? "–"} (${plan.breakEven.higherVolume ?? "–"}/${plan.breakEven.lowerVolume ?? "–"}) · ${plan.phases.length} phases`,
  );
}

/* the base case against §3.9 (central values from driver midpoints, so within a step) */
const base = displayPlan(BASE_CASE_BLUEPRINT);
const near = (label: string, got: number | null, want: number, tolerance: number) => {
  if (got === null || Math.abs(got - want) > tolerance)
    fail("base case §3.9", `${label}: ${got}, expected ${want} ± ${tolerance}`);
};
near("payback month", base.breakEven.month, 14, 1);
near("higher-volume month", base.breakEven.higherVolume, 11, 1);
near("lower-volume month", base.breakEven.lowerVolume, 18, 1);
near("hours a month", base.totals.hoursPerMonth, 50, 0);
near("setup", base.totals.setupLei, 30500, 0);
near("site", base.totals.siteLei, 11500, 0);
near("automations setup", base.totals.automationsSetupLei, 19000, 0);
near("tools a month", base.totals.toolsLeiPerMonth, 1100, 0);
near("value a month", base.totals.monthlyValueLei, 2900, 100);
near("hourly", base.totals.hourlyLei, 59, 0);
near("month 6 cost", base.series[5].cost, 23000, 1000);
near("month 12 cost", base.series[11].cost, 29000, 1000);
near("month 24 cost", base.series[23].cost, 42000, 1000);
const rows = base.phases.map(
  (p) => `${p.hoursPerMonth ?? "–"}/${p.setupLei}/${p.toolsLeiPerMonth}`,
);
if (rows.join(" ") !== "–/11500/0 35/8000/600 5/4500/200 10/6500/300")
  fail("base case §3.9", `phase rows ${rows.join(" ")}`);
const titles = base.phases.map((p) => p.title.ro).join(" | ");
if (
  titles !==
  "Site nou și profil Google | Programări și reamintiri automate | Asistent pe site și WhatsApp | Recenzii și evidența solicitărilor"
)
  fail("base case §3.9", `titles ${titles}`);
if (BASE_CASE_BLUEPRINT.offer.planId !== "pro") fail("base case §3.9", "offer is not Pro");

if (print) {
  console.log("\nPe scurt");
  for (const line of base.summary) console.log(`  ${line.ro}\n  ${line.en}`);
  console.log("\nGantt");
  for (const p of base.phases)
    console.log(
      `  ${p.dateLabel.ro.padEnd(11)} ${p.title.ro.padEnd(36)} ${String(p.hoursPerMonth ?? "–").padStart(3)} ${String(p.setupLei).padStart(6)} ${String(p.toolsLeiPerMonth).padStart(4)}  ${p.start ? "Începem aici" : ""}`,
    );
  console.log(`  ${base.text.totalNote.ro} · ${base.text.footer.ro}`);
  console.log(`\n${base.text.conclusion.ro}`);
  for (const c of kpiCells(base, 24)) console.log(`  ${c.label.ro}: ${c.value.ro} (${c.sub.ro})`);
  console.log("\nNote");
  for (const note of [base.notes.payback, base.notes.scope, base.notes.hourValue])
    console.log(`  ${note.ro}`);
}

console.log(
  problems.length
    ? `\n✗ ${problems.length} problem(s):\n${problems.join("\n")}`
    : "\n✓ display checks passed",
);
process.exitCode = problems.length ? 1 : 0;

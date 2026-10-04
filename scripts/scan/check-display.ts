/**
 * Sanity checks for displayPlan() (src/lib/scan/blueprint/display.ts), the one
 * place that turns a blueprint into displayed figures. Checks the plan's
 * acceptance "numbers gates" and "copy gates" on the fixtures, simulated
 * blueprints and a blueprint stored before the central values existed, and
 * the base case (§3.9) against its reference figures. Also the offer (offer.ts,
 * owner decision 2026-10-04): a first project, then a plan whose fee never cancels
 * the payback silently, today's prices on stored blueprints, and the public price
 * list (src/lib/pricing.ts) against what the app grants (src/lib/client-plans.ts).
 * And the prices the scan quotes (owner decision 2026-10-04, the public list wins): every
 * automation's setup and every new site inside the public ranges, the price book and the
 * deep research action prices read from that list, and the fixtures built with today's
 * engine (hour value and prices).
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
import {
  BIGGER_SITE_LEI,
  PRICE_BOOK,
  breakEvenMonth,
  builtAroundAi,
  hourlyCostFor,
  setupPriceFor,
} from "../../src/lib/scan/blueprint/economics";
import { hasWebsiteFor } from "../../src/lib/scan/blueprint/engine";
import { midOf } from "../../src/lib/scan/blueprint/format";
import { getTemplate } from "../../src/lib/scan/blueprint/playbooks";
import { getBusinessType } from "../../src/lib/scan/blueprint/taxonomy";
import { websiteWork } from "../../src/lib/scan/blueprint/website-work";
import { CLIENT_PLANS } from "../../src/lib/client-plans";
import { ACTION_PRICES } from "../../src/lib/deep/report/prices";
import {
  CONSULTANCY_HOUR_LEI,
  FIXED_PROJECTS,
  PLAN_CATALOG,
  PLAN_ORDER,
  deepReportsText,
  fixedProject,
  includedHoursText,
  termText,
} from "../../src/lib/pricing";
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
    // The rebuilt base case pays back only with more hours or a dearer hour: these two keep
    // the smaller-plan offers (Starter with automations, Growth instead of Pro) covered.
    key: "base case, 6 people at 45 lei",
    blueprint: simulateBlueprint(BASE_CASE_BLUEPRINT, {
      teamSize: 6,
      hourlyCostRon: 45,
      volumeFactor: 1,
    }),
  },
  {
    key: "base case, 8 people at 45 lei",
    blueprint: simulateBlueprint(BASE_CASE_BLUEPRINT, {
      teamSize: 8,
      hourlyCostRon: 45,
      volumeFactor: 1,
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
  {
    // An automation with an AI step (client reports with AI summaries): priced like the
    // AI assistant, with the line that says why.
    key: "marketing agency, AI step",
    blueprint: buildRulesBlueprint({
      target: { cui: "47311234" },
      company: {
        cui: "47311234",
        name: "AGENTIA CREATIV NORD S.R.L.",
        displayName: "Agenția Creativ Nord SRL",
        city: "Cluj-Napoca",
        caen: "7311",
        sources: ["anaf"],
      },
      now: NOW,
    }),
  },
  { key: "stored before central values", blueprint: legacy(SAMPLE_BLUEPRINT) },
  { key: "stored with the old offer", blueprint: oldOffer(BASE_CASE_BLUEPRINT) },
];

/** A blueprint stored with the 2026-09 offer (Pro at 1.000 lei, plan fee folded into the payback). */
function oldOffer(blueprint: Blueprint): Blueprint {
  return {
    ...blueprint,
    offer: {
      planId: "pro",
      title: { en: "Pro", ro: "Pro" },
      why: { en: "With Pro we build them with you.", ro: "Cu Pro le construim împreună." },
      includes: [],
      priceNote: {
        en: "1,000 RON a month, plus the setup (fixed price after a call)",
        ro: "1.000 lei pe lună, plus implementarea (preț fix după discuție)",
      },
    },
  };
}

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

const BANNED_CLAIMS = /nelimitat|garantat|unlimited|guarantee/i;

function checkOffer(key: string, blueprint: Blueprint, plan: DisplayPlan) {
  const { offer } = plan;
  const words = texts(offer);
  const hasAutomations = blueprint.opportunities.length > 0;
  for (const text of words) {
    if (BANNED_CLAIMS.test(text.ro) || BANNED_CLAIMS.test(text.en))
      fail(key, `offer claim: "${text.ro}"`);
    if (/1\.000 lei pe lună|250 lei|100 lei pe lună/.test(text.ro))
      fail(key, `old fee: "${text.ro}"`);
  }
  // Stored and displayed offers agree for blueprints built today.
  if (key !== "stored with the old offer" && offer.planId !== blueprint.offer.planId)
    fail(key, `display offer ${offer.planId} ≠ stored ${blueprint.offer.planId}`);
  // The automations' payback is the chart's month: under the first project when it builds
  // automations, otherwise on its own line with their cost (never both).
  const n = plan.breakEven.month;
  const start =
    plan.phases.find((p) => p.start && p.setupLei > 0) ?? plan.phases.find((p) => p.setupLei > 0);
  const startBuildsAutomations = Boolean(start?.opportunityIds.length);
  if (hasAutomations) {
    const want = n === null ? "nu se recuperează" : `luna\u00a0${n}`;
    const line = startBuildsAutomations ? offer.project.payback : offer.laterPayback;
    if (!line?.ro.includes(want)) fail(key, `automations payback "${line?.ro}" ≠ ${want}`);
    if (offer.project.payback && offer.laterPayback) fail(key, "payback said twice");
    if (offer.laterPayback && !/≈\u00a0?[\d.]+\u00a0lei/.test(offer.laterPayback.ro))
      fail(key, `later payback without the cost: "${offer.laterPayback.ro}"`);
  } else if (offer.project.payback || offer.laterPayback) fail(key, "payback without automations");
  // Starter with automations says it does not look after them.
  if (offer.plan?.id === "starter" && hasAutomations && !offer.plan.note?.ro.includes("nu include"))
    fail(key, "Starter with automations without saying it does not look after them");
  if (offer.plan) {
    const entry = PLAN_CATALOG[offer.plan.id];
    const fee = `${entry.priceLei.toLocaleString("de-DE")}\u00a0lei pe lună`;
    if (offer.plan.price.ro !== fee) fail(key, `plan price "${offer.plan.price.ro}" ≠ ${fee}`);
    if (!offer.plan.hours.ro.includes("pe lună")) fail(key, "plan hours without pe lună");
    if (offer.noPlan) fail(key, "plan and no-plan text together");
    if (words.some((w) => /de la \d/.test(w.ro) && w !== offer.project.note))
      fail(key, "'de la' outside the project");
    if (hasAutomations) {
      // The fee never turns the payback into "doesn't pay back".
      if (!offer.plan.payback || /nu se/.test(offer.plan.payback.ro))
        fail(key, `plan without a payback: "${offer.plan.payback?.ro}"`);
      if (n !== null && offer.plan.payback) {
        const m = Number(offer.plan.payback.ro.match(/luna\s(\d+)/)?.[1]);
        if (!(m >= n)) fail(key, `fee payback ${m} before the plan's ${n}`);
      }
    }
    if (offer.reason === "stepped-down" && !offer.plan.note)
      fail(key, "smaller plan without saying why");
  } else if (!offer.noPlan) fail(key, "no plan and no reason");
  // The project alone with website work still says who can look after the site.
  else if ((plan.totals.siteLei ?? 0) > 0 && !offer.noPlan.ro.includes("Starter"))
    fail(key, `project alone without Starter for the website: "${offer.noPlan.ro}"`);
}

/* ------------------------------------------------- prices (public list) */

const AUTOMATION = fixedProject("automation").priceLei;
const ASSISTANT = fixedProject("assistant").priceLei;
const SITE_FROM = fixedProject("site").priceLei.low;
type Bounds = { low: number; high: number; label: string };
const AUTOMATION_RANGE: Bounds = {
  low: AUTOMATION.low,
  high: AUTOMATION.high ?? AUTOMATION.low,
  label: "an automation",
};
const ASSISTANT_RANGE: Bounds = {
  low: ASSISTANT.low,
  high: ASSISTANT.high ?? ASSISTANT.low,
  label: "the AI assistant",
};
/** A new site: "de la 4.500 lei", up to a bigger site; anything above is quoted after the brief. */
const SITE_RANGE: Bounds = { low: SITE_FROM, high: BIGGER_SITE_LEI, label: "a new site" };
const inside = (value: number, b: Bounds) => value >= b.low && value <= b.high;

/** Every automation and every new site this case quotes sits inside the public ranges. */
function checkPrices(key: string, blueprint: Blueprint, plan: DisplayPlan) {
  for (const o of blueprint.opportunities) {
    const template = getTemplate(o.id);
    if (!template) {
      fail(key, `${o.id}: no template to price it`);
      continue;
    }
    const range =
      builtAroundAi(template) || o.complexity === "high" ? ASSISTANT_RANGE : AUTOMATION_RANGE;
    const shown = plan.automations.find((a) => a.id === o.id)?.setupLei;
    for (const [what, value] of [
      ["low", o.setupCostRon.low],
      ["high", o.setupCostRon.high],
      ["central", midOf(o.setupCostRon)],
      ["shown", shown ?? midOf(o.setupCostRon)],
    ] as const) {
      if (!inside(value, range))
        fail(
          key,
          `${o.id}: setup ${what} ${value} outside ${range.label} ${range.low}–${range.high}`,
        );
    }
  }
  const assist = blueprint.strategies.find((st) => st.id === "assist");
  const assistants = blueprint.opportunities.filter(
    (o) => getTemplate(o.id)?.strategy === "assist",
  );
  if (assist && assistants.length <= 1) {
    for (const value of [assist.investmentRon.low, assist.investmentRon.high])
      if (!inside(value, ASSISTANT_RANGE))
        fail(key, `assistant card ${value} outside the public price`);
  }
  const work = websiteWork({
    type: getBusinessType(blueprint.businessType.id),
    websiteActions: blueprint.websiteActions,
    audit: blueprint.audit,
    presence: blueprint.presence,
    hasWebsite: hasWebsiteFor(blueprint),
    opportunityIds: blueprint.opportunities.map((o) => o.id),
  });
  for (const w of work.filter((x) => x.kind === "new-site" || x.kind === "rebuild")) {
    for (const value of [w.cost.low, w.cost.high, (w.cost.low + w.cost.high) / 2])
      if (!inside(value, SITE_RANGE))
        fail(key, `new site ${value} outside ${SITE_RANGE.low}–${SITE_RANGE.high}`);
    if (w.kind === "new-site" && !/după discuție/.test(w.item.ro))
      fail(key, `new site without "a bigger site is quoted after the brief": "${w.item.ro}"`);
  }
  // The site row is the same website work at today's prices (stored phases carry their cost).
  const stored = blueprint.roadmap.find((p) => p.websiteCostRon)?.websiteCostRon;
  const today = work.reduce((sum, w) => sum + (w.cost.low + w.cost.high) / 2, 0);
  if (stored && midOf(stored) !== today)
    fail(key, `site work stored at ${midOf(stored)}, today's price book says ${today}`);
}

/** A fixture is built with today's engine: today's hour value and today's price book. */
function checkFresh(key: string, blueprint: Blueprint) {
  const type = getBusinessType(blueprint.businessType.id);
  const hourly = hourlyCostFor(blueprint.company?.caen, type).hourlyCostRon;
  if (blueprint.assumptions.hourlyCostRon !== hourly)
    fail(
      key,
      `hour value ${blueprint.assumptions.hourlyCostRon}, the engine says ${hourly}: run gen-fixtures`,
    );
  for (const o of blueprint.opportunities) {
    const template = getTemplate(o.id);
    const want = template ? setupPriceFor(template) : null;
    if (!want || o.setupCostRon.low !== want.low || o.setupCostRon.high !== want.high)
      fail(
        key,
        `${o.id}: setup ${o.setupCostRon.low}–${o.setupCostRon.high} ≠ the price book: run gen-fixtures`,
      );
  }
}

/* ---------------------------------------------------------------- run */

for (const { key, blueprint } of cases) {
  const plan = displayPlan(blueprint);
  checkNumbers(key, blueprint, plan);
  checkCopy(key, plan);
  checkOffer(key, blueprint, plan);
  checkPrices(key, blueprint, plan);
  const t = plan.totals;
  console.log(
    `■ ${key.padEnd(30)} ${t.hoursPerMonth} h · setup ${t.setupLei} (site ${t.siteLei ?? 0}) · tools ${t.toolsLeiPerMonth} · value ${t.monthlyValueLei}/mo · break-even ${plan.breakEven.month ?? "–"} (${plan.breakEven.higherVolume ?? "–"}/${plan.breakEven.lowerVolume ?? "–"}) · ${plan.phases.length} phases`,
  );
}

/*
 * The base case's reference figures (central values from driver midpoints, so within a
 * step). Rebuilt on 2026-10-04 with today's engine: the fixture had been made before the
 * hour value became 32 lei (eb8c2b4, the same as deep research) and with the old price
 * book. Was → now, and why:
 * - hour value 59 → 32 lei: the role-based value (1,2 × the minimum wage + CAM, over 168 h).
 * - hours 50 → 45: at 32 lei the lead-capture CRM (5 h) no longer earns its place, so the
 *   last phase is "Recenzii" alone (phase titles and rows below).
 * - value 2.900 → 1.400 lei a month: fewer hours at 32 lei instead of 59.
 * - site 11.500 → 7.000 lei: a new site 4.500–7.500 (≈ 6.000, "de la 4.500 lei") instead
 *   of 6.000–15.000, and the Google profile at 2–4 hours × 300 lei (≈ 900) instead of
 *   500–1.500.
 * - automations 19.000 → 13.500 lei: booking ≈ 3.000 (was 4.500), each simple automation
 *   ≈ 2.000 (was 1.850, the public floor is 1.500), the assistant ≈ 4.500 (unchanged, the
 *   public 3.000–6.000), and no CRM (was 4.500). Setup 30.500 → 20.500 lei in all.
 * - tools 1.100 → 900 lei a month: the CRM's tools go with it.
 * - cost at months 6 / 12 / 24: 23.000 / 29.000 / 42.000 → 17.000 / 22.000 / 33.000 lei.
 * - payback month 14 → none within 24 months (higher volumes: 11 → 20; lower: 18 → none):
 *   1.400 lei a month of value against 900 lei of tools leaves about 500 lei a month to
 *   cover 13.500 lei. Most of that comes from the hour value: with today's engine and the
 *   old prices the base case did not pay back either (setup 26.000 lei).
 */
const base = displayPlan(BASE_CASE_BLUEPRINT);
const near = (label: string, got: number | null, want: number | null, tolerance: number) => {
  const ok = want === null ? got === null : got !== null && Math.abs(got - want) <= tolerance;
  if (!ok)
    fail(
      "base case",
      `${label}: ${got}, expected ${want === null ? "none" : `${want} ± ${tolerance}`}`,
    );
};
near("payback month", base.breakEven.month, null, 0);
near("higher-volume month", base.breakEven.higherVolume, 20, 1);
near("lower-volume month", base.breakEven.lowerVolume, null, 0);
near("hours a month", base.totals.hoursPerMonth, 45, 0);
near("setup", base.totals.setupLei, 20500, 0);
near("site", base.totals.siteLei, 7000, 0);
near("automations setup", base.totals.automationsSetupLei, 13500, 0);
near("tools a month", base.totals.toolsLeiPerMonth, 900, 0);
near("value a month", base.totals.monthlyValueLei, 1400, 100);
near("hourly", base.totals.hourlyLei, 32, 0);
near("month 6 cost", base.series[5].cost, 17000, 1000);
near("month 12 cost", base.series[11].cost, 22000, 1000);
near("month 24 cost", base.series[23].cost, 33000, 1000);
const rows = base.phases.map(
  (p) => `${p.hoursPerMonth ?? "–"}/${p.setupLei}/${p.toolsLeiPerMonth}`,
);
if (rows.join(" ") !== "–/7000/0 35/7000/600 5/4500/200 5/2000/100")
  fail("base case", `phase rows ${rows.join(" ")}`);
const titles = base.phases.map((p) => p.title.ro).join(" | ");
if (
  titles !==
  "Site nou și profil Google | Programări și reamintiri automate | Asistent pe site și WhatsApp | Recenzii"
)
  fail("base case", `titles ${titles}`);
/* an automation priced like the assistant says why */
for (const { key, blueprint } of cases) {
  for (const o of blueprint.opportunities) {
    const template = getTemplate(o.id);
    if (
      !template ||
      template.strategy === "assist" ||
      midOf(o.setupCostRon) <= AUTOMATION_RANGE.high
    )
      continue;
    if (!o.assumptions.some((a) => a.ro.includes("asistent AI") && a.en.includes("AI assistant")))
      fail(key, `${o.id}: priced like the assistant without saying why`);
  }
}
if (
  !cases.some(({ blueprint }) => blueprint.opportunities.some((o) => o.id === "client-reporting"))
)
  fail("price book", "no case covers an automation with an AI step");
/* the fixtures are today's engine output (hour value, price book, site work) */
checkFresh("base case", BASE_CASE_BLUEPRINT);
checkFresh("demo fixture", SAMPLE_BLUEPRINT);
/*
 * The offer per case (owner decision 2026-10-04). The base case was "growth stepped-down"
 * (Pro too dear, Growth paid back in month 24): at 32 lei an hour its automations do not
 * pay back within 24 months even without a plan, so it offers the project alone.
 */
const expectedOffers: Record<string, string> = {
  "base case": "project no-payback-base",
  "demo fixture": "project no-payback",
  "base case, simulated": "pro fits",
  "base case, 6 people at 45 lei": "starter stepped-down",
  "base case, 8 people at 45 lei": "growth stepped-down",
  "demo, quiet simulation": "project no-payback-base",
  "construction, no website": "project no-payback",
  "consulting with a site": "project nothing-to-build",
  "marketing agency, AI step": "project no-payback",
  "stored with the old offer": "project no-payback-base",
};
for (const { key, blueprint } of cases) {
  const want = expectedOffers[key];
  if (!want) continue;
  const { offer } = displayPlan(blueprint);
  const got = `${offer.planId} ${offer.reason}`;
  if (got !== want) fail("offer", `${key}: ${got}, expected ${want}`);
}

/* the price book and the deep research actions read the public list */
const book = PRICE_BOOK;
const bookRanges: Array<[string, { low: number; high: number }, Bounds]> = [
  ["simple automation", book.automationSetup.low, AUTOMATION_RANGE],
  ["medium automation", book.automationSetup.medium, AUTOMATION_RANGE],
  ["high automation", book.automationSetup.high, ASSISTANT_RANGE],
  ["AI automation", book.aiSetup, ASSISTANT_RANGE],
  ["new site", book.newWebsite, SITE_RANGE],
  ["project-size fix", book.websiteFix.project, SITE_RANGE],
];
for (const [label, range, bounds] of bookRanges) {
  if (!inside(range.low, bounds) || !inside(range.high, bounds))
    fail("price book", `${label} ${range.low}–${range.high} outside ${bounds.label}`);
}
if (book.newWebsite.low !== SITE_FROM) fail("price book", `new site not "de la ${SITE_FROM}"`);
if (book.automationSetup.low.low !== AUTOMATION.low)
  fail("price book", "the simplest automation does not start at the public floor");
for (const [label, range] of [
  ["quick fix", book.websiteFix.quick],
  ["medium fix", book.websiteFix.medium],
  ["Google profile", book.googleProfile],
  ["measurement", book.measurement],
] as const) {
  if (range.low % CONSULTANCY_HOUR_LEI || range.high % CONSULTANCY_HOUR_LEI)
    fail(
      "price book",
      `${label} ${range.low}–${range.high} is not whole hours at ${CONSULTANCY_HOUR_LEI} lei`,
    );
}
/* each Vortex Hub "de la" in deep research = the low end of the scan's price for that work */
const DEEP_FLOOR: Record<string, number> = {
  "site.fix_domain": book.websiteFix.quick.low,
  "site.cookie_consent": book.measurement.low,
  "site.speed": book.websiteFix.medium.low,
  "site.own_website": book.newWebsite.low,
  "clients.online_booking": setupPriceFor(getTemplate("online-booking")!).low,
  "clients.reminders": setupPriceFor(getTemplate("appointment-reminders")!).low,
  "clients.quote_request": book.automationSetup.low.low,
};
for (const [id, price] of Object.entries(ACTION_PRICES)) {
  if (!price.vortex) continue;
  const want = DEEP_FLOOR[id];
  if (want === undefined) fail("deep prices", `${id}: no scan price to agree with`);
  else if (price.vortex.setupLei !== want)
    fail("deep prices", `${id}: de la ${price.vortex.setupLei}, the scan starts at ${want}`);
}
for (const id of ["clients.online_booking", "clients.reminders", "clients.quote_request"]) {
  const setup = ACTION_PRICES[id]?.vortex?.setupLei ?? 0;
  if (!inside(setup, AUTOMATION_RANGE))
    fail("deep prices", `${id}: ${setup} outside an automation`);
}

/* the public price list (src/lib/pricing.ts) */
const prices = PLAN_ORDER.map(
  (id) => `${id} ${PLAN_CATALOG[id].priceLei}/${PLAN_CATALOG[id].hoursPerMonth}`,
);
if (prices.join(" ") !== "starter 290/1 growth 790/4 pro 1990/10")
  fail("price list", `plans ${prices.join(" ")}`);
for (const id of PLAN_ORDER) {
  const entry = PLAN_CATALOG[id];
  const app = CLIENT_PLANS[id];
  if (app.hoursPerMonth !== entry.hoursPerMonth)
    fail(
      "price list",
      `${id}: ${entry.hoursPerMonth} h listed, the app grants ${app.hoursPerMonth}`,
    );
  if (
    app.research.reports !== entry.deepReports.count ||
    app.research.period !== entry.deepReports.per
  )
    fail("price list", `${id}: deep research reports differ from the app`);
  const copy = [
    entry.role,
    entry.descriptor,
    ...entry.features,
    ...entry.offerIncludes,
    deepReportsText(id),
    termText(id),
    includedHoursText(entry.hoursPerMonth),
  ];
  for (const text of copy) {
    if (BANNED_CLAIMS.test(text.ro) || BANNED_CLAIMS.test(text.en))
      fail("price list", `claim: "${text.ro}"`);
    if (
      /\bore?\b|\boră\b/.test(text.ro) &&
      /\d\s(ore|oră)/.test(text.ro) &&
      !/pe lună|lucrătoare|din ore/.test(text.ro)
    )
      fail("price list", `hours without "pe lună": "${text.ro}"`);
    if (/[şţŞŢ]/.test(text.ro) || /—/.test(text.ro + text.en))
      fail("price list", `typography: "${text.ro}"`);
  }
}
const projects = FIXED_PROJECTS.map(
  (p) => `${p.id} ${p.priceLei.low}${p.priceLei.high ? `-${p.priceLei.high}` : ""}`,
);
if (projects.join(" ") !== "site 4500 automation 1500-3500 assistant 3000-6000 consultancy 300")
  fail("price list", `projects ${projects.join(" ")}`);

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
  console.log("\nOferta");
  const o = base.offer;
  console.log(`  ${o.title.ro}\n  ${o.why.ro}`);
  console.log(
    `  1 ${o.project.title.ro}: ${o.project.price.ro}. ${o.project.note.ro} ${o.project.payback?.ro ?? ""}`,
  );
  if (o.plan)
    console.log(
      `  2 ${o.plan.name}: ${o.plan.price.ro}, ${o.plan.hours.ro}. ${o.plan.fee.ro} ${o.plan.payback?.ro ?? ""} ${o.plan.note?.ro ?? ""}`,
    );
  if (o.noPlan) console.log(`  2 ${o.noPlan.ro}`);
}

console.log(
  problems.length
    ? `\n✗ ${problems.length} problem(s):\n${problems.join("\n")}`
    : "\n✓ display checks passed",
);
process.exitCode = problems.length ? 1 : 0;

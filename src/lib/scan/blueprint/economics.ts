import type {
  AutomationOpportunity,
  Bilingual,
  BreakEven,
  Blueprint,
  Estimate,
  ProjectionPoint,
  Range,
  RoadmapPhase,
  SimulationInputs,
} from "@/lib/scan/types";
import { officeHourValue } from "@/lib/deep/report/hourly";
import { CONSULTANCY_HOUR_LEI, fixedProject } from "@/lib/pricing";

import {
  addEstimates,
  centred,
  formatNumber,
  mapEstimate,
  midOf,
  midpoint,
  NBSP,
  roCount,
  roNeedsDe,
  roundCount,
  roundHours,
  roundMonths,
  roundRon,
  shareWords,
} from "./format";
import { bi, clamp, type OpportunityTemplate, type SignalContext, type VolumeModel } from "./model";
import type { ResolvedOpportunity } from "./playbooks";
import type { BusinessTypeDef } from "./taxonomy";
import { DIVISION_GROSS_RON, HOURS_PER_MONTH, WAGE_SOURCE } from "./wages";

/* ------------------------------------------------------------ price book */

const SITE = fixedProject("site").priceLei;
const AUTOMATION = fixedProject("automation").priceLei;
const ASSISTANT = fixedProject("assistant").priceLei;
const AUTOMATION_HIGH = AUTOMATION.high ?? AUTOMATION.low;
const AUTOMATION_SPLIT = (AUTOMATION.low + AUTOMATION_HIGH) / 2;

/**
 * The top of the new-site estimate: a bigger presentation site (more than the 6 pages in
 * "de la 4.500 lei", or a second language, +1.000 lei in the analysis §4.3). Anything
 * bigger is quoted after the brief, and the site's line in the plan says so. Market anchors:
 * Revelia's middle tier and Brig's mid-market top are both 7.500 lei.
 */
export const BIGGER_SITE_LEI = 7500;

/** Staff work at the public consultancy rate (300 lei an hour, src/lib/pricing.ts). */
const atHourlyRate = (low: number, high: number): Range => ({
  low: low * CONSULTANCY_HOUR_LEI,
  high: high * CONSULTANCY_HOUR_LEI,
});

/**
 * THE SCAN'S PRICE BOOK (lei, final: Vortex Hub is not a VAT payer).
 *
 * Read from the public price list (src/lib/pricing.ts, owner decision 2026-10-04) so the
 * scan, its PDF and deep research never quote a price the pricing section contradicts:
 * - an automation is "1.500–3.500 lei": the lower half for a simple one, the upper half
 *   for a medium one;
 * - a high-complexity automation, or one built around an AI step, is priced like the AI
 *   assistant, "3.000–6.000 lei" (`setupPriceFor`);
 * - a new site starts at "de la 4.500 lei", up to BIGGER_SITE_LEI for a bigger one;
 * - website fixes, the Google profile and measurement are staff hours at the consultancy
 *   rate (300 lei an hour); a project-size fix costs what a new presentation site costs.
 * Tools are third-party subscriptions and usage (not Vortex Hub's prices), by complexity.
 * Every setup cost, investment, payback and projection comes from this table, and
 * scripts/scan/check-display.ts checks every fixture against the public ranges.
 */
export const PRICE_BOOK = {
  /** One-off setup of an automation, by complexity. */
  automationSetup: {
    low: { low: AUTOMATION.low, high: AUTOMATION_SPLIT },
    medium: { low: AUTOMATION_SPLIT, high: AUTOMATION_HIGH },
    high: { low: ASSISTANT.low, high: ASSISTANT.high ?? ASSISTANT.low },
  },
  /** The AI assistant, and an automation built around an AI step. */
  aiSetup: { low: ASSISTANT.low, high: ASSISTANT.high ?? ASSISTANT.low },
  /** Monthly tool subscriptions for an automation, by complexity. */
  automationTools: {
    low: { low: 50, high: 150 },
    medium: { low: 100, high: 250 },
    high: { low: 250, high: 600 },
  },
  /** Fixing one website finding, by effort: 1–3 hours, 5–10 hours, or a site's worth. */
  websiteFix: {
    quick: atHourlyRate(1, 3),
    medium: atHourlyRate(5, 10),
    project: { low: SITE.low, high: BIGGER_SITE_LEI },
  },
  /** A new presentation website with contact or booking (no working website today). */
  newWebsite: { low: SITE.low, high: BIGGER_SITE_LEI },
  /** Claiming and completing the Google Business Profile: 2–4 hours. */
  googleProfile: atHourlyRate(2, 4),
  /** Visitor statistics, enquiry tracking and cookie consent: 3–6 hours. */
  measurement: atHourlyRate(3, 6),
} satisfies {
  automationSetup: Record<OpportunityTemplate["complexity"], Range>;
  aiSetup: Range;
  automationTools: Record<OpportunityTemplate["complexity"], Range>;
  websiteFix: Record<"quick" | "medium" | "project", Range>;
  newWebsite: Range;
  googleProfile: Range;
  measurement: Range;
};

type PricedTemplate = Pick<OpportunityTemplate, "complexity" | "strategy" | "tools" | "setupRon">;

/**
 * Built around an AI step we set up and test (the assistant, reading orders, drafting
 * replies or summaries). A simple automation that only switches on a ready-made AI feature
 * (AI drafts in Buffer, an AI notes app) stays an ordinary automation.
 */
export function builtAroundAi(template: Omit<PricedTemplate, "setupRon">): boolean {
  if (template.strategy === "assist") return true;
  return template.complexity !== "low" && template.tools.some((tool) => /\bAI\b/.test(tool));
}

/** The setup price of an automation: the public automation price, or the assistant's. */
export function setupPriceFor(template: PricedTemplate): Range {
  if (template.setupRon) return template.setupRon;
  if (builtAroundAi(template)) return PRICE_BOOK.aiSetup;
  return PRICE_BOOK.automationSetup[template.complexity];
}

/** "3.000–6.000 lei" / "3,000–6,000 RON". */
function leiRange(range: Range): Bilingual {
  const text = (lang: "en" | "ro") =>
    `${formatNumber(range.low, lang)}–${formatNumber(range.high, lang)}${NBSP}${lang === "ro" ? "lei" : "RON"}`;
  return bi(text("en"), text("ro"));
}

/** Why an automation's setup sits in the assistant's range (none for the assistant itself). */
function setupNote(template: PricedTemplate): Bilingual | null {
  if (template.setupRon || template.strategy === "assist") return null;
  const ai = builtAroundAi(template);
  if (!ai && template.complexity !== "high") return null;
  const price = leiRange(PRICE_BOOK.aiSetup);
  return ai
    ? bi(
        `It has an AI step, so we estimate the setup at the price of an AI assistant: ${price.en}`,
        `Are un pas cu AI, deci estimăm implementarea la prețul unui asistent AI: ${price.ro}`,
      )
    : bi(
        `It connects several systems, so we estimate the setup as a bigger project: ${price.en}, the price of an AI assistant`,
        `Leagă mai multe sisteme, deci estimăm implementarea ca pentru un proiect mai mare: ${price.ro}, cât un asistent AI`,
      );
}

/**
 * Caps the deprecated corner-paired `paybackMonths` ranges. Never displayed:
 * the screens and the PDF show the break-even month from the projection.
 */
export const PAYBACK_CAP_MONTHS = 36;

/** The window the plan, the chart and the break-even look at. */
export const PROJECTION_MONTHS = 24;

/** Volume scenarios behind the break-even note: ±20%, cost kept at the central quote. */
export const VOLUME_SCENARIOS = { higher: 1.2, lower: 0.8 } as const;

/** Automation never claims more than this share of the team's working time. */
const MAX_SHARE_OF_TEAM_TIME = 0.2;

/* ------------------------------------------------------------ wage costs */

export type HourlyCost = {
  hourlyCostRon: number;
  basis: Bilingual;
  /** CAEN division the figure comes from, when not the national average. */
  division?: string;
  /** The gross monthly earnings the hourly cost is built from (RON). */
  grossRon: number;
  /** The sector the gross figure belongs to; absent for the national average. */
  sector?: Bilingual;
};

/**
 * The value of an hour of the work being automated (reception, booking,
 * admin): the same role-based function as deep research
 * (src/lib/deep/report/hourly.ts, plan A8 and D4), so the same owner never
 * sees two hour values on /scan and /scan/deep. 1.2 × the gross minimum wage,
 * plus CAM, over 168 hours (about 32 lei), capped by the activity's average
 * gross pay (INS) when that is lower. The company's CAEN division decides the
 * cap, else the business type's usual one.
 */
export function hourlyCostFor(caen: string | undefined, type: BusinessTypeDef): HourlyCost {
  const code = caen?.replace(/\D/g, "");
  const division = code && code.length >= 2 ? code.slice(0, 2) : type.wageDivision;
  const hour = officeHourValue(division);
  const capped = hour.cappedByDivision;
  const source = bi(`Source: ${WAGE_SOURCE.release.en}.`, `Sursa: ${WAGE_SOURCE.release.ro}.`);
  return {
    hourlyCostRon: hour.value,
    grossRon: hour.grossRon,
    division: capped,
    sector: capped ? DIVISION_GROSS_RON[capped]?.label : undefined,
    basis: capped
      ? bi(`${hour.basis.en} ${source.en}`, `${hour.basis.ro} ${source.ro}`)
      : hour.basis,
  };
}

/* ------------------------------------------------------------- team size */

/** The type's typical team (geometric mean of its range): volumes are stated for it. */
export function typicalTeam(type: BusinessTypeDef): number {
  return Math.max(1, Math.round(Math.sqrt(type.teamSize.low * type.teamSize.high)));
}

/**
 * Team size estimate: the type's typical range, nudged by what we saw. Always
 * an assumption: the visitor sets the real number in the simulation.
 */
export function estimateTeamSize(
  type: BusinessTypeDef,
  ctx: SignalContext,
): { range: Range; typical: number; notes: Bilingual[] } {
  let factor = 1;
  // Why the estimate moved, as "we lowered it a little because …" clauses.
  const down: Bilingual[] = [];
  const up: Bilingual[] = [];
  if (!ctx.hasWebsite) {
    factor *= 0.8;
    down.push(bi("the business has no website", "firma nu are site"));
  } else if ((ctx.signals?.languages.length ?? 0) > 1) {
    factor *= 1.15;
    up.push(bi("the site is in several languages", "site-ul e în mai multe limbi"));
  }
  const reviews = ctx.presence?.googleRating?.reviews;
  if (reviews !== undefined && reviews >= 300) {
    factor *= 1.2;
    up.push(bi("it has many Google reviews", "are multe recenzii pe Google"));
  } else if (reviews !== undefined && reviews < 20) {
    factor *= 0.85;
    down.push(bi("it has few Google reviews", "are puține recenzii pe Google"));
  }
  const low = Math.max(1, Math.round(type.teamSize.low * factor));
  const high = Math.max(low + 1, Math.round(type.teamSize.high * factor));
  const range = { low, high };
  const typical = Math.max(1, Math.round(Math.sqrt(low * high)));
  const people = bi(
    `${low}–${high} people`,
    `${low}–${high} ${roNeedsDe(high) ? "de " : ""}persoane`,
  );
  const because = (list: Bilingual[], en: string, ro: string) =>
    list.length
      ? bi(
          ` ${en} because ${list.map((x) => x.en).join(" and ")}.`,
          ` ${ro} pentru că ${list.map((x) => x.ro).join(" și ")}.`,
        )
      : bi("", "");
  const lowered = because(down, "We lowered the estimate a little", "Am redus puțin estimarea");
  const raised = because(up, "We raised the estimate a little", "Am mărit puțin estimarea");
  return {
    range,
    typical,
    notes: [
      bi(
        `Team size is an estimate, not data: ${people.en} for a typical ${type.label.en.toLowerCase()}.${lowered.en}${raised.en} Set your real team size in the simulation.`,
        `Mărimea echipei e o estimare, nu o cifră reală: ${people.ro} pentru o afacere de tipul „${type.label.ro}”.${lowered.ro}${raised.ro} Poți pune numărul real de oameni în simulare.`,
      ),
    ],
  };
}

/* ---------------------------------------------------------- opportunities */

/** Occurrences a month for the given inputs. */
export function occurrences(
  volume: VolumeModel,
  inputs: SimulationInputs,
  typical: number,
  adjust = 1,
): number {
  const scale =
    volume.basis === "business"
      ? inputs.teamSize / typical
      : volume.basis === "employee"
        ? inputs.teamSize
        : 1;
  return volume.perMonth * scale * inputs.volumeFactor * adjust;
}

/**
 * Hours of manual work removed a month (unrounded). The central value is the
 * product of the driver midpoints (minutes × automatable share), not the
 * midpoint of the corner products, which would lean on the generous corner.
 */
export function rawHours(volume: VolumeModel, count: number): Estimate & { mid: number } {
  return {
    low: (count * volume.minutes.low * volume.automatable.low) / 60,
    high: (count * volume.minutes.high * volume.automatable.high) / 60,
    mid: (count * midpoint(volume.minutes) * midpoint(volume.automatable)) / 60,
  };
}

export function paybackMonths(setup: Range, monthlySavings: Range, monthlyTools: Range): Range {
  const best = monthlySavings.high - monthlyTools.low;
  const worst = monthlySavings.low - monthlyTools.high;
  const low = best > 0 ? setup.low / best : PAYBACK_CAP_MONTHS;
  const high = worst > 0 ? setup.high / worst : PAYBACK_CAP_MONTHS;
  return {
    low: roundMonths(clamp(low, 0.1, PAYBACK_CAP_MONTHS)),
    high: roundMonths(clamp(Math.max(high, low), 0.1, PAYBACK_CAP_MONTHS)),
  };
}

export type OpportunityInput = {
  resolved: ResolvedOpportunity;
  /** Volume adjustment (1 = playbook; AI review or a previous simulation may change it). */
  adjust: number;
  /** Plain-language reason for a non-1 adjustment, if any. */
  adjustNote?: Bilingual;
};

export type EconomicsContext = {
  inputs: SimulationInputs;
  typical: number;
  /** True when the hourly cost is the INS figure (not the visitor's own). */
  hourlyIsIns: boolean;
};

function volumeLine(volume: VolumeModel, count: number, inputs: SimulationInputs): Bilingual {
  const n = roundCount(count);
  const minutesEn = `${formatFlexRange(volume.minutes, "en")} minutes`;
  const minutesRo = `${formatFlexRange(volume.minutes, "ro")} ${roNeedsDe(volume.minutes.high) ? "de " : ""}minute`;
  const team =
    volume.basis === "fixed"
      ? bi("", "")
      : bi(
          ` for a team of ${inputs.teamSize}`,
          ` pentru o echipă de ${inputs.teamSize === 1 ? "o persoană" : roCount(inputs.teamSize, "persoane")}`,
        );
  return bi(
    `About ${formatNumber(n, "en")} ${volume.unit.en} a month${team.en}, ${minutesEn} each by hand`,
    `Aproximativ ${roCount(n, volume.unit.ro)} pe lună${team.ro}, câte ${minutesRo} de lucru manual fiecare`,
  );
}

/** "1.5–3": decimals only where needed. */
function formatFlexRange(range: Range, lang: "en" | "ro") {
  const one = (x: number) => formatNumber(x, lang, Number.isInteger(x) ? 0 : 1);
  return range.low === range.high ? one(range.low) : `${one(range.low)}–${one(range.high)}`;
}

/** The automatable share in words: an assumption, never printed as a percentage. */
function shareLine(share: Range): Bilingual {
  const words = shareWords(midpoint(share));
  return bi(
    `${words.en[0].toUpperCase()}${words.en.slice(1)} of that work handled automatically`,
    `${words.ro[0].toUpperCase()}${words.ro.slice(1)} din această muncă se face automat`,
  );
}

function costLine(ctx: EconomicsContext): Bilingual {
  const h = ctx.inputs.hourlyCostRon;
  return ctx.hourlyIsIns
    ? bi(
        // The same hour value as deep research (src/lib/deep/report/hourly.ts).
        `Loaded staff cost ${h} RON/hour for office and reception work (1.2 × the minimum wage, or the sector's average pay when lower, plus CAM)`,
        `Cost total angajator: ${h} lei pe oră pentru munca de birou și recepție (1,2 × salariul minim sau salariul mediu din domeniu, dacă e mai mic, plus CAM)`,
      )
    : bi(
        `Staff cost ${h} RON/hour (your figure)`,
        `Cost total angajator: ${h} lei pe oră (valoarea introdusă de tine)`,
      );
}

/**
 * Turns the selected opportunities into numbers for the given inputs, keeping
 * the total within a sane share of the team's time.
 */
export function computeOpportunities(
  items: OpportunityInput[],
  ctx: EconomicsContext,
): { opportunities: AutomationOpportunity[]; cappedBy: number } {
  const counts = items.map((item) =>
    occurrences(item.resolved.volume, ctx.inputs, ctx.typical, item.adjust),
  );
  const raw = items.map((item, i) => rawHours(item.resolved.volume, counts[i]));
  const totalHigh = raw.reduce((sum, h) => sum + h.high, 0);
  const capHours = MAX_SHARE_OF_TEAM_TIME * ctx.inputs.teamSize * HOURS_PER_MONTH;
  const cappedBy = totalHigh > capHours ? capHours / totalHigh : 1;

  const opportunities = items.map((item, i): AutomationOpportunity => {
    const { template, volume } = item.resolved;
    const count = counts[i] * cappedBy;
    const hours = mapEstimate(raw[i], (h) => roundHours(h * cappedBy));
    const savings = mapEstimate(raw[i], (h) => roundRon(h * cappedBy * ctx.inputs.hourlyCostRon));
    // Setup at the central price-book quote; tools at the middle of base + usage.
    const setup = centred(setupPriceFor(template));
    const baseTools = template.monthlyToolsRon ?? PRICE_BOOK.automationTools[template.complexity];
    const usage = template.usageCostRon ?? { low: 0, high: 0 };
    const tools = {
      low: roundRon(baseTools.low + usage.low * count),
      high: roundRon(baseTools.high + usage.high * count),
      mid: roundRon(midpoint(baseTools) + midpoint(usage) * count),
    };
    const payback = paybackMonths(setup, savings, tools);

    const assumptions: Bilingual[] = [
      volumeLine(volume, count, ctx.inputs),
      shareLine(volume.automatable),
      costLine(ctx),
    ];
    if (template.usageCostRon) {
      const monthly = roundRon(midpoint(usage) * count);
      assumptions.push(
        bi(
          `Tools include about ${formatNumber(monthly, "en")} RON a month of messages or AI usage (${formatFlexCost(usage, "en")} RON each)`,
          `Costul instrumentelor include cam ${formatNumber(monthly, "ro")} lei pe lună pentru mesaje sau AI (câte ${formatFlexCost(usage, "ro")} lei fiecare)`,
        ),
      );
    }
    if (ctx.inputs.volumeFactor !== 1) {
      assumptions.push(
        bi(
          `Volumes set to ×${formatNumber(ctx.inputs.volumeFactor, "en", 2)} of typical in the simulation`,
          `În simulare, volumele sunt ×${formatNumber(ctx.inputs.volumeFactor, "ro", 2)} față de cele tipice`,
        ),
      );
    }
    if (item.adjustNote) assumptions.push(item.adjustNote);
    if (cappedBy < 1) {
      assumptions.push(
        bi(
          "Scaled down so all automations together stay under 20% of the team's working time",
          "Valori reduse astfel încât toate automatizările împreună să nu depășească 20% din timpul de lucru al echipei",
        ),
      );
    }
    if (template.note) assumptions.push(template.note);
    const priced = setupNote(template);
    if (priced) assumptions.push(priced);

    return {
      id: template.id,
      title: item.resolved.title,
      problem: item.resolved.problem,
      solution: item.resolved.solution,
      process: template.process,
      impact: template.impact,
      complexity: template.complexity,
      hoursSavedPerMonth: hours,
      monthlySavingsRon: savings,
      setupCostRon: setup,
      monthlyToolCostRon: tools,
      paybackMonths: payback,
      tools: [...template.tools],
      assumptions,
    };
  });

  return { opportunities, cappedBy };
}

function formatFlexCost(range: Range, lang: "en" | "ro") {
  return `${formatNumber(range.low, lang, 2)}–${formatNumber(range.high, lang, 2)}`;
}

/* ---------------------------------------------------------------- totals */

export function computeTotals(opportunities: AutomationOpportunity[]): Blueprint["totals"] {
  const hours = addEstimates(opportunities.map((o) => o.hoursSavedPerMonth));
  const savings = addEstimates(opportunities.map((o) => o.monthlySavingsRon));
  const setup = addEstimates(opportunities.map((o) => o.setupCostRon));
  const tools = addEstimates(opportunities.map((o) => o.monthlyToolCostRon));
  return {
    hoursSavedPerMonth: mapEstimate(hours, roundHours),
    monthlySavingsRon: mapEstimate(savings, roundRon),
    annualSavingsRon: mapEstimate(savings, (x) => roundRon(x * 12)),
    setupCostRon: mapEstimate(setup, roundRon),
    paybackMonths: paybackMonths(setup, savings, tools),
  };
}

/** Totals with the break-even attached (one shape for the builder and the simulation). */
export function withBreakEven(
  totals: Blueprint["totals"],
  breakEven: BreakEven,
): Blueprint["totals"] {
  return { ...totals, breakEven };
}

/* ------------------------------------------------------------ projection */

/** Months from a phase's start until an automation runs, and its ramp to full effect. */
const BUILD_MONTHS = 1;
const RAMP = [0.5, 1];

/**
 * Cumulative savings vs cumulative cost for months 1–24. Setup is paid when
 * its roadmap phase starts; tools are paid and savings ramp up (50 %, then
 * 100 %) from the month after. Website fixes are priced in the strategies,
 * not here.
 */
export function computeProjection(
  opportunities: AutomationOpportunity[],
  roadmap: RoadmapPhase[],
  months = PROJECTION_MONTHS,
): ProjectionPoint[] {
  const startOf = (id: string) =>
    roadmap.find((phase) => phase.opportunityIds.includes(id))?.startMonth ?? 1;
  const points: ProjectionPoint[] = [];
  const savings = { low: 0, high: 0, mid: 0 };
  const cost = { low: 0, high: 0, mid: 0 };
  for (let month = 1; month <= months; month++) {
    for (const o of opportunities) {
      const start = startOf(o.id);
      if (month === start) {
        cost.low += o.setupCostRon.low;
        cost.high += o.setupCostRon.high;
        cost.mid += midOf(o.setupCostRon);
      }
      const live = month - (start + BUILD_MONTHS);
      if (live >= 0) {
        const ramp = RAMP[Math.min(live, RAMP.length - 1)];
        savings.low += o.monthlySavingsRon.low * ramp;
        savings.high += o.monthlySavingsRon.high * ramp;
        savings.mid += midOf(o.monthlySavingsRon) * ramp;
        cost.low += o.monthlyToolCostRon.low;
        cost.high += o.monthlyToolCostRon.high;
        cost.mid += midOf(o.monthlyToolCostRon);
      }
    }
    points.push({
      month,
      cumulativeSavingsRon: mapEstimate(savings, roundRon),
      cumulativeCostRon: mapEstimate(cost, roundRon),
    });
  }
  return points;
}

/* ------------------------------------------------------------ break-even */

/**
 * The first plan month whose cumulative central value covers the cumulative
 * central cost; months where nothing is spent or earned yet are skipped. Null
 * when it doesn't happen within the projection. `value` swaps in a scenario's
 * value series (cost stays the one in `points`).
 */
export function breakEvenMonth(
  points: ProjectionPoint[],
  value: (point: ProjectionPoint, index: number) => number = (p) => midOf(p.cumulativeSavingsRon),
): number | null {
  for (let i = 0; i < points.length; i++) {
    const saved = value(points[i], i);
    const spent = midOf(points[i].cumulativeCostRon);
    if (spent <= 0 && saved <= 0) continue;
    if (saved >= spent) return points[i].month;
  }
  return null;
}

/**
 * Where the central value and cost lines cross, interpolated between month
 * ends. For drawing the chart's break-even line only; the month a visitor
 * reads is `breakEvenMonth`.
 */
export function crossingMonth(points: ProjectionPoint[]): number | null {
  let prev: { month: number; gap: number } | null = null;
  for (const point of points) {
    const saved = midOf(point.cumulativeSavingsRon);
    const spent = midOf(point.cumulativeCostRon);
    if (spent <= 0 && saved <= 0) continue;
    const gap = saved - spent;
    if (gap >= 0) {
      if (!prev) return point.month;
      return prev.month + (-prev.gap / (gap - prev.gap)) * (point.month - prev.month);
    }
    prev = { month: point.month, gap };
  }
  return null;
}

/**
 * The break-even month and its volume scenarios. `scenario(factor)` returns
 * the projection with volumes × factor; only its value series is used, so the
 * cost stays at the central quote (a range on our own price reads as hedging).
 */
export function computeBreakEven(
  projection: ProjectionPoint[],
  scenario: (factor: number) => ProjectionPoint[],
): BreakEven {
  const at = (factor: number) => {
    const values = scenario(factor);
    return breakEvenMonth(projection, (_, i) =>
      values[i] ? midOf(values[i].cumulativeSavingsRon) : 0,
    );
  };
  return {
    month: breakEvenMonth(projection),
    higherVolume: at(VOLUME_SCENARIOS.higher),
    lowerVolume: at(VOLUME_SCENARIOS.lower),
  };
}

import type {
  AutomationOpportunity,
  Bilingual,
  Blueprint,
  ProjectionPoint,
  Range,
  RoadmapPhase,
  SimulationInputs,
} from "@/lib/scan/types";

import {
  addRanges,
  formatNumber,
  formatRange,
  mapRange,
  roCount,
  roNeedsDe,
  roundCount,
  roundHours,
  roundMonths,
  roundRon,
} from "./format";
import { bi, clamp, type OpportunityTemplate, type SignalContext, type VolumeModel } from "./model";
import type { ResolvedOpportunity } from "./playbooks";
import type { BusinessTypeDef } from "./taxonomy";
import {
  CAM_RATE,
  DIVISION_GROSS_RON,
  HOURS_PER_MONTH,
  NATIONAL_GROSS_RON,
  WAGE_SOURCE,
} from "./wages";

/* ------------------------------------------------------------ price book */

/**
 * OWNER-EDITABLE PRICE BOOK (RON, VAT excluded).
 *
 * Conservative Romanian market estimates for a small studio or freelancer
 * delivering the work (setup = one-off build; tools = monthly subscriptions
 * and usage). Vortex should replace these with its real prices: every setup
 * cost, investment range, payback and projection in the blueprint comes from
 * this table, so changing a number here changes them all consistently.
 */
export const PRICE_BOOK = {
  /** One-off setup of an automation, by complexity. */
  automationSetup: {
    low: { low: 1200, high: 2500 },
    medium: { low: 3000, high: 6000 },
    high: { low: 7000, high: 14000 },
  },
  /** Monthly tool subscriptions for an automation, by complexity. */
  automationTools: {
    low: { low: 50, high: 150 },
    medium: { low: 100, high: 250 },
    high: { low: 250, high: 600 },
  },
  /** Fixing one website finding, by effort. */
  websiteFix: {
    quick: { low: 400, high: 1000 },
    medium: { low: 1500, high: 3500 },
    project: { low: 5000, high: 12000 },
  },
  /** A new fast, mobile-first website with contact/booking (no website today). */
  newWebsite: { low: 6000, high: 15000 },
  /** Claiming and completing the Google Business Profile. */
  googleProfile: { low: 500, high: 1500 },
  /** Analytics, conversion tracking and cookie consent. */
  measurement: { low: 800, high: 2000 },
} satisfies {
  automationSetup: Record<OpportunityTemplate["complexity"], Range>;
  automationTools: Record<OpportunityTemplate["complexity"], Range>;
  websiteFix: Record<"quick" | "medium" | "project", Range>;
  newWebsite: Range;
  googleProfile: Range;
  measurement: Range;
};

/** Paybacks longer than this are shown as this many months (with a note). */
export const PAYBACK_CAP_MONTHS = 36;

/** Automation never claims more than this share of the team's working time. */
const MAX_SHARE_OF_TEAM_TIME = 0.2;

/* ------------------------------------------------------------ wage costs */

export type HourlyCost = {
  hourlyCostRon: number;
  basis: Bilingual;
  /** CAEN division the figure comes from, when not the national average. */
  division?: string;
};

const loaded = (gross: number) => Math.round((gross * (1 + CAM_RATE)) / HOURS_PER_MONTH);

/**
 * Loaded hourly staff cost from INS average gross earnings for the company's
 * CAEN division (or the type's usual one), plus CAM, over 168 hours. Capped at
 * the national average because the work being automated is routine admin.
 */
export function hourlyCostFor(caen: string | undefined, type: BusinessTypeDef): HourlyCost {
  const code = caen?.replace(/\D/g, "");
  const division =
    code && code.length >= 2 && DIVISION_GROSS_RON[code.slice(0, 2)]
      ? code.slice(0, 2)
      : type.wageDivision && DIVISION_GROSS_RON[type.wageDivision]
        ? type.wageDivision
        : undefined;
  const source = bi(`Source: ${WAGE_SOURCE.release.en}.`, `Sursa: ${WAGE_SOURCE.release.ro}.`);
  const fmt = (value: number) => ({ en: formatNumber(value, "en"), ro: formatNumber(value, "ro") });
  const sentence = (lead: Bilingual, hourly: number) =>
    bi(
      `${lead.en}, plus the 2.25% employer contribution (CAM), over ${HOURS_PER_MONTH} working hours a month = ${hourly} RON/hour. ${source.en}`,
      `${lead.ro}, plus contribuția asiguratorie pentru muncă (CAM) de 2,25%, împărțit la ${HOURS_PER_MONTH} de ore lucrate pe lună = ${hourly} lei/oră. ${source.ro}`,
    );
  const national = fmt(NATIONAL_GROSS_RON);

  if (!division) {
    const hourly = loaded(NATIONAL_GROSS_RON);
    return {
      hourlyCostRon: hourly,
      basis: sentence(
        bi(
          `National average gross monthly earnings (INS, ${WAGE_SOURCE.month.en}): ${national.en} RON`,
          `Câștigul salarial mediu brut pe economie (INS, ${WAGE_SOURCE.month.ro}): ${national.ro} lei`,
        ),
        hourly,
      ),
    };
  }

  const { gross, label } = DIVISION_GROSS_RON[division];
  const g = fmt(gross);
  if (gross > NATIONAL_GROSS_RON) {
    const hourly = loaded(NATIONAL_GROSS_RON);
    return {
      hourlyCostRon: hourly,
      division,
      basis: sentence(
        bi(
          `Your sector (${label.en}, CAEN division ${division}) averages ${g.en} RON gross a month (INS, ${WAGE_SOURCE.month.en}), above the national average, so we use the national ${national.en} RON because the work being automated is routine admin`,
          `Sectorul tău (${label.ro}, diviziunea CAEN ${division}) are un câștig mediu brut de ${g.ro} lei pe lună (INS, ${WAGE_SOURCE.month.ro}), peste media națională; folosim totuși media națională de ${national.ro} lei, pentru că se automatizează muncă administrativă de rutină`,
        ),
        hourly,
      ),
    };
  }
  const hourly = loaded(gross);
  return {
    hourlyCostRon: hourly,
    division,
    basis: sentence(
      bi(
        `INS average gross monthly earnings in ${label.en} (CAEN Rev.3 division ${division}), ${WAGE_SOURCE.month.en}: ${g.en} RON`,
        `Câștigul salarial mediu brut INS în ${label.ro} (diviziunea CAEN Rev.3 ${division}), ${WAGE_SOURCE.month.ro}: ${g.ro} lei`,
      ),
      hourly,
    ),
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
  const reasons: Bilingual[] = [];
  if (!ctx.hasWebsite) {
    factor *= 0.8;
    reasons.push(
      bi("no website, so likely on the smaller side", "fără site, deci probabil mai mică"),
    );
  } else if ((ctx.signals?.languages.length ?? 0) > 1) {
    factor *= 1.15;
    reasons.push(bi("a site in several languages", "un site în mai multe limbi"));
  }
  const reviews = ctx.presence?.googleRating?.reviews;
  if (reviews !== undefined && reviews >= 300) {
    factor *= 1.2;
    reasons.push(bi("many Google reviews", "multe recenzii Google"));
  } else if (reviews !== undefined && reviews < 20) {
    factor *= 0.85;
    reasons.push(bi("few Google reviews", "puține recenzii Google"));
  }
  const low = Math.max(1, Math.round(type.teamSize.low * factor));
  const high = Math.max(low + 1, Math.round(type.teamSize.high * factor));
  const range = { low, high };
  const typical = Math.max(1, Math.round(Math.sqrt(low * high)));
  const adjusted = reasons.length
    ? bi(
        `, adjusted for ${reasons.map((x) => x.en).join(" and ")}`,
        `, ajustată în funcție de ${reasons.map((x) => x.ro).join(" și ")}`,
      )
    : bi("", "");
  return {
    range,
    typical,
    notes: [
      bi(
        `Team size is an estimate for a typical ${type.label.en.toLowerCase()} (${low}–${high} people${adjusted.en}), not data. Set your real team size in the simulation.`,
        `Mărimea echipei este o estimare pentru o afacere tipică de tipul „${type.label.ro}” (${low}–${high} ${roNeedsDe(high) ? "de " : ""}persoane${adjusted.ro}), nu o cifră reală. Poți introduce numărul real de oameni în simulare.`,
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

/** Hours of manual work removed a month (unrounded). */
export function rawHours(volume: VolumeModel, count: number): Range {
  return {
    low: (count * volume.minutes.low * volume.automatable.low) / 60,
    high: (count * volume.minutes.high * volume.automatable.high) / 60,
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

function shareLine(share: Range): Bilingual {
  const pct = mapRange(share, (x) => Math.round(x * 100));
  return bi(
    `${formatRange(pct, "en")}% of that work handled automatically`,
    `${formatRange(pct, "ro")}% din această muncă este preluată automat`,
  );
}

function costLine(ctx: EconomicsContext): Bilingual {
  const h = ctx.inputs.hourlyCostRon;
  return ctx.hourlyIsIns
    ? bi(
        `Loaded staff cost ${h} RON/hour (INS average earnings, ${WAGE_SOURCE.month.en})`,
        `Cost total angajator: ${h} lei/oră (câștigul salarial mediu INS, ${WAGE_SOURCE.month.ro})`,
      )
    : bi(
        `Staff cost ${h} RON/hour (your figure)`,
        `Cost total angajator: ${h} lei/oră (valoarea introdusă de tine)`,
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
    const hours = mapRange(raw[i], (h) => roundHours(h * cappedBy));
    const savings = mapRange(raw[i], (h) => roundRon(h * cappedBy * ctx.inputs.hourlyCostRon));
    const setup = template.setupRon ?? PRICE_BOOK.automationSetup[template.complexity];
    const baseTools = template.monthlyToolsRon ?? PRICE_BOOK.automationTools[template.complexity];
    const usage = template.usageCostRon ?? { low: 0, high: 0 };
    const tools = {
      low: roundRon(baseTools.low + usage.low * count),
      high: roundRon(baseTools.high + usage.high * count),
    };
    const payback = paybackMonths(setup, savings, tools);

    const assumptions: Bilingual[] = [
      volumeLine(volume, count, ctx.inputs),
      shareLine(volume.automatable),
      costLine(ctx),
    ];
    if (template.usageCostRon) {
      const monthly = mapRange(usage, (x) => roundRon(x * count));
      assumptions.push(
        bi(
          `Tools include about ${formatRange(monthly, "en")} RON a month of messages or AI usage (${formatFlexCost(usage, "en")} RON each)`,
          `Costul instrumentelor include aproximativ ${formatRange(monthly, "ro")} lei pe lună pentru mesaje sau AI (câte ${formatFlexCost(usage, "ro")} lei fiecare)`,
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
    if (payback.high >= PAYBACK_CAP_MONTHS) {
      assumptions.push(
        bi(
          `In the cautious case this takes ${PAYBACK_CAP_MONTHS}+ months to pay back`,
          `În varianta prudentă, investiția se recuperează în peste ${PAYBACK_CAP_MONTHS} de luni`,
        ),
      );
    }
    if (template.note) assumptions.push(template.note);

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
      setupCostRon: { ...setup },
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
  const hours = addRanges(opportunities.map((o) => o.hoursSavedPerMonth));
  const savings = addRanges(opportunities.map((o) => o.monthlySavingsRon));
  const setup = addRanges(opportunities.map((o) => o.setupCostRon));
  const tools = addRanges(opportunities.map((o) => o.monthlyToolCostRon));
  return {
    hoursSavedPerMonth: mapRange(hours, roundHours),
    monthlySavingsRon: mapRange(savings, roundRon),
    annualSavingsRon: mapRange(savings, (x) => roundRon(x * 12)),
    setupCostRon: mapRange(setup, roundRon),
    paybackMonths: paybackMonths(setup, savings, tools),
  };
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
  months = 24,
): ProjectionPoint[] {
  const startOf = (id: string) =>
    roadmap.find((phase) => phase.opportunityIds.includes(id))?.startMonth ?? 1;
  const points: ProjectionPoint[] = [];
  const savings = { low: 0, high: 0 };
  const cost = { low: 0, high: 0 };
  for (let month = 1; month <= months; month++) {
    for (const o of opportunities) {
      const start = startOf(o.id);
      if (month === start) {
        cost.low += o.setupCostRon.low;
        cost.high += o.setupCostRon.high;
      }
      const live = month - (start + BUILD_MONTHS);
      if (live >= 0) {
        const ramp = RAMP[Math.min(live, RAMP.length - 1)];
        savings.low += o.monthlySavingsRon.low * ramp;
        savings.high += o.monthlySavingsRon.high * ramp;
        cost.low += o.monthlyToolCostRon.low;
        cost.high += o.monthlyToolCostRon.high;
      }
    }
    points.push({
      month,
      cumulativeSavingsRon: mapRange(savings, roundRon),
      cumulativeCostRon: mapRange(cost, roundRon),
    });
  }
  return points;
}

import type { AutomationOpportunity, Blueprint, SimulationInputs } from "@/lib/scan/types";

import { buildHeadline, buildSummary, businessName } from "./copy";
import { computeProjection, computeTotals, hourlyCostFor, paybackMonths } from "./economics";
import {
  automationPotentialOf,
  computeMoney,
  hasWebsiteFor,
  hasWorkingWebsite,
  readAiAdjust,
  type Adjustments,
} from "./engine";
import { mapRange, roundHours, roundRon } from "./format";
import { bi, clamp } from "./model";
import { buildOffer } from "./offer";
import { resolveOpportunity } from "./playbooks";
import { refreshStrategies } from "./strategies";
import { getBusinessType } from "./taxonomy";

/*
 * The strategy simulation: recomputes hours, savings, paybacks, totals, the
 * automation outcome, the recommendation and the projection from the same
 * formulas as the builder, for the visitor's team size, hourly cost and
 * volume. Pure and fast enough for every slider move. Always pass the
 * original blueprint (or a simulated one: both are consistent).
 */

export const SIMULATION_LIMITS = {
  teamSize: { min: 1, max: 1000 },
  hourlyCostRon: { min: 10, max: 500 },
  volumeFactor: { min: 0.5, max: 2 },
} as const;

function sanitize(inputs: SimulationInputs, fallback: SimulationInputs): SimulationInputs {
  const pick = (value: number, previous: number, min: number, max: number) =>
    clamp(Number.isFinite(value) ? value : previous, min, max);
  const L = SIMULATION_LIMITS;
  return {
    teamSize: Math.round(pick(inputs.teamSize, fallback.teamSize, L.teamSize.min, L.teamSize.max)),
    hourlyCostRon: Math.round(
      pick(inputs.hourlyCostRon, fallback.hourlyCostRon, L.hourlyCostRon.min, L.hourlyCostRon.max),
    ),
    volumeFactor:
      Math.round(
        pick(inputs.volumeFactor, fallback.volumeFactor, L.volumeFactor.min, L.volumeFactor.max) *
          100,
      ) / 100,
  };
}

/** Fallback for an opportunity that is not in the catalogue: scale its hours linearly. */
function scaleUnknown(
  o: AutomationOpportunity,
  from: SimulationInputs,
  to: SimulationInputs,
): AutomationOpportunity {
  const ratio = (to.teamSize / from.teamSize) * (to.volumeFactor / from.volumeFactor);
  const hours = mapRange(o.hoursSavedPerMonth, (h) => roundHours(h * ratio));
  const savings = mapRange(hours, (h) => roundRon(h * to.hourlyCostRon));
  return {
    ...o,
    hoursSavedPerMonth: hours,
    monthlySavingsRon: savings,
    paybackMonths: paybackMonths(o.setupCostRon, savings, o.monthlyToolCostRon),
  };
}

export function simulateBlueprint(blueprint: Blueprint, inputs: SimulationInputs): Blueprint {
  const previous = blueprint.assumptions.simulation;
  const next = sanitize(inputs, previous);
  const type = getBusinessType(blueprint.businessType.id);
  const ins = hourlyCostFor(blueprint.company?.caen, type);
  const hourlyIsIns = next.hourlyCostRon === ins.hourlyCostRon;

  const adjustments: Adjustments = new Map();
  const known: string[] = [];
  for (const o of blueprint.opportunities) {
    if (!resolveOpportunity(type.id, o.id)) continue;
    known.push(o.id);
    const ai = readAiAdjust(o);
    if (ai) adjustments.set(o.id, ai);
  }
  const computed = new Map(
    computeMoney({ type, ids: known, inputs: next, hourlyIsIns, adjustments }).opportunities.map(
      (o) => [o.id, o],
    ),
  );
  const opportunities = blueprint.opportunities.map((o) => {
    const fresh = computed.get(o.id);
    return fresh
      ? { ...fresh, title: o.title, problem: o.problem, solution: o.solution }
      : scaleUnknown(o, previous, next);
  });

  const totals = computeTotals(opportunities);
  const hasWebsite = hasWebsiteFor(blueprint);
  const strategies = refreshStrategies(
    blueprint.strategies,
    opportunities,
    blueprint.scores.websiteHealth,
    hasWorkingWebsite(blueprint.audit, hasWebsite),
  );

  // AI-written copy is validated to contain no figures; anything with a digit is template copy.
  const refresh = (text: { en: string; ro: string }) =>
    blueprint.engine === "rules" || /\d/.test(text.en) || /\d/.test(text.ro);
  const stepCount = blueprint.roadmap.reduce((sum, phase) => sum + phase.items.length, 0);

  return {
    ...blueprint,
    scores: {
      ...blueprint.scores,
      automationPotential: automationPotentialOf(totals, next.teamSize),
    },
    headline: refresh(blueprint.headline)
      ? buildHeadline({ name: businessName(blueprint), type, totals, stepCount })
      : blueprint.headline,
    summary: refresh(blueprint.summary)
      ? buildSummary({
          type,
          opportunities,
          totals,
          hourlyCostRon: next.hourlyCostRon,
          websiteActions: blueprint.websiteActions,
          audit: blueprint.audit,
          hasWebsite,
        })
      : blueprint.summary,
    opportunities,
    totals,
    strategies,
    projection: computeProjection(opportunities, blueprint.roadmap),
    offer: buildOffer({ opportunities, strategies, totals }),
    assumptions: {
      ...blueprint.assumptions,
      hourlyCostRon: next.hourlyCostRon,
      hourlyCostBasis: hourlyIsIns
        ? ins.basis
        : bi(
            `Set by you in the simulation. For reference, INS average earnings give ${ins.hourlyCostRon} RON/hour for this sector.`,
            `Valoare introdusă de tine în simulare. Ca reper, câștigul salarial mediu INS înseamnă ${ins.hourlyCostRon} lei/oră pentru acest sector.`,
          ),
      simulation: next,
    },
  };
}

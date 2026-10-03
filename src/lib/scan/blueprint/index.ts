import type {
  Bilingual,
  Blueprint,
  BusinessType,
  CompanyProfile,
  Competitor,
  OnlinePresence,
  ScanTarget,
  SimulationInputs,
  WebsiteAudit,
} from "@/lib/scan/types";

import { baseNotes, buildHeadline, buildSummary, businessName, DISCLAIMER } from "./copy";
import {
  computeOpportunities,
  computeProjection,
  estimateTeamSize,
  hourlyCostFor,
  typicalTeam,
} from "./economics";
import {
  automationPotentialOf,
  computeMoney,
  digitalMaturityOf,
  hasWebsiteFor,
  signalContext,
  websiteHealthOf,
  type Adjustments,
} from "./engine";
import { midpoint } from "./format";
import { bi } from "./model";
import { buildOffer } from "./offer";
import { candidateIds, getPlaybook, resolveOpportunity } from "./playbooks";
import { buildRoadmap } from "./roadmap";
import { buildStrategies, pickWebsiteActions } from "./strategies";
import { classifyBusiness, getBusinessType, type BusinessTypeDef } from "./taxonomy";

/*
 * Vortex Scan blueprint engine (rules): business type → playbook
 * opportunities → economics from INS wages and the price book → strategies,
 * roadmap, projection and offer. Pure and deterministic; runs in the browser
 * and on the server (no Node APIs).
 */

export { simulateBlueprint } from "./simulate";
export {
  BUSINESS_TYPES,
  classifyBusiness,
  competitorKeywords,
  getBusinessType,
  listBusinessTypes,
} from "./taxonomy";
export { PRICE_BOOK, hourlyCostFor } from "./economics";

export type BlueprintInput = {
  target: ScanTarget;
  company?: CompanyProfile | null;
  audit?: WebsiteAudit | null;
  presence?: OnlinePresence | null;
  competitors?: Competitor[];
  /** The visitor's correction of the activity ("Edit business"), a BUSINESS_TYPES id. */
  businessTypeId?: string;
  /** Fixes generatedAt (and the id's date); defaults to the audit time, else now. */
  now?: string | Date;
};

/** Changes the AI review may make; the money is still computed here. */
export type BlueprintOverrides = {
  /** Keep this classification instead of classifying again (used by the AI rebuild). */
  fixedType?: BusinessType;
  businessType?: { label?: Bilingual; confidence?: number; basis?: string[] };
  /** Per opportunity id: volume factor (0.5–1.5) and the reason shown with it. */
  adjustments?: Adjustments;
  /** Up to two catalogue ids to add. */
  extraOpportunityIds?: string[];
  engine?: Blueprint["engine"];
};

const MAX_OPPORTUNITIES = 8;
const MIN_OPPORTUNITIES = 4;
/** Months for an automation to pay back in the typical case before we suggest it. */
const TYPICAL_PAYBACK_LIMIT = 12;
const IMPACT_WEIGHT = { high: 1.5, medium: 1, low: 0.7 } as const;

export function buildRulesBlueprint(input: BlueprintInput): Blueprint {
  return assembleBlueprint(input, {});
}

export function assembleBlueprint(input: BlueprintInput, overrides: BlueprintOverrides): Blueprint {
  const company = input.company ?? undefined;
  const audit = input.audit ?? undefined;
  const presence = input.presence ?? undefined;
  const competitors = input.competitors;
  const target = { ...input.target };

  /* who they are */
  const businessType = classify(input, company, audit, overrides);
  const type = getBusinessType(businessType.id);
  const playbook = getPlaybook(type.id);
  const hasWebsite = hasWebsiteFor({ audit, company, target });
  const ctx = signalContext({ type, audit, presence, hasWebsite });

  /* assumptions */
  const team = estimateTeamSize(type, ctx);
  const hourly = hourlyCostFor(company?.caen, type);
  const simulation: SimulationInputs = {
    teamSize: team.typical,
    hourlyCostRon: hourly.hourlyCostRon,
    volumeFactor: 1,
  };

  /* what to automate */
  const ids = selectOpportunities(type, ctx, simulation, overrides);
  const { opportunities, totals, cappedBy } = computeMoney({
    type,
    ids,
    inputs: simulation,
    hourlyIsIns: true,
    adjustments: overrides.adjustments,
  });

  /* plan */
  const websiteActions = pickWebsiteActions(audit);
  const websiteHealth = websiteHealthOf(audit);
  const roadmap = buildRoadmap({
    type,
    opportunities,
    websiteActions,
    audit,
    presence,
    hasWebsite,
  });
  const strategies = buildStrategies({
    type,
    playbook,
    opportunities,
    websiteActions,
    audit,
    presence,
    hasWebsite,
    websiteHealth,
  });
  const name = businessName({ company, audit, target });

  const notes = [...team.notes, ...baseNotes(type)];
  if (cappedBy < 1) {
    notes.push(
      bi(
        "Estimates were scaled down so automation never claims more than 20% of the team's working time.",
        "Estimările au fost reduse astfel încât automatizarea să nu depășească 20% din timpul de lucru al echipei.",
      ),
    );
  }
  if (overrides.engine === "ai") {
    notes.push(
      bi(
        "Wording and volumes were reviewed by AI against your public data; every amount is still calculated by the same formulas.",
        "Textele și volumele au fost revizuite cu AI pe baza datelor publice despre afacerea ta; toate sumele sunt calculate în continuare cu aceleași formule.",
      ),
    );
  }

  const generatedAt = toIso(input.now) ?? audit?.fetchedAt ?? new Date().toISOString();

  return {
    id: blueprintId(target, generatedAt),
    generatedAt,
    engine: overrides.engine ?? "rules",
    target,
    company,
    audit,
    businessType,
    presence,
    competitors,
    scores: {
      digitalMaturity: digitalMaturityOf(audit, presence),
      websiteHealth,
      automationPotential: automationPotentialOf(totals, simulation.teamSize),
    },
    headline: buildHeadline({ name, type, totals, stepCount: roadmapSteps(roadmap) }),
    summary: buildSummary({
      type,
      opportunities,
      totals,
      hourlyCostRon: simulation.hourlyCostRon,
      websiteActions,
      audit,
      hasWebsite,
    }),
    opportunities,
    websiteActions,
    totals,
    strategies,
    roadmap,
    projection: computeProjection(opportunities, roadmap),
    offer: buildOffer({ opportunities, strategies, totals }),
    assumptions: {
      hourlyCostRon: hourly.hourlyCostRon,
      hourlyCostBasis: hourly.basis,
      teamSize: team.range,
      simulation,
      notes,
    },
    disclaimer: { ...DISCLAIMER },
  };
}

function classify(
  input: BlueprintInput,
  company: CompanyProfile | undefined,
  audit: WebsiteAudit | undefined,
  overrides: BlueprintOverrides,
): BusinessType {
  let result: BusinessType;
  const chosen = input.businessTypeId ? getBusinessType(input.businessTypeId) : null;
  if (overrides.fixedType) {
    result = { ...overrides.fixedType, basis: [...overrides.fixedType.basis] };
  } else if (chosen && chosen.id === input.businessTypeId) {
    result = {
      id: chosen.id,
      label: chosen.label,
      sector: chosen.sector,
      confidence: 1,
      basis: ["Chosen by the visitor"],
    };
  } else {
    const readable = audit?.reachable ? audit : undefined;
    result = classifyBusiness({
      caen: company?.caen,
      caenLabel: company?.caenLabel?.en ?? company?.caenLabel?.ro,
      siteText: [
        readable?.meta.description,
        ...(readable?.pages.map((page) => page.title) ?? []),
        input.target.query,
      ]
        .filter(Boolean)
        .join(" · "),
      title: readable?.meta.title,
      name: company?.name ?? company?.displayName ?? input.target.query,
      hints: { hasEcommerce: readable?.signals.hasEcommerce },
    });
  }
  const o = overrides.businessType;
  if (!o) return result;
  return {
    ...result,
    label: o.label ?? result.label,
    confidence: o.confidence ?? result.confidence,
    basis: [...result.basis, ...(o.basis ?? [])],
  };
}

/**
 * Ranks every applicable opportunity by monthly return on its setup cost
 * (weighted by impact) and keeps the best, always including the AI assistant
 * and one way to win customers.
 */
function selectOpportunities(
  type: BusinessTypeDef,
  ctx: ReturnType<typeof signalContext>,
  inputs: SimulationInputs,
  overrides: BlueprintOverrides,
): string[] {
  const playbook = getPlaybook(type.id);
  const typical = typicalTeam(type);
  const applicable = candidateIds(type.id)
    .map((id) => resolveOpportunity(type.id, id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .filter((r) => r.template.applies?.(ctx, playbook.params) ?? true);

  const ranked = applicable
    .map((resolved) => {
      const adjust = overrides.adjustments?.get(resolved.template.id);
      const [o] = computeOpportunities([{ resolved, adjust: adjust?.factor ?? 1 }], {
        inputs,
        typical,
        hourlyIsIns: true,
      }).opportunities;
      const net = midpoint(o.monthlySavingsRon) - midpoint(o.monthlyToolCostRon);
      const payback = net > 0 ? midpoint(o.setupCostRon) / net : Infinity;
      // In the cautious case the time saved still covers the tools.
      const coversTools = o.monthlySavingsRon.low >= o.monthlyToolCostRon.high;
      const score =
        (net / Math.max(1, midpoint(o.setupCostRon))) * IMPACT_WEIGHT[o.impact] +
        (resolved.fromPlaybook ? 0.15 : 0);
      return {
        id: resolved.template.id,
        strategy: resolved.template.strategy,
        customerFacing: Boolean(resolved.template.customerFacing),
        score,
        payback,
        net,
        coversTools,
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  // Back-office automations must pay back on staff time alone in the typical case;
  // customer-facing ones (bookings, reminders, reviews…) also earn revenue we don't
  // count, so covering their tools is enough. A looser pass avoids an empty plan.
  type Ranked = (typeof ranked)[number];
  const strict = (item: Ranked) =>
    item.customerFacing ? item.net > 0 : item.coversTools && item.payback <= TYPICAL_PAYBACK_LIMIT;
  const loose = (item: Ranked) =>
    item.net > 0 && (item.customerFacing || item.payback <= TYPICAL_PAYBACK_LIMIT * 2);
  let eligible = ranked.filter(strict);
  if (eligible.length < MIN_OPPORTUNITIES) eligible = ranked.filter(loose);

  const picked: string[] = [];
  const add = (id: string | undefined) => {
    if (id && !picked.includes(id)) picked.push(id);
  };
  // The assistant anchors the third strategy: always for consumer businesses, which
  // get questions around the clock; for B2B only when it pays for itself.
  const assistant = ranked.find((item) => item.strategy === "assist");
  if (assistant && (type.consumer || assistant.net > 0)) add(assistant.id);
  add(ranked.find((item) => item.strategy === "acquire" && item.net > 0)?.id);
  for (const item of eligible) {
    if (picked.length >= MAX_OPPORTUNITIES) break;
    add(item.id);
  }
  for (const id of (overrides.extraOpportunityIds ?? []).slice(0, 2)) {
    if (applicable.some((r) => r.template.id === id)) add(id);
  }

  // Present them best first.
  const order = new Map(ranked.map((item, i) => [item.id, i]));
  return picked.sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
}

function roadmapSteps(roadmap: Blueprint["roadmap"]) {
  return roadmap.reduce((sum, phase) => sum + phase.items.length, 0);
}

function toIso(value: string | Date | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** FNV-1a, base 36: short, stable, no crypto needed. */
function shortHash(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

/** Short hash of the target and the date: same business, same day → same id. */
function blueprintId(target: ScanTarget, generatedAt: string) {
  const date = generatedAt.slice(0, 10);
  const key = [
    target.cui?.trim() ?? "",
    target.url?.trim().toLowerCase().replace(/\/+$/, "") ?? "",
    target.query?.trim().toLowerCase() ?? "",
    date,
  ].join("|");
  return `vs-${date.replace(/-/g, "")}-${shortHash(key)}`;
}

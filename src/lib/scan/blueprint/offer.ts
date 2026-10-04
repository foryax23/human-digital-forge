import type { PlanId } from "@/lib/plans";
import {
  CONSULTANCY_HOUR_LEI,
  EXTRA_HOUR_LEI,
  fixedProject,
  hoursText,
  includedHoursText,
  PLAN_CATALOG,
  PLAN_ORDER,
  type FixedProject,
} from "@/lib/pricing";
import type {
  AutomationOpportunity,
  Bilingual,
  PhaseKey,
  ProjectionPoint,
  RoadmapPhase,
  VortexOffer,
} from "@/lib/scan/types";

import { breakEvenMonth, PROJECTION_MONTHS } from "./economics";
import { approxLei, lei, leiPerMonth, midOf, monthLabel } from "./format";
import { bi } from "./model";
import { strategyOf } from "./strategies";

/*
 * The scan's offer (analysis §4.4, owner decision 2026-10-04): a first project at a fixed
 * price, then a plan for after launch on its own line (src/lib/pricing.ts: Starter 290,
 * Growth 790, Pro 1.990 lei a month, sold by contract).
 *
 * - The plan the scope calls for: a new site or fixes and at most 1 automation → Starter;
 *   2–3 automations or online booking → Growth; 4+ automations or an AI assistant → Pro.
 * - The fee starts after the plan's first stage and is added to the chart's cost. If the
 *   automations no longer pay back within 24 months, a smaller plan is offered and the
 *   offer says why; if even Starter would not pay back, the project alone is offered.
 *   The fee never turns the payback into "doesn't pay back" without a word.
 * - The build is always a separate fixed-price project, never "inside the plan".
 *
 * `decideOffer` is the one decision: `buildOffer` stores it on the blueprint (planId feeds
 * the lead record) and display.ts re-derives it with today's prices, so stored blueprints
 * never show an old fee.
 */

export type OfferReason =
  /** The scope's plan pays back with its fee. */
  | "fits"
  /** A smaller plan than the scope's, because the bigger fee would not pay back. */
  | "stepped-down"
  /** A new website and no automations: Starter looks after it; no payback month. */
  | "site-only"
  /** The automations pay back, but not with even Starter's fee: the project alone. */
  | "no-payback"
  /** The automations do not pay back within 24 months even without a plan. */
  | "no-payback-base"
  /** Only website fixes: one-off work, no plan needed. */
  | "fixes-only"
  /** Nothing to build yet: a free call, then consultancy by the hour. */
  | "nothing-to-build";

export type OfferDecision = {
  /** The plan after launch; null = the project alone. */
  plan: PlanId | null;
  /** The plan the scope calls for (null when nothing needs looking after). */
  wanted: PlanId | null;
  reason: OfferReason;
  /** The plan month the fee starts: the month after the first stage. */
  feeFrom: number;
  /** The chart's payback month, without a plan. */
  baseBreakEven: number | null;
  /** The payback month with the plan's fee added from `feeFrom` (null without a plan). */
  feeBreakEven: number | null;
  /** The plan has website work: the project alone still mentions Starter for the site. */
  siteWork: boolean;
};

/** Monthly plan fee in lei. */
export function planFeeRon(plan: PlanId): number {
  return PLAN_CATALOG[plan].priceLei;
}

/** The tier the scope calls for: the automations, the assistant and online booking. */
export function scopeTier(opportunities: Pick<AutomationOpportunity, "id">[]): PlanId {
  const count = opportunities.length;
  const assistant = opportunities.some((o) => strategyOf(o.id) === "assist");
  const booking = opportunities.some((o) => o.id === "online-booking");
  if (assistant || count >= 4) return "pro";
  if (booking || count >= 2) return "growth";
  return "starter";
}

/** The payback month with a monthly fee added to the cost from `from` (null after 24). */
export function feeBreakEven(
  projection: ProjectionPoint[],
  fee: number,
  from: number,
): number | null {
  const points = projection
    .filter((p) => p.month >= 1 && p.month <= PROJECTION_MONTHS)
    .sort((a, b) => a.month - b.month)
    .map((p) => {
      const extra = fee * Math.max(0, p.month - from + 1);
      const cost = p.cumulativeCostRon;
      return {
        ...p,
        cumulativeCostRon: {
          low: cost.low + extra,
          high: cost.high + extra,
          mid: midOf(cost) + extra,
        },
      };
    });
  return breakEvenMonth(points);
}

export function decideOffer(args: {
  opportunities: AutomationOpportunity[];
  projection: ProjectionPoint[];
  roadmap: Pick<RoadmapPhase, "startMonth" | "endMonth">[];
  /** No working website today: the plan builds one. */
  newSite: boolean;
  /** The plan has website work (fixes, Google profile, measurement or a new site). */
  siteWork: boolean;
}): OfferDecision {
  const feeFrom = (args.roadmap[0]?.endMonth ?? 0) + 1;
  const baseBreakEven = args.opportunities.length ? breakEvenMonth(args.projection) : null;
  const decision = (
    plan: PlanId | null,
    wanted: PlanId | null,
    reason: OfferReason,
    withFee: number | null = null,
  ): OfferDecision => ({
    plan,
    wanted,
    reason,
    feeFrom,
    baseBreakEven,
    feeBreakEven: withFee,
    siteWork: args.siteWork,
  });

  if (!args.opportunities.length) {
    if (args.newSite) return decision("starter", "starter", "site-only");
    return decision(null, null, args.siteWork ? "fixes-only" : "nothing-to-build");
  }
  const wanted = scopeTier(args.opportunities);
  if (baseBreakEven === null) return decision(null, wanted, "no-payback-base");
  for (let tier = PLAN_ORDER.indexOf(wanted); tier >= 0; tier--) {
    const plan = PLAN_ORDER[tier];
    const month = feeBreakEven(args.projection, planFeeRon(plan), feeFrom);
    if (month !== null) {
      return decision(plan, wanted, plan === wanted ? "fits" : "stepped-down", month);
    }
  }
  return decision(null, wanted, "no-payback");
}

/** True when a roadmap carries website work (phases stored before `websiteCostRon` don't). */
function roadmapSiteWork(roadmap: Pick<RoadmapPhase, "websiteCostRon">[]): boolean {
  return roadmap.some((p) => (p.websiteCostRon ? midOf(p.websiteCostRon) > 0 : false));
}

/** The offer stored on the blueprint: the decision in plain words (display.ts shows more). */
export function buildOffer(args: {
  opportunities: AutomationOpportunity[];
  projection: ProjectionPoint[];
  roadmap: RoadmapPhase[];
  newSite?: boolean;
}): VortexOffer {
  const decision = decideOffer({
    opportunities: args.opportunities,
    projection: args.projection,
    roadmap: args.roadmap,
    newSite: Boolean(args.newSite),
    siteWork: Boolean(args.newSite) || roadmapSiteWork(args.roadmap),
  });
  const words = offerWords(decision);
  if (!decision.plan) {
    const rate = lei(CONSULTANCY_HOUR_LEI);
    return {
      planId: "project",
      title: words.title,
      why: words.noPlan ?? words.why,
      includes: [],
      priceNote:
        decision.reason === "nothing-to-build"
          ? bi(
              `The first call is free; consultancy is ${rate.en} an hour`,
              `Prima discuție e gratuită; consultanța costă ${rate.ro} pe oră`,
            )
          : bi(
              "A fixed price for the project, agreed before we start",
              "Preț fix pentru proiect, stabilit înainte să începem",
            ),
    };
  }
  const entry = PLAN_CATALOG[decision.plan];
  const fee = leiPerMonth(entry.priceLei, false);
  return {
    planId: decision.plan,
    title: bi(entry.name, entry.name),
    why: words.planNote ?? words.why,
    includes: entry.offerIncludes.map((line) => ({ ...line })),
    priceNote: bi(`${fee.en}, separate from the project`, `${fee.ro}, separat de proiect`),
  };
}

/* ------------------------------------------------------------------ display */

/** The first stage of the plan, as the Gantt shows it. */
export type OfferStage = {
  key: PhaseKey;
  title: Bilingual;
  setupLei: number;
  /** The stage builds a new website. */
  newSite: boolean;
  /** The stage builds automations (false for website work alone). */
  automations: boolean;
};

export type DisplayOffer = {
  /** The plan after launch, or "project" for the project alone. */
  planId: PlanId | "project";
  reason: OfferReason;
  /** "Primul proiect, apoi Starter" / "Doar proiectul, fără abonament". */
  title: Bilingual;
  why: Bilingual;
  /** 1 · the first project, at a fixed price. */
  project: {
    title: Bilingual;
    /** "≈ 11.500 lei" (the stage's estimate in the plan) or "300 lei pe oră". */
    price: Bilingual;
    /** How the price is fixed, plus the public "de la" price where one applies. */
    note: Bilingual;
    /**
     * The chart's payback, without a plan: only when the first project builds automations
     * (null otherwise; see `laterPayback`).
     */
    payback: Bilingual | null;
  };
  /**
   * The chart's payback when the automations come in the later stages, with their cost
   * ("Automatizările din etapele următoare (≈ 14.500 lei) se recuperează în luna 22, …"),
   * shown under the why-line so it is not read as the first project's payback.
   */
  laterPayback: Bilingual | null;
  /** 2 · the plan after launch, on its own line; null for the project alone. */
  plan: {
    id: PlanId;
    name: string;
    role: Bilingual;
    /** "290 lei pe lună". */
    price: Bilingual;
    /** "1 oră de lucru pe lună inclusă". */
    hours: Bilingual;
    includes: Bilingual[];
    /** "Se plătește separat de proiect, din luna 2. …" */
    fee: Bilingual;
    /** The payback with the fee included (null when there are no automations). */
    payback: Bilingual | null;
    /** Why this plan and not the scope's, or why there is no payback month. */
    note: Bilingual | null;
  } | null;
  /** Why no plan is offered (the project alone). */
  noPlan: Bilingual | null;
};

const CATALOG_PROJECT: Partial<Record<PhaseKey, FixedProject["id"]>> = {
  automation: "automation",
  growth: "automation",
  assistant: "assistant",
};

/** "Un site de prezentare pornește de la 4.500 lei." when the stage matches a fixed price. */
function anchorText(stage: OfferStage): Bilingual | null {
  const id =
    stage.key === "foundation" ? (stage.newSite ? "site" : null) : CATALOG_PROJECT[stage.key];
  if (!id) return null;
  const project = fixedProject(id);
  if (stage.setupLei < project.priceLei.low) return null;
  const from = lei(project.priceLei.low);
  switch (id) {
    case "site":
      return bi(
        `A presentation website starts from ${from.en}.`,
        `Un site de prezentare pornește de la ${from.ro}.`,
      );
    case "automation":
      return bi(
        `One automation starts from ${from.en}.`,
        `O automatizare pornește de la ${from.ro}.`,
      );
    default:
      return bi(
        `An AI assistant starts from ${from.en}.`,
        `Un asistent AI pornește de la ${from.ro}.`,
      );
  }
}

/** What each plan looks after, as the pricing section lists it ("Starter ține site-ul în formă"). */
const CARE: Record<PlanId, Bilingual> = {
  starter: bi("keeps the website healthy", "ține site-ul în formă"),
  growth: bi(
    "looks after the website and up to 3 automations",
    "îngrijește site-ul și până la 3 automatizări",
  ),
  pro: bi(
    "looks after the website, the automations and the AI assistant",
    "îngrijește site-ul, automatizările și asistentul AI",
  ),
};

/** The decision's sentences that do not depend on the stage (shared with `buildOffer`). */
function offerWords(decision: OfferDecision): {
  title: Bilingual;
  why: Bilingual;
  planNote: Bilingual | null;
  noPlan: Bilingual | null;
} {
  const starter = PLAN_CATALOG.starter;
  const starterFee = leiPerMonth(starter.priceLei, false);
  // A website still needs looking after when the automations cannot carry a plan.
  const siteCare = decision.siteWork
    ? bi(
        ` If you'd like us to keep the website healthy, Starter is ${starterFee.en}.`,
        ` Dacă vrei să ținem site-ul în formă, Starter costă ${starterFee.ro}.`,
      )
    : bi("", "");
  const later = decision.siteWork
    ? bi(
        "If you still want us to keep the website healthy, you can take it for the site alone; otherwise add it after launch, once we see the real numbers.",
        "Dacă vrei totuși să ținem site-ul în formă, îl poți alege doar pentru site; altfel îl adaugi după lansare, când vedem cifrele reale.",
      )
    : bi(
        "You can add one after launch, once we see the real numbers.",
        "Îl poți adăuga după lansare, când vedem cifrele reale.",
      );
  if (decision.plan) {
    const entry = PLAN_CATALOG[decision.plan];
    const hours = hoursText(entry.hoursPerMonth);
    let planNote: Bilingual | null = null;
    if (decision.reason === "stepped-down" && decision.wanted) {
      const wanted = PLAN_CATALOG[decision.wanted];
      const fee = leiPerMonth(wanted.priceLei, false);
      planNote = bi(
        `${wanted.name} would suit everything we build, but at ${fee.en} the automations would not pay back within the first 24 months. You can move up once the numbers allow it.`,
        `Pentru tot ce construim s-ar potrivi ${wanted.name}, dar cu ${fee.ro} automatizările nu s-ar recupera în primele 24 de luni. Treci la un abonament mai mare când cifrele o permit.`,
      );
    } else if (decision.reason === "site-only") {
      planNote = bi(
        "The website brings new customers, not hours, so the plan has no payback month.",
        "Site-ul aduce clienți noi, nu ore, așa că abonamentul nu are o lună de recuperare.",
      );
    }
    // Starter's card lists no care for automations (src/lib/pricing.ts): say so when the
    // offer pairs it with automations, so the fee charged against them is not a surprise.
    if (decision.plan === "starter" && decision.baseBreakEven !== null) {
      const rate = lei(EXTRA_HOUR_LEI);
      const care = bi(
        `Starter does not include looking after the automations: fixes use the included hour, then ${rate.en} an hour.`,
        `Starter nu include îngrijirea automatizărilor: remedierile intră în ora inclusă, apoi ${rate.ro} pe oră.`,
      );
      planNote = planNote ? bi(`${planNote.en} ${care.en}`, `${planNote.ro} ${care.ro}`) : care;
    }
    return {
      title: bi(`A first project, then ${entry.name}`, `Primul proiect, apoi ${entry.name}`),
      why: bi(
        `After launch, ${entry.name} ${CARE[decision.plan].en}, with ${hours.en} of work a month.`,
        `După lansare, ${entry.name} ${CARE[decision.plan].ro}, cu ${hours.ro} de lucru pe lună.`,
      ),
      planNote,
      noPlan: null,
    };
  }

  const alone = {
    title: bi("The project alone, no plan", "Doar proiectul, fără abonament"),
    why: bi("At a fixed price, with no monthly cost.", "La preț fix, fără un cost lunar."),
  };
  switch (decision.reason) {
    case "no-payback":
      return {
        title: alone.title,
        why: alone.why,
        planNote: null,
        noPlan: bi(
          `We don't suggest a plan yet: with Starter (${starterFee.en}) the automations would no longer pay back within the first 24 months. ${later.en}`,
          `Nu propunem încă un abonament: cu Starter (${starterFee.ro}) automatizările nu s-ar mai recupera în primele 24 de luni. ${later.ro}`,
        ),
      };
    case "no-payback-base":
      return {
        title: alone.title,
        why: alone.why,
        planNote: null,
        noPlan: bi(
          `We don't suggest a plan: on the base estimate the automations don't pay back within 24 months even without one, so we add no monthly cost. We confirm the volumes on the call.${siteCare.en}`,
          `Nu propunem un abonament: cu estimarea de bază, automatizările nu se recuperează în 24 de luni nici fără el, deci nu adăugăm un cost lunar. Confirmăm volumele la discuție.${siteCare.ro}`,
        ),
      };
    case "fixes-only":
      return {
        title: alone.title,
        why: alone.why,
        planNote: null,
        noPlan: bi(
          `The fixes are one-off work, so they need no plan. If you'd like us to keep the website healthy afterwards, Starter is ${starterFee.en}.`,
          `Remedierile se fac o singură dată, deci nu au nevoie de abonament. Dacă vrei să ținem site-ul în formă după aceea, Starter costă ${starterFee.ro}.`,
        ),
      };
    default:
      return {
        title: bi("We start with a call", "Începem cu o discuție"),
        why: bi(
          "In the free call we work out what is worth doing first.",
          "În discuția gratuită vedem ce merită făcut întâi.",
        ),
        planNote: null,
        noPlan: bi(
          "The plan has nothing to build yet, so a monthly plan makes no sense.",
          "Planul nu are încă nimic de construit, deci un abonament nu are rost.",
        ),
      };
  }
}

/**
 * The offer as the web and the PDF show it: the first project with the stage's estimate,
 * then the plan with its fee, hours and payback on separate lines.
 */
export function displayOffer(args: {
  decision: OfferDecision;
  /** The starting stage (Începem aici), or the first stage with a cost; null = none. */
  stage: OfferStage | null;
  hasAutomations: boolean;
  /** The automations' one-off cost, all stages (the plan's totals). */
  automationsSetupLei: number;
}): DisplayOffer {
  const { decision, stage, hasAutomations } = args;
  const words = offerWords(decision);

  const build = stage && stage.setupLei > 0 ? stage : null;
  const fixed = bi(
    "Fixed price, agreed together before we start.",
    "Preț fix, stabilit împreună înainte să începem.",
  );
  const anchor = build ? anchorText(build) : null;
  const rate = lei(CONSULTANCY_HOUR_LEI);
  const project: DisplayOffer["project"] = build
    ? {
        title: { ...build.title },
        price: approxLei(build.setupLei),
        note: anchor
          ? bi(
              `The plan's estimate. ${fixed.en} ${anchor.en}`,
              `Estimarea din plan. ${fixed.ro} ${anchor.ro}`,
            )
          : bi(`The plan's estimate. ${fixed.en}`, `Estimarea din plan. ${fixed.ro}`),
        payback: null,
      }
    : {
        title: bi("Consultancy", "Consultanță"),
        price: bi(`${rate.en} an hour`, `${rate.ro} pe oră`),
        note: bi(
          "The first call is free; after it you pay only for the hours you need.",
          "Prima discuție e gratuită; după ea plătești doar orele de care ai nevoie.",
        ),
        payback: null,
      };
  let laterPayback: Bilingual | null = null;
  if (hasAutomations) {
    const n = decision.baseBreakEven;
    if (build?.automations) {
      project.payback =
        n === null
          ? bi(
              "Without a plan, the automations don't pay back within the first 24 months.",
              "Fără abonament, automatizările nu se recuperează în primele 24 de luni.",
            )
          : bi(
              `Without a plan, the automations pay back in ${monthLabel(n).en}.`,
              `Fără abonament, automatizările se recuperează în ${monthLabel(n).ro}.`,
            );
    } else {
      const cost = approxLei(args.automationsSetupLei);
      laterPayback =
        n === null
          ? bi(
              `The automations in the later stages (${cost.en}) don't pay back within the first 24 months, even without a plan.`,
              `Automatizările din etapele următoare (${cost.ro}) nu se recuperează în primele 24 de luni, nici fără abonament.`,
            )
          : bi(
              `The automations in the later stages (${cost.en}) pay back in ${monthLabel(n).en}, without a plan.`,
              `Automatizările din etapele următoare (${cost.ro}) se recuperează în ${monthLabel(n).ro}, fără abonament.`,
            );
    }
  }

  const stageTitle = build ? build.title : null;
  const why = stageTitle
    ? bi(
        `We start with “${stageTitle.en}”, at a fixed price. ${words.why.en}`,
        `Începem cu „${stageTitle.ro}”, la preț fix. ${words.why.ro}`,
      )
    : words.why;

  if (!decision.plan) {
    return {
      planId: "project",
      reason: decision.reason,
      title: words.title,
      why: stageTitle
        ? bi(
            `We start with “${stageTitle.en}”, at a fixed price, with no monthly cost.`,
            `Începem cu „${stageTitle.ro}”, la preț fix, fără un cost lunar.`,
          )
        : words.why,
      project,
      laterPayback,
      plan: null,
      noPlan: words.noPlan,
    };
  }

  const entry = PLAN_CATALOG[decision.plan];
  const from = monthLabel(decision.feeFrom);
  const extra = lei(EXTRA_HOUR_LEI);
  const m = decision.feeBreakEven;
  return {
    planId: decision.plan,
    reason: decision.reason,
    title: words.title,
    why,
    project,
    laterPayback,
    plan: {
      id: decision.plan,
      name: entry.name,
      role: { ...entry.role },
      price: leiPerMonth(entry.priceLei, false),
      hours: includedHoursText(entry.hoursPerMonth),
      includes: entry.offerIncludes.map((line) => ({ ...line })),
      fee: bi(
        `Billed separately from the project, from ${from.en}. Extra hours: ${extra.en} each.`,
        `Se plătește separat de proiect, din ${from.ro}. Orele în plus: ${extra.ro} pe oră.`,
      ),
      payback:
        hasAutomations && m !== null
          ? bi(
              `With the plan included, the automations pay back in ${monthLabel(m).en}.`,
              `Cu abonamentul inclus, automatizările se recuperează în ${monthLabel(m).ro}.`,
            )
          : null,
      note: words.planNote,
    },
    noPlan: null,
  };
}

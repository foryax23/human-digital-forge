import { PLAN_PRICING, type PlanId } from "@/lib/plans";
import type {
  AutomationOpportunity,
  Bilingual,
  Blueprint,
  StrategyOption,
  VortexOffer,
} from "@/lib/scan/types";

import { addEstimates, formatNumber, lcFirst, midOf } from "./format";
import { bi } from "./model";

/*
 * Maps the blueprint to a Vortex plan (src/lib/plans.ts, PricingSection):
 * Starter 100 lei, Growth 250 lei, Pro 1.000 lei a month, or a fixed-price
 * project when the build is large. The tier follows the scope (how many
 * automations, whether a new website is built), never the one-off cost, and
 * steps down while the fee would eat the plan's central monthly gain.
 */

/**
 * What the plan gives for this report's plan, three lines on the web and in the PDF.
 * Each line is a pricing-section feature (PricingSection.tsx) said about this plan's
 * stages, so nothing is promised that the plan does not include.
 */
function planIncludes(plan: PlanId, stages: Bilingual): Bilingual[] {
  switch (plan) {
    case "starter":
      return [
        bi(
          "30 minutes of live consultation on Zoom each month",
          "30 de minute de consultanță live pe Zoom în fiecare lună",
        ),
        bi(`Recommendations for ${stages.en}`, `Recomandări pentru ${stages.ro}`),
        bi("Email support during your subscription", "Suport pe e-mail pe durata abonamentului"),
      ];
    case "growth":
      return [
        bi("2 hours of live consultation on Zoom", "2 ore de consultanță live pe Zoom"),
        bi(`Guided setup of ${stages.en}`, `Configurare ghidată pentru ${stages.ro}`),
        bi("Priority scheduling and email support", "Programări cu prioritate și suport pe e-mail"),
      ];
    case "pro":
      return [
        bi(`Hands-on help building ${stages.en}`, `Ajutor practic la construirea ${stages.ro}`),
        bi(
          "Unlimited live support from our team while they run",
          "Suport live nelimitat din partea echipei noastre, cât timp rulează",
        ),
        bi("A direct priority line to us", "Legătură directă, cu prioritate, cu echipa noastră"),
      ];
  }
}

/** "the 4 stages of this plan" / "celor 4 etape din plan" (genitive after "construirea"). */
function stagesPhrase(plan: PlanId, count: number): Bilingual {
  const n = Math.max(1, count);
  if (n === 1) {
    return plan === "pro"
      ? bi("the plan's one stage", "etapei din plan")
      : plan === "growth"
        ? bi("the plan's one stage", "etapa din plan")
        : bi("the plan's stage", "etapa din plan");
  }
  if (plan === "pro") return bi(`the ${n} stages of the plan`, `celor ${n} etape din plan`);
  if (plan === "growth") return bi(`the ${n} stages of the plan`, `cele ${n} etape din plan`);
  return bi(`the ${n} stages of the plan`, `cele ${n} etape din plan`);
}

const PLAN_NAMES: Record<PlanId, string> = { starter: "Starter", growth: "Growth", pro: "Pro" };
const TIERS: PlanId[] = ["starter", "growth", "pro"];

/** Above this central setup (or with 2+ high-complexity builds) it's a project. */
const PROJECT_FROM_RON = 50000;
/** Scope thresholds: automations in the plan for Growth and Pro (one less with a new website). */
const GROWTH_FROM_AUTOMATIONS = 3;
const PRO_FROM_AUTOMATIONS = 6;

/** Monthly plan fee in lei. */
export function planFeeRon(plan: PlanId): number {
  return PLAN_PRICING[plan].ron / 100;
}

/**
 * The monthly fee the offer quotes, in lei; null for a project or a fee agreed on the
 * call (the only offers whose title is not a plan name).
 */
export function offerFeeRon(offer: VortexOffer): number | null {
  if (offer.planId === "project") return null;
  return offer.title.en === PLAN_NAMES[offer.planId] ? planFeeRon(offer.planId) : null;
}

/** The fee exactly as the pricing section shows it ("1.000 lei pe lună"), never "de la". */
function priceNote(plan: PlanId, withSetup: boolean): Bilingual {
  const fee = {
    en: formatNumber(planFeeRon(plan), "en"),
    ro: formatNumber(planFeeRon(plan), "ro"),
  };
  return withSetup
    ? bi(
        `${fee.en} RON a month, plus the setup (fixed price after a call)`,
        `${fee.ro} lei pe lună, plus implementarea (preț fix după discuție)`,
      )
    : bi(`${fee.en} RON a month`, `${fee.ro} lei pe lună`);
}

/** The tier the scope calls for: automations in the plan and whether a website is built. */
export function scopeTier(automations: number, highComplexity: number, newSite: boolean): PlanId {
  const extra = newSite ? 1 : 0;
  if (highComplexity >= 1 || automations + extra >= PRO_FROM_AUTOMATIONS) return "pro";
  if (automations + extra >= GROWTH_FROM_AUTOMATIONS) return "growth";
  return "starter";
}

export function buildOffer(args: {
  opportunities: AutomationOpportunity[];
  strategies: StrategyOption[];
  totals: Blueprint["totals"];
  /** No working website today: the plan builds one. */
  newSite?: boolean;
  /** Stages in the plan (its roadmap phases), which the offer's lines refer to. */
  stages?: number;
}): VortexOffer {
  const highComplexity = args.opportunities.filter((o) => o.complexity === "high");
  const count = args.opportunities.length;
  const newSite = Boolean(args.newSite);
  const stages = args.stages ?? 0;

  if (midOf(args.totals.setupCostRon) >= PROJECT_FROM_RON || highComplexity.length >= 2) {
    const example = highComplexity[0] ?? args.opportunities[0];
    return {
      planId: "project",
      title: bi("A Vortex project, scoped together", "Un proiect Vortex, definit împreună"),
      why: example
        ? bi(
            `The plan includes larger integrations, such as ${lcFirst(example.title.en)}, that are best delivered as one fixed-price project.`,
            `Planul include integrări mai mari, precum ${lcFirst(example.title.ro)}, care se livrează cel mai bine ca un proiect la preț fix.`,
          )
        : bi(
            "The plan is best delivered as one fixed-price project.",
            "Planul se livrează cel mai bine ca un proiect la preț fix.",
          ),
      includes: [
        bi(
          "A free discovery call to confirm volumes and priorities",
          "O discuție gratuită pentru confirmarea volumelor și priorităților",
        ),
        bi(
          "A fixed-price proposal, phased like this roadmap",
          "O ofertă la preț fix, împărțită pe etape ca acest plan",
        ),
        bi("Build, integration and team training", "Implementare, integrare și instruirea echipei"),
        bi("Ongoing support on a monthly plan", "Suport continuu prin abonament lunar"),
      ],
      priceNote: bi(
        "Fixed price after a free discovery call",
        "Preț fix după o discuție gratuită de evaluare",
      ),
    };
  }

  // The fee must not cancel the plan's central monthly gain (value of the hours minus tools).
  const monthlyGain =
    midOf(args.totals.monthlySavingsRon) -
    addEstimates(args.opportunities.map((o) => o.monthlyToolCostRon)).mid;
  const wanted = scopeTier(count, highComplexity.length, newSite);
  let tier = TIERS.indexOf(wanted);
  while (tier >= 0 && monthlyGain - planFeeRon(TIERS[tier]) <= 0) tier--;
  const withSetup = count > 0 || newSite;

  if (tier < 0) {
    return {
      planId: "starter",
      title: bi("Plan agreed on the call", "Abonament stabilit la discuție"),
      why: bi(
        "The estimated monthly gain is small, so we agree the plan fee on the call, once the volumes are confirmed.",
        "Câștigul lunar estimat e mic, așa că abonamentul îl stabilim la discuție, după ce confirmăm volumele.",
      ),
      includes: planIncludes("starter", stagesPhrase("starter", stages)),
      priceNote: withSetup
        ? bi(
            "Plan fee agreed on the call, plus the setup (fixed price)",
            "Abonamentul se stabilește la discuție, plus implementarea (preț fix)",
          )
        : bi("Plan fee agreed on the call", "Abonamentul se stabilește la discuție"),
    };
  }

  const plan = TIERS[tier];
  // The stages the visitor sees above (the Gantt rows), never a count of things not listed.
  const scope =
    stages > 1
      ? bi(`The plan has ${stages} stages`, `Planul are ${stages} etape`)
      : bi("The plan has one stage", "Planul are o etapă");
  const why: Record<PlanId, Bilingual> = {
    starter: bi(
      "Your first steps are small; Starter gives you monthly guidance while you take them.",
      "Primii pași sunt mici; cu Starter primești îndrumare lunară cât timp îi faci.",
    ),
    growth: bi(
      `${scope.en}; Growth covers the guided setup and ongoing support.`,
      `${scope.ro}; Growth acoperă implementarea ghidată și suportul continuu.`,
    ),
    pro:
      stages > 1
        ? bi(
            `${scope.en}; with Pro we build them with you and keep them running.`,
            `${scope.ro}; cu Pro le construim împreună și le ținem în funcțiune.`,
          )
        : bi(
            `${scope.en}; with Pro we build it with you and keep it running.`,
            `${scope.ro}; cu Pro o construim împreună și o ținem în funcțiune.`,
          ),
  };
  const steppedDown = plan !== wanted;
  return {
    planId: plan,
    title: bi(PLAN_NAMES[plan], PLAN_NAMES[plan]),
    why: steppedDown
      ? bi(
          `${why[plan].en} We picked a smaller plan so the fee doesn't cancel the monthly gain.`,
          `${why[plan].ro} Am ales un abonament mai mic, ca să nu anuleze câștigul lunar.`,
        )
      : why[plan],
    includes: planIncludes(plan, stagesPhrase(plan, stages)),
    priceNote: priceNote(plan, withSetup),
  };
}

import { PLAN_PRICING, type PlanId } from "@/lib/plans";
import type {
  AutomationOpportunity,
  Bilingual,
  Blueprint,
  StrategyOption,
  VortexOffer,
} from "@/lib/scan/types";

import { lcFirst } from "./format";
import { bi } from "./model";

/*
 * Maps the blueprint to a Vortex plan (src/lib/plans.ts, PricingSection):
 * Starter 20 EUR / 100 lei, Growth 50 EUR / 250 lei, Pro 200 EUR / 1000 lei a
 * month, or a fixed-price project when the build is large.
 */

/** Plan features, as listed on the pricing section. */
const PLAN_INCLUDES: Record<PlanId, Bilingual[]> = {
  starter: [
    bi(
      "30 minutes of live Zoom consultation each month",
      "30 de minute de consultanță live pe Zoom în fiecare lună",
    ),
    bi("1 month access to our AI tools", "1 lună de acces la instrumentele noastre AI"),
    bi("Personalised next-step recommendations", "Recomandări personalizate pentru pașii următori"),
    bi("Email support during your subscription", "Suport pe e-mail pe durata abonamentului"),
  ],
  growth: [
    bi("2 hours of live Zoom consultation", "2 ore de consultanță live pe Zoom"),
    bi("Guided setup of your digital workflow", "Configurare ghidată a proceselor tale digitale"),
    bi(
      "Expanded access to our AIs and programs",
      "Acces extins la instrumentele și programele noastre AI",
    ),
    bi("Priority scheduling and email support", "Programări cu prioritate și suport pe e-mail"),
  ],
  pro: [
    bi("Hands-on help with your projects", "Ajutor practic pentru proiectele tale"),
    bi("Unlimited live support from our team", "Suport live nelimitat din partea echipei noastre"),
    bi("Unlimited access to all AI tools", "Acces nelimitat la toate instrumentele AI"),
    bi("Direct priority line to us", "Legătură directă, cu prioritate, cu echipa noastră"),
  ],
};

const PLAN_NAMES: Record<PlanId, string> = { starter: "Starter", growth: "Growth", pro: "Pro" };

/** Thresholds on the recommended strategy's investment (RON, high end). */
const GROWTH_FROM_RON = 5000;
const PRO_FROM_RON = 20000;
/** Above this total setup (or with 2+ high-complexity builds) it's a project. */
const PROJECT_FROM_RON = 50000;

function priceNote(plan: PlanId, withSetup: boolean): Bilingual {
  const eur = PLAN_PRICING[plan].eur / 100;
  const ron = PLAN_PRICING[plan].ron / 100;
  return withSetup
    ? bi(
        `From ${eur} EUR / month + one-off setup`,
        `De la ${ron} lei / lună + cost unic de implementare`,
      )
    : bi(`${eur} EUR / month`, `${ron} lei / lună`);
}

export function buildOffer(args: {
  opportunities: AutomationOpportunity[];
  strategies: StrategyOption[];
  totals: Blueprint["totals"];
}): VortexOffer {
  const recommended = args.strategies.find((s) => s.recommended) ?? args.strategies[0];
  const highComplexity = args.opportunities.filter((o) => o.complexity === "high");
  const invest = recommended?.investmentRon.high ?? 0;
  const count = args.opportunities.length;

  if (args.totals.setupCostRon.high >= PROJECT_FROM_RON || highComplexity.length >= 2) {
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

  const plan: PlanId =
    invest >= PRO_FROM_RON || highComplexity.length === 1
      ? "pro"
      : invest >= GROWTH_FROM_RON
        ? "growth"
        : "starter";

  const why: Record<PlanId, Bilingual> = {
    starter: bi(
      "Your first steps are quick wins; Starter gives you monthly guidance and our AI tools while you make them.",
      "Primii pași aduc rezultate rapide; cu Starter primești îndrumare lunară și acces la instrumentele noastre AI cât timp îi parcurgi.",
    ),
    growth: bi(
      `You have ${count} improvements worth doing; Growth covers the guided setup and ongoing support.`,
      `Ai ${count} îmbunătățiri care merită făcute; Growth acoperă implementarea ghidată și suportul continuu.`,
    ),
    pro: bi(
      "Several high-impact changes across your operations; Pro gives you hands-on help to build and run them.",
      "Ai mai multe schimbări cu impact mare în activitate; cu Pro primești ajutor practic ca să le implementezi și să le ții în funcțiune.",
    ),
  };

  return {
    planId: plan,
    title:
      plan === "starter"
        ? bi("Vortex Starter", "Vortex Starter")
        : bi(
            `Vortex ${PLAN_NAMES[plan]} + ${recommended?.id === "acquire" ? "website and growth setup" : "automation setup"}`,
            `Vortex ${PLAN_NAMES[plan]} + ${recommended?.id === "acquire" ? "implementare site și atragere de clienți" : "implementarea automatizărilor"}`,
          ),
    why: why[plan],
    includes: PLAN_INCLUDES[plan].map((item) => ({ ...item })),
    priceNote: priceNote(plan, plan !== "starter"),
  };
}

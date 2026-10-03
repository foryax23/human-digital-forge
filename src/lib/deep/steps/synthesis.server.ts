import type {
  Brief,
  BriefSection,
  CitedSentence,
  CompetitorCard,
  Correction,
  DeepReport,
  Fact,
  Gap,
  OwnerInputs,
  StepResult,
  SynthesisPart,
} from "../contracts";
import type { StepEnv } from "../env.server";
import { sectionsToBrief, synthesize } from "../llm/synthesis.server";
import { SECTOR_WORDS } from "../vocab";

import { isoDay, type StepDraft } from "./common.server";
import {
  applyCorrectionFacts,
  companyFromFacts,
  mergeFacts,
  mergeGaps,
  peersFromFacts,
} from "./merge.server";
import type { ReportBuilder, ReportParts } from "./report-fallback.server";

/*
 * Step 9, "synthesis" (plan A3, A7): part "warm" writes the prompt cache;
 * parts "brief", "customer" and "rivals" (three parallel invocations) write
 * the AI prose over the attested facts, verified by code. Without AI (no key,
 * breaker, budget, refusal) each part returns its rules template, marked
 * source "rules"; the report is still complete.
 */

export type ReportContext = {
  facts: Fact[];
  gaps: Gap[];
  hidden: Map<string, string>;
  parts: ReportParts;
  displayName: string;
  company: DeepReport["company"];
  peers?: DeepReport["peers"];
  competitors: CompetitorCard[];
};

/** Merged facts, corrections and report parts: shared by synthesis and finish. */
export function reportContext(
  env: Pick<StepEnv, "cui" | "identity" | "lang" | "relationship" | "now">,
  results: StepResult[],
  corrections: Correction[] | undefined,
  builder: ReportBuilder,
  owner?: OwnerInputs,
): ReportContext {
  const today = isoDay(env.now());
  const merged = mergeFacts(results);
  const { facts, hidden } = applyCorrectionFacts(merged, corrections, today);
  const gaps = mergeGaps(results);
  const company = companyFromFacts(facts, env.cui, env.identity.displayName);
  const peers = peersFromFacts(facts);
  const competitors: CompetitorCard[] = facts
    .filter((f) => f.predicate === "peers.rival")
    .map((f) => {
      const v = f.value as Record<string, unknown>;
      const site = facts.find((x) => x.id === `competitors.site.${v.cui}`)?.value as
        | Record<string, unknown>
        | undefined;
      return {
        cui: String(v.cui),
        name: String(v.name),
        city: v.city as string | undefined,
        turnover: v.turnover as number | undefined,
        turnoverPrev: v.turnoverPrev as number | undefined,
        profitPretax: v.profitPretax as number | undefined,
        employees: v.employees as number | undefined,
        website: (site?.website as string | undefined) ?? (v.website as string | undefined),
        siteVerified: site?.siteVerified as boolean | undefined,
        booking: site?.booking as boolean | undefined,
        shop: site?.shop as boolean | undefined,
        importantIssues: site?.importantIssues as number | undefined,
        whyChosen: v.whyChosen as { en: string; ro: string },
        origin: v.origin as "official" | "owner_added",
        factIds: [f.id, ...(site ? [`competitors.site.${v.cui}`] : [])],
      };
    });
  const parts = builder({
    facts,
    gaps,
    company,
    relationship: env.relationship,
    lang: env.lang,
    peers,
    competitors,
    owner,
  });
  return {
    facts,
    gaps,
    hidden,
    parts,
    displayName: env.identity.displayName,
    company,
    peers,
    competitors,
  };
}

/** An attested warm-up in this run wrote the prompt cache less than 4 minutes ago (TTL 5). */
export function warmedUp(results: StepResult[], now: number): boolean {
  return results.some(
    (r) =>
      r.step === "synthesis" &&
      r.part === "warm" &&
      r.status === "done" &&
      (r.counters?.cacheWrite ?? 0) > 0 &&
      now - (r.counters?.warmAt ?? 0) < 4 * 60_000,
  );
}

/** True when turnover moved the same way for three years (the "Dacă nu faci nimic" rule). */
export function trendAllowed(facts: Fact[]): boolean {
  const series = facts
    .filter((f) => f.predicate === "money.turnover")
    .map((f) => ({ y: Number(f.id.slice(-4)), v: f.value as number }))
    .sort((a, b) => b.y - a.y)
    .slice(0, 3);
  if (series.length < 3 || series[0].y - series[2].y !== 2) return false;
  const [c, b, a] = series.map((s) => s.v);
  return (a < b && b < c) || (a > b && b > c);
}

const rules = (sentences: CitedSentence[]): BriefSection => ({ source: "rules", sentences });
const ai = (sentences: CitedSentence[]): BriefSection => ({ source: "ai", sentences });

/** The rules template of one part, from the report parts' rules brief. */
export function rulesPart(part: Exclude<SynthesisPart, "warm">, brief: Brief): Partial<Brief> {
  switch (part) {
    case "brief":
      return { headline: brief.headline, meaning: brief.meaning, findings: brief.findings };
    case "customer":
      return { customerView: brief.customerView };
    case "rivals":
      return { rivals: brief.rivals, ifNothing: brief.ifNothing };
  }
}

export async function runSynthesis(
  env: StepEnv,
  input: { part: SynthesisPart; results: StepResult[]; corrections?: Correction[] },
  builder: ReportBuilder,
): Promise<StepDraft> {
  const ctx = reportContext(env, input.results, input.corrections, builder);
  const rulesBrief = ctx.parts.rulesBrief;
  const audience = ctx.parts.audience;
  const words = SECTOR_WORDS[ctx.parts.vocab];
  if (!env.llm) {
    return {
      status: "skipped",
      facts: [],
      gaps: [],
      brief:
        input.part === "warm"
          ? undefined
          : { ...rulesPart(input.part, rulesBrief), lang: env.lang, audience },
      counters: { ai: 0 },
    };
  }
  const candidates = ctx.parts.findings.map((f) => ({
    id: f.id,
    text: `${f.figure[env.lang]}: ${f.sentence[env.lang]}`,
  }));
  const outcome = await synthesize(
    {
      llm: env.llm,
      ledger: env.ledger,
      runId: env.runId,
      step: "synthesis",
      facts: ctx.facts,
      hidden: new Set(ctx.hidden.keys()),
      lang: env.lang,
      audience,
      companyName: ctx.displayName,
      words: {
        client: words.client,
        clients: words.clients,
        booking: words.booking,
        line: words.line[env.lang],
      },
      candidates,
      actionIds: ctx.parts.actions.slice(0, 3).map((a) => a.id),
      trendAllowed: trendAllowed(ctx.facts),
      prefixCached: warmedUp(input.results, env.now()),
      deadline: env.deadline,
      now: env.now,
      log: env.log,
    },
    input.part,
  );
  if (input.part === "warm") {
    return {
      status: outcome.kind === "warm" ? "done" : "skipped",
      facts: [],
      gaps: [],
      counters: {
        ai: outcome.kind === "warm" ? 1 : 0,
        cacheWrite: outcome.kind === "warm" ? outcome.cacheWrite : 0,
        // When the cache was written (attested): sections passed this result reserve at the read price.
        warmAt: env.now(),
      },
      spentUsd: outcome.kind === "warm" ? outcome.usd : undefined,
    };
  }
  if (outcome.kind !== "section") {
    env.log({ synthesis: input.part, rules: outcome.kind === "rules" ? outcome.reason : "" });
    return {
      status: "partial",
      facts: [],
      gaps: [],
      brief: { ...rulesPart(input.part, rulesBrief), lang: env.lang, audience },
      counters: { ai: 0 },
    };
  }
  const sections = sectionsToBrief(input.part, outcome.verified.sections);
  const wrap = (
    list: CitedSentence[] | undefined,
    fallback: BriefSection | undefined,
  ): BriefSection => (list && list.length ? ai(list) : (fallback ?? rules([])));
  let brief: Partial<Brief>;
  if (input.part === "brief") {
    const s = sections as {
      headline: CitedSentence[];
      meaning: CitedSentence[];
      findings: CitedSentence[][];
    };
    brief = {
      headline: wrap(s.headline, rulesBrief.headline),
      meaning: wrap(s.meaning, rulesBrief.meaning),
      findings: s.findings.map((list, i) => wrap(list, rulesBrief.findings[i])),
    };
  } else if (input.part === "customer") {
    brief = {
      customerView: wrap(
        (sections as { customerView: CitedSentence[] }).customerView,
        rulesBrief.customerView,
      ),
    };
  } else {
    const s = sections as { rivals: CitedSentence[]; ifNothing: CitedSentence[] };
    brief = {
      rivals: wrap(s.rivals, rulesBrief.rivals),
      // Enforced by code: only after three years moving the same way, whatever the model wrote.
      ifNothing: trendAllowed(ctx.facts) && s.ifNothing.length ? ai(s.ifNothing) : undefined,
    };
  }
  return {
    status: "done",
    facts: [],
    gaps: [],
    brief: {
      ...brief,
      lang: env.lang,
      audience,
      cut: {
        kept: outcome.verified.cut.kept,
        byCode: outcome.verified.cut.byCode,
        byEntailment: 0,
      },
    },
    counters: {
      ai: 1,
      cacheRead: outcome.cacheRead,
      kept: outcome.verified.cut.kept,
      cutByCode: outcome.verified.cut.byCode,
      replayed: outcome.replayed ? 1 : 0,
    },
    spentUsd: outcome.usd || undefined,
  };
}

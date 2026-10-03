import type {
  AreaLight,
  Bilingual,
  Brief,
  BriefSection,
  Correction,
  DeepReport,
  Gap,
  OwnerInputs,
  SourceId,
  SourceRef,
  StepName,
  StepResult,
} from "../contracts";
import type { StepEnv } from "../env.server";
import { renderFactLine } from "../llm/documents";
import { checkEntailment, type EntailItem } from "../llm/entail.server";
import { bi } from "../parse/format";
import { SOURCE_LABELS, SOURCE_URLS } from "../parse/labels";

import { gap, isoDay } from "./common.server";
import { mergeFacts, mergeGaps } from "./merge.server";
import type { ReportBuilder } from "./report-fallback.server";
import { reportContext, trendAllowed } from "./synthesis.server";

/*
 * Step 10, "finish" (plan A3, A7, A11): merges the attested results, applies
 * the owner's typed corrections, builds the report parts (lines, findings,
 * actions, totals: Eng 3's report logic, or the provisional builder), lays the
 * AI sections over the rules brief, runs one Haiku entailment check over every
 * kept AI sentence (only "supported" ones are shown; if the check cannot run,
 * no AI sentence is shown), hides sentences citing corrected facts, and
 * returns the report. Attestation and the verification code are added by the
 * dispatcher, which also closes the run in the ledger.
 */

const LICENCES: Partial<Record<SourceId, string>> = {
  mf_bulk: "CC BY 4.0",
  onrc: "CC BY 4.0",
};

export type FinishOutput = {
  report: Omit<DeepReport, "verifyCode">;
  status: "succeeded" | "partial";
  metrics: Record<string, unknown>;
};

type SectionKey = "headline" | "meaning" | "customerView" | "rivals" | "ifNothing";

/** The steps every report needs (DEEP_PLAN's core); a missing one is a gap and a partial run. */
const CORE_STEPS: Array<{ step: StepName; section: Gap["section"]; what: Bilingual }> = [
  { step: "start", section: "identity", what: bi("Company identity", "Identitatea firmei") },
  { step: "money", section: "money", what: bi("Official figures", "Cifrele oficiale") },
  { step: "site", section: "site", what: bi("The company's website", "Site-ul firmei") },
  { step: "signals", section: "risk", what: bi("Courts and tenders", "Instanțe și licitații") },
  {
    step: "peers",
    section: "peers",
    what: bi("Comparison with similar firms", "Comparația cu firme similare"),
  },
];

export function missingStepGaps(results: StepResult[], today: string): Gap[] {
  const present = new Set(results.map((r) => r.step));
  return CORE_STEPS.filter((c) => !present.has(c.step)).map((c) =>
    gap(c.section, c.what, bi("Not checked in this run", "Neverificat în această rulare"), today),
  );
}

export async function runFinish(
  env: StepEnv,
  input: {
    results: StepResult[];
    corrections?: Correction[];
    owner?: OwnerInputs;
    aiExpected: boolean;
    /** Gaps added by the caller (a partial report after an error or a timeout). */
    extraGaps?: Gap[];
    /** Marks the run partial whatever else happened. */
    forcePartial?: boolean;
  },
  builder: ReportBuilder,
): Promise<FinishOutput> {
  const today = isoDay(env.now());
  const missingGaps = missingStepGaps(input.results, today);
  const ctx = reportContext(env, input.results, input.corrections, builder, input.owner);
  const rulesBrief = ctx.parts.rulesBrief;
  const brief: Brief = {
    ...rulesBrief,
    findings: [...rulesBrief.findings],
    cut: { kept: 0, byCode: 0, byEntailment: 0 },
  };

  // AI sections from the synthesis parts, laid over the rules brief.
  const synth = input.results.filter(
    (r) => r.step === "synthesis" && r.part && r.part !== "warm" && r.brief,
  );
  // "Dacă nu faci nimic" only after three years moving the same way (enforced here, not by the prompt).
  const trendOk = trendAllowed(ctx.facts);
  for (const r of synth) {
    const b = r.brief!;
    for (const key of [
      "headline",
      "meaning",
      "customerView",
      "rivals",
      "ifNothing",
    ] as SectionKey[]) {
      if (key === "ifNothing" && !trendOk) continue;
      const section = b[key] as BriefSection | undefined;
      if (section && section.source === "ai" && section.sentences.length) brief[key] = section;
    }
    if (b.findings) {
      b.findings.forEach((section, i) => {
        if (section?.source === "ai" && section.sentences.length) brief.findings[i] = section;
      });
    }
    if (b.cut) {
      brief.cut.kept += b.cut.kept;
      brief.cut.byCode += b.cut.byCode;
    }
  }

  // Entailment: every kept AI sentence against the text of the facts it cites.
  const aiSections: Array<{ key: SectionKey | `findings.${number}`; section: BriefSection }> = [];
  for (const key of [
    "headline",
    "meaning",
    "customerView",
    "rivals",
    "ifNothing",
  ] as SectionKey[]) {
    const section = brief[key];
    if (section?.source === "ai") aiSections.push({ key, section });
  }
  brief.findings.forEach((section, i) => {
    if (section.source === "ai") aiSections.push({ key: `findings.${i}`, section });
  });
  const factById = new Map(ctx.facts.map((f) => [f.id, f]));
  let entailRan = false;
  if (aiSections.length) {
    const items: EntailItem[] = [];
    const where: Array<{ s: number; j: number }> = [];
    aiSections.forEach((entry, s) =>
      entry.section.sentences.forEach((sentence, j) => {
        items.push({
          i: items.length,
          sentence: sentence.text,
          facts: sentence.factIds
            .map((id) => factById.get(id))
            .filter(Boolean)
            .map((f) => renderFactLine(f!, env.lang)),
        });
        where.push({ s, j });
      }),
    );
    const verdicts = env.llm
      ? await checkEntailment({
          llm: env.llm,
          ledger: env.ledger,
          runId: env.runId,
          items,
          deadline: env.deadline,
          now: env.now,
          log: env.log,
        })
      : null;
    if (verdicts) {
      entailRan = true;
      const keep = aiSections.map(() => new Set<number>());
      items.forEach((item, n) => {
        if (verdicts.get(item.i) === "supported") keep[where[n].s].add(where[n].j);
        else brief.cut.byEntailment++;
      });
      aiSections.forEach((entry, s) => {
        entry.section.sentences = entry.section.sentences.filter((_, j) => keep[s].has(j));
      });
    }
  }
  // Without a successful check, no AI sentence is shown; empty sections fall back to rules.
  const restore = (key: SectionKey | `findings.${number}`) => {
    if (key.startsWith("findings.")) {
      const i = Number(key.split(".")[1]);
      brief.findings[i] = rulesBrief.findings[i] ?? { source: "rules", sentences: [] };
    } else {
      (brief as Record<string, unknown>)[key] = rulesBrief[key as SectionKey];
    }
  };
  for (const entry of aiSections) {
    if (!entailRan || !entry.section.sentences.length) restore(entry.key);
  }
  brief.cut.kept = aiSections.reduce((n, e) => n + (entailRan ? e.section.sentences.length : 0), 0);

  // Sentences citing a corrected fact are hidden ("corectat de tine").
  const hide = (section?: BriefSection) => {
    if (!section) return;
    for (const sentence of section.sentences) {
      const by = sentence.factIds.find((id) => ctx.hidden.has(id));
      if (by && section.source === "ai") sentence.hiddenBy = ctx.hidden.get(by);
    }
  };
  [
    brief.headline,
    brief.meaning,
    brief.customerView,
    brief.rivals,
    brief.ifNothing,
    ...brief.findings,
  ].forEach(hide);

  const usedAi = [
    brief.headline,
    brief.meaning,
    brief.customerView,
    brief.rivals,
    brief.ifNothing,
    ...brief.findings,
  ].some((s) => s?.source === "ai");
  const sourceIds = [...new Set(ctx.facts.map((f) => f.source))];
  const sources: SourceRef[] = sourceIds.map((id) => {
    const asOf =
      ctx.facts
        .filter((f) => f.source === id)
        .map((f) => f.asOf)
        .sort()
        .pop() ?? today;
    const ref: SourceRef = {
      id,
      label: SOURCE_LABELS[id],
      asOf,
      retrievedAt: new Date(env.now()).toISOString(),
    };
    if (SOURCE_URLS[id]) ref.url = SOURCE_URLS[id];
    if (LICENCES[id]) ref.licence = LICENCES[id];
    return ref;
  });
  const reportFacts = ctx.facts.filter((f) => !f.ephemeral);
  const company = ctx.company;
  const failedSteps = input.results.filter((r) => r.status === "failed").map((r) => r.step);
  const report: Omit<DeepReport, "verifyCode"> = {
    schema: 1,
    runId: env.runId,
    cui: env.cui,
    lang: env.lang,
    relationship: env.relationship,
    audience: ctx.parts.audience,
    firm: ctx.parts.firm,
    generatedAt: new Date(env.now()).toISOString(),
    aiMode: usedAi ? "ai" : "rules",
    models:
      usedAi && env.llm
        ? { synthesis: env.llm.models.synthesis, extraction: env.llm.models.extraction }
        : undefined,
    company,
    facts: reportFacts,
    gaps: [...ctx.gaps, ...missingGaps, ...(input.extraGaps ?? [])],
    sources,
    registers: ctx.parts.registers,
    lights: ctx.parts.lights,
    findings: ctx.parts.findings,
    actions: ctx.parts.actions,
    totals: ctx.parts.totals,
    brief,
    peers: ctx.peers,
    competitors: ctx.competitors,
    counts: ctx.parts.counts,
    vocab: ctx.parts.vocab,
    ownerInputs: input.owner,
  };
  const missingSteps = CORE_STEPS.map((c) => c.step).filter(
    (step) => !input.results.some((r) => r.step === step),
  );
  return {
    report,
    status:
      input.forcePartial ||
      failedSteps.length ||
      missingSteps.length ||
      (input.aiExpected && !usedAi)
        ? "partial"
        : "succeeded",
    metrics: {
      failedSteps,
      missingSteps,
      kept: brief.cut.kept,
      cutByCode: brief.cut.byCode,
      cutByEntailment: brief.cut.byEntailment,
      entailRan,
      aiMode: report.aiMode,
      facts: reportFacts.length,
    },
  };
}

/**
 * The last resort when even the rules-only report cannot be built (a bug in the
 * report logic): the merged facts and gaps, every line "neverificat", a one-line
 * brief. Never thrown away: the person still gets their data and the gap.
 */
export function emergencyReport(env: StepEnv, results: StepResult[], partial: Gap): FinishOutput {
  const safe = <T>(work: () => T, fallback: T): T => {
    try {
      return work();
    } catch {
      return fallback;
    }
  };
  const facts = safe(() => mergeFacts(results), []).filter((f) => !f.ephemeral);
  const gaps = [...safe(() => mergeGaps(results), [] as Gap[]), partial];
  const reason = bi("could not be assessed", "nu am putut evalua");
  const area = (id: AreaLight["area"], label: Bilingual): AreaLight => ({
    area: id,
    label,
    state: "neverificat",
    reason,
    factIds: [],
  });
  const name = env.identity.displayName || env.identity.name || env.cui;
  const line = (text: string): BriefSection => ({
    source: "rules",
    sentences: [{ text, factIds: [] }],
  });
  const audience: DeepReport["audience"] =
    env.relationship === "proprietar" || env.relationship === "angajat" ? "owner" : "third_party";
  const report: Omit<DeepReport, "verifyCode"> = {
    schema: 1,
    runId: env.runId,
    cui: env.cui,
    lang: env.lang,
    relationship: env.relationship,
    audience,
    firm: "established",
    generatedAt: new Date(env.now()).toISOString(),
    aiMode: "rules",
    company: {
      name: env.identity.name || name,
      displayName: name,
      cui: env.cui,
      activity: bi("", ""),
    },
    facts,
    gaps,
    sources: [],
    registers: { checked: [], notChecked: [] },
    lights: [
      area("bani", bi("Money", "Bani")),
      area("clienti", bi("Customers", "Clienți")),
      area("online", bi("Online", "Online")),
      area("echipa", bi("Team", "Echipă")),
      area("risc", bi("Risk", "Risc")),
    ],
    findings: [],
    actions: [],
    totals: {},
    brief: {
      lang: env.lang,
      audience,
      headline: line(
        env.lang === "ro"
          ? `${name}: raportul a fost generat parțial.`
          : `${name}: the report was generated partially.`,
      ),
      meaning: { source: "rules", sentences: [] },
      findings: [],
      customerView: { source: "rules", sentences: [] },
      rivals: { source: "rules", sentences: [] },
      cut: { kept: 0, byCode: 0, byEntailment: 0 },
    },
    competitors: [],
    counts: { officialSources: 0, pagesRead: 0, facts: facts.length, estimates: 0 },
    vocab: "generic",
  };
  return { report, status: "partial", metrics: { emergency: true, facts: facts.length } };
}

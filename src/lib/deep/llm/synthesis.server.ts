import { canonicalJson, sha256Hex } from "../attest.server";
import {
  DEEP_LIMITS,
  type Audience,
  type CitedSentence,
  type Fact,
  type Lang,
  type StepName,
  type SynthesisPart,
} from "../contracts";

import { SECTION_MAX_TOKENS, SECTION_MIN_TOKENS, estimateTokens } from "./budget";
import { buildFactDocuments, citableFacts } from "./documents";
import { paidCall, type PaidLedger } from "./paid.server";
import { SECTION_MARKERS, sectionInstruction, synthesisSystem, type SectorWords } from "./prompts";
import type { LlmBlock, LlmClient, LlmMessage, LlmRequest } from "./types";
import { verifySections, type VerifiedSections } from "./verify";

/*
 * Synthesis (plan A7, D14): one cache warm-up call (max_tokens 0, the same
 * thinking, effort, betas and fallbacks as the sections, so the cache entry
 * matches), then three section calls in parallel (`brief`, `customer`,
 * `rivals`; each its own step invocation), streamed, effort "low" by default,
 * citations on, max_tokens 4,000, server-side fallback "default". Every
 * section is reserved first (fallback worst case included), keeps headroom
 * for the entailment check, is verified by code, and is replayed from the
 * ledger when the same section is asked again with the same input: replay keys
 * carry a digest of the prompt (system, documents, instruction), so a retry
 * with other facts is a new call, never another call's citations re-mapped.
 * A section reserves its prefix at the cache-write price unless an attested
 * warm-up of the same run wrote the cache within the last 4 minutes.
 */

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type SynthesisContext = {
  llm: LlmClient;
  ledger: PaidLedger;
  runId: string;
  step: StepName;
  facts: Fact[];
  hidden?: Set<string>;
  lang: Lang;
  audience: Audience;
  companyName: string;
  words: SectorWords;
  candidates: Array<{ id: string; text: string }>;
  actionIds: string[];
  trendAllowed: boolean;
  /** An attested warm-up wrote the cache (sections then reserve the prefix at the cache-read price). */
  prefixCached?: boolean;
  deadline: number;
  now: () => number;
  log: (event: Record<string, unknown>) => void;
};

/** A short digest of a prompt for replay keys (≤ 80 characters with the run ID). */
export async function promptDigest(value: unknown): Promise<string> {
  return (await sha256Hex(canonicalJson(value))).slice(0, 16);
}

export type SynthesisOutcome =
  | { kind: "warm"; usd: number; cacheWrite: number }
  | {
      kind: "section";
      verified: VerifiedSections;
      usd: number;
      replayed: boolean;
      cacheRead: number;
    }
  | { kind: "rules"; reason: string };

/** The shared prefix: system + six fact documents, cache breakpoint on the last document. */
/** Least important first: what goes when the facts sent to synthesis exceed 150 KB (plan A4). */
const DROP_ORDER = [
  "offers.price",
  "offers.services",
  "people.roles",
  "people.job_titles",
  "site.audit.issue",
  "money.cash",
  "money.revenue_total",
];

export function capFacts(facts: Fact[], lang: Lang): Fact[] {
  const size = (list: Fact[]) => JSON.stringify(buildFactDocuments(list, lang).documents).length;
  let kept = facts;
  for (const predicate of DROP_ORDER) {
    if (size(kept) <= DEEP_LIMITS.synthesisFactsBytes) break;
    const matching = kept.filter((f) => f.predicate === predicate);
    // Keep the first few of each kind; drop the rest.
    const drop = new Set(matching.slice(3).map((f) => f.id));
    kept = kept.filter((f) => !drop.has(f.id));
  }
  // Older per-year figures go last (the latest three years stay).
  while (size(kept) > DEEP_LIMITS.synthesisFactsBytes) {
    const years = kept.map((f) => Number(/\.(\d{4})$/.exec(f.id)?.[1] ?? 0)).filter(Boolean);
    const oldest = Math.min(...years);
    if (!years.length || oldest >= Math.max(...years) - 2) break;
    kept = kept.filter((f) => !f.id.endsWith(`.${oldest}`));
  }
  return kept;
}

export function buildPrefix(
  ctx: Pick<SynthesisContext, "facts" | "hidden" | "lang" | "audience" | "companyName" | "words">,
) {
  const facts = capFacts(citableFacts(ctx.facts, ctx.hidden), ctx.lang);
  const docs = buildFactDocuments(facts, ctx.lang);
  const documents = docs.documents.map((d, i) =>
    i === docs.documents.length - 1 ? { ...d, cache_control: { type: "ephemeral" as const } } : d,
  );
  const system = synthesisSystem({
    lang: ctx.lang,
    audience: ctx.audience,
    companyName: ctx.companyName,
    words: ctx.words,
  });
  return { system, documents, docs, facts };
}

function commonParams(llm: LlmClient) {
  return {
    model: llm.models.synthesis,
    thinking: { type: "adaptive" },
    output_config: { effort: llm.models.effort },
    betas: [FALLBACK_BETA],
    fallbacks: "default",
  };
}

async function prefixTokens(
  ctx: SynthesisContext,
  request: Omit<LlmRequest, "max_tokens">,
): Promise<number> {
  try {
    return await ctx.llm.transport.countTokens(request);
  } catch {
    return estimateTokens(JSON.stringify(request).length);
  }
}

export async function synthesize(
  ctx: SynthesisContext,
  part: SynthesisPart,
): Promise<SynthesisOutcome> {
  const { system, documents, docs, facts } = buildPrefix(ctx);
  if (!facts.length) return { kind: "rules", reason: "no_facts" };
  const common = commonParams(ctx.llm);
  const factMap = new Map(facts.map((f) => [f.id, f]));

  if (part === "warm") {
    const body = { ...common, system, messages: [{ role: "user", content: documents }] };
    const tokens = await prefixTokens(ctx, body);
    const outcome = await paidCall({
      ledger: ctx.ledger,
      runId: ctx.runId,
      step: ctx.step,
      idemKey: `${ctx.runId}|synthesis|warm|${await promptDigest({ system, documents })}`,
      plan: {
        model: common.model,
        inputTokens: 0,
        cacheWriteTokens: tokens,
        maxTokens: 0,
        fallback: false,
      },
      floor: 0,
      exec: () =>
        ctx.llm.transport.create(
          { ...body, max_tokens: 0 },
          { timeoutMs: Math.max(5000, ctx.deadline - ctx.now() - 1000) },
        ),
      toReplay: () => ({ warm: true }),
      deadline: ctx.deadline,
      now: ctx.now,
      log: ctx.log,
    });
    if (outcome.kind === "ok") {
      return {
        kind: "warm",
        usd: outcome.usd,
        cacheWrite: outcome.message.usage.cache_creation_input_tokens ?? 0,
      };
    }
    if (outcome.kind === "replay") return { kind: "warm", usd: 0, cacheWrite: 0 };
    // A refused warm-up is not fatal: the first section then writes the cache itself.
    return {
      kind: "rules",
      reason: outcome.kind === "refused" ? outcome.reason : outcome.error.kind,
    };
  }

  const markers = SECTION_MARKERS[part];
  const instruction = sectionInstruction(part, {
    lang: ctx.lang,
    candidates: ctx.candidates,
    actionIds: ctx.actionIds,
    trendAllowed: ctx.trendAllowed,
  });
  const body = {
    ...common,
    system,
    messages: [{ role: "user", content: [...documents, { type: "text", text: instruction }] }],
  };
  const idemKey = `${ctx.runId}|synthesis|${part}|${await promptDigest({ system, documents, instruction })}`;
  const total = await prefixTokens(ctx, body);
  const instructionTokens = estimateTokens(instruction.length);
  const prefix = Math.max(0, total - instructionTokens);
  const verify = (message: LlmMessage) =>
    verifySections({
      message,
      markers,
      factIndex: docs.factIndex,
      facts: factMap,
      audience: ctx.audience,
      knownNames: [ctx.companyName],
    });
  const outcome = await paidCall({
    ledger: ctx.ledger,
    runId: ctx.runId,
    step: ctx.step,
    idemKey,
    plan: {
      model: common.model,
      inputTokens: instructionTokens,
      // Worst case: without a confirmed warm-up, each parallel section writes the cache itself.
      ...(ctx.prefixCached ? { cachedTokens: prefix } : { cacheWriteTokens: prefix }),
      maxTokens: SECTION_MAX_TOKENS,
      fallback: true,
    },
    floor: SECTION_MIN_TOKENS,
    keepHeadroom: true,
    exec: (maxTokens) =>
      ctx.llm.transport.stream(
        { ...body, max_tokens: maxTokens },
        { timeoutMs: Math.max(5000, ctx.deadline - ctx.now() - 1000) },
      ),
    // Stored with the settlement: replays are verified again, never trusted blindly.
    toReplay: (message) => ({
      stop_reason: message.stop_reason,
      model: message.model,
      content: message.content.filter((b: LlmBlock) => b.type === "text" || b.type === "fallback"),
    }),
    deadline: ctx.deadline,
    now: ctx.now,
    log: ctx.log,
  });
  if (outcome.kind === "replay") {
    const stored = outcome.result as {
      stop_reason: string | null;
      model: string;
      content: LlmBlock[];
    } | null;
    if (!stored?.content) return { kind: "rules", reason: "replay_empty" };
    const verified = verify({
      model: stored.model,
      content: stored.content,
      stop_reason: stored.stop_reason,
      usage: { input_tokens: 0, output_tokens: 0 },
    });
    return verified.status === "ok"
      ? { kind: "section", verified, usd: 0, replayed: true, cacheRead: 0 }
      : { kind: "rules", reason: verified.status };
  }
  if (outcome.kind !== "ok")
    return {
      kind: "rules",
      reason: outcome.kind === "refused" ? outcome.reason : outcome.error.kind,
    };
  const verified = verify(outcome.message);
  ctx.log({
    synthesis: part,
    kept: verified.cut.kept,
    cut: verified.cut.byCode,
    reasons: verified.cut.reasons,
    cacheRead: outcome.message.usage.cache_read_input_tokens ?? 0,
  });
  if (verified.status !== "ok") return { kind: "rules", reason: verified.status };
  return {
    kind: "section",
    verified,
    usd: outcome.usd,
    replayed: false,
    cacheRead: outcome.message.usage.cache_read_input_tokens ?? 0,
  };
}

/** Marker → kept sentences, for the brief. */
export function sectionsToBrief(
  part: Exclude<SynthesisPart, "warm">,
  sections: Record<string, CitedSentence[]>,
) {
  const pick = (marker: string) => sections[marker] ?? [];
  switch (part) {
    case "brief":
      return {
        headline: pick("[TITLU]"),
        meaning: pick("[CE_INSEAMNA]"),
        findings: [pick("[CONSTATARE 1]"), pick("[CONSTATARE 2]"), pick("[CONSTATARE 3]")],
      };
    case "customer":
      return { customerView: pick("[CE_VEDE_UN_CLIENT]") };
    case "rivals":
      return { rivals: pick("[CONCURENTI]"), ifNothing: pick("[DACA_NU_FACI_NIMIC]") };
  }
}

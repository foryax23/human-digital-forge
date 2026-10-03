import { ANAF_STEP_QUOTA } from "../anaf-pacer.server";
import {
  canonicalJson,
  cursorMatches,
  reportAttestation,
  sealResult,
  sha256Hex,
  verificationCode,
  verifyResult,
} from "../attest.server";
import {
  DEEP_LIMITS,
  DEEP_PLAN,
  type AccessReason,
  type AccessVia,
  type AdminBy,
  type ConsentRecord,
  type DeepReport,
  type DeepStepInput,
  type DeepStepOutput,
  type DeepStore,
  type Gap,
  type StartDeepRunInput,
  type StartDeepRunOutput,
  type StepClaim,
  type StepName,
  type StepResult,
  type SynthesisPart,
} from "../contracts";
import {
  STEP_HARD_MS,
  createStepEnv,
  stepBudgetMs,
  ticketAdmitted,
  type DeepConfig,
  type EnvAdapters,
  type StepEnv,
} from "../env.server";
import type { PaidLedger } from "../llm/paid.server";
import type { LlmClient } from "../llm/types";
import { bi } from "../parse/format";
import { cleanCui, isValidCui } from "../parse/registry";
import { issueTicket, readTicket, type TicketPayload } from "../ticket.server";

import { runAudit } from "./audit.server";
import { gap, isoDay, type StepDraft } from "./common.server";
import { runCompetitor, rivalFromPeers } from "./competitor.server";
import { runCrawl } from "./crawl.server";
import { emergencyReport, runFinish, type FinishOutput } from "./finish.server";
import { runMoney } from "./money.server";
import { runPageSpeed } from "./pagespeed.server";
import { runPeers } from "./peers.server";
import type { ReportBuilder } from "./report-fallback.server";
import { runSignals } from "./signals.server";
import { runSite } from "./site.server";
import { runStart } from "./start.server";
import { runSynthesis } from "./synthesis.server";

/*
 * The server side of a deep run, independent of TanStack and Supabase (the
 * server functions and the golden script both call it): ticket checks, the
 * attestation of every input result, the run-wide ANAF pacer, the step budget
 * (25 s, aborted at 28 s; pagespeed and synthesis sections 50 s), result size
 * limits (48 KB, 200 facts), attestation of every output, and closing the run
 * in the ledger with the report attestation and its verification code.
 *
 * Run-level limits hold across step calls (a replayed request, a runner retry or
 * a second tab): every step is claimed in the store before it runs (money,
 * signals, audit, pagespeed once; site twice; peers 1 + 3 edits; each crawl
 * cursor once and 3 batches; each competitor once and 6 in all; ANAF 8 calls
 * after start's one), a used-up step replays its stored result, and anything
 * the store cannot confirm is refused (fail closed). `finish` returns the
 * stored report when there is one, and always ends in a report: an error or a
 * timeout gives a rules-only partial report.
 */

export type EngineDeps = {
  secret: string;
  config: DeepConfig;
  adapters: EnvAdapters;
  /** The store a run uses for its whole life (kind fixed in the ticket). */
  storeFor: (kind: TicketPayload["store"]) => DeepStore;
  /** null = rules-only. */
  llmFor: (config: DeepConfig) => LlmClient | null;
  reportBuilder: ReportBuilder;
  now?: () => number;
  log?: (event: Record<string, unknown>) => void;
};

const STEP_GAP_SECTION: Record<StepName, Gap["section"]> = {
  start: "identity",
  money: "money",
  site: "site",
  signals: "risk",
  peers: "peers",
  audit: "site",
  crawl: "site",
  pagespeed: "site",
  competitor: "competitors",
  synthesis: "identity",
  finish: "identity",
};

function ledgerOf(store: DeepStore, config: DeepConfig): PaidLedger {
  return {
    reserve: (i) => store.reserve(i),
    settle: (i) => store.settle(i),
    tripBreaker: (m, r) => store.tripBreaker(m, r),
    runSpend: store.runSpend ? (id) => store.runSpend!(id) : undefined,
    dayCapUsd: config.dayBudgetUsd,
  };
}

/** Caps a result at 200 facts and 48 KB: quotes go first, then the least important facts. */
export function enforceLimits(result: Omit<StepResult, "att">): Omit<StepResult, "att"> {
  let out = result;
  if (out.facts.length > DEEP_LIMITS.stepResultFacts) {
    out = {
      ...out,
      facts: out.facts.slice(0, DEEP_LIMITS.stepResultFacts),
      gaps: [
        ...out.gaps,
        gap(
          out.facts[0]?.section ?? "site",
          bi("Some details", "Unele detalii"),
          bi("Left out to keep the result small", "Lăsate deoparte ca rezultatul să rămână mic"),
          isoDay(Date.now()),
        ),
      ],
    };
  }
  // The sealed cursor is not counted: it is opaque, outside the attestation and droppable.
  const size = () =>
    new TextEncoder().encode(
      canonicalJson({
        ...out,
        next: out.next ? { ...out.next, crawlCursor: undefined } : undefined,
      }),
    ).length;
  if (size() > DEEP_LIMITS.stepResultBytes) {
    out = {
      ...out,
      facts: out.facts.map((f) =>
        f.evidence?.quote
          ? { ...f, evidence: { ...f.evidence, quote: f.evidence.quote.slice(0, 80) } }
          : f,
      ),
    };
  }
  while (size() > DEEP_LIMITS.stepResultBytes && out.facts.length) {
    out = { ...out, facts: out.facts.slice(0, Math.floor(out.facts.length * 0.9)) };
  }
  return out;
}

async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function envFor(
  deps: EngineDeps,
  t: TicketPayload,
  step: StepName,
  extra: {
    part?: SynthesisPart;
    anafStartAt?: number;
    /** ANAF calls granted by the run-level claim (money, peers); 0 elsewhere. */
    anafQuota?: number;
    startedAt: number;
    store: DeepStore;
  },
): StepEnv {
  const llm = t.ai === "ai" ? deps.llmFor(deps.config) : null;
  return createStepEnv(
    {
      runId: t.runId,
      uid: t.uid,
      cui: t.cui,
      lang: t.lang,
      relationship: t.rel,
      step,
      part: extra.part,
      identity: t.idn,
      secret: deps.secret,
      config: deps.config,
      llm,
      ledger: ledgerOf(extra.store, deps.config),
      anafStartAt: Math.max(t.anafAt, extra.anafStartAt ?? 0),
      anafQuota: extra.anafQuota ?? 0,
      startedAt: extra.startedAt,
    },
    { ...deps.adapters, now: deps.now ?? deps.adapters.now, log: deps.log ?? deps.adapters.log },
  );
}

/* ------------------------------------------------------------------ start */

/** ANAF calls a run may make after start's identity call (start 1 + money 7 + peers 1 = 9). */
export const ANAF_RUN_AFTER_START = DEEP_LIMITS.anafCallsPerRun - ANAF_STEP_QUOTA.start;
/** Largest wait a client-supplied anafNextAt may ask for (legitimate values are ≤ 1.1 s ahead). */
const ANAF_NEXT_MAX_AHEAD_MS = 3000;

/** Paid calls need a ledger whose day cap holds for everyone: the memory ledger only by opt-in. */
export function aiModeFor(config: DeepConfig, storeKind: TicketPayload["store"]): "ai" | "rules" {
  if (!config.anthropicKey) return "rules";
  return storeKind !== "memory" || config.memoryLedgerAi ? "ai" : "rules";
}

export async function engineStart(
  deps: EngineDeps,
  args: {
    uid: string;
    via: AccessVia;
    /** For via "admin": how the admin was admitted (kept in the ticket for the step checks). */
    adminBy?: AdminBy;
    input: StartDeepRunInput;
    store: DeepStore;
    storeKind: TicketPayload["store"];
    consent: ConsentRecord;
    userCap: number;
  },
): Promise<StartDeepRunOutput> {
  const now = deps.now ?? (() => Date.now());
  const cui = args.input.cui.replace(/^ro/i, "").replace(/\D/g, "").replace(/^0+/, "");
  if (!isValidCui(cui)) return { ok: false, reason: "not_found" };
  // The caps first: a user at the cap never causes an ANAF call. (startRun checks them again
  // atomically with the insert; this read only avoids the identity call.)
  const stats = await args.store.dayStats(args.uid).catch(() => null);
  if (!stats) return { ok: false, reason: "ledger_unavailable" };
  if (stats.userRuns >= args.userCap) return { ok: false, reason: "daily_cap_user" };
  if (args.via !== "admin" && stats.allRuns >= deps.config.dailyRunCap)
    return { ok: false, reason: "daily_cap_global" };
  const startedAt = now();
  const aiMode = aiModeFor(deps.config, args.storeKind);
  // The identity call comes first: a refused company (PFA, unknown) never takes a run slot.
  const env = createStepEnv(
    {
      runId: "pending",
      uid: args.uid,
      cui,
      lang: args.input.lang,
      relationship: args.input.relationship,
      step: "start",
      identity: { name: "", displayName: "" },
      secret: deps.secret,
      config: deps.config,
      llm: null,
      ledger: ledgerOf(args.store, deps.config),
      anafStartAt: startedAt,
      anafQuota: ANAF_STEP_QUOTA.start,
      startedAt,
    },
    { ...deps.adapters, now: deps.now ?? deps.adapters.now, log: deps.log ?? deps.adapters.log },
  );
  const hint =
    args.input.site && /^https?:\/\//i.test(args.input.site)
      ? args.input.site.slice(0, 300)
      : undefined;
  const outcome = await runStart(env, { cui, hintSite: hint });
  if (outcome.kind === "not_found") return { ok: false, reason: "not_found" };
  if (outcome.kind === "natural_person") return { ok: false, reason: "natural_person" };
  if (outcome.kind === "anaf_unavailable") return { ok: false, reason: "anaf_unavailable" };
  const started = await args.store
    .startRun({
      userId: args.uid,
      cui,
      companyName: outcome.company.name.slice(0, 200),
      relationship: args.input.relationship,
      lang: args.input.lang,
      via: args.via,
      budgetUsd: deps.config.runBudgetUsd,
      aiMode,
      consent: args.consent,
      userCap: args.userCap,
      globalCap: deps.config.dailyRunCap,
      allowSameCompany: Boolean(args.input.rerun && args.via === "admin"),
    })
    .catch(() => ({ reason: "ledger_unavailable" as AccessReason }));
  if ("reason" in started) {
    const replayRunId = "replayRunId" in started ? started.replayRunId : undefined;
    return replayRunId
      ? { ok: false, reason: started.reason, replayRunId }
      : { ok: false, reason: started.reason };
  }
  const runId = started.runId;
  const identity = await sealResult(
    deps.secret,
    args.uid,
    enforceLimits({ runId, step: "start", ms: now() - startedAt, ...outcome.draft }),
  );
  const ticket = await issueTicket(
    deps.secret,
    {
      runId,
      uid: args.uid,
      cui,
      via: args.via,
      ...(args.via === "admin" && args.adminBy ? { adminBy: args.adminBy } : {}),
      store: args.storeKind,
      budgetUsd: deps.config.runBudgetUsd,
      lang: args.input.lang,
      rel: args.input.relationship,
      ai: aiMode,
      idn: outcome.identity,
      anafAt: outcome.draft.next?.anafNextAt ?? now() + 1100,
      owner: args.input.owner,
    },
    now(),
  );
  return {
    ok: true,
    runId,
    ticket,
    store: args.storeKind === "memory" ? "stopgap" : args.storeKind,
    identity,
    plan: DEEP_PLAN,
    aiMode,
  };
}

/* ------------------------------------------------------------------ claims */

type ClaimSpec = { key: string; max: number; exclusive?: boolean };

/** The run-level claims a step needs before it runs (see DeepStore.claimStep). */
async function claimSpecs(input: DeepStepInput, competitorCui: string): Promise<ClaimSpec[]> {
  switch (input.step) {
    case "money":
      return [{ key: "money", max: 1 }];
    case "signals":
      return [{ key: "signals", max: 1 }];
    case "site":
      // The first call plus one answer to "Acesta e site-ul firmei?".
      return [{ key: "site", max: 2 }];
    case "peers":
      return [{ key: "peers", max: 1 + DEEP_LIMITS.peerEditsMax }];
    case "audit":
      return [{ key: "audit", max: 1 }];
    case "pagespeed":
      return [{ key: "pagespeed", max: 1 }];
    case "crawl":
      return [
        { key: `crawl|${(await sha256Hex(input.cursor)).slice(0, 16)}`, max: 1 },
        { key: "crawl", max: DEEP_LIMITS.crawlBatchesMax, exclusive: false },
      ];
    case "competitor":
      return [
        { key: `competitor|${competitorCui}`, max: 1 },
        {
          key: "competitors",
          max: DEEP_LIMITS.competitorsMax + DEEP_LIMITS.peerEditsMax,
          exclusive: false,
        },
      ];
    default:
      // synthesis: every paid call is reserved and replayed by content in the ledger.
      return [];
  }
}

const CLAIM_REFUSAL: Record<Exclude<StepClaim, { ok: true }>["reason"], AccessReason> = {
  replay: "budget_exhausted",
  in_flight: "already_running",
  exhausted: "budget_exhausted",
  run_closed: "run_not_found",
  run_not_found: "run_not_found",
  ledger_error: "ledger_unavailable",
};

async function claim(
  store: DeepStore,
  input: Parameters<DeepStore["claimStep"]>[0],
): Promise<StepClaim> {
  try {
    return await store.claimStep(input);
  } catch {
    return { ok: false, reason: "ledger_error" };
  }
}

/* ------------------------------------------------------------------- steps */

export async function engineStep(
  deps: EngineDeps,
  args: { uid: string; input: DeepStepInput },
): Promise<DeepStepOutput> {
  const now = deps.now ?? (() => Date.now());
  const startedAt = now();
  const checked = await readTicket(deps.secret, args.input.ticket, {
    uid: args.uid,
    now: startedAt,
  });
  if (!checked.ok) return { kind: "refused", reason: checked.reason };
  const t = checked.payload;
  if (deps.config.mode === "disabled") return { kind: "refused", reason: "mode_disabled" };
  // Still entitled now (an admin removed, or the mode switched back, takes effect here).
  if (!ticketAdmitted(deps.config, t.via, args.uid, t.adminBy))
    return { kind: "refused", reason: "admin_only" };
  const store = deps.storeFor(t.store);
  const input = args.input;
  const attested = (r: StepResult | undefined) => verifyResult(deps.secret, args.uid, t.runId, r);
  const refuse = (reason: AccessReason): DeepStepOutput => ({ kind: "refused", reason });
  const competitorCui = input.step === "competitor" ? (cleanCui(input.cui) ?? "") : "";

  // Every result handed back by the browser must be ours, for this run and user, unchanged.
  switch (input.step) {
    case "peers":
      if (!(await attested(input.money)) || input.money.step !== "money")
        return refuse("ticket_invalid");
      break;
    case "audit":
    case "pagespeed":
    case "crawl":
      if (!(await attested(input.site)) || input.site.step !== "site")
        return refuse("ticket_invalid");
      // A cursor sent with the site result must be the one sealed with it (attested sha).
      if (input.site.next?.crawlCursor && !(await cursorMatches(input.site)))
        return refuse("ticket_invalid");
      break;
    case "competitor":
      if (!(await attested(input.peers)) || input.peers.step !== "peers")
        return refuse("ticket_invalid");
      if (!competitorCui || !rivalFromPeers(input.peers, competitorCui))
        return refuse("ticket_invalid");
      break;
    case "synthesis":
    case "finish":
      for (const r of input.results) if (!(await attested(r))) return refuse("ticket_invalid");
      break;
  }

  if (input.step === "finish")
    return engineFinish(deps, { t, uid: args.uid, input, store, startedAt });

  // Run-level claims (fail closed): a used-up step replays its stored result.
  const granted: Array<{ spec: ClaimSpec; claimId: string }> = [];
  const release = async () => {
    for (const g of granted)
      await store
        .settleStep({ runId: t.runId, claimId: g.claimId, used: 0 })
        .catch(() => undefined);
  };
  for (const spec of await claimSpecs(input, competitorCui)) {
    const c = await claim(store, {
      runId: t.runId,
      userId: args.uid,
      key: spec.key,
      max: spec.max,
      exclusive: spec.exclusive,
    });
    if (!c.ok) {
      await release();
      if (c.reason === "replay" && c.result && (await attested(c.result as StepResult)))
        return { kind: "step", result: c.result as StepResult };
      return refuse(CLAIM_REFUSAL[c.reason]);
    }
    granted.push({ spec, claimId: c.claimId });
  }

  // ANAF: the step's quota, within what the run has left (start 1 + money 7 + peers 1).
  const clampNext = (v?: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(Math.max(0, v), startedAt + ANAF_NEXT_MAX_AHEAD_MS)
      : 0;
  let anafQuota = 0;
  let anafClaimId: string | undefined;
  if (input.step === "money" || input.step === "peers") {
    const wanted = input.step === "money" ? ANAF_STEP_QUOTA.money : ANAF_STEP_QUOTA.peers;
    const c = await claim(store, {
      runId: t.runId,
      userId: args.uid,
      key: "anaf",
      max: ANAF_RUN_AFTER_START,
      units: wanted,
      exclusive: false,
    });
    if (c.ok) {
      anafQuota = c.granted;
      anafClaimId = c.claimId;
    } else if (c.reason !== "exhausted") {
      await release();
      return refuse(CLAIM_REFUSAL[c.reason]);
    }
  }

  const part = input.step === "synthesis" ? input.part : undefined;
  let anafStartAt = 0;
  if (input.step === "money") anafStartAt = clampNext(input.anafNextAt);
  if (input.step === "peers")
    anafStartAt = Math.max(input.money.next?.anafNextAt ?? 0, clampNext(input.anafNextAt));
  const env = envFor(deps, t, input.step, { part, anafStartAt, anafQuota, startedAt, store });
  const run = async (): Promise<StepDraft> => {
    switch (input.step) {
      case "money":
        return runMoney(env);
      case "signals":
        return runSignals(env);
      case "site":
        return runSite(env, { candidates: input.candidates, answer: input.answer });
      case "peers":
        return runPeers(env, { money: input.money, edits: input.edits });
      case "audit":
        return runAudit(env, { site: input.site });
      case "pagespeed":
        return runPageSpeed(env, { site: input.site });
      case "crawl":
        return runCrawl(env, { site: input.site, cursor: input.cursor });
      case "competitor":
        return runCompetitor(env, { peers: input.peers, cui: competitorCui });
      case "synthesis":
        return runSynthesis(
          env,
          { part: input.part, results: input.results, corrections: input.corrections },
          deps.reportBuilder,
        );
    }
  };
  // 25 s steps abort at 28 s; exempt ones (pagespeed, synthesis sections) at their 50 s budget + 3 s.
  const budget = stepBudgetMs(input.step, part);
  const hardMs = budget > 25_000 ? budget + 3000 : STEP_HARD_MS;
  let draft: StepDraft | "timeout";
  try {
    draft = await withDeadline(run(), hardMs);
  } catch (error) {
    deps.log?.({ step: input.step, error: String((error as Error)?.message ?? error) });
    draft = {
      status: "failed",
      facts: [],
      gaps: [
        gap(
          STEP_GAP_SECTION[input.step],
          bi("This step", "Acest pas"),
          bi("An unexpected error stopped it", "O eroare neașteptată l-a oprit"),
          isoDay(now()),
        ),
      ],
    };
  }
  if (draft === "timeout") {
    draft = {
      status: "failed",
      facts: [],
      gaps: [
        gap(
          STEP_GAP_SECTION[input.step],
          bi("This step", "Acest pas"),
          bi("It ran out of time", "A rămas fără timp"),
          isoDay(now()),
        ),
      ],
    };
  }
  const counters = { ...(draft.counters ?? {}), ...env.counters() };
  const result = enforceLimits({
    runId: t.runId,
    step: input.step,
    ...(part ? { part } : {}),
    ...draft,
    counters,
    ms: now() - startedAt,
  });
  const sealed = await sealResult(deps.secret, args.uid, result);
  if (anafClaimId)
    await store
      .settleStep({ runId: t.runId, claimId: anafClaimId, used: env.anaf.calls() })
      .catch(() => undefined);
  for (const g of granted) {
    await store
      .settleStep({
        runId: t.runId,
        claimId: g.claimId,
        used: 1,
        result: g.spec.exclusive === false ? undefined : sealed,
      })
      .catch(() => undefined);
  }
  return { kind: "step", result: sealed };
}

/* ------------------------------------------------------------------ finish */

async function engineFinish(
  deps: EngineDeps,
  args: {
    t: TicketPayload;
    uid: string;
    input: Extract<DeepStepInput, { step: "finish" }>;
    store: DeepStore;
    startedAt: number;
  },
): Promise<DeepStepOutput> {
  const { t, input, store } = args;
  const now = deps.now ?? (() => Date.now());
  const refuse = (reason: AccessReason): DeepStepOutput => ({ kind: "refused", reason });
  // Idempotent: a retried finish (a lost response) gets the stored report, unchanged.
  const stored = store.loadReport
    ? await store.loadReport({ runId: t.runId, userId: args.uid }).catch(() => null)
    : null;
  if (stored) return { kind: "report", report: stored.report, reportAtt: stored.reportAtt };
  const c = await claim(store, {
    runId: t.runId,
    userId: args.uid,
    key: "finish",
    max: 3,
  });
  if (!c.ok) return refuse(CLAIM_REFUSAL[c.reason]);
  const env = envFor(deps, t, "finish", { startedAt: args.startedAt, store });
  const finishInput = {
    results: input.results,
    corrections: input.corrections,
    owner: input.owner ?? t.owner,
    aiExpected: t.ai === "ai",
  };
  let done: FinishOutput | "timeout" | "error";
  try {
    done = await withDeadline(runFinish(env, finishInput, deps.reportBuilder), STEP_HARD_MS);
  } catch (error) {
    deps.log?.({ finish: "error", error: String((error as Error)?.message ?? error) });
    done = "error";
  }
  if (done === "timeout" || done === "error") {
    // Never no report: the rules-only report (no AI sentence), marked partial.
    const partial = gap(
      "identity",
      bi("This report", "Acest raport"),
      bi(
        done === "timeout"
          ? "Generated partially: the last step ran out of time"
          : "Generated partially: the last step met an error",
        done === "timeout"
          ? "Raportul a fost generat parțial: ultimul pas a rămas fără timp"
          : "Raportul a fost generat parțial: ultimul pas a întâlnit o eroare",
      ),
      isoDay(now()),
    );
    try {
      done = await runFinish(
        { ...env, llm: null },
        { ...finishInput, extraGaps: [partial], forcePartial: true },
        deps.reportBuilder,
      );
    } catch (error) {
      deps.log?.({ finish: "rules_error", error: String((error as Error)?.message ?? error) });
      done = emergencyReport(env, input.results, partial);
    }
  }
  const spend = store.runSpend ? await store.runSpend(t.runId).catch(() => null) : null;
  const report: DeepReport = {
    ...done.report,
    costUsd:
      t.via === "admin" && spend
        ? Number((spend.spentUsd + spend.reservedUsd).toFixed(4))
        : undefined,
  };
  const reportAtt = await reportAttestation(deps.secret, t.runId, report);
  const verifyCode = verificationCode(reportAtt);
  const final: DeepReport = { ...report, verifyCode };
  await store
    .finish({
      runId: t.runId,
      status: done.status,
      report: final,
      reportAtt,
      verifyCode,
      metrics: done.metrics,
    })
    .catch((error) => deps.log?.({ finish: "ledger_error", error: String(error) }));
  await store.settleStep({ runId: t.runId, claimId: c.claimId, used: 1 }).catch(() => undefined);
  return { kind: "report", report: final, reportAtt };
}

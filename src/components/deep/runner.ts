import {
  DEEP_LIMITS,
  type AccessReason,
  type DeepStepInput,
  type DeepStepOutput,
  type StartDeepRunInput,
  type StartDeepRunOutput,
  type StepResult,
  type SynthesisPart,
} from "@/lib/deep/contracts";

import type { AskSite, RunSnapshot, RunTiming, SlotKey } from "./journal";

/*
 * The browser runner of a deep run (plan A5), without React: the hook in useDeepResearch.ts
 * gives it the server functions, timers, the page's visibility and the visitor's answer to
 * "Acesta e site-ul firmei?". It follows the order of src/lib/deep/steps/pipeline.server.ts:
 *
 *   start → money ‖ site ‖ signals → peers (after money) → audit, crawl ×≤3 and pagespeed
 *   (after site) → competitors ×≤3 (after peers) → synthesis warm → brief ‖ customer ‖
 *   rivals (each given the warm result) → finish (every result but the warm-up).
 *
 * - identity.next.anafNextAt goes to money, money.next.anafNextAt to peers (ANAF pacing).
 * - The crawl continues from audit.next.crawlCursor, then from each batch's, 3 batches at most.
 * - Rivals come from the peers.rival facts, the ones with a website first.
 * - A site answer ("Da", "Nu", "Alt site") calls site again; with no answer when peers ends
 *   the run goes on with the first site result and the crawl becomes the server's gap.
 * - Collection stops after 8 minutes of running time; synthesis then works with what it has.
 * - Rules-only runs (no AI) skip the synthesis calls: finish writes the rules templates.
 * - Sealed crawl cursors are dropped from the results sent to synthesis and finish.
 *
 * Every step is idempotent on the server (run-level claims replay a used-up step), so a retry
 * after a lost response or a hidden tab is safe. Steps already in the snapshot (a resumed run)
 * are not called again.
 */

export type DeepTransport = {
  start(input: StartDeepRunInput): Promise<StartDeepRunOutput>;
  step(input: DeepStepInput): Promise<DeepStepOutput>;
  resume(input: {
    runId: string;
    ticket: string;
  }): Promise<{ ok: true; ticket: string } | { ok: false; reason: AccessReason }>;
};

export type SiteAnswer = { url: string; yes: boolean };

export type RunnerEnv = {
  transport: DeepTransport;
  now: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** A wall-clock timer for the collection deadline (resolves after `ms`, or on abort). */
  timer: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Resolves when the page is visible again (a request that failed while hidden waits). */
  whenVisible?: () => Promise<void>;
  /** True while the page is hidden. */
  hidden?: () => boolean;
  /**
   * The visitor's answer to "Acesta e site-ul firmei?". `until` resolves when the runner
   * stops waiting (peers finished or time ran out); resolve null then.
   */
  askSite: (ask: AskSite, until: Promise<void>) => Promise<SiteAnswer | null>;
  /** Every change of the run (journal and screen). */
  onChange: (snap: RunSnapshot) => void;
  /** Collection budget in running time (default 8 minutes). */
  maxCollectMs?: number;
  /** Stops issuing requests (the page closes); the run stays resumable. */
  signal?: AbortSignal;
};

export const COLLECT_MS = 8 * 60_000;
/** A claim answered "in flight" (a previous request is still running) is retried this long. */
const IN_FLIGHT_WAIT_MS = 150_000;
const IN_FLIGHT_POLL_MS = 5_000;
const NETWORK_RETRIES = 3;
/** Requests stay under the server's 256 KB body limit and 20 results. */
const BODY_BUDGET = DEEP_LIMITS.requestBytes - 8 * 1024;
const RESULTS_MAX = 20;

class RunFatal extends Error {
  constructor(readonly reason: AccessReason) {
    super(reason);
  }
}
class Paused extends Error {}

/** Rival CUIs of a peers result, the ones with a website first (pipeline order). */
export function rivalsOf(peers: StepResult, max: number = DEEP_LIMITS.competitorsMax) {
  return peers.facts
    .filter((f) => f.predicate === "peers.rival")
    .map((f) => f.value as { cui: string; website?: string | null })
    .filter((v) => v && typeof v.cui === "string")
    .sort((a, b) => Number(Boolean(b.website)) - Number(Boolean(a.website)))
    .slice(0, max);
}

/** A result without its sealed cursor (outside the attestation, so droppable). */
export function withoutCursor(result: StepResult): StepResult {
  if (!result.next?.crawlCursor) return result;
  const { crawlCursor: _drop, ...next } = result.next;
  return { ...result, next: Object.keys(next).length ? next : undefined };
}

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** Least important results go first when a request would be too large. */
const DROP_ORDER: Array<(slot: SlotKey) => boolean> = [
  (s) => s === "crawl3",
  (s) => s === "crawl2",
  (s) => s.startsWith("competitor:"),
  (s) => s === "pagespeed",
  (s) => s === "crawl1",
];

/**
 * The results a synthesis or finish request carries: arrival order, no cursors, at most 20,
 * under the body budget. Returns what was left out (shown in the admin panel).
 */
export function resultsForRequest(
  snap: Pick<RunSnapshot, "order" | "results">,
  include: (slot: SlotKey, r: StepResult) => boolean,
  extra: Record<string, unknown> = {},
): { results: StepResult[]; dropped: SlotKey[] } {
  let slots = snap.order.filter((slot) => snap.results[slot] && include(slot, snap.results[slot]));
  const dropped: SlotKey[] = [];
  const build = () => slots.map((slot) => withoutCursor(snap.results[slot]));
  const fits = () =>
    slots.length <= RESULTS_MAX && bytes({ ...extra, results: build() }) <= BODY_BUDGET;
  for (const test of DROP_ORDER) {
    while (!fits()) {
      const victim = slots.find(test);
      if (!victim) break;
      slots = slots.filter((s) => s !== victim);
      dropped.push(victim);
    }
  }
  while (slots.length > RESULTS_MAX) dropped.push(slots.pop()!);
  return { results: build(), dropped };
}

/** A fresh snapshot from a successful start. */
export function snapshotFromStart(
  started: Extract<StartDeepRunOutput, { ok: true }>,
  input: StartDeepRunInput,
  uid: string,
  now: number,
): RunSnapshot {
  const name =
    started.identity.facts.find((f) => f.id === "identity.name")?.display[input.lang] || input.cui;
  return {
    v: 1,
    runId: started.runId,
    uid,
    cui: input.cui.replace(/\D/g, ""),
    name,
    relationship: input.relationship,
    lang: input.lang,
    aiMode: started.aiMode,
    store: started.store,
    ticket: started.ticket,
    createdAt: now,
    updatedAt: now,
    activeMs: started.identity.ms ?? 0,
    results: { start: started.identity },
    order: ["start"],
    slots: { start: { status: "done", ms: started.identity.ms, at: now } },
    status: "running",
    corrections: input.corrections ?? [],
    owner: input.owner,
    rivalEdits: { removed: [], added: [] },
    timings: [timingOf("start", started.identity)],
  };
}

function timingOf(slot: SlotKey, r: StepResult): RunTiming {
  return {
    slot,
    status: r.status,
    ms: r.ms,
    anafCalls: r.counters?.anafCalls,
    subrequests: r.counters?.subrequests,
    pagesRead: r.counters?.pagesRead,
    spentUsd: r.spentUsd,
  };
}

/** Runs with a pending continueRun in this tab (React may mount an effect twice). */
const active = new Map<string, Promise<RunSnapshot>>();

/** True while this tab drives the run. */
export const isRunActive = (runId: string) => active.has(runId);

/**
 * Continues a run from its snapshot until the report (status "done"), a refusal that ends
 * it (status "failed") or a pause (the signal aborted; status stays "running").
 */
export function continueRun(env: RunnerEnv, initial: RunSnapshot): Promise<RunSnapshot> {
  const pending = active.get(initial.runId);
  if (pending) return pending;
  const job = drive(env, initial).finally(() => active.delete(initial.runId));
  active.set(initial.runId, job);
  return job;
}

async function drive(env: RunnerEnv, initial: RunSnapshot): Promise<RunSnapshot> {
  const snap: RunSnapshot = {
    ...initial,
    results: { ...initial.results },
    order: [...initial.order],
    // Steps left "running" by a closed tab start again.
    slots: Object.fromEntries(
      Object.entries(initial.slots).filter(([, s]) => s.status !== "running"),
    ),
    timings: [...initial.timings],
  };
  if (snap.status !== "running") return snap;
  let tick = env.now();
  let stopped = false;
  const emit = () => {
    const t = env.now();
    snap.activeMs += Math.max(0, t - tick);
    tick = t;
    snap.updatedAt = t;
    env.onChange({
      ...snap,
      results: { ...snap.results },
      order: [...snap.order],
      slots: { ...snap.slots },
      timings: [...snap.timings],
    });
  };
  const aborted = () => stopped || Boolean(env.signal?.aborted);
  const mark = (slot: SlotKey, state: RunSnapshot["slots"][string]) => {
    snap.slots[slot] = state;
    emit();
  };

  const renew = async () => {
    const out = await env.transport.resume({ runId: snap.runId, ticket: snap.ticket });
    if (!out.ok) throw new RunFatal(out.reason);
    snap.ticket = out.ticket;
    emit();
  };

  /** One server call with the retry rules; returns the output or throws RunFatal / Paused. */
  const request = async (
    build: (ticket: string) => DeepStepInput,
    deadline: () => boolean,
  ): Promise<DeepStepOutput | null> => {
    let networkTries = 0;
    let inFlightSince = 0;
    for (;;) {
      if (aborted()) throw new Paused();
      let out: DeepStepOutput;
      try {
        out = await env.transport.step(build(snap.ticket));
      } catch (error) {
        if (aborted()) throw new Paused();
        // A request cut while the tab was hidden waits for the page, then retries.
        if (env.hidden?.() && env.whenVisible) {
          await env.whenVisible();
          continue;
        }
        if (++networkTries > NETWORK_RETRIES) {
          void error;
          return null;
        }
        await env.sleep(1500 * networkTries, env.signal);
        continue;
      }
      if (out.kind !== "refused") return out;
      switch (out.reason) {
        case "ticket_expired":
          await renew();
          continue;
        case "already_running": {
          // The same step is still running from an earlier request: wait for its result.
          inFlightSince ||= env.now();
          if (env.now() - inFlightSince > IN_FLIGHT_WAIT_MS || deadline()) return out;
          await env.sleep(IN_FLIGHT_POLL_MS, env.signal);
          continue;
        }
        case "budget_exhausted":
          return out;
        default:
          throw new RunFatal(out.reason);
      }
    }
  };

  const remaining = () => (env.maxCollectMs ?? COLLECT_MS) - snap.activeMs;
  /** Set when collection ends: branches still running then start no new collection step. */
  let collectionClosed = false;
  const pastDeadline = () => collectionClosed || remaining() <= 0;

  const record = (slot: SlotKey, result: StepResult, ms: number) => {
    snap.results[slot] = result;
    if (!snap.order.includes(slot)) snap.order.push(slot);
    snap.timings = [...snap.timings.filter((t) => t.slot !== slot), timingOf(slot, result)];
    mark(slot, { status: result.status, ms: result.ms ?? ms, at: env.now() });
  };

  /** A collection step: once per slot, skipped after the deadline. */
  const step = async (
    slot: SlotKey,
    build: (ticket: string) => DeepStepInput,
  ): Promise<StepResult | null> => {
    const known = snap.results[slot];
    if (known) return known;
    if (aborted()) throw new Paused();
    if (pastDeadline()) {
      mark(slot, { status: "skipped", reason: "time", at: env.now() });
      return null;
    }
    const t0 = env.now();
    mark(slot, { status: "running", at: t0 });
    const out = await request(build, pastDeadline);
    if (out?.kind === "step") {
      // A result that arrives after collection stopped is kept (it is attested and useful).
      record(slot, out.result, env.now() - t0);
      return out.result;
    }
    mark(slot, {
      status: out ? "skipped" : "failed",
      reason: out?.kind === "refused" ? out.reason : undefined,
      ms: env.now() - t0,
      at: env.now(),
    });
    return null;
  };

  const deadlineTimer = new AbortController();
  env.signal?.addEventListener("abort", () => deadlineTimer.abort(), { once: true });
  try {
    const identity = snap.results.start;
    if (!identity) throw new RunFatal("run_not_found");

    // ---- collection (8 minutes of running time at most)
    const deadlineReached = env.timer(Math.max(0, remaining()), deadlineTimer.signal);

    let peersFinished: () => void = () => undefined;
    const peersDone = new Promise<void>((resolve) => {
      peersFinished = resolve;
    });

    const moneyP = step("money", (ticket) => ({
      ticket,
      step: "money",
      anafNextAt: identity.next?.anafNextAt,
    }));
    moneyP.catch(() => undefined);
    const signalsP = step("signals", (ticket) => ({ ticket, step: "signals" }));

    const siteFlow = (async () => {
      let site = await step("site", (ticket) => ({ ticket, step: "site" }));
      const ask = site?.next?.askSite;
      if (site && ask) {
        let answer = snap.askSite?.url === ask.url ? snap.askSite.answer : undefined;
        if (!answer) {
          snap.askSite = { url: ask.url, reason: ask.reason };
          emit();
          const given = await env.askSite(
            snap.askSite,
            Promise.race([peersDone, deadlineReached.then(() => undefined)]),
          );
          answer = given ?? "none";
          snap.askSite = { ...snap.askSite, answer };
          emit();
        }
        if (answer !== "none") {
          const chosen = answer;
          const second = await step("site2", (ticket) => ({
            ticket,
            step: "site",
            answer: chosen,
          }));
          if (second) site = second;
        }
      }
      if (!site) return;
      const siteResult = site;
      const pagespeedP = step("pagespeed", (ticket) => ({
        ticket,
        step: "pagespeed",
        site: siteResult,
      }));
      // Awaited below; marked handled so a pause in the audit branch is not an unhandled rejection.
      pagespeedP.catch(() => undefined);
      const audit = await step("audit", (ticket) => ({ ticket, step: "audit", site: siteResult }));
      let cursor = audit?.next?.crawlCursor;
      for (let batch = 1; cursor && batch <= DEEP_LIMITS.crawlBatchesMax; batch++) {
        const sealed: string = cursor;
        const crawl = await step(`crawl${batch}`, (ticket) => ({
          ticket,
          step: "crawl",
          site: siteResult,
          cursor: sealed,
        }));
        cursor = crawl?.next?.crawlCursor;
      }
      await pagespeedP;
    })();

    const peersFlow = (async () => {
      try {
        const money = await moneyP;
        if (!money) return;
        const peers = await step("peers", (ticket) => ({
          ticket,
          step: "peers",
          money,
          anafNextAt: money.next?.anafNextAt,
        }));
        if (!peers) return;
        peersFinished();
        await Promise.all(
          rivalsOf(peers).map((rival) =>
            step(`competitor:${rival.cui}`, (ticket) => ({
              ticket,
              step: "competitor",
              peers,
              cui: rival.cui,
            })),
          ),
        );
      } finally {
        peersFinished();
      }
    })();

    const collected = Promise.all([signalsP, siteFlow, peersFlow]);
    // A refusal that ends the run surfaces even when the deadline wins the race.
    let fatal: unknown = null;
    collected.catch((error) => {
      fatal = error;
    });
    await Promise.race([collected, deadlineReached]);
    collectionClosed = true;
    deadlineTimer.abort();
    if (fatal) throw fatal;
    // Steps still running when time ran out are shown as skipped.
    for (const [slot, state] of Object.entries(snap.slots)) {
      if (state.status === "running" && !snap.results[slot])
        snap.slots[slot] = { status: "skipped", reason: "time", at: env.now() };
    }
    emit();

    // ---- synthesis (AI runs only)
    const notSynthesis = (_slot: SlotKey, r: StepResult) => r.step !== "synthesis";
    if (snap.aiMode === "ai") {
      const warm = await synthesis("warm", resultsForRequest(snap, notSynthesis).results);
      const sections = resultsForRequest(
        snap,
        (slot, r) => r.step !== "synthesis" || slot === "warm",
      );
      if (warm && !sections.results.some((r) => r.part === "warm"))
        sections.results.push(withoutCursor(warm));
      await Promise.all(
        (["brief", "customer", "rivals"] as const).map((part) => synthesis(part, sections.results)),
      );
    }

    // ---- finish
    const extra = { corrections: snap.corrections, owner: snap.owner };
    const finishInput = resultsForRequest(
      snap,
      (_slot, r) => !(r.step === "synthesis" && r.part === "warm"),
      extra,
    );
    const t0 = env.now();
    mark("finish", { status: "running", at: t0 });
    const out = await request(
      (ticket) => ({
        ticket,
        step: "finish",
        results: finishInput.results,
        ...(snap.corrections.length ? { corrections: snap.corrections } : {}),
        ...(snap.owner ? { owner: snap.owner } : {}),
      }),
      () => false,
    );
    if (out?.kind !== "report") {
      throw new RunFatal(out?.kind === "refused" ? out.reason : "ledger_unavailable");
    }
    snap.report = out.report;
    snap.reportAtt = out.reportAtt;
    snap.status = "done";
    snap.timings = [
      ...snap.timings.filter((t) => t.slot !== "finish"),
      { slot: "finish", status: out.report.aiMode, ms: env.now() - t0 },
      ...finishInput.dropped.map((slot) => ({ slot, status: "dropped", ms: 0 })),
    ];
    mark("finish", { status: "done", ms: env.now() - t0, at: env.now() });
    return snap;
  } catch (error) {
    stopped = true;
    deadlineTimer.abort();
    if (error instanceof Paused) {
      emit();
      return snap;
    }
    snap.status = "failed";
    snap.failure = error instanceof RunFatal ? error.reason : "ledger_unavailable";
    emit();
    return snap;
  }

  async function synthesis(part: SynthesisPart, results: StepResult[]) {
    const slot = part;
    const known = snap.results[slot];
    if (known) return known;
    const t0 = env.now();
    mark(slot, { status: "running", at: t0 });
    const out = await request(
      (ticket) => ({ ticket, step: "synthesis", part, results }),
      () => false,
    );
    if (out?.kind === "step") {
      record(slot, out.result, env.now() - t0);
      return out.result;
    }
    mark(slot, { status: "failed", ms: env.now() - t0, at: env.now() });
    return null;
  }
}

/** Starts a run; a refusal comes back with its reason (and the report to replay, if any). */
export async function startRun(
  transport: DeepTransport,
  input: StartDeepRunInput,
  uid: string,
  now: () => number,
): Promise<
  { ok: true; snap: RunSnapshot } | { ok: false; reason: AccessReason; replayRunId?: string }
> {
  let out: StartDeepRunOutput;
  try {
    out = await transport.start(input);
  } catch {
    return { ok: false, reason: "ledger_unavailable" };
  }
  if (!out.ok) return { ok: false, reason: out.reason, replayRunId: out.replayRunId };
  return { ok: true, snap: snapshotFromStart(out, input, uid, now()) };
}

import type {
  AccessReason,
  AccessVia,
  ConsentRecord,
  DeepReport,
  DeepStore,
  Lang,
  Relationship,
  ReserveResult,
  RunStatus,
  StepClaim,
  StepName,
  Usage,
} from "./contracts";
import { bucharestDayStart } from "./llm/ledger-memory.server";
import {
  backoffMs,
  DAY_MS,
  dayStartIso,
  FEEDBACK_DAILY,
  insertCallRequest,
  type DeepDb,
} from "./persist-db.server";

/*
 * The stopgap store (plan A6 "Without new tables"): the deep-research ledger
 * kept in rows of public.audit_leads, so a run, its paid calls and its step
 * claims are shared by every Worker isolate before the SQL file is applied.
 *
 * THESE ROWS ARE NEVER LEADS. They carry fixed placeholder e-mails
 * ("deep-run@invalid", "deep-step@invalid", "deep-breaker@invalid",
 * "deep-feedback@invalid"; the user's e-mail is never written in them) and
 * recommendation values that start with "deep-" so the lead list can leave
 * them out. The only real lead here is a call request ("deep-call-request"),
 * which the person asks for.
 *
 * - One run row (recommendation "deep-run:v1", row id = run ID). Reserve,
 *   settle, finish and step claims rewrite its `answers` behind a
 *   compare-and-swap on `answers->>rev`, with jittered backoff and up to 5
 *   tries; a failed write means no paid call and no step (fail closed).
 * - Caps by insert-then-count: the run row is inserted, today's rows up to and
 *   including it are counted, and the row is canceled and the run refused when
 *   over a cap. The day's spend is the sum of today's runs, read at every
 *   reservation; two reservations racing can both pass (at most one
 *   reservation of overshoot per concurrent run, ≈ $0.40). The tables make it
 *   exact.
 * - Step results for replay live in their own rows ("deep-step:v1"), so the
 *   run row stays small; they are purged after 2 days.
 * - Retention, at most once an hour per isolate: runs and the breaker after 90
 *   days, feedback after 12 months.
 */

export const STOPGAP = {
  run: "deep-run:v1",
  step: "deep-step:v1",
  breaker: "deep-breaker",
  feedback: "deep-feedback:v1",
  callRequest: "deep-call-request",
} as const;

/**
 * When retention last ran, per database client: the client is created once per
 * isolate (persist-db.server.ts), so this is "at most once an hour per isolate"
 * however many store objects the requests create.
 */
const lastPurge = new WeakMap<object, number>();

const RESULT_MAX_BYTES = 65_536;

type StopgapCall = {
  attempt: number;
  reserved: number;
  at: number;
  settled: boolean;
  usd: number;
  step: StepName;
  model?: string;
  usage?: Usage;
  result?: unknown;
};

export type StopgapRun = {
  source: "vortex-deep";
  v: 1;
  runId: string;
  userId: string;
  cui: string;
  companyName?: string;
  relationship: Relationship;
  lang: Lang;
  via: AccessVia;
  aiMode: "ai" | "rules";
  budgetUsd: number;
  reservedUsd: number;
  spentUsd: number;
  rev: number;
  status: RunStatus;
  createdAt: number;
  lastActivityAt: number;
  consent: ConsentRecord;
  /** Paid calls by idempotency key (the latest attempt). */
  calls: Record<string, StopgapCall>;
  /** Run-level step claims: units used per key, the unsettled exclusive claim, replay available. */
  steps: Record<string, { used: number; inFlightAt?: number; hasResult?: boolean }>;
  claims: Record<string, { key: string; units: number; exclusive: boolean }>;
  claimSeq: number;
  report?: DeepReport;
  reportAtt?: string;
  verifyCode?: string;
  metrics?: Record<string, unknown>;
  error?: string;
  finishedAt?: number;
};

type Row = { id: string; created_at: string; answers: StopgapRun };

/**
 * The fields the listings read (caps, day spend, active runs): PostgREST returns only
 * these, never the stored report, consent texts or replayed results of every run today.
 */
const LITE_COLUMNS =
  "id, created_at, recommendation, source:answers->>source, userId:answers->>userId, " +
  "cui:answers->>cui, via:answers->>via, status:answers->>status, " +
  "spentUsd:answers->spentUsd, reservedUsd:answers->reservedUsd, " +
  "createdAt:answers->createdAt, lastActivityAt:answers->lastActivityAt, until:answers->>until";

type LiteRow = Row & { recommendation?: string; lite?: true };

/** A listing row as a Row: the flat aliases above, or a full row (test fakes ignore columns). */
function liteRow(raw: Record<string, unknown>): LiteRow {
  if (raw.answers && typeof raw.answers === "object") return raw as unknown as LiteRow;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  return {
    id: String(raw.id),
    created_at: String(raw.created_at ?? ""),
    recommendation: raw.recommendation as string | undefined,
    lite: true,
    answers: {
      source: raw.source,
      userId: raw.userId,
      cui: raw.cui,
      via: raw.via,
      status: raw.status,
      spentUsd: num(raw.spentUsd),
      reservedUsd: num(raw.reservedUsd),
      createdAt: num(raw.createdAt),
      lastActivityAt: num(raw.lastActivityAt),
      until: raw.until,
    } as unknown as StopgapRun,
  };
}

const sizeOf = (value: unknown) => {
  try {
    return new TextEncoder().encode(JSON.stringify(value ?? null)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

export type StopgapOptions = {
  now?: () => number;
  newId?: () => string;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export type StopgapStore = DeepStore & {
  freeRunsUsed(userId: string): Promise<number>;
  breakerOpen(): Promise<boolean>;
};

export function createStopgapStore(db: DeepDb, opts: StopgapOptions = {}): StopgapStore {
  const now = opts.now ?? (() => Date.now());
  const newId = opts.newId ?? (() => globalThis.crypto.randomUUID());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;

  const leads = () => db.from("audit_leads");

  async function readRun(runId: string): Promise<Row | null | "error"> {
    const { data, error } = await leads()
      .select("id, created_at, answers")
      .eq("id", runId)
      .eq("recommendation", STOPGAP.run)
      .maybeSingle();
    if (error) return "error";
    const row = data as Row | null;
    return row && row.answers?.source === "vortex-deep" ? row : null;
  }

  /** Runs created since `sinceMs` (all accounts), oldest first. */
  async function runsSince(sinceMs: number): Promise<Row[]> {
    const { data, error } = await leads()
      .select(LITE_COLUMNS)
      .eq("recommendation", STOPGAP.run)
      .gte("created_at", new Date(sinceMs).toISOString())
      .order("created_at", { ascending: true })
      .limit(1000);
    if (error) throw new Error(`deep_stopgap.runs: ${error.message ?? error.code}`);
    return ((data as unknown as Array<Record<string, unknown>> | null) ?? [])
      .map(liteRow)
      .filter((r) => r.answers?.source === "vortex-deep");
  }

  /**
   * Read, change and write a run row behind a compare-and-swap on its `rev`.
   * `change` edits a copy and returns { write, value }; nothing is written when
   * `write` is false. "conflict" after 5 tries; "error" on any database error.
   */
  async function mutate<T>(
    runId: string,
    change: (run: StopgapRun) => { write: boolean; value: T },
    /** A fresh copy of the row read just before (saves one request on the first try). */
    seed?: Row,
  ): Promise<T | "missing" | "conflict" | "error"> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const row = attempt === 0 && seed ? seed : await readRun(runId);
      if (row === "error") return "error";
      if (!row) return "missing";
      const copy = JSON.parse(JSON.stringify(row.answers)) as StopgapRun;
      const rev = copy.rev;
      const out = change(copy);
      if (!out.write) return out.value;
      copy.rev = rev + 1;
      const { data, error } = await leads()
        .update({ answers: copy })
        .eq("id", runId)
        .eq("recommendation", STOPGAP.run)
        .eq("answers->>rev", String(rev))
        .select("id");
      if (error) return "error";
      if (Array.isArray(data) && data.length === 1) return out.value;
      await sleep(backoffMs(attempt, random));
    }
    return "conflict";
  }

  /**
   * Today's runs and the recent breaker rows in one request (a paid call's
   * reservation needs both; Workers count every subrequest).
   */
  async function ledgerSnapshot(t: number): Promise<{ today: Row[]; breakerUntil: number }> {
    const dayStart = bucharestDayStart(t);
    const since = Math.min(dayStart, t - 60 * 60_000);
    const { data, error } = await leads()
      .select(LITE_COLUMNS)
      .in("recommendation", [STOPGAP.run, STOPGAP.breaker])
      .gte("created_at", new Date(since).toISOString())
      .order("created_at", { ascending: true })
      .limit(1000);
    if (error) throw new Error(`deep_stopgap.snapshot: ${error.message ?? error.code}`);
    const rows = ((data as unknown as Array<Record<string, unknown>> | null) ?? []).map(liteRow);
    const today = rows.filter(
      (r) =>
        r.recommendation === STOPGAP.run &&
        r.answers?.source === "vortex-deep" &&
        time(r) >= dayStart,
    );
    const until = Math.max(
      0,
      ...rows
        .filter((r) => r.recommendation === STOPGAP.breaker)
        .map(
          (r) => Date.parse(String((r.answers as unknown as { until?: string })?.until ?? "")) || 0,
        ),
    );
    return { today, breakerUntil: until };
  }

  async function breakerUntil(): Promise<number> {
    const { data, error } = await leads()
      .select("answers, created_at")
      .eq("recommendation", STOPGAP.breaker)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(`deep_stopgap.breaker: ${error.message ?? error.code}`);
    return Math.max(
      0,
      ...((data as Array<{ answers: { until?: string } }> | null) ?? []).map(
        (r) => Date.parse(String(r.answers?.until ?? "")) || 0,
      ),
    );
  }

  async function cancel(runId: string) {
    await mutate(runId, (run) => {
      if (run.status !== "running") return { write: false, value: null };
      run.status = "canceled";
      run.lastActivityAt = now();
      return { write: true, value: null };
    });
  }

  const time = (row: Row) => Date.parse(row.created_at) || row.answers.createdAt;
  const active = (r: StopgapRun, t: number) =>
    r.status === "running" && Math.max(r.createdAt, r.lastActivityAt) > t - 10 * 60_000;

  async function stepResult(runId: string, key: string): Promise<unknown | null | "error"> {
    const { data, error } = await leads()
      .select("answers, created_at")
      .eq("recommendation", STOPGAP.step)
      .eq("answers->>runId", runId)
      .eq("answers->>key", key)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) return "error";
    const row = (data as Array<{ answers: { result?: unknown } }> | null)?.[0];
    return row?.answers?.result ?? null;
  }

  const store: StopgapStore = {
    kind: "stopgap",

    async startRun(input) {
      await store.purgeIfDue().catch(() => undefined);
      const t = now();
      const dayStart = bucharestDayStart(t);
      const since = Math.min(dayStart, t - DAY_MS);
      const before = await runsSince(since);
      const mineBefore = before.filter((r) => r.answers.userId === input.userId);
      if (mineBefore.some((r) => active(r.answers, t)))
        return { reason: "already_running" as AccessReason };
      if (!input.allowSameCompany) {
        const prev = mineBefore
          .filter(
            (r) =>
              time(r) >= dayStart &&
              r.answers.cui === input.cui &&
              (r.answers.status === "succeeded" || r.answers.status === "partial"),
          )
          .pop();
        if (prev) return { reason: "same_company_today" as AccessReason, replayRunId: prev.id };
      }
      const runId = newId();
      const answers: StopgapRun = {
        source: "vortex-deep",
        v: 1,
        runId,
        userId: input.userId,
        cui: input.cui,
        companyName: input.companyName?.slice(0, 200),
        relationship: input.relationship,
        lang: input.lang,
        via: input.via,
        aiMode: input.aiMode,
        budgetUsd: input.budgetUsd,
        reservedUsd: 0,
        spentUsd: 0,
        rev: 0,
        status: "running",
        createdAt: t,
        lastActivityAt: t,
        consent: input.consent,
        calls: {},
        steps: {},
        claims: {},
        claimSeq: 0,
      };
      const inserted = await leads()
        .insert({
          id: runId,
          // Never a lead: placeholder e-mail, the user's e-mail is never written here.
          email: "deep-run@invalid",
          full_name: null,
          company: null,
          language: input.lang,
          score: 0,
          recommended_tier: null,
          recommendation: STOPGAP.run,
          answers,
        })
        .select("id, created_at")
        .single();
      if (inserted.error)
        throw new Error(`deep_stopgap.insert: ${inserted.error.message ?? inserted.error.code}`);
      const mineAt = Date.parse((inserted.data as { created_at: string }).created_at) || t;
      // Insert-then-count: every run inserted up to and including this one counts.
      let after: Row[];
      try {
        after = await runsSince(since);
      } catch (error) {
        await cancel(runId);
        throw error;
      }
      const upTo = after.filter((r) => r.id === runId || time(r) <= mineAt);
      const today = upTo.filter((r) => time(r) >= dayStart && r.answers.status !== "canceled");
      const refuse = async (reason: AccessReason) => {
        await cancel(runId);
        return { reason };
      };
      if (
        upTo.some(
          (r) => r.id !== runId && r.answers.userId === input.userId && active(r.answers, t),
        )
      )
        return refuse("already_running");
      if (today.filter((r) => r.answers.userId === input.userId).length > input.userCap)
        return refuse("daily_cap_user");
      if (
        input.via !== "admin" &&
        today.filter((r) => r.answers.via !== "admin").length > input.globalCap
      )
        return refuse("daily_cap_global");
      return { runId };
    },

    async getRun(runId, userId) {
      const row = await readRun(runId);
      if (row === "error") throw new Error("deep_stopgap.get_run");
      if (!row || row.answers.userId !== userId) return null;
      return {
        status: row.answers.status,
        createdAt: new Date(row.answers.createdAt).toISOString(),
        lastActivityAt: new Date(row.answers.lastActivityAt).toISOString(),
        cui: row.answers.cui,
        via: row.answers.via,
      };
    },

    async dayStats(userId) {
      const rows = await runsSince(bucharestDayStart(now()));
      const live = rows.filter((r) => r.answers.status !== "canceled");
      return {
        userRuns: live.filter((r) => r.answers.userId === userId).length,
        allRuns: live.filter((r) => r.answers.via !== "admin").length,
        allUsd: rows.reduce(
          (n, r) => n + (r.answers.spentUsd || 0) + (r.answers.reservedUsd || 0),
          0,
        ),
      };
    },

    async reserve(input): Promise<ReserveResult> {
      let until: number;
      let today: Row[];
      try {
        ({ today, breakerUntil: until } = await ledgerSnapshot(now()));
      } catch {
        return { ok: false, reason: "ledger_error" };
      }
      // A full row from the listing seeds the first compare-and-swap; a lite one is read again.
      const found = today.find((r) => r.id === input.runId) as LiteRow | undefined;
      const seed = found && !found.lite ? found : undefined;
      const others = today
        .filter((r) => r.id !== input.runId)
        .reduce((n, r) => n + (r.answers.spentUsd || 0) + (r.answers.reservedUsd || 0), 0);
      const out = await mutate<ReserveResult>(
        input.runId,
        (run) => {
          const t = now();
          if (run.status !== "running")
            return { write: false, value: { ok: false, reason: "run_closed" } };
          const last = run.calls[input.idemKey];
          if (last) {
            if (last.settled && last.result !== undefined && last.result !== null)
              return { write: false, value: { ok: false, reason: "replay", result: last.result } };
            if (!last.settled && last.at > t - 2 * 60_000)
              return { write: false, value: { ok: false, reason: "in_flight" } };
            if (last.attempt >= 5)
              return { write: false, value: { ok: false, reason: "attempts" } };
          }
          if (until > t) return { write: false, value: { ok: false, reason: "breaker" } };
          if (!(input.usd > 0) || run.spentUsd + run.reservedUsd + input.usd > run.budgetUsd + 1e-9)
            return { write: false, value: { ok: false, reason: "run_budget" } };
          // Today's spend counts this run only if it was created today (as in deep_reserve).
          const mine = run.createdAt >= bucharestDayStart(t) ? run.spentUsd + run.reservedUsd : 0;
          if (others + mine + input.usd > input.dayCapUsd + 1e-9)
            return { write: false, value: { ok: false, reason: "day_budget" } };
          const attempt = (last?.attempt ?? 0) + 1;
          run.reservedUsd += input.usd;
          run.lastActivityAt = t;
          run.calls[input.idemKey] = {
            attempt,
            reserved: input.usd,
            at: t,
            settled: false,
            usd: 0,
            step: input.step,
            model: input.model,
          };
          return {
            write: true,
            value: { ok: true, callId: `${input.runId}|${attempt}|${input.idemKey}` },
          };
        },
        seed,
      );
      if (out === "missing") return { ok: false, reason: "run_not_found" };
      if (out === "conflict" || out === "error") return { ok: false, reason: "ledger_error" };
      return out;
    },

    async settle(input) {
      const first = input.callId.indexOf("|");
      const second = input.callId.indexOf("|", first + 1);
      if (first < 0 || second < 0) return;
      const runId = input.callId.slice(0, first);
      const attempt = Number(input.callId.slice(first + 1, second));
      const idemKey = input.callId.slice(second + 1);
      const out = await mutate(runId, (run) => {
        const c = run.calls[idemKey];
        if (!c || c.attempt !== attempt || c.settled) return { write: false, value: null };
        c.settled = true;
        c.usd = Math.max(input.usd, 0);
        c.usage = input.usage;
        if (input.result !== undefined && sizeOf(input.result) <= RESULT_MAX_BYTES)
          c.result = input.result;
        run.reservedUsd = Math.max(run.reservedUsd - c.reserved, 0);
        run.spentUsd += c.usd;
        run.lastActivityAt = now();
        return { write: true, value: null };
      });
      if (out === "conflict" || out === "error") throw new Error(`deep_stopgap.settle: ${out}`);
    },

    async finish(input) {
      const out = await mutate(input.runId, (run) => {
        if (run.status !== "running") return { write: false, value: null };
        for (const c of Object.values(run.calls)) {
          if (!c.settled) {
            c.settled = true;
            c.usd = c.reserved;
          }
        }
        run.spentUsd += run.reservedUsd;
        run.reservedUsd = 0;
        run.status = input.status;
        run.report = input.report;
        run.reportAtt = input.reportAtt;
        run.verifyCode = input.verifyCode;
        run.metrics = input.metrics;
        run.error = input.error?.slice(0, 2000);
        run.finishedAt = now();
        run.lastActivityAt = now();
        return { write: true, value: null };
      });
      if (out === "conflict" || out === "error") throw new Error(`deep_stopgap.finish: ${out}`);
    },

    async tripBreaker(minutes, reason) {
      const { error } = await leads().insert({
        email: "deep-breaker@invalid",
        full_name: null,
        company: null,
        language: "ro",
        score: 0,
        recommended_tier: null,
        recommendation: STOPGAP.breaker,
        answers: {
          source: "vortex-deep",
          until: new Date(now() + Math.max(1, minutes) * 60_000).toISOString(),
          reason: reason.slice(0, 200),
        },
      });
      if (error) throw new Error(`deep_stopgap.breaker_write: ${error.message ?? error.code}`);
    },

    async loadReport(q) {
      if ("verifyCode" in q) {
        const { data, error } = await leads()
          .select("answers")
          .eq("recommendation", STOPGAP.run)
          .eq("answers->>verifyCode", q.verifyCode)
          .limit(1);
        if (error) throw new Error("deep_stopgap.verify");
        const run = (data as Array<{ answers: StopgapRun }> | null)?.[0]?.answers;
        return run?.report && run.reportAtt
          ? { report: run.report, reportAtt: run.reportAtt }
          : null;
      }
      const row = await readRun(q.runId);
      if (row === "error") throw new Error("deep_stopgap.load_report");
      if (!row || row.answers.userId !== q.userId) return null;
      return row.answers.report && row.answers.reportAtt
        ? { report: row.answers.report, reportAtt: row.answers.reportAtt }
        : null;
    },

    async feedback(row) {
      const limit =
        row.kind === "error_report" ? FEEDBACK_DAILY.error_report : FEEDBACK_DAILY.other;
      const counted = await leads()
        .select("id", { count: "exact", head: true })
        .eq("recommendation", STOPGAP.feedback)
        .eq("answers->>userId", row.userId)
        .gte("created_at", dayStartIso(now()));
      if (counted.error) throw new Error("deep_stopgap.feedback_count");
      if ((counted.count ?? 0) >= limit) throw new Error("feedback_limit");
      const { error } = await leads().insert({
        // Never a lead: placeholder e-mail; the user is identified by account ID only.
        email: "deep-feedback@invalid",
        full_name: null,
        company: null,
        language: "ro",
        score: 0,
        recommended_tier: null,
        recommendation: STOPGAP.feedback,
        answers: {
          source: "vortex-deep",
          v: 1,
          runId: row.runId,
          userId: row.userId,
          kind: row.kind,
          factId: row.factId?.slice(0, 120),
          message: row.message?.slice(0, 1000),
          value: sizeOf(row.value) <= 4096 ? (row.value ?? null) : null,
          at: new Date(now()).toISOString(),
        },
      });
      if (error) throw new Error(`deep_stopgap.feedback: ${error.message ?? error.code}`);
    },

    async callRequest(row) {
      await insertCallRequest(db, row, now());
    },

    async purgeIfDue() {
      const t = now();
      if (t - (lastPurge.get(db) ?? 0) < 60 * 60_000) return;
      lastPurge.set(db, t);
      const older = (ms: number) => new Date(t - ms).toISOString();
      const purge = async (recommendation: string, ms: number) => {
        const { error } = await leads()
          .delete()
          .eq("recommendation", recommendation)
          .lt("created_at", older(ms));
        if (error) throw new Error(`deep_stopgap.purge: ${error.message ?? error.code}`);
      };
      await purge(STOPGAP.run, 90 * DAY_MS);
      await purge(STOPGAP.breaker, 90 * DAY_MS);
      await purge(STOPGAP.step, 2 * DAY_MS);
      await purge(STOPGAP.feedback, 365 * DAY_MS);
    },

    async claimStep(input): Promise<StepClaim> {
      type Out = StepClaim | { replayFrom: string };
      const out = await mutate<Out>(input.runId, (run) => {
        const t = now();
        if (run.userId !== input.userId)
          return { write: false, value: { ok: false, reason: "run_not_found" } };
        if (run.status !== "running")
          return { write: false, value: { ok: false, reason: "run_closed" } };
        const exclusive = input.exclusive !== false;
        const units = Math.max(1, Math.floor(input.units ?? 1));
        const slot = run.steps[input.key] ?? { used: 0 };
        // An exclusive claim whose step died before settling (tab closed, request cancelled)
        // gives its units back after 2 minutes: the retry runs instead of being "exhausted".
        if (
          exclusive &&
          slot.inFlightAt !== undefined &&
          slot.inFlightAt <= t - 2 * 60_000 &&
          !slot.hasResult
        ) {
          let back = 0;
          for (const [seq, c] of Object.entries(run.claims)) {
            if (c.key !== input.key || !c.exclusive) continue;
            back += c.units;
            delete run.claims[seq];
          }
          slot.used = Math.max(0, slot.used - (back || 1));
          delete slot.inFlightAt;
        }
        const left = input.max - slot.used;
        let granted: number;
        if (exclusive) {
          if (slot.inFlightAt !== undefined && slot.inFlightAt > t - 2 * 60_000)
            return { write: false, value: { ok: false, reason: "in_flight" } };
          if (units > left)
            return {
              write: false,
              value: slot.hasResult
                ? { replayFrom: input.key }
                : { ok: false, reason: "exhausted" },
            };
          granted = units;
          slot.inFlightAt = t;
        } else {
          granted = Math.min(units, left);
          if (granted < 1) return { write: false, value: { ok: false, reason: "exhausted" } };
        }
        slot.used += granted;
        run.steps[input.key] = slot;
        run.claimSeq = (run.claimSeq ?? 0) + 1;
        run.claims[String(run.claimSeq)] = { key: input.key, units: granted, exclusive };
        run.lastActivityAt = t;
        // The claim ID carries the key, so settling it needs no extra read.
        return {
          write: true,
          value: { ok: true, claimId: `${input.runId}|${run.claimSeq}|${input.key}`, granted },
        };
      });
      if (out === "missing") return { ok: false, reason: "run_not_found" };
      if (out === "conflict" || out === "error") return { ok: false, reason: "ledger_error" };
      if ("replayFrom" in out) {
        const result = await stepResult(input.runId, out.replayFrom);
        if (result === "error") return { ok: false, reason: "ledger_error" };
        return result === null
          ? { ok: false, reason: "exhausted" }
          : { ok: false, reason: "replay", result };
      }
      return out;
    },

    async settleStep(input) {
      const [, seq = "", ...keyParts] = input.claimId.split("|");
      const claimKey = keyParts.join("|");
      let keyForResult: string | undefined;
      if (input.result !== undefined) {
        keyForResult = claimKey || undefined;
        if (keyForResult && sizeOf(input.result) <= 131_072) {
          const { error } = await leads().insert({
            email: "deep-step@invalid",
            full_name: null,
            company: null,
            language: "ro",
            score: 0,
            recommended_tier: null,
            recommendation: STOPGAP.step,
            answers: {
              source: "vortex-deep",
              runId: input.runId,
              key: keyForResult,
              result: input.result,
            },
          });
          if (error) keyForResult = undefined;
        } else {
          keyForResult = undefined;
        }
      }
      const out = await mutate(input.runId, (run) => {
        const c = run.claims[seq];
        if (!c) return { write: false, value: null };
        delete run.claims[seq];
        const slot = run.steps[c.key] ?? { used: 0 };
        if (input.used !== undefined) {
          const used = Math.max(0, Math.min(c.units, Math.floor(input.used)));
          slot.used = Math.max(0, slot.used - (c.units - used));
        }
        if (c.exclusive) delete slot.inFlightAt;
        if (keyForResult === c.key) slot.hasResult = true;
        run.steps[c.key] = slot;
        return { write: true, value: null };
      });
      if (out === "conflict" || out === "error")
        throw new Error(`deep_stopgap.settle_step: ${out}`);
    },

    async runSpend(runId) {
      const row = await readRun(runId);
      if (row === "error") throw new Error("deep_stopgap.run_spend");
      if (!row) return null;
      return {
        budgetUsd: row.answers.budgetUsd,
        spentUsd: row.answers.spentUsd,
        reservedUsd: row.answers.reservedUsd,
      };
    },

    async freeRunsUsed(userId) {
      const { data, error } = await leads()
        .select(LITE_COLUMNS)
        .eq("recommendation", STOPGAP.run)
        .eq("answers->>userId", userId)
        .eq("answers->>via", "free")
        .limit(100);
      if (error) throw new Error("deep_stopgap.free_runs");
      return ((data as unknown as Array<Record<string, unknown>> | null) ?? [])
        .map(liteRow)
        .filter((r) => r.answers?.status !== "canceled").length;
    },

    async breakerOpen() {
      return (await breakerUntil()) > now();
    },
  };
  return store;
}

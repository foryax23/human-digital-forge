import type {
  AccessReason,
  AccessVia,
  DeepReport,
  DeepStore,
  FeedbackKind,
  Lang,
  ReserveResult,
  RunStatus,
  StepClaim,
  StepName,
  Usage,
} from "../contracts";

/*
 * In-memory ledger with the same semantics as the SQL functions of plan A6
 * (deep_start_run, deep_reserve, deep_settle, deep_finish, breaker, day stats):
 * idempotency keys with replay of settled results, "in flight" for unsettled
 * reservations under 2 minutes, at most 5 attempts per key, the breaker, the
 * run budget and the day budget (all runs, admins included) checked inside
 * every reservation, and unsettled reservations counted as spent at finish;
 * run-level step claims (claimStep/settleStep) with replay of a used-up step.
 *
 * Used by the tests, the golden script and as the development fallback until
 * Eng 3's persist.server.ts lands. It lives in one isolate only, so on the
 * Worker a run started in another isolate is unknown here and every paid call
 * for it is refused (fail closed). deep.functions.ts therefore allows it only
 * in admin mode; the persistent stores replace it before any other mode.
 */

type Run = {
  id: string;
  userId: string;
  cui: string;
  via: AccessVia;
  status: RunStatus;
  budgetUsd: number;
  reservedUsd: number;
  spentUsd: number;
  createdAt: number;
  lastActivityAt: number;
  report?: DeepReport;
  reportAtt?: string;
  verifyCode?: string;
  metrics?: Record<string, unknown>;
};
type Call = {
  id: string;
  runId: string;
  idemKey: string;
  attempt: number;
  status: "reserved" | "settled";
  reservedUsd: number;
  usd: number;
  usage?: Usage;
  result?: unknown;
  createdAt: number;
  step: StepName;
  model?: string;
};

const DAY_TZ = "Europe/Bucharest";

/** Start of today in Europe/Bucharest, as epoch ms. */
export function bucharestDayStart(now: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const elapsed = (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000 + (now % 1000);
  return now - elapsed;
}

export type MemoryStore = DeepStore & {
  /** Test and admin-panel helpers. */
  calls(runId?: string): Call[];
  run(runId: string): Run | undefined;
  breakerUntil(): number;
};

export function createMemoryStore(
  opts: { now?: () => number; newId?: () => string } = {},
): MemoryStore {
  const now = opts.now ?? (() => Date.now());
  const newId = opts.newId ?? (() => globalThis.crypto.randomUUID());
  const runs = new Map<string, Run>();
  const calls: Call[] = [];
  /** Run-level claims: units used per run and key, the unsettled claim, the last result. */
  const slots = new Map<string, { used: number; inFlightAt?: number; result?: unknown }>();
  const claims = new Map<
    string,
    { runId: string; key: string; units: number; exclusive: boolean }
  >();
  let breaker = 0;
  let callSeq = 0;
  let claimSeq = 0;

  const today = () => bucharestDayStart(now());
  const dayRuns = () => [...runs.values()].filter((r) => r.createdAt >= today());

  return {
    kind: "stopgap",
    async startRun(input) {
      const t = now();
      const active = [...runs.values()].some(
        (r) =>
          r.userId === input.userId &&
          r.status === "running" &&
          Math.max(r.createdAt, r.lastActivityAt) > t - 10 * 60_000,
      );
      if (active) return { reason: "already_running" as AccessReason };
      if (!input.allowSameCompany) {
        const prev = dayRuns()
          .filter(
            (r) =>
              r.userId === input.userId &&
              r.cui === input.cui &&
              (r.status === "succeeded" || r.status === "partial"),
          )
          .sort((a, b) => b.createdAt - a.createdAt)[0];
        if (prev) return { reason: "same_company_today" as AccessReason, replayRunId: prev.id };
      }
      const mine = dayRuns().filter(
        (r) => r.userId === input.userId && r.status !== "canceled",
      ).length;
      if (mine >= input.userCap) return { reason: "daily_cap_user" as AccessReason };
      if (input.via !== "admin") {
        const all = dayRuns().filter((r) => r.via !== "admin" && r.status !== "canceled").length;
        if (all >= input.globalCap) return { reason: "daily_cap_global" as AccessReason };
      }
      const id = newId();
      runs.set(id, {
        id,
        userId: input.userId,
        cui: input.cui,
        via: input.via,
        status: "running",
        budgetUsd: input.budgetUsd,
        reservedUsd: 0,
        spentUsd: 0,
        createdAt: t,
        lastActivityAt: t,
      });
      return { runId: id };
    },
    async getRun(runId, userId) {
      const r = runs.get(runId);
      if (!r || r.userId !== userId) return null;
      return {
        status: r.status,
        createdAt: new Date(r.createdAt).toISOString(),
        lastActivityAt: new Date(r.lastActivityAt).toISOString(),
        via: r.via,
      };
    },
    async dayStats(userId) {
      const list = dayRuns();
      return {
        userRuns: list.filter((r) => r.userId === userId && r.status !== "canceled").length,
        allRuns: list.filter((r) => r.via !== "admin" && r.status !== "canceled").length,
        allUsd: list.reduce((sum, r) => sum + r.spentUsd + r.reservedUsd, 0),
      };
    },
    async reserve(input): Promise<ReserveResult> {
      const r = runs.get(input.runId);
      if (!r) return { ok: false, reason: "run_not_found" };
      if (r.status !== "running") return { ok: false, reason: "run_closed" };
      const last = calls
        .filter((c) => c.runId === input.runId && c.idemKey === input.idemKey)
        .sort((a, b) => b.attempt - a.attempt)[0];
      if (last) {
        if (last.status === "settled" && last.result !== undefined && last.result !== null) {
          return { ok: false, reason: "replay", result: last.result };
        }
        if (last.status === "reserved" && last.createdAt > now() - 2 * 60_000)
          return { ok: false, reason: "in_flight" };
        if (last.attempt >= 5) return { ok: false, reason: "attempts" };
      }
      if (breaker > now()) return { ok: false, reason: "breaker" };
      if (!(input.usd > 0) || r.spentUsd + r.reservedUsd + input.usd > r.budgetUsd + 1e-9) {
        return { ok: false, reason: "run_budget" };
      }
      const dayTotal = dayRuns().reduce((sum, x) => sum + x.spentUsd + x.reservedUsd, 0);
      if (dayTotal + input.usd > input.dayCapUsd + 1e-9) return { ok: false, reason: "day_budget" };
      r.reservedUsd += input.usd;
      r.lastActivityAt = now();
      const id = String(++callSeq);
      calls.push({
        id,
        runId: input.runId,
        idemKey: input.idemKey,
        attempt: (last?.attempt ?? 0) + 1,
        status: "reserved",
        reservedUsd: input.usd,
        usd: 0,
        createdAt: now(),
        step: input.step,
        model: input.model,
      });
      return { ok: true, callId: id };
    },
    async settle(input) {
      const c = calls.find((x) => x.id === input.callId && x.status === "reserved");
      if (!c) return;
      c.status = "settled";
      c.usd = Math.max(input.usd, 0);
      c.usage = input.usage;
      c.result = input.result;
      const r = runs.get(c.runId);
      if (r) {
        r.reservedUsd = Math.max(r.reservedUsd - c.reservedUsd, 0);
        r.spentUsd += c.usd;
        r.lastActivityAt = now();
      }
    },
    async finish(input) {
      const r = runs.get(input.runId);
      if (!r || r.status !== "running") return;
      for (const c of calls) {
        if (c.runId === input.runId && c.status === "reserved") {
          c.status = "settled";
          c.usd = c.reservedUsd;
        }
      }
      r.spentUsd += r.reservedUsd;
      r.reservedUsd = 0;
      r.status = input.status;
      r.report = input.report;
      r.reportAtt = input.reportAtt;
      r.verifyCode = input.verifyCode;
      r.metrics = input.metrics;
      r.lastActivityAt = now();
    },
    async tripBreaker(minutes) {
      breaker = now() + minutes * 60_000;
    },
    async loadReport(q) {
      const r =
        "verifyCode" in q
          ? [...runs.values()].find((x) => x.verifyCode === q.verifyCode)
          : runs.get(q.runId)?.userId === q.userId
            ? runs.get(q.runId)
            : undefined;
      return r?.report && r.reportAtt ? { report: r.report, reportAtt: r.reportAtt } : null;
    },
    async claimStep(input): Promise<StepClaim> {
      const r = runs.get(input.runId);
      if (!r || r.userId !== input.userId) return { ok: false, reason: "run_not_found" };
      if (r.status !== "running") return { ok: false, reason: "run_closed" };
      const exclusive = input.exclusive !== false;
      const units = Math.max(1, Math.floor(input.units ?? 1));
      const slotKey = `${input.runId}|${input.key}`;
      const slot = slots.get(slotKey) ?? { used: 0 };
      // A stale exclusive claim (its step died before settling) gives its units back after 2 min.
      if (
        exclusive &&
        slot.inFlightAt !== undefined &&
        slot.inFlightAt <= now() - 2 * 60_000 &&
        slot.result === undefined
      ) {
        let back = 0;
        for (const [id, c] of claims) {
          if (c.runId !== input.runId || c.key !== input.key || !c.exclusive) continue;
          back += c.units;
          claims.delete(id);
        }
        slot.used = Math.max(0, slot.used - (back || 1));
        delete slot.inFlightAt;
      }
      const left = input.max - slot.used;
      let granted: number;
      if (exclusive) {
        if (slot.inFlightAt !== undefined && slot.inFlightAt > now() - 2 * 60_000)
          return { ok: false, reason: "in_flight" };
        if (units > left) {
          return slot.result !== undefined
            ? { ok: false, reason: "replay", result: slot.result }
            : { ok: false, reason: "exhausted" };
        }
        granted = units;
        slot.inFlightAt = now();
      } else {
        granted = Math.min(units, left);
        if (granted < 1) return { ok: false, reason: "exhausted" };
      }
      slot.used += granted;
      slots.set(slotKey, slot);
      r.lastActivityAt = now();
      const claimId = `c${++claimSeq}`;
      claims.set(claimId, { runId: input.runId, key: input.key, units: granted, exclusive });
      return { ok: true, claimId, granted };
    },
    async settleStep(input) {
      const c = claims.get(input.claimId);
      if (!c || c.runId !== input.runId) return;
      claims.delete(input.claimId);
      const slot = slots.get(`${c.runId}|${c.key}`);
      if (!slot) return;
      if (input.used !== undefined) {
        const used = Math.max(0, Math.min(c.units, Math.floor(input.used)));
        slot.used -= c.units - used;
      }
      if (c.exclusive) slot.inFlightAt = undefined;
      if (input.result !== undefined) slot.result = input.result;
    },
    async feedback(_row: { runId: string; userId: string; kind: FeedbackKind }) {
      // Never kept in memory: free text may hold personal data and would be lost with the
      // isolate. Refused (the caller says so) until the persistent stores land.
      throw new Error("ledger_unavailable");
    },
    async callRequest(_row: { runId: string; lang: Lang }) {
      // Never accepted in memory: a call request is a real lead and must not be lost.
      throw new Error("ledger_unavailable");
    },
    async purgeIfDue() {},
    async runSpend(runId) {
      const r = runs.get(runId);
      return r
        ? { budgetUsd: r.budgetUsd, spentUsd: r.spentUsd, reservedUsd: r.reservedUsd }
        : null;
    },
    calls: (runId) => calls.filter((c) => !runId || c.runId === runId),
    run: (runId) => runs.get(runId),
    breakerUntil: () => breaker,
  };
}

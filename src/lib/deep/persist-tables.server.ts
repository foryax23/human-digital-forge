import type {
  AccessReason,
  AccessVia,
  DeepReport,
  DeepStore,
  ReserveResult,
  RunStatus,
  StepClaim,
} from "./contracts";
import {
  dayStartIso,
  FEEDBACK_DAILY,
  insertCallRequest,
  toNumber,
  type DbError,
  type DeepDb,
} from "./persist-db.server";

/*
 * The deep-research store over the server tables of
 * docs/deep/2026-10-03-deep-research.sql (plan A6 "With the tables"). Every
 * rule that must hold across Worker isolates runs inside one SQL function:
 * run caps and concurrency (deep_start_run), spend with the exact daily
 * budget under one advisory lock (deep_reserve), run-level step claims
 * (deep_claim_step). Fail closed: any database error means "ledger_error" for
 * a reservation or a claim, so no paid call is sent and no step runs.
 */

const START_REASONS = new Set<AccessReason>([
  "already_running",
  "same_company_today",
  "daily_cap_user",
  "daily_cap_global",
]);
const RESERVE_REASONS = new Set([
  "in_flight",
  "attempts",
  "breaker",
  "run_budget",
  "day_budget",
  "run_closed",
  "run_not_found",
]);
const CLAIM_REASONS = new Set(["in_flight", "exhausted", "run_closed", "run_not_found"]);

/**
 * When retention last ran, per database client: the client is created once per
 * isolate (persist-db.server.ts), so this is "at most once an hour per isolate"
 * however many store objects the requests create.
 */
const lastPurge = new WeakMap<object, number>();

const fail = (what: string, error: DbError) =>
  new Error(`deep_tables.${what}: ${error?.code ?? ""} ${error?.message ?? ""}`.trim());

const firstRow = <T>(data: unknown): T | undefined =>
  (Array.isArray(data) ? (data[0] as T | undefined) : (data as T | undefined)) ?? undefined;

export function createTablesStore(
  db: DeepDb,
  opts: { now?: () => number } = {},
): DeepStore & { freeRunsUsed(userId: string): Promise<number>; breakerOpen(): Promise<boolean> } {
  const now = opts.now ?? (() => Date.now());

  return {
    kind: "tables",

    async startRun(input) {
      const { data, error } = await db.rpc("deep_start_run", {
        p_user: input.userId,
        p_cui: input.cui,
        p_company: input.companyName ?? null,
        p_relationship: input.relationship,
        p_lang: input.lang,
        p_via: input.via,
        p_budget: input.budgetUsd,
        p_ai_mode: input.aiMode,
        p_consent: input.consent,
        p_user_cap: input.userCap,
        p_global_cap: input.globalCap,
        p_allow_same_company: input.allowSameCompany,
      });
      if (error) throw fail("start", error);
      const row = firstRow<{ run_id: string | null; reason: string; replay_run: string | null }>(
        data,
      );
      if (row?.reason === "ok" && row.run_id) return { runId: row.run_id };
      const reason = (row?.reason ?? "") as AccessReason;
      if (!START_REASONS.has(reason))
        throw new Error(`deep_tables.start: unexpected ${row?.reason}`);
      return row?.replay_run ? { reason, replayRunId: row.replay_run } : { reason };
    },

    async getRun(runId, userId) {
      const { data, error } = await db
        .from("deep_runs")
        .select("status, created_at, last_activity_at, cui, access_via")
        .eq("id", runId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw fail("get_run", error);
      const row = data as {
        status: RunStatus;
        created_at: string;
        last_activity_at: string;
        cui: string;
        access_via?: AccessVia;
      } | null;
      return row
        ? {
            status: row.status,
            createdAt: row.created_at,
            lastActivityAt: row.last_activity_at,
            cui: row.cui,
            via: row.access_via,
          }
        : null;
    },

    async dayStats(userId) {
      const { data, error } = await db.rpc("deep_day_stats", { p_user: userId });
      if (error) throw fail("day_stats", error);
      const row = firstRow<{ user_runs: unknown; all_runs: unknown; all_usd: unknown }>(data);
      return {
        userRuns: toNumber(row?.user_runs),
        allRuns: toNumber(row?.all_runs),
        allUsd: toNumber(row?.all_usd),
      };
    },

    async reserve(input): Promise<ReserveResult> {
      try {
        const { data, error } = await db.rpc("deep_reserve", {
          p_run: input.runId,
          p_idem: input.idemKey,
          p_kind: input.kind,
          p_step: input.step,
          p_model: input.model ?? null,
          p_usd: input.usd,
          p_day_cap: input.dayCapUsd,
        });
        if (error) return { ok: false, reason: "ledger_error" };
        const row = firstRow<{ call_id: unknown; reason: string; replay: unknown }>(data);
        if (row?.reason === "ok" && row.call_id !== null && row.call_id !== undefined)
          return { ok: true, callId: String(row.call_id) };
        if (row?.reason === "replay") return { ok: false, reason: "replay", result: row.replay };
        if (row && RESERVE_REASONS.has(row.reason))
          return {
            ok: false,
            reason: row.reason as Exclude<ReserveResult, { ok: true }>["reason"],
          } as ReserveResult;
        return { ok: false, reason: "ledger_error" };
      } catch {
        return { ok: false, reason: "ledger_error" };
      }
    },

    async settle(input) {
      const { error } = await db.rpc("deep_settle", {
        p_call: Number(input.callId),
        p_usd: input.usd,
        p_in: Math.round(input.usage.inputTokens),
        p_out: Math.round(input.usage.outputTokens),
        p_cache_read: Math.round(input.usage.cacheReadTokens),
        p_cache_write: Math.round(input.usage.cacheWriteTokens),
        p_result: input.result ?? null,
      });
      if (error) throw fail("settle", error);
    },

    async finish(input) {
      const { error } = await db.rpc("deep_finish", {
        p_run: input.runId,
        p_status: input.status,
        p_report: input.report ?? null,
        p_att: input.reportAtt ?? null,
        p_code: input.verifyCode ?? null,
        p_metrics: input.metrics ?? {},
        p_error: input.error?.slice(0, 2000) ?? null,
      });
      if (error) throw fail("finish", error);
    },

    async tripBreaker(minutes, reason) {
      const { error } = await db.rpc("deep_trip_breaker", {
        p_minutes: Math.max(1, Math.round(minutes)),
        p_reason: reason.slice(0, 200),
      });
      if (error) throw fail("breaker", error);
    },

    async loadReport(q) {
      const base = db.from("deep_runs").select("report, report_att");
      const query =
        "verifyCode" in q
          ? base.eq("verify_code", q.verifyCode)
          : base.eq("id", q.runId).eq("user_id", q.userId);
      const { data, error } = await query.maybeSingle();
      if (error) throw fail("load_report", error);
      const row = data as { report: DeepReport | null; report_att: string | null } | null;
      return row?.report && row.report_att
        ? { report: row.report, reportAtt: row.report_att }
        : null;
    },

    async feedback(row) {
      const limit =
        row.kind === "error_report" ? FEEDBACK_DAILY.error_report : FEEDBACK_DAILY.other;
      const counted = await db
        .from("deep_feedback")
        .select("id", { count: "exact", head: true })
        .eq("user_id", row.userId)
        .gte("created_at", dayStartIso(now()));
      if (counted.error) throw fail("feedback_count", counted.error);
      if ((counted.count ?? 0) >= limit) throw new Error("feedback_limit");
      const { error } = await db.from("deep_feedback").insert({
        run_id: row.runId,
        user_id: row.userId,
        kind: row.kind,
        fact_id: row.factId?.slice(0, 120) ?? null,
        message: row.message?.slice(0, 1000) ?? null,
        value: row.value ?? null,
      });
      if (error) throw fail("feedback", error);
    },

    async callRequest(row) {
      await insertCallRequest(db, row, now());
    },

    async purgeIfDue() {
      if (now() - (lastPurge.get(db) ?? 0) < 60 * 60_000) return;
      lastPurge.set(db, now());
      const { error } = await db.rpc("deep_purge_expired", {});
      if (error) throw fail("purge", error);
    },

    async claimStep(input): Promise<StepClaim> {
      try {
        const { data, error } = await db.rpc("deep_claim_step", {
          p_run: input.runId,
          p_user: input.userId,
          p_key: input.key,
          p_max: input.max,
          p_units: Math.max(1, Math.floor(input.units ?? 1)),
          p_exclusive: input.exclusive !== false,
        });
        if (error) return { ok: false, reason: "ledger_error" };
        const row = firstRow<{
          claim_id: unknown;
          reason: string;
          granted: unknown;
          replay: unknown;
        }>(data);
        if (row?.reason === "ok" && row.claim_id !== null && row.claim_id !== undefined)
          return { ok: true, claimId: String(row.claim_id), granted: toNumber(row.granted) };
        if (row?.reason === "replay") return { ok: false, reason: "replay", result: row.replay };
        if (row && CLAIM_REASONS.has(row.reason))
          return {
            ok: false,
            reason: row.reason as "in_flight" | "exhausted" | "run_closed" | "run_not_found",
          };
        return { ok: false, reason: "ledger_error" };
      } catch {
        return { ok: false, reason: "ledger_error" };
      }
    },

    async settleStep(input) {
      const { error } = await db.rpc("deep_settle_step", {
        p_run: input.runId,
        p_claim: Number(input.claimId),
        p_used: input.used ?? null,
        p_result: input.result ?? null,
      });
      if (error) throw fail("settle_step", error);
    },

    async runSpend(runId) {
      const { data, error } = await db
        .from("deep_runs")
        .select("budget_usd, spent_usd, reserved_usd")
        .eq("id", runId)
        .maybeSingle();
      if (error) throw fail("run_spend", error);
      const row = data as { budget_usd: unknown; spent_usd: unknown; reserved_usd: unknown } | null;
      return row
        ? {
            budgetUsd: toNumber(row.budget_usd),
            spentUsd: toNumber(row.spent_usd),
            reservedUsd: toNumber(row.reserved_usd),
          }
        : null;
    },

    async freeRunsUsed(userId) {
      const { count, error } = await db
        .from("deep_runs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("access_via", "free")
        .neq("status", "canceled");
      if (error) throw fail("free_runs", error);
      return count ?? 0;
    },

    async breakerOpen() {
      const { data, error } = await db
        .from("deep_settings")
        .select("value")
        .eq("key", "breaker")
        .maybeSingle();
      if (error) throw fail("breaker_read", error);
      const until = Date.parse(
        String((data as { value?: { until?: string } } | null)?.value?.until ?? ""),
      );
      return Number.isFinite(until) && until > now();
    },
  };
}

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
  CALL_REQUESTS_DAILY,
  DAY_MS,
  dayStartIso,
  FEEDBACK_DAILY,
  isMissingRelation,
  toNumber,
  type DbError,
  type DeepDb,
  type DeepRunRow,
} from "./persist-db.server";

/*
 * The deep-research store over the tables APPLIED to the live database by
 * Lovable (drizzle/migrations/0000_admin_roles_and_deep_ledger.sql): deep_runs,
 * deep_calls, deep_slots + deep_claims (run-level step claims), deep_breaker,
 * deep_feedback and deep_call_requests, all behind RLS with no client policy, so
 * only the server (service role) reads and writes them.
 *
 * Money and step claims go through Lovable's row-locked SQL functions: the run
 * budget and the exact daily budget under one advisory lock (deep_reserve), and
 * claims atomic per run and key (deep_claim_step). Fail closed: any database
 * error, or an answer this file does not recognise, is "ledger_error" for a
 * reservation or a claim, so no paid call is sent and no step runs.
 *
 * Two rules of the engine are not inside Lovable's functions. Each uses the
 * optional function of drizzle/migrations/0001_deep_research_additions.sql when it
 * is applied, and an equivalent built from plain table operations otherwise:
 * - run start with the caps (deep_start_run): insert-then-count, the same as the
 *   stopgap (at worst one run over a cap when two starts race in one instant);
 * - a step claim whose step died before settling gives its units back after
 *   2 minutes (deep_reclaim_step): a compare-and-swap on the slot's in_flight_at.
 * Retention runs from the server too (deletes by age; Lovable's foreign keys
 * cascade a run's calls, slots, claims, feedback and call requests).
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

/** A running run counts as active (one per account) while its last activity is this recent. */
const ACTIVE_MS = 10 * 60_000;
/** An exclusive step claim older than this, with no stored result, belonged to a step that died. */
const STALE_CLAIM_MS = 2 * 60_000;
/** Runs, and with them their paid calls, slots, claims and call requests (privacy page, section 4). */
export const RUN_RETENTION_DAYS = 90;
/** Feedback on a deep research. */
export const FEEDBACK_RETENTION_DAYS = 365;

/**
 * When retention last ran, per database client: the client is created once per
 * isolate (persist-db.server.ts), so this is "at most once an hour per isolate"
 * however many store objects the requests create.
 */
const lastPurge = new WeakMap<object, number>();

const fail = (what: string, error: DbError) =>
  new Error(`deep_tables.${what}: ${error?.code ?? ""} ${error?.message ?? ""}`.trim());

/** The jsonb answer of Lovable's functions (supabase-js returns it parsed; tolerate one-row arrays). */
const answer = (data: unknown): Record<string, unknown> | null => {
  const v = Array.isArray(data) ? data[0] : data;
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
};

/** JSON-safe copy for a jsonb argument (undefined → null). */
const json = (v: unknown): unknown => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

/** One of the account's runs, as the dashboard lists it. */
export type DeepRunListItem = {
  runId: string;
  cui: string;
  company: string | null;
  status: RunStatus;
  aiMode: "ai" | "rules";
  via: AccessVia;
  createdAt: string;
  lastActivityAt: string;
  hasReport: boolean;
  verifyCode: string | null;
  /** Spent plus still reserved (the server function shows it to admins only). */
  spentUsd: number;
};

export type TablesStore = DeepStore & {
  freeRunsUsed(userId: string): Promise<number>;
  /**
   * Runs this account started through a plan ("premium") since `sinceIso`, for the plan's
   * report quota (src/lib/deep/access.server.ts): running, succeeded and partial runs count;
   * failed and canceled ones produced no report and do not.
   */
  premiumRunsSince(userId: string, sinceIso: string): Promise<number>;
  breakerOpen(): Promise<boolean>;
  listRuns(userId: string, limit?: number): Promise<DeepRunListItem[]>;
};

export function createTablesStore(db: DeepDb, opts: { now?: () => number } = {}): TablesStore {
  const now = opts.now ?? (() => Date.now());
  const runs = () => db.from("deep_runs");
  /** Optional functions found missing (per store object; a request makes a new store). */
  const missing = new Set<string>();

  async function cancel(runId: string) {
    await runs()
      .update({ status: "canceled", last_activity_at: new Date(now()).toISOString() })
      .eq("id", runId)
      .eq("status", "running");
  }

  /** Run start without deep_start_run: check, insert, then count up to and including the new row. */
  async function startByInsertThenCount(
    input: Parameters<DeepStore["startRun"]>[0],
  ): Promise<Awaited<ReturnType<DeepStore["startRun"]>>> {
    const t = now();
    const dayStart = Date.parse(dayStartIso(t));
    const since = new Date(Math.min(dayStart, t - ACTIVE_MS)).toISOString();
    type Lite = Pick<
      DeepRunRow,
      "id" | "user_id" | "cui" | "via" | "status" | "created_at" | "last_activity_at"
    >;
    const listSince = async (): Promise<Lite[]> => {
      const { data, error } = await runs()
        .select("id, user_id, cui, via, status, created_at, last_activity_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) throw fail("start_list", error);
      return (data as Lite[] | null) ?? [];
    };
    const at = (r: Lite) => Date.parse(r.created_at) || 0;
    const active = (r: Lite) =>
      r.status === "running" &&
      Math.max(at(r), Date.parse(r.last_activity_at) || 0) > t - ACTIVE_MS;

    const before = await listSince();
    const mine = before.filter((r) => r.user_id === input.userId);
    if (mine.some(active)) return { reason: "already_running" };
    if (!input.allowSameCompany) {
      const prev = mine
        .filter(
          (r) =>
            at(r) >= dayStart &&
            r.cui === input.cui &&
            (r.status === "succeeded" || r.status === "partial"),
        )
        .pop();
      if (prev) return { reason: "same_company_today", replayRunId: prev.id };
    }
    const inserted = await runs()
      .insert({
        user_id: input.userId,
        cui: input.cui,
        company_name: input.companyName?.slice(0, 200) ?? null,
        relationship: input.relationship,
        lang: input.lang,
        via: input.via,
        ai_mode: input.aiMode,
        budget_usd: input.budgetUsd,
        consent: json(input.consent),
      })
      .select("id, created_at")
      .single();
    if (inserted.error || !inserted.data) throw fail("start_insert", inserted.error);
    const row = inserted.data as { id: string; created_at: string };
    const mineAt = Date.parse(row.created_at) || t;
    let after: Lite[];
    try {
      after = await listSince();
    } catch (error) {
      await cancel(row.id).catch(() => undefined);
      throw error;
    }
    const upTo = after.filter((r) => r.id === row.id || at(r) <= mineAt);
    const today = upTo.filter((r) => at(r) >= dayStart && r.status !== "canceled");
    const refuse = async (reason: AccessReason) => {
      await cancel(row.id).catch(() => undefined);
      return { reason };
    };
    if (upTo.some((r) => r.id !== row.id && r.user_id === input.userId && active(r)))
      return refuse("already_running");
    if (today.filter((r) => r.user_id === input.userId).length > input.userCap)
      return refuse("daily_cap_user");
    if (input.via !== "admin" && today.filter((r) => r.via !== "admin").length > input.globalCap)
      return refuse("daily_cap_global");
    return { runId: row.id };
  }

  /**
   * Gives back the units of an exclusive claim whose step died (in flight for more than
   * 2 minutes, nothing stored): true when it did, so the claim is tried once more.
   */
  async function reclaimStale(runId: string, userId: string, key: string): Promise<boolean> {
    if (!missing.has("deep_reclaim_step")) {
      const { data, error } = await db.rpc("deep_reclaim_step", {
        p_run: runId,
        p_user: userId,
        p_key: key,
      });
      if (!error) return data === true;
      if (!isMissingRelation(error)) return false;
      missing.add("deep_reclaim_step");
    }
    const slot = await db
      .from("deep_slots")
      .select("used, in_flight_at, result")
      .eq("run_id", runId)
      .eq("key", key)
      .maybeSingle();
    const s = slot.data as { used: number; in_flight_at: string | null; result: unknown } | null;
    if (slot.error || !s || !s.in_flight_at || s.result !== null) return false;
    if (Date.parse(s.in_flight_at) > now() - STALE_CLAIM_MS) return false;
    const claims = await db
      .from("deep_claims")
      .select("id, units")
      .eq("run_id", runId)
      .eq("key", key)
      .eq("exclusive", true);
    if (claims.error) return false;
    const stale = (claims.data as Array<{ id: string; units: number }> | null) ?? [];
    const back = stale.reduce((sum, c) => sum + toNumber(c.units), 0) || 1;
    // Compare-and-swap on the slot as read: a concurrent claim or settle wins and we stop.
    const swapped = await db
      .from("deep_slots")
      .update({ used: Math.max(0, toNumber(s.used) - back), in_flight_at: null })
      .eq("run_id", runId)
      .eq("key", key)
      .eq("in_flight_at", s.in_flight_at)
      .eq("used", s.used)
      .select("run_id");
    if (swapped.error || !Array.isArray(swapped.data) || swapped.data.length !== 1) return false;
    if (stale.length)
      await db
        .from("deep_claims")
        .delete()
        .in(
          "id",
          stale.map((c) => c.id),
        );
    return true;
  }

  async function claimOnce(input: Parameters<DeepStore["claimStep"]>[0]): Promise<StepClaim> {
    const { data, error } = await db.rpc("deep_claim_step", {
      p_run: input.runId,
      p_user: input.userId,
      p_key: input.key,
      p_max: input.max,
      p_units: Math.max(1, Math.floor(input.units ?? 1)),
      p_exclusive: input.exclusive !== false,
    });
    if (error) return { ok: false, reason: "ledger_error" };
    const row = answer(data);
    if (row?.ok === true && typeof row.claimId === "string" && row.claimId)
      return { ok: true, claimId: row.claimId, granted: toNumber(row.granted) };
    if (row?.reason === "replay" && row.result !== undefined && row.result !== null)
      return { ok: false, reason: "replay", result: row.result };
    if (row && typeof row.reason === "string" && CLAIM_REASONS.has(row.reason))
      return {
        ok: false,
        reason: row.reason as "in_flight" | "exhausted" | "run_closed" | "run_not_found",
      };
    return { ok: false, reason: "ledger_error" };
  }

  const store: TablesStore = {
    kind: "tables",

    async startRun(input) {
      if (!missing.has("deep_start_run")) {
        const { data, error } = await db.rpc("deep_start_run", {
          p_user: input.userId,
          p_cui: input.cui,
          p_company: input.companyName?.slice(0, 200) ?? null,
          p_relationship: input.relationship,
          p_lang: input.lang,
          p_via: input.via,
          p_budget: input.budgetUsd,
          p_ai_mode: input.aiMode,
          p_consent: json(input.consent),
          p_user_cap: input.userCap,
          p_global_cap: input.globalCap,
          p_allow_same_company: input.allowSameCompany,
          p_day_start: dayStartIso(now()),
        });
        if (!error) {
          const row = answer(data);
          if (row?.ok === true && typeof row.runId === "string") return { runId: row.runId };
          const reason = String(row?.reason ?? "") as AccessReason;
          if (!START_REASONS.has(reason))
            throw new Error(`deep_tables.start: unexpected ${String(row?.reason)}`);
          return typeof row?.replayRunId === "string"
            ? { reason, replayRunId: row.replayRunId }
            : { reason };
        }
        if (!isMissingRelation(error)) throw fail("start", error);
        missing.add("deep_start_run");
      }
      return startByInsertThenCount(input);
    },

    async getRun(runId, userId) {
      const { data, error } = await runs()
        .select("status, created_at, last_activity_at, cui, via, user_id")
        .eq("id", runId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw fail("get_run", error);
      const row = data as Pick<
        DeepRunRow,
        "status" | "created_at" | "last_activity_at" | "cui" | "via" | "user_id"
      > | null;
      if (!row || row.user_id !== userId) return null;
      return {
        status: row.status as RunStatus,
        createdAt: row.created_at,
        lastActivityAt: row.last_activity_at,
        cui: row.cui,
        via: row.via as AccessVia,
      };
    },

    async dayStats(userId) {
      // Today's rows, the few columns the counters need (never reports or consent texts).
      const { data, error } = await runs()
        .select("user_id, via, status, spent_usd, reserved_usd")
        .gte("created_at", dayStartIso(now()))
        .limit(5000);
      if (error) throw fail("day_stats", error);
      const rows =
        (data as Pick<DeepRunRow, "user_id" | "via" | "status" | "spent_usd" | "reserved_usd">[]) ??
        [];
      return {
        userRuns: rows.filter((r) => r.user_id === userId && r.status !== "canceled").length,
        allRuns: rows.filter((r) => r.via !== "admin" && r.status !== "canceled").length,
        allUsd: rows.reduce((s, r) => s + toNumber(r.spent_usd) + toNumber(r.reserved_usd), 0),
      };
    },

    async reserve(input): Promise<ReserveResult> {
      try {
        const { data, error } = await db.rpc("deep_reserve", {
          p_run: input.runId,
          p_key: input.idemKey,
          p_kind: input.kind,
          p_step: input.step,
          p_model: input.model ?? null,
          p_usd: input.usd,
          p_day_cap: input.dayCapUsd,
          p_day_start: dayStartIso(now()),
        });
        if (error) return { ok: false, reason: "ledger_error" };
        const row = answer(data);
        if (row?.ok === true && typeof row.callId === "string" && row.callId)
          return { ok: true, callId: row.callId };
        if (row?.reason === "replay" && row.result !== undefined && row.result !== null)
          return { ok: false, reason: "replay", result: row.result };
        if (row && typeof row.reason === "string" && RESERVE_REASONS.has(row.reason))
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
        p_call: input.callId,
        p_usd: Math.max(0, input.usd),
        p_usage: {
          inputTokens: Math.round(input.usage.inputTokens),
          outputTokens: Math.round(input.usage.outputTokens),
          cacheReadTokens: Math.round(input.usage.cacheReadTokens),
          cacheWriteTokens: Math.round(input.usage.cacheWriteTokens),
        },
        p_result: json(input.result),
      });
      if (error) throw fail("settle", error);
    },

    async finish(input) {
      const { error } = await db.rpc("deep_finish", {
        p_run: input.runId,
        p_status: input.status,
        p_report: json(input.report),
        p_att: input.reportAtt ?? null,
        p_code: input.verifyCode ?? null,
        p_metrics: json(input.metrics ?? {}),
        p_error: input.error?.slice(0, 2000) ?? null,
      });
      if (error) throw fail("finish", error);
    },

    async tripBreaker(minutes, reason) {
      const iso = new Date(now() + Math.max(1, Math.round(minutes)) * 60_000).toISOString();
      const why = reason.slice(0, 200);
      // Never shortens a longer pause (the admin panel pauses AI calls for 30 days). One
      // conditional statement, not a read then a write: an admin pause written in between
      // cannot be overwritten by this shorter automatic one.
      const moved = await db
        .from("deep_breaker")
        .update({ until: iso, reason: why })
        .eq("id", 1)
        .lt("until", iso)
        .select("id");
      if (moved.error) throw fail("breaker", moved.error);
      if ((moved.data as unknown[] | null)?.length) return;
      // No row moved: either there is no breaker row yet, or it already holds a later time.
      const added = await db.from("deep_breaker").insert({ id: 1, until: iso, reason: why });
      if (added.error && added.error.code !== "23505") throw fail("breaker", added.error);
    },

    async loadReport(q) {
      const base = runs().select("id, report, report_att, user_id");
      const query =
        "verifyCode" in q
          ? base.eq("verify_code", q.verifyCode)
          : base.eq("id", q.runId).eq("user_id", q.userId);
      const { data, error } = await query.maybeSingle();
      if (error) throw fail("load_report", error);
      const row = data as {
        id: string;
        report: DeepReport | null;
        report_att: string | null;
        user_id: string;
      } | null;
      if (!row || (!("verifyCode" in q) && row.user_id !== q.userId)) return null;
      return row.report && row.report_att
        ? { runId: row.id, report: row.report, reportAtt: row.report_att }
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
      const value = json(row.value);
      const { error } = await db.from("deep_feedback").insert({
        run_id: row.runId,
        user_id: row.userId,
        kind: row.kind,
        fact_id: row.factId?.slice(0, 120) ?? null,
        message: row.message?.slice(0, 1000) ?? null,
        value: JSON.stringify(value ?? null).length <= 4096 ? value : null,
      });
      if (error) throw fail("feedback", error);
    },

    async callRequest(row) {
      // "Sună-mă": a real request the person made (GDPR art. 6(1)(b)); three a day per account.
      const counted = await db
        .from("deep_call_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", row.userId)
        .gte("created_at", dayStartIso(now()));
      if (counted.error) throw fail("call_count", counted.error);
      if ((counted.count ?? 0) >= CALL_REQUESTS_DAILY) throw new Error("call_limit");
      const { error } = await db.from("deep_call_requests").insert({
        run_id: row.runId,
        user_id: row.userId,
        email: row.email || null,
        phone: row.phone,
        call_when: row.when,
        cui: row.cui || null,
        lang: row.lang,
      });
      if (error) throw fail("call_request", error);
    },

    async purgeIfDue() {
      const t = now();
      if (t - (lastPurge.get(db) ?? 0) < 60 * 60_000) return;
      lastPurge.set(db, t);
      const older = (days: number) => new Date(t - days * DAY_MS).toISOString();
      const feedback = await db
        .from("deep_feedback")
        .delete()
        .lt("created_at", older(FEEDBACK_RETENTION_DAYS));
      if (feedback.error) throw fail("purge_feedback", feedback.error);
      const old = await runs().delete().lt("created_at", older(RUN_RETENTION_DAYS));
      if (old.error) throw fail("purge_runs", old.error);
    },

    async claimStep(input): Promise<StepClaim> {
      try {
        const first = await claimOnce(input);
        if (first.ok || first.reason !== "exhausted" || input.exclusive === false) return first;
        // A step that died while holding the key: give its units back once, then claim again.
        const back = await reclaimStale(input.runId, input.userId, input.key).catch(() => false);
        return back ? await claimOnce(input) : first;
      } catch {
        return { ok: false, reason: "ledger_error" };
      }
    },

    async settleStep(input) {
      const { error } = await db.rpc("deep_settle_step", {
        p_run: input.runId,
        p_claim: input.claimId,
        p_used: input.used ?? null,
        p_result: json(input.result),
      });
      if (error) throw fail("settle_step", error);
    },

    async runSpend(runId) {
      const { data, error } = await runs()
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
      const { count, error } = await runs()
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("via", "free")
        .neq("status", "canceled");
      if (error) throw fail("free_runs", error);
      return count ?? 0;
    },

    async premiumRunsSince(userId, sinceIso) {
      const { count, error } = await runs()
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("via", "premium")
        .gte("created_at", sinceIso)
        .in("status", ["running", "succeeded", "partial"]);
      if (error) throw fail("premium_runs", error);
      // A HEAD answer without a count (a missing table looks like success) is not "none used".
      if (typeof count !== "number") throw fail("premium_runs", { message: "no count" });
      return count;
    },

    async breakerOpen() {
      const { data, error } = await db
        .from("deep_breaker")
        .select("until")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw fail("breaker_read", error);
      const until = Date.parse(String((data as { until?: string } | null)?.until ?? ""));
      return Number.isFinite(until) && until > now();
    },

    async listRuns(userId, limit = 50) {
      const { data, error } = await runs()
        .select(
          "id, cui, company_name, status, ai_mode, via, created_at, last_activity_at, report_att, verify_code, spent_usd, reserved_usd",
        )
        .eq("user_id", userId)
        .neq("status", "canceled")
        .order("created_at", { ascending: false })
        .limit(Math.max(1, Math.min(100, limit)));
      if (error) throw fail("list_runs", error);
      type Lite = Pick<
        DeepRunRow,
        | "id"
        | "cui"
        | "company_name"
        | "status"
        | "ai_mode"
        | "via"
        | "created_at"
        | "last_activity_at"
        | "report_att"
        | "verify_code"
        | "spent_usd"
        | "reserved_usd"
      >;
      return ((data as Lite[] | null) ?? []).map((r) => ({
        runId: r.id,
        cui: r.cui,
        company: r.company_name,
        status: r.status as RunStatus,
        aiMode: r.ai_mode === "ai" ? "ai" : "rules",
        via: r.via as AccessVia,
        createdAt: r.created_at,
        lastActivityAt: r.last_activity_at,
        hasReport: Boolean(r.report_att),
        verifyCode: r.verify_code,
        spentUsd: toNumber(r.spent_usd) + toNumber(r.reserved_usd),
      }));
    },
  };
  return store;
}

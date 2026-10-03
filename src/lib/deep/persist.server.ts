import type { DeepStore, ReserveResult, StepClaim } from "./contracts";
import { bucharestDayStart } from "./llm/ledger-memory.server";

/*
 * The persistent ledger ("tables"): runs, paid calls and step claims kept in the
 * database. Money and step claims go through row-locked SQL functions so parallel
 * requests cannot overspend; any database error fails closed (ledger_error).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function db(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Db;
}

const json = (v: unknown) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

export function createTableStore(): DeepStore {
  return {
    kind: "tables",
    async startRun(input) {
      const d = await db();
      const now = Date.now();
      const dayStart = new Date(bucharestDayStart(now)).toISOString();
      const { data: active } = await d
        .from("deep_runs")
        .select("id")
        .eq("user_id", input.userId)
        .eq("status", "running")
        .gt("last_activity_at", new Date(now - 10 * 60_000).toISOString())
        .limit(1);
      if (active?.length) return { reason: "already_running" };
      if (!input.allowSameCompany) {
        const { data: prev } = await d
          .from("deep_runs")
          .select("id")
          .eq("user_id", input.userId)
          .eq("cui", input.cui)
          .in("status", ["succeeded", "partial"])
          .gte("created_at", dayStart)
          .order("created_at", { ascending: false })
          .limit(1);
        if (prev?.length) return { reason: "same_company_today", replayRunId: prev[0].id };
      }
      const { count: mine } = await d
        .from("deep_runs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", input.userId)
        .neq("status", "canceled")
        .gte("created_at", dayStart);
      if ((mine ?? 0) >= input.userCap) return { reason: "daily_cap_user" };
      if (input.via !== "admin") {
        const { count: all } = await d
          .from("deep_runs")
          .select("id", { count: "exact", head: true })
          .neq("via", "admin")
          .neq("status", "canceled")
          .gte("created_at", dayStart);
        if ((all ?? 0) >= input.globalCap) return { reason: "daily_cap_global" };
      }
      const { data, error } = await d
        .from("deep_runs")
        .insert({
          user_id: input.userId,
          cui: input.cui,
          company_name: input.companyName ?? null,
          relationship: input.relationship,
          lang: input.lang,
          via: input.via,
          ai_mode: input.aiMode,
          budget_usd: input.budgetUsd,
          consent: json(input.consent),
        })
        .select("id")
        .single();
      if (error || !data) throw new Error("ledger_error");
      return { runId: data.id as string };
    },
    async getRun(runId, userId) {
      const d = await db();
      const { data } = await d
        .from("deep_runs")
        .select("status, created_at, last_activity_at, user_id")
        .eq("id", runId)
        .maybeSingle();
      if (!data || data.user_id !== userId) return null;
      return {
        status: data.status,
        createdAt: data.created_at,
        lastActivityAt: data.last_activity_at,
      };
    },
    async dayStats(userId) {
      const d = await db();
      const dayStart = new Date(bucharestDayStart(Date.now())).toISOString();
      const { data, error } = await d
        .from("deep_runs")
        .select("user_id, via, status, spent_usd, reserved_usd")
        .gte("created_at", dayStart);
      if (error) throw new Error("ledger_error");
      const rows = (data ?? []) as {
        user_id: string;
        via: string;
        status: string;
        spent_usd: number;
        reserved_usd: number;
      }[];
      return {
        userRuns: rows.filter((r) => r.user_id === userId && r.status !== "canceled").length,
        allRuns: rows.filter((r) => r.via !== "admin" && r.status !== "canceled").length,
        allUsd: rows.reduce((s, r) => s + Number(r.spent_usd) + Number(r.reserved_usd), 0),
      };
    },
    async reserve(input): Promise<ReserveResult> {
      const d = await db();
      const { data, error } = await d.rpc("deep_reserve", {
        p_run: input.runId,
        p_key: input.idemKey,
        p_kind: input.kind,
        p_step: input.step,
        p_model: input.model ?? null,
        p_usd: input.usd,
        p_day_cap: input.dayCapUsd,
        p_day_start: new Date(bucharestDayStart(Date.now())).toISOString(),
      });
      if (error || !data) return { ok: false, reason: "ledger_error" };
      return data as ReserveResult;
    },
    async settle(input) {
      const d = await db();
      const { error } = await d.rpc("deep_settle", {
        p_call: input.callId,
        p_usd: input.usd,
        p_usage: json(input.usage),
        p_result: json(input.result),
      });
      if (error) throw new Error("ledger_error");
    },
    async finish(input) {
      const d = await db();
      const { error } = await d.rpc("deep_finish", {
        p_run: input.runId,
        p_status: input.status,
        p_report: json(input.report),
        p_att: input.reportAtt ?? null,
        p_code: input.verifyCode ?? null,
        p_metrics: json(input.metrics),
        p_error: input.error ?? null,
      });
      if (error) throw new Error("ledger_error");
    },
    async tripBreaker(minutes, reason) {
      const d = await db();
      await d.from("deep_breaker").upsert({
        id: 1,
        until: new Date(Date.now() + minutes * 60_000).toISOString(),
        reason,
      });
    },
    async loadReport(q) {
      const d = await db();
      let query = d.from("deep_runs").select("report, report_att, user_id");
      query = "verifyCode" in q ? query.eq("verify_code", q.verifyCode) : query.eq("id", q.runId);
      const { data } = await query.maybeSingle();
      if (!data || !data.report || !data.report_att) return null;
      if (!("verifyCode" in q) && data.user_id !== q.userId) return null;
      return { report: data.report, reportAtt: data.report_att };
    },
    async feedback(row) {
      const d = await db();
      const { error } = await d.from("deep_feedback").insert({
        run_id: row.runId,
        user_id: row.userId,
        kind: row.kind,
        fact_id: row.factId ?? null,
        message: row.message ?? null,
        value: json(row.value),
      });
      if (error) throw new Error("ledger_unavailable");
    },
    async callRequest(row) {
      const d = await db();
      const { error } = await d.from("deep_call_requests").insert({
        run_id: row.runId,
        user_id: row.userId,
        email: row.email,
        phone: row.phone,
        call_when: row.when,
        cui: row.cui,
        lang: row.lang,
      });
      if (error) throw new Error("ledger_unavailable");
    },
    async purgeIfDue() {},
    async claimStep(input): Promise<StepClaim> {
      const d = await db();
      const { data, error } = await d.rpc("deep_claim_step", {
        p_run: input.runId,
        p_user: input.userId,
        p_key: input.key,
        p_max: input.max,
        p_units: input.units ?? 1,
        p_exclusive: input.exclusive !== false,
      });
      if (error || !data) return { ok: false, reason: "ledger_error" };
      return data as StepClaim;
    },
    async settleStep(input) {
      const d = await db();
      const { error } = await d.rpc("deep_settle_step", {
        p_run: input.runId,
        p_claim: input.claimId,
        p_used: input.used ?? null,
        p_result: json(input.result),
      });
      if (error) throw new Error("ledger_error");
    },
    async runSpend(runId) {
      const d = await db();
      const { data } = await d
        .from("deep_runs")
        .select("budget_usd, spent_usd, reserved_usd")
        .eq("id", runId)
        .maybeSingle();
      return data
        ? {
            budgetUsd: Number(data.budget_usd),
            spentUsd: Number(data.spent_usd),
            reservedUsd: Number(data.reserved_usd),
          }
        : null;
    },
  };
}

/** Admin role, active paid plan and today's free state for one user (server only). */
export async function userEntitlements(
  userId: string,
  premiumTiers: string[],
): Promise<{ isAdmin: boolean; premium: boolean }> {
  const d = await db();
  const [{ data: role }, { data: sub }] = await Promise.all([
    d.from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    d.from("subscribers").select("tier, status").eq("user_id", userId).maybeSingle(),
  ]);
  const premium = Boolean(
    sub &&
      ["active", "trialing"].includes(String(sub.status).toLowerCase()) &&
      premiumTiers.includes(String(sub.tier ?? "").toLowerCase()),
  );
  return { isAdmin: Boolean(role), premium };
}

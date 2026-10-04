import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The service-role client, for an account holding the "admin" role. The role is read with
 * the service role itself (user_roles), not through the has_role RPC, so has_role needs no
 * EXECUTE grant for signed-in or anonymous clients (drizzle/migrations/0001 revokes it).
 */
async function adminDb(context: { userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("user_roles")
    .select("id")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .limit(1);
  if (error || !Array.isArray(data) || data.length === 0) throw new Error("Forbidden");
  return db;
}

/** Deep research settings the admin panel shows (never the secrets themselves). */
async function deepSettings() {
  try {
    const { readDeepConfig } = await import("@/lib/deep/env.server");
    const { detectStoreKind } = await import("@/lib/deep/persist.server");
    const c = readDeepConfig();
    return {
      mode: c.mode,
      unknownMode: c.unknownMode ?? null,
      aiKey: Boolean(c.anthropicKey),
      dayBudgetUsd: c.dayBudgetUsd,
      runBudgetUsd: c.runBudgetUsd,
      userDailyCap: c.userDailyCap,
      adminDailyCap: c.adminDailyCap,
      dailyRunCap: c.dailyRunCap,
      synthesisModel: c.synthesisModel,
      extractModel: c.extractModel,
      adminIdsFromEnv: c.adminUserIds.length,
      storage: (await detectStoreKind().catch(() => null)) ?? "unavailable",
    };
  } catch {
    return null;
  }
}

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context);
    // Lazy retention (at most once an hour per isolate) also runs when the panel opens, so
    // runs past 90 days are deleted even on days when nobody starts a run.
    try {
      const { storeForNewRun } = await import("@/lib/deep/persist.server");
      await (await storeForNewRun())?.purgeIfDue();
    } catch {
      // Retention is retried on the next start, list or panel view.
    }
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { bucharestDayStart } = await import("@/lib/deep/llm/ledger-memory.server");
    const dayStart = new Date(bucharestDayStart(Date.now())).toISOString();
    const [
      runs,
      enquiries,
      leads,
      profiles,
      subs,
      projects,
      messages,
      breaker,
      today,
      callRequests,
      feedback,
      settings,
      credits,
    ] = await Promise.all([
      db
        .from("deep_runs")
        .select(
          "id, user_id, cui, company_name, via, ai_mode, status, budget_usd, spent_usd, reserved_usd, created_at, last_activity_at, verify_code, metrics, error",
        )
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("contact_enquiries")
        .select("id, full_name, email, service, description, budget, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("audit_leads")
        .select("id, full_name, email, company, score, recommended_tier, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("profiles")
        .select("id, email, full_name, company, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      db.from("subscribers").select("user_id, email, tier, status, current_period_end"),
      db
        .from("projects")
        .select("id, user_id, title, status, current_step, next_action, updated_at")
        .order("updated_at", { ascending: false })
        .limit(100),
      db
        .from("messages")
        .select("id, user_id, project_id, sender, body, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("deep_breaker").select("until, reason").eq("id", 1).maybeSingle(),
      db
        .from("deep_runs")
        .select("spent_usd, reserved_usd")
        .gte("created_at", dayStart)
        .limit(5000),
      db
        .from("deep_call_requests")
        .select("id, run_id, user_id, email, phone, call_when, cui, lang, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("deep_feedback")
        .select("id, run_id, user_id, kind, fact_id, message, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      deepSettings(),
      db.from("deep_credits").select("user_id, plan, credits, updated_at"),
    ]);
    const runRows = (runs.data ?? []) as {
      spent_usd: number;
      reserved_usd: number;
      created_at: string;
    }[];
    const spent24h = runRows
      .filter((r) => r.created_at >= since)
      .reduce((s, r) => s + Number(r.spent_usd) + Number(r.reserved_usd), 0);
    const paused = Boolean(breaker.data && new Date(breaker.data.until).getTime() > Date.now());
    const spentToday = ((today.data ?? []) as { spent_usd: number; reserved_usd: number }[]).reduce(
      (s, r) => s + Number(r.spent_usd) + Number(r.reserved_usd),
      0,
    );
    return {
      runs: runs.data ?? [],
      spent24h,
      spentToday,
      paused,
      pausedUntil: paused ? (breaker.data?.until as string) : null,
      pauseReason: paused ? ((breaker.data?.reason as string | null) ?? null) : null,
      callRequests: callRequests.data ?? [],
      feedback: feedback.data ?? [],
      deep: settings,
      enquiries: enquiries.data ?? [],
      leads: leads.data ?? [],
      profiles: profiles.data ?? [],
      subscribers: subs.data ?? [],
      credits: (credits.data ?? []) as { user_id: string; plan: string; credits: number }[],
      projects: projects.data ?? [],
      messages: messages.data ?? [],
    };
  });

/**
 * Pause (for 30 days) or resume every paid AI call of deep research (the spend breaker that
 * deep_reserve checks). Runs keep going rules-only; DEEP_RESEARCH_MODE=disabled stops them.
 */
export const setResearchPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paused: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const until = data.paused ? new Date(Date.now() + 30 * 86400_000) : new Date();
    const { error } = await db
      .from("deep_breaker")
      .upsert({ id: 1, until: until.toISOString(), reason: "admin" });
    // A failed write must not be reported as a pause that did not happen.
    if (error) throw new Error("pause_failed");
    return { ok: true };
  });

export const updateClientProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.string().min(1).max(80),
        current_step: z.number().int().min(0).max(10),
        next_action: z.string().max(300).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const { id, ...rest } = data;
    const { error } = await db.from("projects").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const replyToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        projectId: z.string().uuid().nullable(),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    // The project must be this client's: a wrong pair would put the message, and another
    // client's project, in the wrong inbox.
    if (data.projectId) {
      const { data: project, error: lookup } = await db
        .from("projects")
        .select("user_id")
        .eq("id", data.projectId)
        .maybeSingle();
      if (lookup || !project || project.user_id !== data.userId)
        throw new Error("project_mismatch");
    }
    const { error } = await db.from("messages").insert({
      user_id: data.userId,
      project_id: data.projectId,
      sender: "team",
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Checks a plan gives when an admin sets it. */
export const PLAN_CHECKS = { free: 1, premium: 4 } as const;

/**
 * Sets an account's deep-research plan and/or its checks left. Choosing a plan resets the
 * checks to that plan's amount (free 1, premium 4); "credits" sets an exact number.
 */
export const setDeepCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        plan: z.enum(["free", "premium"]).optional(),
        credits: z.number().int().min(0).max(1000).optional(),
      })
      .refine((v) => v.plan !== undefined || v.credits !== undefined)
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const { data: existing } = await db
      .from("deep_credits")
      .select("plan, credits")
      .eq("user_id", data.userId)
      .maybeSingle();
    const plan = data.plan ?? (existing?.plan as "free" | "premium" | undefined) ?? "free";
    const credits = data.credits ?? (data.plan ? PLAN_CHECKS[data.plan] : (existing?.credits ?? 1));
    const { error } = await db.from("deep_credits").upsert({
      user_id: data.userId,
      plan,
      credits,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    });
    if (error) throw new Error("Could not save the plan");
    return { ok: true, plan, credits };
  });

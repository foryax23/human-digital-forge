import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ResearchAllowance } from "@/lib/client-plans";

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
      // The plan IDs whose clients get deep research reports (DEEP_RESEARCH_PREMIUM_TIERS).
      premiumTiers: c.premiumTiers,
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
    const { listActivePlans } = await import("@/lib/client-plans.server");
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
      plans,
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
      // Client plans (drizzle/pending/client_plans.sql): "missing" until Lovable applies it.
      listActivePlans(db),
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
      plans: plans.ok
        ? { status: "ready" as const, active: plans.value }
        : { status: plans.missing ? ("missing" as const) : ("error" as const), active: [] },
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

/* ------------------------------------------------------------------ client plans */

/** A calendar day, "YYYY-MM-DD", that exists (no 2026-02-30). */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "date");

/** Accounts by e-mail (or user ID), each with its active plan, to pick a client in the panel. */
export const findClientAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const { findAccounts } = await import("@/lib/client-plans.server");
    return { accounts: await findAccounts(db, data.query) };
  });

/**
 * One account's plan history (newest first) and, for the plan in force, its deep research this
 * period as the access check counts it (null while deep research is not in premium or code mode).
 */
export const getClientPlanHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const { readClientPlans } = await import("@/lib/client-plans.server");
    const { currentPlan, romanianDate } = await import("@/lib/client-plans");
    const read = await readClientPlans(db, data.userId);
    if (!read.ok)
      return {
        status: read.missing ? ("missing" as const) : ("error" as const),
        rows: [],
        research: null,
      };
    const current = currentPlan(read.value, romanianDate(Date.now()));
    let research: ResearchAllowance | null = null;
    try {
      const { readDeepConfig } = await import("@/lib/deep/env.server");
      const config = readDeepConfig();
      if (
        current &&
        (config.mode === "premium" || config.mode === "code") &&
        config.premiumTiers.includes(current.plan)
      ) {
        const { researchAllowance } = await import("@/lib/deep/access.server");
        const { storeForNewRun } = await import("@/lib/deep/persist.server");
        const store = await storeForNewRun().catch(() => null);
        research = await researchAllowance(data.userId, current.plan, "contract", { store });
      }
    } catch {
      research = null;
    }
    return { status: "ready" as const, rows: read.value, research };
  });

/**
 * Assigns a plan to a client account after the contract: the same plan edits the active record
 * (dates, contract), another plan ends it and starts a new one (src/lib/client-plans.server.ts).
 */
export const assignClientPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        plan: z.enum(["starter", "growth", "pro"]),
        startsOn: day,
        endsOn: day.nullable(),
        contractRef: z
          .string()
          .trim()
          .max(120)
          .nullable()
          .transform((v) => (v ? v : null)),
      })
      .refine((v) => !v.endsOn || v.endsOn >= v.startsOn, "plan_dates")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    // The account must exist (the row references auth.users; a clear error beats a 23503).
    const { data: found, error } = await db.auth.admin.getUserById(data.userId);
    if (error || !found?.user) throw new Error("account_not_found");
    const { setClientPlan } = await import("@/lib/client-plans.server");
    return setClientPlan(db, data, context.userId);
  });

/** Ends a client's active plan today (the record stays in the history). */
export const endClientPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const { endClientPlan: end } = await import("@/lib/client-plans.server");
    await end(db, data.planId, context.userId);
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
    return saveDeepCredits(db, context.userId, data);
  });

/**
 * The write behind setDeepCredits (service role, admin already checked). The current row is
 * read first so that setting only the number keeps the plan: a failed read refuses instead of
 * saving the free plan over a premium one. updated_by marks the checks as granted by an admin
 * (src/lib/deep/access.server.ts: a granted check needs no Google sign-in).
 */
export async function saveDeepCredits(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  adminId: string,
  input: { userId: string; plan?: "free" | "premium"; credits?: number },
  now = Date.now(),
): Promise<{ ok: true; plan: "free" | "premium"; credits: number }> {
  const { data: existing, error: readError } = await db
    .from("deep_credits")
    .select("plan, credits")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (readError) throw new Error("Could not read the plan");
  const row = existing as { plan?: string; credits?: number } | null;
  const plan = input.plan ?? (row?.plan === "premium" ? "premium" : "free");
  const credits = input.credits ?? (input.plan ? PLAN_CHECKS[input.plan] : (row?.credits ?? 1));
  const { error } = await db.from("deep_credits").upsert(
    {
      user_id: input.userId,
      plan,
      credits,
      updated_at: new Date(now).toISOString(),
      updated_by: adminId,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("Could not save the plan");
  return { ok: true, plan, credits };
}

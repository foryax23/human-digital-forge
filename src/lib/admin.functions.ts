import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminDb(context: { supabase: unknown; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = context.supabase as any;
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context);
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [runs, enquiries, leads, profiles, subs, projects, messages, breaker] = await Promise.all([
      db
        .from("deep_runs")
        .select("id, user_id, cui, company_name, via, status, spent_usd, reserved_usd, created_at")
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
      db.from("deep_breaker").select("until").eq("id", 1).maybeSingle(),
    ]);
    const runRows = (runs.data ?? []) as { spent_usd: number; reserved_usd: number; created_at: string }[];
    const spent24h = runRows
      .filter((r) => r.created_at >= since)
      .reduce((s, r) => s + Number(r.spent_usd) + Number(r.reserved_usd), 0);
    const paused = Boolean(breaker.data && new Date(breaker.data.until).getTime() > Date.now());
    return {
      runs: runs.data ?? [],
      spent24h,
      paused,
      enquiries: enquiries.data ?? [],
      leads: leads.data ?? [],
      profiles: profiles.data ?? [],
      subscribers: subs.data ?? [],
      projects: projects.data ?? [],
      messages: messages.data ?? [],
    };
  });

/** Pause (for 30 days) or resume all paid research runs. */
export const setResearchPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paused: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const until = data.paused ? new Date(Date.now() + 30 * 86400_000) : new Date();
    await db.from("deep_breaker").upsert({ id: 1, until: until.toISOString(), reason: "admin" });
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
    const { error } = await db
      .from("messages")
      .insert({ user_id: data.userId, project_id: data.projectId, sender: "team", body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

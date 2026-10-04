import {
  currentPlan,
  isClientPlanId,
  planState,
  romanianDate,
  type AccountMatch,
  type ClientPlanId,
  type ClientPlanRow,
} from "./client-plans";

/*
 * public.client_plans through the service-role client (drizzle/pending/client_plans.sql).
 * Until the owner has Lovable apply drizzle/pending/client_plans.sql the table does not exist: reads report it ("missing") and the
 * callers treat plans as unavailable, so nothing else changes. Writes are admin actions:
 * src/lib/admin.functions.ts checks the admin role on the server before calling them.
 *
 * Rows are a history: at most one row per account is "active" (a partial unique index).
 * Assigning another plan ends the active row and adds a new one; editing the dates or the
 * contract of the same plan edits the active row.
 */

/**
 * The query surface used here (supabase-js, or the tests' fake). Untyped: the table is not
 * in the generated types until that file is applied and Lovable regenerates them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PlanDb = { from(table: string): any };

export const PLAN_COLUMNS =
  "id, user_id, plan, status, starts_on, ends_on, contract_ref, assigned_by, ended_at, ended_by, created_at, updated_at";

type DbError = { code?: string; message?: string } | null | undefined;

/** PostgREST's "not in the schema cache" or Postgres' "undefined table": the table is not there yet. */
export function isMissingTable(error: DbError): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export type PlanRead<T> = { ok: true; value: T } | { ok: false; missing: boolean };

const table = (db: PlanDb) => db.from("client_plans");

/** The account's plan rows, newest first. */
export async function readClientPlans(
  db: PlanDb,
  userId: string,
): Promise<PlanRead<ClientPlanRow[]>> {
  try {
    const { data, error } = await table(db)
      .select(PLAN_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false, missing: isMissingTable(error) };
    return { ok: true, value: (data as ClientPlanRow[] | null) ?? [] };
  } catch {
    return { ok: false, missing: false };
  }
}

/** The account's plan in force today (Romanian calendar), null, "missing" (no table) or "error". */
export async function currentClientPlan(
  db: PlanDb,
  userId: string,
  now = Date.now(),
): Promise<ClientPlanRow | null | "missing" | "error"> {
  try {
    const { data, error } = await table(db)
      .select(PLAN_COLUMNS)
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return isMissingTable(error) ? "missing" : "error";
    return currentPlan((data as ClientPlanRow[] | null) ?? [], romanianDate(now));
  } catch {
    return "error";
  }
}

/** Every active row (current, scheduled or past its last day), newest first, for the admin panel. */
export async function listActivePlans(db: PlanDb, limit = 200): Promise<PlanRead<ClientPlanRow[]>> {
  try {
    const { data, error } = await table(db)
      .select(PLAN_COLUMNS)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { ok: false, missing: isMissingTable(error) };
    return { ok: true, value: (data as ClientPlanRow[] | null) ?? [] };
  } catch {
    return { ok: false, missing: false };
  }
}

export type SetPlanInput = {
  userId: string;
  plan: ClientPlanId;
  /** "YYYY-MM-DD", first day (Romania). */
  startsOn: string;
  /** "YYYY-MM-DD", last day included, or null: until the plan is ended. */
  endsOn: string | null;
  contractRef: string | null;
};

/**
 * Assigns a plan to an account (the admin's ID goes into the row). The same plan as the
 * active row edits that row; another plan ends it and starts a new row, and if the new row
 * cannot be written the old one is made active again. Throws "plans_unavailable" without
 * the table, "plan_write_failed" when a write did not happen.
 */
export async function setClientPlan(
  db: PlanDb,
  input: SetPlanInput,
  adminId: string,
  now = Date.now(),
): Promise<{ action: "created" | "changed" | "updated"; id: string }> {
  if (!isClientPlanId(input.plan)) throw new Error("plan_invalid");
  if (input.endsOn && input.endsOn < input.startsOn) throw new Error("plan_dates");
  const { data, error } = await table(db)
    .select(PLAN_COLUMNS)
    .eq("user_id", input.userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(isMissingTable(error) ? "plans_unavailable" : "plan_read_failed");
  const active = ((data as ClientPlanRow[] | null) ?? [])[0];
  const stamp = new Date(now).toISOString();
  const fields = {
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    contract_ref: input.contractRef,
  };

  if (active && active.plan === input.plan) {
    const { data: rows, error: e } = await table(db)
      .update({ ...fields, updated_at: stamp })
      .eq("id", active.id)
      .eq("status", "active")
      .select("id");
    if (e || !Array.isArray(rows) || rows.length === 0) throw new Error("plan_write_failed");
    return { action: "updated", id: active.id };
  }

  if (active) {
    const { data: ended, error: e } = await table(db)
      .update({ status: "ended", ended_at: stamp, ended_by: adminId, updated_at: stamp })
      .eq("id", active.id)
      .eq("status", "active")
      .select("id");
    if (e || !Array.isArray(ended) || ended.length === 0) throw new Error("plan_write_failed");
  }

  const { data: created, error: insertError } = await table(db)
    .insert({
      user_id: input.userId,
      plan: input.plan,
      status: "active",
      ...fields,
      assigned_by: adminId,
    })
    .select("id")
    .single();
  const id = (created as { id?: string } | null)?.id;
  if (insertError || !id) {
    // The client keeps the plan they had rather than none (best effort; the error stands).
    if (active) {
      try {
        await table(db)
          .update({ status: "active", ended_at: null, ended_by: null, updated_at: stamp })
          .eq("id", active.id)
          .eq("status", "ended");
      } catch {
        // The admin sees the error and saves again.
      }
    }
    throw new Error("plan_write_failed");
  }
  return { action: active ? "changed" : "created", id };
}

/** Ends an active plan now. Throws "plan_not_active" when the row is not active (or not found). */
export async function endClientPlan(
  db: PlanDb,
  planId: string,
  adminId: string,
  now = Date.now(),
): Promise<void> {
  const stamp = new Date(now).toISOString();
  const { data, error } = await table(db)
    .update({ status: "ended", ended_at: stamp, ended_by: adminId, updated_at: stamp })
    .eq("id", planId)
    .eq("status", "active")
    .select("id");
  if (error) throw new Error(isMissingTable(error) ? "plans_unavailable" : "plan_write_failed");
  if (!Array.isArray(data) || data.length === 0) throw new Error("plan_not_active");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accounts whose e-mail contains `query` (case-insensitive, at least 3 characters), or the
 * account with that user ID; at most 10, newest first, each with its active plan.
 */
export async function findAccounts(
  db: PlanDb,
  query: string,
  now = Date.now(),
): Promise<AccountMatch[]> {
  const q = query.trim().toLowerCase();
  const byId = UUID.test(q);
  if (!byId && q.length < 3) return [];
  let request = db.from("profiles").select("id, email, full_name, company, created_at");
  request = byId
    ? request.eq("id", q)
    : request.ilike("email", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, error } = await request.order("created_at", { ascending: false }).limit(10);
  if (error) throw new Error("search_failed");
  const profiles =
    (data as Array<{
      id: string;
      email: string | null;
      full_name: string | null;
      company: string | null;
    }> | null) ?? [];
  if (!profiles.length) return [];
  const plans = new Map<string, ClientPlanRow>();
  const { data: rows, error: planError } = await table(db)
    .select(PLAN_COLUMNS)
    .in(
      "user_id",
      profiles.map((p) => p.id),
    )
    .eq("status", "active");
  if (!planError)
    for (const r of (rows as ClientPlanRow[] | null) ?? [])
      if (!plans.has(r.user_id)) plans.set(r.user_id, r);
  const today = romanianDate(now);
  return profiles.map((p) => {
    const row = plans.get(p.id);
    return {
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      company: p.company,
      plan: row ? { id: row.id, plan: row.plan, state: planState(row, today) } : null,
    };
  });
}

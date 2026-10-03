import process from "node:process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { bucharestDayStart } from "./llm/ledger-memory.server";

/* -------------------------------------------------- the hand-written schema */

type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Row>; Relationships: [] };
type Fn<Args, Returns> = { Args: Args; Returns: Returns };

type AuditLeadRow = {
  id: string;
  created_at: string;
  email: string;
  full_name: string | null;
  company: string | null;
  language: string;
  score: number;
  recommended_tier: string | null;
  recommendation: string | null;
  answers: unknown;
};
type DeepRunRow = {
  id: string;
  user_id: string;
  cui: string;
  company_name: string | null;
  relationship: string;
  lang: string;
  access_via: string;
  status: string;
  ai_mode: string;
  budget_usd: number;
  reserved_usd: number;
  spent_usd: number;
  report: unknown;
  report_att: string | null;
  verify_code: string | null;
  consent: unknown;
  metrics: unknown;
  error: string | null;
  created_at: string;
  last_activity_at: string;
  finished_at: string | null;
  expires_at: string;
};
type DeepFeedbackRow = {
  id: number;
  run_id: string | null;
  user_id: string | null;
  kind: string;
  fact_id: string | null;
  message: string | null;
  value: unknown;
  created_at: string;
};

/**
 * The tables and functions deep research reads (docs/deep/2026-10-03-deep-research.sql
 * and the existing audit_leads and subscribers), written by hand so the generated
 * src/integrations/supabase/types.ts is never edited and the code compiles before
 * the SQL file is applied.
 */
export type DeepDatabase = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      audit_leads: Table<AuditLeadRow, Partial<AuditLeadRow> & { email: string }>;
      subscribers: Table<
        {
          id: string;
          user_id: string | null;
          email: string;
          status: string;
          tier: string | null;
          current_period_end: string | null;
        },
        { email: string }
      >;
      deep_runs: Table<DeepRunRow, Partial<DeepRunRow>>;
      deep_steps: Table<
        {
          run_id: string;
          step_key: string;
          used: number;
          in_flight_at: string | null;
          result: unknown;
          updated_at: string;
        },
        { run_id: string; step_key: string }
      >;
      deep_settings: Table<
        { key: string; value: unknown; updated_at: string },
        { key: string; value: unknown }
      >;
      deep_feedback: Table<DeepFeedbackRow, Partial<DeepFeedbackRow> & { kind: string }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      deep_start_run: Fn<
        {
          p_user: string;
          p_cui: string;
          p_company: string | null;
          p_relationship: string;
          p_lang: string;
          p_via: string;
          p_budget: number;
          p_ai_mode: string;
          p_consent: unknown;
          p_user_cap: number;
          p_global_cap: number;
          p_allow_same_company: boolean;
        },
        Array<{ run_id: string | null; reason: string; replay_run: string | null }>
      >;
      deep_reserve: Fn<
        {
          p_run: string;
          p_idem: string;
          p_kind: string;
          p_step: string;
          p_model: string | null;
          p_usd: number;
          p_day_cap: number;
        },
        Array<{ call_id: number | null; reason: string; replay: unknown }>
      >;
      deep_settle: Fn<
        {
          p_call: number;
          p_usd: number;
          p_in: number;
          p_out: number;
          p_cache_read: number;
          p_cache_write: number;
          p_result: unknown;
        },
        number | null
      >;
      deep_claim_step: Fn<
        {
          p_run: string;
          p_user: string;
          p_key: string;
          p_max: number;
          p_units: number;
          p_exclusive: boolean;
        },
        Array<{ claim_id: number | null; reason: string; granted: number; replay: unknown }>
      >;
      deep_settle_step: Fn<
        { p_run: string; p_claim: number; p_used: number | null; p_result: unknown },
        undefined
      >;
      deep_finish: Fn<
        {
          p_run: string;
          p_status: string;
          p_report: unknown;
          p_att: string | null;
          p_code: string | null;
          p_metrics: unknown;
          p_error: string | null;
        },
        undefined
      >;
      deep_trip_breaker: Fn<{ p_minutes: number; p_reason: string }, undefined>;
      deep_day_stats: Fn<
        { p_user: string },
        Array<{ user_runs: number; all_runs: number; all_usd: number }>
      >;
      deep_purge_expired: Fn<Record<string, never>, number>;
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

/*
 * The database handle both deep-research stores use (plan A6). The server
 * creates its own service-role client, reading the environment per call
 * (Workers bind env per request, src/lib/config.server.ts), and never edits
 * the generated src/integrations/supabase/types.ts: the deep tables may not
 * exist yet, so the client is untyped and every row is read through the
 * narrow types below. Tests pass a fake with the same query surface; nothing
 * here ever touches the real database in a test.
 */

export type DeepDb = SupabaseClient<DeepDatabase>;

/** A Postgres or PostgREST error as supabase-js returns it. */
export type DbError = { code?: string; message?: string; details?: string } | null;

let cached: { key: string; db: DeepDb } | undefined;

/** The service-role client, or null when the server has no Supabase credentials. */
export function deepDb(source: Record<string, string | undefined> = process.env): DeepDb | null {
  const url = source.SUPABASE_URL?.trim();
  const key = source.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  const id = `${url}|${key.slice(-12)}`;
  if (cached?.key === id) return cached.db;
  const db = createClient<DeepDatabase>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  cached = { key: id, db };
  return db;
}

/** Error codes meaning "this table or function does not exist (yet)". */
export function isMissingRelation(error: DbError): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.code === "42883"
  );
}

/** Start of today in Europe/Bucharest as an ISO timestamp (the caps' and budget's day). */
export function dayStartIso(now: number): string {
  return new Date(bucharestDayStart(now)).toISOString();
}

/** Jittered backoff for compare-and-swap retries: 40–120 ms, doubling. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  return Math.round((40 + random() * 80) * 2 ** attempt);
}

export const DAY_MS = 24 * 60 * 60_000;

/** Whole numbers from PostgREST (numeric columns may arrive as strings). */
export const toNumber = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

/** "Sună-mă" requests per account and day. */
export const CALL_REQUESTS_DAILY = 3;

/** Feedback limits per account and day (A12): error reports 20, everything else 50. */
export const FEEDBACK_DAILY = { error_report: 20, other: 50 } as const;

/**
 * "Sună-mă" (A6, A10): a real lead the person asked for, kept like other leads
 * (24 months) in audit_leads with their account e-mail, phone and preferred
 * time. Legal basis art. 6(1)(b): taking steps at the person's request.
 * Shared by both stores (the call request never depends on the deep tables).
 */
export async function insertCallRequest(
  db: DeepDb,
  row: {
    runId: string;
    userId: string;
    email: string;
    phone: string;
    when: string;
    cui: string;
    lang: "ro" | "en";
  },
  now: number,
): Promise<void> {
  // At most CALL_REQUESTS_DAILY a day per account: "Sună-mă" creates a lead row each time.
  const { count, error: countError } = await db
    .from("audit_leads")
    .select("id", { count: "exact", head: true })
    .eq("recommendation", "deep-call-request")
    .eq("answers->>userId", row.userId)
    .gte("answers->>requestedAt", dayStartIso(now));
  if (countError) throw new Error(`call_request: ${countError.message ?? countError.code}`);
  if ((count ?? 0) >= CALL_REQUESTS_DAILY) throw new Error("call_limit");
  const { error } = await db.from("audit_leads").insert({
    email: row.email || "deep-call@invalid",
    full_name: null,
    company: null,
    language: row.lang,
    score: 0,
    recommended_tier: null,
    recommendation: "deep-call-request",
    answers: {
      source: "vortex-deep",
      kind: "call-request",
      v: 1,
      runId: row.runId,
      userId: row.userId,
      cui: row.cui,
      phone: row.phone,
      when: row.when,
      lang: row.lang,
      basis: "GDPR art. 6(1)(b) (call requested by the person)",
      requestedAt: new Date(now).toISOString(),
    },
  });
  if (error) throw new Error(`call_request: ${error.message ?? error.code ?? "error"}`);
}

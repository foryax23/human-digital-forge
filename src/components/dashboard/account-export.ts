/*
 * "Descarcă datele mele" (GDPR art. 15 and 20): a JSON file with the account's own rows,
 * built in the browser with the account's own session. Row-level security decides what each
 * read returns; every read also filters on the account's ID, so even a looser policy could
 * not add someone else's rows. The service role is never used in the browser.
 *
 * The rows the team keeps and the account cannot read (TEAM_TABLES: Deep Research runs,
 * their feedback and call requests, contact enquiries and Vortex Scan report requests) come
 * from the server (getMyTeamHeldData in src/lib/account.functions.ts), which reads them with
 * the service role, filtered on the account's ID or its verified e-mail address only.
 *
 * A table that does not exist yet (a pending migration: PGRST205 / 42P01) or that the account
 * may not read (42501) is listed under `skipped` instead of failing the whole file.
 */

import type { Json } from "@/integrations/supabase/types";
import { COMPANY } from "@/lib/scan/legal/company";

export type ExportLang = "en" | "ro";

/** The tables a client can read through RLS, with the column that holds the account ID. */
export const EXPORT_TABLES = [
  { table: "profiles", owner: "id", order: "id" },
  { table: "projects", owner: "user_id", order: "created_at" },
  { table: "messages", owner: "user_id", order: "created_at" },
  { table: "project_files", owner: "user_id", order: "created_at" },
  { table: "consultations", owner: "user_id", order: "created_at" },
  { table: "invoices", owner: "user_id", order: "issued_at" },
  { table: "subscribers", owner: "user_id", order: "created_at" },
  { table: "client_plans", owner: "user_id", order: "created_at" },
  { table: "deep_credits", owner: "user_id", order: "user_id" },
  { table: "user_roles", owner: "user_id", order: "created_at" },
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number]["table"];

/**
 * Tables with RLS on and no client policy: read on the server. `user_id` rows belong to the
 * account; `email` rows were sent from the account's verified address (forms need no account).
 */
export const TEAM_TABLES = [
  { table: "deep_runs", owner: "user_id", order: "created_at" },
  { table: "deep_feedback", owner: "user_id", order: "created_at" },
  { table: "deep_call_requests", owner: "user_id", order: "created_at" },
  { table: "enquiries", owner: "email", order: "created_at" },
  { table: "audit_leads", owner: "email", order: "created_at" },
] as const;

export type TeamTable = (typeof TEAM_TABLES)[number]["table"];

/** What the server read for the account: off when it has no database access. */
export type TeamHeld =
  | {
      status: "ok";
      /** Database rows, JSON as PostgREST returns them (the server function serialises them). */
      tables: Partial<Record<TeamTable, Json[]>>;
      skipped: Array<{ table: TeamTable; reason: SkipReason }>;
      /** False when the account has no verified address: enquiries and leads were not read. */
      emailMatched: boolean;
    }
  | { status: "unavailable" };

const PAGE = 1000;
const MAX_PAGES = 20;

type QueryError = { code?: string; message?: string } | null;
type PageResult = { data: unknown[] | null; error: QueryError };

/** The slice of the Supabase client the export uses (so the tests can pass a fake). */
export interface ExportDb {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        order(
          column: string,
          options: { ascending: boolean },
        ): {
          range(from: number, to: number): PromiseLike<PageResult>;
        };
      };
    };
  };
}

export interface ExportUser {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  app_metadata?: { provider?: string; providers?: string[] } | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: Array<{ provider?: string | null; created_at?: string | null }> | null;
}

export type SkipReason = "not_set_up" | "not_allowed" | "failed";

export interface AccountExport {
  format: "vortex-hub-account-export";
  version: 1;
  generatedAt: string;
  language: ExportLang;
  account: {
    id: string;
    email: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
    emailConfirmedAt: string | null;
    signInMethods: string[];
    profileDetails: Record<string, unknown>;
  };
  tables: Partial<Record<ExportTable | TeamTable, unknown[]>>;
  skipped: Array<{ table: ExportTable | TeamTable; reason: SkipReason }>;
  notes: string[];
}

function skipReason(error: QueryError): SkipReason {
  const code = error?.code ?? "";
  if (code === "PGRST205" || code === "42P01" || code === "PGRST106") return "not_set_up";
  if (code === "42501" || code === "PGRST301") return "not_allowed";
  return "failed";
}

async function readAll(
  db: ExportDb,
  spec: { table: string; owner: string; order: string },
  userId: string,
): Promise<{ rows: unknown[] } | { reason: SkipReason }> {
  const rows: unknown[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE;
    const { data, error } = await db
      .from(spec.table)
      .select("*")
      .eq(spec.owner, userId)
      .order(spec.order, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { reason: skipReason(error) };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return { rows };
}

/** The sign-in methods on the account ("email", "google"). */
export function signInMethods(user: ExportUser): string[] {
  const set = new Set<string>();
  for (const p of user.app_metadata?.providers ?? []) if (p) set.add(p);
  if (user.app_metadata?.provider) set.add(user.app_metadata.provider);
  for (const i of user.identities ?? []) if (i?.provider) set.add(i.provider);
  return [...set].sort();
}

/**
 * Whether the account signs in only through Google (or another provider) and has no
 * password: then there is no password to change here. Unknown methods count as "has a
 * password", so the form shows rather than hides.
 */
export function isPasswordless(user: ExportUser): boolean {
  const methods = signInMethods(user);
  return methods.length > 0 && !methods.includes("email");
}

/**
 * Reads the team-held tables for one account, on the server, with a client that bypasses
 * RLS: every read is filtered on `userId` or on `verifiedEmail` (lowercase, from the auth
 * record, only when confirmed), so nothing else can come back. Missing tables are skipped.
 */
export async function readTeamHeld(
  db: ExportDb,
  userId: string,
  verifiedEmail: string | null,
): Promise<TeamHeld> {
  const tables: Partial<Record<TeamTable, Json[]>> = {};
  const skipped: Array<{ table: TeamTable; reason: SkipReason }> = [];
  for (const spec of TEAM_TABLES) {
    const value = spec.owner === "email" ? verifiedEmail : userId;
    if (!value) continue;
    const result = await readAll(db, spec, value);
    if ("rows" in result) tables[spec.table] = result.rows as Json[];
    else skipped.push({ table: spec.table, reason: result.reason });
  }
  return { status: "ok", tables, skipped, emailMatched: Boolean(verifiedEmail) };
}

const NOTE = {
  rows: {
    ro: "Fișierul conține rândurile contului tău din baza de date Vortex Hub, așa cum le poți citi din cont.",
    en: "This file holds your account's rows in the Vortex Hub database, as your account can read them.",
  },
  files: {
    ro: "Fișierele încărcate (documente, imagini) nu sunt în acest JSON; tabelul project_files le listează, iar pe fiecare îl descarci din pagina Fișiere.",
    en: "Uploaded files (documents, images) are not in this JSON; the project_files table lists them, and you download each one from the Files page.",
  },
  team: {
    ro: "Sunt incluse și datele păstrate de echipă: rapoartele Deep Research ale contului, părerile și cererile de apel trimise din ele, plus cererile din formulare și cererile de raport Vortex Scan trimise de pe adresa ta de e-mail confirmată.",
    en: "The data the team keeps is included too: the account's Deep Research reports, the feedback and call requests sent from them, and the form enquiries and Vortex Scan report requests sent from your confirmed e-mail address.",
  },
  noEmail: {
    ro: `Contul nu are o adresă de e-mail confirmată, așa că cererile din formulare și cererile de raport Vortex Scan nu sunt incluse. Ți le trimitem la cerere: scrie-ne la ${COMPANY.email}.`,
    en: `The account has no confirmed e-mail address, so form enquiries and Vortex Scan report requests are not included. We send them on request: write to ${COMPANY.email}.`,
  },
  onRequest: {
    ro: `Rapoartele Deep Research, cererile trimise prin formularul de contact și verificările Vortex Scan sunt păstrate de echipă. Ți le trimitem la cerere: scrie-ne la ${COMPANY.email}.`,
    en: `Deep Research reports, contact form enquiries and Vortex Scan checks are kept by the team. We send them on request: write to ${COMPANY.email}.`,
  },
  stripe: {
    ro: "Datele de plată prin card sunt la Stripe, nu la noi.",
    en: "Card payment details are held by Stripe, not by us.",
  },
} satisfies Record<string, Record<ExportLang, string>>;

function notesFor(lang: ExportLang, team: TeamHeld): string[] {
  const teamNotes =
    team.status === "ok"
      ? [NOTE.team, ...(team.emailMatched ? [] : [NOTE.noEmail])]
      : [NOTE.onRequest];
  return [NOTE.rows, NOTE.files, ...teamNotes, NOTE.stripe].map((note) => note[lang]);
}

export async function buildAccountExport(
  db: ExportDb,
  user: ExportUser,
  lang: ExportLang,
  now: Date = new Date(),
  team: TeamHeld = { status: "unavailable" },
): Promise<AccountExport> {
  const tables: AccountExport["tables"] = {};
  const skipped: AccountExport["skipped"] = [];
  // One table after another: a handful of small reads, and no burst on the API.
  for (const spec of EXPORT_TABLES) {
    const result = await readAll(db, spec, user.id);
    if ("rows" in result) tables[spec.table] = result.rows;
    else skipped.push({ table: spec.table, reason: result.reason });
  }
  if (team.status === "ok") {
    Object.assign(tables, team.tables);
    skipped.push(...team.skipped);
  }
  return {
    format: "vortex-hub-account-export",
    version: 1,
    generatedAt: now.toISOString(),
    language: lang,
    account: {
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      signInMethods: signInMethods(user),
      profileDetails: { ...(user.user_metadata ?? {}) },
    },
    tables,
    skipped,
    notes: notesFor(lang, team),
  };
}

/** "vortex-hub-datele-mele-2026-10-04.json" */
export function exportFileName(now: Date = new Date(), lang: ExportLang = "ro"): string {
  const day = now.toISOString().slice(0, 10);
  return lang === "ro" ? `vortex-hub-datele-mele-${day}.json` : `vortex-hub-my-data-${day}.json`;
}

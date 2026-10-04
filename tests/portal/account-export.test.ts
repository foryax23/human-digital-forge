import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EXPORT_TABLES,
  TEAM_TABLES,
  buildAccountExport,
  exportFileName,
  isPasswordless,
  readTeamHeld,
  signInMethods,
  type ExportDb,
} from "../../src/components/dashboard/account-export";

const USER = "bbbbbbbb-0000-4000-8000-000000000002";
const OTHER = "cccccccc-0000-4000-8000-000000000003";

type Row = Record<string, unknown>;
type Call = { table: string; column: string; value: string; from: number; to: number };

/**
 * A fake Supabase client: rows per table (some belonging to another account, as a looser
 * policy might return them), optional errors per table, and a log of every read.
 */
function fakeDb(
  rows: Record<string, Row[]>,
  errors: Record<string, { code: string; message?: string }> = {},
) {
  const calls: Call[] = [];
  const db: ExportDb = {
    from(table) {
      return {
        select() {
          return {
            eq(column, value) {
              return {
                order() {
                  return {
                    range(from, to) {
                      calls.push({ table, column, value, from, to });
                      if (errors[table])
                        return Promise.resolve({ data: null, error: errors[table] });
                      const mine = (rows[table] ?? []).filter((r) => r[column] === value);
                      return Promise.resolve({ data: mine.slice(from, to + 1), error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { db, calls };
}

const user = {
  id: USER,
  email: "ana@firma-test.ro",
  created_at: "2026-09-01T08:00:00Z",
  last_sign_in_at: "2026-10-04T08:00:00Z",
  email_confirmed_at: "2026-09-01T08:05:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Ana Pop" },
};

test("export: every client table, filtered on the account's own ID", async () => {
  const { db, calls } = fakeDb({
    profiles: [
      { id: USER, full_name: "Ana Pop" },
      { id: OTHER, full_name: "Ion" },
    ],
    projects: [
      { id: "p1", user_id: USER, title: "Site" },
      { id: "p2", user_id: OTHER, title: "Not mine" },
    ],
    messages: [{ id: "m1", user_id: USER, sender: "team", body: "Salut" }],
  });
  const file = await buildAccountExport(db, user, "ro", new Date("2026-10-04T10:00:00Z"));
  assert.equal(file.format, "vortex-hub-account-export");
  assert.equal(file.generatedAt, "2026-10-04T10:00:00.000Z");
  assert.deepEqual(file.tables.profiles, [{ id: USER, full_name: "Ana Pop" }]);
  assert.deepEqual(file.tables.projects, [{ id: "p1", user_id: USER, title: "Site" }]);
  assert.equal(file.tables.messages?.length, 1);
  assert.deepEqual(file.skipped, []);
  // One read per table, each on the owner column with the account's ID.
  assert.equal(calls.length, EXPORT_TABLES.length);
  for (const call of calls) {
    assert.equal(call.value, USER);
    assert.equal(call.column, call.table === "profiles" ? "id" : "user_id");
  }
  assert.equal(file.account.email, "ana@firma-test.ro");
  assert.deepEqual(file.account.signInMethods, ["email"]);
  assert.ok(file.notes.length >= 3);
  assert.match(file.notes.join(" "), /Stripe/);
});

test("export: a table not set up yet or not readable is listed, not fatal", async () => {
  const { db } = fakeDb(
    { projects: [{ id: "p1", user_id: USER }] },
    {
      client_plans: { code: "PGRST205", message: "Could not find the table" },
      deep_credits: { code: "42P01" },
      user_roles: { code: "42501" },
      invoices: { code: "XX000" },
    },
  );
  const file = await buildAccountExport(db, user, "en");
  assert.deepEqual(
    file.skipped.sort((a, b) => a.table.localeCompare(b.table)),
    [
      { table: "client_plans", reason: "not_set_up" },
      { table: "deep_credits", reason: "not_set_up" },
      { table: "invoices", reason: "failed" },
      { table: "user_roles", reason: "not_allowed" },
    ],
  );
  assert.equal(file.tables.projects?.length, 1);
  assert.equal(file.tables.client_plans, undefined);
});

test("export: reads past the 1000-row page", async () => {
  const many = Array.from({ length: 2345 }, (_, i) => ({ id: `m${i}`, user_id: USER }));
  const { db, calls } = fakeDb({ messages: many });
  const file = await buildAccountExport(db, user, "ro");
  assert.equal(file.tables.messages?.length, 2345);
  const pages = calls.filter((c) => c.table === "messages").map((c) => [c.from, c.to]);
  assert.deepEqual(pages, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

test("team-held: deep tables by the account ID, form tables by the confirmed address only", async () => {
  const { db, calls } = fakeDb({
    deep_runs: [
      { id: "r1", user_id: USER, cui: "123" },
      { id: "r2", user_id: OTHER, cui: "456" },
    ],
    deep_call_requests: [{ id: "c1", user_id: USER, phone: "07" }],
    enquiries: [
      { id: "e1", email: "ana@firma-test.ro", message: "Salut" },
      { id: "e2", email: "ion@alt.ro", message: "Nu e al meu" },
    ],
    audit_leads: [{ id: "l1", email: "ion@alt.ro" }],
  });
  const team = await readTeamHeld(db, USER, "ana@firma-test.ro");
  assert.equal(team.status, "ok");
  if (team.status !== "ok") return;
  assert.deepEqual(team.tables.deep_runs, [{ id: "r1", user_id: USER, cui: "123" }]);
  assert.equal(team.tables.deep_call_requests?.length, 1);
  assert.deepEqual(
    team.tables.enquiries?.map((row) => (row as { id: string }).id),
    ["e1"],
  );
  assert.deepEqual(team.tables.audit_leads, []);
  assert.equal(team.emailMatched, true);
  // Every read is filtered on the account: its ID, or its confirmed address.
  assert.equal(calls.length, TEAM_TABLES.length);
  for (const call of calls) {
    const byEmail = call.table === "enquiries" || call.table === "audit_leads";
    assert.equal(call.column, byEmail ? "email" : "user_id");
    assert.equal(call.value, byEmail ? "ana@firma-test.ro" : USER);
  }

  // Merged into the same file, with the note saying they are included.
  const file = await buildAccountExport(db, user, "ro", new Date(), team);
  assert.equal(file.tables.deep_runs?.length, 1);
  assert.equal(file.tables.projects?.length, 0);
  assert.match(file.notes.join(" "), /Sunt incluse și datele păstrate de echipă/);
});

test("team-held: no confirmed address, no form tables read; unavailable, the on-request note", async () => {
  const { db, calls } = fakeDb(
    { enquiries: [{ id: "e1", email: "ana@firma-test.ro" }] },
    { deep_feedback: { code: "42P01" } },
  );
  const team = await readTeamHeld(db, USER, null);
  assert.equal(team.status, "ok");
  if (team.status !== "ok") return;
  assert.equal(team.emailMatched, false);
  assert.equal(team.tables.enquiries, undefined);
  assert.deepEqual(team.skipped, [{ table: "deep_feedback", reason: "not_set_up" }]);
  assert.ok(calls.every((call) => call.column === "user_id" && call.value === USER));

  const without = await buildAccountExport(db, user, "en", new Date(), team);
  assert.match(without.notes.join(" "), /no confirmed e-mail address/);
  assert.ok(without.skipped.some((s) => s.table === "deep_feedback"));

  const unavailable = await buildAccountExport(db, user, "en");
  assert.match(unavailable.notes.join(" "), /We send them on request/);
  assert.equal(unavailable.tables.deep_runs, undefined);
});

test("sign-in methods: Google-only accounts have no password to change", () => {
  const google = { id: USER, app_metadata: { provider: "google", providers: ["google"] } };
  assert.deepEqual(signInMethods(google), ["google"]);
  assert.equal(isPasswordless(google), true);
  assert.equal(
    isPasswordless({
      id: USER,
      app_metadata: { provider: "google", providers: ["google", "email"] },
    }),
    false,
  );
  assert.equal(isPasswordless({ id: USER, identities: [{ provider: "email" }] }), false);
  // Unknown: show the password form rather than hide it.
  assert.equal(isPasswordless({ id: USER }), false);
  assert.equal(isPasswordless({ id: USER, app_metadata: null, identities: [] }), false);
});

test("file name: dated, in the page's language", () => {
  const day = new Date("2026-10-04T23:30:00Z");
  assert.equal(exportFileName(day, "ro"), "vortex-hub-datele-mele-2026-10-04.json");
  assert.equal(exportFileName(day, "en"), "vortex-hub-my-data-2026-10-04.json");
});

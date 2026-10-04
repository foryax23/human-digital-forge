import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkDeepAccess,
  resetRoleCache,
  supabaseLookups,
  type AccessLookups,
  type AccountInfo,
} from "../../../src/lib/deep/access.server";
import { readDeepConfig } from "../../../src/lib/deep/env.server";
import { createMemoryStore } from "../../../src/lib/deep/llm/ledger-memory.server";
import type { DeepDb } from "../../../src/lib/deep/persist-db.server";
import { createTablesStore } from "../../../src/lib/deep/persist-tables.server";
import {
  currentPlan,
  hoursPerMonthLabel,
  planState,
  reportsLabel,
  researchPeriod,
  romanianDate,
  type ClientPlanRow,
} from "../../../src/lib/client-plans";
import {
  currentClientPlan,
  endClientPlan,
  findAccounts,
  listActivePlans,
  readClientPlans,
  setClientPlan,
  type PlanDb,
} from "../../../src/lib/client-plans.server";
import { planReportsUsedCopy, planStartsLaterCopy } from "../../../src/components/deep/copy";
import { formatRenewalDay } from "../../../src/lib/client-plans";
import { FakeSupabase, type DbError } from "../persist/fake-supabase";
import { installLovableLedger } from "../persist/fake-lovable-sql";

/*
 * Client plans (drizzle/pending/client_plans.sql) and the deep research they include:
 * Romanian calendar periods, the plan records an admin writes, and the access check's per-plan
 * report quotas, against the fake Supabase client. No network, no database.
 */

const USER = "bbbbbbbb-0000-4000-8000-000000000002";
const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER = "cccccccc-0000-4000-8000-000000000003";
const iso = (s: string) => new Date(s).toISOString();
/** Tuesday 20 October 2026, 13:00 in Romania. */
const NOW = Date.parse("2026-10-20T10:00:00Z");

/* ------------------------------------------------------------ the fake table */

/** The SQL defaults of client_plans, for the fake's inserts. */
function withPlansTable(db: FakeSupabase) {
  db.defaults.client_plans = (now) => ({
    status: "active",
    starts_on: romanianDate(now),
    ends_on: null,
    contract_ref: null,
    assigned_by: null,
    ended_at: null,
    ended_by: null,
    updated_at: new Date(now).toISOString(),
  });
  return db;
}

/** PostgREST's ilike for the fake (profiles search): % and _ wildcards, \ escapes, any case. */
function addIlike() {
  const proto = Object.getPrototypeOf(new FakeSupabase().from("profiles")) as Record<
    string,
    unknown
  >;
  if (proto.ilike) return;
  proto.ilike = function (
    this: { filters: Array<(row: Record<string, unknown>) => boolean> },
    column: string,
    pattern: string,
  ) {
    let re = "";
    for (let i = 0; i < pattern.length; i++) {
      const c = pattern[i];
      if (c === "\\" && i + 1 < pattern.length)
        re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      else if (c === "%") re += ".*";
      else if (c === "_") re += ".";
      else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    const rx = new RegExp(`^${re}$`, "i");
    this.filters.push((row) => typeof row[column] === "string" && rx.test(row[column] as string));
    return this;
  };
}

const missingPlans = (target: { table?: string }): DbError | null =>
  target.table === "client_plans"
    ? { code: "PGRST205", message: "Could not find the table 'public.client_plans'" }
    : null;

function planRow(over: Partial<ClientPlanRow> & Pick<ClientPlanRow, "plan">): ClientPlanRow {
  return {
    id: globalThis.crypto.randomUUID(),
    user_id: USER,
    status: "active",
    starts_on: "2026-10-01",
    ends_on: null,
    contract_ref: null,
    assigned_by: ADMIN,
    ended_at: null,
    ended_by: null,
    created_at: iso("2026-10-01T08:00:00Z"),
    updated_at: iso("2026-10-01T08:00:00Z"),
    ...over,
  };
}

/* ---------------------------------------------------------- periods and copy */

test("periods follow the Romanian calendar: months, quarters, daylight saving and the year end", () => {
  const month = researchPeriod("month", NOW);
  assert.equal(iso(new Date(month.start).toISOString()), "2026-09-30T21:00:00.000Z");
  // Summer time ends on 25 October: 1 November starts at 22:00 UTC.
  assert.equal(new Date(month.end).toISOString(), "2026-10-31T22:00:00.000Z");
  // Half past midnight on 1 November in Romania is already November.
  assert.equal(
    new Date(researchPeriod("month", Date.parse("2026-10-31T22:30:00Z")).start).toISOString(),
    "2026-10-31T22:00:00.000Z",
  );
  const q4 = researchPeriod("quarter", NOW);
  assert.equal(new Date(q4.start).toISOString(), "2026-09-30T21:00:00.000Z");
  assert.equal(new Date(q4.end).toISOString(), "2026-12-31T22:00:00.000Z");
  // 1 April 00:30 in Romania (summer time since 29 March) is the second quarter.
  assert.equal(
    new Date(researchPeriod("quarter", Date.parse("2026-03-31T21:30:00Z")).start).toISOString(),
    "2026-03-31T21:00:00.000Z",
  );
  const december = researchPeriod("month", Date.parse("2026-12-15T12:00:00Z"));
  assert.equal(new Date(december.end).toISOString(), "2026-12-31T22:00:00.000Z");
  assert.equal(romanianDate(Date.parse("2026-10-04T21:30:00Z")), "2026-10-05");
  assert.equal(romanianDate(Date.parse("2026-10-04T20:30:00Z")), "2026-10-04");
});

test("plan state by calendar day, both ends included; the newest current row wins", () => {
  const today = "2026-10-20";
  assert.equal(planState(planRow({ plan: "growth" }), today), "current");
  assert.equal(planState(planRow({ plan: "growth", starts_on: "2026-10-20" }), today), "current");
  assert.equal(planState(planRow({ plan: "growth", starts_on: "2026-11-01" }), today), "scheduled");
  assert.equal(planState(planRow({ plan: "growth", ends_on: "2026-10-20" }), today), "current");
  assert.equal(planState(planRow({ plan: "growth", ends_on: "2026-10-19" }), today), "expired");
  assert.equal(planState(planRow({ plan: "growth", status: "ended" }), today), "ended");
  const older = planRow({ plan: "starter", created_at: iso("2026-09-01T00:00:00Z") });
  const newer = planRow({ plan: "pro", created_at: iso("2026-10-02T00:00:00Z") });
  assert.equal(currentPlan([older, newer], today)?.plan, "pro");
  assert.equal(currentPlan([planRow({ plan: "enterprise" })], today), null);
  assert.equal(currentPlan([], today), null);
});

test("hours and reports in natural Romanian and English, always per month or quarter", () => {
  assert.equal(hoursPerMonthLabel(1, "ro"), "1 oră pe lună");
  assert.equal(hoursPerMonthLabel(4, "ro"), "4 ore pe lună");
  assert.equal(hoursPerMonthLabel(10, "ro"), "10 ore pe lună");
  assert.equal(hoursPerMonthLabel(20, "ro"), "20 de ore pe lună");
  assert.equal(hoursPerMonthLabel(1, "en"), "1 hour a month");
  assert.equal(hoursPerMonthLabel(10, "en"), "10 hours a month");
  assert.equal(reportsLabel(1, "quarter", "ro"), "1 raport pe trimestru");
  assert.equal(reportsLabel(2, "month", "ro"), "2 rapoarte pe lună");
  assert.equal(reportsLabel(5, "month", "en"), "5 reports a month");
  assert.equal(reportsLabel(1, "quarter", "en"), "1 report a quarter");
});

/* ------------------------------------------------------- the admin's records */

test("assign, edit, change and end a plan: one active row, the history kept", async () => {
  const db = withPlansTable(new FakeSupabase({ now: () => NOW }));
  const plans = db as unknown as PlanDb;
  const first = await setClientPlan(
    plans,
    { userId: USER, plan: "growth", startsOn: "2026-10-01", endsOn: null, contractRef: "VH-1" },
    ADMIN,
    NOW,
  );
  assert.equal(first.action, "created");
  const rows = () => db.rows("client_plans");
  assert.equal(rows().length, 1);
  assert.equal(rows()[0].plan, "growth");
  assert.equal(rows()[0].assigned_by, ADMIN);
  assert.equal(rows()[0].contract_ref, "VH-1");

  // The same plan: the active row is edited, no new record.
  const edit = await setClientPlan(
    plans,
    {
      userId: USER,
      plan: "growth",
      startsOn: "2026-10-01",
      endsOn: "2027-09-30",
      contractRef: "VH-1/A",
    },
    ADMIN,
    NOW,
  );
  assert.equal(edit.action, "updated");
  assert.equal(edit.id, first.id);
  assert.equal(rows().length, 1);
  assert.equal(rows()[0].ends_on, "2027-09-30");
  assert.equal(rows()[0].contract_ref, "VH-1/A");

  // Another plan: the Growth record ends now and a Pro record starts.
  const change = await setClientPlan(
    plans,
    { userId: USER, plan: "pro", startsOn: "2026-10-20", endsOn: null, contractRef: "VH-2" },
    OTHER,
    NOW + 1000,
  );
  assert.equal(change.action, "changed");
  assert.equal(rows().length, 2);
  const growth = rows().find((r) => r.id === first.id)!;
  assert.equal(growth.status, "ended");
  assert.equal(growth.ended_by, OTHER);
  assert.equal(growth.ended_at, new Date(NOW + 1000).toISOString());
  const active = rows().filter((r) => r.status === "active");
  assert.equal(active.length, 1);
  assert.equal(active[0].plan, "pro");
  assert.equal(((await currentClientPlan(plans, USER, NOW)) as ClientPlanRow).plan, "pro");

  // Ending it: nothing is active, the history keeps both records.
  await endClientPlan(plans, change.id, ADMIN, NOW + 2000);
  assert.equal(await currentClientPlan(plans, USER, NOW), null);
  await assert.rejects(endClientPlan(plans, change.id, ADMIN, NOW), /plan_not_active/);
  const history = await readClientPlans(plans, USER);
  assert.ok(history.ok);
  assert.equal(history.ok && history.value.length, 2);

  // Wrong input never reaches the table.
  await assert.rejects(
    setClientPlan(
      plans,
      {
        userId: USER,
        plan: "pro",
        startsOn: "2026-10-20",
        endsOn: "2026-10-19",
        contractRef: null,
      },
      ADMIN,
    ),
    /plan_dates/,
  );
  await assert.rejects(
    setClientPlan(
      plans,
      // @ts-expect-error: not a plan
      { userId: USER, plan: "gold", startsOn: "2026-10-20", endsOn: null, contractRef: null },
      ADMIN,
    ),
    /plan_invalid/,
  );
});

test("a failed write of the new plan gives the client their old plan back", async () => {
  let failInsert = false;
  const db = withPlansTable(
    new FakeSupabase({
      now: () => NOW,
      fail: ({ table, op }) =>
        failInsert && table === "client_plans" && op === "insert"
          ? { code: "23505", message: "duplicate key value violates unique constraint" }
          : null,
    }),
  );
  const plans = db as unknown as PlanDb;
  const growth = await setClientPlan(
    plans,
    { userId: USER, plan: "growth", startsOn: "2026-10-01", endsOn: null, contractRef: null },
    ADMIN,
    NOW,
  );
  failInsert = true;
  await assert.rejects(
    setClientPlan(
      plans,
      { userId: USER, plan: "pro", startsOn: "2026-10-20", endsOn: null, contractRef: null },
      ADMIN,
      NOW,
    ),
    /plan_write_failed/,
  );
  const rows = db.rows("client_plans");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, growth.id);
  assert.equal(rows[0].status, "active");
  assert.equal(rows[0].ended_at, null);
});

test("before client_plans.sql is applied every read says so and nothing breaks", async () => {
  const plans = new FakeSupabase({ fail: missingPlans }) as unknown as PlanDb;
  assert.deepEqual(await readClientPlans(plans, USER), { ok: false, missing: true });
  assert.deepEqual(await listActivePlans(plans), { ok: false, missing: true });
  assert.equal(await currentClientPlan(plans, USER), "missing");
  await assert.rejects(
    setClientPlan(
      plans,
      { userId: USER, plan: "growth", startsOn: "2026-10-01", endsOn: null, contractRef: null },
      ADMIN,
    ),
    /plans_unavailable/,
  );
  await assert.rejects(endClientPlan(plans, USER, ADMIN), /plans_unavailable/);
  // Another error is not "missing": the caller refuses instead of assuming no plan.
  const broken = new FakeSupabase({
    fail: ({ table }) => (table === "client_plans" ? { code: "57014", message: "timeout" } : null),
  }) as unknown as PlanDb;
  assert.equal(await currentClientPlan(broken, USER), "error");
  assert.deepEqual(await readClientPlans(broken, USER), { ok: false, missing: false });
});

test("the admin's search: by e-mail (any case, wildcards escaped) or user ID, with each active plan", async () => {
  addIlike();
  const db = withPlansTable(new FakeSupabase({ now: () => NOW }));
  db.rows("profiles").push(
    {
      id: USER,
      email: "Ana@Firma.ro",
      full_name: "Ana Pop",
      company: "Firma SRL",
      created_at: iso("2026-09-01T00:00:00Z"),
    },
    {
      id: OTHER,
      email: "ion_x@alta.ro",
      full_name: null,
      company: null,
      created_at: iso("2026-09-02T00:00:00Z"),
    },
  );
  db.rows("client_plans").push(planRow({ plan: "growth" }));
  const plans = db as unknown as PlanDb;
  const ana = await findAccounts(plans, "  ana@firma ", NOW);
  assert.equal(ana.length, 1);
  assert.deepEqual(ana[0].plan && { plan: ana[0].plan.plan, state: ana[0].plan.state }, {
    plan: "growth",
    state: "current",
  });
  assert.equal(ana[0].fullName, "Ana Pop");
  // "_" is a literal underscore, not "any character".
  assert.equal((await findAccounts(plans, "ion_x", NOW)).length, 1);
  assert.equal((await findAccounts(plans, "ion%", NOW)).length, 0);
  assert.equal((await findAccounts(plans, OTHER, NOW))[0].plan, null);
  assert.deepEqual(await findAccounts(plans, "an", NOW), []);
  // Without the table the accounts are still found, with no plan.
  const before = new FakeSupabase({ fail: missingPlans });
  before.rows("profiles").push(...db.rows("profiles"));
  const found = await findAccounts(before as unknown as PlanDb, "firma.ro", NOW);
  assert.equal(found.length, 1);
  assert.equal(found[0].plan, null);
});

/* -------------------------------------------------- counting and the quotas */

type RunSeed = { via: string; status: string; at: string; user?: string };

/** The tables store over the fake (Lovable's applied ledger), with runs already in deep_runs. */
function tablesWith(runs: RunSeed[], now = NOW) {
  const db = new FakeSupabase({ now: () => now });
  installLovableLedger(db);
  for (const r of runs)
    db.rows("deep_runs").push(
      db.newRow("deep_runs", {
        user_id: r.user ?? USER,
        cui: "12345678",
        via: r.via,
        status: r.status,
        created_at: iso(r.at),
        last_activity_at: iso(r.at),
      }),
    );
  return createTablesStore(db as unknown as DeepDb, { now: () => now });
}

test("the tables store counts a plan's reports: premium runs since the period start, failed and canceled excepted", async () => {
  const store = tablesWith([
    { via: "premium", status: "succeeded", at: "2026-10-02T09:00:00Z" },
    { via: "premium", status: "partial", at: "2026-10-05T09:00:00Z" },
    { via: "premium", status: "running", at: "2026-10-20T09:00:00Z" },
    { via: "premium", status: "failed", at: "2026-10-06T09:00:00Z" },
    { via: "premium", status: "canceled", at: "2026-10-07T09:00:00Z" },
    { via: "free", status: "succeeded", at: "2026-10-08T09:00:00Z" },
    { via: "admin", status: "succeeded", at: "2026-10-09T09:00:00Z" },
    { via: "code", status: "succeeded", at: "2026-10-10T09:00:00Z" },
    { via: "premium", status: "succeeded", at: "2026-09-30T20:59:00Z" },
    { via: "premium", status: "succeeded", at: "2026-10-03T09:00:00Z", user: OTHER },
  ]);
  const since = new Date(researchPeriod("month", NOW).start).toISOString();
  assert.equal(await store.premiumRunsSince(USER, since), 3);
  assert.equal(await store.premiumRunsSince(OTHER, since), 1);
});

const confirmed: AccountInfo = { email: "ana@firma.ro", emailConfirmed: true, google: true };

function lookupsWith(
  plan: string | null | "error",
  tiers: string[] = [],
  account: AccountInfo = confirmed,
): AccessLookups {
  return {
    async account() {
      return account;
    },
    async premiumTiers() {
      return tiers;
    },
    async clientPlan() {
      return plan === null || plan === "error" ? plan : { plan };
    },
  };
}

const premiumConfig = (extra: Record<string, string> = {}) =>
  readDeepConfig({
    DEEP_RESEARCH_MODE: "premium",
    DEEP_RESEARCH_ADMIN_USER_IDS: ADMIN,
    ANTHROPIC_API_KEY: "sk-test",
    ...extra,
  });

async function access(
  plan: string | null | "error",
  runs: RunSeed[],
  opts: {
    tiers?: string[];
    extra?: Record<string, string>;
    user?: string;
    mode?: string;
    now?: number;
  } = {},
) {
  const now = opts.now ?? NOW;
  return checkDeepAccess(
    { userId: opts.user ?? USER },
    {
      config: premiumConfig({
        ...(opts.mode ? { DEEP_RESEARCH_MODE: opts.mode } : {}),
        ...opts.extra,
      }),
      store: tablesWith(runs, now),
      lookups: lookupsWith(plan, opts.tiers),
      env: {},
      now: () => now,
    },
  );
}

const premium = (at: string, status = "succeeded"): RunSeed => ({ via: "premium", status, at });

test("Growth: 2 reports a month, then premium_required with the allowance and its renewal", async () => {
  const open = await access("growth", []);
  assert.equal(open.allowed, true);
  assert.equal(open.via, "premium");
  assert.deepEqual(open.plan, {
    plan: "growth",
    source: "contract",
    reports: 2,
    period: "month",
    used: 0,
    renewsAt: "2026-10-31T22:00:00.000Z",
  });
  const one = await access("growth", [premium("2026-10-02T09:00:00Z")]);
  assert.equal(one.via, "premium");
  assert.equal(one.plan?.used, 1);
  const used = await access("growth", [
    premium("2026-10-02T09:00:00Z"),
    premium("2026-10-05T09:00:00Z", "partial"),
  ]);
  assert.equal(used.allowed, false);
  assert.equal(used.reason, "premium_required");
  assert.equal(used.plan?.used, 2);
  assert.equal(used.plan?.reports, 2);
  // Failed, canceled, free and last month's runs leave the reports untouched.
  const fair = await access("growth", [
    premium("2026-10-02T09:00:00Z"),
    premium("2026-10-03T09:00:00Z", "failed"),
    premium("2026-10-04T09:00:00Z", "canceled"),
    { via: "free", status: "succeeded", at: "2026-10-06T09:00:00Z" },
    premium("2026-09-29T09:00:00Z"),
  ]);
  assert.equal(fair.via, "premium");
  assert.equal(fair.plan?.used, 1);
  // A new month brings the reports back.
  const november = await access(
    "growth",
    [premium("2026-10-02T09:00:00Z"), premium("2026-10-05T09:00:00Z")],
    { now: Date.parse("2026-11-02T10:00:00Z") },
  );
  assert.equal(november.via, "premium");
  assert.equal(november.plan?.used, 0);
});

test("Starter: 1 report a quarter; Pro: 5 a month", async () => {
  const starter = await access("starter", [premium("2026-07-15T09:00:00Z")]);
  assert.equal(starter.via, "premium", "last quarter's report does not count");
  assert.equal(starter.plan?.period, "quarter");
  assert.equal(starter.plan?.renewsAt, "2026-12-31T22:00:00.000Z");
  const starterUsed = await access("starter", [premium("2026-10-01T06:00:00Z")]);
  assert.equal(starterUsed.reason, "premium_required");
  const proRuns = ["02", "05", "07", "09", "12"].map((d) => premium(`2026-10-${d}T09:00:00Z`));
  assert.equal((await access("pro", proRuns.slice(0, 4))).via, "premium");
  const pro = await access("pro", proRuns);
  assert.equal(pro.reason, "premium_required");
  assert.equal(pro.plan?.used, 5);
});

test("plan reports and the other limits: daily caps still apply, the free report comes after the plan", async () => {
  // One report left on the plan, but three runs today: the daily cap answers.
  const capped = await access("growth", [
    premium("2026-10-20T06:00:00Z"),
    { via: "code", status: "succeeded", at: "2026-10-20T07:00:00Z" },
    { via: "code", status: "succeeded", at: "2026-10-20T08:00:00Z" },
  ]);
  assert.equal(capped.reason, "daily_cap_user");
  // Plan reports used, the account's free report not yet: the free report.
  const free = await access(
    "growth",
    [premium("2026-10-02T09:00:00Z"), premium("2026-10-05T09:00:00Z")],
    { extra: { DEEP_FREE_RUNS_PER_USER: "1" } },
  );
  assert.equal(free.via, "free");
});

test("which plans count: DEEP_RESEARCH_PREMIUM_TIERS, subscriptions, tiers without a quota", async () => {
  // An explicit list set before the 2026-10 plans leaves Starter out.
  const notListed = await access("starter", [], {
    extra: { DEEP_RESEARCH_PREMIUM_TIERS: "growth,pro" },
  });
  assert.equal(notListed.reason, "premium_required");
  assert.equal(notListed.plan, undefined);
  // No client plan (or no table yet): a Stripe subscription still admits, with its quota.
  const sub = await access(null, [premium("2026-10-02T09:00:00Z")], { tiers: ["growth"] });
  assert.equal(sub.via, "premium");
  assert.equal(sub.plan?.source, "subscription");
  assert.equal(sub.plan?.used, 1);
  // The contract first; a subscription with reports left still admits when the contract's are used.
  const both = await access("starter", [premium("2026-10-02T09:00:00Z")], { tiers: ["pro"] });
  assert.equal(both.via, "premium");
  assert.equal(both.plan?.plan, "pro");
  // A listed tier with no quota keeps the old behaviour: daily caps only.
  const custom = await access(
    null,
    ["02", "05", "07", "09", "12", "14"].map((d) => premium(`2026-10-${d}T09:00:00Z`)),
    {
      tiers: ["enterprise"],
      extra: { DEEP_RESEARCH_PREMIUM_TIERS: "starter,growth,pro,enterprise" },
    },
  );
  assert.equal(custom.via, "premium");
  assert.equal(custom.plan?.reports, null);
});

test("fail closed: a failed plan lookup or a store that cannot count refuses with ledger_unavailable", async () => {
  assert.equal((await access("error", [])).reason, "ledger_unavailable");
  // The memory store cannot count plan reports.
  const memory = await checkDeepAccess(
    { userId: USER },
    {
      config: premiumConfig(),
      store: createMemoryStore(),
      lookups: lookupsWith("growth"),
      env: {},
      now: () => NOW,
    },
  );
  assert.equal(memory.reason, "ledger_unavailable");
  // No plan at all, and no lookup error: the plans' gate.
  assert.equal((await access(null, [])).reason, "premium_required");
});

test("admins keep their own caps and never use a plan's reports; code mode admits plans within their reports", async () => {
  resetRoleCache();
  const admin = await access(
    "growth",
    [premium("2026-10-02T09:00:00Z"), premium("2026-10-05T09:00:00Z")],
    {
      user: ADMIN,
    },
  );
  assert.equal(admin.via, "admin");
  assert.equal(admin.plan, undefined);
  const code = await access("growth", [], { mode: "code" });
  assert.equal(code.via, "premium");
  const codeUsed = await access(
    "growth",
    [premium("2026-10-02T09:00:00Z"), premium("2026-10-05T09:00:00Z")],
    { mode: "code" },
  );
  assert.equal(codeUsed.reason, "code_required");
});

test("the client plan lookup reads client_plans with the service role; no table means no plan", async () => {
  const db = withPlansTable(new FakeSupabase());
  db.rows("client_plans").push(
    planRow({ plan: "starter", status: "ended", ended_at: iso("2026-02-01T00:00:00Z") }),
    planRow({ plan: "pro", starts_on: "2026-01-01" }),
  );
  const real = supabaseLookups(db as unknown as DeepDb);
  assert.equal(((await real.clientPlan!(USER)) as { plan: string }).plan, "pro");
  assert.equal(await real.clientPlan!(OTHER), null);
  const before = supabaseLookups(new FakeSupabase({ fail: missingPlans }) as unknown as DeepDb);
  assert.equal(await before.clientPlan!(USER), null);
  const broken = supabaseLookups(
    new FakeSupabase({ fail: () => ({ code: "XX000", message: "down" }) }) as unknown as DeepDb,
  );
  assert.equal(await broken.clientPlan!(USER), "error");
});

test("the gate's plan states: reports used this period (one or several), a plan that starts later", () => {
  const renews = {
    en: formatRenewalDay("2026-10-31T22:00:00.000Z", "en"),
    ro: formatRenewalDay("2026-10-31T22:00:00.000Z", "ro"),
  };
  // The day and the month never split across lines.
  assert.equal(renews.ro, "1\u00a0noiembrie");
  const growth = planReportsUsedCopy({ plan: "Growth", reports: 2, period: "month", renews });
  assert.equal(growth.title.ro, "Ai folosit rapoartele din luna aceasta");
  assert.equal(
    growth.body.ro,
    "Abonamentul Growth include 2 rapoarte pe lună. Următoarele sunt disponibile din 1\u00a0noiembrie.",
  );
  assert.equal(growth.title.en, "This month's reports are used");
  const starter = planReportsUsedCopy({
    plan: "Starter",
    reports: 1,
    period: "quarter",
    renews: null,
  });
  assert.equal(starter.title.ro, "Ai folosit raportul din acest trimestru");
  assert.equal(starter.body.ro, "Abonamentul Starter include 1 raport pe trimestru.");
  assert.equal(starter.body.en, "Your Starter plan includes 1 report a quarter.");
  const later = planStartsLaterCopy({
    plan: "Pro",
    startsOn: { en: "1 Nov 2026", ro: "1 nov. 2026" },
  });
  assert.equal(later.title.ro, "Abonamentul Pro începe pe 1 nov. 2026");
  for (const copy of [growth, starter, later])
    for (const text of [copy.title.ro, copy.body.ro, copy.title.en, copy.body.en])
      assert.doesNotMatch(text, /nelimitat|garantat|unlimited|guaranteed/i);
});

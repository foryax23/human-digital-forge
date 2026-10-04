import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  checkDeepAccess,
  resetRoleCache,
  startWithDeepCheck,
  supabaseLookups,
  type AccessLookups,
  type AccountInfo,
  type DeepCheckLedger,
  type DeepCredits,
} from "../../../src/lib/deep/access.server";
import { saveDeepCredits, PLAN_CHECKS } from "../../../src/lib/admin.functions";
import type { DeepStore, StartDeepRunOutput } from "../../../src/lib/deep/contracts";
import { readDeepConfig, ticketAdmitted } from "../../../src/lib/deep/env.server";
import { createMemoryStore } from "../../../src/lib/deep/llm/ledger-memory.server";
import type { DeepDb } from "../../../src/lib/deep/persist-db.server";
import { createTablesStore } from "../../../src/lib/deep/persist-tables.server";
import { FakeSupabase } from "../persist/fake-supabase";
import { installLovableLedger } from "../persist/fake-lovable-sql";

/*
 * Deep checks (public.deep_credits, drizzle/migrations/0003): "Primul raport Deep Research e
 * gratuit", one check per account, more when an admin grants them. The access order (admin,
 * code, open, check, mode), the throwaway protections, the caps and budgets that still apply,
 * the spend and refund around a start, and why a check never uses up a contract plan's
 * reports. Fake lookups and stores only: no network, no database.
 */

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const USER = "bbbbbbbb-0000-4000-8000-000000000002";
const CODE = "vortex-test-2026";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
/** Tuesday 20 October 2026, 13:00 in Romania. */
const NOW = Date.parse("2026-10-20T10:00:00Z");

const google: AccountInfo = { email: "ana@firma.ro", emailConfirmed: true, google: true };
const emailOnly: AccountInfo = { email: "ana@firma.ro", emailConfirmed: true, google: false };
const unconfirmed: AccountInfo = { email: "ana@firma.ro", emailConfirmed: false, google: false };

const FREE: DeepCredits = { plan: "free", left: 1, granted: false };
const NONE: DeepCredits = { plan: "free", left: 0, granted: false };

function lookups(
  opts: {
    account?: AccountInfo | null;
    credits?: DeepCredits | null | "throw" | "absent";
    plan?: string | null;
  } = {},
): AccessLookups {
  const out: AccessLookups = {
    async account() {
      return opts.account === undefined ? google : opts.account;
    },
    async premiumTiers() {
      return [];
    },
    async clientPlan() {
      return opts.plan ? { plan: opts.plan } : null;
    },
  };
  if (opts.credits !== "absent") {
    out.credits = async () => {
      if (opts.credits === "throw") throw new Error("deep_credits unreadable");
      return opts.credits === undefined ? FREE : opts.credits;
    };
  }
  return out;
}

type Stats = { userRuns?: number; allRuns?: number; allUsd?: number };

/** A persistent-looking store with scripted day stats, breaker and plan count. */
function store(
  opts: Stats & { breaker?: boolean; premium?: number; free?: number } = {},
): DeepStore {
  return Object.assign(createMemoryStore(), {
    kind: "stopgap" as const,
    dayStats: async () => ({
      userRuns: opts.userRuns ?? 0,
      allRuns: opts.allRuns ?? 0,
      allUsd: opts.allUsd ?? 0,
    }),
    breakerOpen: async () => opts.breaker ?? false,
    premiumRunsSince: async () => opts.premium ?? 0,
    freeRunsUsed: async () => opts.free ?? 0,
  });
}

function config(mode: string | undefined, extra: Record<string, string> = {}) {
  return readDeepConfig({
    DEEP_RESEARCH_MODE: mode,
    DEEP_RESEARCH_ADMIN_USER_IDS: ADMIN,
    DEEP_RESEARCH_TEST_CODES: sha(CODE),
    ANTHROPIC_API_KEY: "sk-test",
    ...extra,
  });
}

async function check(
  mode: string | undefined,
  l: AccessLookups = lookups(),
  opts: {
    user?: string;
    code?: string;
    extra?: Record<string, string>;
    env?: Record<string, string>;
    s?: DeepStore | null;
  } = {},
) {
  resetRoleCache();
  return checkDeepAccess(
    { userId: opts.user ?? USER, testCode: opts.code },
    {
      config: config(mode, opts.extra),
      store: opts.s === undefined ? store() : opts.s,
      lookups: l,
      env: opts.env ?? {},
      now: () => NOW,
    },
  );
}

/* ------------------------------------------------------------- the order */

test("admins come first: no check is spent, in any mode", async () => {
  for (const mode of ["admin", "code", "open", "premium"]) {
    const a = await check(mode, lookups(), { user: ADMIN });
    assert.equal(a.via, "admin", mode);
    assert.equal(a.useCredit, undefined, mode);
  }
});

test("a confirmed account with its free check is admitted via free and spends it, in every mode but disabled", async () => {
  for (const mode of ["admin", undefined, "code", "premium"]) {
    const a = await check(mode);
    assert.equal(a.allowed, true, String(mode));
    assert.equal(a.via, "free", String(mode));
    assert.equal(a.useCredit, true, String(mode));
    assert.deepEqual(a.credits, { plan: "free", left: 1 }, "granted stays on the server");
  }
  assert.equal((await check("disabled")).reason, "mode_disabled");
  assert.equal((await check("admin", lookups(), { user: "" })).reason, "login_required");
});

test("an unconfirmed e-mail is refused, unless a code or a plan admits the account anyway", async () => {
  const l = lookups({ account: unconfirmed });
  for (const mode of ["admin", "code", "open", "premium"]) {
    const a = await check(mode, l);
    assert.equal(a.allowed, false, mode);
    assert.equal(a.reason, "email_unconfirmed", mode);
  }
  // A test code spends nothing and came before deep checks (A4).
  const coded = await check("code", l, { code: CODE });
  assert.equal(coded.via, "code");
  assert.equal(coded.useCredit, undefined);
  // A contract plan is matched by user ID: it admits as it did before deep checks.
  const planned = await check("premium", lookups({ account: unconfirmed, plan: "growth" }));
  assert.equal(planned.via, "premium");
  // The account cannot be read: try again.
  assert.equal((await check("admin", lookups({ account: null }))).reason, "ledger_unavailable");
});

test("no check left: the mode and the plans decide, exactly as before deep checks", async () => {
  const none = lookups({ credits: NONE });
  assert.equal((await check("admin", none)).reason, "admin_only");
  assert.equal((await check("code", none)).reason, "code_required");
  assert.equal((await check("code", none, { code: CODE })).via, "code");
  assert.equal((await check("open", none)).via, "open");
  assert.equal((await check("premium", none)).reason, "premium_required");
  const growth = await check("premium", lookups({ credits: NONE, plan: "growth" }));
  assert.equal(growth.via, "premium");
  assert.equal(growth.useCredit, undefined);
  assert.equal(growth.plan?.reports, 2);
});

test("a test code and open mode spend nothing: the check stays for later", async () => {
  const coded = await check("premium", lookups(), { code: CODE });
  assert.equal(coded.via, "code");
  assert.equal(coded.useCredit, undefined);
  const open = await check("open");
  assert.equal(open.via, "open");
  assert.equal(open.useCredit, undefined);
  // A code is not an entry in admin mode: the check admits instead.
  const adminMode = await check("admin", lookups(), { code: CODE });
  assert.equal(adminMode.via, "free");
});

test("unreadable credits (null or an error) behave as before deep checks", async () => {
  const cases: Array<[string | undefined, string | undefined]> = [
    ["admin", undefined],
    ["code", undefined],
    ["code", CODE],
    ["open", undefined],
    ["premium", undefined],
  ];
  for (const [mode, code] of cases) {
    const before = await check(mode, lookups({ credits: "absent" }), { code });
    for (const credits of [null, "throw"] as const) {
      const now = await check(mode, lookups({ credits }), { code });
      assert.equal(now.allowed, before.allowed, `${mode} ${credits}`);
      assert.equal(now.via, before.via, `${mode} ${credits}`);
      assert.equal(now.reason, before.reason, `${mode} ${credits}`);
      assert.equal(now.useCredit, undefined);
      assert.equal(now.credits, undefined);
    }
  }
});

/* ------------------------------------------------- throwaway accounts, AI */

test("the free check needs Google while DEEP_OPEN_REQUIRES_GOOGLE is on, unless an admin granted it", async () => {
  const plain = lookups({ account: emailOnly });
  const refused = await check("admin", plain);
  assert.equal(refused.allowed, false);
  // The mode's reason stays; the gate learns what the free report waits for.
  assert.equal(refused.reason, "admin_only");
  assert.equal(refused.creditNeeds, "google");
  const premiumMode = await check("premium", plain);
  assert.equal(premiumMode.reason, "premium_required");
  assert.equal(premiumMode.creditNeeds, "google");
  // A plan still admits the account (the check is kept).
  const planned = await check("premium", lookups({ account: emailOnly, plan: "growth" }));
  assert.equal(planned.via, "premium");
  assert.equal(planned.useCredit, undefined);
  // Switched off (e-mail confirmation known to be real): a confirmed e-mail is enough.
  const off = await check("admin", plain, { env: { DEEP_OPEN_REQUIRES_GOOGLE: "off" } });
  assert.equal(off.via, "free");
  // Granted by an admin (updated_by), or premium checks: no Google needed.
  for (const credits of [
    { plan: "free", left: 1, granted: true },
    { plan: "premium", left: 4 },
  ] as DeepCredits[]) {
    const granted = await check("admin", lookups({ account: emailOnly, credits }));
    assert.equal(granted.via, "free", JSON.stringify(credits));
    assert.equal(granted.useCredit, true);
    assert.equal(granted.creditNeeds, undefined);
  }
  // A confirmed e-mail is still required for granted checks.
  const grantedUnconfirmed = await check(
    "admin",
    lookups({ account: unconfirmed, credits: { plan: "premium", left: 4 } }),
  );
  assert.equal(grantedUnconfirmed.reason, "email_unconfirmed");
});

test("a check buys a full AI report: kept when AI is off or the day has less than one run's budget", async () => {
  // DEEP_DAILY_BUDGET_USD 15, DEEP_RUN_BUDGET_USD 1.5 by default.
  const late = await check("admin", lookups(), { s: store({ allUsd: 13.6 }) });
  assert.equal(late.allowed, false);
  assert.equal(late.reason, "budget_exhausted");
  assert.equal((await check("admin", lookups(), { s: store({ allUsd: 13.5 }) })).via, "free");
  const breaker = await check("admin", lookups(), { s: store({ breaker: true }) });
  assert.equal(breaker.reason, "ledger_unavailable");
  const noKey = await check("admin", lookups(), { extra: { ANTHROPIC_API_KEY: "" } });
  assert.equal(noKey.reason, "ledger_unavailable");
  // A plan or a code still runs (as before: rules-only when AI is off), the check stays.
  const planned = await check("premium", lookups({ plan: "growth" }), {
    s: store({ allUsd: 15 }),
  });
  assert.equal(planned.via, "premium");
  assert.equal(planned.useCredit, undefined);
  assert.equal(planned.ai, false);
  // Admins are not affected.
  assert.equal(
    (await check("admin", lookups(), { user: ADMIN, s: store({ allUsd: 15 }) })).via,
    "admin",
  );
});

test("credit runs keep every cap: 3 a day per account, 10 for everyone, the run budget", async () => {
  const mine = await check("admin", lookups(), { s: store({ userRuns: 3 }) });
  assert.equal(mine.reason, "daily_cap_user");
  const all = await check("admin", lookups(), { s: store({ allRuns: 10 }) });
  assert.equal(all.reason, "daily_cap_global");
  assert.equal((await check("admin", lookups(), { s: null })).reason, "ledger_unavailable");
  const ok = await check("admin", lookups(), { s: store({ userRuns: 2, allRuns: 9 }) });
  assert.equal(ok.via, "free");
  assert.equal(ok.budgetUsd, 1.5);
  assert.equal(ok.runsLeftToday, 1);
});

/* --------------------------------------------- checks and a plan's quota */

type RunSeed = { via: string; status: string; at: string };

function tablesWith(runs: RunSeed[]) {
  const db = new FakeSupabase({ now: () => NOW });
  installLovableLedger(db);
  for (const r of runs)
    db.rows("deep_runs").push(
      db.newRow("deep_runs", {
        user_id: USER,
        cui: "12345678",
        via: r.via,
        status: r.status,
        created_at: new Date(r.at).toISOString(),
        last_activity_at: new Date(r.at).toISOString(),
      }),
    );
  return createTablesStore(db as unknown as DeepDb, { now: () => NOW });
}

test("a contract client spends the free check first, then the plan's reports, all of them", async () => {
  const runs: RunSeed[] = [];
  const growth = (credits: DeepCredits) =>
    check("premium", lookups({ plan: "growth", credits }), { s: tablesWith(runs) });
  const first = await growth(FREE);
  assert.equal(first.via, "free");
  assert.equal(first.useCredit, true);
  runs.push({ via: first.via!, status: "succeeded", at: "2026-10-02T09:00:00Z" });
  // The free report did not touch Growth's 2 reports this month.
  const second = await growth(NONE);
  assert.equal(second.via, "premium");
  assert.equal(second.plan?.used, 0);
  runs.push({ via: second.via!, status: "succeeded", at: "2026-10-05T09:00:00Z" });
  const third = await growth(NONE);
  assert.equal(third.via, "premium");
  assert.equal(third.plan?.used, 1);
  runs.push({ via: third.via!, status: "partial", at: "2026-10-07T09:00:00Z" });
  const fourth = await growth(NONE);
  assert.equal(fourth.reason, "premium_required");
  assert.equal(fourth.plan?.used, 2);
});

test("premium checks an admin granted never count against a contract plan's reports", async () => {
  const runs: RunSeed[] = [];
  const premiumChecks = (left: number): DeepCredits => ({ plan: "premium", left, granted: true });
  for (const [i, left] of [4, 3, 2, 1].entries()) {
    const a = await check("premium", lookups({ plan: "growth", credits: premiumChecks(left) }), {
      s: tablesWith(runs),
    });
    // Recorded as a check run, not as a plan run: premiumRunsSince counts via "premium" only.
    assert.equal(a.via, "free", `check ${i + 1}`);
    assert.equal(a.useCredit, true);
    runs.push({ via: a.via!, status: "succeeded", at: `2026-10-0${i + 2}T09:00:00Z` });
  }
  const store = tablesWith(runs);
  assert.equal(await store.premiumRunsSince(USER, "2026-09-30T21:00:00.000Z"), 0);
  const plan = await check("premium", lookups({ plan: "growth", credits: premiumChecks(0) }), {
    s: store,
  });
  assert.equal(plan.via, "premium");
  assert.equal(plan.plan?.used, 0, "Growth still has both reports this month");
  // The legacy free run counts runs started with a check: one free report per account.
  assert.equal(await store.freeRunsUsed(USER), 4);
});

test("tickets of check and plan runs continue in every mode but disabled", () => {
  for (const mode of ["admin", "code", "open", "premium", "something"]) {
    const c = config(mode);
    assert.equal(ticketAdmitted(c, "free", USER), true, `free in ${mode}`);
    assert.equal(ticketAdmitted(c, "premium", USER), true, `premium in ${mode}`);
  }
  const disabled = config("disabled");
  assert.equal(ticketAdmitted(disabled, "free", USER), false);
  assert.equal(ticketAdmitted(disabled, "premium", USER), false);
  // The other tickets keep their per-mode rule.
  assert.equal(ticketAdmitted(config("admin"), "code", USER), false);
  assert.equal(ticketAdmitted(config("admin"), "open", USER), false);
  assert.equal(ticketAdmitted(config("open"), "open", USER), true);
});

/* ------------------------------------------------------ spend and refund */

const startedRun: StartDeepRunOutput = {
  ok: true,
  runId: "r1",
  ticket: "t",
  store: "tables",
  identity: {} as never,
  plan: [],
  aiMode: "ai",
};

function ledger(spend: boolean | "throw", refund: "ok" | "throw" = "ok") {
  const calls = { spend: 0, refund: 0 };
  const l: DeepCheckLedger = {
    async spend() {
      calls.spend++;
      if (spend === "throw") throw new Error("rpc down");
      return spend;
    },
    async refund() {
      calls.refund++;
      if (refund === "throw") throw new Error("rpc down");
    },
  };
  return { l, calls };
}

test("startWithDeepCheck: the check is taken before the run and given back when it does not start", async () => {
  const credit = { useCredit: true as const, credits: { plan: "free" as const, left: 1 } };
  // No check needed: nothing spent.
  {
    const { l, calls } = ledger(true);
    let started = 0;
    const out = await startWithDeepCheck({}, l, async () => {
      started++;
      return startedRun;
    });
    assert.equal(out.ok, true);
    assert.deepEqual(calls, { spend: 0, refund: 0 });
    assert.equal(started, 1);
  }
  // Started: spent once, kept.
  {
    const { l, calls } = ledger(true);
    const out = await startWithDeepCheck(credit, l, async () => startedRun);
    assert.equal(out.ok, true);
    assert.deepEqual(calls, { spend: 1, refund: 0 });
  }
  // The engine refused (unknown company, ANAF down, caps, same company today): given back.
  for (const reason of ["not_found", "anaf_unavailable", "daily_cap_global", "already_running"]) {
    const { l, calls } = ledger(true);
    const out = await startWithDeepCheck(credit, l, async () => ({
      ok: false,
      reason: reason as never,
    }));
    assert.equal(out.ok, false);
    assert.deepEqual(calls, { spend: 1, refund: 1 }, reason);
  }
  // The engine threw: given back, the error goes on.
  {
    const { l, calls } = ledger(true);
    await assert.rejects(
      startWithDeepCheck(credit, l, async () => {
        throw new Error("boom");
      }),
      /boom/,
    );
    assert.deepEqual(calls, { spend: 1, refund: 1 });
  }
  // A failed refund is logged, never thrown over the engine's answer.
  {
    const { l } = ledger(true, "throw");
    const logged: unknown[] = [];
    const out = await startWithDeepCheck(
      credit,
      l,
      async () => ({ ok: false, reason: "not_found" }),
      (e) => logged.push(e),
    );
    assert.deepEqual(out, { ok: false, reason: "not_found" });
    assert.equal(logged.length, 1);
  }
});

test("startWithDeepCheck: no check to take refuses before the engine runs", async () => {
  let started = 0;
  const start = async () => {
    started++;
    return startedRun;
  };
  // Another tab took the last check between the gate and the start.
  const free = await startWithDeepCheck(
    { useCredit: true, credits: { plan: "free", left: 1 } },
    ledger(false).l,
    start,
  );
  assert.deepEqual(free, { ok: false, reason: "free_run_used" });
  const premium = await startWithDeepCheck(
    { useCredit: true, credits: { plan: "premium", left: 1 } },
    ledger(false).l,
    start,
  );
  assert.deepEqual(premium, { ok: false, reason: "premium_required" });
  // The ledger is unreachable: try again, nothing spent, nothing started.
  const down = await startWithDeepCheck({ useCredit: true }, ledger("throw").l, start);
  assert.deepEqual(down, { ok: false, reason: "ledger_unavailable" });
  const missing = await startWithDeepCheck({ useCredit: true }, null, start);
  assert.deepEqual(missing, { ok: false, reason: "ledger_unavailable" });
  assert.equal(started, 0);
});

test("one check, two tabs: deep_use_credit takes it once, the second start is refused", async () => {
  const db = new FakeSupabase({ now: () => NOW });
  // A port of drizzle/migrations/0003: a missing row is a free account with 1 check.
  db.rpcs.deep_use_credit = (a) => {
    const rows = db.rows("deep_credits");
    let row = rows.find((r) => r.user_id === a._uid);
    if (!row) rows.push((row = { user_id: a._uid, plan: "free", credits: 1, updated_by: null }));
    if (Number(row.credits) <= 0) return { data: false, error: null };
    row.credits = Number(row.credits) - 1;
    return { data: true, error: null };
  };
  db.rpcs.deep_refund_credit = (a) => {
    const row = db.rows("deep_credits").find((r) => r.user_id === a._uid);
    if (row) row.credits = Math.min(Number(row.credits) + 1, 1000);
    return { data: null, error: null };
  };
  const l: DeepCheckLedger = {
    async spend() {
      const { data, error } = await db.rpc("deep_use_credit", { _uid: USER });
      if (error) throw new Error(String(error.message));
      return data === true;
    },
    async refund() {
      await db.rpc("deep_refund_credit", { _uid: USER });
    },
  };
  const access = { useCredit: true as const, credits: { plan: "free" as const, left: 1 } };
  const [a, b] = await Promise.all([
    startWithDeepCheck(access, l, async () => startedRun),
    startWithDeepCheck(access, l, async () => startedRun),
  ]);
  assert.deepEqual([a.ok, b.ok].sort(), [false, true]);
  assert.equal(db.rows("deep_credits")[0].credits, 0);
  // The check row deep_use_credit created carries no updated_by: not granted by an admin.
  assert.deepEqual(await supabaseLookups(db as unknown as DeepDb).credits!(USER), {
    plan: "free",
    left: 0,
    granted: false,
  });
  // An admin grants one more; a run that does not start gives it back.
  db.rows("deep_credits")[0].credits = 1;
  const refused = await startWithDeepCheck({ useCredit: true }, l, async () => ({
    ok: false,
    reason: "not_found",
  }));
  assert.deepEqual(refused, { ok: false, reason: "not_found" });
  assert.equal(db.rows("deep_credits")[0].credits, 1);
});

/* ------------------------------------------- the lookup and the admin write */

test("the credits lookup: no row is the free check; updated_by or premium means granted; errors are null", async () => {
  const db = new FakeSupabase();
  const read = () => supabaseLookups(db as unknown as DeepDb).credits!(USER);
  assert.deepEqual(await read(), { plan: "free", left: 1, granted: false });
  db.rows("deep_credits").push({ user_id: USER, plan: "free", credits: 3, updated_by: ADMIN });
  assert.deepEqual(await read(), { plan: "free", left: 3, granted: true });
  db.rows("deep_credits")[0] = { user_id: USER, plan: "premium", credits: 2, updated_by: null };
  assert.deepEqual(await read(), { plan: "premium", left: 2, granted: true });
  db.rows("deep_credits")[0] = { user_id: USER, plan: "free", credits: -2, updated_by: null };
  assert.deepEqual(await read(), { plan: "free", left: 0, granted: false });
  const broken = new FakeSupabase({
    fail: (t) => (t.table === "deep_credits" ? { code: "XX000" } : null),
  });
  assert.equal(await supabaseLookups(broken as unknown as DeepDb).credits!(USER), null);
  assert.equal(await supabaseLookups(null).credits!(USER), null);
});

test("saveDeepCredits: a plan resets the checks, a number keeps the plan, a failed read saves nothing", async () => {
  const db = new FakeSupabase({ now: () => NOW });
  const premium = await saveDeepCredits(db, ADMIN, { userId: USER, plan: "premium" }, NOW);
  assert.deepEqual(premium, { ok: true, plan: "premium", credits: PLAN_CHECKS.premium });
  const row = () => db.rows("deep_credits").find((r) => r.user_id === USER);
  assert.equal(row()?.updated_by, ADMIN, "an admin's write marks the checks as granted");
  // Only the number: the premium plan stays.
  const two = await saveDeepCredits(db, ADMIN, { userId: USER, credits: 2 }, NOW);
  assert.deepEqual(two, { ok: true, plan: "premium", credits: 2 });
  assert.equal(db.rows("deep_credits").length, 1);
  // The current row cannot be read: refuse, never save "free" over "premium".
  const failing = new FakeSupabase({
    fail: (t) => (t.table === "deep_credits" && t.op === "select" ? { code: "XX000" } : null),
  });
  failing.rows("deep_credits").push({ user_id: USER, plan: "premium", credits: 4 });
  await assert.rejects(saveDeepCredits(failing, ADMIN, { userId: USER, credits: 1 }), /read/);
  assert.equal(failing.rows("deep_credits")[0].plan, "premium");
  assert.equal(failing.rows("deep_credits")[0].credits, 4);
});

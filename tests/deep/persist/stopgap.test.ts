import assert from "node:assert/strict";
import { test } from "node:test";

import type { ConsentRecord, DeepReport } from "../../../src/lib/deep/contracts";
import type { DeepDb } from "../../../src/lib/deep/persist-db.server";
import { createStopgapStore, STOPGAP } from "../../../src/lib/deep/persist-stopgap.server";
import { deepConsentRecord } from "../../../src/lib/scan/legal/lead-notice";

import { FakeSupabase, type FakeOptions } from "./fake-supabase";

/*
 * The stopgap store over a fake Supabase (audit_leads rows): caps by
 * insert-then-count, the 10-minute concurrency rule, spend and idempotency,
 * compare-and-swap retries, step claims with replay, retention and the rows'
 * privacy (placeholder e-mails, never the user's).
 */

const U1 = "11111111-0000-4000-8000-000000000001";
const U2 = "22222222-0000-4000-8000-000000000002";
const T0 = Date.UTC(2026, 9, 3, 9, 0, 0); // 12:00 in Bucharest

function setup(opts: Omit<FakeOptions, "now"> = {}) {
  const clock = { t: T0 };
  const db = new FakeSupabase({ ...opts, now: () => clock.t });
  const store = createStopgapStore(db as unknown as DeepDb, {
    now: () => clock.t,
    sleep: async (ms) => {
      clock.t += ms;
    },
    random: () => 0.5,
  });
  return { clock, db, store };
}

const consent: ConsentRecord = deepConsentRecord("ro", false, new Date(T0));

const start = (
  store: ReturnType<typeof setup>["store"],
  userId: string,
  cui: string,
  over: Partial<Parameters<ReturnType<typeof setup>["store"]["startRun"]>[0]> = {},
) =>
  store.startRun({
    userId,
    cui,
    companyName: "Exemplu SRL",
    relationship: "proprietar",
    lang: "ro",
    via: "open",
    budgetUsd: 1.5,
    aiMode: "ai",
    consent,
    userCap: 3,
    globalCap: 10,
    allowSameCompany: false,
    ...over,
  });

const runIdOf = (r: Awaited<ReturnType<typeof start>>) => {
  if (!("runId" in r)) throw new Error(`refused: ${r.reason}`);
  return r.runId;
};

test("a run is one audit_leads row that is never a lead: placeholder e-mail, consent record, no IP", async () => {
  const { db, store } = setup();
  const runId = runIdOf(await start(store, U1, "9259999"));
  const rows = db.rows("audit_leads");
  assert.equal(rows.length, 1);
  const row = rows[0] as {
    id: string;
    email: string;
    recommendation: string;
    answers: Record<string, unknown>;
  };
  assert.equal(row.id, runId);
  assert.equal(row.email, "deep-run@invalid");
  assert.equal(row.recommendation, STOPGAP.run);
  assert.equal(row.answers.userId, U1);
  assert.equal((row.answers.consent as ConsentRecord).channel, "vortex-deep/start");
  assert.ok(!JSON.stringify(row).match(/\b\d{1,3}(\.\d{1,3}){3}\b/), "no IP address anywhere");
  const run = await store.getRun(runId, U1);
  assert.equal(run?.status, "running");
  assert.equal(run?.cui, "9259999");
  assert.equal(await store.getRun(runId, U2), null);
});

test("caps by insert-then-count: the 4th run of the day is refused and its row canceled", async () => {
  const { db, clock, store } = setup();
  for (const cui of ["101", "102", "103"]) {
    const id = runIdOf(await start(store, U1, cui));
    await store.finish({ runId: id, status: "succeeded" });
    clock.t += 60_000;
  }
  const fourth = await start(store, U1, "104");
  assert.deepEqual(fourth, { reason: "daily_cap_user" });
  const canceled = db
    .rows("audit_leads")
    .filter((r) => (r.answers as { status: string }).status === "canceled");
  assert.equal(canceled.length, 1);
  assert.equal((await store.dayStats(U1)).userRuns, 3);
  // A new day resets the count (Europe/Bucharest midnight).
  clock.t = Date.UTC(2026, 9, 3, 21, 30, 0); // 00:30 on 4 October in Bucharest
  assert.ok("runId" in (await start(store, U1, "105")));
});

test("global cap counts non-admin runs only; admins are never blocked by it", async () => {
  const { clock, store } = setup();
  for (let i = 0; i < 4; i++) {
    const id = runIdOf(
      await start(store, `aaaaaaaa-0000-4000-8000-00000000000${i}`, String(200 + i), {
        globalCap: 4,
      }),
    );
    await store.finish({ runId: id, status: "succeeded" });
    clock.t += 1000;
  }
  assert.deepEqual(await start(store, U2, "300", { globalCap: 4 }), { reason: "daily_cap_global" });
  assert.ok(
    "runId" in (await start(store, U1, "301", { globalCap: 4, via: "admin", userCap: 20 })),
  );
});

test("one active run per account; a run idle for over 10 minutes no longer blocks", async () => {
  const { clock, store } = setup();
  runIdOf(await start(store, U1, "401"));
  assert.deepEqual(await start(store, U1, "402"), { reason: "already_running" });
  clock.t += 15 * 60_000;
  assert.ok("runId" in (await start(store, U1, "403")));
});

test("same company today replays the finished run unless an admin asks again", async () => {
  const { clock, store } = setup();
  const id = runIdOf(await start(store, U1, "9259999"));
  await store.finish({ runId: id, status: "succeeded" });
  clock.t += 60_000;
  assert.deepEqual(await start(store, U1, "9259999"), {
    reason: "same_company_today",
    replayRunId: id,
  });
  assert.ok("runId" in (await start(store, U1, "9259999", { allowSameCompany: true })));
});

test("spend: run budget, day budget across runs, idempotent replay, in-flight and closed runs", async () => {
  const { clock, store } = setup();
  const a = runIdOf(await start(store, U1, "501"));
  const b = runIdOf(await start(store, U2, "502"));
  const reserve = (runId: string, idemKey: string, usd: number, dayCapUsd = 15) =>
    store.reserve({ runId, idemKey, kind: "llm", step: "synthesis", usd, dayCapUsd });

  const r1 = await reserve(a, "a|synthesis|brief|x", 0.6);
  assert.equal(r1.ok, true);
  assert.deepEqual(await reserve(a, "a|synthesis|brief|x", 0.6), {
    ok: false,
    reason: "in_flight",
  });
  assert.deepEqual(await reserve(a, "a|synthesis|customer|y", 1.0), {
    ok: false,
    reason: "run_budget",
  });
  // The day cap holds across runs: 0.6 reserved on run a + 0.5 on run b > 1.0.
  assert.deepEqual(await reserve(b, "b|synthesis|brief|z", 0.5, 1.0), {
    ok: false,
    reason: "day_budget",
  });

  if (!r1.ok) throw new Error("no call");
  await store.settle({
    callId: r1.callId,
    usd: 0.21,
    usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
    result: { text: "secțiunea" },
  });
  assert.deepEqual(await reserve(a, "a|synthesis|brief|x", 0.6), {
    ok: false,
    reason: "replay",
    result: { text: "secțiunea" },
  });
  const spend = await store.runSpend!(a);
  assert.deepEqual(spend, { budgetUsd: 1.5, spentUsd: 0.21, reservedUsd: 0 });

  // An unsettled reservation counts as spent at finish; the run is then closed.
  const r2 = await reserve(a, "a|synthesis|customer|y", 0.3);
  assert.equal(r2.ok, true);
  clock.t += 1000;
  await store.finish({ runId: a, status: "partial" });
  assert.deepEqual(await store.runSpend!(a), { budgetUsd: 1.5, spentUsd: 0.51, reservedUsd: 0 });
  assert.deepEqual(await reserve(a, "a|synthesis|rivals|w", 0.1), {
    ok: false,
    reason: "run_closed",
  });
  assert.deepEqual(await reserve("99999999-0000-4000-8000-000000000009", "k", 0.1), {
    ok: false,
    reason: "run_not_found",
  });
  assert.equal((await store.dayStats(U1)).allUsd.toFixed(2), "0.51");
});

test("subrequests: a reservation takes 2 requests and a step claim 2, a settled claim with its result 3", async () => {
  const { db, store } = setup();
  const a = runIdOf(await start(store, U1, "555"));
  const count = async (work: () => Promise<unknown>) => {
    const before = db.log.length;
    await work();
    return db.log.length - before;
  };
  assert.equal(
    await count(() =>
      store.reserve({
        runId: a,
        idemKey: "k",
        kind: "llm",
        step: "synthesis",
        usd: 0.1,
        dayCapUsd: 15,
      }),
    ),
    2,
  );
  let claimId = "";
  assert.equal(
    await count(async () => {
      const c = await store.claimStep({ runId: a, userId: U1, key: "crawl|abc", max: 1 });
      if (c.ok) claimId = c.claimId;
    }),
    2,
  );
  assert.equal(
    await count(() => store.settleStep({ runId: a, claimId, used: 1, result: { att: "z" } })),
    3,
  );
  assert.deepEqual(await store.claimStep({ runId: a, userId: U1, key: "crawl|abc", max: 1 }), {
    ok: false,
    reason: "replay",
    result: { att: "z" },
  });
});

test("the breaker stops every paid call for its time, in every run", async () => {
  const { clock, store } = setup();
  const a = runIdOf(await start(store, U1, "601"));
  await store.tripBreaker(15, "billing_error");
  assert.equal(await store.breakerOpen(), true);
  assert.deepEqual(
    await store.reserve({
      runId: a,
      idemKey: "k",
      kind: "llm",
      step: "synthesis",
      usd: 0.1,
      dayCapUsd: 15,
    }),
    { ok: false, reason: "breaker" },
  );
  clock.t += 16 * 60_000;
  assert.equal(await store.breakerOpen(), false);
  assert.equal(
    (
      await store.reserve({
        runId: a,
        idemKey: "k",
        kind: "llm",
        step: "synthesis",
        usd: 0.1,
        dayCapUsd: 15,
      })
    ).ok,
    true,
  );
});

test("compare-and-swap: a concurrent write is retried; a database error means no paid call", async () => {
  let collisions = 2;
  const { db, store } = setup({
    beforeUpdate: (_table, rows) => {
      if (collisions > 0) {
        collisions--;
        for (const row of rows) {
          const answers = row.answers as { rev: number };
          answers.rev += 1; // another isolate wrote first
        }
      }
    },
  });
  const a = runIdOf(await start(store, U1, "701"));
  const r = await store.reserve({
    runId: a,
    idemKey: "k",
    kind: "llm",
    step: "synthesis",
    usd: 0.1,
    dayCapUsd: 15,
  });
  assert.equal(r.ok, true, "succeeds after two collisions");
  assert.equal(collisions, 0);

  const failing = setup({
    fail: ({ table, op }) =>
      table === "audit_leads" && op === "update" ? { code: "XX000", message: "down" } : null,
  });
  const b = runIdOf(await start(failing.store, U1, "702"));
  assert.deepEqual(
    await failing.store.reserve({
      runId: b,
      idemKey: "k",
      kind: "llm",
      step: "synthesis",
      usd: 0.1,
      dayCapUsd: 15,
    }),
    { ok: false, reason: "ledger_error" },
  );
  const noRead = setup();
  const c = runIdOf(await start(noRead.store, U1, "703"));
  noRead.db.opts.fail = ({ op }) => (op === "select" ? { code: "XX000" } : null);
  assert.deepEqual(
    await noRead.store.reserve({
      runId: c,
      idemKey: "k",
      kind: "llm",
      step: "synthesis",
      usd: 0.1,
      dayCapUsd: 15,
    }),
    { ok: false, reason: "ledger_error" },
  );
  void db;
});

test("compare-and-swap gives up after 5 tries (never writes blind)", async () => {
  const { store } = setup({
    beforeUpdate: (_t, rows) => {
      for (const row of rows) (row.answers as { rev: number }).rev += 1;
    },
  });
  const a = runIdOf(await start(store, U1, "801"));
  assert.deepEqual(
    await store.reserve({
      runId: a,
      idemKey: "k",
      kind: "llm",
      step: "synthesis",
      usd: 0.1,
      dayCapUsd: 15,
    }),
    { ok: false, reason: "ledger_error" },
  );
});

test("step claims: exclusive in-flight, counters, used-up steps replay their stored result", async () => {
  const { clock, db, store } = setup();
  const a = runIdOf(await start(store, U1, "901"));
  const claim = (key: string, max: number, extra: { units?: number; exclusive?: boolean } = {}) =>
    store.claimStep({ runId: a, userId: U1, key, max, ...extra });

  const money = await claim("money", 1);
  assert.equal(money.ok, true);
  assert.deepEqual(await claim("money", 1), { ok: false, reason: "in_flight" });
  if (!money.ok) throw new Error();
  await store.settleStep({
    runId: a,
    claimId: money.claimId,
    used: 1,
    result: { step: "money", att: "x" },
  });
  assert.deepEqual(await claim("money", 1), {
    ok: false,
    reason: "replay",
    result: { step: "money", att: "x" },
  });
  assert.equal(db.rows("audit_leads").filter((r) => r.recommendation === STOPGAP.step).length, 1);

  // A counter: 8 ANAF calls after start; money takes 7, peers gets the last one.
  const anaf1 = await claim("anaf", 8, { units: 7, exclusive: false });
  assert.deepEqual(anaf1.ok && anaf1.granted, 7);
  const anaf2 = await claim("anaf", 8, { units: 7, exclusive: false });
  assert.deepEqual(anaf2.ok && anaf2.granted, 1);
  assert.deepEqual(await claim("anaf", 8, { units: 1, exclusive: false }), {
    ok: false,
    reason: "exhausted",
  });
  // Unused units come back.
  if (!anaf1.ok) throw new Error();
  await store.settleStep({ runId: a, claimId: anaf1.claimId, used: 5 });
  const anaf3 = await claim("anaf", 8, { units: 7, exclusive: false });
  assert.deepEqual(anaf3.ok && anaf3.granted, 2);

  // A claim left unsettled for over 2 minutes no longer blocks, but a used-up key stays used.
  const site = await claim("site", 2);
  assert.equal(site.ok, true);
  clock.t += 3 * 60_000;
  const site2 = await claim("site", 2);
  assert.equal(site2.ok, true);
  assert.deepEqual(await claim("site", 2), { ok: false, reason: "in_flight" });

  // Another user, or a closed run, gets nothing.
  assert.deepEqual(await store.claimStep({ runId: a, userId: U2, key: "audit", max: 1 }), {
    ok: false,
    reason: "run_not_found",
  });
  await store.finish({ runId: a, status: "succeeded" });
  assert.deepEqual(await claim("audit", 1), { ok: false, reason: "run_closed" });
});

test("finish keeps the report for a retried finish and for the verification code", async () => {
  const { store } = setup();
  const a = runIdOf(await start(store, U1, "1001"));
  const report = {
    schema: 1,
    runId: a,
    cui: "1001",
    verifyCode: "7KQ4M2XD",
  } as unknown as DeepReport;
  await store.finish({
    runId: a,
    status: "succeeded",
    report,
    reportAtt: "att",
    verifyCode: "7KQ4M2XD",
    metrics: { kept: 3 },
  });
  assert.deepEqual(await store.loadReport!({ runId: a, userId: U1 }), { report, reportAtt: "att" });
  assert.equal(await store.loadReport!({ runId: a, userId: U2 }), null);
  assert.deepEqual(await store.loadReport!({ verifyCode: "7KQ4M2XD" }), {
    report,
    reportAtt: "att",
  });
  assert.equal(await store.loadReport!({ verifyCode: "AAAAAAAA" }), null);
});

test("feedback is limited per account and day; a call request is a real lead the person asked for", async () => {
  const { db, store } = setup();
  const a = runIdOf(await start(store, U1, "1101"));
  for (let i = 0; i < 20; i++)
    await store.feedback({
      runId: a,
      userId: U1,
      kind: "error_report",
      factId: `f${i}`,
      message: "greșit",
    });
  await assert.rejects(
    store.feedback({ runId: a, userId: U1, kind: "error_report", message: "încă una" }),
    /feedback_limit/,
  );
  const fb = db.rows("audit_leads").filter((r) => r.recommendation === STOPGAP.feedback);
  assert.equal(fb.length, 20);
  assert.ok(fb.every((r) => r.email === "deep-feedback@invalid"));

  await store.callRequest({
    runId: a,
    userId: U1,
    email: "ana@example.ro",
    phone: "+40 712 345 678",
    when: "dimineata",
    cui: "1101",
    lang: "ro",
  });
  const call = db.rows("audit_leads").find((r) => r.recommendation === STOPGAP.callRequest)!;
  assert.equal(call.email, "ana@example.ro");
  assert.equal((call.answers as { phone: string }).phone, "+40 712 345 678");
  assert.match((call.answers as { basis: string }).basis, /6\(1\)\(b\)/);
});

test("retention: runs and breaker rows after 90 days, step rows after 2 days, feedback after 12 months, once an hour", async () => {
  const { clock, db, store } = setup();
  const day = 24 * 3600_000;
  const at = (ms: number) => new Date(T0 - ms).toISOString();
  db.rows("audit_leads").push(
    {
      id: "old-run",
      recommendation: STOPGAP.run,
      created_at: at(91 * day),
      answers: { source: "vortex-deep" },
    },
    {
      id: "new-run",
      recommendation: STOPGAP.run,
      created_at: at(89 * day),
      answers: { source: "vortex-deep" },
    },
    { id: "old-step", recommendation: STOPGAP.step, created_at: at(3 * day), answers: {} },
    { id: "new-step", recommendation: STOPGAP.step, created_at: at(1 * day), answers: {} },
    { id: "old-fb", recommendation: STOPGAP.feedback, created_at: at(366 * day), answers: {} },
    { id: "new-fb", recommendation: STOPGAP.feedback, created_at: at(300 * day), answers: {} },
    {
      id: "lead",
      recommendation: "Vortex Scan blueprint x",
      created_at: at(500 * day),
      answers: {},
    },
  );
  await store.purgeIfDue();
  const ids = db.rows("audit_leads").map((r) => r.id);
  assert.deepEqual(ids.sort(), ["lead", "new-fb", "new-run", "new-step"]);
  // Not again within the hour.
  db.rows("audit_leads").push({
    id: "old-run-2",
    recommendation: STOPGAP.run,
    created_at: at(100 * day),
    answers: {},
  });
  await store.purgeIfDue();
  assert.ok(db.rows("audit_leads").some((r) => r.id === "old-run-2"));
  clock.t += 61 * 60_000;
  await store.purgeIfDue();
  assert.ok(!db.rows("audit_leads").some((r) => r.id === "old-run-2"));
});

test("free Premium runs are counted per account (canceled ones do not count)", async () => {
  const { clock, store } = setup();
  const id = runIdOf(await start(store, U1, "1201", { via: "free" }));
  await store.finish({ runId: id, status: "succeeded" });
  clock.t += 1000;
  assert.equal(await store.freeRunsUsed(U1), 1);
  assert.equal(await store.freeRunsUsed(U2), 0);
});

test("a step that died before settling gives its claim back after 2 minutes (no lost step)", async () => {
  const { clock, store } = setup();
  const a = runIdOf(await start(store, U1, "1201"));
  const claim = () => store.claimStep({ runId: a, userId: U1, key: "money", max: 1 });
  const first = await claim();
  assert.equal(first.ok, true);
  // The tab closed mid-step: never settled. Within 2 minutes the retry waits…
  assert.deepEqual(await claim(), { ok: false, reason: "in_flight" });
  // …after that, the unit comes back and the retry runs (before: "exhausted", a lost step).
  clock.t += 2 * 60_000 + 1;
  const retry = await claim();
  assert.equal(retry.ok, true);
  if (!retry.ok) throw new Error();
  await store.settleStep({ runId: a, claimId: retry.claimId, used: 1, result: { step: "money" } });
  assert.deepEqual(await claim(), { ok: false, reason: "replay", result: { step: "money" } });
});

test("call requests: at most 3 a day per account", async () => {
  const { db, store } = setup();
  const a = runIdOf(await start(store, U1, "1301"));
  const ask = () =>
    store.callRequest({
      runId: a,
      userId: U1,
      email: "ana@example.ro",
      phone: "+40 712 345 678",
      when: "dimineata",
      cui: "1301",
      lang: "ro",
    });
  await ask();
  await ask();
  await ask();
  await assert.rejects(ask(), /call_limit/);
  assert.equal(
    db.rows("audit_leads").filter((r) => r.recommendation === STOPGAP.callRequest).length,
    3,
  );
});

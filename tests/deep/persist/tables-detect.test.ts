import assert from "node:assert/strict";
import { test } from "node:test";

import { PostgrestClient } from "@supabase/postgrest-js";

import type { ConsentRecord, DeepReport } from "../../../src/lib/deep/contracts";
import type { DeepDb } from "../../../src/lib/deep/persist-db.server";
import {
  detectStoreKind,
  resetStoreDetection,
  storeFor,
  storeForNewRun,
  storeHoldingRun,
} from "../../../src/lib/deep/persist.server";
import { createTablesStore } from "../../../src/lib/deep/persist-tables.server";

import { installLovableLedger } from "./fake-lovable-sql";
import { FakeSupabase } from "./fake-supabase";

/*
 * The tables store on the deep ledger APPLIED to the live database (Lovable's
 * drizzle/migrations/0000): column names, the jsonb answers of its functions, the
 * optional functions of 0001 and the fallbacks used while they are missing, and the
 * feature detection that picks the store for new runs. The fake runs a port of the
 * SQL (fake-lovable-sql.ts); scripted answers cover what the port cannot produce.
 */

const U = "11111111-0000-4000-8000-000000000001";
const OTHER = "33333333-0000-4000-8000-000000000003";
const consent = { channel: "vortex-deep/start" } as unknown as ConsentRecord;
const MIN = 60_000;

function setup(opts: { additions?: boolean; t0?: number } = {}) {
  let t = opts.t0 ?? Date.parse("2026-10-03T09:00:00Z");
  const clock = {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
  const db = new FakeSupabase({ now: clock.now });
  installLovableLedger(db, { additions: opts.additions });
  const store = createTablesStore(db as unknown as DeepDb, { now: clock.now });
  return { db, store, clock };
}

const startInput = (over: Record<string, unknown> = {}) => ({
  userId: U,
  cui: "9259999",
  companyName: "Firma Test SRL",
  relationship: "proprietar" as const,
  lang: "ro" as const,
  via: "admin" as const,
  budgetUsd: 1.5,
  aiMode: "ai" as const,
  consent,
  userCap: 20,
  globalCap: 10,
  allowSameCompany: false,
  ...over,
});

for (const additions of [true, false]) {
  const label = additions ? "with 0001 (deep_start_run)" : "without 0001 (insert-then-count)";

  test(`startRun ${label}: Lovable's columns, one active run, same company today, daily caps`, async () => {
    const { db, store, clock } = setup({ additions });
    const first = await store.startRun(startInput());
    assert.ok("runId" in first);
    const row = db.rows("deep_runs").find((r) => r.id === first.runId)!;
    assert.equal(row.via, "admin");
    assert.equal(row.status, "running");
    assert.equal(row.ai_mode, "ai");
    assert.equal(row.company_name, "Firma Test SRL");
    assert.deepEqual(row.consent, consent);
    assert.equal(
      db.log.some((l) => l.fn === "deep_start_run"),
      true,
      "the optional function is always tried first",
    );

    // One active run per account.
    assert.deepEqual(await store.startRun(startInput({ cui: "123456" })), {
      reason: "already_running",
    });

    // Finished: the same company today replays it; another company starts.
    await store.finish({ runId: first.runId, status: "succeeded" });
    clock.advance(MIN);
    assert.deepEqual(await store.startRun(startInput()), {
      reason: "same_company_today",
      replayRunId: first.runId,
    });
    const second = await store.startRun(startInput({ cui: "123456", userCap: 2 }));
    assert.ok("runId" in second);
    await store.finish({ runId: second.runId, status: "partial" });

    // Per-account cap (2 runs today) and the all-accounts cap for non-admin runs.
    assert.deepEqual(await store.startRun(startInput({ cui: "777777", userCap: 2 })), {
      reason: "daily_cap_user",
    });
    assert.deepEqual(
      await store.startRun(startInput({ userId: OTHER, cui: "777777", via: "open", globalCap: 0 })),
      { reason: "daily_cap_global" },
    );
    // A refusal leaves no running row behind (refused rows, if any, are canceled).
    assert.equal(db.rows("deep_runs").filter((r) => r.status === "running").length, 0);
  });
}

test("without 0001, a start that races another one is canceled after the count", async () => {
  const { db, store, clock } = setup();
  // Another tab's start commits between our check and our count.
  const realFrom = db.from.bind(db);
  let raced = false;
  db.from = ((table: string) => {
    const q = realFrom(table) as unknown as { insert: (rows: unknown) => unknown };
    if (table === "deep_runs" && !raced) {
      const insert = q.insert.bind(q);
      q.insert = (rows: unknown) => {
        raced = true;
        db.rows("deep_runs").push(
          db.newRow("deep_runs", {
            user_id: U,
            cui: "5555",
            via: "admin",
            created_at: new Date(clock.now() - 1000).toISOString(),
          }),
        );
        return insert(rows);
      };
    }
    return q;
  }) as typeof db.from;
  assert.deepEqual(await store.startRun(startInput()), { reason: "already_running" });
  const ours = db.rows("deep_runs").find((r) => r.cui === "9259999")!;
  assert.equal(ours.status, "canceled");
});

test("startRun: an unknown answer or a database error throws (startDeepRun refuses)", async () => {
  const { db, store } = setup({ additions: true });
  db.rpcs.deep_start_run = () => ({ data: { ok: false, reason: "something_new" }, error: null });
  await assert.rejects(store.startRun(startInput()));
  db.rpcs.deep_start_run = () => ({ data: null, error: { code: "XX000", message: "down" } });
  await assert.rejects(store.startRun(startInput()));
});

test("reserve maps Lovable's deep_reserve: argument names, jsonb answers, budgets, fail closed", async () => {
  const { db, store } = setup({ additions: true });
  const run = await store.startRun(startInput({ budgetUsd: 0.5 }));
  assert.ok("runId" in run);
  const reserve = (key: string, usd: number, dayCapUsd = 15) =>
    store.reserve({
      runId: run.runId,
      idemKey: key,
      kind: "llm",
      step: "synthesis",
      model: "claude-opus-5-5",
      usd,
      dayCapUsd,
    });
  const first = await reserve("a", 0.3);
  assert.equal(first.ok, true);
  const args = db.log.find((l) => l.fn === "deep_reserve")!.args as Record<string, unknown>;
  assert.equal(args.p_key, "a");
  assert.equal(typeof args.p_day_start, "string");
  assert.equal(args.p_day_cap, 15);
  assert.deepEqual(await reserve("a", 0.3), { ok: false, reason: "in_flight" });
  assert.deepEqual(await reserve("b", 0.3), { ok: false, reason: "run_budget" });
  assert.deepEqual(await reserve("c", 0.1, 0.35), { ok: false, reason: "day_budget" });
  if (!first.ok) return;
  await store.settle({
    callId: first.callId,
    usd: 0.2,
    usage: { inputTokens: 1000.4, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 5 },
    result: { text: "x" },
  });
  assert.deepEqual(await reserve("a", 0.3), { ok: false, reason: "replay", result: { text: "x" } });
  const call = db.rows("deep_calls").find((c) => c.id === first.callId)!;
  assert.deepEqual(call.usage, {
    inputTokens: 1000,
    outputTokens: 200,
    cacheReadTokens: 0,
    cacheWriteTokens: 5,
  });
  assert.deepEqual(await store.runSpend!(run.runId), {
    budgetUsd: 0.5,
    spentUsd: 0.2,
    reservedUsd: 0,
  });

  // The breaker, and every answer the store does not recognise, refuses the call.
  await store.tripBreaker(10, "402");
  assert.deepEqual(await reserve("d", 0.1), { ok: false, reason: "breaker" });
  for (const reason of ["attempts", "run_closed", "run_not_found"]) {
    db.rpcs.deep_reserve = () => ({ data: { ok: false, reason }, error: null });
    assert.deepEqual(await reserve("e", 0.1), { ok: false, reason });
  }
  db.rpcs.deep_reserve = () => ({ data: { ok: false, reason: "something_new" }, error: null });
  assert.deepEqual(await reserve("e", 0.1), { ok: false, reason: "ledger_error" });
  db.rpcs.deep_reserve = () => ({ data: { ok: true }, error: null });
  assert.deepEqual(await reserve("e", 0.1), { ok: false, reason: "ledger_error" });
  db.rpcs.deep_reserve = () => ({ data: null, error: { code: "57014", message: "timeout" } });
  assert.deepEqual(await reserve("e", 0.1), { ok: false, reason: "ledger_error" });
});

test("finish closes the run: unsettled reservations count as spent, the report and code are kept", async () => {
  const { db, store } = setup({ additions: true });
  const run = await store.startRun(startInput());
  assert.ok("runId" in run);
  await store.reserve({
    runId: run.runId,
    idemKey: "k",
    kind: "llm",
    step: "synthesis",
    usd: 0.25,
    dayCapUsd: 15,
  });
  const report = { cui: "9259999" } as unknown as DeepReport;
  await store.finish({
    runId: run.runId,
    status: "partial",
    report,
    reportAtt: "att",
    verifyCode: "ABCD-EFGH",
    metrics: { facts: 3 },
    error: "x".repeat(3000),
  });
  const row = db.rows("deep_runs").find((r) => r.id === run.runId)!;
  assert.equal(row.status, "partial");
  assert.equal(row.reserved_usd, 0);
  assert.equal(row.spent_usd, 0.25);
  assert.equal((row.error as string).length, 2000);
  assert.deepEqual(await store.loadReport!({ verifyCode: "ABCD-EFGH" }), {
    runId: run.runId,
    report,
    reportAtt: "att",
  });
  assert.deepEqual(await store.loadReport!({ runId: run.runId, userId: U }), {
    runId: run.runId,
    report,
    reportAtt: "att",
  });
  assert.equal(await store.loadReport!({ runId: run.runId, userId: OTHER }), null);
  assert.equal(await store.getRun(run.runId, OTHER), null);
  assert.equal((await store.getRun(run.runId, U))?.via, "admin");
  // A closed run takes no more claims or reservations.
  assert.deepEqual(await store.claimStep({ runId: run.runId, userId: U, key: "money", max: 1 }), {
    ok: false,
    reason: "run_closed",
  });
});

test("claims map Lovable's deep_claim_step: exclusive steps, counters, replay, fail closed", async () => {
  const { db, store } = setup({ additions: true });
  const run = await store.startRun(startInput());
  assert.ok("runId" in run);
  const money = () => store.claimStep({ runId: run.runId, userId: U, key: "money", max: 1 });
  const first = await money();
  assert.equal(first.ok, true);
  assert.deepEqual(await money(), { ok: false, reason: "in_flight" });
  if (first.ok)
    await store.settleStep({ runId: run.runId, claimId: first.claimId, result: { att: "a" } });
  assert.deepEqual(await money(), { ok: false, reason: "replay", result: { att: "a" } });

  const anaf = (units: number) =>
    store.claimStep({ runId: run.runId, userId: U, key: "anaf", max: 8, units, exclusive: false });
  const a = await anaf(7);
  assert.deepEqual(a.ok && a.granted, 7);
  if (a.ok) await store.settleStep({ runId: run.runId, claimId: a.claimId, used: 5 });
  const b = await anaf(7);
  assert.deepEqual(b.ok && b.granted, 3);
  assert.deepEqual(await anaf(1), { ok: false, reason: "exhausted" });
  assert.deepEqual(
    await store.claimStep({ runId: run.runId, userId: OTHER, key: "site", max: 2 }),
    { ok: false, reason: "run_not_found" },
  );
  const args = db.log.filter((l) => l.fn === "deep_claim_step").at(-1)!.args as Record<
    string,
    unknown
  >;
  assert.equal(args.p_exclusive, true);
  db.rpcs.deep_claim_step = () => ({ data: null, error: { code: "XX000" } });
  assert.deepEqual(await money(), { ok: false, reason: "ledger_error" });
  db.rpcs.deep_claim_step = () => ({ data: { ok: true, granted: 1 }, error: null });
  assert.deepEqual(await money(), { ok: false, reason: "ledger_error" });
});

for (const additions of [true, false]) {
  const label = additions ? "deep_reclaim_step (0001)" : "the compare-and-swap fallback";
  test(`a step that died gives its claim back after 2 minutes, through ${label}`, async () => {
    const { db, store, clock } = setup({ additions });
    const run = await store.startRun(startInput());
    assert.ok("runId" in run);
    const audit = () => store.claimStep({ runId: run.runId, userId: U, key: "audit", max: 1 });
    const dead = await audit();
    assert.equal(dead.ok, true);
    clock.advance(MIN);
    assert.deepEqual(await audit(), { ok: false, reason: "in_flight" });
    clock.advance(2 * MIN);
    const retry = await audit();
    assert.equal(retry.ok, true, JSON.stringify(retry));
    const slotRow = db.rows("deep_slots").find((s) => s.key === "audit")!;
    assert.equal(slotRow.used, 1);
    assert.equal(db.rows("deep_claims").filter((c) => c.key === "audit").length, 1);
    // The dead claim's late settle changes nothing (its row is gone).
    if (dead.ok)
      await store.settleStep({ runId: run.runId, claimId: dead.claimId, result: { x: 1 } });
    assert.equal(slotRow.result, null);
    // A settled step is replayed, never reclaimed.
    if (retry.ok)
      await store.settleStep({ runId: run.runId, claimId: retry.claimId, result: { att: "b" } });
    clock.advance(5 * MIN);
    assert.deepEqual(await audit(), { ok: false, reason: "replay", result: { att: "b" } });
  });
}

test("day stats, the breaker (never shortened), free runs and the account's run list", async () => {
  const { db, store, clock } = setup({ additions: true });
  const a = await store.startRun(startInput({ via: "open", budgetUsd: 1 }));
  assert.ok("runId" in a);
  await store.reserve({
    runId: a.runId,
    idemKey: "k",
    kind: "llm",
    step: "brief" as never,
    usd: 0.4,
    dayCapUsd: 15,
  });
  await store.finish({
    runId: a.runId,
    status: "succeeded",
    reportAtt: "att",
    verifyCode: "CODE-0001",
  });
  const b = await store.startRun(startInput({ userId: OTHER, via: "free", cui: "123456" }));
  assert.ok("runId" in b);
  assert.deepEqual(await store.dayStats(U), { userRuns: 1, allRuns: 2, allUsd: 0.4 });
  assert.equal(await store.freeRunsUsed(OTHER), 1);
  assert.equal(await store.freeRunsUsed(U), 0);

  // The admin panel's 30-day pause is never shortened by an automatic 10-minute trip.
  db.rows("deep_breaker").push(
    db.newRow("deep_breaker", {
      id: 1,
      until: new Date(clock.now() + 30 * 24 * 60 * MIN).toISOString(),
      reason: "admin",
    }),
  );
  await store.tripBreaker(10, "spend limit");
  assert.equal(db.rows("deep_breaker")[0].reason, "admin");
  assert.equal(await store.breakerOpen(), true);
  db.rows("deep_breaker")[0].until = new Date(clock.now() - 1000).toISOString();
  assert.equal(await store.breakerOpen(), false);
  await store.tripBreaker(10, "spend limit");
  assert.equal(db.rows("deep_breaker").length, 1);
  assert.equal(db.rows("deep_breaker")[0].reason, "spend limit");
  assert.equal(await store.breakerOpen(), true);

  const list = await store.listRuns(U);
  assert.equal(list.length, 1);
  assert.equal(list[0].runId, a.runId);
  assert.equal(list[0].status, "succeeded");
  assert.equal(list[0].hasReport, true);
  assert.equal(list[0].verifyCode, "CODE-0001");
  assert.equal(list[0].spentUsd, 0.4);
  assert.deepEqual(await store.listRuns("44444444-0000-4000-8000-000000000004"), []);
});

test("an automatic trip racing the admin's 30-day pause never overwrites it", async () => {
  let t = Date.parse("2026-10-03T09:00:00Z");
  const now = () => t;
  const month = new Date(t + 30 * 24 * 60 * MIN).toISOString();
  // The admin panel's upsert lands while the automatic trip is in flight.
  const db = new FakeSupabase({
    now,
    beforeUpdate: (table, rows) => {
      if (table === "deep_breaker")
        for (const row of rows) Object.assign(row, { until: month, reason: "admin" });
    },
  });
  installLovableLedger(db, { additions: true });
  const store = createTablesStore(db as unknown as DeepDb, { now });
  db.rows("deep_breaker").push(
    db.newRow("deep_breaker", { id: 1, until: new Date(t - MIN).toISOString(), reason: "old" }),
  );
  await store.tripBreaker(10, "spend limit");
  assert.equal(db.rows("deep_breaker").length, 1);
  assert.equal(db.rows("deep_breaker")[0].reason, "admin");
  assert.equal(db.rows("deep_breaker")[0].until, month);
  // No breaker row yet: the trip inserts it.
  const fresh = new FakeSupabase({ now });
  installLovableLedger(fresh, { additions: true });
  await createTablesStore(fresh as unknown as DeepDb, { now }).tripBreaker(10, "402");
  assert.equal(fresh.rows("deep_breaker").length, 1);
  assert.equal(fresh.rows("deep_breaker")[0].reason, "402");
  t += MIN;
});

test("feedback and call requests go to Lovable's tables with their daily limits", async () => {
  const { db, store } = setup({ additions: true });
  const run = await store.startRun(startInput());
  assert.ok("runId" in run);
  await store.feedback({ runId: run.runId, userId: U, kind: "useful_yes", value: { a: 1 } });
  const fb = db.rows("deep_feedback")[0];
  assert.equal(fb.run_id, run.runId);
  assert.equal(fb.kind, "useful_yes");
  assert.deepEqual(fb.value, { a: 1 });
  for (let i = 1; i < 20; i++)
    await store.feedback({ runId: run.runId, userId: U, kind: "error_report" });
  await assert.rejects(
    store.feedback({ runId: run.runId, userId: U, kind: "error_report" }),
    /feedback_limit/,
  );

  const call = {
    runId: run.runId,
    userId: U,
    email: "owner@example.com",
    phone: "+40 700 000 000",
    when: "dimineata",
    cui: "9259999",
    lang: "ro" as const,
  };
  await store.callRequest(call);
  const row = db.rows("deep_call_requests")[0];
  assert.equal(row.call_when, "dimineata");
  assert.equal(row.phone, "+40 700 000 000");
  assert.equal(row.email, "owner@example.com");
  await store.callRequest(call);
  await store.callRequest(call);
  await assert.rejects(store.callRequest(call), /call_limit/);
  // The stopgap's lead rows are not used when the tables exist.
  assert.equal(db.rows("audit_leads").length, 0);
});

test("retention: runs after 90 days and feedback after 12 months, at most once an hour", async () => {
  const { db, store, clock } = setup({ additions: true });
  const day = 24 * 60 * MIN;
  const old = db.newRow("deep_runs", {
    user_id: U,
    cui: "1",
    via: "admin",
    created_at: new Date(clock.now() - 91 * day).toISOString(),
  });
  const kept = db.newRow("deep_runs", {
    user_id: U,
    cui: "2",
    via: "admin",
    created_at: new Date(clock.now() - 89 * day).toISOString(),
  });
  db.rows("deep_runs").push(old, kept);
  db.rows("deep_feedback").push(
    db.newRow("deep_feedback", {
      run_id: kept.id,
      user_id: U,
      kind: "useful_no",
      created_at: new Date(clock.now() - 400 * day).toISOString(),
    }),
    db.newRow("deep_feedback", { run_id: kept.id, user_id: U, kind: "useful_yes" }),
  );
  await store.purgeIfDue();
  assert.deepEqual(
    db.rows("deep_runs").map((r) => r.cui),
    ["2"],
  );
  assert.deepEqual(
    db.rows("deep_feedback").map((r) => r.kind),
    ["useful_yes"],
  );
  const deletes = db.log.filter((l) => l.op === "delete").length;
  await store.purgeIfDue();
  assert.equal(db.log.filter((l) => l.op === "delete").length, deletes);
});

test("feature detection probes deep_slots: missing → stopgap (5 min); present → tables (1 h); other errors → no store", async () => {
  let t = 0;
  const now = () => t;
  resetStoreDetection();
  const missing = new FakeSupabase({
    fail: ({ table }) =>
      table === "deep_slots" ? { code: "PGRST205", message: "not in schema cache" } : null,
  });
  assert.equal(await detectStoreKind({ db: missing as unknown as DeepDb, now }), "stopgap");
  assert.equal((await storeForNewRun({ db: missing as unknown as DeepDb, now }))?.kind, "stopgap");

  // Tables appear: still "stopgap" from the cache until the 5 minutes pass, then "tables".
  const present = new FakeSupabase();
  t += 4 * MIN;
  assert.equal(await detectStoreKind({ db: present as unknown as DeepDb, now }), "stopgap");
  t += 2 * MIN;
  assert.equal(await detectStoreKind({ db: present as unknown as DeepDb, now }), "tables");
  assert.equal((await storeForNewRun({ db: present as unknown as DeepDb, now }))?.kind, "tables");
  assert.ok(present.log.some((l) => l.table === "deep_slots"));

  resetStoreDetection();
  const broken = new FakeSupabase({
    fail: () => ({ code: "XX000", message: "connection refused" }),
  });
  assert.equal(await detectStoreKind({ db: broken as unknown as DeepDb, now }), null);
  assert.equal(await storeForNewRun({ db: broken as unknown as DeepDb, now }), null);
  // No credentials: no store at all, never a silent in-memory fallback.
  resetStoreDetection();
  assert.equal(await storeForNewRun({ db: null, now }), null);
  resetStoreDetection();
});

test("detection with the real supabase-js client: a missing table is the stopgap, never 'tables'", async () => {
  // PostgREST answers a missing table with 404 and PGRST205 in the body; a HEAD response
  // carries no body, which postgrest-js reports as success. The probe must be a GET.
  const requests: string[] = [];
  const respond = (missing: boolean) =>
    (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      requests.push(`${method} ${String(input).replace(/^https?:\/\/[^/]+/, "")}`);
      if (!missing)
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      const body = JSON.stringify({
        code: "PGRST205",
        message: "Could not find the table 'public.deep_slots' in the schema cache",
      });
      return new Response(method === "HEAD" ? null : body, {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  // The query builder supabase-js uses for `.from()` (its realtime part needs WebSocket on Node 20).
  const client = (missing: boolean) =>
    new PostgrestClient("http://fake.local/rest/v1", {
      fetch: respond(missing),
    }) as unknown as DeepDb;

  resetStoreDetection();
  assert.equal(await detectStoreKind({ db: client(true) }), "stopgap");
  assert.ok(
    requests.every((r) => r.startsWith("GET /rest/v1/deep_slots")),
    requests.join(", "),
  );
  // The reason a HEAD probe was wrong: the same missing table reads as success.
  const head = await new PostgrestClient("http://fake.local/rest/v1", { fetch: respond(true) })
    .from("deep_slots")
    .select("run_id", { head: true })
    .limit(1);
  assert.equal(head.error, null);
  resetStoreDetection();
  assert.equal(await detectStoreKind({ db: client(false) }), "tables");
  resetStoreDetection();
});

test("a run keeps its store: storeFor uses the ticket's kind whatever detection says now", async () => {
  const db = new FakeSupabase();
  assert.equal(storeFor("stopgap", { db: db as unknown as DeepDb }).kind, "stopgap");
  assert.equal(storeFor("tables", { db: db as unknown as DeepDb }).kind, "tables");
  assert.equal(storeFor("memory").kind, "stopgap"); // the in-memory ledger reports itself as a stopgap
  // Without credentials a persistent kind gets a store that refuses everything (fail closed).
  const none = storeFor("tables", { db: null });
  assert.deepEqual(
    await none.reserve({
      runId: "r",
      idemKey: "k",
      kind: "llm",
      step: "synthesis",
      usd: 0.1,
      dayCapUsd: 15,
    }),
    { ok: false, reason: "ledger_error" },
  );
  assert.deepEqual(await none.claimStep({ runId: "r", userId: U, key: "money", max: 1 }), {
    ok: false,
    reason: "ledger_error",
  });
  await assert.rejects(none.startRun({} as never));
});

test("run-scoped functions find the store that holds the run", async () => {
  resetStoreDetection();
  const RUN = "22222222-0000-4000-8000-000000000002";
  const db = new FakeSupabase({
    fail: ({ table }) =>
      table === "deep_slots" || table === "deep_runs" ? { code: "PGRST205" } : null,
  });
  db.rows("audit_leads").push({
    id: RUN,
    recommendation: "deep-run:v1",
    created_at: new Date().toISOString(),
    answers: {
      source: "vortex-deep",
      userId: U,
      cui: "9259999",
      status: "running",
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    },
  });
  const held = await storeHoldingRun(RUN, U, { db: db as unknown as DeepDb });
  assert.equal(held?.store.kind, "stopgap");
  assert.equal(held?.run.cui, "9259999");
  assert.equal(await storeHoldingRun(RUN, OTHER, { db: db as unknown as DeepDb }), null);

  // With the tables, the run is found there first.
  resetStoreDetection();
  const tables = new FakeSupabase();
  installLovableLedger(tables, { additions: true });
  const store = createTablesStore(tables as unknown as DeepDb);
  const run = await store.startRun(startInput());
  assert.ok("runId" in run);
  const found = await storeHoldingRun(run.runId, U, { db: tables as unknown as DeepDb });
  assert.equal(found?.store.kind, "tables");
  assert.equal(found?.run.via, "admin");
  resetStoreDetection();
});

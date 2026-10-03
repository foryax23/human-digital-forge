import assert from "node:assert/strict";
import { test } from "node:test";

import type { ConsentRecord } from "../../../src/lib/deep/contracts";
import type { DeepDb } from "../../../src/lib/deep/persist-db.server";
import {
  detectStoreKind,
  resetStoreDetection,
  storeFor,
  storeForNewRun,
  storeHoldingRun,
} from "../../../src/lib/deep/persist.server";
import { createTablesStore } from "../../../src/lib/deep/persist-tables.server";

import { FakeSupabase } from "./fake-supabase";

/*
 * The tables store's mapping onto the SQL functions of
 * docs/deep/2026-10-03-deep-research.sql (scripted RPC answers on a fake
 * client), and the feature detection that picks the store for new runs.
 */

const U = "11111111-0000-4000-8000-000000000001";
const RUN = "22222222-0000-4000-8000-000000000002";
const consent = { channel: "vortex-deep/start" } as unknown as ConsentRecord;

function tables() {
  const db = new FakeSupabase();
  const store = createTablesStore(db as unknown as DeepDb);
  return { db, store };
}

test("startRun maps deep_start_run: a new run, a refusal reason with replay, or an error", async () => {
  const { db, store } = tables();
  db.rpcs.deep_start_run = () => ({
    data: [{ run_id: RUN, reason: "ok", replay_run: null }],
    error: null,
  });
  const input = {
    userId: U,
    cui: "9259999",
    relationship: "proprietar" as const,
    lang: "ro" as const,
    via: "admin" as const,
    budgetUsd: 1.5,
    aiMode: "ai" as const,
    consent,
    userCap: 20,
    globalCap: 10,
    allowSameCompany: false,
  };
  assert.deepEqual(await store.startRun(input), { runId: RUN });
  const args = db.log.find((l) => l.fn === "deep_start_run")!.args as Record<string, unknown>;
  assert.equal(args.p_user, U);
  assert.equal(args.p_user_cap, 20);
  assert.equal(args.p_allow_same_company, false);
  assert.deepEqual(args.p_consent, consent);

  db.rpcs.deep_start_run = () => ({
    data: [{ run_id: null, reason: "same_company_today", replay_run: RUN }],
    error: null,
  });
  assert.deepEqual(await store.startRun(input), { reason: "same_company_today", replayRunId: RUN });
  db.rpcs.deep_start_run = () => ({
    data: [{ run_id: null, reason: "daily_cap_global", replay_run: null }],
    error: null,
  });
  assert.deepEqual(await store.startRun(input), { reason: "daily_cap_global" });
  db.rpcs.deep_start_run = () => ({ data: null, error: { code: "XX000", message: "down" } });
  await assert.rejects(store.startRun(input));
});

test("reserve fails closed: any error or unknown answer is ledger_error; replay carries the result", async () => {
  const { db, store } = tables();
  const reserve = () =>
    store.reserve({
      runId: RUN,
      idemKey: "k",
      kind: "llm",
      step: "synthesis",
      model: "claude-opus-5-5",
      usd: 0.3,
      dayCapUsd: 15,
    });
  db.rpcs.deep_reserve = () => ({
    data: [{ call_id: 41, reason: "ok", replay: null }],
    error: null,
  });
  assert.deepEqual(await reserve(), { ok: true, callId: "41" });
  db.rpcs.deep_reserve = () => ({
    data: [{ call_id: 41, reason: "replay", replay: { text: "x" } }],
    error: null,
  });
  assert.deepEqual(await reserve(), { ok: false, reason: "replay", result: { text: "x" } });
  for (const reason of [
    "in_flight",
    "attempts",
    "breaker",
    "run_budget",
    "day_budget",
    "run_closed",
    "run_not_found",
  ]) {
    db.rpcs.deep_reserve = () => ({ data: [{ call_id: null, reason, replay: null }], error: null });
    assert.deepEqual(await reserve(), { ok: false, reason });
  }
  db.rpcs.deep_reserve = () => ({
    data: [{ call_id: null, reason: "something_new", replay: null }],
    error: null,
  });
  assert.deepEqual(await reserve(), { ok: false, reason: "ledger_error" });
  db.rpcs.deep_reserve = () => ({ data: null, error: { code: "57014", message: "timeout" } });
  assert.deepEqual(await reserve(), { ok: false, reason: "ledger_error" });
});

test("settle, finish, claims and day stats map their arguments and numeric answers", async () => {
  const { db, store } = tables();
  db.rpcs.deep_settle = () => ({ data: 0.25, error: null });
  await store.settle({
    callId: "41",
    usd: 0.25,
    usage: { inputTokens: 1000.4, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 5 },
    result: { s: 1 },
  });
  const settle = db.log.find((l) => l.fn === "deep_settle")!.args as Record<string, unknown>;
  assert.equal(settle.p_call, 41);
  assert.equal(settle.p_in, 1000);

  db.rpcs.deep_claim_step = () => ({
    data: [{ claim_id: 7, reason: "ok", granted: 3, replay: null }],
    error: null,
  });
  assert.deepEqual(
    await store.claimStep({
      runId: RUN,
      userId: U,
      key: "anaf",
      max: 8,
      units: 3,
      exclusive: false,
    }),
    { ok: true, claimId: "7", granted: 3 },
  );
  const claim = db.log.find((l) => l.fn === "deep_claim_step")!.args as Record<string, unknown>;
  assert.equal(claim.p_exclusive, false);
  db.rpcs.deep_claim_step = () => ({
    data: [{ claim_id: null, reason: "replay", granted: 0, replay: { att: "a" } }],
    error: null,
  });
  assert.deepEqual(await store.claimStep({ runId: RUN, userId: U, key: "money", max: 1 }), {
    ok: false,
    reason: "replay",
    result: { att: "a" },
  });
  db.rpcs.deep_claim_step = () => ({ data: null, error: { code: "XX000" } });
  assert.deepEqual(await store.claimStep({ runId: RUN, userId: U, key: "money", max: 1 }), {
    ok: false,
    reason: "ledger_error",
  });

  db.rpcs.deep_day_stats = () => ({
    data: [{ user_runs: 2, all_runs: "5", all_usd: "1.234" }],
    error: null,
  });
  assert.deepEqual(await store.dayStats(U), { userRuns: 2, allRuns: 5, allUsd: 1.234 });

  db.rpcs.deep_finish = () => ({ data: null, error: null });
  await store.finish({ runId: RUN, status: "partial", error: "x".repeat(3000) });
  const fin = db.log.find((l) => l.fn === "deep_finish")!.args as Record<string, unknown>;
  assert.equal((fin.p_error as string).length, 2000);
});

test("feature detection: missing tables → stopgap (cached 5 min); present → tables (1 h); other errors → no store", async () => {
  let t = 0;
  const now = () => t;
  resetStoreDetection();
  const missing = new FakeSupabase({
    fail: ({ table }) =>
      table === "deep_steps" ? { code: "PGRST205", message: "not in schema cache" } : null,
  });
  assert.equal(await detectStoreKind({ db: missing as unknown as DeepDb, now }), "stopgap");
  assert.equal((await storeForNewRun({ db: missing as unknown as DeepDb, now }))?.kind, "stopgap");

  // Applied the SQL: still "stopgap" from the cache until the 5 minutes pass, then "tables".
  const present = new FakeSupabase();
  t += 4 * 60_000;
  assert.equal(await detectStoreKind({ db: present as unknown as DeepDb, now }), "stopgap");
  t += 2 * 60_000;
  assert.equal(await detectStoreKind({ db: present as unknown as DeepDb, now }), "tables");
  assert.equal((await storeForNewRun({ db: present as unknown as DeepDb, now }))?.kind, "tables");

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

test("a run keeps its store: storeFor uses the ticket's kind whatever detection says now", async () => {
  const db = new FakeSupabase();
  assert.equal(storeFor("stopgap", { db: db as unknown as DeepDb }).kind, "stopgap");
  assert.equal(storeFor("tables", { db: db as unknown as DeepDb }).kind, "tables");
  assert.equal(storeFor("memory").kind, "stopgap"); // the in-memory ledger reports itself as a stopgap
  // Without credentials a persistent kind gets a store that refuses everything (fail closed).
  const none = storeFor("tables", { db: null });
  assert.deepEqual(
    await none.reserve({
      runId: RUN,
      idemKey: "k",
      kind: "llm",
      step: "synthesis",
      usd: 0.1,
      dayCapUsd: 15,
    }),
    { ok: false, reason: "ledger_error" },
  );
  assert.deepEqual(await none.claimStep({ runId: RUN, userId: U, key: "money", max: 1 }), {
    ok: false,
    reason: "ledger_error",
  });
  await assert.rejects(none.startRun({} as never));
});

test("run-scoped functions find the store that holds the run", async () => {
  resetStoreDetection();
  const db = new FakeSupabase({
    fail: ({ table }) =>
      table === "deep_steps" || table === "deep_runs" ? { code: "PGRST205" } : null,
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
  assert.equal(
    await storeHoldingRun(RUN, "33333333-0000-4000-8000-000000000003", {
      db: db as unknown as DeepDb,
    }),
    null,
  );
  resetStoreDetection();
});

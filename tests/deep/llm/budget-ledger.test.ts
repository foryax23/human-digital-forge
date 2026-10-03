import assert from "node:assert/strict";
import { test } from "node:test";

import { fitMaxTokens, reservationUsd } from "../../../src/lib/deep/llm/budget";
import {
  bucharestDayStart,
  createMemoryStore,
} from "../../../src/lib/deep/llm/ledger-memory.server";
import { paidCall } from "../../../src/lib/deep/llm/paid.server";
import { costOfUsage, priceFor } from "../../../src/lib/deep/llm/prices";
import { LlmError } from "../../../src/lib/deep/llm/types";
import { message, virtualClock } from "../steps/helpers";

const consent = {
  version: "t",
  lang: "ro" as const,
  channel: "vortex-deep/start" as const,
  recordedAt: "2026-10-03T00:00:00Z",
  notice: "n",
  reportBasis: "b",
  marketing: { granted: false, text: "m", basis: "b" },
};

async function newRun(
  store = createMemoryStore(),
  budgetUsd = 1.5,
  userId = "u1",
  via: "admin" | "open" = "admin",
) {
  const started = await store.startRun({
    userId,
    cui: "3365133",
    relationship: "proprietar",
    lang: "ro",
    via,
    budgetUsd,
    aiMode: "ai",
    consent,
    userCap: 20,
    globalCap: 10,
    allowSameCompany: true,
  });
  assert.ok("runId" in started);
  return { store, runId: (started as { runId: string }).runId };
}

test("prices: iterations summed per model, unknown model at the highest rate", () => {
  const usage = {
    input_tokens: 100,
    output_tokens: 100,
    iterations: [
      { type: "message", model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 500 },
      {
        type: "fallback_message",
        model: "claude-opus-4-8",
        input_tokens: 1000,
        output_tokens: 500,
      },
    ],
  };
  const expected = (1000 * 4 + 500 * 20 + 1000 * 5 + 500 * 25) / 1e6;
  assert.equal(
    Number(costOfUsage(usage, "claude-opus-5-5").toFixed(6)),
    Number(expected.toFixed(6)),
  );
  assert.deepEqual(priceFor("claude-mystery-9"), priceFor("claude-opus-5"));
  assert.equal(priceFor("claude-haiku-4-5-20251001").input, 1);
  // Without iterations, the top-level usage priced at the request model (cache read 0.20, write 1.25×).
  const plain = costOfUsage(
    {
      input_tokens: 1000,
      output_tokens: 100,
      cache_read_input_tokens: 10_000,
      cache_creation_input_tokens: 2000,
    },
    "claude-opus-5-5",
  );
  assert.equal(
    Number(plain.toFixed(6)),
    Number(((1000 * 4 + 100 * 20 + 10_000 * 0.2 + 2000 * 4 * 1.25) / 1e6).toFixed(6)),
  );
});

test("reservations include the fallback worst case; max_tokens shrinks to fit", () => {
  const plan = {
    model: "claude-opus-5-5",
    inputTokens: 300,
    cachedTokens: 8000,
    maxTokens: 4000,
    fallback: true,
  };
  const primary = (300 * 4 + 8000 * 0.2 + 4000 * 20) / 1e6;
  const fallback = ((300 + 8000) * 5 + 4000 * 25) / 1e6;
  assert.equal(Number(reservationUsd(plan).toFixed(6)), Number((primary + fallback).toFixed(6)));
  assert.ok(reservationUsd({ ...plan, fallback: false }) < reservationUsd(plan));
  const fitted = fitMaxTokens(plan, 0.15, 2000)!;
  assert.ok(fitted < 4000 && fitted >= 2000);
  assert.ok(reservationUsd({ ...plan, maxTokens: fitted }) <= 0.15);
  assert.equal(fitMaxTokens(plan, 0.05, 2000), null, "below the floor: rules template instead");
});

test("ledger: replay, in flight, run budget, day budget (admins included), breaker, finish", async () => {
  const clock = virtualClock();
  const store = createMemoryStore({ now: clock.now });
  const { runId } = await newRun(store, 0.5);
  const reserve = (idemKey: string, usd: number, dayCapUsd = 15) =>
    store.reserve({
      runId,
      idemKey,
      kind: "llm",
      step: "synthesis",
      model: "claude-opus-5-5",
      usd,
      dayCapUsd,
    });
  const first = await reserve("k1", 0.2);
  assert.equal(first.ok, true);
  assert.deepEqual(await reserve("k1", 0.2), { ok: false, reason: "in_flight" });
  await store.settle({
    callId: (first as { callId: string }).callId,
    usd: 0.05,
    usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
    result: { text: "stored" },
  });
  assert.deepEqual(await reserve("k1", 0.2), {
    ok: false,
    reason: "replay",
    result: { text: "stored" },
  });
  assert.deepEqual(await reserve("k2", 0.5), { ok: false, reason: "run_budget" });
  assert.deepEqual(await reserve("k3", 0.3, 0.2), { ok: false, reason: "day_budget" });
  await store.tripBreaker(15, "billing");
  assert.deepEqual(await reserve("k4", 0.01), { ok: false, reason: "breaker" });
  clock.t += 16 * 60_000;
  const open = await reserve("k5", 0.1);
  assert.equal(open.ok, true);
  await store.finish({ runId, status: "succeeded" });
  const run = store.run(runId)!;
  assert.equal(
    Number(run.spentUsd.toFixed(2)),
    0.15,
    "unsettled reservations count as spent at finish",
  );
  assert.deepEqual(await reserve("k6", 0.01), { ok: false, reason: "run_closed" });
  assert.equal(
    new Date(bucharestDayStart(Date.UTC(2026, 9, 3, 10))).toISOString(),
    "2026-10-02T21:00:00.000Z",
  );
});

test("ledger caps: one active run, same company today, user and global caps (insert-then-count)", async () => {
  const clock = virtualClock();
  const store = createMemoryStore({ now: clock.now });
  const base = {
    cui: "3365133",
    relationship: "proprietar" as const,
    lang: "ro" as const,
    budgetUsd: 1.5,
    aiMode: "ai" as const,
    consent,
    globalCap: 2,
  };
  const a = await store.startRun({
    ...base,
    userId: "u1",
    via: "open",
    userCap: 3,
    allowSameCompany: false,
  });
  assert.ok("runId" in a);
  assert.deepEqual(
    await store.startRun({
      ...base,
      userId: "u1",
      via: "open",
      userCap: 3,
      allowSameCompany: false,
    }),
    { reason: "already_running" },
  );
  clock.t += 11 * 60_000; // a stale running run no longer blocks
  await store.finish({ runId: (a as { runId: string }).runId, status: "succeeded" });
  const same = await store.startRun({
    ...base,
    userId: "u1",
    via: "open",
    userCap: 3,
    allowSameCompany: false,
  });
  assert.equal((same as { reason: string }).reason, "same_company_today");
  const b = await store.startRun({
    ...base,
    cui: "1094992",
    userId: "u2",
    via: "open",
    userCap: 3,
    allowSameCompany: false,
  });
  assert.ok("runId" in b);
  await store.finish({ runId: (b as { runId: string }).runId, status: "succeeded" });
  assert.deepEqual(
    await store.startRun({
      ...base,
      cui: "9259999",
      userId: "u3",
      via: "open",
      userCap: 3,
      allowSameCompany: false,
    }),
    { reason: "daily_cap_global" },
  );
  const admin = await store.startRun({
    ...base,
    cui: "9259999",
    userId: "u4",
    via: "admin",
    userCap: 20,
    allowSameCompany: false,
  });
  assert.ok("runId" in admin, "admins are outside the global cap");
});

test("paid calls: reserve before send, settle from usage, replay, breaker on billing, retry on overload", async () => {
  const clock = virtualClock();
  const { store, runId } = await newRun(createMemoryStore({ now: clock.now }), 1.5);
  const ledger = {
    reserve: store.reserve,
    settle: store.settle,
    tripBreaker: store.tripBreaker,
    runSpend: store.runSpend,
    dayCapUsd: 15,
  };
  const plan = {
    model: "claude-opus-5-5",
    inputTokens: 300,
    cachedTokens: 6000,
    maxTokens: 4000,
    fallback: true,
  };
  let sent = 0;
  const ok = await paidCall({
    ledger,
    runId,
    step: "synthesis",
    idemKey: `${runId}|synthesis|brief`,
    plan,
    floor: 2000,
    keepHeadroom: true,
    exec: async () => {
      sent++;
      return message([{ type: "text", text: "hi" }]);
    },
    toReplay: () => ({ text: "hi" }),
    deadline: clock.now() + 50_000,
    now: clock.now,
  });
  assert.equal(ok.kind, "ok");
  assert.equal(sent, 1);
  const replay = await paidCall({
    ledger,
    runId,
    step: "synthesis",
    idemKey: `${runId}|synthesis|brief`,
    plan,
    floor: 2000,
    exec: async () => {
      sent++;
      return message([]);
    },
    deadline: clock.now() + 50_000,
    now: clock.now,
  });
  assert.deepEqual(replay, { kind: "replay", result: { text: "hi" } });
  assert.equal(sent, 1, "a replay spends nothing");

  let attempts = 0;
  const retried = await paidCall({
    ledger,
    runId,
    step: "synthesis",
    idemKey: `${runId}|synthesis|customer`,
    plan,
    floor: 2000,
    exec: async () => {
      attempts++;
      if (attempts === 1) throw new LlmError("overloaded", "529", 529);
      return message([{ type: "text", text: "ok" }]);
    },
    deadline: clock.now() + 50_000,
    now: clock.now,
  });
  assert.equal(retried.kind, "ok");
  assert.equal(attempts, 2, "one manual retry with a fresh reservation");

  const billing = await paidCall({
    ledger,
    runId,
    step: "synthesis",
    idemKey: `${runId}|synthesis|rivals`,
    plan,
    floor: 2000,
    exec: async () => {
      throw new LlmError("billing", "credit balance too low", 402);
    },
    deadline: clock.now() + 50_000,
    now: clock.now,
  });
  assert.equal(billing.kind, "error");
  assert.ok(store.breakerUntil() > clock.now(), "billing trips the breaker for all runs");
  const blocked = await paidCall({
    ledger,
    runId,
    step: "finish",
    idemKey: `${runId}|finish|entail`,
    plan: { ...plan, fallback: false },
    floor: 200,
    exec: async () => message([]),
    deadline: clock.now() + 20_000,
    now: clock.now,
  });
  assert.deepEqual(blocked, { kind: "refused", reason: "breaker" });
});

test("a forced $0.10 run budget is never exceeded; ledger errors send nothing", async () => {
  const clock = virtualClock();
  const { store, runId } = await newRun(createMemoryStore({ now: clock.now }), 0.1);
  const ledger = {
    reserve: store.reserve,
    settle: store.settle,
    tripBreaker: store.tripBreaker,
    runSpend: store.runSpend,
    dayCapUsd: 15,
  };
  let sent = 0;
  const exec = async () => {
    sent++;
    return message([{ type: "text", text: "x" }], {
      usage: { input_tokens: 300, output_tokens: 2500, cache_read_input_tokens: 6000 },
    });
  };
  const plan = {
    model: "claude-opus-5-5",
    inputTokens: 300,
    cachedTokens: 6000,
    maxTokens: 4000,
    fallback: true,
  };
  const outcome = await paidCall({
    ledger,
    runId,
    step: "synthesis",
    idemKey: "a",
    plan,
    floor: 2000,
    keepHeadroom: true,
    exec,
    deadline: clock.now() + 50_000,
    now: clock.now,
  });
  assert.deepEqual(outcome, { kind: "refused", reason: "too_small" });
  assert.equal(sent, 0);
  assert.ok(store.run(runId)!.spentUsd + store.run(runId)!.reservedUsd <= 0.1);

  const broken = {
    reserve: async () => {
      throw new Error("supabase down");
    },
    settle: async () => undefined,
    tripBreaker: async () => undefined,
    dayCapUsd: 15,
  };
  const failed = await paidCall({
    ledger: broken,
    runId,
    step: "audit",
    idemKey: "b",
    plan: { ...plan, fallback: false },
    floor: 1000,
    exec,
    deadline: clock.now() + 50_000,
    now: clock.now,
  });
  assert.deepEqual(failed, { kind: "refused", reason: "ledger_error" });
  assert.equal(sent, 0, "no ledger, no Claude call");
});

test("a step that died before settling gives its claim back after 2 minutes (memory ledger)", async () => {
  const clock = virtualClock();
  const store = createMemoryStore({ now: clock.now });
  const { runId } = await newRun(store, 0.5);
  const claim = () => store.claimStep({ runId, userId: "u1", key: "money", max: 1 });
  assert.equal((await claim()).ok, true);
  assert.deepEqual(await claim(), { ok: false, reason: "in_flight" });
  clock.t += 2 * 60_000 + 1;
  const retry = await claim();
  assert.equal(retry.ok, true, "the retry runs instead of a lost step");
});

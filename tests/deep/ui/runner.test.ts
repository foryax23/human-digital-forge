import assert from "node:assert/strict";
import { test } from "node:test";

import {
  continueRun,
  resultsForRequest,
  rivalsOf,
  startRun,
  withoutCursor,
  type DeepTransport,
  type RunnerEnv,
} from "../../../src/components/deep/runner";
import type { RunSnapshot } from "../../../src/components/deep/journal";
import { resetAnafIsolateClock } from "../../../src/lib/deep/anaf-pacer.server";
import type { DeepStepInput, DeepStepOutput, StepResult } from "../../../src/lib/deep/contracts";
import { virtualClock } from "../steps/helpers";
import { engine, START, UID } from "./engine-fixture";

/*
 * The browser runner (src/components/deep/runner.ts) against the real engine (engineStart /
 * engineStep, the memory store, attestation, claims) on a scripted network: the step order of
 * pipeline.server.ts, the ANAF pacing it relies on, resume after a pause, the site question,
 * refusals, and the request limits on synthesis and finish.
 */

function env(
  clock: ReturnType<typeof virtualClock>,
  transport: DeepTransport,
  extra: Partial<RunnerEnv> = {},
): RunnerEnv & { snapshots: RunSnapshot[] } {
  const snapshots: RunSnapshot[] = [];
  return {
    transport,
    now: clock.now,
    sleep: clock.sleep,
    timer: () => new Promise<void>(() => undefined),
    askSite: async () => null,
    onChange: (s) => snapshots.push(s),
    snapshots,
    ...extra,
  };
}

test("the runner follows the pipeline order and ends in a rules-only report", async () => {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const { transport, calls, net } = engine(clock);
  const started = await startRun(transport, START, UID, clock.now);
  assert.equal(started.ok, true);
  if (!started.ok) return;
  const e = env(clock, transport);
  const done = await continueRun(e, started.snap);
  assert.equal(done.status, "done", done.failure);
  assert.ok(done.report, "a report");
  assert.equal(done.report!.aiMode, "rules");
  assert.equal(done.report!.lights.length, 5);

  const steps = calls.map((c) => c.step);
  // Rules-only: no synthesis call; finish last; each collection step once.
  assert.equal(steps.filter((s) => s === "synthesis").length, 0);
  assert.equal(steps.at(-1), "finish");
  for (const s of ["money", "signals", "site", "peers", "audit", "pagespeed"])
    assert.equal(steps.filter((x) => x === s).length, 1, `${s} once`);
  // Order: peers after money; audit after site; competitors after peers.
  assert.ok(steps.indexOf("peers") > steps.indexOf("money"));
  assert.ok(steps.indexOf("audit") > steps.indexOf("site"));
  const firstCompetitor = steps.indexOf("competitor");
  if (firstCompetitor >= 0) assert.ok(firstCompetitor > steps.indexOf("peers"));
  // ANAF pacing passed along: money gets identity's anafNextAt, peers gets money's.
  const money = calls.find((c) => c.step === "money") as Extract<DeepStepInput, { step: "money" }>;
  assert.equal(money.anafNextAt, started.snap.results.start.next?.anafNextAt);
  const peers = calls.find((c) => c.step === "peers") as Extract<DeepStepInput, { step: "peers" }>;
  assert.equal(peers.anafNextAt, peers.money.next?.anafNextAt);
  // Finish carries no sealed cursor and at most 20 results.
  const finish = calls.at(-1) as Extract<DeepStepInput, { step: "finish" }>;
  assert.ok(finish.results.length <= 20);
  assert.ok(
    finish.results.every((r) => !r.next?.crawlCursor),
    "cursors dropped",
  );
  // ANAF ≤ 9 calls, ≥ 1.1 s apart (the runner relies on the server's pacer).
  const anaf = net.calls.filter((c) => c.url.includes("webservicesp.anaf.ro"));
  assert.ok(anaf.length <= 9, `${anaf.length} ANAF calls`);
  for (let i = 1; i < anaf.length; i++) assert.ok(anaf[i].at - anaf[i - 1].at >= 1100);
  // Every change reached the journal callback; the last one is the report.
  assert.ok(e.snapshots.length > 10);
  assert.equal(e.snapshots.at(-1)!.status, "done");
});

test("a paused run continues from its snapshot without repeating finished steps", async () => {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const { transport, calls } = engine(clock);
  const started = await startRun(transport, START, UID, clock.now);
  assert.equal(started.ok, true);
  if (!started.ok) return;
  // The page closes after the third step result: the runner pauses.
  const controller = new AbortController();
  let seen = 0;
  const first = env(clock, transport, {
    signal: controller.signal,
    onChange: (s) => {
      const results = Object.keys(s.results).length;
      if (results >= 4 && !controller.signal.aborted) controller.abort();
      seen = results;
    },
  });
  const paused = await continueRun(first, started.snap);
  assert.equal(paused.status, "running", "paused, not failed");
  assert.ok(seen >= 4);
  const before = new Set(Object.keys(paused.results));
  const callsBefore = calls.length;
  // Coming back: the journal snapshot continues.
  const done = await continueRun(env(clock, transport), paused);
  assert.equal(done.status, "done", done.failure);
  const later = calls.slice(callsBefore).map((c) => (c.step === "crawl" ? `crawl` : c.step));
  for (const slot of before) {
    if (slot === "start") continue;
    const step = slot.replace(/\d$/, "").replace(/^competitor:.*/, "competitor");
    if (step === "site" || step === "crawl" || step === "competitor") continue;
    assert.equal(later.includes(step as DeepStepInput["step"]), false, `${slot} not called again`);
  }
});

test("the site question: an answer calls site again; no answer goes on with the first result", async () => {
  const askSite = {
    url: "https://rost.com.ro",
    reason: { en: "name match", ro: "potrivire de nume" },
  };
  const att = "x";
  const base = (step: StepResult["step"], extra: Partial<StepResult> = {}): StepResult => ({
    runId: "r1",
    step,
    status: "done",
    ms: 10,
    facts: [],
    gaps: [],
    att,
    ...extra,
  });
  const calls: DeepStepInput[] = [];
  const transport: DeepTransport = {
    start: async () => ({ ok: false, reason: "not_found" }),
    step: async (input): Promise<DeepStepOutput> => {
      calls.push(input);
      if (input.step === "site")
        return {
          kind: "step",
          result: input.answer ? base("site", { facts: [] }) : base("site", { next: { askSite } }),
        };
      if (input.step === "finish")
        return { kind: "report", report: { runId: "r1" } as never, reportAtt: "a" };
      return { kind: "step", result: base(input.step) };
    },
    resume: async () => ({ ok: false, reason: "run_not_found" }),
  };
  const clock = virtualClock();
  const snap = (): RunSnapshot => ({
    v: 1,
    runId: "r1",
    uid: UID,
    cui: "8229329",
    name: "Rost",
    relationship: "proprietar",
    lang: "ro",
    aiMode: "rules",
    store: "stopgap",
    ticket: "t",
    createdAt: 0,
    updatedAt: 0,
    activeMs: 0,
    results: { start: base("start") },
    order: ["start"],
    slots: {},
    status: "running",
    corrections: [],
    rivalEdits: { removed: [], added: [] },
    timings: [],
  });
  let asked = 0;
  const yes = await continueRun(
    env(clock, transport, {
      askSite: async (ask) => {
        asked++;
        assert.equal(ask.url, askSite.url);
        return { url: ask.url, yes: true };
      },
    }),
    snap(),
  );
  assert.equal(yes.status, "done");
  assert.equal(asked, 1);
  assert.equal(calls.filter((c) => c.step === "site").length, 2);
  assert.deepEqual((calls.filter((c) => c.step === "site")[1] as { answer?: unknown }).answer, {
    url: askSite.url,
    yes: true,
  });
  assert.deepEqual(yes.askSite?.answer, { url: askSite.url, yes: true });

  calls.length = 0;
  const none = await continueRun(
    { ...env(clock, transport), askSite: async () => null },
    { ...snap(), runId: "r2" },
  );
  assert.equal(none.status, "done");
  assert.equal(
    calls.filter((c) => c.step === "site").length,
    1,
    "no second site call without an answer",
  );
  assert.equal(none.askSite?.answer, "none");
  // Audit and pagespeed still run on the first site result.
  assert.ok(calls.some((c) => c.step === "audit"));
});

test("refusals: in-flight waits, used-up steps are skipped, others end the run", async () => {
  const clock = virtualClock();
  const result = (step: StepResult["step"]): StepResult => ({
    runId: "r",
    step,
    status: "done",
    ms: 5,
    facts: [],
    gaps: [],
    att: "a",
  });
  let moneyTries = 0;
  const transport: DeepTransport = {
    start: async () => ({ ok: false, reason: "not_found" }),
    step: async (input): Promise<DeepStepOutput> => {
      if (input.step === "money") {
        moneyTries++;
        return moneyTries < 3
          ? { kind: "refused", reason: "already_running" }
          : { kind: "step", result: result("money") };
      }
      if (input.step === "signals") return { kind: "refused", reason: "budget_exhausted" };
      if (input.step === "finish")
        return { kind: "report", report: { runId: "r" } as never, reportAtt: "a" };
      return { kind: "step", result: result(input.step) };
    },
    resume: async () => ({ ok: false, reason: "run_not_found" }),
  };
  const snap: RunSnapshot = {
    v: 1,
    runId: "r",
    uid: UID,
    cui: "1",
    name: "x",
    relationship: "proprietar",
    lang: "ro",
    aiMode: "rules",
    store: "stopgap",
    ticket: "t",
    createdAt: 0,
    updatedAt: 0,
    activeMs: 0,
    results: { start: result("start") },
    order: ["start"],
    slots: {},
    status: "running",
    corrections: [],
    rivalEdits: { removed: [], added: [] },
    timings: [],
  };
  const out = await continueRun(env(clock, transport), snap);
  assert.equal(out.status, "done");
  assert.equal(moneyTries, 3, "in-flight claim waited for");
  assert.equal(out.slots.signals.status, "skipped");
  assert.equal(out.slots.signals.reason, "budget_exhausted");

  const fatal: DeepTransport = {
    ...transport,
    step: async (input) =>
      input.step === "money"
        ? { kind: "refused", reason: "admin_only" }
        : { kind: "step", result: result(input.step) },
  };
  const failed = await continueRun(env(clock, fatal), { ...snap, runId: "r-fatal" });
  assert.equal(failed.status, "failed");
  assert.equal(failed.failure, "admin_only");
});

test("collection stops at the deadline and the report is made from what arrived", async () => {
  const clock = virtualClock();
  const result = (step: StepResult["step"]): StepResult => ({
    runId: "d",
    step,
    status: "done",
    ms: 5,
    facts: [],
    gaps: [],
    att: "a",
  });
  let release: () => void = () => undefined;
  const never = new Promise<void>((r) => (release = r));
  const calls: string[] = [];
  const transport: DeepTransport = {
    start: async () => ({ ok: false, reason: "not_found" }),
    step: async (input): Promise<DeepStepOutput> => {
      calls.push(input.step);
      if (input.step === "signals") {
        await never; // a step that hangs past the deadline
        return { kind: "step", result: result("signals") };
      }
      if (input.step === "finish")
        return { kind: "report", report: { runId: "d" } as never, reportAtt: "a" };
      return { kind: "step", result: result(input.step) };
    },
    resume: async () => ({ ok: false, reason: "run_not_found" }),
  };
  const snap: RunSnapshot = {
    v: 1,
    runId: "d",
    uid: UID,
    cui: "1",
    name: "x",
    relationship: "proprietar",
    lang: "ro",
    aiMode: "rules",
    store: "stopgap",
    ticket: "t",
    createdAt: 0,
    updatedAt: 0,
    activeMs: 0,
    results: { start: result("start") },
    order: ["start"],
    slots: {},
    status: "running",
    corrections: [],
    rivalEdits: { removed: [], added: [] },
    timings: [],
  };
  const out = await continueRun(env(clock, transport, { timer: async () => undefined }), snap);
  release();
  assert.equal(out.status, "done");
  assert.equal(out.slots.signals.status, "skipped");
  assert.equal(out.slots.signals.reason, "time");
  assert.equal(calls.at(-1), "finish");
});

test("requests stay under 20 results and the body budget; cursors are dropped", () => {
  const big = "x".repeat(40_000);
  const results: Record<string, StepResult> = {};
  const order: string[] = [];
  const add = (slot: string, step: StepResult["step"], bytes = 100) => {
    results[slot] = {
      runId: "r",
      step,
      status: "done",
      ms: 1,
      facts: [{ id: slot, value: "y".repeat(bytes) } as never],
      gaps: [],
      next: { crawlCursor: big, cursorSha: "abc" },
      att: "a",
    };
    order.push(slot);
  };
  add("start", "start");
  add("money", "money");
  add("site", "site");
  add("audit", "audit", 45_000);
  for (const c of ["crawl1", "crawl2", "crawl3"]) add(c, "crawl", 45_000);
  for (let i = 0; i < 6; i++) add(`competitor:${i}`, "competitor", 30_000);
  add("pagespeed", "pagespeed", 20_000);
  const out = resultsForRequest({ order, results }, () => true);
  const size = new TextEncoder().encode(JSON.stringify({ results: out.results })).length;
  assert.ok(size <= 256 * 1024 - 8 * 1024, `${size} bytes`);
  assert.ok(out.results.length <= 20);
  assert.ok(out.results.every((r) => !r.next?.crawlCursor));
  assert.equal(out.results[0].next?.cursorSha, "abc", "the attested sha stays");
  assert.deepEqual(out.dropped.slice(0, 2), ["crawl3", "crawl2"], "least important first");
  assert.ok(
    out.results.some((r) => r.step === "money"),
    "core results kept",
  );
  assert.equal(withoutCursor({ ...results.start, next: { crawlCursor: "c" } }).next, undefined);
});

test("rivals: the ones with a website first, at most three", () => {
  const peers = {
    facts: [
      { predicate: "peers.rival", value: { cui: "1" } },
      { predicate: "peers.rival", value: { cui: "2", website: "https://b.ro" } },
      { predicate: "peers.rival", value: { cui: "3" } },
      { predicate: "peers.rival", value: { cui: "4", website: "https://d.ro" } },
      { predicate: "peers.n", value: 9 },
    ],
  } as unknown as StepResult;
  assert.deepEqual(
    rivalsOf(peers).map((r) => r.cui),
    ["2", "4", "1"],
  );
});

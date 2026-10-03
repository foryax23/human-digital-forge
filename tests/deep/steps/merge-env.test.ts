/*
 * Review fixes outside the steps: merged results count once, config and
 * entitlement helpers, the fixed data-file origin, the DNS check with AAAA,
 * owner-added rivals typed with "RO", the claim ledger itself.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import type { ConsentRecord, Fact, StepResult } from "../../../src/lib/deep/contracts";
import {
  deepAssetOrigin,
  dohResolver,
  readDeepConfig,
  ticketAdmitted,
} from "../../../src/lib/deep/env.server";
import { createMemoryStore } from "../../../src/lib/deep/llm/ledger-memory.server";
import { mergeFacts } from "../../../src/lib/deep/steps/merge.server";
import { json } from "./helpers";

const pages = (id: string, n: number): Fact => ({
  id,
  section: "site",
  predicate: "site.pages_read",
  value: n,
  display: { ro: String(n), en: String(n) },
  source: "site",
  asOf: "2026-10-03",
  confidence: "confirmat",
  score: 1,
  method: "html",
  gdpr: "G0",
});
const booking = (pagesRead: number): Fact => ({
  ...pages("site.booking.present", 0),
  predicate: "site.booking.present",
  value: false,
  display: {
    ro: `Nu am găsit pe cele ${pagesRead} pagini citite`,
    en: `Not found on the ${pagesRead} pages we read`,
  },
  observed: { pagesRead },
});
const result = (step: StepResult["step"], att: string, facts: Fact[]): StepResult => ({
  runId: "r",
  step,
  status: "done",
  ms: 1,
  facts,
  gaps: [],
  att,
});

test("merge: a result kept twice counts once; pages read add up per batch", () => {
  const audit = result("audit", "att-a", [pages("site.pages_read.a", 6), booking(6)]);
  const crawl = result("crawl", "att-c1", [pages("site.pages_read.c1", 10), booking(10)]);
  const merged = mergeFacts([audit, crawl, crawl, audit]);
  const total = merged.find((f) => f.id === "site.pages_read");
  assert.equal(total?.value, 16);
  const b = merged.find((f) => f.id === "site.booking.present")!;
  assert.equal(b.observed?.pagesRead, 16);
  assert.match(b.display.ro, /cele 16 pagini citite/);
});

test("config: unknown extraction models are ignored; memory-ledger AI is opt-in; the asset origin is fixed", () => {
  const c = readDeepConfig({ DEEP_EXTRACT_MODEL: "claude-mystery-9" });
  assert.equal(c.extractModel, "claude-haiku-4-5-20251001");
  assert.equal(c.unknownExtractModel, "claude-mystery-9");
  assert.equal(
    readDeepConfig({ DEEP_EXTRACT_MODEL: "claude-haiku-4-5" }).extractModel,
    "claude-haiku-4-5",
  );
  assert.equal(readDeepConfig({}).memoryLedgerAi, false);
  assert.equal(readDeepConfig({ DEEP_MEMORY_LEDGER_AI: "on" }).memoryLedgerAi, true);
  assert.equal(
    deepAssetOrigin({}, "https://evil.example/_serverFn/x", "production"),
    "https://vortexhub.dev",
  );
  assert.equal(
    deepAssetOrigin({}, "https://evil.lovable.app/x", "production"),
    "https://vortexhub.dev",
  );
  assert.equal(
    deepAssetOrigin({}, "https://www.vortexhub.dev/_serverFn/x", "production"),
    "https://www.vortexhub.dev",
  );
  assert.equal(
    deepAssetOrigin({}, "http://localhost:5184/x", "production"),
    "https://vortexhub.dev",
  );
  assert.equal(
    deepAssetOrigin({}, "http://localhost:5184/x", "development"),
    "http://localhost:5184",
  );
  assert.equal(
    deepAssetOrigin(
      readDeepConfig({ DEEP_ASSET_ORIGIN: "https://cdn.vortexhub.dev" }),
      "https://evil.example/",
    ),
    "https://cdn.vortexhub.dev",
  );
});

test("entitlement: tickets follow the current mode and admin list", () => {
  const admin = readDeepConfig({ DEEP_RESEARCH_MODE: "admin", DEEP_RESEARCH_ADMIN_USER_IDS: "a" });
  assert.equal(ticketAdmitted(admin, "admin", "a"), true);
  assert.equal(ticketAdmitted(admin, "admin", "b"), false, "removed admin");
  assert.equal(
    ticketAdmitted(admin, "code", "b"),
    false,
    "code ticket after switching back to admin",
  );
  const code = readDeepConfig({ DEEP_RESEARCH_MODE: "code" });
  assert.equal(ticketAdmitted(code, "code", "b"), true);
  assert.equal(ticketAdmitted(code, "open", "b"), false);
  assert.equal(ticketAdmitted(readDeepConfig({ DEEP_RESEARCH_MODE: "open" }), "open", "b"), true);
  assert.equal(
    ticketAdmitted(
      readDeepConfig({ DEEP_RESEARCH_MODE: "disabled", DEEP_RESEARCH_ADMIN_USER_IDS: "a" }),
      "admin",
      "a",
    ),
    false,
  );
});

test("DNS: a public A record next to a private AAAA record is private", async () => {
  const answers: Record<string, unknown> = {
    "mixed.ro|A": { Status: 0, Answer: [{ type: 1, data: "93.184.216.34" }] },
    "mixed.ro|AAAA": { Status: 0, Answer: [{ type: 28, data: "::1" }] },
    "clean.ro|A": { Status: 0, Answer: [{ type: 1, data: "93.184.216.34" }] },
    "clean.ro|AAAA": { Status: 0 },
  };
  const resolver = dohResolver(async (input) => {
    const u = new URL(input);
    return json(
      answers[`${u.searchParams.get("name")}|${u.searchParams.get("type")}`] ?? { Status: 3 },
    );
  });
  assert.equal(await resolver.publicHost("mixed.ro"), "private");
  assert.equal(await resolver.publicHost("clean.ro"), "ok");
  assert.equal(await resolver.publicHost("nowhere.ro"), "nxdomain");
});

test("claim ledger: exclusive steps replay when used up, counters grant what is left, unknown runs fail closed", async () => {
  let t = 0;
  const store = createMemoryStore({ now: () => t });
  const started = await store.startRun({
    userId: "u",
    cui: "1",
    relationship: "proprietar",
    lang: "ro",
    via: "admin",
    budgetUsd: 1,
    aiMode: "rules",
    consent: {} as ConsentRecord,
    userCap: 20,
    globalCap: 10,
    allowSameCompany: true,
  });
  const runId = (started as { runId: string }).runId;
  const a = await store.claimStep({ runId, userId: "u", key: "money", max: 1 });
  assert.equal(a.ok, true);
  assert.deepEqual(await store.claimStep({ runId, userId: "u", key: "money", max: 1 }), {
    ok: false,
    reason: "in_flight",
  });
  await store.settleStep({
    runId,
    claimId: (a as { claimId: string }).claimId,
    used: 1,
    result: { r: 1 },
  });
  assert.deepEqual(await store.claimStep({ runId, userId: "u", key: "money", max: 1 }), {
    ok: false,
    reason: "replay",
    result: { r: 1 },
  });
  // Counter: 8 ANAF units; money takes 7, uses 5 → 3 left; peers asks 1, a second asks 7 → 2.
  const m = await store.claimStep({
    runId,
    userId: "u",
    key: "anaf",
    max: 8,
    units: 7,
    exclusive: false,
  });
  assert.equal(m.ok && m.granted, 7);
  await store.settleStep({ runId, claimId: (m as { claimId: string }).claimId, used: 5 });
  const p = await store.claimStep({
    runId,
    userId: "u",
    key: "anaf",
    max: 8,
    units: 1,
    exclusive: false,
  });
  assert.equal(p.ok && p.granted, 1);
  const q = await store.claimStep({
    runId,
    userId: "u",
    key: "anaf",
    max: 8,
    units: 7,
    exclusive: false,
  });
  assert.equal(q.ok && q.granted, 2);
  assert.deepEqual(
    await store.claimStep({ runId, userId: "u", key: "anaf", max: 8, units: 1, exclusive: false }),
    { ok: false, reason: "exhausted" },
  );
  // Unknown run, another user, a closed run: never "ok".
  assert.deepEqual(await store.claimStep({ runId: "nope", userId: "u", key: "x", max: 1 }), {
    ok: false,
    reason: "run_not_found",
  });
  assert.deepEqual(await store.claimStep({ runId, userId: "v", key: "x", max: 1 }), {
    ok: false,
    reason: "run_not_found",
  });
  await store.finish({ runId, status: "succeeded" });
  t += 1;
  assert.deepEqual(await store.claimStep({ runId, userId: "u", key: "x", max: 1 }), {
    ok: false,
    reason: "run_closed",
  });
  // Feedback is never kept in an isolate's memory.
  await assert.rejects(() =>
    store.feedback({ runId, userId: "u", kind: "useful_yes", message: "x" }),
  );
});

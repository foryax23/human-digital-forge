import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clearJournal,
  clearPending,
  hasAnyJournal,
  loadRun,
  MAX_RUNS,
  previousReport,
  readIndex,
  readPending,
  rememberTerms,
  removeRun,
  sanitizeSnapshot,
  saveRun,
  savePending,
  termsAccepted,
  unfinishedRun,
  type RunSnapshot,
  type StorageLike,
} from "../../../src/components/deep/journal";
import type { DeepReport, Fact, StepResult } from "../../../src/lib/deep/contracts";

/* The per-account browser journal (plan A5 "Resume without server tables"). */

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  quota = Infinity;
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    const used = [...this.map.entries()].reduce(
      (n, [key, val]) => n + (key === k ? 0 : val.length),
      0,
    );
    if (used + v.length > this.quota) {
      const e = new Error("full");
      e.name = "QuotaExceededError";
      throw e;
    }
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const UID = "user-1";
const fact = (id: string, extra: Partial<Fact> = {}): Fact =>
  ({
    id,
    section: "money",
    predicate: id,
    value: 1,
    display: { en: "1", ro: "1" },
    source: "calc",
    asOf: "FY2025",
    confidence: "calculat",
    score: 1,
    method: "derived",
    gdpr: "G0",
    ...extra,
  }) as Fact;
const result = (
  step: StepResult["step"],
  facts: Fact[] = [fact(`${step}.x`)],
  extra: Partial<StepResult> = {},
): StepResult => ({
  runId: "r",
  step,
  status: "done",
  ms: 1,
  facts,
  gaps: [],
  att: "a",
  ...extra,
});

function snap(runId: string, createdAt: number, extra: Partial<RunSnapshot> = {}): RunSnapshot {
  return {
    v: 1,
    runId,
    uid: UID,
    cui: "3365133",
    name: "Expres",
    relationship: "proprietar",
    lang: "ro",
    aiMode: "rules",
    store: "stopgap",
    ticket: "t",
    createdAt,
    updatedAt: createdAt,
    activeMs: 0,
    results: {
      start: result("start"),
      money: result("money", [fact("money.x")], { next: { crawlCursor: "sealed" } }),
    },
    order: ["start", "money"],
    slots: {},
    status: "running",
    corrections: [],
    rivalEdits: { removed: [], added: [] },
    timings: [],
    ...extra,
  };
}

test("a run is saved per account and loaded back; other accounts see nothing", () => {
  const s = new MemoryStorage();
  assert.equal(saveRun(s, snap("run-a", 1)), true);
  assert.equal(loadRun(s, UID, "run-a")?.runId, "run-a");
  assert.equal(loadRun(s, "someone-else", "run-a"), null);
  assert.deepEqual(
    readIndex(s, UID).map((e) => e.runId),
    ["run-a"],
  );
  assert.ok([...s.map.keys()].every((k) => k.startsWith("vortex-deep:v1:user-1:")));
});

test("at most 5 runs: the oldest goes first", () => {
  const s = new MemoryStorage();
  for (let i = 0; i < MAX_RUNS + 2; i++) saveRun(s, snap(`run-${i}`, i));
  const ids = readIndex(s, UID).map((e) => e.runId);
  assert.equal(ids.length, MAX_RUNS);
  assert.deepEqual(ids, ["run-6", "run-5", "run-4", "run-3", "run-2"]);
  assert.equal(loadRun(s, UID, "run-0"), null);
});

test("a full storage evicts the oldest run, never the one being saved", () => {
  const s = new MemoryStorage();
  saveRun(s, snap("old", 1));
  saveRun(s, snap("mid", 2));
  const used = [...s.map.values()].reduce((n, v) => n + v.length, 0);
  s.quota = used + 400;
  assert.equal(saveRun(s, snap("new", 3)), true);
  assert.equal(loadRun(s, UID, "old"), null, "oldest evicted");
  assert.ok(loadRun(s, UID, "new"));
});

test("never journaled: ephemeral Google facts, results after the report, sealed cursors when done", () => {
  const google = fact("presence.google_rating", { ephemeral: true });
  const running = sanitizeSnapshot(
    snap("r1", 1, {
      results: { start: result("start"), g: result("signals", [google]) },
      order: ["start", "g"],
    }),
  );
  assert.deepEqual(
    Object.keys(running.results),
    ["start"],
    "a result with an ephemeral fact stays in memory",
  );
  const report = {
    facts: [fact("a"), google],
    lights: [{ area: "clienti", factIds: ["a", "presence.google_rating"] }],
  } as unknown as DeepReport;
  const done = sanitizeSnapshot(snap("r2", 1, { status: "done", report }));
  assert.deepEqual(done.results, {}, "results dropped once the report exists");
  assert.deepEqual(
    done.report!.facts.map((f) => f.id),
    ["a"],
  );
  assert.deepEqual(done.report!.lights[0].factIds, ["a"]);
  const s = new MemoryStorage();
  saveRun(s, snap("r3", 1, { status: "done", report }));
  assert.equal(JSON.stringify([...s.map.values()]).includes("sealed"), false);
  assert.equal(JSON.stringify([...s.map.values()]).includes("google_rating"), false);
});

test("unfinished runs under 24 hours are offered; previous reports feed 'Ce s-a schimbat'", () => {
  const s = new MemoryStorage();
  const now = 10 * 3600_000;
  saveRun(s, snap("fresh", now - 3600_000));
  assert.equal(unfinishedRun(s, UID, now)?.runId, "fresh");
  assert.equal(unfinishedRun(s, UID, now + 30 * 3600_000), null);
  const report = { facts: [fact("money.turnover.2025")] } as unknown as DeepReport;
  saveRun(s, snap("earlier", 1, { status: "done", report }));
  assert.deepEqual(
    previousReport(s, UID, "3365133", "fresh")?.report.facts.map((f) => f.id),
    ["money.turnover.2025"],
  );
  assert.equal(previousReport(s, UID, "999", "fresh"), null);
  removeRun(s, UID, "earlier");
  assert.equal(previousReport(s, UID, "3365133", "fresh"), null);
});

test("sign-out clears every journal; per-account clear keeps the others", () => {
  const s = new MemoryStorage();
  saveRun(s, snap("a", 1));
  saveRun(s, { ...snap("b", 1), uid: "user-2" });
  s.setItem("vortex-language", "ro");
  clearJournal(s, "user-2");
  assert.ok(loadRun(s, UID, "a"));
  assert.equal(readIndex(s, "user-2").length, 0);
  assert.equal(hasAnyJournal(s), true);
  clearJournal(s);
  assert.equal(hasAnyJournal(s), false);
  assert.equal(s.getItem("vortex-language"), "ro", "other site data untouched");
});

test("the pending target lasts an hour and only holds valid values", () => {
  const s = new MemoryStorage();
  savePending(s, { cui: "3365133", site: "https://exprestransport.ro", run: undefined }, 1000);
  assert.deepEqual(readPending(s, 1000 + 59 * 60_000), {
    cui: "3365133",
    site: "https://exprestransport.ro",
  });
  assert.equal(readPending(s, 1000 + 61 * 60_000), null);
  savePending(s, { cui: "not-a-cui", site: "javascript:alert(1)" }, 1000);
  assert.deepEqual(
    readPending(s, 2000),
    { cui: "3365133", site: "https://exprestransport.ro" },
    "invalid target not saved",
  );
  clearPending(s);
  assert.equal(readPending(s, 2000), null);
});

test("accepted terms are remembered per account and version", () => {
  const s = new MemoryStorage();
  assert.equal(termsAccepted(s, UID, "2026-10-03"), false);
  rememberTerms(s, UID, "2026-10-03", 1);
  assert.equal(termsAccepted(s, UID, "2026-10-03"), true);
  assert.equal(termsAccepted(s, UID, "2027-01-01"), false);
  assert.equal(termsAccepted(s, "user-2", "2026-10-03"), false);
});

test("storage that throws never breaks the page", () => {
  const broken: StorageLike = {
    length: 0,
    key: () => null,
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(saveRun(broken, snap("x", 1)), false);
  assert.equal(loadRun(broken, UID, "x"), null);
  assert.deepEqual(readIndex(broken, UID), []);
  assert.equal(readPending(broken, 1), null);
  clearJournal(broken);
  assert.equal(saveRun(null, snap("x", 1)), false);
});

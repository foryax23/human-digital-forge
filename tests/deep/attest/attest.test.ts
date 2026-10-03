import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalJson,
  cursorMatches,
  normalizeVerificationCode,
  openCursor,
  reportAttestation,
  sealCursor,
  sealResult,
  verificationCode,
  verifyResult,
} from "../../../src/lib/deep/attest.server";
import type { DeepReport, StepResult } from "../../../src/lib/deep/contracts";
import { issueTicket, readTicket } from "../../../src/lib/deep/ticket.server";

const SECRET = "test-secret-0123456789abcdef";
const UID = "11111111-2222-3333-4444-555555555555";

const draft = (): Omit<StepResult, "att"> => ({
  runId: "run-1",
  step: "money",
  status: "done",
  ms: 812,
  facts: [
    {
      id: "money.turnover.2025",
      section: "money",
      predicate: "money.turnover",
      value: 13000841,
      display: { en: "13,000,841 lei", ro: "13.000.841 lei" },
      source: "anaf_bilant",
      asOf: "FY2025",
      confidence: "confirmat",
      score: 1,
      method: "api",
      gdpr: "G0",
    },
  ],
  gaps: [],
  counters: { anafCalls: 7 },
  next: { anafNextAt: 1_800_000_000_000 },
});

test("canonical JSON: sorted keys, undefined dropped", () => {
  assert.equal(canonicalJson({ b: 1, a: [2, { d: undefined, c: 3 }] }), '{"a":[2,{"c":3}],"b":1}');
  assert.equal(canonicalJson({ a: 1 }), canonicalJson(JSON.parse('{"a":1}')));
});

test("attestation covers facts, gaps, next, counters and brief; other runs and users fail", async () => {
  const sealed = await sealResult(SECRET, UID, draft());
  assert.equal(await verifyResult(SECRET, UID, "run-1", sealed), true);
  // A round trip through JSON (the browser journal) keeps it valid.
  assert.equal(await verifyResult(SECRET, UID, "run-1", JSON.parse(JSON.stringify(sealed))), true);
  const forged: Array<(r: StepResult) => StepResult> = [
    (r) => ({ ...r, facts: [{ ...r.facts[0], value: 99_000_000 }] }),
    (r) => ({ ...r, facts: [{ ...r.facts[0], display: { en: "99", ro: "99" } }] }),
    (r) => ({
      ...r,
      gaps: [
        {
          section: "money",
          what: { en: "x", ro: "x" },
          where: { en: "y", ro: "y" },
          at: "2026-10-03",
        },
      ],
    }),
    (r) => ({ ...r, next: { anafNextAt: 0 } }),
    (r) => ({ ...r, counters: { anafCalls: 1 } }),
    (r) => ({
      ...r,
      brief: { headline: { source: "ai", sentences: [{ text: "Injected", factIds: [] }] } },
    }),
    (r) => ({ ...r, status: "failed" }),
  ];
  for (const forge of forged)
    assert.equal(await verifyResult(SECRET, UID, "run-1", forge(sealed)), false);
  assert.equal(await verifyResult(SECRET, "someone-else", "run-1", sealed), false);
  assert.equal(await verifyResult(SECRET, UID, "run-2", sealed), false);
  assert.equal(await verifyResult("another-secret-xxxxxxxx", UID, "run-1", sealed), false);
  assert.equal(await verifyResult(SECRET, UID, "run-1", null), false);
});

test("tickets: signature, expiry, user mismatch", async () => {
  const now = Date.UTC(2026, 9, 3, 10);
  const token = await issueTicket(
    SECRET,
    {
      runId: "run-1",
      uid: UID,
      cui: "3365133",
      via: "admin",
      store: "memory",
      budgetUsd: 1.5,
      lang: "ro",
      rel: "proprietar",
      ai: "rules",
      idn: { name: "EXPRES TRANSPORT SRL", displayName: "Expres Transport SRL" },
      anafAt: now + 1100,
    },
    now,
  );
  const ok = await readTicket(SECRET, token, { uid: UID, now: now + 60_000 });
  assert.equal(ok.ok, true);
  assert.deepEqual(await readTicket(SECRET, token, { uid: "other", now }), {
    ok: false,
    reason: "user_mismatch",
  });
  assert.deepEqual(await readTicket(SECRET, token, { uid: UID, now: now + 3 * 3600_000 }), {
    ok: false,
    reason: "ticket_expired",
  });
  const [body, sig] = token.split(".");
  const tampered = `${body.slice(0, -2)}AA.${sig}`;
  assert.deepEqual(await readTicket(SECRET, tampered, { uid: UID, now }), {
    ok: false,
    reason: "ticket_invalid",
  });
  assert.deepEqual(await readTicket(SECRET, "garbage", { uid: UID, now }), {
    ok: false,
    reason: "ticket_invalid",
  });
});

test("sealed cursors: opaque, bound to the run and purpose, tamper-proof", async () => {
  const bind = { runId: "run-1", uid: UID };
  const state = {
    origin: "https://x.ro",
    queue: [{ url: "https://x.ro/contact" }],
    html: "<html>".repeat(50),
  };
  const token = await sealCursor(SECRET, bind, state, "crawl");
  assert.equal(token.includes("x.ro"), false, "the client cannot read it");
  assert.deepEqual(await openCursor(SECRET, bind, token, "crawl"), state);
  assert.equal(await openCursor(SECRET, { ...bind, runId: "run-2" }, token, "crawl"), null);
  assert.equal(
    await openCursor(SECRET, bind, token, "site-snapshot"),
    null,
    "a crawl cursor never opens as a site snapshot",
  );
  const flipped = token.slice(0, 20) + (token[20] === "A" ? "B" : "A") + token.slice(21);
  assert.equal(await openCursor(SECRET, bind, flipped, "crawl"), null);
});

test("a result's cursor is fingerprinted in the attestation: droppable, never swappable", async () => {
  const bind = { runId: "run-1", uid: UID };
  const a = await sealCursor(SECRET, bind, { origin: "https://a.ro" }, "site-snapshot");
  const b = await sealCursor(SECRET, bind, { origin: "https://b.ro" }, "site-snapshot");
  const sealed = await sealResult(SECRET, UID, {
    ...draft(),
    step: "site",
    next: { crawlCursor: a },
  });
  assert.equal(typeof sealed.next?.cursorSha, "string");
  assert.equal(await verifyResult(SECRET, UID, "run-1", sealed), true);
  assert.equal(await cursorMatches(sealed), true);
  // Dropped: still a valid result (synthesis and finish), but no cursor to use.
  const dropped = { ...sealed, next: { ...sealed.next, crawlCursor: undefined } };
  assert.equal(await verifyResult(SECRET, UID, "run-1", dropped), true);
  assert.equal(await cursorMatches(dropped), false);
  // Swapped for another sealed cursor of the same run: the attestation holds, the cursor does not.
  const swapped = { ...sealed, next: { ...sealed.next, crawlCursor: b } };
  assert.equal(await verifyResult(SECRET, UID, "run-1", swapped), true);
  assert.equal(await cursorMatches(swapped), false);
  // Changing the fingerprint breaks the attestation.
  const forged = { ...swapped, next: { ...swapped.next, cursorSha: "0".repeat(32) } };
  assert.equal(await verifyResult(SECRET, UID, "run-1", forged), false);
});

test("report attestation and verification code", async () => {
  const report = { schema: 1, runId: "run-1", cui: "3365133", facts: [] } as unknown as DeepReport;
  const att = await reportAttestation(SECRET, "run-1", report);
  const code = verificationCode(att);
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal(
    await reportAttestation(SECRET, "run-1", { ...report, verifyCode: code }),
    att,
    "the code itself is not part of the attested content",
  );
  assert.notEqual(
    await reportAttestation(SECRET, "run-1", { ...report, cui: "1" } as DeepReport),
    att,
  );
  assert.equal(normalizeVerificationCode(code.toLowerCase().replace("-", " ")), code);
  assert.equal(normalizeVerificationCode("12"), null);
});

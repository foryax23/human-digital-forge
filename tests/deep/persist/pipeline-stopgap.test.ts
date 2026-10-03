import assert from "node:assert/strict";
import { test } from "node:test";

import { resetAnafIsolateClock } from "../../../src/lib/deep/anaf-pacer.server";
import { storedReportGenuine } from "../../../src/lib/deep/attest.server";
import { readDeepConfig } from "../../../src/lib/deep/env.server";
import type { DeepDb } from "../../../src/lib/deep/persist-db.server";
import { createStopgapStore, STOPGAP } from "../../../src/lib/deep/persist-stopgap.server";
import { buildReportParts } from "../../../src/lib/deep/report/index";
import { engineStep, type EngineDeps } from "../../../src/lib/deep/steps/dispatch.server";
import { runPipeline } from "../../../src/lib/deep/steps/pipeline.server";
import { deepConsentRecord, DEEP_TERMS_VERSION } from "../../../src/lib/scan/legal/lead-notice";
import { fakeDns, virtualClock } from "../steps/helpers";

import { FakeSupabase } from "./fake-supabase";
import { network } from "./pipeline-net";

/*
 * A whole run through the real dispatcher on the stopgap store (fake
 * Supabase) with Eng 3's report logic: the run row, the step claims, the
 * replay of a retried step without a second ANAF call, the stored report and
 * its verification code. No network: ANAF and the site are scripted.
 */

const SECRET = "stopgap-pipeline-secret-0123456789";
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

test("a full rules-only run on the stopgap store: claims, replay without a second ANAF call, stored report", async () => {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const net = network(clock);
  const db = new FakeSupabase({ now: clock.now });
  const store = createStopgapStore(db as unknown as DeepDb, { now: clock.now, sleep: clock.sleep });
  const deps: EngineDeps = {
    secret: SECRET,
    config: readDeepConfig({ DEEP_RESEARCH_ADMIN_USER_IDS: UID }),
    adapters: {
      rawFetch: net.fetch,
      dns: fakeDns(["exprestransport.ro", "www.exprestransport.ro"]),
      readAsset: async () => null,
      now: clock.now,
      sleep: clock.sleep,
      pagespeed: async () => ({ performance: 54, lcpMs: 4200, strategy: "mobile" as const }),
    },
    storeFor: () => store,
    llmFor: () => null,
    reportBuilder: buildReportParts,
    now: clock.now,
  };
  const run = await runPipeline({
    deps,
    uid: UID,
    via: "admin",
    store,
    storeKind: "stopgap",
    input: {
      cui: "3365133",
      relationship: "proprietar",
      lang: "ro",
      consent: { termsVersion: DEEP_TERMS_VERSION, marketing: false },
    },
    consent: deepConsentRecord("ro", false, new Date(clock.now())),
    now: clock.now,
  });
  assert.equal(run.ok, true, run.refused);
  const report = run.report!;
  assert.equal(report.aiMode, "rules");
  assert.equal(report.vocab, "transport");
  assert.equal(report.lights.length, 5);
  // The CUI is on the site, so the Online line is about the audit's important issues (the
  // scripted page has no viewport and no privacy page), not about the legal details.
  const online = report.lights.find((l) => l.area === "online")!;
  assert.equal(online.state, "atentie");
  assert.equal(online.reason.ro, "2 probleme importante pe site");
  assert.ok(!report.actions.some((a) => a.id === "legal.company_details"));
  assert.ok(report.registers.notChecked.some((r) => r.link === "https://www.anaf.ro/restante/"));
  // The rules brief cites facts; no peers shard, so the rivals say so honestly.
  assert.match(
    report.brief.rivals.sentences[0]?.text ?? "",
    /Comparația cu firme similare nu e încă gata/,
  );

  // The run row: closed, report stored, verification code, nothing unsettled.
  const row = db.rows("audit_leads").find((r) => r.id === run.runId)!;
  const answers = row.answers as {
    status: string;
    verifyCode: string;
    reservedUsd: number;
    steps: Record<string, { used: number }>;
  };
  assert.ok(answers.status === "succeeded" || answers.status === "partial");
  assert.equal(answers.verifyCode, report.verifyCode);
  assert.equal(answers.reservedUsd, 0);
  assert.equal(answers.steps.money.used, 1);
  assert.ok(answers.steps.anaf.used <= 8);
  // Stored as JSON: compared as JSON (undefined fields drop out).
  const json = (v: unknown) => JSON.parse(JSON.stringify(v));
  assert.deepEqual(
    json(await store.loadReport!({ verifyCode: report.verifyCode! })),
    json({ runId: run.runId, report, reportAtt: run.reportAtt }),
  );
  // The public check recomputes the attestation from the stored (JSON) report.
  const stored = (await store.loadReport!({ verifyCode: report.verifyCode! }))!;
  assert.equal(await storedReportGenuine(SECRET, stored, report.verifyCode!), true);
  assert.equal(
    await storedReportGenuine(SECRET, { ...stored, runId: "forged" }, report.verifyCode!),
    false,
  );

  // Step results for replay are separate rows (the run row stays small).
  assert.ok(db.rows("audit_leads").some((r) => r.recommendation === STOPGAP.step));
  const anafBefore = net.calls.filter((c) => c.url.includes("webservicesp.anaf.ro")).length;
  assert.ok(anafBefore <= 9);
  for (let i = 1; i < anafBefore; i++) {
    const anaf = net.calls.filter((c) => c.url.includes("webservicesp.anaf.ro"));
    assert.ok(anaf[i].at - anaf[i - 1].at >= 1100);
  }
});

test("a retried step replays from the stopgap rows: no second ANAF call, same attested result", async () => {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const net = network(clock);
  const db = new FakeSupabase({ now: clock.now });
  const store = createStopgapStore(db as unknown as DeepDb, { now: clock.now, sleep: clock.sleep });
  const deps: EngineDeps = {
    secret: SECRET,
    config: readDeepConfig({ DEEP_RESEARCH_ADMIN_USER_IDS: UID }),
    adapters: {
      rawFetch: net.fetch,
      dns: fakeDns([]),
      readAsset: async () => null,
      now: clock.now,
      sleep: clock.sleep,
    },
    storeFor: () => store,
    llmFor: () => null,
    reportBuilder: buildReportParts,
    now: clock.now,
  };
  const { engineStart } = await import("../../../src/lib/deep/steps/dispatch.server");
  const started = await engineStart(deps, {
    uid: UID,
    via: "admin",
    input: {
      cui: "3365133",
      relationship: "proprietar",
      lang: "ro",
      consent: { termsVersion: DEEP_TERMS_VERSION, marketing: false },
    },
    store,
    storeKind: "stopgap",
    consent: deepConsentRecord("ro", false),
    userCap: 20,
  });
  assert.equal(started.ok, true);
  if (!started.ok) return;
  assert.equal(started.store, "stopgap");
  const first = await engineStep(deps, {
    uid: UID,
    input: { ticket: started.ticket, step: "money" },
  });
  const callsAfterFirst = net.calls.filter((c) => c.url.includes("webservicesp.anaf.ro")).length;
  const again = await engineStep(deps, {
    uid: UID,
    input: { ticket: started.ticket, step: "money" },
  });
  assert.equal(
    net.calls.filter((c) => c.url.includes("webservicesp.anaf.ro")).length,
    callsAfterFirst,
  );
  assert.equal(first.kind, "step");
  assert.equal(again.kind, "step");
  if (first.kind === "step" && again.kind === "step")
    assert.equal(again.result.att, first.result.att);
  // Another user's ticket for the same run is refused.
  const other = await engineStep(deps, {
    uid: "ffffffff-0000-4000-8000-000000000000",
    input: { ticket: started.ticket, step: "money" },
  });
  assert.equal(other.kind, "refused");
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { resetAnafIsolateClock } from "../../../src/lib/deep/anaf-pacer.server";
import { storedReportGenuine } from "../../../src/lib/deep/attest.server";
import { readDeepConfig } from "../../../src/lib/deep/env.server";
import type { DeepDb } from "../../../src/lib/deep/persist-db.server";
import { createTablesStore } from "../../../src/lib/deep/persist-tables.server";
import { buildReportParts } from "../../../src/lib/deep/report/index";
import {
  engineStart,
  engineStep,
  type EngineDeps,
} from "../../../src/lib/deep/steps/dispatch.server";
import { runPipeline } from "../../../src/lib/deep/steps/pipeline.server";
import { deepConsentRecord, DEEP_TERMS_VERSION } from "../../../src/lib/scan/legal/lead-notice";
import { fakeDns, virtualClock } from "../steps/helpers";

import { installLovableLedger } from "./fake-lovable-sql";
import { FakeSupabase } from "./fake-supabase";
import { network } from "./pipeline-net";

/*
 * Whole runs through the real dispatcher on the tables store, over a port of the deep
 * ledger APPLIED to the live database (Lovable's drizzle/migrations/0000), with and
 * without the optional 0001 functions: the run row in Lovable's columns, step claims in
 * deep_slots/deep_claims, a retried step replayed without a second ANAF call, the stored
 * report and its verification code. No network, no real database.
 */

const SECRET = "tables-pipeline-secret-0123456789ab";
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function engine(additions: boolean) {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const net = network(clock);
  const db = new FakeSupabase({ now: clock.now });
  installLovableLedger(db, { additions });
  const store = createTablesStore(db as unknown as DeepDb, { now: clock.now });
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
  return { clock, net, db, store, deps };
}

const input = {
  cui: "3365133",
  relationship: "proprietar" as const,
  lang: "ro" as const,
  consent: { termsVersion: DEEP_TERMS_VERSION, marketing: false },
};

for (const additions of [true, false]) {
  const label = additions ? "with the 0001 functions" : "on Lovable's 0000 alone";

  test(`a full rules-only run on the tables store ${label}`, async () => {
    const { clock, net, db, store, deps } = engine(additions);
    const run = await runPipeline({
      deps,
      uid: UID,
      via: "admin",
      store,
      storeKind: "tables",
      input,
      consent: deepConsentRecord("ro", false, new Date(clock.now())),
      now: clock.now,
    });
    assert.equal(run.ok, true, run.refused);
    const report = run.report!;
    assert.equal(report.aiMode, "rules");
    assert.equal(report.lights.length, 5);

    const row = db.rows("deep_runs").find((r) => r.id === run.runId)!;
    assert.ok(row.status === "succeeded" || row.status === "partial");
    assert.equal(row.via, "admin");
    assert.equal(row.user_id, UID);
    assert.equal(row.verify_code, report.verifyCode);
    assert.equal(row.reserved_usd, 0);
    assert.equal((row.consent as { channel?: string } | null)?.channel !== undefined, true);
    const slot = (key: string) =>
      db.rows("deep_slots").find((s) => s.run_id === run.runId && s.key === key);
    assert.equal(slot("money")?.used, 1);
    assert.ok(Number(slot("anaf")?.used ?? 0) <= 8);
    // Every claim was settled: nothing left in flight.
    assert.equal(db.rows("deep_claims").filter((c) => c.run_id === run.runId).length, 0);

    const asJson = (v: unknown) => JSON.parse(JSON.stringify(v));
    assert.deepEqual(
      asJson(await store.loadReport!({ verifyCode: report.verifyCode! })),
      asJson({ runId: run.runId, report, reportAtt: run.reportAtt }),
    );
    // The public check recomputes the attestation from the stored (JSON) report.
    const stored = (await store.loadReport!({ verifyCode: report.verifyCode! }))!;
    assert.equal(await storedReportGenuine(SECRET, stored, report.verifyCode!), true);
    assert.equal(
      await storedReportGenuine(SECRET, { ...stored, runId: "forged" }, report.verifyCode!),
      false,
    );
    const listed = await store.listRuns(UID);
    assert.equal(listed[0]?.runId, run.runId);
    assert.equal(listed[0]?.hasReport, true);

    const anaf = net.calls.filter((c) => c.url.includes("webservicesp.anaf.ro"));
    assert.ok(anaf.length <= 9);
    for (let i = 1; i < anaf.length; i++) assert.ok(anaf[i].at - anaf[i - 1].at >= 1100);
    // The stopgap's rows are never written when the tables exist.
    assert.equal(db.rows("audit_leads").length, 0);
  });

  test(`a retried step replays from deep_slots ${label}: no second ANAF call, same result`, async () => {
    const { net, store, deps } = engine(additions);
    const started = await engineStart(deps, {
      uid: UID,
      via: "admin",
      input,
      store,
      storeKind: "tables",
      consent: deepConsentRecord("ro", false),
      userCap: 20,
    });
    assert.equal(started.ok, true);
    if (!started.ok) return;
    assert.equal(started.store, "tables");
    const first = await engineStep(deps, {
      uid: UID,
      input: { ticket: started.ticket, step: "money" },
    });
    const calls = net.calls.filter((c) => c.url.includes("webservicesp.anaf.ro")).length;
    const again = await engineStep(deps, {
      uid: UID,
      input: { ticket: started.ticket, step: "money" },
    });
    assert.equal(net.calls.filter((c) => c.url.includes("webservicesp.anaf.ro")).length, calls);
    assert.equal(first.kind, "step");
    assert.equal(again.kind, "step");
    if (first.kind === "step" && again.kind === "step")
      assert.equal(again.result.att, first.result.att);
    // Another account's request with this ticket is refused.
    const other = await engineStep(deps, {
      uid: "ffffffff-0000-4000-8000-000000000000",
      input: { ticket: started.ticket, step: "money" },
    });
    assert.equal(other.kind, "refused");
  });
}

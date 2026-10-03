import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { resetAnafIsolateClock } from "../../../src/lib/deep/anaf-pacer.server";
import { readDeepConfig } from "../../../src/lib/deep/env.server";
import type { DeepDb } from "../../../src/lib/deep/persist-db.server";
import { createStopgapStore, STOPGAP } from "../../../src/lib/deep/persist-stopgap.server";
import { buildReportParts } from "../../../src/lib/deep/report/index";
import { engineStep, type EngineDeps } from "../../../src/lib/deep/steps/dispatch.server";
import { runPipeline } from "../../../src/lib/deep/steps/pipeline.server";
import { deepConsentRecord, DEEP_TERMS_VERSION } from "../../../src/lib/scan/legal/lead-notice";
import { fakeDns, html, json, scriptedFetch, virtualClock } from "../steps/helpers";

import { FakeSupabase } from "./fake-supabase";

/*
 * A whole run through the real dispatcher on the stopgap store (fake
 * Supabase) with Eng 3's report logic: the run row, the step claims, the
 * replay of a retried step without a second ANAF call, the stored report and
 * its verification code. No network: ANAF and the site are scripted.
 */

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/deep/${name}`, import.meta.url), "utf8");
const V9 = JSON.parse(fixture("anaf-v9.json")).records as Record<string, unknown>;
const BILANT = JSON.parse(fixture("bilant.json"));
const SECRET = "stopgap-pipeline-secret-0123456789";
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function bilantFor(cui: string, year: number) {
  if (cui !== "3365133" || year < 2019)
    return { an: year, cui: Number(cui), deni: "", caen: 0, den_caen: "", i: [] };
  const scale = 1 - (2025 - year) * 0.08;
  const base = BILANT.expres2025;
  return {
    ...base,
    an: year,
    i: base.i.map((row: { indicator: string; val_indicator: number }) => ({
      ...row,
      val_indicator:
        row.indicator === "I20"
          ? Math.round(25 - (2025 - year))
          : Math.round(row.val_indicator * scale),
    })),
  };
}

const HOME = `<!doctype html><html lang="ro"><head><title>Expres Transport – transport marfă</title></head>
<body><nav><a href="/contact">Contact</a></nav><main><h1>Transport rutier de mărfuri din Pecica</h1>
<p>Facem transport intern și internațional. Cere o ofertă la telefon sau prin formular.</p></main>
<footer>EXPRES TRANSPORT SRL · CUI RO3365133 · J02/151/1993</footer></body></html>`;
const CONTACT = `<html lang="ro"><body><h1>Contact</h1><p>Telefon: <a href="tel:+40257000000">0257 000 000</a></p>
<form class="wpcf7"><input type="text" name="n"><input type="email" name="e"><textarea name="m"></textarea></form></body></html>`;

function network(clock: ReturnType<typeof virtualClock>) {
  return scriptedFetch(
    [
      [
        /PlatitorTvaRest\/v9\/tva/,
        async (_u, init) => {
          const asked = JSON.parse(String(init?.body ?? "[]")) as Array<{ cui: number }>;
          return json({
            cod: 200,
            found: asked.map(({ cui }) => V9[String(cui)]).filter(Boolean),
            notFound: [],
          });
        },
      ],
      [
        /webservicesp\.anaf\.ro\/bilant/,
        (u) => json(bilantFor(u.searchParams.get("cui")!, Number(u.searchParams.get("an")))),
      ],
      [
        /portalquery\.just\.ro/,
        () =>
          new Response(
            "<soap:Envelope><soap:Body><CautareDosareResponse><CautareDosareResult></CautareDosareResult></CautareDosareResponse></soap:Body></soap:Envelope>",
            { status: 200, headers: { "content-type": "text/xml" } },
          ),
      ],
      [/api\.ted\.europa\.eu/, () => json({ notices: [], totalNoticeCount: 0 })],
      [
        /exprestransport\.ro\/robots\.txt$/,
        () =>
          new Response("User-agent: *\nDisallow: /wp-admin\n", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      ],
      [
        /^https:\/\/exprestransport\.ro\/$/,
        () =>
          new Response(null, {
            status: 301,
            headers: { location: "https://www.exprestransport.ro/" },
          }),
      ],
      [/^https:\/\/www\.exprestransport\.ro\/$/, () => html(HOME)],
      [/exprestransport\.ro\/contact$/, () => html(CONTACT)],
    ],
    clock,
  );
}

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
    json({ report, reportAtt: run.reportAtt }),
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

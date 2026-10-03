import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { resetAnafIsolateClock } from "../../../src/lib/deep/anaf-pacer.server";
import { sealResult, verifyResult } from "../../../src/lib/deep/attest.server";
import type { ConsentRecord, DeepStore, StepResult } from "../../../src/lib/deep/contracts";
import { readDeepConfig } from "../../../src/lib/deep/env.server";
import { createMemoryStore } from "../../../src/lib/deep/llm/ledger-memory.server";
import type { LlmBlock, LlmClient, LlmRequest } from "../../../src/lib/deep/llm/types";
import {
  engineStart,
  engineStep,
  type EngineDeps,
} from "../../../src/lib/deep/steps/dispatch.server";
import { runPipeline } from "../../../src/lib/deep/steps/pipeline.server";
import { provisionalReportParts } from "../../../src/lib/deep/steps/report-fallback.server";
import {
  fakeDns,
  fakeTransport,
  html,
  json,
  message,
  scriptedFetch,
  virtualClock,
} from "./helpers";

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/deep/${name}`, import.meta.url), "utf8");
const V9 = JSON.parse(fixture("anaf-v9.json")).records as Record<string, unknown>;
const BILANT = JSON.parse(fixture("bilant.json"));
const SHARD = fixture("fin-4646-sample.txt");
const SECRET = "pipeline-test-secret-0123456789";
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const consent: ConsentRecord = {
  version: "test",
  lang: "ro",
  channel: "vortex-deep/start",
  recordedAt: "2026-10-03T09:00:00Z",
  notice: "n",
  reportBasis: "b",
  terms: { version: "test", text: "t", accepted: true },
  marketing: { granted: false, text: "m", basis: "b" },
};

/** Expres Transport's accounts, scaled for earlier years (synthetic history; 2025 is the real answer). */
function bilantFor(cui: string, year: number) {
  if (cui !== "3365133" || year < 2019)
    return { an: year, cui: Number(cui), deni: "", caen: 0, den_caen: "", i: [] };
  const scale = 1 - (2025 - year) * 0.08;
  const base = BILANT.expres2025;
  return {
    ...base,
    an: year,
    i: base.i.map(
      (row: { indicator: string; val_indicator: number; val_den_indicator: string }) => ({
        ...row,
        val_indicator:
          row.indicator === "I20"
            ? Math.round(25 - (2025 - year))
            : Math.round(row.val_indicator * scale),
      }),
    ),
  };
}

const HOME = `<!doctype html><html lang="ro"><head><title>Expres Transport – transport marfă</title>
<link rel="icon" href="/favicon.png"><script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script></head>
<body><nav><a href="/servicii">Servicii</a> <a href="/contact">Contact</a> <a href="/echipa">Echipa</a> <a href="/cariere">Cariere</a></nav>
<main><h1>Transport rutier de mărfuri din Pecica</h1><p>Facem transport intern și internațional cu o flotă proprie. Cere o ofertă la telefon sau prin formular.</p>
<h2>Transport intern</h2><h2>Transport internațional</h2></main>
<footer>EXPRES TRANSPORT SRL · CUI RO3365133 · J02/151/1993 · <a href="/termeni">Termeni</a> <a href="/confidentialitate">Confidențialitate</a></footer></body></html>`;
const CONTACT = `<html lang="ro"><body><h1>Contact</h1><p>Telefon: <a href="tel:+40257000000">0257 000 000</a>, e-mail office@exprestransport.ro sau ion.popescu@exprestransport.ro.</p>
<form class="wpcf7"><input type="text" name="n"><input type="email" name="e"><textarea name="m"></textarea></form></body></html>`;
const TEAM = `<html lang="ro"><body><h1>Echipa</h1><h3>Ion Popescu</h3><p>Dispecer</p><h3>Maria Ionescu</h3><p>Contabil</p></body></html>`;
const CAREERS = `<html lang="ro"><body><h1>Cariere</h1><h3>Șofer profesionist categoria C+E</h3><p>Angajăm șofer pentru curse internaționale.</p></body></html>`;

function network(clock: ReturnType<typeof virtualClock>) {
  return scriptedFetch(
    [
      [
        /PlatitorTvaRest\/v9\/tva/,
        async (_u, init) => {
          const asked = JSON.parse(String(init?.body ?? "[]")) as Array<{ cui: number }>;
          const found = asked.map(
            ({ cui }) =>
              V9[String(cui)] ?? {
                date_generale: {
                  cui,
                  denumire: `RIVAL ${cui} SRL`,
                  stare_inregistrare: "INREGISTRAT din data 01.01.2010",
                  forma_juridica: "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ",
                  forma_organizare: "PERSOANA JURIDICA",
                  nrRegCom: "J02/1/2010",
                },
                stare_inactiv: { statusInactivi: false },
                adresa_sediu_social: {
                  sdenumire_Localitate: "Mun. Arad",
                  sdenumire_Judet: "ARAD",
                  scod_JudetAuto: "AR",
                },
              },
          );
          return json({ cod: 200, found, notFound: [] });
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
          new Response(
            "User-agent: *\nDisallow: /wp-admin\nSitemap: https://www.exprestransport.ro/sitemap.xml\n",
            { status: 200, headers: { "content-type": "text/plain" } },
          ),
      ],
      [
        /exprestransport\.ro\/sitemap\.xml$/,
        () =>
          new Response(
            `<?xml version="1.0"?><urlset><url><loc>https://www.exprestransport.ro/servicii</loc></url><url><loc>https://www.exprestransport.ro/despre</loc></url><url><loc>https://www.exprestransport.ro/flota</loc></url></urlset>`,
            { status: 200, headers: { "content-type": "application/xml" } },
          ),
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
      [/exprestransport\.ro\/echipa$/, () => html(TEAM)],
      [/exprestransport\.ro\/cariere$/, () => html(CAREERS)],
      [
        /exprestransport\.ro\/(servicii|despre|flota|termeni|confidentialitate)$/,
        (u) =>
          html(
            `<html lang="ro"><body><h1>${u.pathname}</h1><p>Pagina ${u.pathname} a firmei de transport.</p></body></html>`,
          ),
      ],
    ],
    clock,
  );
}

function deps(
  clock: ReturnType<typeof virtualClock>,
  net: ReturnType<typeof network>,
  store: DeepStore,
  llm: LlmClient | null,
  env: Record<string, string> = {},
): EngineDeps {
  const config = readDeepConfig({
    DEEP_RESEARCH_ADMIN_USER_IDS: UID,
    // Tests run on the memory ledger: paid calls need the explicit opt-in there.
    ...(llm ? { ANTHROPIC_API_KEY: "test-key", DEEP_MEMORY_LEDGER_AI: "on" } : {}),
    ...env,
  });
  return {
    secret: SECRET,
    config,
    adapters: {
      rawFetch: net.fetch,
      dns: fakeDns(["exprestransport.ro", "www.exprestransport.ro"], {
        "TXT:exprestransport.ro": ["v=spf1 include:_spf.example ~all"],
      }),
      readAsset: async (path) => (path === "/scan-index/v1/fin/4941.txt" ? SHARD : null),
      now: clock.now,
      sleep: clock.sleep,
      pagespeed: async () => ({ performance: 54, lcpMs: 4200, strategy: "mobile" as const }),
    },
    storeFor: () => store,
    llmFor: () => llm,
    reportBuilder: provisionalReportParts,
    now: clock.now,
  };
}

const START = {
  cui: "3365133",
  relationship: "proprietar" as const,
  lang: "ro" as const,
  consent: { termsVersion: "test", marketing: false },
};

test("a full run without an API key: rules-only report, ANAF ≤ 9 calls ≥ 1.1 s apart, polite crawl, homepage once", async () => {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const net = network(clock);
  const store = createMemoryStore({ now: clock.now });
  const run = await runPipeline({
    deps: deps(clock, net, store, null),
    uid: UID,
    via: "admin",
    store,
    storeKind: "memory",
    input: START,
    consent,
    now: clock.now,
  });
  assert.equal(run.ok, true, run.refused);
  const report = run.report!;
  assert.equal(report.aiMode, "rules");
  assert.equal(report.firm, "established");
  const fact = (id: string) => report.facts.find((f) => f.id === id);
  assert.equal(fact("money.turnover.2025")?.value, 13000841);
  assert.equal(fact("people.employees.2025")?.value, 25);
  assert.equal(fact("site.status")?.value, "verified");
  assert.equal(fact("site.cui.present")?.value, true);
  assert.equal(fact("site.contact.present")?.value, true);
  assert.equal(fact("people.hiring")?.value, true, "hiring is positive");
  assert.ok(fact("peers.n"), "peers from the shard");
  assert.ok(report.competitors.length >= 3);
  assert.equal(report.lights.length, 5);
  assert.match(report.verifyCode!, /^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.ok(report.brief.headline.sentences.length >= 1);
  assert.equal(report.brief.headline.source, "rules");
  // Every fact has source, as-of date, confidence and method; adverse facts only at >= 0.9.
  for (const f of report.facts) {
    assert.ok(f.source && f.asOf && f.confidence && f.method, f.id);
    if (f.adverse) assert.ok(f.score >= 0.9, f.id);
  }
  // People rules: no personal names, personal e-mails counted, never shown.
  const text = JSON.stringify(report);
  assert.equal(text.includes("Popescu"), false);
  assert.equal(text.includes("Ionescu"), false);
  assert.equal(text.includes("ion.popescu"), false);

  // ANAF: at most 9 calls in the run, at least 1.1 s apart.
  const anaf = net.calls.filter((c) => c.url.includes("webservicesp.anaf.ro"));
  assert.ok(anaf.length <= 9, `${anaf.length} ANAF calls`);
  for (let i = 1; i < anaf.length; i++)
    assert.ok(anaf[i].at - anaf[i - 1].at >= 1100, `ANAF gap ${anaf[i].at - anaf[i - 1].at} ms`);
  // The company site: robots first, one request at a time, ≥ 1 s apart, homepage once.
  const site = net.calls.filter((c) => c.url.includes("exprestransport.ro"));
  const www = site.filter((c) => c.url.includes("www."));
  assert.equal(www[0].url, "https://www.exprestransport.ro/robots.txt");
  for (let i = 1; i < www.length; i++)
    assert.ok(www[i].at - www[i - 1].at >= 1000, `site gap ${www[i].at - www[i - 1].at} ms`);
  assert.equal(
    site.filter((c) => c.url === "https://www.exprestransport.ro/").length,
    1,
    "homepage fetched once per run",
  );
  assert.equal(
    site.filter((c) => c.url.endsWith("/robots.txt") && c.url.includes("www.")).length,
    1,
    "robots.txt reused through the cursor",
  );
  // Step results: attested, small, timed.
  for (const r of run.results) {
    assert.equal(await verifyResult(SECRET, UID, run.runId!, r), true, r.step);
    assert.ok(new TextEncoder().encode(JSON.stringify(r)).length <= 48 * 1024, r.step);
  }
  const call = store.calls(run.runId!);
  assert.equal(call.length, 0, "no paid call without a key");
});

test("forged results, foreign competitors and other users are refused", async () => {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const net = network(clock);
  const store = createMemoryStore({ now: clock.now });
  const d = deps(clock, net, store, null);
  const started = await engineStart(d, {
    uid: UID,
    via: "admin",
    input: START,
    store,
    storeKind: "memory",
    consent,
    userCap: 20,
  });
  assert.equal(started.ok, true);
  if (!started.ok) return;
  const money = await engineStep(d, { uid: UID, input: { ticket: started.ticket, step: "money" } });
  assert.equal(money.kind, "step");
  if (money.kind !== "step") return;
  const forged: StepResult = {
    ...money.result,
    facts: money.result.facts.map((f) => (f.id === "money.turnover.2025" ? { ...f, value: 1 } : f)),
  };
  assert.deepEqual(
    await engineStep(d, {
      uid: UID,
      input: { ticket: started.ticket, step: "peers", money: forged },
    }),
    { kind: "refused", reason: "ticket_invalid" },
  );
  const peers = await engineStep(d, {
    uid: UID,
    input: { ticket: started.ticket, step: "peers", money: money.result },
  });
  assert.equal(peers.kind, "step");
  if (peers.kind !== "step") return;
  assert.deepEqual(
    await engineStep(d, {
      uid: UID,
      input: { ticket: started.ticket, step: "competitor", peers: peers.result, cui: "1094992" },
    }),
    { kind: "refused", reason: "ticket_invalid" },
  );
  assert.deepEqual(
    await engineStep(d, { uid: "intruder", input: { ticket: started.ticket, step: "money" } }),
    { kind: "refused", reason: "user_mismatch" },
  );
  // A result attested for another run cannot be replayed into this one.
  const other = await sealResult(SECRET, UID, { ...money.result, runId: "another-run" });
  assert.deepEqual(
    await engineStep(d, {
      uid: UID,
      input: { ticket: started.ticket, step: "peers", money: other },
    }),
    { kind: "refused", reason: "ticket_invalid" },
  );
  // The crawl cursor is sealed on its own: the runner may drop it when sending results back.
  const site = await engineStep(d, { uid: UID, input: { ticket: started.ticket, step: "site" } });
  assert.equal(site.kind, "step");
  if (site.kind !== "step") return;
  assert.ok(site.result.next?.crawlCursor);
  const { crawlCursor: _c, ...rest } = site.result.next!;
  assert.equal(
    await verifyResult(SECRET, UID, started.runId, {
      ...site.result,
      next: Object.keys(rest).length ? rest : undefined,
    }),
    true,
  );
  assert.equal(
    await verifyResult(SECRET, UID, started.runId, {
      ...site.result,
      next: {
        ...site.result.next,
        askSite: { url: "https://evil.example/", reason: { en: "", ro: "" } },
      },
    }),
    false,
  );
});

test("PFA, unknown company and an unreachable ledger are refused before any paid call", async () => {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const pfaNet = scriptedFetch(
    [
      [
        /v9\/tva/,
        () =>
          json({
            found: [
              {
                date_generale: {
                  cui: 12345674,
                  denumire: "POPESCU ION PFA",
                  forma_juridica: "PERSOANA FIZICA AUTORIZATA",
                },
              },
            ],
          }),
      ],
    ],
    clock,
  );
  const store = createMemoryStore({ now: clock.now });
  const base = deps(clock, network(clock), store, null);
  const pfa = await engineStart(
    { ...base, adapters: { ...base.adapters, rawFetch: pfaNet.fetch } },
    {
      uid: UID,
      via: "admin",
      input: { ...START, cui: "12345674" },
      store,
      storeKind: "memory",
      consent,
      userCap: 20,
    },
  );
  assert.deepEqual(pfa, { ok: false, reason: "natural_person" });
  const unknown = await engineStart(base, {
    uid: UID,
    via: "admin",
    input: { ...START, cui: "12345678" },
    store,
    storeKind: "memory",
    consent,
    userCap: 20,
  });
  assert.deepEqual(unknown, { ok: false, reason: "not_found" }, "an invalid CUI checksum");
  const transport = fakeTransport({});
  const broken = {
    ...store,
    startRun: async () => {
      throw new Error("supabase unreachable");
    },
  } as DeepStore;
  const llm: LlmClient = {
    transport,
    models: {
      synthesis: "claude-opus-5-5",
      extraction: "claude-haiku-4-5-20251001",
      effort: "low",
    },
  };
  const refused = await engineStart(deps(clock, network(clock), broken, llm), {
    uid: UID,
    via: "admin",
    input: START,
    store: broken,
    storeKind: "memory",
    consent,
    userCap: 20,
  });
  assert.deepEqual(refused, { ok: false, reason: "ledger_unavailable" });
  assert.equal(transport.requests.length, 0, "0 Claude calls");
});

/** Finds the (document, block) of the fact line that starts with `prefix` in a synthesis request. */
function locate(body: LlmRequest, prefix: string): { doc: number; block: number } | null {
  const content = (
    body.messages as Array<{
      content: Array<{ type: string; source?: { content: Array<{ text: string }> } }>;
    }>
  )[0].content;
  const docs = content.filter((c) => c.type === "document");
  for (let d = 0; d < docs.length; d++) {
    const block = docs[d].source!.content.findIndex((b) => b.text.startsWith(prefix));
    if (block >= 0) return { doc: d, block };
  }
  return null;
}

test("a full run with a (fake) model: extraction, warm-up, three sections, entailment, spend within the budget", async () => {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const net = network(clock);
  const store = createMemoryStore({ now: clock.now });
  const transport = fakeTransport({
    tokens: 7000,
    parse: (body) => {
      const schemaKeys = Object.keys(
        (body.schema as { shape?: Record<string, unknown> }).shape ?? {},
      );
      if (schemaKeys.includes("verdicts")) {
        const items =
          String((body.messages as Array<{ content: string }>)[0].content).match(
            /<item i="(\d+)">/g,
          ) ?? [];
        return message([], {
          model: "claude-haiku-4-5-20251001",
          parsed_output: {
            verdicts: items.map((_, i) => ({ i, verdict: i === 1 ? "partial" : "supported" })),
          },
        });
      }
      return message([], {
        model: "claude-haiku-4-5-20251001",
        usage: { input_tokens: 3000, output_tokens: 400 },
        parsed_output: {
          hours: [],
          services: [{ page: 0, name: "Transport intern", quote: "Transport intern" }],
          prices: [],
          offers: [],
          booking: [],
          jobs: [],
          roles: [],
          departments: [],
          team_size: [],
          service_area: [],
        },
      });
    },
    create: () =>
      message([], {
        stop_reason: "max_tokens",
        usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 7000 },
      }),
    stream: (body) => {
      const turnover = locate(body, "Cifra de afaceri în 2025");
      const status = locate(body, "Starea site-ului");
      const cite = (text: string, at: { doc: number; block: number } | null): LlmBlock =>
        at
          ? {
              type: "text",
              text,
              citations: [
                {
                  type: "content_block_location",
                  document_index: at.doc,
                  start_block_index: at.block,
                  end_block_index: at.block + 1,
                },
              ],
            }
          : { type: "text", text };
      const instruction = JSON.stringify(body.messages).includes("[CE_VEDE_UN_CLIENT]")
        ? "customer"
        : JSON.stringify(body.messages).includes("[CONCURENTI]")
          ? "rivals"
          : "brief";
      if (instruction === "brief") {
        return message([
          { type: "thinking", thinking: "" },
          { type: "text", text: "[TITLU]\n" },
          cite("Firma ta a facturat 13.000.841 lei în 2025.", turnover),
          { type: "text", text: "\n[CE_INSEAMNA]\n" },
          cite("Cifra de afaceri a fost de 13,0 mil. lei, iar site-ul e verificat.", turnover),
          { type: "text", text: "\n[CONSTATARE 1]\n" },
          cite("Firma ta a facturat 13.000.841 lei în 2025.", turnover),
        ]);
      }
      if (instruction === "customer")
        return message([
          { type: "text", text: "[CE_VEDE_UN_CLIENT]\n" },
          cite("Site-ul firmei este verificat.", status),
        ]);
      return message([
        { type: "text", text: "[CONCURENTI]\n" },
        { type: "text", text: "Nu avem date." },
      ]);
    },
  });
  const llm: LlmClient = {
    transport,
    models: {
      synthesis: "claude-opus-5-5",
      extraction: "claude-haiku-4-5-20251001",
      effort: "low",
    },
  };
  const run = await runPipeline({
    deps: deps(clock, net, store, llm),
    uid: UID,
    via: "admin",
    store,
    storeKind: "memory",
    input: START,
    consent,
    now: clock.now,
  });
  assert.equal(run.ok, true, run.refused);
  const report = run.report!;
  assert.equal(report.aiMode, "ai");
  assert.equal(report.brief.headline.source, "ai");
  assert.deepEqual(
    report.brief.headline.sentences.map((s) => s.text),
    ["Firma ta a facturat 13.000.841 lei în 2025."],
  );
  assert.equal(
    report.brief.meaning.source,
    "rules",
    "the only meaning sentence had an uncited-number problem or failed entailment: rules instead",
  );
  assert.equal(
    report.brief.rivals.source,
    "rules",
    "an uncited rivals section falls back to rules",
  );
  assert.ok(report.facts.some((f) => f.predicate === "offers.services" && f.method === "llm"));
  const kinds = transport.requests.map((r) => r.kind);
  assert.ok(kinds.includes("create"), "warm-up sent");
  assert.equal(kinds.filter((k) => k === "stream").length, 3, "three sections");
  const calls = store.calls(run.runId!);
  assert.ok(calls.every((c) => c.status === "settled"));
  const r = store.run(run.runId!)!;
  assert.ok(r.spentUsd > 0 && r.spentUsd <= 1.5, `spent ${r.spentUsd}`);
  assert.equal(report.costUsd !== undefined, true, "admins see the cost");
  assert.equal(r.status, "succeeded");
});

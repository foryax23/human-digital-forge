/*
 * Run-level limits and failure paths (review fixes): replayed or parallel steps
 * cannot multiply ANAF, site or competitor traffic; a swapped cursor is
 * refused; ANAF firewall pages never make an established firm "new"; finish is
 * idempotent and always ends in a report; the memory ledger is rules-only
 * unless opted in. No network: scripted fetch and a virtual clock.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { resetAnafIsolateClock } from "../../../src/lib/deep/anaf-pacer.server";
import type {
  ConsentRecord,
  DeepStepInput,
  DeepStepOutput,
  StepResult,
} from "../../../src/lib/deep/contracts";
import { readDeepConfig } from "../../../src/lib/deep/env.server";
import { createMemoryStore } from "../../../src/lib/deep/llm/ledger-memory.server";
import type { LlmClient } from "../../../src/lib/deep/llm/types";
import {
  engineStart,
  engineStep,
  type EngineDeps,
} from "../../../src/lib/deep/steps/dispatch.server";
import {
  provisionalReportParts,
  type ReportBuilder,
} from "../../../src/lib/deep/steps/report-fallback.server";
import {
  fakeDns,
  fakeTransport,
  html,
  json,
  scriptedFetch,
  virtualClock,
  type Route,
} from "./helpers";

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/deep/${name}`, import.meta.url), "utf8");
const V9 = JSON.parse(fixture("anaf-v9.json")).records as Record<string, unknown>;
const BILANT = JSON.parse(fixture("bilant.json"));
const SHARD = fixture("fin-4646-sample.txt");
const SECRET = "run-limits-secret-0123456789abcdef";
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const consent = { version: "t", lang: "ro", channel: "vortex-deep/start" } as ConsentRecord;

const HOME = `<html lang="ro"><head><title>Expres Transport</title></head><body>
<nav><a href="/servicii">Servicii</a> <a href="/contact">Contact</a> <a href="/despre">Despre</a>
<a href="/flota">Flota</a> <a href="/cariere">Cariere</a> <a href="/echipa">Echipa</a>
<a href="/termeni">Termeni</a> <a href="/blog">Blog</a></nav>
<h1>Transport rutier de mărfuri din Pecica</h1><p>Transport intern și internațional.</p>
<footer>EXPRES TRANSPORT SRL · CUI RO3365133 · J02/151/1993</footer></body></html>`;
const OTHER = `<html lang="ro"><body><h1>Expres Transport Pecica blog</h1><p>Un site oarecare despre expres transport, fără date de firmă. <a href="/a">a</a> <a href="/b">b</a></p></body></html>`;

function v9Route(): Route {
  return async (_u, init) => {
    const asked = JSON.parse(String(init?.body ?? "[]")) as Array<{ cui: number }>;
    return json({
      found: asked.map(
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
            adresa_sediu_social: { sdenumire_Localitate: "Mun. Arad", sdenumire_Judet: "ARAD" },
          },
      ),
      notFound: [],
    });
  };
}

const realBilant: Route = (u) => {
  const year = Number(u.searchParams.get("an"));
  const cui = u.searchParams.get("cui");
  if (cui !== "3365133" || year < 2019) return json({ an: year, cui: Number(cui), i: [] });
  return json({ ...BILANT.expres2025, an: year });
};

function network(clock: ReturnType<typeof virtualClock>, opts: { bilant?: Route } = {}) {
  return scriptedFetch(
    [
      [/PlatitorTvaRest\/v9\/tva/, v9Route()],
      [/webservicesp\.anaf\.ro\/bilant/, opts.bilant ?? realBilant],
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
        /robots\.txt$/,
        () =>
          new Response("User-agent: *\nAllow: /\n", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      ],
      [/^https:\/\/(www\.)?exprestransport\.ro\/$/, () => html(HOME)],
      [/^https:\/\/other-site\.ro\/$/, () => html(OTHER)],
      [
        /^https:\/\/(www\.)?(exprestransport|other-site)\.ro\/[a-z]+$/,
        (u) =>
          html(
            `<html lang="ro"><body><h1>${u.pathname}</h1><p>Pagina ${u.pathname}.</p></body></html>`,
          ),
      ],
    ],
    clock,
  );
}

function setup(
  opts: {
    bilant?: Route;
    builder?: ReportBuilder;
    llm?: LlmClient | null;
    env?: Record<string, string>;
  } = {},
) {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const net = network(clock, { bilant: opts.bilant });
  const store = createMemoryStore({ now: clock.now });
  const deps: EngineDeps = {
    secret: SECRET,
    config: readDeepConfig({ DEEP_RESEARCH_ADMIN_USER_IDS: UID, ...(opts.env ?? {}) }),
    adapters: {
      rawFetch: net.fetch,
      dns: fakeDns(["exprestransport.ro", "other-site.ro"]),
      readAsset: async (path) => (path === "/scan-index/v1/fin/4941.txt" ? SHARD : null),
      now: clock.now,
      sleep: clock.sleep,
      pagespeed: async () => null,
    },
    storeFor: () => store,
    llmFor: () => opts.llm ?? null,
    reportBuilder: opts.builder ?? provisionalReportParts,
    now: clock.now,
  };
  const start = async () => {
    const s = await engineStart(deps, {
      uid: UID,
      via: "admin",
      input: {
        cui: "3365133",
        relationship: "proprietar",
        lang: "ro",
        consent: { termsVersion: "t", marketing: false },
      },
      store,
      storeKind: "memory",
      consent,
      userCap: 20,
    });
    if (!s.ok) throw new Error(`start refused: ${s.reason}`);
    return s;
  };
  const step = (input: DeepStepInput) => engineStep(deps, { uid: UID, input });
  const anafCalls = () => net.calls.filter((c) => c.url.includes("webservicesp.anaf.ro")).length;
  return { clock, net, store, deps, start, step, anafCalls };
}

const result = (out: DeepStepOutput): StepResult => {
  assert.equal(out.kind, "step", JSON.stringify(out).slice(0, 200));
  return (out as { result: StepResult }).result;
};
const factOf = (r: StepResult | { facts: StepResult["facts"] }, id: string) =>
  r.facts.find((f) => f.id === id);

test("replayed steps cannot multiply ANAF, site or competitor traffic (run-level claims)", async () => {
  const t = setup();
  const s = await t.start();
  const ticket = s.ticket;
  assert.equal(t.anafCalls(), 1, "start: one v9 call");
  const money1 = result(
    await t.step({ ticket, step: "money", anafNextAt: s.identity.next?.anafNextAt }),
  );
  const afterMoney = t.anafCalls();
  assert.ok(afterMoney <= 8, `money made ${afterMoney - 1} calls`);
  // A retried money step (lost response, second tab) replays the stored result: no ANAF call.
  const money2 = result(await t.step({ ticket, step: "money" }));
  const money3 = result(await t.step({ ticket, step: "money" }));
  assert.deepEqual(money2, money1);
  assert.deepEqual(money3, money1);
  assert.equal(t.anafCalls(), afterMoney);

  // Peers: the first call plus three edit re-runs, then the last result is replayed; ANAF ≤ 9 in all.
  const peers: StepResult[] = [];
  for (let i = 0; i < 6; i++)
    peers.push(result(await t.step({ ticket, step: "peers", money: money1 })));
  assert.deepEqual(peers[5], peers[3], "the 5th and 6th calls replay the 4th");
  assert.ok(t.anafCalls() <= 9, `ANAF calls in the run: ${t.anafCalls()}`);

  // Site: the first call and one answer; a third replays the second.
  const site1 = result(await t.step({ ticket, step: "site" }));
  const site2 = result(await t.step({ ticket, step: "site" }));
  const site3 = result(await t.step({ ticket, step: "site" }));
  assert.deepEqual(site3, site2);
  assert.equal(factOf(site1, "site.status")?.value, "verified");

  // Audit once; the same crawl cursor once (a replay, no request); competitors once each.
  const audit = result(await t.step({ ticket, step: "audit", site: site2 }));
  const cursor = audit.next?.crawlCursor;
  assert.ok(cursor, "the audit leaves a crawl cursor");
  const auditAgain = result(await t.step({ ticket, step: "audit", site: site2 }));
  assert.deepEqual(auditAgain, audit);
  const crawl1 = result(await t.step({ ticket, step: "crawl", site: site2, cursor: cursor! }));
  const requests = t.net.calls.length;
  const crawl2 = result(await t.step({ ticket, step: "crawl", site: site2, cursor: cursor! }));
  assert.deepEqual(crawl2, crawl1);
  assert.equal(t.net.calls.length, requests, "a replayed crawl batch makes no request");
  const rival = peers[0].facts.find((f) => f.predicate === "peers.rival");
  assert.ok(rival, "the sample shard gives named rivals");
  const cui = (rival.value as { cui: string }).cui;
  const c1 = await t.step({ ticket, step: "competitor", peers: peers[0], cui });
  assert.equal(c1.kind, "step");
  const c2 = await t.step({ ticket, step: "competitor", peers: peers[0], cui: `RO${cui}` });
  assert.deepEqual(c2, c1, "the same rival (RO prefix or not) runs once");
});

test("a swapped site cursor is refused; a crawl cursor only continues its own site result", async () => {
  const t = setup();
  const { ticket } = await t.start();
  const s1 = result(
    await t.step({ ticket, step: "site", candidates: ["https://exprestransport.ro"] }),
  );
  const s2 = result(
    await t.step({
      ticket,
      step: "site",
      candidates: ["https://other-site.ro"],
      answer: { url: "exprestransport.ro", yes: false },
    }),
  );
  assert.equal(factOf(s1, "site.status")?.value, "verified");
  assert.equal(factOf(s2, "site.url")?.value, "https://other-site.ro/");
  assert.ok(s1.next?.crawlCursor && s2.next?.crawlCursor);
  const before = t.net.calls.length;
  const swapped = { ...s1, next: { ...s1.next, crawlCursor: s2.next!.crawlCursor } };
  assert.deepEqual(await t.step({ ticket, step: "audit", site: swapped }), {
    kind: "refused",
    reason: "ticket_invalid",
  });
  assert.equal(t.net.calls.length, before, "no request to the other site");
  // The honest audit; its crawl cursor does not continue with another site result.
  const audit = result(await t.step({ ticket, step: "audit", site: s1 }));
  const crawl = result(
    await t.step({ ticket, step: "crawl", site: s2, cursor: audit.next!.crawlCursor! }),
  );
  assert.equal(crawl.status, "failed");
  assert.equal(
    t.net.calls.slice(before).some((c) => c.url.includes("other-site.ro")),
    false,
    "other-site.ro is never read",
  );
  // A site snapshot is not a crawl cursor (the sealed purpose differs).
  const misuse = result(
    await t.step({ ticket, step: "crawl", site: s1, cursor: s1.next!.crawlCursor! }),
  );
  assert.equal(misuse.status, "failed");
});

const finishWith = async (
  t: ReturnType<typeof setup>,
  ticket: string,
  steps: Array<"money" | "site" | "signals" | "peers">,
) => {
  const results: StepResult[] = [];
  for (const name of steps) {
    if (name === "peers") {
      const money = results.find((r) => r.step === "money");
      if (money) results.push(result(await t.step({ ticket, step: "peers", money })));
    } else results.push(result(await t.step({ ticket, step: name } as DeepStepInput)));
  }
  return results;
};

test("ANAF firewall pages, 503s and far-future anafNextAt never make an established firm 'new'", async () => {
  const waf: Route = () => html("<html><body>The requested URL was rejected.</body></html>");
  const busy: Route = () => new Response("busy", { status: 503 });
  for (const bilant of [waf, busy]) {
    const t = setup({ bilant });
    const s = await t.start();
    const results = [
      s.identity,
      ...(await finishWith(t, s.ticket, ["money", "site", "signals", "peers"])),
    ];
    const money = results.find((r) => r.step === "money")!;
    assert.equal(money.status, "failed");
    assert.equal((factOf(money, "money.filed")?.value as { filed: unknown }).filed, null);
    const out = await t.step({ ticket: s.ticket, step: "finish", results });
    assert.equal(out.kind, "report");
    const report = (out as { report: import("../../../src/lib/deep/contracts").DeepReport }).report;
    assert.equal(report.firm, "established");
    const bani = report.lights.find((l) => l.area === "bani")!;
    assert.equal(bani.state, "neverificat");
    assert.equal(bani.reason.ro, "ANAF nu a răspuns; verifică la sursă");
    assert.equal(
      report.gaps.some((g) => /firmă nouă/.test(g.where.ro)),
      false,
    );
    assert.ok(report.gaps.some((g) => /Nu am putut verifica/.test(g.where.ro)));
    assert.equal(/încă nu ai bilanț/.test(report.brief.headline.sentences[0].text), false);
  }
  // A client-supplied far-future anafNextAt is clamped (≤ 3 s): the years are still checked.
  const t = setup();
  const s = await t.start();
  const t0 = t.clock.now();
  const money = result(
    await t.step({ ticket: s.ticket, step: "money", anafNextAt: t0 + 3_600_000 }),
  );
  const first = t.net.calls.filter((c) => c.url.includes("/bilant"))[0];
  assert.ok(first.at - t0 <= 3100, `first bilanț call waited ${first.at - t0} ms`);
  assert.equal((factOf(money, "money.filed")?.value as { filed: unknown }).filed, true);
  // A firm ANAF answered for every year with no filing is the new-firm variant.
  const fresh = setup({ bilant: (u) => json({ an: Number(u.searchParams.get("an")), i: [] }) });
  const f = await fresh.start();
  const freshResults = [
    f.identity,
    ...(await finishWith(fresh, f.ticket, ["money", "site", "signals", "peers"])),
  ];
  const report = await fresh.step({ ticket: f.ticket, step: "finish", results: freshResults });
  assert.equal((report as { report: { firm: string } }).report.firm, "new");
});

test("finish is idempotent, marks missing steps, and always ends in a report", async () => {
  // Idempotent: a retried finish returns the stored report and code.
  const t = setup();
  const s = await t.start();
  const results = [
    s.identity,
    ...(await finishWith(t, s.ticket, ["money", "site", "signals", "peers"])),
  ];
  const first = await t.step({ ticket: s.ticket, step: "finish", results });
  const again = await t.step({ ticket: s.ticket, step: "finish", results });
  assert.equal(first.kind, "report");
  assert.deepEqual(again, first);
  // Steps after the run closed are refused.
  assert.deepEqual(await t.step({ ticket: s.ticket, step: "signals" }), {
    kind: "refused",
    reason: "run_not_found",
  });

  // Missing planned steps: a gap each, and the run is partial (never "succeeded").
  const m = setup();
  const ms = await m.start();
  const partialResults = [ms.identity, ...(await finishWith(m, ms.ticket, ["site"]))];
  const partial = await m.step({ ticket: ms.ticket, step: "finish", results: partialResults });
  assert.equal(partial.kind, "report");
  const pr = (partial as { report: import("../../../src/lib/deep/contracts").DeepReport }).report;
  for (const what of ["Cifrele oficiale", "Instanțe și licitații", "Comparația cu firme similare"])
    assert.ok(
      pr.gaps.some((g) => g.what.ro === what && /Neverificat/.test(g.where.ro)),
      what,
    );
  assert.equal(pr.firm, "established", "a missing money step never makes the firm new");
  assert.equal(m.store.run(ms.runId)!.status, "partial");

  // The report logic throws once: the rules-only report, partial, with the gap.
  let calls = 0;
  const flaky: ReportBuilder = (input) => {
    if (calls++ === 0) throw new Error("boom");
    return provisionalReportParts(input);
  };
  const e = setup({ builder: flaky });
  const es = await e.start();
  const eResults = [
    es.identity,
    ...(await finishWith(e, es.ticket, ["money", "site", "signals", "peers"])),
  ];
  const recovered = await e.step({ ticket: es.ticket, step: "finish", results: eResults });
  assert.equal(recovered.kind, "report");
  const rr = (recovered as { report: import("../../../src/lib/deep/contracts").DeepReport }).report;
  assert.ok(rr.gaps.some((g) => /generat parțial/.test(g.where.ro)));
  assert.equal(rr.aiMode, "rules");
  assert.equal(e.store.run(es.runId)!.status, "partial");

  // The report logic always throws: the emergency report still carries the facts and the gap.
  const broken = setup({
    builder: () => {
      throw new Error("always");
    },
  });
  const bs = await broken.start();
  const bResults = [bs.identity, ...(await finishWith(broken, bs.ticket, ["money"]))];
  const last = await broken.step({ ticket: bs.ticket, step: "finish", results: bResults });
  assert.equal(last.kind, "report");
  const lr = (last as { report: import("../../../src/lib/deep/contracts").DeepReport }).report;
  assert.ok(lr.facts.some((f) => f.id === "money.turnover.2025"));
  assert.ok(lr.lights.every((l) => l.state === "neverificat"));
  assert.match(String(lr.verifyCode), /^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
});

test("the memory ledger is rules-only unless DEEP_MEMORY_LEDGER_AI=on", async () => {
  const transport = fakeTransport({});
  const llm: LlmClient = {
    transport,
    models: {
      synthesis: "claude-opus-5-5",
      extraction: "claude-haiku-4-5-20251001",
      effort: "low",
    },
  };
  const off = setup({ llm, env: { ANTHROPIC_API_KEY: "k" } });
  const s = await off.start();
  assert.equal(s.aiMode, "rules");
  const on = setup({ llm, env: { ANTHROPIC_API_KEY: "k", DEEP_MEMORY_LEDGER_AI: "on" } });
  assert.equal((await on.start()).aiMode, "ai");
  assert.equal(transport.requests.length, 0);
});

test("a ticket stops working when its holder is no longer admitted", async () => {
  const t = setup();
  const { ticket } = await t.start();
  t.deps.config = readDeepConfig({ DEEP_RESEARCH_ADMIN_USER_IDS: "someone-else" });
  assert.deepEqual(await t.step({ ticket, step: "signals" }), {
    kind: "refused",
    reason: "admin_only",
  });
  t.deps.config = readDeepConfig({
    DEEP_RESEARCH_MODE: "disabled",
    DEEP_RESEARCH_ADMIN_USER_IDS: UID,
  });
  assert.deepEqual(await t.step({ ticket, step: "signals" }), {
    kind: "refused",
    reason: "mode_disabled",
  });
});

test("owner-added rivals typed with 'RO' reach ANAF as numbers; a social-page answer is declared, not fetched", async () => {
  const t = setup();
  const s = await t.start();
  const money = result(
    await t.step({ ticket: s.ticket, step: "money", anafNextAt: s.identity.next?.anafNextAt }),
  );
  const peers = result(
    await t.step({
      ticket: s.ticket,
      step: "peers",
      money,
      edits: { remove: [], add: ["RO 1094992", "RO123", "ro14399840"] },
    }),
  );
  const v9 = t.net.calls.filter((c) => c.url.includes("PlatitorTvaRest"));
  assert.ok(v9.length >= 1);
  assert.equal(peers.status === "failed", false);
  const added = peers.facts.filter(
    (f) =>
      f.predicate === "peers.rival" && (f.value as { origin: string }).origin === "owner_added",
  );
  assert.ok(added.some((f) => (f.value as { cui: string }).cui === "1094992"));
  assert.equal(
    added.some((f) => (f.value as { cui: string }).cui === "123"),
    false,
    "invalid CUI dropped",
  );
  const site = result(
    await t.step({
      ticket: s.ticket,
      step: "site",
      answer: { url: "https://www.facebook.com/exprestransport", yes: true },
    }),
  );
  assert.equal(
    t.net.calls.some((c) => c.url.includes("facebook.com")),
    false,
  );
  const social = factOf(site, "presence.social_only");
  assert.equal(social?.confidence, "declarat");
});

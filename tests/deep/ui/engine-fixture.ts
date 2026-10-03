import { readFileSync } from "node:fs";

import type { DeepTransport } from "../../../src/components/deep/runner";
import type {
  ConsentRecord,
  DeepStepInput,
  StartDeepRunInput,
} from "../../../src/lib/deep/contracts";
import { readDeepConfig } from "../../../src/lib/deep/env.server";
import { createMemoryStore } from "../../../src/lib/deep/llm/ledger-memory.server";
import {
  engineStart,
  engineStep,
  type EngineDeps,
} from "../../../src/lib/deep/steps/dispatch.server";
import { buildReportParts } from "../../../src/lib/deep/report/index";
import { fakeDns, html, json, scriptedFetch, virtualClock } from "../steps/helpers";

/*
 * The real engine (engineStart / engineStep, memory store, attestation, claims) on a scripted
 * network, for the UI tests: Expres Transport's public figures, a small site, no AI.
 */

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/deep/${name}`, import.meta.url), "utf8");
const V9 = JSON.parse(fixture("anaf-v9.json")).records as Record<string, unknown>;
const BILANT = JSON.parse(fixture("bilant.json"));
const SHARD = fixture("fin-4646-sample.txt");
export const SECRET = "runner-test-secret-0123456789abcdef";
export const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

export const consent: ConsentRecord = {
  version: "test",
  lang: "ro",
  channel: "vortex-deep/start",
  recordedAt: "2026-10-03T09:00:00Z",
  notice: "n",
  reportBasis: "b",
  terms: { version: "test", text: "t", accepted: true },
  marketing: { granted: false, text: "m", basis: "b" },
};

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

const HOME = `<!doctype html><html lang="ro"><head><title>Expres Transport</title></head>
<body><nav><a href="/servicii">Servicii</a> <a href="/contact">Contact</a></nav>
<main><h1>Transport rutier de mărfuri din Pecica</h1><p>Facem transport intern și internațional.</p></main>
<footer>EXPRES TRANSPORT SRL · CUI RO3365133 · J02/151/1993</footer></body></html>`;

export function network(clock: ReturnType<typeof virtualClock>) {
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
            {
              status: 200,
              headers: { "content-type": "text/xml" },
            },
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
      [/exprestransport\.ro\/sitemap\.xml$/, () => new Response("", { status: 404 })],
      [
        /^https:\/\/exprestransport\.ro\/$/,
        () =>
          new Response(null, {
            status: 301,
            headers: { location: "https://www.exprestransport.ro/" },
          }),
      ],
      [/^https:\/\/www\.exprestransport\.ro\/$/, () => html(HOME)],
      [
        /exprestransport\.ro\/(contact|servicii)$/,
        (u) =>
          html(
            `<html lang="ro"><body><h1>${u.pathname}</h1><p>Telefon 0257 000 000.</p></body></html>`,
          ),
      ],
    ],
    clock,
  );
}

export function engine(clock: ReturnType<typeof virtualClock>) {
  const net = network(clock);
  const store = createMemoryStore({ now: clock.now });
  const deps: EngineDeps = {
    secret: SECRET,
    config: readDeepConfig({ DEEP_RESEARCH_ADMIN_USER_IDS: UID }),
    adapters: {
      rawFetch: net.fetch,
      dns: fakeDns(["exprestransport.ro", "www.exprestransport.ro"]),
      readAsset: async (path) => (path === "/scan-index/v1/fin/4941.txt" ? SHARD : null),
      now: clock.now,
      sleep: clock.sleep,
      pagespeed: async () => ({ performance: 54, lcpMs: 4200, strategy: "mobile" as const }),
    },
    storeFor: () => store,
    llmFor: () => null,
    reportBuilder: buildReportParts,
    now: clock.now,
  };
  const calls: DeepStepInput[] = [];
  const transport: DeepTransport = {
    start: (input) =>
      engineStart(deps, {
        uid: UID,
        via: "admin",
        input,
        store,
        storeKind: "memory",
        consent,
        userCap: 20,
      }),
    step: (input) => {
      calls.push(input);
      return engineStep(deps, { uid: UID, input });
    },
    resume: async () => ({ ok: false, reason: "run_not_found" }),
  };
  return { net, store, transport, calls };
}

export const START: StartDeepRunInput = {
  cui: "3365133",
  relationship: "proprietar",
  lang: "ro",
  consent: { termsVersion: "test", marketing: false },
};

import type { Fact, Gap } from "../contracts";
import type { StepEnv } from "../env.server";
import {
  courtMatchScore,
  courtQueryNames,
  parseCourtsXml,
  summarizeCases,
  type CourtCase,
  type CourtSummary,
} from "../parse/courts";
import { bi, count } from "../parse/format";
import { parseTed, tedQuery, type TedSummary } from "../parse/ted";

import { fact, gap, isoDay, type StepDraft } from "./common.server";
import { discoverSocial, intelFacts, searchNews } from "./intel.server";

/*
 * Step 3, "signals" (plan A3, D7, A9): court cases from portal.just.ro (up to
 * 3 name variants, last 36 months, exact party only, counted by role and
 * category; nothing from the files is kept) and EU tenders won (TED v3, by
 * CUI). Adverse court facts carry their match score and are shown only at
 * >= 0.9; below that the report says "verifică la sursă". Answers above the
 * 2 MB cap become "cel puțin N".
 */

const COURTS_URL = "http://portalquery.just.ro/query.asmx";
const TED_URL = "https://api.ted.europa.eu/v3/notices/search";
const COURTS_CAP_BYTES = 2 * 1024 * 1024;

function soapBody(name: string, from: Date, to: Date): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><CautareDosare xmlns="portalquery.just.ro"><numeParte>${esc(name)}</numeParte><dataStart>${from.toISOString().slice(0, 19)}</dataStart><dataStop>${to.toISOString().slice(0, 19)}</dataStop></CautareDosare></soap:Body></soap:Envelope>`;
}

async function readText(
  response: Response,
  cap: number,
): Promise<{ text: string; capped: boolean }> {
  if (!response.body) return { text: "", capped: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let capped = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      capped = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), capped };
}

async function searchCourts(
  env: StepEnv,
): Promise<{ summary: CourtSummary; queried: number } | null> {
  const to = new Date(env.now());
  const from = new Date(env.now() - 36 * 30.44 * 86_400_000);
  const names = courtQueryNames(env.identity.name);
  const cases = new Map<string, CourtCase>();
  let capped = false;
  let queried = 0;
  for (const name of names) {
    if (env.deadline - env.now() < 6000) break;
    try {
      const response = await env.fetch(COURTS_URL, {
        method: "POST",
        headers: {
          "content-type": "text/xml; charset=utf-8",
          SOAPAction: '"portalquery.just.ro/CautareDosare"',
          "user-agent":
            "Mozilla/5.0 (compatible; VortexScan/1.0; +https://vortexhub.dev/privacy#vortex-scan-bot)",
        },
        body: soapBody(name, from, to),
        signal: AbortSignal.timeout(Math.min(15_000, env.deadline - env.now() - 2000)),
      });
      if (!response.ok) continue;
      const read = await readText(response, COURTS_CAP_BYTES);
      capped ||= read.capped;
      queried++;
      for (const c of parseCourtsXml(read.text)) {
        // Deduplicate across name variants without reading case numbers.
        const key = `${c.institution}|${c.date}|${c.category}|${c.object}|${c.parties.map((p) => p.name).join(",")}`;
        if (!cases.has(key)) cases.set(key, c);
      }
    } catch (error) {
      env.log({ courts: name, error: String((error as Error)?.message ?? error) });
    }
  }
  if (!queried) return null;
  const summary = summarizeCases([...cases.values()], env.identity.name, {
    fromIso: from.toISOString().slice(0, 10),
    seatCounty: env.identity.county,
    seatCity: env.identity.city,
    capped,
  });
  return { summary, queried };
}

async function searchTed(env: StepEnv): Promise<TedSummary | null> {
  try {
    const response = await env.fetch(TED_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        query: tedQuery(env.cui),
        fields: ["publication-number", "publication-date", "notice-type", "buyer-name"],
        limit: 50,
      }),
      signal: AbortSignal.timeout(Math.min(12_000, env.deadline - env.now() - 2000)),
    });
    if (!response.ok) return null;
    return parseTed(await response.json());
  } catch (error) {
    env.log({ ted: "error", error: String((error as Error)?.message ?? error) });
    return null;
  }
}

export function courtFacts(summary: CourtSummary, today: string): Fact[] {
  const score = courtMatchScore(summary);
  const shown = score >= 0.9;
  const atLeast = (n: number) =>
    summary.capped ? bi(`at least ${n}`, `cel puțin ${n}`) : count(n);
  const base = {
    section: "risk" as const,
    source: "courts" as const,
    asOf: today,
    confidence: shown ? ("confirmat" as const) : ("probabil" as const),
    method: "api" as const,
    score,
  };
  const note = shown
    ? undefined
    : {
        note: bi(
          "The name match is not certain: check at the source.",
          "Potrivirea numelui nu e sigură: verifică la sursă.",
        ),
      };
  const facts: Fact[] = [
    fact({
      ...base,
      id: "risk.courts.checked",
      predicate: "risk.courts.checked",
      value: { checked: true, exactCases: summary.exactCases, rawCases: summary.rawCases },
      display: bi(
        `Checked: ${summary.exactCases} cases with the company as a party (36 months)`,
        `Verificat: ${summary.exactCases} dosare cu firma ca parte (36 de luni)`,
      ),
      confidence: "confirmat",
      score: 1,
      evidence: { url: "https://portal.just.ro" },
    }),
  ];
  if (!summary.exactCases) return facts;
  facts.push(
    fact({
      ...base,
      id: "risk.courts.as_plaintiff",
      predicate: "risk.courts.as_plaintiff",
      value: summary.byRole.plaintiff,
      display: atLeast(summary.byRole.plaintiff),
      evidence: note,
    }),
    fact({
      ...base,
      id: "risk.courts.as_defendant",
      predicate: "risk.courts.as_defendant",
      value: summary.byRole.defendant,
      display: atLeast(summary.byRole.defendant),
      adverse: summary.byRole.defendant > 0 && shown ? true : undefined,
      evidence: note,
    }),
  );
  if (summary.byRole.creditor) {
    facts.push(
      fact({
        ...base,
        id: "risk.courts.as_creditor",
        predicate: "risk.courts.as_creditor",
        value: summary.byRole.creditor,
        display: atLeast(summary.byRole.creditor),
        evidence: {
          note: bi(
            "Being owed money in someone else's case is not a risk.",
            "A fi creditor în dosarul altcuiva nu e un risc.",
          ),
        },
      }),
    );
  }
  if (summary.insolvencyAsDebtor) {
    facts.push(
      fact({
        ...base,
        id: "risk.courts.insolvency_debtor",
        predicate: "risk.courts.insolvency_debtor",
        value: summary.insolvencyAsDebtor,
        display: atLeast(summary.insolvencyAsDebtor),
        adverse: shown ? true : undefined,
        evidence: note,
      }),
    );
  }
  const labels: Record<string, [string, string]> = {
    plata: ["payment claims", "cereri de plată"],
    insolventa: ["insolvency", "insolvență"],
    munca: ["employment", "litigii de muncă"],
    fiscal: ["tax and administrative", "fiscal și contencios"],
    penal: ["criminal", "penal"],
    altele: ["other", "altele"],
  };
  const parts = Object.entries(summary.byCategory).filter(([, n]) => n > 0);
  facts.push(
    fact({
      ...base,
      id: "risk.courts.by_category",
      predicate: "risk.courts.by_category",
      value: summary.byCategory,
      display: bi(
        parts.map(([k, n]) => `${labels[k][0]}: ${n}`).join(", "),
        parts.map(([k, n]) => `${labels[k][1]}: ${n}`).join(", "),
      ),
      evidence: note,
    }),
  );
  return facts;
}

export async function runSignals(env: StepEnv): Promise<StepDraft> {
  const today = isoDay(env.now());
  const facts: Fact[] = [];
  const gaps: Gap[] = [];
  let sourcesOk = 0;
  const [courts, ted, news, social] = await Promise.all([
    env.sources.courts ? searchCourts(env) : Promise.resolve(null),
    env.sources.ted ? searchTed(env) : Promise.resolve(null),
    searchNews(env).catch(() => null),
    discoverSocial(env).catch(() => null),
  ]);
  const intel = intelFacts(news, social, today);
  facts.push(...intel.facts);
  gaps.push(...intel.gaps);
  if (courts) {
    sourcesOk++;
    facts.push(...courtFacts(courts.summary, today));
  } else {
    gaps.push(
      gap(
        "risk",
        bi("Court cases", "Dosare în instanță"),
        env.sources.courts
          ? bi("The court portal did not answer", "Portalul instanțelor nu a răspuns")
          : bi("Not checked in this run", "Neverificat în această rulare"),
        today,
        "https://portal.just.ro",
      ),
    );
  }
  if (ted) {
    sourcesOk++;
    facts.push(
      fact({
        id: "risk.ted.awards",
        section: "risk",
        predicate: "risk.ted.awards",
        value: { awards: ted.awards, buyers: ted.buyers, latest: ted.latest },
        display: ted.awards
          ? bi(
              `${ted.awards} EU tenders won${ted.buyers[0] ? ` (e.g. ${ted.buyers[0]})` : ""}`,
              `${ted.awards} licitații europene câștigate${ted.buyers[0] ? ` (de exemplu ${ted.buyers[0]})` : ""}`,
            )
          : bi("No EU tenders won", "Nicio licitație europeană câștigată"),
        source: "ted",
        asOf: today,
        confidence: "confirmat",
        method: "api",
        evidence: { url: "https://ted.europa.eu" },
      }),
    );
  } else {
    gaps.push(
      gap(
        "risk",
        bi("EU tenders", "Licitații europene"),
        env.sources.ted
          ? bi("TED did not answer", "TED nu a răspuns")
          : bi("Not checked in this run", "Neverificat în această rulare"),
        today,
        "https://ted.europa.eu",
      ),
    );
  }
  return {
    status:
      sourcesOk === 2
        ? "done"
        : sourcesOk
          ? "partial"
          : env.sources.courts || env.sources.ted
            ? "failed"
            : "skipped",
    facts,
    gaps,
    counters: {
      sourcesOk,
      courtQueries: courts?.queried ?? 0,
      subrequests: env.counters().subrequests,
    },
  };
}

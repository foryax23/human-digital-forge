/**
 * Golden set of deep research (plan D5): the 10 trial companies, one after
 * another, with the real politeness limits.
 *
 *   npx tsx scripts/deep/golden.ts --live [--only 3365133,1094992] [--out <dir>] [--ai --max-usd 4]
 *   npx tsx scripts/deep/golden.ts --replay [--only …] [--out <dir>] [--ai --max-usd 4]
 *
 * --live calls only ANAF (paced, ≤ 1 request/s) and the companies' own
 * websites (robots.txt first, VortexScan user agent, ≥ 1 s apart). Every
 * other host is refused by an allow-list: guessed namesake domains are never
 * fetched, courts and TED are switched off, PageSpeed is skipped. DNS goes to
 * the system resolver. No Anthropic call unless --ai is given and
 * ANTHROPIC_API_KEY is set. Step results (facts and gaps only, cursors
 * dropped) are written to <dir>/<cui>.json for --replay, which re-runs
 * synthesis and finish on them without touching the network.
 *
 * Each company is preceded by a scripted quick scan (its ANAF traffic only:
 * one v9 and one bilanț call, through the same isolate-wide ANAF clock, as the
 * quick scan does with plan B3's 1.1 s wait). The ANAF clock is never reset
 * between companies, and one ANAF log covers the whole session: the smallest
 * gap is asserted across companies and quick scans (plan D5, A3).
 *
 * Output: per company, step timings, ANAF calls and their smallest gap, site
 * requests (robots first, homepage count, smallest gap per host), pages read,
 * the expectations of scripts/deep/golden.json (pass / FAIL / n/a), a scan
 * for personal names; then the session's ANAF summary.
 */
import { promises as dnsPromises } from "node:dns";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ANAF_GAP_MS, createAnafClient } from "../../src/lib/deep/anaf-pacer.server";
import { sealResult } from "../../src/lib/deep/attest.server";
import type { ConsentRecord, DeepReport, StepResult } from "../../src/lib/deep/contracts";
import { readDeepConfig, type DnsResolver, type EnvAdapters } from "../../src/lib/deep/env.server";
import { createAnthropicTransport } from "../../src/lib/deep/llm/anthropic.server";
import { createMemoryStore } from "../../src/lib/deep/llm/ledger-memory.server";
import type { LlmClient } from "../../src/lib/deep/llm/types";
import { engineStep, type EngineDeps } from "../../src/lib/deep/steps/dispatch.server";
import { latestFiledYear } from "../../src/lib/deep/steps/money.server";
import { runPipeline, type StepTiming } from "../../src/lib/deep/steps/pipeline.server";
import { buildReportParts } from "../../src/lib/deep/report/index";
import { issueTicket, type TicketIdentity } from "../../src/lib/deep/ticket.server";
import { SCAN_USER_AGENT } from "../../src/lib/scan/legal/bot";
import { isPrivateAddress } from "../../src/lib/scan/net.server";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const OUT = path.resolve(option("out") ?? path.join(os.tmpdir(), "vortex-deep-golden"));
const ONLY = option("only")
  ?.split(",")
  .map((s) => s.trim());
const SECRET = "golden-local-secret-not-for-production";
const UID = "00000000-0000-4000-8000-00000000901d";
/** --rel client_furnizor runs the third-party variant (plan D5: Doriot Dent, Rost Construct). */
const REL =
  (["proprietar", "angajat", "client_furnizor", "concurent", "altceva"] as const).find(
    (r) => r === option("rel"),
  ) ?? "proprietar";

type Expect = {
  firm?: "new" | "established";
  turnover2025?: number;
  employees2025?: number;
  siteStatus?: string;
  siteStatusAny?: string[];
  siteProofAny?: string[];
  registryStatus?: string;
  crawlSkipped?: boolean;
  vocab?: string;
  lights?: Record<string, string>;
  peersMin?: { n: number; requires: string };
  tedAwards?: { n: number; requires: string };
  courtsFound?: { requires: string };
};
type Company = { cui: string; name: string; site?: string; expect: Expect; notes?: string };
const golden = JSON.parse(readFileSync(path.join(ROOT, "scripts/deep/golden.json"), "utf8")) as {
  allowHosts: string[];
  companies: Company[];
};

const consent: ConsentRecord = {
  version: "golden",
  lang: "ro",
  channel: "vortex-deep/start",
  recordedAt: new Date().toISOString(),
  notice: "golden run",
  reportBasis: "test",
  marketing: { granted: false, text: "", basis: "" },
};

/* ------------------------------------------------------------- network */

type Logged = {
  url: string;
  host: string;
  method: string;
  at: number;
  status?: number;
  error?: string;
  /** Which company and phase sent it (session log). */
  company?: string;
  phase?: "quick-scan" | "deep";
};

/** Every request of the session, in order (the ANAF spacing is asserted across companies). */
const sessionLog: Logged[] = [];

function allowedHost(host: string): boolean {
  const bare = host.toLowerCase().replace(/^www\./, "");
  return bare === "webservicesp.anaf.ro" || golden.allowHosts.includes(bare);
}

function loggingFetch(
  log: Logged[],
  tag: { company: string; phase: "quick-scan" | "deep" } = { company: "", phase: "deep" },
): EnvAdapters["rawFetch"] {
  return async (input, init) => {
    const url = new URL(input);
    const entry: Logged = {
      url: url.href,
      host: url.hostname,
      method: init?.method ?? "GET",
      at: Date.now(),
      ...tag,
    };
    log.push(entry);
    sessionLog.push(entry);
    if (!allowedHost(url.hostname)) {
      entry.error = "not on the golden allow-list";
      throw new Error(`golden: ${url.hostname} is not on the allow-list`);
    }
    try {
      const response = await fetch(input, init);
      entry.status = response.status;
      return response;
    } catch (error) {
      entry.error = String((error as Error)?.message ?? error);
      throw error;
    }
  };
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("dns timeout")), ms)),
  ]);

/** The system resolver (no DNS-over-HTTPS service is contacted in golden runs). */
const systemDns: DnsResolver = {
  async publicHost(host) {
    try {
      const addresses = await withTimeout(dnsPromises.resolve4(host), 3000);
      if (!addresses.length) return "nxdomain";
      return addresses.some(isPrivateAddress) ? "private" : "ok";
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      return /ENOTFOUND|ENODATA|NXDOMAIN/.test(code) ? "nxdomain" : "error";
    }
  },
  async records(name, type) {
    try {
      if (type === "A")
        return { status: "ok", data: await withTimeout(dnsPromises.resolve4(name), 3000) };
      if (type === "MX")
        return {
          status: "ok",
          data: (await withTimeout(dnsPromises.resolveMx(name), 3000)).map((m) => m.exchange),
        };
      return {
        status: "ok",
        data: (await withTimeout(dnsPromises.resolveTxt(name), 3000)).map((t) => t.join("")),
      };
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      return { status: /ENOTFOUND|ENODATA/.test(code) ? "nxdomain" : "error", data: [] };
    }
  },
};

async function readAsset(rel: string): Promise<string | null> {
  const file = path.join(ROOT, "public", rel);
  try {
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------- engine deps */

function llmFor(): LlmClient | null {
  if (!flag("ai") || !process.env.ANTHROPIC_API_KEY) return null;
  return {
    transport: createAnthropicTransport(process.env.ANTHROPIC_API_KEY),
    bindFetch: (counted) => createAnthropicTransport(process.env.ANTHROPIC_API_KEY!, counted),
    models: {
      synthesis: "claude-opus-5-5",
      extraction: "claude-haiku-4-5-20251001",
      effort: "low",
    },
  };
}

function engineDeps(
  log: Logged[],
  events: Array<Record<string, unknown>>,
  store: ReturnType<typeof createMemoryStore>,
  company = "",
): EngineDeps {
  const llm = llmFor();
  const config = readDeepConfig({
    DEEP_RESEARCH_MODE: "admin",
    DEEP_RESEARCH_ADMIN_USER_IDS: UID,
    DEEP_SOURCE_COURTS: "off",
    DEEP_SOURCE_TED: "off",
    DEEP_RUN_BUDGET_USD: option("max-usd")
      ? String(Math.min(1.5, Number(option("max-usd"))))
      : "1.5",
    DEEP_DAILY_BUDGET_USD: option("max-usd") ?? "4",
    // The golden run uses the memory ledger on purpose (one process, one isolate).
    ...(llm
      ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, DEEP_MEMORY_LEDGER_AI: "on" }
      : {}),
  });
  return {
    secret: SECRET,
    config,
    adapters: {
      rawFetch: loggingFetch(log, { company, phase: "deep" }),
      dns: systemDns,
      readAsset,
      hostAllowed: allowedHost,
      pagespeed: async () => null,
      log: (event) => events.push({ at: Date.now(), ...event }),
    },
    storeFor: () => store,
    llmFor: () => llm,
    reportBuilder: buildReportParts,
  };
}

/* ------------------------------------------------------------- checks */

const FIRST_NAMES =
  /\b(Ion|Ioan|Maria|Andrei|Elena|Mihai|Ana|Alexandru|Ioana|Gheorghe|Vasile|Dan|Cristina|Mihaela|Radu|Florin|Adrian|Daniel|George|Gabriel|Ionuț|Alina|Andreea|Constantin|Nicolae|Marius|Bogdan|Cătălin|Laura|Diana|Oana|Roxana|Dragoș|Paul|Petru|Monica|Simona|Carmen|Lucian|Sorin|Ciprian|Cosmin|Vlad|Raluca|Irina|Anca|Liviu|Ovidiu|Sergiu|Iulia|Gelu|Tudor)\s+\p{Lu}\p{Ll}+/u;

/** Street names after people ("Str. Dr. Ioan Rațiu") are addresses, not personal data. */
const STREET_BEFORE =
  /(str|strada|bd|b-dul|bulevardul|calea|pia[țt]a|p-[țt]a|aleea|[șs]os|[șs]oseaua|splaiul|dr|prof|ing|gen|mr)\.?\s*$/i;

function personalNameHits(report: DeepReport): string[] {
  const hits: string[] = [];
  for (const f of report.facts) {
    if (f.predicate === "identity.seat" || f.predicate === "identity.name") continue;
    const text = [f.display.ro, f.display.en, f.evidence?.quote].filter(Boolean).join(" | ");
    for (const m of text.matchAll(new RegExp(FIRST_NAMES.source, "gu"))) {
      if (STREET_BEFORE.test(text.slice(Math.max(0, (m.index ?? 0) - 14), m.index))) continue;
      hits.push(`${f.id}: «${m[0]}»`);
    }
  }
  return hits;
}

type Check = { name: string; result: "pass" | "FAIL" | "n/a"; detail?: string };

function checkExpectations(
  company: Company,
  report: DeepReport | undefined,
  timings: StepTiming[],
): Check[] {
  const out: Check[] = [];
  const e = company.expect;
  if (!report) return [{ name: "report", result: "FAIL", detail: "no report" }];
  const fact = (id: string) => report.facts.find((f) => f.id === id);
  const eq = (name: string, actual: unknown, expected: unknown) =>
    out.push({
      name,
      result: actual === expected ? "pass" : "FAIL",
      detail:
        actual === expected
          ? undefined
          : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    });
  out.push({
    name: "identity",
    result: fact("identity.name") && fact("identity.status") ? "pass" : "FAIL",
  });
  if (e.firm) eq("firm", report.firm, e.firm);
  if (e.turnover2025 !== undefined)
    eq("turnover 2025", fact("money.turnover.2025")?.value, e.turnover2025);
  if (e.employees2025 !== undefined)
    eq("employees 2025", fact("people.employees.2025")?.value, e.employees2025);
  if (e.siteStatus) eq("website status", fact("site.status")?.value, e.siteStatus);
  if (e.siteStatusAny) {
    const status = fact("site.status")?.value as string | undefined;
    out.push({
      name: "website status",
      result: status && e.siteStatusAny.includes(status) ? "pass" : "FAIL",
      detail: `status ${status ?? "none"}`,
    });
  }
  if (e.siteProofAny) {
    const proof = fact("site.proof")?.value as string | undefined;
    out.push({
      name: "website proof",
      result: proof && e.siteProofAny.includes(proof) ? "pass" : "FAIL",
      detail: `proof ${proof ?? "none"}`,
    });
  }
  if (e.registryStatus) {
    const reg =
      (fact("identity.website_registry.status")?.value as { status?: string } | undefined)
        ?.status ?? (fact("identity.website_registry") ? fact("site.status")?.value : undefined);
    eq("registry website status", reg, e.registryStatus);
  }
  if (e.crawlSkipped) {
    const crawled =
      timings.some((t) => t.step === "crawl") ||
      (fact("site.pages_read")?.value as number | undefined);
    out.push({ name: "crawl skipped", result: crawled ? "FAIL" : "pass" });
  }
  if (e.vocab) eq("sector vocabulary", report.vocab, e.vocab);
  for (const [area, state] of Object.entries(e.lights ?? {})) {
    eq(`line ${area}`, report.lights.find((l) => l.area === area)?.state, state);
  }
  if (e.peersMin) {
    const n = fact("peers.n")?.value as number | undefined;
    out.push(
      n === undefined
        ? { name: "peers ≥ 5", result: "n/a", detail: "needs the MF shard (download not approved)" }
        : { name: "peers ≥ 5", result: n >= e.peersMin.n ? "pass" : "FAIL", detail: `n=${n}` },
    );
  }
  if (e.tedAwards)
    out.push({ name: "TED awards", result: "n/a", detail: "TED off in golden live runs" });
  if (e.courtsFound)
    out.push({ name: "court cases", result: "n/a", detail: "courts off in golden live runs" });
  const hits = personalNameHits(report);
  out.push({
    name: "no personal names",
    result: hits.length ? "FAIL" : "pass",
    detail: hits.join("; ") || undefined,
  });
  const phone = report.facts.find((f) => /^site\.phone/.test(f.id) && typeof f.value === "string");
  out.push({ name: "no ANAF phone", result: phone ? "FAIL" : "pass" });
  return out;
}

function networkStats(log: Logged[], company: Company) {
  const anaf = log.filter((l) => l.host === "webservicesp.anaf.ro");
  const gaps = anaf.slice(1).map((l, i) => l.at - anaf[i].at);
  const site = log.filter(
    (l) => l.host !== "webservicesp.anaf.ro" && !l.error?.includes("allow-list"),
  );
  const byHost = new Map<string, Logged[]>();
  for (const l of site) byHost.set(l.host, [...(byHost.get(l.host) ?? []), l]);
  const hosts = [...byHost.entries()].map(([host, list]) => {
    const g = list.slice(1).map((l, i) => l.at - list[i].at);
    return {
      host,
      requests: list.length,
      robotsFirst: list[0]?.url.endsWith("/robots.txt") ?? false,
      minGapMs: g.length ? Math.min(...g) : null,
      homepage: list.filter((l) => new URL(l.url).pathname === "/" && l.method === "GET").length,
    };
  });
  return {
    anafCalls: anaf.length,
    anafMinGapMs: gaps.length ? Math.min(...gaps) : null,
    anafTimeline: anaf.map(
      (l) =>
        `${l.at - (anaf[0]?.at ?? 0)}ms ${new URL(l.url).pathname.split("/").pop()}${new URL(l.url).search} ${l.status ?? l.error ?? ""}`,
    ),
    refusedByAllowList: log.filter((l) => l.error?.includes("allow-list")).map((l) => l.host),
    hosts,
    company: company.cui,
  };
}

/* --------------------------------------------------------------- runs */

const strip = (r: StepResult): StepResult => ({
  ...r,
  next: r.next ? { ...r.next, crawlCursor: undefined } : undefined,
});

/**
 * The quick scan's ANAF traffic just before the deep run: one v9 call and one bilanț call
 * (plan B3: 1.1 s apart), through the isolate-wide ANAF clock the deep run also uses.
 */
async function quickScan(company: Company): Promise<number> {
  const log: Logged[] = [];
  const anaf = createAnafClient({
    fetch: loggingFetch(log, { company: company.cui, phase: "quick-scan" }),
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    startAt: Date.now(),
    quota: 2,
    deadline: Date.now() + 25_000,
    userAgent: SCAN_USER_AGENT,
  });
  await anaf.v9([company.cui]).catch(() => null);
  await anaf.bilant(company.cui, latestFiledYear(Date.now())).catch(() => null);
  return log.length;
}

async function live(company: Company) {
  // No clock reset: the isolate-wide ANAF clock carries the spacing from the previous
  // company and from the quick scan into this run.
  const quickScanCalls = await quickScan(company);
  const log: Logged[] = [];
  const events: Array<Record<string, unknown>> = [];
  const store = createMemoryStore();
  const deps = engineDeps(log, events, store, company.cui);
  const started = Date.now();
  const run = await runPipeline({
    deps,
    uid: UID,
    via: "admin",
    store,
    storeKind: "memory",
    input: {
      cui: company.cui,
      site: company.site,
      relationship: REL,
      lang: "ro",
      consent: { termsVersion: "golden", marketing: false },
    },
    consent,
    answerSite: () => null,
  });
  const report = run.report;
  const checks = checkExpectations(company, report, run.timings);
  const net = networkStats(log, company);
  const identity = run.results.find((r) => r.step === "start");
  const record = {
    cui: company.cui,
    name: company.name,
    wallMs: Date.now() - started,
    quickScanAnafCalls: quickScanCalls,
    refused: run.refused,
    timings: run.timings,
    network: net,
    checks,
    report: report
      ? {
          aiMode: report.aiMode,
          firm: report.firm,
          vocab: report.vocab,
          lights: report.lights.map((l) => `${l.area}:${l.state} (${l.reason.ro})`),
          headline: report.brief.headline.sentences.map((s) => s.text).join(" "),
          facts: report.facts.length,
          gaps: report.gaps.map((g) => `${g.section}: ${g.what.ro} — ${g.where.ro}`),
          counts: report.counts,
          verifyCode: report.verifyCode,
          costUsd: report.costUsd,
          brief: report.brief,
        }
      : undefined,
    ticketIdentity: identity ? (identityFromStart(identity) satisfies TicketIdentity) : undefined,
    results: run.results.filter((r) => r.step !== "synthesis").map(strip),
    events: events
      .filter((e) => e.paid || e.synthesis || e.audit || e.site || e.money)
      .slice(0, 80),
  };
  writeFileSync(path.join(OUT, `${company.cui}.json`), JSON.stringify(record, null, 1));
  return record;
}

function identityFromStart(start: StepResult): TicketIdentity {
  const v = (id: string) => start.facts.find((f) => f.id === id)?.value as never;
  const seat = (v("identity.seat") ?? {}) as { city?: string; county?: string };
  return {
    name: v("identity.name") ?? "",
    displayName: start.facts.find((f) => f.id === "identity.name")?.display.ro ?? "",
    regNo: (v("identity.reg_no") as { canonical?: string } | undefined)?.canonical,
    caen3: (v("identity.caen") as { code?: string } | undefined)?.code,
    city: seat.city,
    county: seat.county,
    registrySite: v("identity.website_registry"),
    registeredAt: v("identity.registered_at"),
  };
}

async function replay(company: Company) {
  const file = path.join(OUT, `${company.cui}.json`);
  if (!existsSync(file))
    return { cui: company.cui, name: company.name, skipped: "no recording (run --live first)" };
  const recorded = JSON.parse(readFileSync(file, "utf8")) as {
    results: StepResult[];
    ticketIdentity: TicketIdentity;
  };
  const store = createMemoryStore();
  const log: Logged[] = [];
  const deps = engineDeps(log, [], store);
  const startedRun = await store.startRun({
    userId: UID,
    cui: company.cui,
    relationship: REL,
    lang: "ro",
    via: "admin",
    budgetUsd: deps.config.runBudgetUsd,
    aiMode: deps.llmFor(deps.config) ? "ai" : "rules",
    consent,
    userCap: 20,
    globalCap: 10,
    allowSameCompany: true,
  });
  if (!("runId" in startedRun)) return { cui: company.cui, skipped: startedRun.reason };
  const runId = startedRun.runId;
  // Recorded results belong to the recorded run: re-attest them for this replay run.
  const results = await Promise.all(
    recorded.results.map(({ att: _a, ...r }) => sealResult(SECRET, UID, { ...r, runId })),
  );
  const ticket = await issueTicket(SECRET, {
    runId,
    uid: UID,
    cui: company.cui,
    via: "admin",
    store: "memory",
    budgetUsd: deps.config.runBudgetUsd,
    lang: "ro",
    rel: REL,
    ai: deps.llmFor(deps.config) ? "ai" : "rules",
    idn: recorded.ticketIdentity,
    anafAt: Date.now(),
  });
  const synth: StepResult[] = [];
  const warm = await engineStep(deps, {
    uid: UID,
    input: { ticket, step: "synthesis", part: "warm", results },
  });
  // The sections get the warm-up result too (it decides their cache pricing).
  const sectionResults = warm.kind === "step" ? [...results, warm.result] : results;
  for (const part of ["brief", "customer", "rivals"] as const) {
    const out = await engineStep(deps, {
      uid: UID,
      input: { ticket, step: "synthesis", part, results: sectionResults },
    });
    if (out.kind === "step") synth.push(out.result);
  }
  const done = await engineStep(deps, {
    uid: UID,
    input: { ticket, step: "finish", results: [...results, ...synth] },
  });
  const report = done.kind === "report" ? done.report : undefined;
  const spend = await store.runSpend!(runId);
  return {
    cui: company.cui,
    name: company.name,
    aiMode: report?.aiMode,
    cut: report?.brief.cut,
    headline: report?.brief.headline.sentences.map((s) => s.text).join(" "),
    costUsd: spend ? spend.spentUsd + spend.reservedUsd : 0,
    network: log.length,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const companies = golden.companies.filter((c) => !ONLY || ONLY.includes(c.cui));
  if (flag("replay")) {
    for (const company of companies) console.log(JSON.stringify(await replay(company)));
    return;
  }
  if (!flag("live")) {
    console.error(
      "Usage: npx tsx scripts/deep/golden.ts --live | --replay [--only cui,cui] [--out dir] [--ai --max-usd 4]",
    );
    process.exit(1);
  }
  // A previous session (another --only batch) may have called ANAF a moment ago.
  await new Promise((r) => setTimeout(r, ANAF_GAP_MS + 100));
  for (const company of companies) {
    const record = await live(company);
    const failed = record.checks.filter((c) => c.result === "FAIL");
    const steps = record.timings
      .map((t) => `${t.step}${t.part ? `:${t.part}` : ""}=${t.ms}ms`)
      .join(" ");
    console.log(
      `\n${company.cui} ${company.name}: ${record.refused ? `REFUSED ${record.refused}` : "report"} in ${(record.wallMs / 1000).toFixed(1)} s · quick scan ANAF ${record.quickScanAnafCalls} · deep ANAF ${record.network.anafCalls} calls, min gap ${record.network.anafMinGapMs ?? "-"} ms`,
    );
    console.log(`  steps: ${steps}`);
    for (const h of record.network.hosts) {
      console.log(
        `  ${h.host}: ${h.requests} requests, robots first ${h.robotsFirst}, homepage ×${h.homepage}, min gap ${h.minGapMs ?? "-"} ms`,
      );
    }
    if (record.network.refusedByAllowList.length)
      console.log(
        `  not fetched (allow-list): ${[...new Set(record.network.refusedByAllowList)].join(", ")}`,
      );
    console.log(`  lines: ${record.report?.lights.join(" | ")}`);
    console.log(
      `  checks: ${record.checks.map((c) => `${c.name}=${c.result}${c.detail ? ` (${c.detail})` : ""}`).join("; ")}`,
    );
    if (failed.length) console.log(`  FAILED: ${failed.map((f) => f.name).join(", ")}`);
  }
  // The whole session: every ANAF call (quick scans and deep runs, all companies) in time order.
  const anaf = sessionLog
    .filter((l) => l.host === "webservicesp.anaf.ro")
    .sort((a, b) => a.at - b.at);
  const gaps = anaf.slice(1).map((l, i) => ({ ms: l.at - anaf[i].at, from: anaf[i], to: l }));
  const smallest = gaps.reduce<(typeof gaps)[number] | null>(
    (min, g) => (!min || g.ms < min.ms ? g : min),
    null,
  );
  const session = {
    anafCalls: anaf.length,
    quickScanCalls: anaf.filter((l) => l.phase === "quick-scan").length,
    deepCalls: anaf.filter((l) => l.phase === "deep").length,
    minGapMs: smallest?.ms ?? null,
    minGapBetween: smallest
      ? `${smallest.from.company}/${smallest.from.phase} → ${smallest.to.company}/${smallest.to.phase}`
      : null,
    under1100: gaps.filter((g) => g.ms < 1100).length,
  };
  writeFileSync(path.join(OUT, "_session.json"), JSON.stringify(session, null, 1));
  console.log(
    `\nSession ANAF: ${session.anafCalls} calls (quick scans ${session.quickScanCalls}, deep ${session.deepCalls}); smallest gap across the whole session ${session.minGapMs ?? "-"} ms (${session.minGapBetween ?? "-"}); gaps under 1.1 s: ${session.under1100} ${session.under1100 ? "FAIL" : "pass"}`,
  );
  console.log(`Recordings in ${OUT}`);
  if (session.under1100) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

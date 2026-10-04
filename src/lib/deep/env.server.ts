import process from "node:process";

import { CHECK_COUNT, runChecks } from "@/lib/scan/audit/checks";
import { extractPage } from "@/lib/scan/audit/extract";
import { buildSignals } from "@/lib/scan/audit/signals";
import { detectTechnologies } from "@/lib/scan/audit/technologies";
import type { AuditContext, SitemapInfo } from "@/lib/scan/audit/model";
import { runPageSpeed } from "@/lib/scan/audit/pagespeed.server";
import { configureScanIndex, findCompanyByCui } from "@/lib/scan/company-search";
import { SCAN_USER_AGENT } from "@/lib/scan/legal/bot";
import { isPrivateAddress, urlBlockReason } from "@/lib/scan/net.server";

import { createAnafClient, type AnafClient } from "./anaf-pacer.server";
import {
  hkdfSecret,
  openCursor,
  safeEqual,
  sealCursor,
  sha256Hex,
  type CursorPurpose,
} from "./attest.server";
import type {
  AccessVia,
  AdminBy,
  Bilingual,
  DeepAccess,
  DeepMode,
  Lang,
  Relationship,
  StepName,
  StoreKind,
} from "./contracts";
import caenLabels from "./data/caen-labels.json";
import caenMap from "./data/caen-rev3-rev2.json";
import wages from "./data/wages.json";
import type { PaidLedger } from "./llm/paid.server";
import { PRICES } from "./llm/prices";
import type { LlmClient } from "./llm/types";
import { robotsFromResponse } from "./parse/robots";
import { createPoliteFetcher, type PoliteFetcher } from "./steps/polite.server";
import type { TicketIdentity } from "./ticket.server";

/*
 * Environment of deep research: the configuration (read per request, never at
 * module scope: Workers bind env at request time, src/lib/config.server.ts),
 * the provisional access check, and the StepEnv every step receives. Steps
 * import only types from here; everything that touches the app
 * (src/lib/scan/** adapters, process.env, Supabase) stays in this file and in
 * deep.functions.ts, so steps can move to Cloudflare Workflows unchanged.
 */

/* ----------------------------------------------------------------- config */

export type DeepConfig = {
  mode: DeepMode;
  /** An unknown DEEP_RESEARCH_MODE value, treated as admin and shown in the admin panel. */
  unknownMode?: string;
  adminUserIds: string[];
  adminEmails: string[];
  testCodeHashes: string[];
  premiumTiers: string[];
  freeRunsPerUser: number;
  entryPublic: boolean;
  userDailyCap: number;
  adminDailyCap: number;
  dailyRunCap: number;
  runBudgetUsd: number;
  dayBudgetUsd: number;
  synthesisModel: string;
  synthesisEffort: "low" | "medium";
  extractModel: string;
  sourceCourts: boolean;
  sourceTed: boolean;
  googleDisplay: boolean;
  /**
   * DEEP_MEMORY_LEDGER_AI=on: paid calls are allowed while runs live in the in-memory
   * ledger (its day and run caps hold per Worker isolate only). Off by default: such runs
   * are rules-only. Tests and the golden script use the memory ledger directly.
   */
  memoryLedgerAi: boolean;
  /** An unknown DEEP_EXTRACT_MODEL value (ignored; the default is used), for the admin panel. */
  unknownExtractModel?: string;
  /** DEEP_ASSET_ORIGIN: where the server reads its own data files (index, shards). */
  assetOrigin?: string;
  anthropicKey?: string;
  /** DEEP_RUN_SECRET, or the HKDF fallback material (first test only). */
  runSecret?: string;
  secretFallbackMaterial?: string;
};

const MODES: DeepMode[] = ["disabled", "admin", "code", "open", "premium"];
const list = (v?: string) =>
  (v ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
};
const flag = (v: string | undefined, fallback: boolean) =>
  v === undefined || v === "" ? fallback : /^(on|true|1|yes)$/i.test(v.trim());

/** Reads every deep-research variable from `source` (process.env by default) inside the handler. */
export function readDeepConfig(
  source: Record<string, string | undefined> = process.env,
): DeepConfig {
  const raw = (source.DEEP_RESEARCH_MODE ?? "").trim().toLowerCase();
  const known = MODES.includes(raw as DeepMode);
  const synthesis = source.DEEP_SYNTHESIS_MODEL?.trim();
  // Only models with a price in the table: an unknown id would be billed at a guessed rate.
  const extract = source.DEEP_EXTRACT_MODEL?.trim();
  const extractKnown = Boolean(extract && PRICES[extract]);
  const assetOrigin = source.DEEP_ASSET_ORIGIN?.trim();
  return {
    // Unset or unknown: admins only (the owner's decision until plans assigned by an admin
    // exist). An unknown value is also shown in the admin panel.
    mode: known ? (raw as DeepMode) : "admin",
    unknownMode: raw && !known ? raw : undefined,
    adminUserIds: list(source.DEEP_RESEARCH_ADMIN_USER_IDS).map((s) => s.toLowerCase()),
    adminEmails: list(source.DEEP_RESEARCH_ADMIN_EMAILS).map((s) => s.toLowerCase()),
    testCodeHashes: list(source.DEEP_RESEARCH_TEST_CODES).map((s) => s.toLowerCase()),
    // The plan IDs that include deep research (client plans and subscription tiers). Every plan
    // includes reports since the 2026-10-04 plans (src/lib/client-plans.ts has the quotas); a
    // value set before ("growth,pro") still works and leaves Starter out.
    premiumTiers: list(source.DEEP_RESEARCH_PREMIUM_TIERS || "starter,growth,pro").map((s) =>
      s.toLowerCase(),
    ),
    // No free runs unless set: plans are assigned by an admin after a contract (owner, 2026-10-04).
    freeRunsPerUser: num(source.DEEP_FREE_RUNS_PER_USER, 0),
    entryPublic: flag(source.DEEP_ENTRY_PUBLIC, false),
    userDailyCap: num(source.DEEP_USER_DAILY_RUN_CAP, 3),
    adminDailyCap: 20,
    dailyRunCap: num(source.DEEP_DAILY_RUN_CAP, 10),
    runBudgetUsd: Math.min(10, num(source.DEEP_RUN_BUDGET_USD, 1.5)),
    dayBudgetUsd: num(source.DEEP_DAILY_BUDGET_USD, 15),
    synthesisModel: synthesis === "claude-sonnet-5-5" ? "claude-sonnet-5-5" : "claude-opus-5-5",
    synthesisEffort: source.DEEP_SYNTHESIS_EFFORT?.trim() === "medium" ? "medium" : "low",
    extractModel: extractKnown ? extract! : "claude-haiku-4-5-20251001",
    unknownExtractModel: extract && !extractKnown ? extract : undefined,
    memoryLedgerAi: flag(source.DEEP_MEMORY_LEDGER_AI, false),
    assetOrigin:
      assetOrigin && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(assetOrigin) ? assetOrigin : undefined,
    sourceCourts: flag(source.DEEP_SOURCE_COURTS, true),
    sourceTed: flag(source.DEEP_SOURCE_TED, true),
    googleDisplay: flag(source.DEEP_GOOGLE_DISPLAY, Boolean(source.GOOGLE_PLACES_API_KEY)),
    anthropicKey: source.ANTHROPIC_API_KEY?.trim() || undefined,
    runSecret: source.DEEP_RUN_SECRET?.trim() || undefined,
    secretFallbackMaterial: source.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined,
  };
}

/**
 * The HMAC key for tickets, attestations, cursors and report codes:
 * DEEP_RUN_SECRET, or an HKDF of the service-role key for the first test only
 * (rotating that key would invalidate verification codes). Null: refuse runs.
 */
export async function resolveRunSecret(config: DeepConfig): Promise<string | null> {
  if (config.runSecret && config.runSecret.length >= 16) return config.runSecret;
  if (config.secretFallbackMaterial)
    return hkdfSecret(config.secretFallbackMaterial, "vortex-deep-v1");
  return null;
}

/* --------------------------------------------------------- provisional access */

/**
 * The access table of plan A4 without the parts that need Supabase reads
 * (premium subscriptions, confirmed Google identity for admin e-mails, free
 * runs). Eng 3's checkDeepAccess() in access.server.ts replaces it; until then
 * premium mode admits only admins and test-code holders (fail closed).
 */
export async function provisionalAccess(
  config: DeepConfig,
  args: {
    userId: string | null;
    testCode?: string;
    /** A plan listed in DEEP_RESEARCH_PREMIUM_TIERS with a report left (access.server.ts decides). */
    premium?: boolean;
    persistence: StoreKind | "memory" | "unavailable";
    todayUsd?: number;
    userRunsToday?: number;
  },
): Promise<DeepAccess> {
  const isAdmin = Boolean(args.userId && config.adminUserIds.includes(args.userId.toLowerCase()));
  const codeOk = args.testCode ? await testCodeValid(config, args.testCode) : false;
  const cap = isAdmin ? config.adminDailyCap : config.userDailyCap;
  const base: DeepAccess = {
    mode: config.mode,
    allowed: false,
    ai: Boolean(config.anthropicKey) && (args.todayUsd ?? 0) < config.dayBudgetUsd,
    runsLeftToday: Math.max(0, cap - (args.userRunsToday ?? 0)),
    persistence:
      args.persistence === "memory"
        ? "unavailable"
        : (args.persistence as StoreKind | "unavailable"),
    budgetUsd: config.runBudgetUsd,
    entryVisible: false,
  };
  if (isAdmin) {
    base.admin = {
      todayUsd: args.todayUsd ?? 0,
      dayCapUsd: config.dayBudgetUsd,
      unknownMode: config.unknownMode,
    };
  }
  const allow = (via: DeepAccess["via"]): DeepAccess => ({
    ...base,
    allowed: true,
    via,
    entryVisible: true,
  });
  const deny = (reason: DeepAccess["reason"], publicEntry = false): DeepAccess => ({
    ...base,
    reason,
    entryVisible: publicEntry && config.entryPublic,
  });
  if (config.mode === "disabled") return deny("mode_disabled");
  if (!args.userId) return deny("login_required", true);
  if (isAdmin) return allow("admin");
  switch (config.mode) {
    case "admin":
      return deny("admin_only");
    case "code":
      return codeOk ? allow("code") : deny("code_required", true);
    case "open":
      return allow("open");
    case "premium":
      if (args.premium) return allow("premium");
      return codeOk ? allow("code") : deny("premium_required");
    default:
      return deny("admin_only");
  }
}

/** DEEP_RESEARCH_TEST_CODES holds SHA-256 hashes; compared in constant time. */
export async function testCodeValid(config: DeepConfig, code: string): Promise<boolean> {
  const hash = await sha256Hex(code.trim());
  let ok = false;
  for (const candidate of config.testCodeHashes) ok = safeEqual(candidate, hash) || ok;
  return ok;
}

/**
 * Whether a ticket issued "via" one access path is still admitted now (checked on every
 * step and on resume, no I/O): a removed admin, or a mode switched back (code or open →
 * admin), takes effect at the next step instead of when the 2-hour ticket expires.
 */
export function ticketAdmitted(
  config: DeepConfig,
  via: AccessVia,
  uid: string,
  adminBy?: AdminBy,
): boolean {
  if (config.mode === "disabled") return false;
  const isAdmin = config.adminUserIds.includes(uid.toLowerCase());
  // An admin ticket needs an admin in the config (env IDs, plus the role admins configForUser
  // adds per request): removing the ID or the role stops the run at its next step. Only a
  // ticket admitted by e-mail (a confirmed address with its Google identity, checked by
  // checkDeepAccess at start and resume) is kept while admin e-mails are configured: this
  // check makes no I/O, and emptying DEEP_RESEARCH_ADMIN_EMAILS revokes it at the next step.
  if (via === "admin") return isAdmin || (adminBy === "email" && config.adminEmails.length > 0);
  if (isAdmin) return true;
  // Admin-granted deep checks: the check was spent at start, so the run continues in any mode.
  if (via === "premium" || via === "free") return true;
  switch (config.mode) {
    case "code":
      // Premium subscribers are admitted in code mode too (A4).
      return via === "code";
    case "open":
      return via === "code" || via === "open";
    case "premium":
      // "free": the account's free Premium report (D24), admitted for the run it started.
      return via === "code";
    default:
      return false;
  }
}

/** Hosts the app is served from: the request origin is trusted for data files only on these. */
const APP_HOSTS = new Set([
  "vortexhub.dev",
  "www.vortexhub.dev",
  "human-digital-forge.lovable.app",
]);
const DEFAULT_ASSET_ORIGIN = "https://vortexhub.dev";

/**
 * The origin the server reads its own data files from (company index, MF shards):
 * DEEP_ASSET_ORIGIN, else the request origin when it is one of the app's own hosts
 * (or localhost outside production), else the live site. Never a Host header the
 * caller chose: planted data would end up in a report with a verification code.
 */
export function deepAssetOrigin(
  config: Pick<DeepConfig, "assetOrigin">,
  requestUrl?: string,
  nodeEnv = process.env.NODE_ENV,
): string {
  if (config.assetOrigin) return config.assetOrigin;
  try {
    const url = requestUrl ? new URL(requestUrl) : null;
    if (url && url.protocol === "https:" && APP_HOSTS.has(url.hostname)) return url.origin;
    if (
      url &&
      nodeEnv !== "production" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    )
      return url.origin;
  } catch {
    // fall through
  }
  return DEFAULT_ASSET_ORIGIN;
}

/* ---------------------------------------------------------------- StepEnv */

export type IndexCompany = {
  cui: string;
  name: string;
  county?: string;
  city?: string;
  website?: string;
  status?: string;
};

export type AuditPageInput = { url: string; status: number; html: string };
export type AuditSiteInput = {
  requestedUrl: string;
  cui: string;
  name: string;
  home: AuditPageInput & {
    headers: Record<string, string>;
    ttfbMs: number;
    redirects: string[];
    tlsFailed?: boolean;
  };
  pages: AuditPageInput[];
  brokenPages: Array<{ url: string; status: number }>;
  robots: { status?: number; body?: string };
  sitemap: { found: boolean; url?: string; urlCount?: number; partial?: boolean };
  faviconFound: boolean;
};
export type AuditFindingLite = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: Bilingual;
  evidence?: string;
};
export type AuditSiteResult = {
  checksRun: number;
  findings: AuditFindingLite[];
  technologies: Array<{ name: string; category: string }>;
  clientRendered: boolean;
  hasCookieConsent: boolean;
  hasAnalytics: boolean;
};

export type PageSpeedSummary = {
  performance: number;
  lcpMs?: number;
  clsScore?: number;
  strategy: "mobile";
};

export type Wages = typeof wages;
export type CaenLabels = { divisions: Record<string, Bilingual>; rev3: Record<string, string> };

export type DnsResolver = {
  /** A/AAAA reachability for the SSRF policy. */
  publicHost(host: string): Promise<"ok" | "nxdomain" | "private" | "error">;
  /** TXT/MX/A records (site step: MX, SPF, DMARC, guessed domains). */
  records(
    name: string,
    type: "A" | "MX" | "TXT",
  ): Promise<{ status: "ok" | "nxdomain" | "error"; data: string[] }>;
};

export type StepEnv = {
  runId: string;
  uid: string;
  cui: string;
  lang: Lang;
  relationship: Relationship;
  step: StepName;
  /** Absolute wall-time deadline of this step (ms epoch). */
  deadline: number;
  identity: TicketIdentity;
  /** Counted fetch: every subrequest counts; throws "subrequest_budget" past the limit. */
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  polite: PoliteFetcher;
  dns: DnsResolver;
  anaf: AnafClient;
  index: { byCui(cui: string): Promise<IndexCompany | null> };
  shards: {
    fin(caen4: string, countyCode?: string): Promise<string | null>;
    benchNational: unknown | null;
  };
  data: { wages: Wages; caenRev3ToRev2: Record<string, string[]>; caenLabels: CaenLabels };
  auditSite(input: AuditSiteInput): Promise<AuditSiteResult | null>;
  pagespeed(url: string): Promise<PageSpeedSummary | null>;
  sources: { courts: boolean; ted: boolean; pagespeed: boolean };
  llm: LlmClient | null;
  ledger: PaidLedger;
  /** Seals a cursor for this run and user; `purpose` is authenticated (a crawl cursor never opens as a site snapshot). */
  seal(state: unknown, purpose: CursorPurpose): Promise<string>;
  unseal<T>(token: string, purpose: CursorPurpose): Promise<T | null>;
  now(): number;
  sleep(ms: number): Promise<void>;
  log(event: Record<string, unknown>): void;
  counters(): { subrequests: number; anafCalls: number; politeRequests: number };
};

/** Step wall-time budgets (plan A5): 25 s, aborted at 28 s; pagespeed and synthesis sections 50 s. */
export const STEP_BUDGET_MS = 25_000;
export const STEP_HARD_MS = 28_000;
export const EXEMPT_BUDGET_MS = 50_000;
export const SUBREQUEST_LIMIT = 40;
export const PARALLEL_FETCHES = 4;
/**
 * Ledger requests (step claims, reservations and settles, compare-and-swap retries: about 8
 * to 14 in a step that makes paid calls) go through supabase-js with the global fetch, so the
 * counter never sees them. The steps that fetch many pages AND call Claude (audit, crawl)
 * keep this many subrequests free for the ledger, so a step stays under the Worker's 50.
 */
export const LEDGER_ALLOWANCE = 12;

/** Counted fetches a step may make (site, ANAF, DNS and asset requests). */
export function siteFetchLimit(step: StepName): number {
  return step === "audit" || step === "crawl"
    ? SUBREQUEST_LIMIT - LEDGER_ALLOWANCE
    : SUBREQUEST_LIMIT;
}

export function stepBudgetMs(step: StepName, part?: string): number {
  if (step === "pagespeed") return EXEMPT_BUDGET_MS;
  if (step === "synthesis" && part && part !== "warm") return EXEMPT_BUDGET_MS;
  return STEP_BUDGET_MS;
}

/** Adapters the environment is built from: the Worker provides one set, Node scripts and tests another. */
export type EnvAdapters = {
  rawFetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** Optional: replaces the DNS-over-HTTPS resolver (Node scripts use the system resolver). */
  dns?: DnsResolver;
  /** Origin the app serves its static assets from (shards, company index). */
  assetOrigin?: string;
  /** Optional: reads a static asset by path (Node scripts read public/ from disk). */
  readAsset?: (path: string) => Promise<string | null>;
  hostAllowed?: (host: string) => boolean;
  log?: (event: Record<string, unknown>) => void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Overrides for tests: no live audit or PageSpeed. */
  auditSite?: StepEnv["auditSite"];
  pagespeed?: StepEnv["pagespeed"];
};

export type EnvInput = {
  runId: string;
  uid: string;
  cui: string;
  lang: Lang;
  relationship: Relationship;
  step: StepName;
  part?: string;
  identity: TicketIdentity;
  secret: string;
  config: DeepConfig;
  llm: LlmClient | null;
  ledger: PaidLedger;
  /** Earliest next ANAF start (attested or from the ticket). */
  anafStartAt: number;
  anafQuota: number;
  startedAt: number;
};

/** A counted fetch with at most PARALLEL_FETCHES in flight and a hard subrequest stop. */
export function countedFetch(raw: EnvAdapters["rawFetch"], limit = SUBREQUEST_LIMIT) {
  let count = 0;
  let active = 0;
  const queue: Array<() => void> = [];
  const release = () => {
    active--;
    queue.shift()?.();
  };
  const fetch = async (input: string, init?: RequestInit) => {
    if (count >= limit) throw new Error("subrequest_budget");
    count++;
    if (active >= PARALLEL_FETCHES) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await raw(input, init);
    } finally {
      release();
    }
  };
  /** Counts requests made outside this fetch (the shared company index) towards the budget. */
  const charge = (n: number) => {
    if (n > 0) count += n;
  };
  return { fetch, count: () => count, charge };
}

/** DNS over HTTPS (Cloudflare), every query counted as a subrequest. */
export function dohResolver(
  fetch: (input: string, init?: RequestInit) => Promise<Response>,
): DnsResolver {
  const types = { A: 1, AAAA: 28, MX: 15, TXT: 16 } as const;
  async function query(name: string, type: keyof typeof types) {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(2500) },
    );
    if (!response.ok) throw new Error(`DoH ${response.status}`);
    return (await response.json()) as {
      Status: number;
      Answer?: Array<{ type: number; data: string }>;
    };
  }
  return {
    async publicHost(host) {
      if (/^[\d.]+$/.test(host) || host.includes(":"))
        return isPrivateAddress(host) ? "private" : "ok";
      try {
        // A and AAAA, as the quick scan's resolveHost: a public A record next to a private
        // AAAA (::1, fd00::/8, fe80::) must not pass.
        const [a, aaaa] = await Promise.all([
          query(host, "A"),
          query(host, "AAAA").catch(() => null),
        ]);
        const addresses = [
          ...(a.Answer ?? []).filter((r) => r.type === 1),
          ...(aaaa?.Answer ?? []).filter((r) => r.type === 28),
        ].map((r) => r.data);
        if (a.Status === 3 || (a.Status === 0 && !addresses.length)) return "nxdomain";
        return addresses.some(isPrivateAddress) ? "private" : "ok";
      } catch {
        return "error";
      }
    },
    async records(name, type) {
      try {
        const answer = await query(name, type);
        if (answer.Status === 3) return { status: "nxdomain", data: [] };
        const data = (answer.Answer ?? [])
          .filter((r) => r.type === types[type])
          .map((r) => r.data.replace(/^"|"$/g, "").replace(/"\s+"/g, ""));
        return { status: "ok", data };
      } catch {
        return { status: "error", data: [] };
      }
    },
  };
}

const SHARD_PATH = "/scan-index/v1/fin";

/*
 * The company index (src/lib/scan/company-search.ts) is configured once per isolate
 * with a stable base and a fetch that captures no step: re-configuring it per lookup
 * (with a step's counted fetch) let concurrent steps overwrite each other's fetch and
 * clear each other's cache. Its own fetches are counted here and charged to the step.
 */
let indexConfigKey: unknown;
let indexFetches = 0;
function configureIndexOnce(adapters: EnvAdapters): boolean {
  // The origin string on the Worker (stable across requests); the reader itself in scripts.
  const key: unknown = adapters.readAsset ?? adapters.assetOrigin;
  if (!key) return false;
  if (indexConfigKey === key) return true;
  indexConfigKey = key;
  if (adapters.readAsset) {
    const read = adapters.readAsset;
    configureScanIndex({
      base: "vortex-local:/scan-index/v1",
      fetch: (async (url: string) => {
        indexFetches++;
        const text = await read(String(url).replace("vortex-local:", ""));
        return new Response(text ?? "", { status: text === null ? 404 : 200 });
      }) as typeof fetch,
    });
  } else {
    const raw = adapters.rawFetch;
    configureScanIndex({
      base: `${adapters.assetOrigin}/scan-index/v1`,
      fetch: ((url: string, init?: RequestInit) => {
        indexFetches++;
        return raw(String(url), init);
      }) as typeof fetch,
    });
  }
  return true;
}

export function createStepEnv(input: EnvInput, adapters: EnvAdapters): StepEnv {
  const now = adapters.now ?? (() => Date.now());
  const sleep = adapters.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = adapters.log ?? (() => undefined);
  const counted = countedFetch(adapters.rawFetch, siteFetchLimit(input.step));
  const deadline = input.startedAt + stepBudgetMs(input.step, input.part);
  const dns = adapters.dns ?? dohResolver(counted.fetch);
  const polite = createPoliteFetcher(
    {
      fetch: counted.fetch,
      now,
      sleep,
      userAgent: SCAN_USER_AGENT,
      blockReason: (url) => urlBlockReason(url),
      resolve: (host) => dns.publicHost(host),
      hostAllowed: adapters.hostAllowed,
      deadline,
      log,
    },
    { minGapMs: 1000 },
  );
  const anaf = createAnafClient({
    fetch: counted.fetch,
    now,
    sleep,
    startAt: input.anafStartAt,
    quota: input.anafQuota,
    deadline,
    userAgent: SCAN_USER_AGENT,
    log,
  });
  const readAsset = async (path: string): Promise<string | null> => {
    if (adapters.readAsset) return adapters.readAsset(path);
    if (!adapters.assetOrigin) return null;
    try {
      const response = await counted.fetch(`${adapters.assetOrigin}${path}`);
      if (!response.ok) return null;
      const text = await response.text();
      return text.startsWith("<") ? null : text;
    } catch {
      return null;
    }
  };
  const bind = { runId: input.runId, uid: input.uid };
  return {
    runId: input.runId,
    uid: input.uid,
    cui: input.cui,
    lang: input.lang,
    relationship: input.relationship,
    step: input.step,
    deadline,
    identity: input.identity,
    fetch: counted.fetch,
    polite,
    dns,
    anaf,
    index: {
      async byCui(cui) {
        try {
          if (!configureIndexOnce(adapters)) return null;
          const before = indexFetches;
          const hit = await findCompanyByCui(cui);
          // Index files fetched for this lookup count towards the step (approximate when
          // steps of this isolate overlap; cached files cost nothing).
          counted.charge(indexFetches - before);
          return hit
            ? {
                cui: hit.cui,
                name: hit.name,
                county: hit.county,
                city: hit.city,
                website: hit.website,
                status: hit.status,
              }
            : null;
        } catch {
          return null;
        }
      },
    },
    shards: {
      async fin(caen4, countyCode) {
        const flat = await readAsset(`${SHARD_PATH}/${caen4}.txt`);
        if (flat) return flat;
        if (!countyCode) return null;
        return readAsset(`${SHARD_PATH}/${caen4}/${countyCode}.txt`);
      },
      benchNational: null,
    },
    data: {
      wages,
      caenRev3ToRev2: caenMap.map as Record<string, string[]>,
      caenLabels: caenLabels as CaenLabels,
    },
    auditSite: adapters.auditSite ?? ((site) => auditFromPages(site)),
    pagespeed: adapters.pagespeed ?? ((url) => pageSpeedSummary(url)),
    sources: { courts: input.config.sourceCourts, ted: input.config.sourceTed, pagespeed: true },
    llm: input.llm?.bindFetch
      ? { ...input.llm, transport: input.llm.bindFetch(counted.fetch) }
      : input.llm,
    ledger: input.ledger,
    seal: (state, purpose) => sealCursor(input.secret, bind, state, purpose),
    unseal: <T>(token: string, purpose: CursorPurpose) =>
      openCursor<T>(input.secret, bind, token, purpose),
    now,
    sleep,
    log,
    counters: () => ({
      subrequests: counted.count(),
      anafCalls: anaf.calls(),
      politeRequests: polite.requests().length,
    }),
  };
}

/* --------------------------------------------------------- audit adapter */

/**
 * Runs the quick scan's deterministic checks on pages the deep audit already
 * fetched politely (homepage once per run, robots.txt, sitemap, up to 5
 * pages): no extra request is made here. Asset and image probes are skipped
 * in deep mode, so the checks that need them stay silent instead of guessing.
 * Interim adapter until Eng 3 adds auditWebsite(url, { politeness: "deep" }).
 */
export async function auditFromPages(site: AuditSiteInput): Promise<AuditSiteResult | null> {
  try {
    const finalUrl = new URL(site.home.url);
    const headers = new Headers(site.home.headers);
    const home = extractPage(site.home.html, site.home.url, site.home.status);
    const extra = site.pages.map((p) => extractPage(p.html, p.url, p.status));
    const pages = [home, ...extra];
    const technologies = detectTechnologies({
      html: [
        site.home.html.slice(0, 1_500_000),
        ...site.pages.map((p) => p.html.slice(0, 300_000)),
      ].join("\n"),
      scriptSrcs: pages.flatMap((page) =>
        page.scripts.map((s) => s.src).filter((s): s is string => Boolean(s)),
      ),
      headers,
      cookies: (site.home.headers["set-cookie"] ?? "")
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean),
      generators: [...new Set(pages.flatMap((page) => page.generators))],
    });
    const contentAvailable = site.home.status < 400 && home.wordCount > 0;
    const { signals, extra: extraSignals } = contentAvailable
      ? buildSignals(pages, technologies, site.cui)
      : buildSignals([], technologies);
    const robots =
      site.robots.body !== undefined
        ? robotsFromResponse(site.robots.status ?? 200, site.robots.body)
        : null;
    const sitemap: SitemapInfo = site.sitemap;
    const context: AuditContext = {
      requestedUrl: site.requestedUrl,
      finalUrl,
      https: finalUrl.protocol === "https:",
      statusCode: site.home.status,
      ttfbMs: site.home.ttfbMs,
      redirects: site.home.redirects,
      headers,
      setCookies: (site.home.headers["set-cookie"] ?? "")
        .split(";")
        .map((c) => `${c.trim()}=`)
        .filter((c) => c !== "="),
      htmlEncoded: /gzip|br|deflate|zstd/i.test(headers.get("content-encoding") ?? ""),
      contentAvailable,
      home,
      pages,
      brokenPages: site.brokenPages,
      robots: {
        found: Boolean(robots?.found),
        status: site.robots.status,
        sitemaps: robots?.sitemaps ?? [],
        blocksEveryone: Boolean(robots?.found && !robots.isAllowed("/")),
        blocksGoogle: false,
      },
      sitemap,
      httpRedirectsToHttps: undefined,
      images: [],
      assets: [],
      faviconFound: site.faviconFound,
      appBundle: undefined,
      technologies,
      signals,
      extra: extraSignals,
      cui: site.cui,
      name: site.name,
      now: new Date(),
    };
    const findings = runChecks(context).map((f) => ({
      id: f.id,
      severity: f.severity,
      category: f.category,
      title: f.title,
      evidence: f.evidence?.slice(0, 160),
    }));
    return {
      checksRun: CHECK_COUNT,
      findings,
      technologies: technologies.map((t) => ({ name: t.name, category: t.category })),
      clientRendered: home.clientRendered,
      hasCookieConsent: signals.hasCookieConsent,
      hasAnalytics: signals.hasAnalytics,
    };
  } catch {
    return null;
  }
}

async function pageSpeedSummary(url: string): Promise<PageSpeedSummary | null> {
  const result = await runPageSpeed(url, "mobile").catch(() => null);
  if (!result) return null;
  return {
    performance: result.performance,
    lcpMs: result.lcpMs,
    clsScore: result.cls,
    strategy: "mobile",
  };
}

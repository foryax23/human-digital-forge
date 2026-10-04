import process from "node:process";

import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeVerificationCode, storedReportGenuine } from "@/lib/deep/attest.server";
import {
  DEEP_LIMITS,
  type AccessReason,
  type DeepAccess,
  type DeepReport,
  type DeepStepInput,
  type DeepStepOutput,
  type DeepStore,
  type StartDeepRunOutput,
} from "@/lib/deep/contracts";
import { checkDeepAccess, configForUser, isDeepAdmin } from "@/lib/deep/access.server";
import {
  deepAssetOrigin,
  readDeepConfig,
  resolveRunSecret,
  ticketAdmitted,
  type DeepConfig,
} from "@/lib/deep/env.server";
import { createAnthropicTransport } from "@/lib/deep/llm/anthropic.server";
import type { LlmClient } from "@/lib/deep/llm/types";
import { storeFor, storeForNewRun, storeHoldingRun } from "@/lib/deep/persist.server";
import type { DeepRunListItem } from "@/lib/deep/persist-tables.server";
import { buildReportParts } from "@/lib/deep/report";
import { engineStart, engineStep, type EngineDeps } from "@/lib/deep/steps/dispatch.server";
import { issueTicket, readTicket } from "@/lib/deep/ticket.server";
import { DEEP_TERMS_VERSION, deepConsentRecord } from "@/lib/scan/legal/lead-notice";

/*
 * Server functions of "Cercetare aprofundată" (plan D2). The browser runner
 * (Eng 2, useDeepResearch.ts) calls startDeepRun, then deepStep per step,
 * then deepStep "finish". Everything is read from the environment inside the
 * handlers (Workers bind env per request). Every function except
 * getDeepAccess and verifyDeepReport requires a signed-in user.
 *
 * Modules behind the seams (Eng 3):
 * - access: checkDeepAccess (src/lib/deep/access.server.ts), the A4 table. Admins come
 *   from DEEP_RESEARCH_ADMIN_USER_IDS and from Lovable's "admin" role (user_roles), so
 *   every handler resolves its config with configForUser before any step check;
 * - storage: storeForNewRun / storeFor (src/lib/deep/persist.server.ts): Lovable's deep
 *   tables (drizzle/migrations/0000) when present, else the stopgap in audit_leads; the
 *   kind is fixed in the ticket, and no Supabase credentials means "ledger_unavailable";
 * - report logic: buildReportParts (src/lib/deep/report/index.ts);
 * - consent: deepConsentRecord and DEEP_TERMS_VERSION (src/lib/scan/legal/lead-notice.ts).
 */

/* ------------------------------------------------------------ middleware */

/**
 * Request bodies ≤ 256 KB, before validation and attestation hashing. TanStack
 * Start has already parsed the JSON when middleware runs, so this bounds the
 * work after it; without a usable content-length (chunked, or not a number) the
 * parsed payload itself is measured. A check before parsing needs a request
 * middleware on /_serverFn/ (asked of the lead).
 */
const bodyLimit = createMiddleware({ type: "function" }).server(async ({ next, data }) => {
  const raw = getRequest()?.headers.get("content-length");
  if (raw && /^\d+$/.test(raw)) {
    if (Number(raw) > DEEP_LIMITS.requestBytes) throw new Error("too_large");
  } else {
    let size = Number.POSITIVE_INFINITY;
    try {
      size = new TextEncoder().encode(JSON.stringify(data ?? null)).length;
    } catch {
      // unmeasurable: too large
    }
    if (size > DEEP_LIMITS.requestBytes) throw new Error("too_large");
  }
  return next();
});

/* -------------------------------------------------------------- helpers */

function llmFor(config: DeepConfig): LlmClient | null {
  if (!config.anthropicKey) return null;
  return {
    transport: createAnthropicTransport(config.anthropicKey),
    bindFetch: (counted) => createAnthropicTransport(config.anthropicKey!, counted),
    models: {
      synthesis: config.synthesisModel,
      extraction: config.extractModel,
      effort: config.synthesisEffort,
    },
  };
}

function engineDeps(config: DeepConfig, secret: string): EngineDeps {
  // Data files (company index, MF shards) come from a fixed origin, never a Host header.
  const assetOrigin = deepAssetOrigin(config, getRequest()?.url);
  return {
    secret,
    config,
    adapters: { rawFetch: (input, init) => fetch(input, init), assetOrigin },
    storeFor: (kind) => storeFor(kind),
    llmFor,
    reportBuilder: buildReportParts,
    log: (event) => console.log("[deep]", JSON.stringify(event).slice(0, 500)),
  };
}

/**
 * The guard of the run-scoped functions (feedback, call requests, events, stored
 * reports): the kill switch, and the run must be this user's, in whichever store
 * holds it. With `entitled`, the account must still be admitted the way the run was
 * (a withdrawn access cannot keep writing feedback, events or call requests); a stored
 * report stays readable by its owner (D24).
 */
async function runGuard(
  userId: string,
  runId: string,
  opts: { entitled?: boolean } = {},
): Promise<
  | { ok: true; store: DeepStore; run: { status: string; cui?: string } }
  | { ok: false; reason: AccessReason }
> {
  const config = await configForUser(userId);
  if (config.mode === "disabled") return { ok: false, reason: "mode_disabled" };
  const held = await storeHoldingRun(runId, userId).catch(() => null);
  if (!held) return { ok: false, reason: "run_not_found" };
  if (opts.entitled) {
    const via = held.run.via;
    // An admin run: the account must still be an admin now, by ID, role or e-mail (the run
    // row does not keep how it was admitted, and this guard can afford the lookup).
    const admitted = !via
      ? false
      : via === "admin"
        ? await isDeepAdmin(userId, { config }).catch(() => false)
        : ticketAdmitted(config, via, userId);
    if (!admitted) return { ok: false, reason: "admin_only" };
  }
  return { ok: true, store: held.store, run: held.run };
}

/**
 * Counters per key, per isolate and minute, for at most `maxKeys` keys (the oldest goes
 * first). The returned function counts one call for `key` and says whether it is within
 * the limit.
 */
function perMinute(limit: number, maxKeys = 1000) {
  const windows = new Map<string, { start: number; count: number }>();
  return (key: string, now = Date.now()): boolean => {
    let w = windows.get(key);
    if (!w || now - w.start > 60_000) {
      windows.delete(key);
      w = { start: now, count: 0 };
      windows.set(key, w);
      if (windows.size > maxKeys) windows.delete(windows.keys().next().value as string);
    }
    w.count++;
    return w.count <= limit;
  };
}

/** The caller's address as Cloudflare reports it; one shared bucket without it (local dev). */
function clientIp(): string {
  return getRequest()?.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

/**
 * Public verification lookups (codes are 40 bits; this only slows scraping): 30 a minute
 * per address, so one client cannot use up everyone's checks, and 600 a minute per isolate.
 */
const verifyPerIp = perMinute(30);
const verifyPerIsolate = perMinute(600, 1);
function verifyAllowed(): boolean {
  return verifyPerIp(clientIp()) && verifyPerIsolate("all");
}

/**
 * getDeepAccess per signed-in account: 20 a minute per isolate. Each call reads the day's
 * runs, the breaker and possibly the account, so a script with one token cannot turn it
 * into database load; a person never comes close.
 */
const accessPerUser = perMinute(20);

/** The signed-in user for functions where login is optional (getDeepAccess). */
async function optionalUserId(): Promise<string | null> {
  const header = getRequest()?.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const token = header.slice(7);
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await supabase.auth.getClaims(token);
    return (data?.claims?.sub as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------- schemas */

const cuiSchema = z.string().regex(/^(RO)?\d{2,10}$/i);
const relationship = z.enum(["proprietar", "angajat", "client_furnizor", "concurent", "altceva"]);
const lang = z.enum(["ro", "en"]);
const ownerInputs = z
  .object({
    turnover2026: z.number().min(0).max(1e11).optional(),
    clientsPerMonth: z.number().min(0).max(1e7).optional(),
    avgTicket: z.number().min(0).max(1e8).optional(),
    hourValue: z.number().min(0).max(10_000).optional(),
  })
  .strict();
const correction = z
  .object({
    predicate: z.enum([
      "site.booking.present",
      "site.cui.present",
      "site.contact.present",
      "presence.social_only",
      "site.url",
    ]),
    url: z
      .string()
      .max(300)
      .regex(/^https?:\/\//i)
      .optional(),
    number: z.number().finite().optional(),
  })
  .strict();
const boundedRecord = (maxBytes: number) =>
  z.record(z.unknown()).refine((value) => {
    try {
      return JSON.stringify(value).length <= maxBytes;
    } catch {
      return false;
    }
  }, "too large");
/**
 * A StepResult as the browser sends it back. Structure only: integrity is the
 * attestation's job (verified on the server), so unknown keys are kept as sent
 * (passthrough) and nothing is rewritten before the HMAC is checked.
 */
const stepResult = z
  .object({
    runId: z.string().max(80),
    step: z.enum([
      "start",
      "money",
      "site",
      "signals",
      "peers",
      "audit",
      "crawl",
      "pagespeed",
      "competitor",
      "synthesis",
      "finish",
    ]),
    status: z.enum(["done", "partial", "skipped", "failed"]),
    // Each fact and gap is an object of bounded size, so attestation never hashes oversized input.
    facts: z.array(boundedRecord(DEEP_LIMITS.stepResultBytes)).max(DEEP_LIMITS.stepResultFacts),
    gaps: z.array(boundedRecord(4096)).max(100),
    att: z.string().max(200),
  })
  .passthrough();
const ticket = z.string().min(20).max(8192);
const part = z.enum(["warm", "brief", "customer", "rivals"]);

const stepInput = z.discriminatedUnion("step", [
  // anafNextAt from the client can only delay ANAF calls; the engine also clamps it to ≤ now + 3 s.
  z.object({ ticket, step: z.literal("money"), anafNextAt: z.number().finite().optional() }),
  z.object({ ticket, step: z.literal("signals"), anafNextAt: z.number().finite().optional() }),
  z.object({
    ticket,
    step: z.literal("site"),
    candidates: z.array(z.string().max(300)).max(3).optional(),
    answer: z.object({ url: z.string().max(300), yes: z.boolean() }).optional(),
  }),
  z.object({
    ticket,
    step: z.literal("peers"),
    money: stepResult,
    anafNextAt: z.number().finite().optional(),
    edits: z
      .object({ remove: z.array(cuiSchema).max(3), add: z.array(cuiSchema).max(3) })
      .optional(),
  }),
  z.object({ ticket, step: z.literal("audit"), site: stepResult }),
  z.object({ ticket, step: z.literal("pagespeed"), site: stepResult }),
  z.object({ ticket, step: z.literal("crawl"), site: stepResult, cursor: z.string().max(60_000) }),
  z.object({ ticket, step: z.literal("competitor"), peers: stepResult, cui: cuiSchema }),
  z.object({
    ticket,
    step: z.literal("synthesis"),
    part,
    // The warm-up result is passed to the three sections (it decides their cache pricing).
    results: z.array(stepResult).max(20),
    corrections: z.array(correction).max(10).optional(),
  }),
  z.object({
    ticket,
    step: z.literal("finish"),
    results: z.array(stepResult).max(20),
    corrections: z.array(correction).max(10).optional(),
    owner: ownerInputs.optional(),
  }),
]);

/* ------------------------------------------------------------- functions */

/** Mode, access, AI on or off, runs left, storage, budget and entry visibility: auth optional. */
export const getDeepAccess = createServerFn({ method: "POST" })
  .middleware([bodyLimit])
  .inputValidator((input: unknown) =>
    z
      .object({ testCode: z.string().max(80).optional() })
      .optional()
      .parse(input),
  )
  .handler(async ({ data }): Promise<DeepAccess> => {
    const config = readDeepConfig();
    const userId = await optionalUserId();
    if (userId && config.mode !== "disabled" && !accessPerUser(userId)) {
      return {
        mode: config.mode,
        allowed: false,
        reason: "ledger_unavailable",
        ai: false,
        runsLeftToday: 0,
        persistence: "unavailable",
        budgetUsd: config.runBudgetUsd,
        entryVisible: false,
      };
    }
    const store = config.mode === "disabled" ? null : await storeForNewRun().catch(() => null);
    const {
      email: _email,
      adminBy: _adminBy,
      ...access
    } = await checkDeepAccess({ userId, testCode: data?.testCode }, { config, store });
    return access;
  });

export const startDeepRun = createServerFn({ method: "POST" })
  .middleware([bodyLimit, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cui: cuiSchema,
        site: z.string().max(300).optional(),
        relationship,
        lang,
        consent: z.object({
          termsVersion: z.string().min(1).max(40),
          marketing: z.boolean(),
          lang: lang.optional(),
        }),
        testCode: z.string().max(80).optional(),
        owner: ownerInputs.optional(),
        corrections: z.array(correction).max(10).optional(),
        rerun: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<StartDeepRunOutput> => {
    const config = await configForUser(context.userId);
    if (config.mode === "disabled") return { ok: false, reason: "mode_disabled" };
    // The report terms the form showed must be the current version (B1): the record is
    // built from the server's own text for it, never from text sent by the browser.
    if (data.consent.termsVersion !== DEEP_TERMS_VERSION)
      return { ok: false, reason: "terms_outdated" };
    const secret = await resolveRunSecret(config);
    if (!secret) return { ok: false, reason: "ledger_unavailable" };
    const store = await storeForNewRun().catch(() => null);
    if (!store) return { ok: false, reason: "ledger_unavailable" };
    const access = await checkDeepAccess(
      { userId: context.userId, testCode: data.testCode },
      { config, store },
    );
    if (!access.allowed || !access.via) return { ok: false, reason: access.reason ?? "admin_only" };
    // Lazy retention, at most once an hour per isolate (A6).
    await store.purgeIfDue().catch(() => undefined);
    const credit = access.useCredit ? await spendDeepCheck(context.userId) : null;
    if (credit && !credit.ok) return { ok: false, reason: "premium_required" };
    const out = await engineStart(engineDeps(config, secret), {
      uid: context.userId,
      via: access.via,
      adminBy: access.adminBy,
      input: data,
      store,
      storeKind: store.kind,
      // The record is built in the language the notice was shown in, not the report's.
      consent: deepConsentRecord(data.consent.lang ?? data.lang, data.consent.marketing),
      userCap: access.via === "admin" ? config.adminDailyCap : config.userDailyCap,
    });
    // A run that did not start gives its check back.
    if (credit?.ok && !out.ok) await credit.refund();
    return out;
  });

/** Spends one deep check atomically (service role); refund() returns it. */
async function spendDeepCheck(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("deep_use_credit", { _uid: userId });
  return {
    ok: !error && data === true,
    refund: async () => {
      await supabaseAdmin.rpc("deep_refund_credit", { _uid: userId });
    },
  };
}

export const deepStep = createServerFn({ method: "POST" })
  .middleware([bodyLimit, requireSupabaseAuth])
  .inputValidator((input: unknown) => stepInput.parse(input))
  .handler(async ({ data, context }): Promise<DeepStepOutput> => {
    const config = await configForUser(context.userId);
    if (config.mode === "disabled") return { kind: "refused", reason: "mode_disabled" };
    const secret = await resolveRunSecret(config);
    if (!secret) return { kind: "refused", reason: "ledger_unavailable" };
    return engineStep(engineDeps(config, secret), {
      uid: context.userId,
      input: data as DeepStepInput,
    });
  });

/** A fresh ticket for an expired one, after the ledger confirms the run is this user's, < 24 h old and not finished. */
export const resumeDeepRun = createServerFn({ method: "POST" })
  .middleware([bodyLimit, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ runId: z.string().uuid(), ticket: ticket.optional() }).parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; ticket: string } | { ok: false; reason: AccessReason }> => {
      const config = await configForUser(context.userId);
      if (config.mode === "disabled") return { ok: false, reason: "mode_disabled" };
      const secret = await resolveRunSecret(config);
      if (!secret || !data.ticket) return { ok: false, reason: "run_not_found" };
      const old = await readTicket(secret, data.ticket, {
        uid: context.userId,
        allowExpired: true,
      });
      if (!old.ok || old.payload.runId !== data.runId)
        return { ok: false, reason: old.ok ? "run_not_found" : old.reason };
      // Still entitled: a removed admin or a mode switched back is not renewed. An admin is
      // checked again for real (resume is rare, the I/O is fine): removing the ID, the role
      // or the address stops the renewals, and the new ticket records how the account is an
      // admin now.
      let adminBy = old.payload.adminBy;
      if (old.payload.via === "admin") {
        const access = await checkDeepAccess(
          { userId: context.userId },
          { config, store: storeFor(old.payload.store) },
        ).catch(() => null);
        if (!access?.admin || !access.adminBy) return { ok: false, reason: "admin_only" };
        adminBy = access.adminBy;
      } else if (!ticketAdmitted(config, old.payload.via, context.userId)) {
        return { ok: false, reason: "admin_only" };
      }
      const run = await storeFor(old.payload.store)
        .getRun(data.runId, context.userId)
        .catch(() => null);
      if (
        !run ||
        run.status !== "running" ||
        Date.now() - Date.parse(run.createdAt) > 24 * 3600_000
      ) {
        return { ok: false, reason: "run_not_found" };
      }
      const { v: _v, iat: _iat, exp: _exp, adminBy: _was, ...rest } = old.payload;
      return {
        ok: true,
        ticket: await issueTicket(secret, {
          ...rest,
          ...(rest.via === "admin" && adminBy ? { adminBy } : {}),
        }),
      };
    },
  );

/** A report stored on the server (tables only). */
export const loadDeepRun = createServerFn({ method: "POST" })
  .middleware([bodyLimit, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      { ok: true; report: DeepReport; reportAtt: string } | { ok: false; reason: AccessReason }
    > => {
      const guard = await runGuard(context.userId, data.runId);
      if (!guard.ok) return guard;
      const found = guard.store.loadReport
        ? await guard.store
            .loadReport({ runId: data.runId, userId: context.userId })
            .catch(() => null)
        : null;
      return found ? { ok: true, ...found } : { ok: false, reason: "run_not_found" };
    },
  );

/**
 * The signed-in account's research runs kept on the server (newest first, 90 days), for
 * the dashboard's "Deep research" page; each opens in /scan/deep?run=<id>. With the
 * stopgap (no deep tables) the list is empty and /scan/deep shows this browser's runs.
 * Costs are included for admins only (by ID, role or e-mail, as the access check decides).
 * Retention runs here too (at most once an hour per isolate), so expired runs are deleted
 * even on days when no run is started.
 */
export const listDeepRuns = createServerFn({ method: "POST" })
  .middleware([bodyLimit, requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<
      | {
          ok: true;
          storage: "tables" | "stopgap";
          admin: boolean;
          runs: Array<Omit<DeepRunListItem, "spentUsd"> & { spentUsd?: number }>;
        }
      | { ok: false; reason: AccessReason }
    > => {
      const config = await configForUser(context.userId);
      if (config.mode === "disabled") return { ok: false, reason: "mode_disabled" };
      const store = await storeForNewRun().catch(() => null);
      if (!store) return { ok: false, reason: "ledger_unavailable" };
      await store.purgeIfDue().catch(() => undefined);
      const admin = await isDeepAdmin(context.userId, { config }).catch(() => false);
      if (store.kind !== "tables" || !("listRuns" in store))
        return { ok: true, storage: "stopgap", admin, runs: [] };
      const runs = await store.listRuns(context.userId).catch(() => null);
      if (!runs) return { ok: false, reason: "ledger_unavailable" };
      return {
        ok: true,
        storage: "tables",
        admin,
        runs: runs.map(({ spentUsd, ...run }) => (admin ? { ...run, spentUsd } : run)),
      };
    },
  );

/** Public check of a PDF verification code (tables only). */
export const verifyDeepReport = createServerFn({ method: "POST" })
  .middleware([bodyLimit])
  .inputValidator((input: unknown) => z.object({ code: z.string().max(20) }).parse(input))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; company: string; cui: string; generatedAt: string }
      | { ok: false; reason: "not_found" | "ledger_unavailable" }
    > => {
      const code = normalizeVerificationCode(data.code);
      if (!code) return { ok: false, reason: "not_found" };
      if (!verifyAllowed()) return { ok: false, reason: "ledger_unavailable" };
      // A report is confirmed only when its attestation recomputes from the run ID and the
      // stored report with the run secret: a row found by its code alone could have been
      // written by anyone who can write that table (the stopgap's audit_leads in particular).
      const secret = await resolveRunSecret(readDeepConfig());
      if (!secret) return { ok: false, reason: "ledger_unavailable" };
      // The tables first, then the stopgap rows (reports finished before the tables existed).
      let reachable = false;
      let found: Awaited<ReturnType<NonNullable<DeepStore["loadReport"]>>> = null;
      for (const kind of ["tables", "stopgap"] as const) {
        const store = storeFor(kind);
        if (!store.loadReport) continue;
        try {
          found = await store.loadReport({ verifyCode: code });
          reachable = true;
        } catch {
          continue;
        }
        if (found && (await storedReportGenuine(secret, found, code))) break;
        found = null;
      }
      if (!found) return { ok: false, reason: reachable ? "not_found" : "ledger_unavailable" };
      return {
        ok: true,
        company: found.report.company.displayName,
        cui: found.report.cui,
        generatedAt: found.report.generatedAt,
      };
    },
  );

const feedbackKind = z.enum([
  "useful_yes",
  "useful_no",
  "error_report",
  "correction",
  "monitoring_interest",
  "price_signal",
  "cta_click",
  "competitor_edit",
]);

export const reportDeepIssue = createServerFn({ method: "POST" })
  .middleware([bodyLimit, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        kind: feedbackKind,
        factId: z.string().max(120).optional(),
        message: z.string().max(1000).optional(),
        value: z.unknown().optional(),
      })
      .refine((v) => JSON.stringify(v.value ?? null).length <= 4096, "value too large")
      .parse(input),
  )
  .handler(
    async ({ data, context }): Promise<{ ok: true } | { ok: false; reason: AccessReason }> => {
      const guard = await runGuard(context.userId, data.runId, { entitled: true });
      if (!guard.ok) return guard;
      try {
        // The memory ledger refuses feedback (never kept in an isolate): "ledger_unavailable".
        await guard.store.feedback({ ...data, userId: context.userId });
        return { ok: true };
      } catch {
        return { ok: false, reason: "ledger_unavailable" };
      }
    },
  );

/** "Sună-mă": a real lead the person asked for; refused (never silently dropped) without persistent storage. */
export const requestDeepCall = createServerFn({ method: "POST" })
  .middleware([bodyLimit, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        phone: z.string().regex(/^[+\d][\d\s().-]{6,20}$/),
        when: z.enum(["dimineata", "dupa_amiaza"]),
        lang,
      })
      .parse(input),
  )
  .handler(
    async ({ data, context }): Promise<{ ok: true } | { ok: false; reason: AccessReason }> => {
      const guard = await runGuard(context.userId, data.runId, { entitled: true });
      if (!guard.ok) return guard;
      try {
        const email = String((context.claims as { email?: string }).email ?? "");
        await guard.store.callRequest({
          ...data,
          userId: context.userId,
          email,
          cui: guard.run.cui ?? "",
        });
        return { ok: true };
      } catch (error) {
        // Three "Sună-mă" requests a day per account (persist-db.server.ts).
        if ((error as Error)?.message === "call_limit")
          return { ok: false, reason: "daily_cap_user" };
        return { ok: false, reason: "ledger_unavailable" };
      }
    },
  );

export const logDeepEvent = createServerFn({ method: "POST" })
  .middleware([bodyLimit, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        events: z.array(z.object({ name: z.string().max(60), at: z.string().max(40) })).max(50),
      })
      .parse(input),
  )
  .handler(
    async ({ data, context }): Promise<{ ok: true } | { ok: false; reason: AccessReason }> => {
      const guard = await runGuard(context.userId, data.runId, { entitled: true });
      if (!guard.ok) return guard;
      // Counters only (no third-party analytics): written once at finish by the persistent stores.
      console.log("[deep] events", data.runId, data.events.length);
      return { ok: true };
    },
  );

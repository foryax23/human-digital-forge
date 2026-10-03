import process from "node:process";

import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeVerificationCode } from "@/lib/deep/attest.server";
import {
  DEEP_LIMITS,
  type AccessReason,
  type ConsentRecord,
  type DeepAccess,
  type DeepReport,
  type DeepStepInput,
  type DeepStepOutput,
  type DeepStore,
  type Lang,
  type StartDeepRunOutput,
} from "@/lib/deep/contracts";
import {
  deepAssetOrigin,
  provisionalAccess,
  readDeepConfig,
  resolveRunSecret,
  ticketAdmitted,
  type DeepConfig,
} from "@/lib/deep/env.server";
import { createAnthropicTransport } from "@/lib/deep/llm/anthropic.server";
import { createMemoryStore, type MemoryStore } from "@/lib/deep/llm/ledger-memory.server";
import type { LlmClient } from "@/lib/deep/llm/types";
import { engineStart, engineStep, type EngineDeps } from "@/lib/deep/steps/dispatch.server";
import { provisionalReportParts } from "@/lib/deep/steps/report-fallback.server";
import { issueTicket, readTicket } from "@/lib/deep/ticket.server";
import { leadNoticeText, LEAD_NOTICE } from "@/lib/scan/legal/lead-notice";

/*
 * Server functions of "Cercetare aprofundată" (plan D2). The browser runner
 * (Eng 2, useDeepResearch.ts) calls startDeepRun, then deepStep per step,
 * then deepStep "finish". Everything is read from the environment inside the
 * handlers (Workers bind env per request). Every function except
 * getDeepAccess and verifyDeepReport requires a signed-in user.
 *
 * Integration seams, to switch when Eng 3's modules land (one line each):
 * - access: provisionalAccess → checkDeepAccess (src/lib/deep/access.server.ts);
 * - storage: the in-memory ledger → storeForNewRun / storeFor (src/lib/deep/persist.server.ts);
 * - report logic: provisionalReportParts → buildReportParts (src/lib/deep/report/index.ts);
 * - consent texts: provisionalConsent → the deep variant in src/lib/scan/legal/lead-notice.ts.
 * Until then the in-memory ledger is accepted in admin mode only (fail closed
 * in every other mode: "ledger_unavailable"), and its runs are rules-only unless
 * DEEP_MEMORY_LEDGER_AI=on (its day cap and run caps hold per Worker isolate),
 * and a step that lands on another isolate than its run is refused
 * (run_not_found): the run-level claims fail closed.
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

/* ---------------------------------------------------------------- stores */

let memoryStore: MemoryStore | undefined;
/** The development ledger (one per isolate); see the seams above. */
function memory(): MemoryStore {
  memoryStore ??= createMemoryStore();
  return memoryStore;
}

function storeForNewRun(): { store: DeepStore; kind: "memory" } {
  return { store: memory(), kind: "memory" };
}

function storeFor(_kind: "stopgap" | "tables" | "memory"): DeepStore {
  return memory();
}

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
    reportBuilder: provisionalReportParts,
    log: (event) => console.log("[deep]", JSON.stringify(event).slice(0, 500)),
  };
}

/**
 * The guard of the run-scoped functions (feedback, call requests, events, stored
 * reports): the kill switch, the entitlement (admins only while the memory ledger
 * is in use), and the run must be this user's.
 */
async function runGuard(
  userId: string,
  runId: string,
): Promise<{ ok: true; store: DeepStore } | { ok: false; reason: AccessReason }> {
  const config = readDeepConfig();
  if (config.mode === "disabled") return { ok: false, reason: "mode_disabled" };
  const { store, kind } = storeForNewRun();
  if (kind === "memory" && !config.adminUserIds.includes(userId.toLowerCase()))
    return { ok: false, reason: "admin_only" };
  const run = await store.getRun(runId, userId).catch(() => null);
  if (!run) return { ok: false, reason: "run_not_found" };
  return { ok: true, store };
}

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

/** PROVISIONAL deep-start consent record until Eng 3 adds the deep notice and terms texts (B1). */
function provisionalConsent(lang: Lang, termsVersion: string, marketing: boolean): ConsentRecord {
  return {
    version: termsVersion,
    lang,
    channel: "vortex-deep/start",
    recordedAt: new Date().toISOString(),
    notice: leadNoticeText(lang),
    reportBasis: "GDPR art. 6(1)(b) (report requested by the account holder) and 6(1)(f) (record)",
    terms: {
      version: termsVersion,
      text: `DEEP_TERMS_VERSION ${termsVersion}: text pending (Eng 3, B1/B7)`,
      accepted: true,
    },
    marketing: {
      granted: marketing,
      text: LEAD_NOTICE[lang].marketing,
      basis: "GDPR art. 6(1)(a); Legea 506/2004 art. 12",
    },
  };
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
    const { store } = storeForNewRun();
    const stats = userId ? await store.dayStats(userId).catch(() => null) : null;
    const access = await provisionalAccess(config, {
      userId,
      testCode: data?.testCode,
      persistence: "memory",
      todayUsd: stats?.allUsd,
      userRunsToday: stats?.userRuns,
    });
    // The in-memory ledger is acceptable for admins only (fail closed elsewhere).
    if (access.allowed && access.via !== "admin") {
      return { ...access, allowed: false, reason: "ledger_unavailable", via: undefined };
    }
    // Its day cap holds per isolate: AI only by explicit opt-in (DEEP_MEMORY_LEDGER_AI=on).
    return {
      ...access,
      ai: access.ai && config.memoryLedgerAi,
      admin: access.admin
        ? {
            ...access.admin,
            ledger: config.memoryLedgerAi ? "memory_ai_per_isolate" : "memory_rules_only",
            unknownExtractModel: config.unknownExtractModel,
          }
        : undefined,
    };
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
        consent: z.object({ termsVersion: z.string().min(1).max(40), marketing: z.boolean() }),
        testCode: z.string().max(80).optional(),
        owner: ownerInputs.optional(),
        corrections: z.array(correction).max(10).optional(),
        rerun: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<StartDeepRunOutput> => {
    const config = readDeepConfig();
    const secret = await resolveRunSecret(config);
    if (!secret) return { ok: false, reason: "ledger_unavailable" };
    const { store, kind } = storeForNewRun();
    const stats = await store.dayStats(context.userId).catch(() => null);
    if (!stats) return { ok: false, reason: "ledger_unavailable" };
    const access = await provisionalAccess(config, {
      userId: context.userId,
      testCode: data.testCode,
      persistence: kind,
      todayUsd: stats.allUsd,
      userRunsToday: stats.userRuns,
    });
    if (!access.allowed || !access.via) return { ok: false, reason: access.reason ?? "admin_only" };
    if (kind === "memory" && access.via !== "admin")
      return { ok: false, reason: "ledger_unavailable" };
    return engineStart(engineDeps(config, secret), {
      uid: context.userId,
      via: access.via,
      input: data,
      store,
      storeKind: kind,
      consent: provisionalConsent(data.lang, data.consent.termsVersion, data.consent.marketing),
      userCap: access.via === "admin" ? config.adminDailyCap : config.userDailyCap,
    });
  });

export const deepStep = createServerFn({ method: "POST" })
  .middleware([bodyLimit, requireSupabaseAuth])
  .inputValidator((input: unknown) => stepInput.parse(input))
  .handler(async ({ data, context }): Promise<DeepStepOutput> => {
    const config = readDeepConfig();
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
      const config = readDeepConfig();
      if (config.mode === "disabled") return { ok: false, reason: "mode_disabled" };
      const secret = await resolveRunSecret(config);
      if (!secret || !data.ticket) return { ok: false, reason: "run_not_found" };
      const old = await readTicket(secret, data.ticket, {
        uid: context.userId,
        allowExpired: true,
      });
      if (!old.ok || old.payload.runId !== data.runId)
        return { ok: false, reason: old.ok ? "run_not_found" : old.reason };
      // Still entitled: a removed admin or a mode switched back is not renewed.
      if (!ticketAdmitted(config, old.payload.via, context.userId))
        return { ok: false, reason: "admin_only" };
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
      const { v: _v, iat: _iat, exp: _exp, ...rest } = old.payload;
      return { ok: true, ticket: await issueTicket(secret, rest) };
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
      const store = storeFor("memory");
      if (!store.loadReport) return { ok: false, reason: "ledger_unavailable" };
      const found = await store.loadReport({ verifyCode: code }).catch(() => null);
      if (!found) return { ok: false, reason: "not_found" };
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
      const guard = await runGuard(context.userId, data.runId);
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
      const guard = await runGuard(context.userId, data.runId);
      if (!guard.ok) return guard;
      try {
        const email = String((context.claims as { email?: string }).email ?? "");
        await guard.store.callRequest({ ...data, userId: context.userId, email, cui: "" });
        return { ok: true };
      } catch {
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
      const guard = await runGuard(context.userId, data.runId);
      if (!guard.ok) return guard;
      // Counters only (no third-party analytics): written once at finish by the persistent stores.
      console.log("[deep] events", data.runId, data.events.length);
      return { ok: true };
    },
  );

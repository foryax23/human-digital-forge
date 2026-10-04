import process from "node:process";

import {
  CLIENT_PLANS,
  isClientPlanId,
  researchPeriod,
  type ClientPlanRow,
  type PlanSource,
  type ResearchAllowance,
} from "@/lib/client-plans";
import { currentClientPlan, type PlanDb } from "@/lib/client-plans.server";

import type { AccessReason, AccessVia, AdminBy, DeepAccess, DeepStore } from "./contracts";
import { readDeepConfig, testCodeValid, type DeepConfig } from "./env.server";
import { deepDb, type DeepDb } from "./persist-db.server";
import { storeForNewRun } from "./persist.server";

/*
 * The one entitlement check of "Cercetare aprofundată" (plan A4, D13):
 *
 * | DEEP_RESEARCH_MODE | not logged in  | logged in            | test code | Premium | admin |
 * | disabled           | no             | no                   | no        | no      | no    |
 * | admin (default)    | login_required | admin_only           | admin_only| admin_only | yes |
 * | code               | login_required | code_required        | yes       | yes     | yes   |
 * | open               | login_required | yes, within caps (*) | yes       | yes     | yes   |
 * | premium            | login_required | free run(s) if set (**), then premium_required | yes | yes | yes |
 *
 * (*) open mode needs a confirmed e-mail, and a Google sign-in or a test code
 * while DEEP_OPEN_REQUIRES_GOOGLE is on (the default: e-mail auto-confirm may
 * be on in Lovable Cloud, which would let throwaway accounts in).
 * (**) DEEP_FREE_RUNS_PER_USER, 0 by default (plans are assigned by an admin);
 * a free run needs the same confirmed identity as open mode.
 *
 * Admins are identified by user ID (DEEP_RESEARCH_ADMIN_USER_IDS), or by the
 * "admin" role in Lovable's public.user_roles (the same role the admin panel uses;
 * claim_admin_role grants it to the owner's Google account), read with the service
 * role; an answer is cached per isolate for a minute, a failed lookup is not cached.
 * An admin e-mail (DEEP_RESEARCH_ADMIN_EMAILS) counts only for a confirmed e-mail
 * with a Google identity for that same address; such a Google identity also counts
 * as a confirmed e-mail. Any lookup error means "not admin" (fail closed). How an
 * admin was admitted (adminBy) goes into the run ticket, so the step checks keep
 * e-mail admins only while admin e-mails are set. An unknown mode is treated as admin. Every variable is
 * read inside the call (Workers bind env per request). Test codes are SHA-256 hashes compared
 * in constant time. The daily caps and the ledger come from the store, so a refusal shows on
 * the gate before the form.
 *
 * Premium is a plan whose ID DEEP_RESEARCH_PREMIUM_TIERS lists (default starter, growth, pro):
 * the client plan an admin assigned after a contract (public.client_plans, drizzle/pending/
 * client_plans.sql; until it is applied there are no client plans and nothing else changes), or a
 * subscribers row with status active or trialing, matched by user ID, then by verified e-mail
 * (current_period_end is not used). Each plan includes a number of reports per calendar period
 * in Romanian time (src/lib/client-plans.ts: Starter 1 a quarter, Growth 2 a month, Pro 5 a
 * month), counted from the account's premium runs (failed and canceled runs do not count); a
 * listed tier with no quota there admits within the daily caps only, as before. Admins keep
 * their own caps and never use a plan's reports. A plan lookup or count that fails refuses
 * ("ledger_unavailable"), never admits.
 */

export type AccountInfo = { email?: string; emailConfirmed: boolean; google: boolean };

export type AccessLookups = {
  /** The account as Supabase Auth knows it (service role), or null when it cannot be read. */
  account(userId: string): Promise<AccountInfo | null>;
  /** The account holds Lovable's "admin" role (public.user_roles); null when the lookup failed. */
  adminRole?(userId: string): Promise<boolean | null>;
  /** Tiers of the account's active or trialing subscriptions: by user ID, then by verified e-mail. */
  premiumTiers(userId: string, verifiedEmail?: string): Promise<string[]>;
  /**
   * The client plan in force today (public.client_plans, assigned by an admin after a contract):
   * null without one or before client_plans.sql is applied, "error" when the lookup failed.
   */
  clientPlan?(userId: string): Promise<Pick<ClientPlanRow, "plan"> | null | "error">;
};

export type AccessDeps = {
  config?: DeepConfig;
  /** The store a new run would use; null = ledger unavailable; undefined = feature-detect. */
  store?: DeepStore | null;
  lookups?: AccessLookups;
  /** Environment for the extra switches (tests). */
  env?: Record<string, string | undefined>;
  /** The clock for the plan periods (tests). */
  now?: () => number;
};

/**
 * Server-side extras: the account e-mail and how an admin was admitted (never sent to the
 * browser), and `plan`, the deep research of the plan that admitted or refused the account
 * (its quota and the reports used this period; getDeepAccess passes it on, additive).
 */
export type DeepAccessResult = DeepAccess & {
  email?: string;
  adminBy?: AdminBy;
  plan?: ResearchAllowance;
};

/** A store that can count the runs started through a plan (the tables store). */
type PlanCountingStore = DeepStore & {
  premiumRunsSince?(userId: string, sinceIso: string): Promise<number>;
};

const flag = (v: string | undefined, fallback: boolean) =>
  v === undefined || v.trim() === "" ? fallback : /^(on|true|1|yes)$/i.test(v.trim());

/** Supabase lookups through the service-role client. */
export function supabaseLookups(db: DeepDb | null = deepDb()): AccessLookups {
  return {
    async account(userId) {
      if (!db) return null;
      try {
        const { data, error } = await db.auth.admin.getUserById(userId);
        if (error || !data?.user) return null;
        const u = data.user;
        const email = u.email?.trim().toLowerCase();
        // Only a Google identity for the account's own address counts: Google has verified
        // that address. A linked Google account with another address says nothing about it,
        // and app_metadata.providers does not carry the identity's address, so it is not used.
        const google =
          Boolean(email) &&
          (u.identities ?? []).some(
            (i) =>
              i.provider === "google" &&
              String((i.identity_data as { email?: unknown } | undefined)?.email ?? "")
                .trim()
                .toLowerCase() === email,
          );
        return {
          email: u.email ?? undefined,
          emailConfirmed: Boolean(u.email_confirmed_at) || google,
          google,
        };
      } catch {
        return null;
      }
    },
    async adminRole(userId) {
      if (!db) return null;
      try {
        const { data, error } = await db
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "admin")
          .limit(1);
        if (error || !Array.isArray(data)) return null;
        return data.length > 0;
      } catch {
        return null;
      }
    },
    async premiumTiers(userId, verifiedEmail) {
      if (!db) return [];
      const active = ["active", "trialing"];
      const tiers = (rows: unknown) =>
        ((rows as Array<{ tier: string | null }> | null) ?? [])
          .map((r) => (r.tier ?? "").toLowerCase())
          .filter(Boolean);
      try {
        const byId = await db
          .from("subscribers")
          .select("tier, status")
          .eq("user_id", userId)
          .in("status", active);
        if (!byId.error && tiers(byId.data).length) return tiers(byId.data);
        if (!verifiedEmail) return [];
        const byEmail = await db
          .from("subscribers")
          .select("tier, status")
          .eq("email", verifiedEmail.toLowerCase())
          .in("status", active);
        return byEmail.error ? [] : tiers(byEmail.data);
      } catch {
        return [];
      }
    },
    async clientPlan(userId) {
      if (!db) return "error";
      // The hand-written deep schema has no client_plans (it may not exist): read it untyped.
      const plan = await currentClientPlan(db as unknown as PlanDb, userId);
      // No table yet (client_plans.sql not applied): plans are simply unavailable.
      return plan === "missing" ? null : plan;
    },
  };
}

/** Role answers per isolate: a removed role stops admitting the account within this time. */
const ROLE_TTL_MS = 60_000;
const roleCache = new Map<string, { admin: boolean; until: number }>();

/** Test hook: forget the cached role answers. */
export function resetRoleCache() {
  roleCache.clear();
}

async function hasAdminRole(
  lookups: AccessLookups,
  userId: string,
  now = Date.now(),
): Promise<boolean> {
  if (!lookups.adminRole) return false;
  const hit = roleCache.get(userId);
  if (hit && hit.until > now) return hit.admin;
  const admin = await lookups.adminRole(userId).catch(() => null);
  // A failed lookup fails closed for this call only: caching it would refuse the owner's
  // every step for a minute after one transient error.
  if (admin === null) return false;
  roleCache.set(userId, { admin, until: now + ROLE_TTL_MS });
  if (roleCache.size > 500) roleCache.delete(roleCache.keys().next().value as string);
  return admin;
}

/**
 * How the account is a deep research admin, or null: by user ID ("id", which includes the
 * role admins configForUser has added), by Lovable's admin role, or by admin e-mail (a
 * confirmed address with a Google identity for it). Lookup errors mean null (fail closed).
 */
export async function resolveAdmin(
  userId: string,
  config: DeepConfig,
  lookups: AccessLookups,
  getAccount: () => Promise<AccountInfo | null> = () => lookups.account(userId).catch(() => null),
): Promise<AdminBy | null> {
  if (config.adminUserIds.includes(userId.toLowerCase())) return "id";
  if (await hasAdminRole(lookups, userId)) return "role";
  if (!config.adminEmails.length) return null;
  const a = await getAccount();
  return a?.email &&
    a.emailConfirmed &&
    a.google &&
    config.adminEmails.includes(a.email.toLowerCase())
    ? "email"
    : null;
}

/** Whether the account is a deep research admin in any of the three ways (no store, no caps). */
export async function isDeepAdmin(
  userId: string,
  deps: Pick<AccessDeps, "config" | "lookups"> = {},
): Promise<boolean> {
  const id = userId.trim();
  if (!id) return false;
  const config = deps.config ?? readDeepConfig();
  return (await resolveAdmin(id, config, deps.lookups ?? supabaseLookups())) !== null;
}

/**
 * The configuration for this request with the account counted as an admin when
 * Lovable's role table says so. The step checks (ticketAdmitted) make no I/O, so
 * every deep server function resolves this first; env admins need no lookup.
 */
export async function configForUser(
  userId: string | null,
  deps: Pick<AccessDeps, "config" | "lookups"> = {},
): Promise<DeepConfig> {
  const config = deps.config ?? readDeepConfig();
  const id = userId?.trim().toLowerCase();
  if (!id || config.mode === "disabled" || config.adminUserIds.includes(id)) return config;
  const admin = await hasAdminRole(deps.lookups ?? supabaseLookups(), userId!.trim());
  return admin ? { ...config, adminUserIds: [...config.adminUserIds, id] } : config;
}

/**
 * A plan's deep research this period: its quota (src/lib/client-plans.ts) and the reports
 * started since the period began, from the store (null when it cannot count). A plan ID with
 * no quota there has no per-plan limit (reports null).
 */
export async function researchAllowance(
  userId: string,
  plan: string,
  source: PlanSource,
  deps: { store: DeepStore | null; now?: number },
): Promise<ResearchAllowance> {
  const spec = isClientPlanId(plan) ? CLIENT_PLANS[plan].research : null;
  if (!spec) return { plan, source, reports: null, period: null, used: null, renewsAt: null };
  const { start, end } = researchPeriod(spec.period, deps.now ?? Date.now());
  const store = deps.store as PlanCountingStore | null;
  const used = store?.premiumRunsSince
    ? await store.premiumRunsSince(userId, new Date(start).toISOString()).catch(() => null)
    : null;
  return {
    plan,
    source,
    reports: spec.reports,
    period: spec.period,
    used,
    renewsAt: new Date(end).toISOString(),
  };
}

/**
 * Deep research through a plan (premium mode, and code mode without a code): the account's
 * client plan, then its subscription tiers, each only when DEEP_RESEARCH_PREMIUM_TIERS lists
 * it. The first plan with a report left this period admits; a listed tier with no quota admits
 * within the daily caps. `allowance` is the plan that decided (the first one, when every quota
 * is used); `error` means a lookup or the count failed, so nothing is admitted.
 */
export async function planResearchAccess(
  userId: string,
  verifiedEmail: string | undefined,
  deps: { config: DeepConfig; lookups: AccessLookups; store: DeepStore | null; now?: number },
): Promise<{ admit: boolean; allowance?: ResearchAllowance; error?: boolean }> {
  const contract = deps.lookups.clientPlan
    ? await deps.lookups.clientPlan(userId).catch(() => "error" as const)
    : null;
  const tiers = await deps.lookups.premiumTiers(userId, verifiedEmail).catch(() => [] as string[]);
  const candidates: Array<{ plan: string; source: PlanSource }> = [];
  const add = (raw: string, source: PlanSource) => {
    const plan = raw.trim().toLowerCase();
    if (!plan || !deps.config.premiumTiers.includes(plan)) return;
    if (!candidates.some((c) => c.plan === plan)) candidates.push({ plan, source });
  };
  if (contract && contract !== "error") add(contract.plan, "contract");
  for (const tier of tiers) add(tier, "subscription");
  if (!candidates.length)
    return contract === "error" ? { admit: false, error: true } : { admit: false };

  let first: ResearchAllowance | undefined;
  for (const c of candidates) {
    const allowance = await researchAllowance(userId, c.plan, c.source, {
      store: deps.store,
      now: deps.now,
    });
    if (allowance.reports === null) return { admit: true, allowance };
    if (allowance.used === null) return { admit: false, allowance, error: true };
    first ??= allowance;
    if (allowance.used < allowance.reports) return { admit: true, allowance };
  }
  return { admit: false, allowance: first };
}

/** Plan D2: `checkDeepAccess({ userId, testCode })`, with injectable dependencies for tests. */
export async function checkDeepAccess(
  args: { userId: string | null; testCode?: string },
  deps: AccessDeps = {},
): Promise<DeepAccessResult> {
  const config = deps.config ?? readDeepConfig();
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => Date.now());
  const openRequiresGoogle = flag(env.DEEP_OPEN_REQUIRES_GOOGLE, true);
  const userId = args.userId?.trim() || null;

  const base: DeepAccessResult = {
    mode: config.mode,
    allowed: false,
    ai: false,
    runsLeftToday: 0,
    persistence: "unavailable",
    budgetUsd: config.runBudgetUsd,
    entryVisible: false,
  };
  const deny = (reason: AccessReason, extra: Partial<DeepAccessResult> = {}): DeepAccessResult => ({
    ...base,
    ...extra,
    allowed: false,
    via: undefined,
    reason,
    entryVisible: config.entryPublic && (reason === "login_required" || reason === "code_required"),
  });

  if (config.mode === "disabled") return deny("mode_disabled");
  if (!userId) return deny("login_required");

  const lookups = deps.lookups ?? supabaseLookups();
  let account: AccountInfo | null | undefined;
  const getAccount = async () => {
    if (account === undefined) account = await lookups.account(userId).catch(() => null);
    return account;
  };

  const adminBy = await resolveAdmin(userId, config, lookups, getAccount);
  const isAdmin = adminBy !== null;
  if (adminBy) base.adminBy = adminBy;

  const store = deps.store === undefined ? await storeForNewRun().catch(() => null) : deps.store;
  const stats = store ? await store.dayStats(userId).catch(() => null) : null;
  const breaker = store?.breakerOpen ? await store.breakerOpen().catch(() => true) : false;
  const todayUsd = stats?.allUsd ?? 0;
  const persistent = store?.kind === "tables" || store?.kind === "stopgap";
  const cap = isAdmin ? config.adminDailyCap : config.userDailyCap;
  base.persistence = store && stats ? store.kind : "unavailable";
  base.ai =
    Boolean(config.anthropicKey) &&
    persistent &&
    Boolean(stats) &&
    !breaker &&
    todayUsd < config.dayBudgetUsd;
  base.runsLeftToday = stats ? Math.max(0, cap - stats.userRuns) : 0;
  if (isAdmin) {
    const aiOff = base.ai
      ? undefined
      : !config.anthropicKey
        ? ("no_key" as const)
        : !persistent || !stats
          ? ("storage" as const)
          : breaker
            ? ("breaker" as const)
            : ("day_budget" as const);
    base.admin = {
      todayUsd: Number(todayUsd.toFixed(4)),
      dayCapUsd: config.dayBudgetUsd,
      unknownMode: config.unknownMode,
      unknownExtractModel: config.unknownExtractModel,
      ...(aiOff ? { aiOff } : {}),
    };
  }
  const email = (
    await (isAdmin || config.mode === "open" || config.mode === "premium" ? getAccount() : null)
  )?.email;
  if (email) base.email = email;

  const codeOk = args.testCode
    ? await testCodeValid(config, args.testCode).catch(() => false)
    : false;

  let via: AccessVia | undefined;
  if (isAdmin) via = "admin";
  else {
    switch (config.mode) {
      case "code": {
        if (codeOk) {
          via = "code";
          break;
        }
        // Plans are admitted in code mode too (A4), within their reports.
        const a = await getAccount();
        const plan = await planResearchAccess(userId, a?.emailConfirmed ? a.email : undefined, {
          config,
          lookups,
          store,
          now: now(),
        });
        if (plan.allowance) base.plan = plan.allowance;
        if (!plan.admit) return deny("code_required");
        via = "premium";
        break;
      }
      case "open": {
        if (codeOk) {
          via = "code";
          break;
        }
        const a = await getAccount();
        if (!a) return deny("ledger_unavailable");
        if (!a.emailConfirmed) return deny("email_unconfirmed");
        if (openRequiresGoogle && !a.google) return deny("code_required");
        via = "open";
        break;
      }
      case "premium": {
        if (codeOk) {
          via = "code";
          break;
        }
        const a = await getAccount();
        const plan = await planResearchAccess(userId, a?.emailConfirmed ? a.email : undefined, {
          config,
          lookups,
          store,
          now: now(),
        });
        if (plan.allowance) base.plan = plan.allowance;
        if (plan.admit) {
          via = "premium";
          break;
        }
        // The plan or its reports could not be read: "try again", never "buy a plan".
        if (plan.error) return deny("ledger_unavailable");
        if (config.freeRunsPerUser > 0) {
          // A free run needs the confirmed identity open mode asks for: otherwise throwaway
          // accounts could use up the all-accounts cap and the day budget.
          if (!a) return deny("ledger_unavailable");
          if (!a.emailConfirmed || (openRequiresGoogle && !a.google))
            return deny("premium_required");
          if (!store?.freeRunsUsed) return deny("ledger_unavailable");
          const used = await store.freeRunsUsed(userId).catch(() => Number.POSITIVE_INFINITY);
          if (used < config.freeRunsPerUser) {
            via = "free";
            break;
          }
        }
        // No plan, or this period's reports are used (base.plan says which, and when they renew).
        return deny("premium_required");
      }
      default:
        // "admin", and any unknown value (already mapped to admin by readDeepConfig).
        return deny("admin_only");
    }
  }

  if (!store || !stats || !persistent) return deny("ledger_unavailable");
  if (stats.userRuns >= cap) return deny("daily_cap_user");
  if (via !== "admin" && stats.allRuns >= config.dailyRunCap) return deny("daily_cap_global");
  return { ...base, allowed: true, via, reason: undefined, entryVisible: true };
}

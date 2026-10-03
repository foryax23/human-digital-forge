import process from "node:process";

import type { AccessReason, AccessVia, DeepAccess, DeepStore } from "./contracts";
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
 * | premium            | login_required | first free run(s), then premium_required | yes | yes | yes |
 *
 * (*) open mode needs a confirmed e-mail, and a Google sign-in or a test code
 * while DEEP_OPEN_REQUIRES_GOOGLE is on (the default: e-mail auto-confirm may
 * be on in Lovable Cloud, which would let throwaway accounts in).
 *
 * Admins are identified by user ID (DEEP_RESEARCH_ADMIN_USER_IDS); an admin
 * e-mail (DEEP_RESEARCH_ADMIN_EMAILS) counts only for a confirmed e-mail with
 * a Google identity. An unknown mode is treated as admin. Every variable is
 * read inside the call (Workers bind env per request). Premium is a
 * subscribers row with status active or trialing and a tier in
 * DEEP_RESEARCH_PREMIUM_TIERS, matched by user ID, then by verified e-mail;
 * current_period_end is not used. Test codes are SHA-256 hashes compared in
 * constant time. The daily caps and the ledger come from the store, so a
 * refusal shows on the gate before the form.
 */

export type AccountInfo = { email?: string; emailConfirmed: boolean; google: boolean };

export type AccessLookups = {
  /** The account as Supabase Auth knows it (service role), or null when it cannot be read. */
  account(userId: string): Promise<AccountInfo | null>;
  /** Tiers of the account's active or trialing subscriptions: by user ID, then by verified e-mail. */
  premiumTiers(userId: string, verifiedEmail?: string): Promise<string[]>;
};

export type AccessDeps = {
  config?: DeepConfig;
  /** The store a new run would use; null = ledger unavailable; undefined = feature-detect. */
  store?: DeepStore | null;
  lookups?: AccessLookups;
  /** Environment for the extra switches (tests). */
  env?: Record<string, string | undefined>;
};

export type DeepAccessResult = DeepAccess & { email?: string };

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
        const providers = [
          ...(u.identities ?? []).map((i) => i.provider),
          ...(((u.app_metadata as { providers?: unknown } | undefined)?.providers as
            | string[]
            | undefined) ?? []),
        ];
        return {
          email: u.email ?? undefined,
          emailConfirmed: Boolean(u.email_confirmed_at),
          google: providers.includes("google"),
        };
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
  };
}

/** Plan D2: `checkDeepAccess({ userId, testCode })`, with injectable dependencies for tests. */
export async function checkDeepAccess(
  args: { userId: string | null; testCode?: string },
  deps: AccessDeps = {},
): Promise<DeepAccessResult> {
  const config = deps.config ?? readDeepConfig();
  const env = deps.env ?? process.env;
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

  const adminById = config.adminUserIds.includes(userId.toLowerCase());
  let isAdmin = adminById;
  if (!isAdmin && config.adminEmails.length) {
    const a = await getAccount();
    isAdmin = Boolean(
      a?.email &&
      a.emailConfirmed &&
      a.google &&
      config.adminEmails.includes(a.email.toLowerCase()),
    );
  }

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
        // Premium subscribers are admitted in code mode too (A4).
        const a = await getAccount();
        const tiers = await lookups
          .premiumTiers(userId, a?.emailConfirmed ? a.email : undefined)
          .catch(() => [] as string[]);
        if (!tiers.some((t) => config.premiumTiers.includes(t))) return deny("code_required");
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
        const tiers = await lookups
          .premiumTiers(userId, a?.emailConfirmed ? a.email : undefined)
          .catch(() => [] as string[]);
        if (tiers.some((t) => config.premiumTiers.includes(t))) {
          via = "premium";
          break;
        }
        if (config.freeRunsPerUser > 0) {
          if (!store?.freeRunsUsed) return deny("ledger_unavailable");
          const used = await store.freeRunsUsed(userId).catch(() => Number.POSITIVE_INFINITY);
          if (used < config.freeRunsPerUser) {
            via = "free";
            break;
          }
        }
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

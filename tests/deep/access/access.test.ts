import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  checkDeepAccess,
  type AccessLookups,
  type AccountInfo,
} from "../../../src/lib/deep/access.server";
import type { AccessReason, DeepStore } from "../../../src/lib/deep/contracts";
import { readDeepConfig, ticketAdmitted } from "../../../src/lib/deep/env.server";
import { createMemoryStore } from "../../../src/lib/deep/llm/ledger-memory.server";

/*
 * The access table of plan A4 for all five modes × the five kinds of user,
 * with fake lookups and an in-memory store standing in for Supabase. No
 * network, no database.
 */

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const USER = "bbbbbbbb-0000-4000-8000-000000000002";
const CODER = "cccccccc-0000-4000-8000-000000000003";
const PREMIUM = "dddddddd-0000-4000-8000-000000000004";
const CODE = "vortex-test-2026";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const accounts: Record<string, AccountInfo> = {
  [ADMIN]: { email: "mihai@example.ro", emailConfirmed: true, google: true },
  [USER]: { email: "ana@example.ro", emailConfirmed: true, google: true },
  [CODER]: { email: "ion@example.ro", emailConfirmed: true, google: true },
  [PREMIUM]: { email: "paid@example.ro", emailConfirmed: true, google: true },
};

function lookups(
  overrides: Partial<Record<string, AccountInfo>> = {},
  tiers: Record<string, string[]> = { [PREMIUM]: ["growth"] },
): AccessLookups {
  return {
    async account(id) {
      return { ...accounts, ...overrides }[id] ?? null;
    },
    async premiumTiers(id) {
      return tiers[id] ?? [];
    },
  };
}

type Store = DeepStore & {
  freeRunsUsed?: (u: string) => Promise<number>;
  breakerOpen?: () => Promise<boolean>;
};

function store(
  opts: { free?: number; breaker?: boolean; kind?: "stopgap" | "tables" } = {},
): Store {
  const s = createMemoryStore() as Store;
  return Object.assign(s, {
    kind: opts.kind ?? "stopgap",
    freeRunsUsed: async () => opts.free ?? 0,
    breakerOpen: async () => opts.breaker ?? false,
  });
}

function config(mode: string | undefined, extra: Record<string, string> = {}) {
  return readDeepConfig({
    DEEP_RESEARCH_MODE: mode,
    DEEP_RESEARCH_ADMIN_USER_IDS: ADMIN,
    DEEP_RESEARCH_TEST_CODES: sha(CODE),
    ANTHROPIC_API_KEY: "sk-test",
    ...extra,
  });
}

async function check(
  mode: string | undefined,
  userId: string | null,
  testCode?: string,
  extra: Record<string, string> = {},
  s: Store | null = store(),
) {
  return checkDeepAccess(
    { userId, testCode },
    { config: config(mode, extra), store: s, lookups: lookups(), env: {} },
  );
}

test("the access matrix: five modes × anonymous, signed-in, test code, Premium, admin", async () => {
  type Row = [string | null, string | undefined];
  const users: Record<string, Row> = {
    anonymous: [null, undefined],
    signedIn: [USER, undefined],
    code: [CODER, CODE],
    premium: [PREMIUM, undefined],
    admin: [ADMIN, undefined],
  };
  const expected: Record<string, Record<string, "yes" | AccessReason | `via:${string}`>> = {
    disabled: {
      anonymous: "mode_disabled",
      signedIn: "mode_disabled",
      code: "mode_disabled",
      premium: "mode_disabled",
      admin: "mode_disabled",
    },
    admin: {
      anonymous: "login_required",
      signedIn: "admin_only",
      code: "admin_only",
      premium: "admin_only",
      admin: "via:admin",
    },
    code: {
      anonymous: "login_required",
      signedIn: "code_required",
      code: "via:code",
      premium: "via:premium",
      admin: "via:admin",
    },
    open: {
      anonymous: "login_required",
      signedIn: "via:open",
      code: "via:code",
      premium: "via:open",
      admin: "via:admin",
    },
    premium: {
      anonymous: "login_required",
      signedIn: "via:free",
      code: "via:code",
      premium: "via:premium",
      admin: "via:admin",
    },
  };
  for (const [mode, row] of Object.entries(expected)) {
    for (const [who, want] of Object.entries(row)) {
      const [userId, code] = users[who];
      const a = await check(mode, userId, code);
      if (want.startsWith("via:")) {
        assert.equal(a.allowed, true, `${mode}/${who}: ${a.reason}`);
        assert.equal(a.via, want.slice(4), `${mode}/${who}`);
      } else {
        assert.equal(a.allowed, false, `${mode}/${who} should be refused`);
        assert.equal(a.reason, want, `${mode}/${who}`);
      }
    }
  }
});

test("unset or unknown mode is admin (fail closed) and the admin panel names the unknown value", async () => {
  assert.equal((await check(undefined, USER)).reason, "admin_only");
  assert.equal((await check(undefined, ADMIN)).via, "admin");
  const typo = await check("premuim", ADMIN);
  assert.equal(typo.mode, "admin");
  assert.equal(typo.admin?.unknownMode, "premuim");
  assert.equal((await check("premuim", USER)).reason, "admin_only");
});

test("admin e-mail counts only for a confirmed e-mail with a Google identity", async () => {
  const cfg = config("admin", {
    DEEP_RESEARCH_ADMIN_USER_IDS: "",
    DEEP_RESEARCH_ADMIN_EMAILS: "Mihai@Example.ro",
  });
  const run = (info: AccountInfo) =>
    checkDeepAccess(
      { userId: ADMIN },
      { config: cfg, store: store(), lookups: lookups({ [ADMIN]: info }), env: {} },
    );
  assert.equal(
    (await run({ email: "mihai@example.ro", emailConfirmed: true, google: true })).via,
    "admin",
  );
  assert.equal(
    (await run({ email: "mihai@example.ro", emailConfirmed: false, google: true })).reason,
    "admin_only",
  );
  assert.equal(
    (await run({ email: "mihai@example.ro", emailConfirmed: true, google: false })).reason,
    "admin_only",
  );
  assert.equal(
    (await run({ email: "other@example.ro", emailConfirmed: true, google: true })).reason,
    "admin_only",
  );
});

test("test codes are SHA-256 hashes; a wrong code or the hash itself does not open", async () => {
  assert.equal((await check("code", USER, CODE)).via, "code");
  assert.equal((await check("code", USER, ` ${CODE} `)).via, "code");
  assert.equal((await check("code", USER, "wrong")).reason, "code_required");
  assert.equal((await check("code", USER, sha(CODE))).reason, "code_required");
});

test("Premium: tiers from DEEP_RESEARCH_PREMIUM_TIERS; one free report per account, then premium_required", async () => {
  const cfg = config("premium");
  const run = (tiers: string[], free: number) =>
    checkDeepAccess(
      { userId: USER },
      { config: cfg, store: store({ free }), lookups: lookups({}, { [USER]: tiers }), env: {} },
    );
  assert.equal((await run(["growth"], 5)).via, "premium");
  assert.equal((await run(["pro"], 5)).via, "premium");
  assert.equal((await run(["starter"], 0)).via, "free");
  assert.equal((await run(["starter"], 1)).reason, "premium_required");
  assert.equal((await run([], 0)).via, "free");
  const none = await checkDeepAccess(
    { userId: USER },
    {
      config: config("premium", { DEEP_FREE_RUNS_PER_USER: "0" }),
      store: store(),
      lookups: lookups({}, {}),
      env: {},
    },
  );
  assert.equal(none.reason, "premium_required");
});

test("open mode: a confirmed e-mail, and Google or a test code while DEEP_OPEN_REQUIRES_GOOGLE is on", async () => {
  const run = (info: AccountInfo, env: Record<string, string> = {}, code?: string) =>
    checkDeepAccess(
      { userId: USER, testCode: code },
      { config: config("open"), store: store(), lookups: lookups({ [USER]: info }), env },
    );
  assert.equal(
    (await run({ email: "a@b.ro", emailConfirmed: false, google: false })).reason,
    "email_unconfirmed",
  );
  assert.equal(
    (await run({ email: "a@b.ro", emailConfirmed: true, google: false })).reason,
    "code_required",
  );
  assert.equal(
    (await run({ email: "a@b.ro", emailConfirmed: true, google: false }, {}, CODE)).via,
    "code",
  );
  assert.equal(
    (
      await run(
        { email: "a@b.ro", emailConfirmed: true, google: false },
        { DEEP_OPEN_REQUIRES_GOOGLE: "off" },
      )
    ).via,
    "open",
  );
});

test("daily caps from the store: 3 a day per account, 20 for admins, 10 for everyone but admins", async () => {
  const s = store();
  const startN = async (user: string, via: "open" | "admin", n: number) => {
    for (let i = 0; i < n; i++) {
      const r = await s.startRun({
        userId: user,
        cui: String(1000 + i),
        relationship: "proprietar",
        lang: "ro",
        via,
        budgetUsd: 1.5,
        aiMode: "rules",
        consent: {} as never,
        userCap: 100,
        globalCap: 100,
        allowSameCompany: true,
      });
      if ("runId" in r) await s.finish({ runId: r.runId, status: "succeeded" });
    }
  };
  await startN(USER, "open", 3);
  const capped = await checkDeepAccess(
    { userId: USER },
    { config: config("open"), store: s, lookups: lookups(), env: {} },
  );
  assert.equal(capped.reason, "daily_cap_user");
  assert.equal(capped.runsLeftToday, 0);
  await startN(ADMIN, "admin", 3);
  const admin = await checkDeepAccess(
    { userId: ADMIN },
    { config: config("open"), store: s, lookups: lookups(), env: {} },
  );
  assert.equal(admin.allowed, true);
  assert.equal(admin.runsLeftToday, 17);
  // Global: 10 non-admin runs today block other accounts, not admins.
  for (let k = 0; k < 4; k++)
    await startN(`eeeeeeee-0000-4000-8000-00000000000${k}`, "open", k === 3 ? 1 : 2);
  const global = await checkDeepAccess(
    { userId: CODER },
    { config: config("open"), store: s, lookups: lookups(), env: {} },
  );
  assert.equal(global.reason, "daily_cap_global");
  assert.equal(
    (
      await checkDeepAccess(
        { userId: ADMIN },
        { config: config("open"), store: s, lookups: lookups(), env: {} },
      )
    ).allowed,
    true,
  );
});

test("no ledger: allowed users get ledger_unavailable; anonymous still see login_required; disabled wins", async () => {
  assert.equal((await check("open", USER, undefined, {}, null)).reason, "ledger_unavailable");
  assert.equal((await check("admin", ADMIN, undefined, {}, null)).reason, "ledger_unavailable");
  assert.equal((await check("open", null, undefined, {}, null)).reason, "login_required");
  assert.equal((await check("disabled", ADMIN)).reason, "mode_disabled");
  const unavailable = await check("open", USER, undefined, {}, null);
  assert.equal(unavailable.persistence, "unavailable");
  assert.equal(unavailable.ai, false);
});

test("AI is on only with a key, a persistent store, a closed breaker and day budget left", async () => {
  assert.equal((await check("open", USER)).ai, true);
  assert.equal((await check("open", USER, undefined, { ANTHROPIC_API_KEY: "" })).ai, false);
  assert.equal((await check("open", USER, undefined, {}, store({ breaker: true }))).ai, false);
  const spent = store();
  const r = await spent.startRun({
    userId: USER,
    cui: "123",
    relationship: "proprietar",
    lang: "ro",
    via: "open",
    budgetUsd: 10,
    aiMode: "ai",
    consent: {} as never,
    userCap: 10,
    globalCap: 10,
    allowSameCompany: true,
  });
  if (!("runId" in r)) throw new Error("no run");
  await spent.reserve({
    runId: r.runId,
    idemKey: "k",
    kind: "llm",
    step: "synthesis",
    usd: 2,
    dayCapUsd: 100,
  });
  assert.equal(
    (await check("open", USER, undefined, { DEEP_DAILY_BUDGET_USD: "1.5" }, spent)).ai,
    false,
  );
  assert.equal(
    (await check("open", USER, undefined, { DEEP_DAILY_BUDGET_USD: "15" }, spent)).ai,
    true,
  );
});

test("entry visibility: hidden unless allowed, or DEEP_ENTRY_PUBLIC=on for login and code gates", async () => {
  assert.equal((await check("code", null)).entryVisible, false);
  assert.equal(
    (await check("code", null, undefined, { DEEP_ENTRY_PUBLIC: "on" })).entryVisible,
    true,
  );
  assert.equal(
    (await check("code", USER, undefined, { DEEP_ENTRY_PUBLIC: "on" })).entryVisible,
    true,
  );
  assert.equal(
    (await check("admin", USER, undefined, { DEEP_ENTRY_PUBLIC: "on" })).entryVisible,
    false,
  );
  assert.equal((await check("admin", ADMIN)).entryVisible, true);
});

test("tickets stay admitted per mode: free runs in Premium, e-mail admins while e-mails are set", () => {
  const premium = config("premium");
  assert.equal(ticketAdmitted(premium, "free", USER), true);
  assert.equal(ticketAdmitted(premium, "open", USER), false);
  assert.equal(ticketAdmitted(config("admin"), "code", USER), false);
  assert.equal(ticketAdmitted(config("code"), "premium", USER), true);
  assert.equal(ticketAdmitted(config("code"), "open", USER), false);
  const emails = config("admin", {
    DEEP_RESEARCH_ADMIN_USER_IDS: "",
    DEEP_RESEARCH_ADMIN_EMAILS: "mihai@example.ro",
  });
  assert.equal(ticketAdmitted(emails, "admin", USER), true);
  assert.equal(
    ticketAdmitted(config("admin", { DEEP_RESEARCH_ADMIN_USER_IDS: "" }), "admin", USER),
    false,
  );
  assert.equal(ticketAdmitted(config("disabled"), "admin", ADMIN), false);
});

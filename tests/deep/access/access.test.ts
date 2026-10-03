import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  checkDeepAccess,
  configForUser,
  isDeepAdmin,
  resetRoleCache,
  supabaseLookups,
  type AccessLookups,
  type AccountInfo,
} from "../../../src/lib/deep/access.server";
import type { DeepDb } from "../../../src/lib/deep/persist-db.server";
import { FakeSupabase } from "../persist/fake-supabase";
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
      // No free runs by default (DEEP_FREE_RUNS_PER_USER=0): plans are assigned by an admin.
      signedIn: "premium_required",
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

test("Premium: tiers from DEEP_RESEARCH_PREMIUM_TIERS; free reports only when set, then premium_required", async () => {
  const cfg = config("premium", { DEEP_FREE_RUNS_PER_USER: "1" });
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
  assert.equal(readDeepConfig({}).freeRunsPerUser, 0, "no free runs unless set");

  // A free run needs the confirmed identity open mode asks for (throwaway accounts).
  const free = (info: AccountInfo, env: Record<string, string> = {}) =>
    checkDeepAccess(
      { userId: USER },
      { config: cfg, store: store(), lookups: lookups({ [USER]: info }, {}), env },
    );
  assert.equal(
    (await free({ email: "a@b.ro", emailConfirmed: false, google: false })).reason,
    "premium_required",
  );
  assert.equal(
    (await free({ email: "a@b.ro", emailConfirmed: true, google: false })).reason,
    "premium_required",
  );
  assert.equal(
    (
      await free(
        { email: "a@b.ro", emailConfirmed: true, google: false },
        { DEEP_OPEN_REQUIRES_GOOGLE: "off" },
      )
    ).via,
    "free",
  );
  assert.equal((await free({ email: "a@b.ro", emailConfirmed: true, google: true })).via, "free");
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
  const premium = config("premium", { DEEP_FREE_RUNS_PER_USER: "1" });
  assert.equal(ticketAdmitted(premium, "free", USER), true);
  assert.equal(ticketAdmitted(premium, "open", USER), false);
  assert.equal(ticketAdmitted(config("admin"), "code", USER), false);
  assert.equal(ticketAdmitted(config("code"), "premium", USER), true);
  assert.equal(ticketAdmitted(config("code"), "open", USER), false);
  const emails = config("admin", {
    DEEP_RESEARCH_ADMIN_USER_IDS: "",
    DEEP_RESEARCH_ADMIN_EMAILS: "mihai@example.ro",
  });
  // Only a ticket admitted by e-mail is kept by the e-mail list; one admitted by ID or role
  // (or an old ticket that does not say) stops once the ID or the role is gone.
  assert.equal(ticketAdmitted(emails, "admin", USER, "email"), true);
  assert.equal(ticketAdmitted(emails, "admin", USER, "role"), false);
  assert.equal(ticketAdmitted(emails, "admin", USER, "id"), false);
  assert.equal(ticketAdmitted(emails, "admin", USER), false);
  assert.equal(
    ticketAdmitted(config("admin", { DEEP_RESEARCH_ADMIN_USER_IDS: "" }), "admin", USER, "email"),
    false,
    "admin e-mails emptied: the e-mail ticket stops too",
  );
  assert.equal(ticketAdmitted(config("disabled"), "admin", ADMIN), false);
});

test("Lovable's admin role (user_roles) makes an admin, with no env entry; errors fail closed", async () => {
  resetRoleCache();
  const ROLE = "eeeeeeee-0000-4000-8000-000000000005";
  const role = (answer: boolean | "throw"): AccessLookups => ({
    ...lookups({ [ROLE]: { email: "owner@example.ro", emailConfirmed: true, google: true } }),
    async adminRole(id) {
      if (answer === "throw") throw new Error("down");
      return answer && id === ROLE;
    },
  });
  const cfg = config("admin", { DEEP_RESEARCH_ADMIN_USER_IDS: "" });
  const yes = await checkDeepAccess(
    { userId: ROLE },
    { config: cfg, store: store(), lookups: role(true), env: {} },
  );
  assert.equal(yes.allowed, true);
  assert.equal(yes.via, "admin");
  assert.ok(yes.admin);
  resetRoleCache();
  const down = await checkDeepAccess(
    { userId: ROLE },
    { config: cfg, store: store(), lookups: role("throw"), env: {} },
  );
  assert.equal(down.allowed, false);
  assert.equal(down.reason, "admin_only");
  // The failed lookup is not cached: the next call, seconds later, asks again and admits.
  const back = await checkDeepAccess(
    { userId: ROLE },
    { config: cfg, store: store(), lookups: role(true), env: {} },
  );
  assert.equal(back.via, "admin");
  assert.equal(back.adminBy, "role");
  // A lookup that answers null (an error the lookup caught itself) is not cached either.
  resetRoleCache();
  const nulls: AccessLookups = { ...role(true), adminRole: async () => null };
  assert.equal((await configForUser(ROLE, { config: cfg, lookups: nulls })).adminUserIds.length, 0);
  assert.ok(
    (await configForUser(ROLE, { config: cfg, lookups: role(true) })).adminUserIds.includes(ROLE),
  );

  // configForUser adds a role admin to the config, so the step checks (no I/O) admit the ticket.
  resetRoleCache();
  const resolved = await configForUser(ROLE, { config: cfg, lookups: role(true) });
  assert.ok(resolved.adminUserIds.includes(ROLE));
  assert.equal(ticketAdmitted(resolved, "admin", ROLE), true);
  assert.equal(ticketAdmitted(cfg, "admin", ROLE), false);
  // Cached per isolate for a minute: the second lookup is not made.
  let lookupsMade = 0;
  const counting: AccessLookups = {
    ...role(true),
    async adminRole(id) {
      lookupsMade++;
      return id === ROLE;
    },
  };
  resetRoleCache();
  await configForUser(ROLE, { config: cfg, lookups: counting });
  await configForUser(ROLE, { config: cfg, lookups: counting });
  assert.equal(lookupsMade, 1);
  // Env admins and the kill switch need no lookup.
  await configForUser(ADMIN, { config: config("admin"), lookups: counting });
  await configForUser(ROLE, { config: config("disabled"), lookups: counting });
  assert.equal(lookupsMade, 1);
  resetRoleCache();
});

test("the role lookup reads user_roles with the service role; a Google sign-in is a confirmed identity", async () => {
  const ROLE = "eeeeeeee-0000-4000-8000-000000000005";
  const db = new FakeSupabase();
  db.rows("user_roles").push({ id: "r1", user_id: ROLE, role: "admin" });
  db.rows("user_roles").push({ id: "r2", user_id: USER, role: "user" });
  const real = supabaseLookups(db as unknown as DeepDb);
  assert.equal(await real.adminRole!(ROLE), true);
  assert.equal(await real.adminRole!(USER), false);
  const broken = supabaseLookups(
    new FakeSupabase({ fail: () => ({ code: "XX000" }) }) as unknown as DeepDb,
  );
  // A failed lookup answers null ("unknown"), which is never cached as "not admin".
  assert.equal(await broken.adminRole!(ROLE), null);
  assert.equal(await supabaseLookups(null).adminRole!(ROLE), null);

  // The account lookup: a Google identity for the account's own address counts as a
  // confirmed e-mail even before email_confirmed_at; another address does not, nor does
  // app_metadata.providers (it does not carry the identity's address).
  const account = (user: Record<string, unknown>) =>
    supabaseLookups(
      Object.assign(new FakeSupabase(), {
        auth: { admin: { getUserById: async () => ({ data: { user }, error: null }) } },
      }) as unknown as DeepDb,
    ).account(ROLE);
  assert.deepEqual(
    await account({
      email: "Owner@Example.ro",
      email_confirmed_at: null,
      identities: [{ provider: "google", identity_data: { email: "owner@example.ro" } }],
      app_metadata: {},
    }),
    { email: "Owner@Example.ro", emailConfirmed: true, google: true },
  );
  assert.deepEqual(
    await account({
      email: "owner@example.ro",
      email_confirmed_at: null,
      identities: [{ provider: "google", identity_data: { email: "someone@gmail.com" } }],
      app_metadata: { providers: ["email", "google"] },
    }),
    { email: "owner@example.ro", emailConfirmed: false, google: false },
  );
  assert.deepEqual(
    await account({
      email: "owner@example.ro",
      email_confirmed_at: "2026-10-01T00:00:00Z",
      identities: [{ provider: "email", identity_data: { email: "owner@example.ro" } }],
    }),
    { email: "owner@example.ro", emailConfirmed: true, google: false },
  );
});

test("how an admin was admitted is reported for the ticket: ID, role or e-mail", async () => {
  resetRoleCache();
  const ROLE = "eeeeeeee-0000-4000-8000-000000000005";
  const lk: AccessLookups = {
    ...lookups({ [ROLE]: { email: "owner@example.ro", emailConfirmed: true, google: true } }),
    adminRole: async (id) => id === ROLE,
  };
  const cfg = config("admin", { DEEP_RESEARCH_ADMIN_EMAILS: "mihai@example.ro" });
  const by = async (id: string, c = cfg) =>
    (await checkDeepAccess({ userId: id }, { config: c, store: store(), lookups: lk, env: {} }))
      .adminBy;
  assert.equal(await by(ADMIN), "id");
  assert.equal(await by(ROLE), "role");
  assert.equal(await by(USER), undefined);
  // The same e-mail account, not in the ID list: admitted by e-mail.
  assert.equal(
    await by(
      ADMIN,
      config("admin", {
        DEEP_RESEARCH_ADMIN_USER_IDS: "",
        DEEP_RESEARCH_ADMIN_EMAILS: "mihai@example.ro",
      }),
    ),
    "email",
  );
  assert.equal(await isDeepAdmin(ROLE, { config: cfg, lookups: lk }), true);
  assert.equal(await isDeepAdmin(USER, { config: cfg, lookups: lk }), false);
  resetRoleCache();
});

import { test } from "node:test";
import assert from "node:assert/strict";

import { clientIp, hashKey, hashSalt, utcDay } from "../../src/lib/abuse/ip.server";
import { NO_ADDRESS_SCALE, RULES } from "../../src/lib/abuse/limits.server";
import {
  checkRate,
  isMissingCounter,
  memoryCounter,
  postgresCounter,
  secondsLeft,
  windowStart,
  type RpcDb,
} from "../../src/lib/abuse/rate-limit.server";

const T0 = Date.UTC(2026, 9, 4, 10, 0, 0); // 2026-10-04 10:00:00 UTC
const MIN = 60_000;

test("fixed windows: start, seconds left, days turn at 00:00 UTC", () => {
  assert.equal(windowStart(T0, 600), T0 / 1000);
  assert.equal(secondsLeft(T0 + 30_000, 600), 570);
  assert.equal(windowStart(T0, 86_400), Date.UTC(2026, 9, 4) / 1000);
  assert.equal(secondsLeft(T0, 86_400), 14 * 3600);
});

test("contact rule: the 6th request in 10 minutes is refused, the next window lets it in", async () => {
  const store = memoryCounter();
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(await checkRate(store, RULES.contact, "k1", { now: T0 + i * 1000 }), {
      ok: true,
    });
  }
  const refused = await checkRate(store, RULES.contact, "k1", { now: T0 + 6000 });
  assert.equal(refused.ok, false);
  assert.ok(!refused.ok && refused.retryAfterSec > 0 && refused.retryAfterSec <= 600);
  // Another address is not affected.
  assert.deepEqual(await checkRate(store, RULES.contact, "k2", { now: T0 + 7000 }), { ok: true });
  // Ten minutes later: a new short window.
  assert.deepEqual(await checkRate(store, RULES.contact, "k1", { now: T0 + 10 * MIN }), {
    ok: true,
  });
});

test("contact rule: the daily window holds after the short windows reset", async () => {
  const store = memoryCounter();
  let allowed = 0;
  // 5 requests in each of 6 ten-minute windows = 30 tries; the day allows 20.
  for (let w = 0; w < 6; w++) {
    for (let i = 0; i < 5; i++) {
      const verdict = await checkRate(store, RULES.contact, "k", { now: T0 + w * 10 * MIN + i });
      if (verdict.ok) allowed++;
    }
  }
  assert.equal(allowed, 20);
  const refused = await checkRate(store, RULES.contact, "k", { now: T0 + 70 * MIN });
  assert.ok(!refused.ok && refused.retryAfterSec > 10 * 60, "retry after the day turns");
});

test("quick scan: 20 PageSpeed requests from one address, the extra ones are refused", async () => {
  const store = memoryCounter();
  const verdicts = [];
  for (let i = 0; i < 20; i++) {
    verdicts.push(await checkRate(store, RULES["scan.pagespeed"], "ip", { now: T0 + i * 1000 }));
  }
  assert.equal(verdicts.filter((v) => v.ok).length, 15);
  assert.ok(verdicts.slice(15).every((v) => !v.ok));
});

test("no address: one shared key with 10 times the limits", async () => {
  const store = memoryCounter();
  const limit = RULES.contact.windows[0].limit * NO_ADDRESS_SCALE;
  for (let i = 0; i < limit; i++) {
    const v = await checkRate(store, RULES.contact, "no-address", {
      now: T0 + i,
      scale: NO_ADDRESS_SCALE,
    });
    assert.equal(v.ok, true);
  }
  const over = await checkRate(store, RULES.contact, "no-address", {
    now: T0 + limit,
    scale: NO_ADDRESS_SCALE,
  });
  assert.equal(over.ok, false);
});

test("memory counter stays bounded under a flood of distinct keys", async () => {
  const store = memoryCounter(100);
  for (let i = 0; i < 1000; i++) await store.hit("contact", `key-${i}`, 600, T0);
  assert.ok(store.size() <= 100);
});

test("a failing store lets requests through (limits must not lock customers out)", async () => {
  const broken = { hit: async () => Promise.reject(new Error("down")) };
  assert.deepEqual(await checkRate(broken, RULES.contact, "k", { now: T0 }), { ok: true });
});

/** A fake service-role client for public.intake_rate_hit. */
function fakeDb(mode: "ok" | "missing" | "error" | "throws") {
  const counts = new Map<string, number>();
  let calls = 0;
  const db: RpcDb = {
    rpc(fn, args) {
      calls++;
      assert.equal(fn, "intake_rate_hit");
      if (mode === "throws") return Promise.reject(new Error("fetch failed"));
      if (mode === "missing") {
        return Promise.resolve({ data: null, error: { code: "PGRST202", message: "not found" } });
      }
      if (mode === "error") {
        return Promise.resolve({ data: null, error: { code: "57014", message: "timeout" } });
      }
      const id = `${args.p_bucket}|${args.p_key}|${args.p_window_seconds}`;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      return Promise.resolve({ data: counts.get(id), error: null });
    },
  };
  return { db, calls: () => calls };
}

test("postgres counter: uses the database when the function exists", async () => {
  const fake = fakeDb("ok");
  const fallback = memoryCounter();
  const store = postgresCounter(() => fake.db, fallback, { log: () => {} });
  assert.equal(await store.hit("contact", "k", 600, T0), 1);
  assert.equal(await store.hit("contact", "k", 600, T0), 2);
  assert.equal(fake.calls(), 2);
  assert.equal(fallback.size(), 0);
});

test("postgres counter: missing function → memory, said once, looked for again later", async () => {
  const fake = fakeDb("missing");
  const fallback = memoryCounter();
  const logs: string[] = [];
  const store = postgresCounter(() => fake.db, fallback, {
    retryMs: 10 * MIN,
    log: (m) => logs.push(m),
  });
  assert.equal(await store.hit("contact", "k", 600, T0), 1);
  assert.equal(await store.hit("contact", "k", 600, T0 + 1000), 2);
  assert.equal(fake.calls(), 1, "no second database call while it is known to be missing");
  assert.equal(store.usingMemory(T0 + 1000), true);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /rate_limits\.sql/);
  await store.hit("contact", "k", 600, T0 + 11 * MIN);
  assert.equal(fake.calls(), 2, "looks again after retryMs");
  assert.equal(logs.length, 1, "warned once per isolate");
});

test("postgres counter: other errors and throws use memory for that hit only", async () => {
  for (const mode of ["error", "throws"] as const) {
    const fake = fakeDb(mode);
    const store = postgresCounter(() => fake.db, memoryCounter(), { log: () => {} });
    assert.equal(await store.hit("contact", "k", 600, T0), 1);
    assert.equal(await store.hit("contact", "k", 600, T0), 2);
    assert.equal(fake.calls(), 2, "keeps trying the database");
    assert.equal(store.usingMemory(T0), false);
  }
});

test("postgres counter: no database access (local dev) → memory, no call", async () => {
  const store = postgresCounter(() => null, memoryCounter(), { log: () => {} });
  assert.equal(await store.hit("contact", "k", 600, T0), 1);
  const throwing = postgresCounter(
    () => {
      throw new Error("Missing Supabase environment variable(s)");
    },
    memoryCounter(),
    { log: () => {} },
  );
  assert.equal(await throwing.hit("contact", "k", 600, T0), 1);
});

test("missing-counter detection covers PostgREST and Postgres codes", () => {
  for (const code of ["PGRST202", "PGRST205", "42883", "42P01"]) {
    assert.equal(isMissingCounter({ code }), true);
  }
  assert.equal(isMissingCounter({ code: "23505" }), false);
  assert.equal(isMissingCounter(null), false);
});

test("addresses: only cf-connecting-ip, hashed with salt and day, never raw", async () => {
  const headers = new Headers({
    "cf-connecting-ip": " 203.0.113.7 ",
    "x-forwarded-for": "1.1.1.1",
  });
  assert.equal(clientIp(headers), "203.0.113.7");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1" })), null);
  assert.equal(clientIp(new Headers({ "cf-connecting-ip": "<script>" })), null);
  assert.equal(clientIp(undefined), null);

  const salt = hashSalt({});
  const day = utcDay(T0);
  assert.equal(day, "2026-10-04");
  const a = await hashKey("203.0.113.7", { salt, day, purpose: "ip" });
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.ok(!a.includes("203"));
  assert.equal(
    a,
    await hashKey("203.0.113.7", { salt, day, purpose: "ip" }),
    "stable within a day",
  );
  assert.notEqual(a, await hashKey("203.0.113.7", { salt, day: "2026-10-05", purpose: "ip" }));
  assert.notEqual(a, await hashKey("203.0.113.8", { salt, day, purpose: "ip" }));
  const own = hashSalt({ RATE_LIMIT_SALT: "a-long-owner-secret-value" });
  assert.notEqual(a, await hashKey("203.0.113.7", { salt: own, day, purpose: "ip" }));
  assert.equal(hashSalt({ RATE_LIMIT_SALT: "short" }), salt, "a short salt is ignored");
});

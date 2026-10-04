import { test } from "node:test";
import assert from "node:assert/strict";

import { dailyCap, DAILY_CAPS } from "../../src/lib/abuse/limits.server";
import { memoryCounter, withinDailyCap } from "../../src/lib/abuse/rate-limit.server";
import { turnstileKeys, verifyTurnstile } from "../../src/lib/abuse/turnstile.server";

const T0 = Date.UTC(2026, 9, 4, 22, 0, 0); // 2026-10-04 22:00 UTC
const HOUR = 3_600_000;

test("daily caps: safe defaults, env overrides, junk ignored", () => {
  assert.equal(dailyCap("brave", {}), 30);
  assert.equal(dailyCap("pagespeed", {}), 300);
  assert.equal(dailyCap("email", {}), 90);
  assert.equal(dailyCap("brave", { SCAN_DAILY_CAP_BRAVE: "5" }), 5);
  assert.equal(dailyCap("brave", { SCAN_DAILY_CAP_BRAVE: "0" }), 0);
  assert.equal(dailyCap("pagespeed", { SCAN_DAILY_CAP_PAGESPEED: " 1200 " }), 1200);
  for (const junk of ["-1", "ten", "1e3", "3.5", "999999999", ""]) {
    assert.equal(dailyCap("brave", { SCAN_DAILY_CAP_BRAVE: junk }), 30, junk);
  }
  assert.deepEqual(Object.keys(DAILY_CAPS).sort(), ["brave", "email", "pagespeed"]);
});

test("Brave cap: the 31st search of the day is refused, logged once, open again the next UTC day", async () => {
  const store = memoryCounter();
  const reached: number[] = [];
  const results: boolean[] = [];
  for (let i = 0; i < 40; i++) {
    results.push(
      await withinDailyCap(store, "brave", 30, {
        now: T0 + i * 1000,
        onReached: (count) => reached.push(count),
      }),
    );
  }
  assert.equal(results.filter(Boolean).length, 30);
  assert.ok(results.slice(30).every((r) => !r));
  assert.deepEqual(reached, [31], "the log line fires once, on the first refusal");
  // 02:00 UTC the next day: a new day.
  assert.equal(await withinDailyCap(store, "brave", 30, { now: T0 + 4 * HOUR }), true);
});

test("PageSpeed and Brave caps count separately; 0 turns a call off", async () => {
  const store = memoryCounter();
  for (let i = 0; i < 3; i++) await withinDailyCap(store, "pagespeed", 3, { now: T0 });
  assert.equal(await withinDailyCap(store, "pagespeed", 3, { now: T0 }), false);
  assert.equal(await withinDailyCap(store, "brave", 3, { now: T0 }), true);
  assert.equal(await withinDailyCap(store, "brave", 0, { now: T0 }), false);
});

test("a cap whose store fails stays closed (paid APIs never open on an error)", async () => {
  const broken = { hit: async () => Promise.reject(new Error("down")) };
  assert.equal(await withinDailyCap(broken, "brave", 30, { now: T0 }), false);
});

test("Turnstile is off unless both keys are set", () => {
  assert.equal(turnstileKeys({}), null);
  assert.equal(turnstileKeys({ TURNSTILE_SITE_KEY: "0x4AAA" }), null);
  assert.equal(turnstileKeys({ TURNSTILE_SECRET_KEY: "0x4BBB" }), null);
  assert.deepEqual(turnstileKeys({ TURNSTILE_SITE_KEY: " 0x4AAA ", TURNSTILE_SECRET_KEY: "s" }), {
    siteKey: "0x4AAA",
    secret: "s",
  });
});

function siteverify(answer: unknown, status = 200) {
  const calls: FormData[] = [];
  const fn = (async (_url: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push(init.body as FormData);
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer), { status });
  }) as typeof fetch;
  return { fn, calls };
}

test("Turnstile: a good token passes; the secret, token and address go to Cloudflare", async () => {
  const { fn, calls } = siteverify({ success: true, action: "contact" });
  const verdict = await verifyTurnstile("tok", {
    secret: "sec",
    ip: "203.0.113.7",
    action: "contact",
    fetch: fn,
  });
  assert.deepEqual(verdict, { ok: true, checked: true });
  assert.equal(calls[0].get("secret"), "sec");
  assert.equal(calls[0].get("response"), "tok");
  assert.equal(calls[0].get("remoteip"), "203.0.113.7");
});

test("Turnstile: missing, reused, invalid or wrong-action tokens are refused", async () => {
  const none = siteverify({ success: true });
  assert.deepEqual(await verifyTurnstile(undefined, { secret: "s", fetch: none.fn }), {
    ok: false,
    reason: "missing",
  });
  assert.equal(none.calls.length, 0, "no call without a token");
  const reused = siteverify({ success: false, "error-codes": ["timeout-or-duplicate"] });
  assert.deepEqual(await verifyTurnstile("t", { secret: "s", fetch: reused.fn }), {
    ok: false,
    reason: "expired",
  });
  const bad = siteverify({ success: false, "error-codes": ["invalid-input-response"] });
  assert.deepEqual(await verifyTurnstile("t", { secret: "s", fetch: bad.fn }), {
    ok: false,
    reason: "invalid",
  });
  const other = siteverify({ success: true, action: "lead" });
  assert.deepEqual(
    await verifyTurnstile("t", { secret: "s", action: "contact", fetch: other.fn }),
    {
      ok: false,
      reason: "invalid",
    },
  );
});

test("Turnstile: Cloudflare down or our own secret rejected lets the request through", async () => {
  const quiet = { log: () => {} };
  const down = siteverify(new Error("network"));
  assert.deepEqual(await verifyTurnstile("t", { secret: "s", fetch: down.fn, ...quiet }), {
    ok: true,
    checked: false,
  });
  const http = siteverify({}, 503);
  assert.deepEqual(await verifyTurnstile("t", { secret: "s", fetch: http.fn, ...quiet }), {
    ok: true,
    checked: false,
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    const mistake = siteverify({ success: false, "error-codes": ["invalid-input-secret"] });
    assert.deepEqual(await verifyTurnstile("t", { secret: "s", fetch: mistake.fn }), {
      ok: true,
      checked: false,
    });
  } finally {
    console.error = originalError;
  }
});

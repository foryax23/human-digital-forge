import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AnafLimitError,
  createAnafClient,
  resetAnafIsolateClock,
} from "../../../src/lib/deep/anaf-pacer.server";
import { createPoliteFetcher } from "../../../src/lib/deep/steps/polite.server";
import { html, scriptedFetch, virtualClock } from "./helpers";

test("ANAF pacer: ≥ 1.1 s between calls across steps, quota, one 429 retry, deadline", async () => {
  resetAnafIsolateClock();
  const clock = virtualClock();
  let first429 = true;
  const net = scriptedFetch(
    [
      [
        /bilant\?an=2024/,
        () => {
          if (first429) {
            first429 = false;
            return new Response("slow down", { status: 429 });
          }
          return new Response(JSON.stringify({ an: 2024, i: [] }), { status: 200 });
        },
      ],
      [
        /bilant/,
        (u) =>
          new Response(JSON.stringify({ an: Number(u.searchParams.get("an")), i: [] }), {
            status: 200,
          }),
      ],
    ],
    clock,
  );
  const startAt = clock.now() + 1100;
  const client = createAnafClient({
    fetch: net.fetch,
    now: clock.now,
    sleep: clock.sleep,
    startAt,
    quota: 4,
    deadline: clock.now() + 25_000,
    userAgent: "test",
    shareIsolateClock: false,
  });
  await client.bilant("3365133", 2025);
  await client.bilant("3365133", 2024); // 429, then one retry
  await client.bilant("3365133", 2023);
  await assert.rejects(
    () => client.bilant("3365133", 2022),
    (e: unknown) => e instanceof AnafLimitError && e.kind === "quota",
  );
  const times = net.calls.map((c) => c.at);
  assert.equal(times[0] >= startAt, true, "waits for the previous step's anafNextAt");
  for (let i = 1; i < times.length; i++)
    assert.ok(times[i] - times[i - 1] >= 1100, `gap ${times[i] - times[i - 1]} ms`);
  assert.ok(times[2] - times[1] >= 2000, "the 429 retry waits 2 s");
  assert.ok(client.nextAt() >= times.at(-1)! + 1100, "nextAt hands the spacing to the next step");
  const late = createAnafClient({
    fetch: net.fetch,
    now: clock.now,
    sleep: clock.sleep,
    startAt: clock.now() + 30_000,
    quota: 1,
    deadline: clock.now() + 25_000,
    userAgent: "t",
    shareIsolateClock: false,
  });
  await assert.rejects(
    () => late.bilant("1", 2025),
    (e: unknown) => e instanceof AnafLimitError && e.kind === "deadline",
  );
});

/** A virtual clock whose sleeps resolve in time order, so concurrent waits interleave as in real life. */
function concurrentClock(start = Date.UTC(2026, 9, 3, 9, 0, 0)) {
  const timers: Array<{ at: number; resolve: () => void }> = [];
  const clock = {
    t: start,
    now: () => clock.t,
    sleep: (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push({ at: clock.t + Math.max(0, ms), resolve });
        timers.sort((a, b) => a.at - b.at);
      }),
    async drive<T>(work: Promise<T>): Promise<T> {
      let done = false;
      const settled = work.finally(() => {
        done = true;
      });
      while (!done) {
        await new Promise((r) => setImmediate(r));
        const next = timers.shift();
        if (next) {
          clock.t = Math.max(clock.t, next.at);
          next.resolve();
        }
      }
      return settled;
    },
  };
  return clock;
}

test("ANAF pacer: concurrent clients in one isolate queue 1.1 s apart (shared clock booked before the wait)", async () => {
  resetAnafIsolateClock();
  const clock = concurrentClock();
  const net = scriptedFetch(
    [
      [
        /bilant/,
        (u) =>
          new Response(JSON.stringify({ an: Number(u.searchParams.get("an")), i: [] }), {
            status: 200,
          }),
      ],
    ],
    clock,
  );
  const client = () =>
    createAnafClient({
      fetch: net.fetch,
      now: clock.now,
      sleep: clock.sleep,
      startAt: clock.now(),
      quota: 3,
      deadline: clock.now() + 25_000,
      userAgent: "test",
    });
  const a = client();
  await clock.drive(a.bilant("3365133", 2025));
  const b = client();
  const c = client();
  await clock.drive(
    Promise.all([a.bilant("3365133", 2024), b.bilant("1094992", 2025), c.bilant("1", 2025)]),
  );
  const times = net.calls.map((x) => x.at).sort((x, y) => x - y);
  assert.equal(times.length, 4);
  for (let i = 1; i < times.length; i++)
    assert.ok(times[i] - times[i - 1] >= 1100, `gap ${times[i] - times[i - 1]} ms`);
  resetAnafIsolateClock();
});

test("ANAF bilanț: a firewall page or a body without the indicator list is 'unavailable', never 'no filing'", async () => {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const net = scriptedFetch(
    [
      [/an=2025/, () => html("<html><body>The requested URL was rejected</body></html>")],
      [/an=2024/, () => new Response(JSON.stringify({ message: "busy" }), { status: 200 })],
      [/an=2023/, () => new Response(JSON.stringify({ an: 2023, i: [] }), { status: 200 })],
    ],
    clock,
  );
  const anaf = createAnafClient({
    fetch: net.fetch,
    now: clock.now,
    sleep: clock.sleep,
    startAt: clock.now(),
    quota: 3,
    deadline: clock.now() + 25_000,
    userAgent: "test",
    shareIsolateClock: false,
  });
  for (const year of [2025, 2024]) {
    await assert.rejects(
      () => anaf.bilant("3365133", year),
      (e: unknown) => e instanceof AnafLimitError && e.kind === "unavailable",
    );
  }
  assert.deepEqual(await anaf.bilant("3365133", 2023), { an: 2023, i: [] });
});

const polite = (routes: Parameters<typeof scriptedFetch>[0], opts: { live?: string[] } = {}) => {
  const clock = virtualClock();
  const net = scriptedFetch(routes, clock);
  const fetcher = createPoliteFetcher({
    fetch: net.fetch,
    now: clock.now,
    sleep: clock.sleep,
    userAgent:
      "Mozilla/5.0 (compatible; VortexScan/1.0; +https://vortexhub.dev/privacy#vortex-scan-bot)",
    blockReason: (u) => (/^(127\.|10\.|localhost)/.test(u.hostname) ? "private" : null),
    resolve: async (host) =>
      (opts.live ?? ["x.ro", "www.x.ro"]).includes(host) ? "ok" : "nxdomain",
    deadline: clock.now() + 25_000,
  });
  return { clock, net, fetcher };
};

test("polite fetcher: robots first, ≥ 1 s per host, Crawl-delay, disallow, honest user agent", async () => {
  let ua = "";
  const { net, fetcher } = polite([
    [
      /robots\.txt$/,
      () =>
        new Response("User-agent: *\nDisallow: /privat\nCrawl-delay: 2\n", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    ],
    [
      /x\.ro\/$/,
      (_u, init) => {
        ua = new Headers(init?.headers).get("user-agent") ?? "";
        return html("<html><body>Acasă</body></html>");
      },
    ],
    [/x\.ro\/contact$/, () => html("<html><body>Contact</body></html>")],
  ]);
  const home = await fetcher.get("https://x.ro/");
  const contact = await fetcher.get("https://x.ro/contact");
  const blocked = await fetcher.get("https://x.ro/privat/a");
  assert.equal(home.ok && contact.ok, true);
  assert.equal(blocked.ok, false);
  assert.equal(!blocked.ok && blocked.reason, "robots");
  assert.match(ua, /VortexScan\/1\.0; \+https:\/\/vortexhub\.dev\/privacy#vortex-scan-bot/);
  assert.equal(net.calls[0].url, "https://x.ro/robots.txt", "robots.txt before the first page");
  const pages = net.calls.filter((c) => !c.url.endsWith("robots.txt"));
  assert.equal(pages.length, 2, "a disallowed path is never requested");
  assert.ok(pages[1].at - pages[0].at >= 2000, "Crawl-delay 2 s honoured");
  assert.ok(pages[0].at - net.calls[0].at >= 1000, "≥ 1 s after robots.txt on the same host");
});

test("polite fetcher: VortexScan opt-out, bot walls, 429s, private hosts, dead domains", async () => {
  const optOut = polite([
    [/robots\.txt$/, () => new Response("User-agent: VortexScan\nDisallow: /\n", { status: 200 })],
  ]);
  const r1 = await optOut.fetcher.get("https://x.ro/");
  assert.equal(!r1.ok && r1.reason, "optout");
  assert.equal(optOut.net.calls.length, 1, "nothing but robots.txt is requested");

  const wall = polite([
    [/robots\.txt$/, () => new Response("", { status: 404 })],
    [/x\.ro\/$/, () => html("<title>Just a moment...</title>", 403)],
    [/x\.ro\/contact$/, () => html("<p>ok</p>")],
  ]);
  const r2 = await wall.fetcher.get("https://x.ro/");
  assert.equal(!r2.ok && r2.blocked, "site-ul blochează accesul automat");
  const r3 = await wall.fetcher.get("https://x.ro/contact");
  assert.equal(r3.ok, false, "after a bot wall nothing more is requested from the host");
  assert.equal(wall.net.calls.filter((c) => c.url.endsWith("/contact")).length, 0);

  const limited = polite([
    [/robots\.txt$/, () => new Response("", { status: 404 })],
    [/x\.ro/, () => new Response("slow", { status: 429 })],
  ]);
  await limited.fetcher.get("https://x.ro/a");
  const r4 = await limited.fetcher.get("https://x.ro/b");
  assert.equal(!r4.ok && r4.reason, "blocked_by_site", "a repeated 429 stops the crawl");

  const priv = polite([]);
  const r5 = await priv.fetcher.get("http://127.0.0.1/");
  assert.equal(!r5.ok && r5.reason, "ssrf");
  const dead = polite([], { live: [] });
  const r6 = await dead.fetcher.get("https://gone.ro/");
  assert.equal(!r6.ok && r6.reason, "dns");
  assert.equal(dead.net.calls.length, 0);
});

test("polite fetcher: redirects re-checked per hop, other hosts get their own robots.txt", async () => {
  const { net, fetcher } = polite(
    [
      [/x\.ro\/robots\.txt$/, () => new Response("", { status: 404 })],
      [/www\.x\.ro\/robots\.txt$/, () => new Response("", { status: 404 })],
      [
        /^https:\/\/x\.ro\/$/,
        () => new Response(null, { status: 301, headers: { location: "https://www.x.ro/" } }),
      ],
      [/^https:\/\/www\.x\.ro\/$/, () => html("<p>home</p>")],
    ],
    { live: ["x.ro", "www.x.ro"] },
  );
  const r = await fetcher.get("https://x.ro/");
  assert.equal(r.ok && r.url, "https://www.x.ro/");
  const robots = net.calls.filter((c) => c.url.endsWith("robots.txt")).map((c) => c.url);
  assert.deepEqual(robots, ["https://x.ro/robots.txt", "https://www.x.ro/robots.txt"]);
});

test("polite fetcher: social hosts refused without a request; a 60 s Crawl-delay is honoured, not shortened", async () => {
  const { net, fetcher, clock } = polite(
    [
      [
        /robots\.txt$/,
        () =>
          new Response("User-agent: *\nCrawl-delay: 60\n", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      ],
      [/x\.ro\//, () => html("<html><body>Pagina</body></html>")],
    ],
    { live: ["x.ro", "facebook.com"] },
  );
  const social = await fetcher.get("https://www.facebook.com/exemplu");
  assert.equal(!social.ok && social.reason, "social");
  assert.equal(net.calls.length, 0, "nothing requested from a social network");
  // The first page would need a 60 s wait after robots.txt: refused within this step's 25 s,
  // never sent sooner.
  const home = await fetcher.get("https://x.ro/");
  assert.equal(!home.ok && home.reason, "budget");
  assert.equal(net.calls.filter((c) => !c.url.endsWith("robots.txt")).length, 0);
  assert.ok(clock.now() - net.calls[0].at < 25_000);
});

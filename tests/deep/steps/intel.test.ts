import assert from "node:assert/strict";
import { test } from "node:test";

import { readDeepConfig, SOCIAL_LINKS, type StepEnv } from "../../../src/lib/deep/env.server";
import {
  createMemoryStore,
  type MemoryStore,
} from "../../../src/lib/deep/llm/ledger-memory.server";
import { reservationUsd } from "../../../src/lib/deep/llm/budget";
import { LlmError, type LlmBlock, type LlmMessage } from "../../../src/lib/deep/llm/types";
import {
  claudeProfile,
  discoverSocial,
  parseNewsRss,
  parseProfile,
  PROFILE_INPUT_TOKENS,
  PROFILE_SEARCHES,
  readCapped,
  SEARCH_FEE_USD,
  searchesRun,
  searchNews,
} from "../../../src/lib/deep/steps/intel.server";
import { runSignals } from "../../../src/lib/deep/steps/signals.server";
import { fakeTransport } from "./helpers";

/*
 * The signals step's press, social and AI web-search parts (intel.server.ts): every request
 * with a timeout and a size cap, only search results ever fetched (no social network, no
 * link page), each AI item tied to a URL the search returned, the web-search profile billed
 * through the run ledger (tokens and the search fee), and every failure a gap. Scripted
 * fetch and transport only: no network, no Anthropic call.
 */

const NOW = Date.parse("2026-10-20T10:00:00Z");
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const config = readDeepConfig({ ANTHROPIC_API_KEY: "sk-test" });

type Seen = { url: string; signal: boolean };

function envWith(
  opts: {
    fetch?: (url: string, init?: RequestInit) => Promise<Response>;
    transport?: ReturnType<typeof fakeTransport> | null;
    store?: MemoryStore;
    runId?: string;
    dayCapUsd?: number;
    name?: string;
    left?: number;
  } = {},
) {
  const seen: Seen[] = [];
  const logs: Array<Record<string, unknown>> = [];
  const store = opts.store ?? createMemoryStore({ now: () => NOW });
  const t = { now: NOW };
  const env = {
    runId: opts.runId ?? "run-1",
    uid: UID,
    cui: "12345678",
    lang: "ro",
    relationship: "proprietar",
    step: "signals",
    deadline: NOW + (opts.left ?? 25_000),
    identity: {
      name: opts.name ?? "BRUTĂRIA DULCE SRL",
      displayName: "Brutăria Dulce",
      city: "Cluj-Napoca",
      county: "Cluj",
    },
    fetch: async (url: string, init?: RequestInit) => {
      seen.push({ url, signal: init?.signal instanceof AbortSignal });
      if (!opts.fetch) throw new Error("offline");
      return opts.fetch(url, init);
    },
    sources: { courts: false, ted: false, pagespeed: false },
    social: SOCIAL_LINKS,
    llm:
      opts.transport === null || opts.transport === undefined
        ? null
        : {
            transport: opts.transport,
            models: {
              synthesis: config.synthesisModel,
              extraction: config.extractModel,
              effort: "low",
            },
          },
    ledger: {
      reserve: (i: Parameters<MemoryStore["reserve"]>[0]) => store.reserve(i),
      settle: (i: Parameters<MemoryStore["settle"]>[0]) => store.settle(i),
      tripBreaker: (m: number, r?: string) => store.tripBreaker(m, r),
      runSpend: (id: string) => store.runSpend!(id),
      dayCapUsd: opts.dayCapUsd ?? config.dayBudgetUsd,
    },
    now: () => t.now,
    sleep: async () => undefined,
    log: (e: Record<string, unknown>) => logs.push(e),
    counters: () => ({ subrequests: seen.length, anafCalls: 0, politeRequests: 0 }),
  } as unknown as StepEnv;
  return { env, seen, logs, store };
}

async function runIn(store: MemoryStore, budgetUsd = 1.5) {
  const started = await store.startRun({
    userId: UID,
    cui: "12345678",
    relationship: "proprietar",
    lang: "ro",
    via: "free",
    budgetUsd,
    aiMode: "ai",
    consent: {} as never,
    userCap: 3,
    globalCap: 10,
    allowSameCompany: false,
  });
  assert.ok("runId" in started);
  return started.runId;
}

const rss = (items: Array<{ title: string; date: string; outlet?: string }>) =>
  `<?xml version="1.0"?><rss><channel>${items
    .map(
      (i, n) =>
        `<item><title>${i.title}${i.outlet ? ` - ${i.outlet}` : ""}</title><link>https://news.google.com/rss/articles/a${n}</link><pubDate>${new Date(i.date).toUTCString()}</pubDate>${i.outlet ? `<source url="https://x.ro">${i.outlet}</source>` : ""}</item>`,
    )
    .join("")}</channel></rss>`;

const ddg = (links: string[]) =>
  `<html><body>${links
    .map((l) => `<a href="//duckduckgo.com/l/?uddg=${encodeURIComponent(l)}&amp;rut=x">r</a>`)
    .join("")}</body></html>`;

/* ------------------------------------------------------------- requests */

test("every answer is read up to 1.5 MB and the rest is never downloaded", async () => {
  let pulled = 0;
  const chunk = new Uint8Array(256 * 1024).fill(97);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled++;
      if (pulled > 40) controller.close();
      else controller.enqueue(chunk);
    },
  });
  const text = await readCapped(new Response(body), 1_000_000);
  assert.equal(text.length, 1_000_000);
  assert.ok(pulled < 10, `stopped after ${pulled} chunks of 40`);
  // Multi-byte characters split across chunks decode whole.
  const parts = [new Uint8Array([0xc8]), new Uint8Array([0x99, 0x61])]; // "ș" + "a"
  const split = new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) c.enqueue(p);
      c.close();
    },
  });
  assert.equal(await readCapped(new Response(split)), "șa");
});

test("only Google News and the search page are fetched, each with a timeout; never a social network or a link page", async () => {
  const { env, seen } = envWith({
    fetch: async (url) => {
      if (url.startsWith("https://news.google.com/rss/search"))
        return new Response(
          rss([{ title: "Brutăria Dulce deschide un nou magazin", date: "2026-10-05" }]),
        );
      if (url.startsWith("https://lite.duckduckgo.com/lite/"))
        return new Response(
          ddg([
            "https://www.instagram.com/brutariadulce/",
            "https://linktr.ee/brutariadulce",
            "https://www.tiktok.com/@brutariadulce.ro",
            // A malformed escape in one result is skipped, not the whole search.
            "https://www.facebook.com/brutariadulce%E0%A4",
          ]),
        );
      throw new Error(`unexpected ${url}`);
    },
  });
  const [news, social] = await Promise.all([searchNews(env), discoverSocial(env)]);
  assert.equal(news?.length, 1);
  assert.deepEqual(
    social?.map((s) => s.url),
    ["https://www.instagram.com/brutariadulce", "https://www.tiktok.com/@brutariadulce.ro"],
  );
  assert.ok(seen.length > 0);
  for (const r of seen) {
    const host = new URL(r.url).hostname;
    assert.ok(["news.google.com", "lite.duckduckgo.com"].includes(host), host);
    assert.equal(r.signal, true, `${r.url} has a timeout`);
  }
});

test("press: every word of the brand must be in the headline (one common word attaches other companies)", () => {
  const xml = rss([
    {
      title: "Brutăria Dulce deschide un nou magazin",
      date: "2026-10-05",
      outlet: "Ziarul de Cluj",
    },
    { title: "Dulce Vita, amendă ANPC pentru un magazin din Iași", date: "2026-10-04" },
    { title: "Brutăria din centru a intrat în insolvență", date: "2026-10-03" },
  ]);
  const items = parseNewsRss(xml, ["brutaria", "dulce"], NOW - 730 * 86_400_000);
  assert.deepEqual(
    items.map((i) => [i.title, i.tone, i.outlet]),
    [["Brutăria Dulce deschide un nou magazin", "growth", "Ziarul de Cluj"]],
  );
  assert.deepEqual(parseNewsRss(xml, [], 0), [], "no brand word: nothing matches");
});

test("no brand word to search by: not searched, so a gap, never 'no press coverage'", async () => {
  const { env, seen } = envWith({ name: "AB SRL", fetch: async () => new Response("") });
  assert.equal(await searchNews(env), null);
  assert.equal(await discoverSocial(env), null);
  assert.equal(seen.length, 0);
});

/* ------------------------------------------------------- the AI profile */

const RESULTS = [
  "https://www.instagram.com/brutariadulce/p/abc",
  "https://www.tiktok.com/@brutariadulce",
  "https://ziar.ro/articol-brutaria",
];

function answer(): LlmBlock[] {
  return [
    { type: "text", text: "Caut firma. {not json}" },
    { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "Brutăria Dulce" } },
    {
      type: "web_search_tool_result",
      tool_use_id: "s1",
      content: RESULTS.map((url) => ({ type: "web_search_result", url, title: "t" })),
    },
    {
      type: "server_tool_use",
      id: "s2",
      name: "web_search",
      input: { query: "Brutăria Dulce Cluj" },
    },
    // An error answer is an object, not a list: no URL comes from it.
    {
      type: "web_search_tool_result",
      tool_use_id: "s2",
      content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" },
    },
    // The JSON arrives split by a citation, inside a string.
    {
      type: "text",
      text: '{"social":[{"url":"https://instagram.com/brutariadulce/"},{"url":"https://www.facebook.com/brutariadulce"},{"url":"https://www.tiktok.com/@brutaria"}],"tradeNames":[{"text":"Brutăria',
    },
    {
      type: "text",
      text: ' Dulce","source":"https://ziar.ro/articol-brutaria"}],"people":[{"role":"administrator","text":"Ion Pop, fondator","source":"https://invented.example/x"},{"text":"fără rol","source":"https://ziar.ro/articol-brutaria"}],"reviews":[{"text":"4,8 pe Google","source":"https://ziar.ro/articol-brutaria/"}],"customers":"none","ads":[],"events":[null]}',
      citations: [{ type: "web_search_result_location", cited_text: "Brutăria Dulce" }],
    },
  ];
}

const reply = (content: LlmBlock[], searches = 2): LlmMessage =>
  ({
    model: "claude-haiku-4-5-20251001",
    content,
    stop_reason: "end_turn",
    usage: {
      input_tokens: 30_000,
      output_tokens: 600,
      server_tool_use: { web_search_requests: searches },
    },
  }) as unknown as LlmMessage;

test("every AI item cites a URL the search returned; a profile counts only when the search returned it", () => {
  const profile = parseProfile(answer() as Array<Record<string, unknown>>, SOCIAL_LINKS);
  assert.ok(profile);
  // Instagram: the search returned a post on it. Facebook: never returned. TikTok "@brutaria":
  // the search returned "@brutariadulce", a different handle (a prefix is not the profile).
  assert.deepEqual(profile.social, [
    { platform: "instagram", url: "https://instagram.com/brutariadulce", via: "ai_search" },
  ]);
  assert.deepEqual(profile.tradeNames, [
    { text: "Brutăria Dulce", source: "https://ziar.ro/articol-brutaria" },
  ]);
  assert.deepEqual(profile.people, [], "an invented URL and an item without a role are dropped");
  assert.deepEqual(profile.reviews, [
    { text: "4,8 pe Google", source: "https://ziar.ro/articol-brutaria/" },
  ]);
  assert.deepEqual(profile.customers, []);
  assert.deepEqual(profile.events, []);
  // No JSON, or JSON that is not an object: no profile.
  assert.equal(parseProfile([{ type: "text", text: "Nu am găsit nimic." }], SOCIAL_LINKS), null);
  assert.equal(parseProfile([{ type: "text", text: "[1, 2]" }], SOCIAL_LINKS), null);
  // Nothing returned by a search: nothing cited.
  const unsearched = parseProfile(
    [
      {
        type: "text",
        text: '{"tradeNames":[{"text":"X","source":"https://ziar.ro/articol-brutaria"}]}',
      },
    ],
    SOCIAL_LINKS,
  );
  assert.deepEqual(unsearched?.tradeNames, []);
});

test("the profile call: Haiku 4.5 with basic web search, at most 3 searches, tokens and search fee in the ledger", async () => {
  const store = createMemoryStore({ now: () => NOW });
  const runId = await runIn(store);
  const transport = fakeTransport({ create: () => reply(answer()) });
  const { env } = envWith({ store, runId, transport });
  const profile = await claudeProfile(env);
  assert.equal(profile?.tradeNames.length, 1);
  assert.equal(transport.requests.length, 1);
  const body = transport.requests[0].body as Record<string, unknown>;
  assert.equal(body.model, "claude-haiku-4-5-20251001");
  assert.equal(config.synthesisModel, "claude-opus-5-5");
  assert.deepEqual(body.tools, [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }]);
  assert.equal(PROFILE_SEARCHES, 3);
  // Reserved before sending: the search fee apart, the tokens at the worst case of the loop.
  const calls = store.calls(runId);
  assert.equal(calls.length, 2);
  const fee = calls.find((c) => c.idemKey.endsWith("|fee"))!;
  const tokens = calls.find((c) => !c.idemKey.endsWith("|fee"))!;
  assert.equal(fee.reservedUsd, PROFILE_SEARCHES * SEARCH_FEE_USD);
  assert.ok(PROFILE_INPUT_TOKENS >= 100_000);
  assert.ok(
    Math.abs(
      tokens.reservedUsd -
        reservationUsd({
          model: "claude-haiku-4-5-20251001",
          inputTokens: PROFILE_INPUT_TOKENS,
          maxTokens: 1500,
          fallback: false,
        }),
    ) < 1e-6,
  );
  // Settled at the real cost: 30,000 in and 600 out on Haiku, and the 2 searches it ran.
  assert.equal(fee.status, "settled");
  assert.ok(Math.abs(fee.usd - 0.02) < 1e-9);
  assert.ok(Math.abs(tokens.usd - 0.033) < 1e-9);
  const spend = await store.runSpend(runId);
  assert.ok(Math.abs(spend!.spentUsd - 0.053) < 1e-9);
  assert.equal(spend!.reservedUsd, 0);
});

test("a retried step gets the same profile from the ledger, without paying twice", async () => {
  const store = createMemoryStore({ now: () => NOW });
  const runId = await runIn(store);
  const transport = fakeTransport({ create: () => reply(answer()) });
  const first = await claudeProfile(envWith({ store, runId, transport }).env);
  const spent = (await store.runSpend(runId))!.spentUsd;
  const again = await claudeProfile(envWith({ store, runId, transport }).env);
  assert.deepEqual(again, first);
  assert.equal(transport.requests.length, 1);
  assert.equal((await store.runSpend(runId))!.spentUsd, spent);
  assert.equal((await store.runSpend(runId))!.reservedUsd, 0);
});

test("the run budget, the day budget and the breaker stop the profile call before it is sent", async () => {
  // Run budget: $0.10 left cannot hold the worst case.
  {
    const store = createMemoryStore({ now: () => NOW });
    const runId = await runIn(store, 0.1);
    const transport = fakeTransport({ create: () => reply(answer()) });
    assert.equal(await claudeProfile(envWith({ store, runId, transport }).env), null);
    assert.equal(transport.requests.length, 0);
    const spend = await store.runSpend(runId);
    assert.deepEqual([spend!.spentUsd, spend!.reservedUsd], [0, 0]);
  }
  // Day budget: room for the fee, not for the tokens.
  {
    const store = createMemoryStore({ now: () => NOW });
    const runId = await runIn(store);
    const transport = fakeTransport({ create: () => reply(answer()) });
    const { env } = envWith({ store, runId, transport, dayCapUsd: 0.05 });
    assert.equal(await claudeProfile(env), null);
    assert.equal(transport.requests.length, 0);
    assert.equal((await store.runSpend(runId))!.reservedUsd, 0);
  }
  // Breaker open (a billing error in any run).
  {
    const store = createMemoryStore({ now: () => NOW });
    const runId = await runIn(store);
    await store.tripBreaker(15, "billing");
    const transport = fakeTransport({ create: () => reply(answer()) });
    assert.equal(await claudeProfile(envWith({ store, runId, transport }).env), null);
    assert.equal(transport.requests.length, 0);
  }
  // Rules-only run, or too little time left: not even a reservation.
  {
    const store = createMemoryStore({ now: () => NOW });
    const runId = await runIn(store);
    assert.equal(await claudeProfile(envWith({ store, runId, transport: null }).env), null);
    const transport = fakeTransport({ create: () => reply(answer()) });
    assert.equal(await claudeProfile(envWith({ store, runId, transport, left: 12_000 }).env), null);
    assert.equal(store.calls(runId).length, 0);
  }
});

test("a timeout keeps the fee and the tokens reserved (counted as spent at finish); a refused request frees them", async () => {
  {
    const store = createMemoryStore({ now: () => NOW });
    const runId = await runIn(store);
    const transport = fakeTransport({
      create: () => {
        throw new LlmError("timeout", "Request timed out");
      },
    });
    assert.equal(await claudeProfile(envWith({ store, runId, transport }).env), null);
    assert.deepEqual(
      store.calls(runId).map((c) => c.status),
      ["reserved", "reserved"],
    );
  }
  {
    const store = createMemoryStore({ now: () => NOW });
    const runId = await runIn(store);
    const transport = fakeTransport({
      create: () => {
        throw new LlmError("invalid_request", "tool not supported", 400);
      },
    });
    assert.equal(await claudeProfile(envWith({ store, runId, transport }).env), null);
    assert.ok(store.calls(runId).every((c) => c.status === "settled" && c.usd === 0));
  }
});

test("searches run: the usage count, or the search calls in the answer", () => {
  assert.equal(searchesRun(reply(answer(), 3)), 3);
  const noCount = { ...reply(answer()), usage: { input_tokens: 1, output_tokens: 1 } };
  assert.equal(searchesRun(noCount as LlmMessage), 2);
});

test("the signals step degrades: no answer from news, search or AI becomes gaps, never an error", async () => {
  const store = createMemoryStore({ now: () => NOW });
  const runId = await runIn(store);
  const transport = fakeTransport({
    create: () => {
      throw new Error("socket hang up");
    },
  });
  const { env } = envWith({ store, runId, transport });
  const draft = await runSignals(env);
  const gaps = draft.gaps.map((g) => g.what.ro);
  assert.ok(gaps.includes("Apariții în presă"), gaps.join(" | "));
  assert.ok(gaps.includes("Profiluri sociale prin căutare"));
  assert.ok(gaps.includes("Profilul firmei din căutarea web cu AI"));
  assert.equal(draft.facts.filter((f) => f.source === "web_search").length, 0);
  // Rules-only runs make no AI call and add no AI gap.
  const rules = await runSignals(envWith({ store, runId, transport: null }).env);
  assert.ok(!rules.gaps.some((g) => g.what.ro === "Profilul firmei din căutarea web cu AI"));
});

test("the signals step with answers: press, social and the AI profile, each fact with its source", async () => {
  const store = createMemoryStore({ now: () => NOW });
  const runId = await runIn(store);
  const transport = fakeTransport({ create: () => reply(answer()) });
  const { env } = envWith({
    store,
    runId,
    transport,
    fetch: async (url) =>
      url.includes("news.google.com")
        ? new Response(
            rss([{ title: "Brutăria Dulce deschide un nou magazin", date: "2026-10-05" }]),
          )
        : new Response(ddg(["https://www.instagram.com/brutariadulce/"])),
  });
  const draft = await runSignals(env);
  const ids = draft.facts.map((f) => f.id);
  for (const id of [
    "presence.news.count",
    "presence.news.item.0",
    "presence.social_found.instagram",
    "profile.tradeNames.0",
    "profile.reviews.0",
  ])
    assert.ok(ids.includes(id), id);
  for (const f of draft.facts.filter((x) => x.method === "llm"))
    assert.ok(
      RESULTS.some((u) => f.evidence?.url?.replace(/\/$/, "") === u),
      f.id,
    );
  assert.ok(!draft.gaps.some((g) => g.what.ro === "Profilul firmei din căutarea web cu AI"));
});

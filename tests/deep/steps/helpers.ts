/*
 * Test helpers: a virtual clock (sleep advances time instantly), a scripted
 * fetch that records every request with its virtual start time, a fake DNS
 * resolver and a fake LLM transport. No network, no Anthropic calls.
 */
import type { DnsResolver } from "../../../src/lib/deep/env.server";
import type {
  LlmBlock,
  LlmMessage,
  LlmRequest,
  LlmTransport,
} from "../../../src/lib/deep/llm/types";

export function virtualClock(start = Date.UTC(2026, 9, 3, 9, 0, 0)) {
  const clock = {
    t: start,
    now: () => clock.t,
    sleep: async (ms: number) => {
      clock.t += Math.max(0, ms);
    },
  };
  return clock;
}

export type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>;

export function scriptedFetch(
  routes: Array<[RegExp, Route]>,
  clock: { now: () => number; t: number },
  latencyMs = 20,
) {
  const calls: Array<{ url: string; method: string; at: number }> = [];
  const fetch = async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input);
    calls.push({ url: url.href, method: init?.method ?? "GET", at: clock.now() });
    clock.t += latencyMs;
    for (const [pattern, route] of routes) if (pattern.test(url.href)) return route(url, init);
    return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
  };
  return { fetch, calls };
}

export const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export function fakeDns(live: string[], records: Record<string, string[]> = {}): DnsResolver {
  const isLive = (host: string) =>
    live.some((h) => host === h || host === `www.${h}` || `www.${host}` === h);
  return {
    async publicHost(host) {
      return isLive(host) ? "ok" : "nxdomain";
    },
    async records(name, type) {
      if (type === "A")
        return isLive(name)
          ? { status: "ok", data: ["93.184.216.34"] }
          : { status: "nxdomain", data: [] };
      return { status: "ok", data: records[`${type}:${name}`] ?? [] };
    },
  };
}

/** A fake transport: scripted responses per call kind, every request recorded. */
export function fakeTransport(script: {
  parse?: (body: LlmRequest & { schema: unknown }) => LlmMessage | Promise<LlmMessage>;
  create?: (body: LlmRequest) => LlmMessage | Promise<LlmMessage>;
  stream?: (body: LlmRequest) => LlmMessage | Promise<LlmMessage>;
  tokens?: number;
}): LlmTransport & { requests: Array<{ kind: string; body: Record<string, unknown> }> } {
  const requests: Array<{ kind: string; body: Record<string, unknown> }> = [];
  return {
    requests,
    async parse(body) {
      requests.push({ kind: "parse", body });
      if (!script.parse) throw new Error("no parse script");
      return script.parse(body);
    },
    async create(body) {
      requests.push({ kind: "create", body });
      if (!script.create) throw new Error("no create script");
      return script.create(body);
    },
    async stream(body) {
      requests.push({ kind: "stream", body });
      if (!script.stream) throw new Error("no stream script");
      return script.stream(body);
    },
    async countTokens(body) {
      requests.push({ kind: "count", body });
      return script.tokens ?? 6000;
    },
  };
}

export function message(content: LlmBlock[], opts: Partial<LlmMessage> = {}): LlmMessage {
  return {
    model: "claude-opus-5-5",
    content,
    stop_reason: "end_turn",
    usage: {
      input_tokens: 500,
      output_tokens: 800,
      cache_read_input_tokens: 6000,
      cache_creation_input_tokens: 0,
    },
    ...opts,
  };
}

/** A cited text block: document index, block range. */
export const cited = (text: string, doc: number, start: number, end = start + 1): LlmBlock => ({
  type: "text",
  text,
  citations: [
    {
      type: "content_block_location",
      document_index: doc,
      start_block_index: start,
      end_block_index: end,
      cited_text: "",
    },
  ],
});
export const plain = (text: string): LlmBlock => ({ type: "text", text });

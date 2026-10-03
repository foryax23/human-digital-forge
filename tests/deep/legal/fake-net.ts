/*
 * Replaces globalThis.fetch for the quick-scan modules (net, discovery, audit,
 * ANAF) that call fetch directly. Routes answer by URL; every request is
 * recorded with its start time. Always restore() in a finally block.
 */

export type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>;

export function installFetch(routes: Array<[RegExp, Route]>) {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; method: string; at: number; end?: number }> = [];
  let inFlight = 0;
  let maxInFlight = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    const call: { url: string; method: string; at: number; end?: number } = {
      url: url.href,
      method: init?.method ?? "GET",
      at: Date.now(),
    };
    calls.push(call);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      for (const [pattern, route] of routes)
        if (pattern.test(url.href)) return await route(url, init);
      return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
    } finally {
      inFlight--;
      call.end = Date.now();
    }
  }) as typeof fetch;
  return {
    calls,
    maxInFlight: () => maxInFlight,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

/** A DNS-over-HTTPS answer: public A record for live hosts, NXDOMAIN otherwise. */
export function doh(live: string[]): [RegExp, Route] {
  return [
    /cloudflare-dns\.com\/dns-query/,
    (url) => {
      const name = url.searchParams.get("name") ?? "";
      const type = url.searchParams.get("type");
      const ok = live.includes(name);
      return new Response(
        JSON.stringify(
          ok && type === "A"
            ? { Status: 0, Answer: [{ type: 1, data: "93.184.216.34" }] }
            : ok
              ? { Status: 0, Answer: [] }
              : { Status: 3 },
        ),
        { status: 200, headers: { "content-type": "application/dns-json" } },
      );
    },
  ];
}

export const page = (
  body: string,
  headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" },
  status = 200,
) => new Response(body, { status, headers });

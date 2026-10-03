import { robotsFromResponse, robotsUnavailable, type RobotsPolicy } from "../parse/robots";
import { isSocialOrDirectoryHost, looksLikeHtml } from "../parse/web";

/*
 * The polite fetcher of deep research (plan A9, B4, B5): honest user agent,
 * robots.txt (the VortexScan group, else "*") before the first page on every
 * host, one request in flight per host, at least 1 s between requests to the
 * same host (more when Crawl-delay says so, never less), manual redirects re-validated on
 * every hop (public hosts on ports 80/443 only, DNS answers checked), a body
 * cap, and a stop at any login wall, CAPTCHA or bot challenge, 401, 403 or
 * repeated 429 ("site-ul blochează accesul automat"). Social networks and
 * company directories are refused outright. Everything it needs is
 * injected, so it runs on Workers, in Node and in tests.
 */

export type PoliteDeps = {
  /** Counted fetch (every request counts towards the step's subrequest budget). */
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  userAgent: string;
  /** Lexical SSRF policy (scheme, credentials, private literals, ports): a reason or null. */
  blockReason: (url: URL) => string | null;
  /** DNS policy: "ok", "nxdomain", "private" or "error" (resolver failed: fail closed). */
  resolve: (host: string) => Promise<"ok" | "nxdomain" | "private" | "error">;
  /** Optional allow-list of hosts (golden runs: only the trial companies' own sites). */
  hostAllowed?: (host: string) => boolean;
  deadline: number;
  log?: (event: Record<string, unknown>) => void;
};

export type PoliteOptions = {
  minGapMs?: number;
  /** Bytes kept from the start of a body (default 256 KB). */
  maxBytes?: number;
  /** Bytes kept from the end of an HTML body (footer with the CUI), on top of maxBytes. */
  tailBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
};

export type PolitePage = {
  ok: true;
  status: number;
  url: string;
  requestedUrl: string;
  contentType: string;
  text: string;
  headers: Record<string, string>;
  redirects: string[];
  ttfbMs: number;
  truncated: boolean;
  html: boolean;
};
export type PoliteRefusal = {
  ok: false;
  /** Owner-facing reason in Romanian, for gaps. */
  blocked: string;
  reason:
    | "robots"
    | "optout"
    | "blocked_by_site"
    | "tls"
    | "dns"
    | "timeout"
    | "network"
    | "ssrf"
    | "not_allowed_host"
    /** Social networks and company directories are never fetched (A9, D4). */
    | "social"
    | "budget";
  url: string;
};
export type PoliteResult = PolitePage | PoliteRefusal;

const PACE_MARGIN_MS = 30;

/** A Crawl-delay above this leaves no room for more pages in a step: the pages stay unread. */
export const LONG_CRAWL_DELAY_MS = 10_000;

const CHALLENGE =
  /just a moment|cf-chl|challenge-platform|attention required|checking your browser|sgcaptcha|incapsula incident|ddos protection|captcha|verify you are human/i;

const REFUSAL_TEXT: Record<PoliteRefusal["reason"], string> = {
  robots: "robots.txt nu permite citirea acestei pagini",
  optout: "site-ul cere în robots.txt să nu fie citit de VortexScan",
  blocked_by_site: "site-ul blochează accesul automat",
  tls: "certificatul de securitate al site-ului nu este valid",
  dns: "domeniul nu există sau nu răspunde",
  timeout: "site-ul nu a răspuns la timp",
  network: "site-ul nu a putut fi accesat",
  ssrf: "adresa nu este un site public",
  not_allowed_host: "adresa nu este pe lista permisă pentru această rulare de test",
  social: "rețelele sociale și cataloagele de firme nu sunt citite",
  budget: "timpul sau numărul de cereri al acestui pas s-a terminat",
};

function classifyError(error: unknown): PoliteRefusal["reason"] {
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
  const code = cause?.code ?? (error as { code?: string })?.code ?? "";
  const message = `${(error as Error)?.message ?? ""} ${cause?.message ?? ""}`;
  if ((error as Error)?.name === "TimeoutError" || /aborted|timeout/i.test(message))
    return "timeout";
  if (/ENOTFOUND|EAI_AGAIN|ENODATA/.test(code)) return "dns";
  if (
    /CERT|SSL|TLS|SELF_SIGNED|ERR_TLS/i.test(code) ||
    /certificate|ssl|tls handshake/i.test(message)
  )
    return "tls";
  return "network";
}

function decoderFor(contentType: string, head: Uint8Array): TextDecoder {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const sniff = fromHeader ? "" : String.fromCharCode(...head.subarray(0, 2048));
  const charset = (
    fromHeader ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1] ??
    "utf-8"
  ).toLowerCase();
  try {
    return new TextDecoder(charset);
  } catch {
    return new TextDecoder("utf-8");
  }
}

async function readCapped(response: Response, head: number, tail: number) {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const first: Uint8Array[] = [];
  let firstLen = 0;
  const last: Uint8Array[] = [];
  let lastLen = 0;
  let truncated = false;
  const hardCap = head + 2 * 1024 * 1024;
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (firstLen < head) {
      const take = value.subarray(0, head - firstLen);
      first.push(take);
      firstLen += take.byteLength;
      if (take.byteLength < value.byteLength) {
        truncated = true;
        last.push(value.subarray(take.byteLength));
        lastLen += value.byteLength - take.byteLength;
      }
    } else {
      truncated = true;
      last.push(value);
      lastLen += value.byteLength;
      while (lastLen - (last[0]?.byteLength ?? 0) >= tail && last.length > 1)
        lastLen -= last.shift()!.byteLength;
    }
    if (total >= hardCap) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  const join = (parts: Uint8Array[], len: number) => {
    const out = new Uint8Array(len);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.byteLength;
    }
    return out;
  };
  const headBytes = join(first, firstLen);
  const decoder = decoderFor(response.headers.get("content-type") ?? "", headBytes);
  let text = decoder.decode(headBytes);
  if (truncated && tail > 0 && lastLen) {
    const tailBytes = join(last, lastLen);
    text += `\n<!-- vortex: middle of the page skipped -->\n${decoder.decode(tailBytes.subarray(Math.max(0, tailBytes.byteLength - tail)))}`;
  }
  return { text, truncated };
}

export type PoliteFetcher = {
  get(
    url: string,
    opts?: { accept?: string; skipRobots?: boolean; method?: "GET" | "HEAD" },
  ): Promise<PoliteResult>;
  robots(origin: string): Promise<RobotsPolicy>;
  /** Seeds a host's robots.txt from a sealed cursor so later steps do not refetch it. */
  seedRobots(origin: string, status: number, body: string): void;
  /** robots.txt text seen for an origin (to carry in a cursor). */
  robotsText(origin: string): { status: number; body: string } | undefined;
  /** Hosts that refused us (401/403/429/challenge): nothing more is requested from them. */
  blockedHosts(): string[];
  /** Earliest next request per host (carried in cursors so spacing holds across steps). */
  hostSchedule(): Record<string, number>;
  /** Seeds the per-host schedule from a cursor. */
  seedSchedule(schedule: Record<string, number> | undefined): void;
  requests(): Array<{ url: string; status: number; at: number }>;
};

export function createPoliteFetcher(deps: PoliteDeps, options: PoliteOptions = {}): PoliteFetcher {
  const minGap = options.minGapMs ?? 1000;
  const maxBytes = options.maxBytes ?? 256 * 1024;
  const tailBytes = options.tailBytes ?? 48 * 1024;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRedirects = options.maxRedirects ?? 5;
  const robots = new Map<string, Promise<RobotsPolicy>>();
  const robotsRaw = new Map<string, { status: number; body: string }>();
  const hostQueue = new Map<string, Promise<unknown>>();
  const hostNextAt = new Map<string, number>();
  const hostGap = new Map<string, number>();
  const blocked = new Map<string, number>();
  const log: Array<{ url: string; status: number; at: number }> = [];
  const dnsCache = new Map<string, Promise<"ok" | "nxdomain" | "private" | "error">>();

  const refuse = (url: string, reason: PoliteRefusal["reason"]): PoliteRefusal => ({
    ok: false,
    blocked: REFUSAL_TEXT[reason],
    reason,
    url,
  });

  /** Runs `task` when the host is free and its spacing has passed (one in flight per host). */
  /** One task at a time per host (requests of a host never overlap). */
  function onHost<T>(host: string, task: () => Promise<T>): Promise<T> {
    const previous = hostQueue.get(host) ?? Promise.resolve();
    const run = previous.then(task);
    hostQueue.set(
      host,
      run.catch(() => undefined),
    );
    return run;
  }

  /**
   * Waits until the host's next slot and books the following one, right
   * before the request goes out (so DNS time never shortens the gap). Every
   * hop of a redirect on the same host is paced too.
   */
  async function pace(host: string): Promise<boolean> {
    const wait = (hostNextAt.get(host) ?? 0) - deps.now();
    if (wait > 0) {
      if (deps.now() + wait > deps.deadline - 1500) return false;
      await deps.sleep(wait);
    }
    // A small margin keeps the gap at ≥ 1 s even when the request leaves a few ms after booking.
    hostNextAt.set(host, deps.now() + (hostGap.get(host) ?? minGap) + PACE_MARGIN_MS);
    return true;
  }

  async function checkHost(url: URL): Promise<PoliteRefusal["reason"] | null> {
    if (deps.blockReason(url)) return "ssrf";
    if (isSocialOrDirectoryHost(url.hostname)) return "social";
    if (deps.hostAllowed && !deps.hostAllowed(url.hostname)) return "not_allowed_host";
    let dns = dnsCache.get(url.hostname);
    if (!dns) {
      dns = deps.resolve(url.hostname).catch(() => "error" as const);
      dnsCache.set(url.hostname, dns);
    }
    const answer = await dns;
    if (answer === "nxdomain") return "dns";
    if (answer === "private") return "ssrf";
    if (answer === "error") return "dns";
    return null;
  }

  /** One request with manual redirects; no robots, no spacing (callers handle both). */
  async function rawFetch(
    input: string,
    accept: string,
    method: "GET" | "HEAD",
  ): Promise<PolitePage | PoliteRefusal> {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return refuse(input, "ssrf");
    }
    url.hash = "";
    const redirects: string[] = [];
    for (let hop = 0; ; hop++) {
      const reason = await checkHost(url);
      if (reason) return refuse(url.href, reason);
      if (!(await pace(url.host))) return refuse(url.href, "budget");
      const remaining = deps.deadline - deps.now() - 500;
      if (remaining < 1500) return refuse(url.href, "budget");
      const started = deps.now();
      let response: Response;
      try {
        const pending = deps.fetch(url.href, {
          method,
          redirect: "manual",
          signal: AbortSignal.timeout(Math.min(timeoutMs, remaining)),
          headers: {
            "user-agent": deps.userAgent,
            accept,
            "accept-language": "ro-RO,ro;q=0.9,en;q=0.8",
          },
        });
        // Re-booked once the request has really left (a busy event loop must not shorten the gap).
        hostNextAt.set(
          url.host,
          Math.max(
            hostNextAt.get(url.host) ?? 0,
            deps.now() + (hostGap.get(url.host) ?? minGap) + PACE_MARGIN_MS,
          ),
        );
        response = await pending;
      } catch (error) {
        const kind =
          (error as Error)?.message === "subrequest_budget" ? "budget" : classifyError(error);
        deps.log?.({ polite: url.href, error: kind });
        return refuse(url.href, kind);
      }
      const location = response.headers.get("location");
      if ([301, 302, 303, 307, 308].includes(response.status) && location) {
        await response.body?.cancel().catch(() => undefined);
        if (hop >= maxRedirects) return refuse(url.href, "network");
        let next: URL;
        try {
          next = new URL(location, url);
        } catch {
          return refuse(url.href, "network");
        }
        redirects.push(next.href);
        log.push({ url: url.href, status: response.status, at: started });
        // A redirect to another host: that host gets its own spacing and robots check by the caller.
        if (next.host !== url.host) {
          return {
            ok: true,
            status: response.status,
            url: next.href,
            requestedUrl: input,
            contentType: "",
            text: "",
            headers: { location: next.href },
            redirects,
            ttfbMs: deps.now() - started,
            truncated: false,
            html: false,
          };
        }
        url = next;
        continue;
      }
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (key !== "set-cookie") headers[key] = value.slice(0, 500);
      });
      const setCookie =
        (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
      if (setCookie.length)
        headers["set-cookie"] = setCookie.map((c) => c.split("=")[0]).join("; ");
      const ttfbMs = deps.now() - started;
      const contentType = response.headers.get("content-type") ?? "";
      let text = "";
      let truncated = false;
      if (method === "GET") {
        const htmlLike = /html|xml|text|json/i.test(contentType) || !contentType;
        if (htmlLike) ({ text, truncated } = await readCapped(response, maxBytes, tailBytes));
        else await response.body?.cancel().catch(() => undefined);
      } else {
        await response.body?.cancel().catch(() => undefined);
      }
      log.push({ url: url.href, status: response.status, at: started });
      deps.log?.({ polite: url.href, status: response.status, ms: ttfbMs, at: started });
      return {
        ok: true,
        status: response.status,
        url: url.href,
        requestedUrl: input,
        contentType,
        text,
        headers,
        redirects,
        ttfbMs,
        truncated,
        html: looksLikeHtml(contentType, text.slice(0, 600)),
      };
    }
  }

  function getRobots(origin: string): Promise<RobotsPolicy> {
    let policy = robots.get(origin);
    if (!policy) {
      const host = new URL(origin).host;
      policy = onHost(host, async () => {
        const result = await rawFetch(`${origin}/robots.txt`, "text/plain,*/*;q=0.5", "GET");
        if (!result.ok) {
          // A refused robots.txt (network, DNS, TLS) means: crawl nothing on this host.
          return { ...robotsUnavailable(), fetchError: result.reason } as RobotsPolicy & {
            fetchError?: string;
          };
        }
        if (result.status >= 300 && result.status < 400) {
          // robots.txt redirects (to https or www.): follow once on the new origin.
          return robotsFromResponse(404, "");
        }
        robotsRaw.set(origin, { status: result.status, body: result.text.slice(0, 64 * 1024) });
        const parsed = robotsFromResponse(result.status, result.text);
        // The real Crawl-delay, never shortened: a delay longer than a step leaves the
        // pages unread (the audit and crawl say so) rather than crawled faster than asked.
        // It also applies between robots.txt itself and the first page.
        if (parsed.crawlDelay) {
          const delay = Math.max(minGap, parsed.crawlDelay * 1000);
          hostGap.set(host, delay);
          hostNextAt.set(
            host,
            Math.max(hostNextAt.get(host) ?? 0, deps.now() + delay + PACE_MARGIN_MS),
          );
        }
        return parsed;
      }).catch(() => robotsUnavailable());
      robots.set(origin, policy);
    }
    return policy;
  }

  return {
    async get(input, opts = {}) {
      let current = input;
      const accept =
        opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
      const method = opts.method ?? "GET";
      for (let hops = 0; hops < 4; hops++) {
        let url: URL;
        try {
          url = new URL(current);
        } catch {
          return refuse(current, "ssrf");
        }
        if (blocked.has(url.host)) return refuse(url.href, "blocked_by_site");
        const preReason = deps.blockReason(url);
        if (preReason) return refuse(url.href, "ssrf");
        if (isSocialOrDirectoryHost(url.hostname)) return refuse(url.href, "social");
        if (deps.hostAllowed && !deps.hostAllowed(url.hostname))
          return refuse(url.href, "not_allowed_host");
        if (!opts.skipRobots) {
          const policy = (await getRobots(url.origin)) as RobotsPolicy & {
            fetchError?: PoliteRefusal["reason"];
          };
          if (policy.fetchError) return refuse(url.href, policy.fetchError);
          if (policy.optsOut) return refuse(url.href, "optout");
          if (!policy.isAllowed(`${url.pathname}${url.search}`)) return refuse(url.href, "robots");
        }
        let result: PoliteResult;
        try {
          result = await onHost(url.host, () => rawFetch(url.href, accept, method));
        } catch {
          return refuse(url.href, "budget");
        }
        if (!result.ok) return result;
        if ([301, 302, 303, 307, 308].includes(result.status) && result.headers.location) {
          current = result.headers.location;
          continue;
        }
        const challenge =
          result.headers["cf-mitigated"] === "challenge" ||
          ([403, 429, 503].includes(result.status) && CHALLENGE.test(result.text.slice(0, 20_000)));
        if ([401, 403].includes(result.status) || challenge) {
          blocked.set(url.host, deps.now());
          return refuse(url.href, "blocked_by_site");
        }
        if (result.status === 429) {
          const strikes = (blocked.get(`429:${url.host}`) ?? 0) + 1;
          blocked.set(`429:${url.host}`, strikes);
          hostGap.set(url.host, Math.max(hostGap.get(url.host) ?? minGap, 5000));
          if (strikes >= 2) {
            blocked.set(url.host, deps.now());
            return refuse(url.href, "blocked_by_site");
          }
        }
        return result.requestedUrl === input ? result : { ...result, requestedUrl: input };
      }
      return refuse(input, "network");
    },
    robots: getRobots,
    seedRobots(origin, status, body) {
      if (robots.has(origin)) return;
      robotsRaw.set(origin, { status, body });
      const parsed = robotsFromResponse(status, body);
      if (parsed.crawlDelay)
        hostGap.set(new URL(origin).host, Math.max(minGap, parsed.crawlDelay * 1000));
      robots.set(origin, Promise.resolve(parsed));
    },
    robotsText: (origin) => robotsRaw.get(origin),
    blockedHosts: () => [...blocked.keys()].filter((k) => !k.startsWith("429:")),
    hostSchedule: () => Object.fromEntries(hostNextAt),
    seedSchedule(schedule) {
      for (const [host, at] of Object.entries(schedule ?? {})) {
        if (typeof at === "number") hostNextAt.set(host, Math.max(hostNextAt.get(host) ?? 0, at));
      }
    },
    requests: () => [...log],
  };
}

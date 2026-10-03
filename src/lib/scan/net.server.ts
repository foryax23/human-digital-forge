import { SCAN_USER_AGENT } from "@/lib/scan/legal/bot";

/**
 * Outbound HTTP for Vortex Scan. Every request to a visitor-supplied address
 * goes through safeFetch: public http(s) hosts on the standard ports only
 * (re-checked on every redirect hop and against DNS-over-HTTPS answers), hard
 * timeouts, a body cap and an honest User-Agent that links to the page
 * explaining the bot and how to block it. Fetch/Web APIs only, so it runs on
 * Workers.
 */

export { SCAN_USER_AGENT };

/** Product token matched against robots.txt user-agent lines. */
const ROBOTS_AGENT = "vortexscan";

export const MAX_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 5;
const ALLOWED_PORTS = new Set(["", "80", "443"]);

export type SafeFetchErrorCode =
  | "blocked"
  | "invalid-url"
  | "dns"
  | "timeout"
  | "aborted"
  | "tls"
  | "refused"
  | "too-many-redirects"
  | "network";

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;
  constructor(code: SafeFetchErrorCode, message: string) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

export type SafeFetchOptions = {
  method?: "GET" | "HEAD";
  timeoutMs?: number;
  /** Body bytes to read before cutting the stream (default 2 MB). */
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  /** Outer budget: aborting it cancels the request. */
  signal?: AbortSignal;
  /** Skip reading the body (HEAD never reads one). */
  readBody?: boolean;
  /** Resolve the host over DNS-over-HTTPS first and refuse private answers (default true). */
  dnsCheck?: boolean;
  /** false returns the first 3xx response as-is (to inspect where it points). */
  followRedirects?: boolean;
};

export type SafeFetchResult = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  headers: Headers;
  /** Every hop after the first, in order. */
  redirects: string[];
  body: string;
  bytes: number;
  truncated: boolean;
  contentType: string;
  /** Time to the final hop's response headers (after DNS checks, excluding earlier hops). */
  ttfbMs: number;
  elapsedMs: number;
};

/* ------------------------------------------------------------ URL policy */

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".home.arpa",
  ".corp",
  ".private",
  ".localdomain",
  ".test",
  ".invalid",
  ".example",
  ".onion",
];

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? octets : null;
}

function isPrivateIpv4([a, b, c]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT (also Alibaba metadata)
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

/** Expands an IPv6 literal (no brackets) to eight 16-bit groups. */
function parseIpv6(host: string): number[] | null {
  let text = host.toLowerCase().split("%")[0];
  if (!text.includes(":")) return null;
  const tail: number[] = [];
  const lastColon = text.lastIndexOf(":");
  const last = text.slice(lastColon + 1);
  if (last.includes(".")) {
    const v4 = parseIpv4(last);
    if (!v4) return null;
    tail.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]);
    text = text.slice(0, lastColon + 1);
    if (!text.endsWith("::")) text = text.slice(0, -1);
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part ? part.split(":") : []);
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  if ([...head, ...rest].some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  const known = head.length + rest.length + tail.length;
  const zeros = halves.length === 2 ? 8 - known : 0;
  if (zeros < 0 || (halves.length === 1 && known !== 8)) return null;
  return [
    ...head.map((group) => parseInt(group, 16)),
    ...new Array<number>(zeros).fill(0),
    ...rest.map((group) => parseInt(group, 16)),
    ...tail,
  ];
}

function isPrivateIpv6(groups: number[]): boolean {
  const [g0, g1, , , , g5, g6, g7] = groups;
  const embeddedV4 = [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff];
  const allZeroUntil = (n: number) => groups.slice(0, n).every((g) => g === 0);
  if (allZeroUntil(8)) return true; // ::
  if (allZeroUntil(7) && g7 === 1) return true; // ::1
  if (allZeroUntil(5) && g5 === 0xffff) return isPrivateIpv4(embeddedV4); // ::ffff:a.b.c.d
  if (allZeroUntil(6)) return true; // deprecated IPv4-compatible
  if (g0 === 0x64 && g1 === 0xff9b) return isPrivateIpv4(embeddedV4); // NAT64
  if (g0 === 0x2002) return isPrivateIpv4([g1 >> 8, g1 & 0xff, groups[2] >> 8, groups[2] & 0xff]);
  if ((g0 & 0xfe00) === 0xfc00) return true; // unique local (incl. AWS fd00:ec2::254)
  if ((g0 & 0xffc0) === 0xfe80 || (g0 & 0xffc0) === 0xfec0) return true; // link/site-local
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  if (g0 === 0x2001 && g1 < 0x0200) return true; // Teredo, benchmarking, ORCHID
  return false;
}

/** True when an IP address (v4 or v6, brackets optional) is not publicly routable. */
export function isPrivateAddress(address: string): boolean {
  const host = address.replace(/^\[|\]$/g, "");
  const v4 = parseIpv4(host);
  if (v4) return isPrivateIpv4(v4);
  const v6 = parseIpv6(host);
  if (v6) return isPrivateIpv6(v6);
  return false;
}

function isIpLiteral(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, "");
  return Boolean(parseIpv4(bare) || parseIpv6(bare));
}

/** Why a URL can't be scanned, or null when it is a public http(s) address. */
export function urlBlockReason(input: string | URL): string | null {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : input;
  } catch {
    return "Not a valid URL";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "Only http(s) is allowed";
  if (url.username || url.password) return "URLs with credentials are not allowed";
  // WHATWG parsing already canonicalises 2130706433, 0x7f.1, 127.1 … to dotted quads.
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (!host) return "Missing host";
  if (isIpLiteral(host)) {
    if (isPrivateAddress(host)) return "Private or reserved IP address";
  } else {
    if (host === "localhost" || !host.includes(".")) return "Local host name";
    if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return "Internal host name";
    if (/^metadata\./.test(host)) return "Metadata host name";
  }
  if (!ALLOWED_PORTS.has(url.port)) return `Port ${url.port} is not allowed`;
  return null;
}

/** Parses and validates a URL, throwing SafeFetchError("blocked") for private targets. */
export function assertPublicUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : new URL(input.href);
  } catch {
    throw new SafeFetchError("invalid-url", "Not a valid URL");
  }
  const reason = urlBlockReason(url);
  if (reason) throw new SafeFetchError("blocked", reason);
  url.hash = "";
  return url;
}

/**
 * Turns what a visitor typed ("Exemplu.ro", "www.x.ro/contact", "http://…")
 * into an absolute URL, defaulting to https. Null when it isn't a host.
 */
export function normalizeInputUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------- DNS */

type DnsAnswer = { addresses: string[]; nxdomain: boolean };
const DNS_TTL_MS = 5 * 60_000;
const dnsCache = new Map<string, { at: number; value: Promise<DnsAnswer | null> }>();

async function queryDoh(name: string, type: "A" | "AAAA", signal?: AbortSignal) {
  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: "application/dns-json" }, signal },
  );
  if (!response.ok) throw new Error(`DoH ${response.status}`);
  return (await response.json()) as {
    Status: number;
    Answer?: Array<{ type: number; data: string }>;
  };
}

/**
 * Resolves a host through DNS-over-HTTPS (Cloudflare). Null when the resolver
 * itself fails: safeFetch then refuses the request (fail closed); discovery
 * treats the guess as unknown.
 */
export function resolveHost(hostname: string): Promise<DnsAnswer | null> {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  const cached = dnsCache.get(host);
  if (cached && Date.now() - cached.at < DNS_TTL_MS) return cached.value;
  const value = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const [a, aaaa] = await Promise.all([
        queryDoh(host, "A", controller.signal),
        queryDoh(host, "AAAA", controller.signal).catch(() => null),
      ]);
      const addresses = [...(a.Answer ?? []), ...(aaaa?.Answer ?? [])]
        .filter((record) => record.type === 1 || record.type === 28)
        .map((record) => record.data);
      // Status 3 = NXDOMAIN; NOERROR with no address is just as unreachable.
      return { addresses, nxdomain: a.Status === 3 || (a.Status === 0 && !addresses.length) };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();
  dnsCache.set(host, { at: Date.now(), value });
  if (dnsCache.size > 500) dnsCache.delete(dnsCache.keys().next().value as string);
  // A resolver failure is not remembered: the next request asks again.
  void value.then((answer) => {
    if (!answer && dnsCache.get(host)?.value === value) dnsCache.delete(host);
  });
  return value;
}

/**
 * Fails closed (plan B3): when the resolver itself fails we cannot tell whether
 * the host points at a private address, so the request is refused instead of
 * being sent unchecked.
 */
async function assertResolvesPublic(url: URL) {
  if (isIpLiteral(url.hostname)) return;
  const answer = await resolveHost(url.hostname);
  if (!answer) {
    throw new SafeFetchError(
      "dns",
      `${url.hostname} could not be checked: the DNS resolver did not answer`,
    );
  }
  if (answer.nxdomain) throw new SafeFetchError("dns", `${url.hostname} does not resolve`);
  if (answer.addresses.some(isPrivateAddress)) {
    throw new SafeFetchError("blocked", `${url.hostname} resolves to a private address`);
  }
}

/* ----------------------------------------------------------------- fetch */

function classifyError(error: unknown, timedOut: boolean, outer?: AbortSignal): SafeFetchError {
  if (error instanceof SafeFetchError) return error;
  if (timedOut) return new SafeFetchError("timeout", "The site took too long to respond");
  if (outer?.aborted) return new SafeFetchError("aborted", "Scan budget exhausted");
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
  const code = cause?.code ?? "";
  const message = `${(error as Error)?.message ?? ""} ${cause?.message ?? ""}`;
  if (/ENOTFOUND|EAI_AGAIN|ENODATA/.test(code)) {
    return new SafeFetchError("dns", "The domain does not resolve");
  }
  if (/CERT|SSL|TLS|SELF_SIGNED|ERR_TLS/i.test(code) || /certificate|ssl|tls/i.test(message)) {
    return new SafeFetchError("tls", "The HTTPS certificate is invalid");
  }
  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH/.test(code)) {
    return new SafeFetchError("refused", "The server refused the connection");
  }
  return new SafeFetchError("network", (error as Error)?.message || "Network error");
}

function charsetOf(contentType: string, head: Uint8Array): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  // Plain byte→char mapping: not every runtime's TextDecoder knows latin1.
  const sniff = String.fromCharCode(...head.subarray(0, 2048));
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1];
  return (fromMeta ?? "utf-8").toLowerCase();
}

function decode(bytes: Uint8Array, contentType: string): string {
  const charset = charsetOf(contentType, bytes);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

async function readLimited(response: Response, maxBytes: number) {
  if (!response.body) return { bytes: new Uint8Array(0), truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - total));
      total = maxBytes;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}

/**
 * Fetches a public URL with SSRF guards, following up to `maxRedirects`
 * redirects manually so every hop is re-validated. Throws SafeFetchError.
 */
export async function safeFetch(
  input: string | URL,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const {
    method = "GET",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = MAX_BODY_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    headers = {},
    signal,
    readBody = method !== "HEAD",
    dnsCheck = true,
    followRedirects = true,
  } = options;

  let url = assertPublicUrl(input);
  const requestedUrl = url.href;
  if (signal?.aborted) throw new SafeFetchError("aborted", "Scan budget exhausted");

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener("abort", onOuterAbort, { once: true });

  const started = Date.now();
  const redirects: string[] = [];
  try {
    for (let hop = 0; ; hop++) {
      if (dnsCheck) await assertResolvesPublic(url);
      const hopStarted = Date.now();
      const response = await fetch(url.href, {
        method,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": SCAN_USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "ro-RO,ro;q=0.9,en;q=0.8",
          ...headers,
        },
      });
      const location = response.headers.get("location");
      if (followRedirects && [301, 302, 303, 307, 308].includes(response.status) && location) {
        await response.body?.cancel().catch(() => undefined);
        if (hop >= maxRedirects) {
          throw new SafeFetchError("too-many-redirects", "Too many redirects");
        }
        url = assertPublicUrl(new URL(location, url));
        redirects.push(url.href);
        continue;
      }
      const ttfbMs = Date.now() - hopStarted;
      const contentType = response.headers.get("content-type") ?? "";
      let body = "";
      let bytes = 0;
      let truncated = false;
      if (readBody && method !== "HEAD") {
        const read = await readLimited(response, maxBytes);
        body = decode(read.bytes, contentType);
        bytes = read.bytes.byteLength;
        truncated = read.truncated;
      } else {
        await response.body?.cancel().catch(() => undefined);
      }
      return {
        requestedUrl,
        finalUrl: url.href,
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        redirects,
        body,
        bytes,
        truncated,
        contentType,
        ttfbMs,
        elapsedMs: Date.now() - started,
      };
    }
  } catch (error) {
    throw classifyError(error, timedOut, signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onOuterAbort);
  }
}

/* ---------------------------------------------------------------- robots */

type RobotsRule = { allow: boolean; pattern: string; regex: RegExp };

export type RobotsPolicy = {
  /** robots.txt answered 200. */
  found: boolean;
  status?: number;
  sitemaps: string[];
  /** Our own rules (VortexScan group, else "*"). */
  isAllowed: (pathWithQuery: string) => boolean;
  /**
   * The site names VortexScan in robots.txt and disallows "/" for it: the
   * owner's explicit no. Nothing is fetched then, not even the homepage the
   * visitor asked for (which otherwise skips robots.txt).
   */
  optsOut: boolean;
  /** Whether Googlebot may fetch a path (for the "blocks Google" check). */
  isAllowedFor: (agent: string, pathWithQuery: string) => boolean;
};

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** RFC 9309 parser: groups by user-agent, longest match wins, allow wins ties. */
export function parseRobotsTxt(text: string): Omit<RobotsPolicy, "found" | "status"> {
  const groups: Array<{ agents: string[]; rules: RobotsRule[] }> = [];
  const sitemaps: string[] = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
    } else if ((key === "allow" || key === "disallow") && current) {
      // An empty Disallow allows everything; skip it.
      if (!value) continue;
      const pattern = value.startsWith("/") || value.startsWith("*") ? value : `/${value}`;
      current.rules.push({ allow: key === "allow", pattern, regex: patternToRegex(pattern) });
    }
  }

  const rulesFor = (agent: string): RobotsRule[] => {
    const name = agent.toLowerCase();
    const specific = groups.filter((group) =>
      group.agents.some((ua) => ua && ua !== "*" && name.startsWith(ua)),
    );
    const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
    return chosen.flatMap((group) => group.rules);
  };

  const check = (rules: RobotsRule[], path: string) => {
    let best: RobotsRule | null = null;
    for (const rule of rules) {
      if (!rule.regex.test(path)) continue;
      if (
        !best ||
        rule.pattern.length > best.pattern.length ||
        (rule.pattern.length === best.pattern.length && rule.allow)
      ) {
        best = rule;
      }
    }
    return best ? best.allow : true;
  };

  const ownRules = rulesFor(ROBOTS_AGENT);
  const namesUs = groups.some((group) =>
    group.agents.some((ua) => ua && ua !== "*" && ROBOTS_AGENT.startsWith(ua)),
  );
  return {
    sitemaps,
    isAllowed: (path) => check(ownRules, path),
    isAllowedFor: (agent, path) => check(rulesFor(agent), path),
    optsOut: namesUs && !check(ownRules, "/"),
  };
}

const allowAll: RobotsPolicy = {
  found: false,
  sitemaps: [],
  isAllowed: () => true,
  isAllowedFor: () => true,
  optsOut: false,
};

/** Fetches and parses robots.txt for an origin (4xx = allow all, 5xx/error = crawl nothing). */
export async function fetchRobots(origin: string, signal?: AbortSignal): Promise<RobotsPolicy> {
  try {
    const response = await safeFetch(`${origin}/robots.txt`, {
      timeoutMs: 4000,
      maxBytes: 256 * 1024,
      signal,
      headers: { accept: "text/plain,*/*;q=0.5" },
    });
    if (response.status >= 400 && response.status < 500) {
      return { ...allowAll, status: response.status };
    }
    if (response.status >= 500) {
      return { ...allowAll, status: response.status, isAllowed: () => false };
    }
    // Some hosts answer 200 with their HTML 404 page; treat that as "no robots.txt".
    if (/^\s*</.test(response.body) && /<html/i.test(response.body.slice(0, 2000))) {
      return { ...allowAll, status: response.status };
    }
    return { found: true, status: response.status, ...parseRobotsTxt(response.body) };
  } catch {
    return { ...allowAll, isAllowed: () => false };
  }
}

/** Per-run robots.txt cache, one fetch per origin. */
export function createRobotsCache(signal?: AbortSignal) {
  const cache = new Map<string, Promise<RobotsPolicy>>();
  const get = (origin: string) => {
    let policy = cache.get(origin);
    if (!policy) {
      policy = fetchRobots(origin, signal);
      cache.set(origin, policy);
    }
    return policy;
  };
  return {
    get,
    async isAllowed(url: string | URL) {
      const target = typeof url === "string" ? new URL(url) : url;
      const policy = await get(target.origin);
      return policy.isAllowed(`${target.pathname}${target.search}`);
    },
  };
}

export type RobotsCache = ReturnType<typeof createRobotsCache>;

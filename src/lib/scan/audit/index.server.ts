import {
  createRobotsCache,
  normalizeInputUrl,
  SafeFetchError,
  safeFetch,
  urlBlockReason,
  type RobotsPolicy,
  type SafeFetchOptions,
  type SafeFetchResult,
} from "@/lib/scan/net.server";
import type { AuditFinding, SiteSignals, WebsiteAudit } from "@/lib/scan/types";

import {
  CHECK_COUNT,
  blockedAddressFinding,
  homepageErrorFinding,
  runChecks,
  scanBlockedFinding,
  scanOptOutFinding,
  sortFindings,
  unreachableFinding,
  type ReachFailure,
} from "./checks";
import { extractPage, foldText, siteHost } from "./extract";
import type { AssetProbe, AuditContext, ImageProbe, PageFacts, SitemapInfo } from "./model";
import { scoreAudit, UNREACHABLE_SCORES } from "./scoring";
import { buildSignals } from "./signals";
import { detectTechnologies, toDetectedTechnologies } from "./technologies";

/**
 * Website audit: robots.txt, the homepage, the sitemap and up to five
 * well-chosen internal pages, all inside a ~15 s budget with at most two
 * requests in flight (the politeness limit stated on /privacy#vortex-scan-bot).
 * Everything after the homepage is optional: whatever finishes in time is
 * used, the rest is skipped. The homepage the visitor asked for skips
 * robots.txt, unless robots.txt names VortexScan and disallows "/".
 */

const TOTAL_BUDGET_MS = 15_000;
const MAX_EXTRA_PAGES = 5;
const MAX_IN_FLIGHT = 2;
const HTML_FOR_FINGERPRINTS = 1_500_000;
const EXTRA_HTML_FOR_FINGERPRINTS = 300_000;

export type AuditInput = { url: string; cui?: string; name?: string };

const EMPTY_SIGNALS: SiteSignals = {
  hasContactForm: false,
  hasPhone: false,
  hasEmail: false,
  hasWhatsApp: false,
  hasLiveChat: false,
  hasOnlineBooking: false,
  hasEcommerce: false,
  hasCookieConsent: false,
  hasAnalytics: false,
  hasMarketingPixel: false,
  hasStructuredData: false,
  hasNewsletter: false,
  hasBlog: false,
  languages: [],
  socialLinks: [],
};

/** Pages worth reading after the homepage, in priority order. */
const PAGE_KINDS: Array<{ kind: string; pattern: RegExp }> = [
  { kind: "contact", pattern: /contact|kontakt/ },
  {
    kind: "services",
    pattern: /servic|tratament|treatment|solutii|solution|ce-facem|what-we-do|oferta|offer/,
  },
  { kind: "about", pattern: /despre|about|cine-suntem|echipa|team|povestea|our-story|company/ },
  {
    kind: "pricing",
    pattern: /pret|tarif|pricing|prices|abonament|plans|packages|pachete|cost/,
  },
  { kind: "booking", pattern: /programar|programeaz|rezerv|booking|book-|appointment|reserv/ },
  {
    kind: "shop",
    pattern: /shop|magazin|produse|products|catalog|store|meniu|menu|colecti|collection/,
  },
  { kind: "blog", pattern: /blog|noutati|stiri|articole|news|insights/ },
  // Company details (CUI, Reg. Com.) often live only in the terms.
  { kind: "legal", pattern: /termeni|terms|conditii|legal|impressum|date-firma/ },
];
const SKIP_PATH =
  /\.(pdf|jpe?g|png|gif|webp|svg|zip|rar|docx?|xlsx?|mp4|mp3)$|\/(wp-admin|wp-login|login|logout|signup|auth|cart|cos|checkout|my-account|contul-meu|cont|account|feed|tag|author|search|cauta|privacy|confidentialitate|politica-de-confidentialitate|cookies?|politica-cookies|gdpr)(\/|$)|add-to-cart|\?s=/i;

/** A tiny FIFO limiter so the audit never hammers a small shared host. */
function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= max) return;
    const start = queue.shift();
    if (start) {
      active++;
      start();
    }
  };
  return <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
}

type Run = {
  started: number;
  signal: AbortSignal;
  limit: ReturnType<typeof createLimiter>;
};

const left = (run: Run) => TOTAL_BUDGET_MS - (Date.now() - run.started);

/** safeFetch inside the budget and the in-flight limit; null when skipped or failed. */
async function budgetFetch(
  run: Run,
  url: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult | null> {
  return run.limit(async () => {
    const remaining = left(run) - 300;
    if (remaining < 800) return null;
    try {
      return await safeFetch(url, {
        ...options,
        signal: run.signal,
        timeoutMs: Math.min(options.timeoutMs ?? 6000, remaining),
      });
    } catch {
      return null;
    }
  });
}

function failureReason(error: unknown): ReachFailure {
  const code = error instanceof SafeFetchError ? error.code : "network";
  if (code === "dns" || code === "tls" || code === "refused" || code === "too-many-redirects") {
    return code;
  }
  if (code === "timeout" || code === "aborted") return "timeout";
  return "network";
}

/**
 * Loads the homepage, trying the sensible variants a visitor means:
 * https first, http when https fails, and www. when the bare domain
 * doesn't resolve.
 */
async function fetchHomepage(rawInput: string, start: URL, run: Run) {
  const explicitScheme = /^https?:\/\//i.test(rawInput.trim());
  const queue: URL[] = [start];
  const tried = new Set<string>();
  let firstError: unknown;
  let tlsFailed = false;

  while (queue.length) {
    const url = queue.shift()!;
    if (tried.has(url.href)) continue;
    tried.add(url.href);
    const remaining = left(run) - 1000;
    if (remaining < 1500) break;
    try {
      const result = await safeFetch(url, {
        timeoutMs: Math.min(10_000, remaining),
        signal: run.signal,
      });
      return { result, tlsFailed };
    } catch (error) {
      firstError ??= error;
      const code = error instanceof SafeFetchError ? error.code : "network";
      if (code === "blocked") throw error;
      if (code === "dns" && !url.hostname.startsWith("www.")) {
        const www = new URL(url.href);
        www.hostname = `www.${url.hostname}`;
        queue.push(www);
      }
      if (url.protocol === "https:" && (code === "tls" || (!explicitScheme && code !== "dns"))) {
        if (code === "tls") tlsFailed = true;
        const http = new URL(url.href);
        http.protocol = "http:";
        queue.push(http);
      }
    }
  }
  throw firstError ?? new SafeFetchError("timeout", "Scan budget exhausted");
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function pickInternalPages(home: PageFacts, finalUrl: URL): string[] {
  const homePath = finalUrl.pathname.replace(/\/+$/, "");
  const candidates = new Map<string, { url: string; path: string; text: string; depth: number }>();
  for (const link of home.links) {
    if (!link.internal || !link.url) continue;
    const url = new URL(link.url);
    url.hash = "";
    const path = url.pathname.replace(/\/+$/, "");
    if (path === homePath || SKIP_PATH.test(`${url.pathname}${url.search}`)) continue;
    if (url.search.length > 40) continue;
    const key = `${url.origin}${path}`;
    if (candidates.has(key)) continue;
    candidates.set(key, {
      url: url.href,
      path: foldText(safeDecode(path)),
      text: foldText(link.text),
      depth: path.split("/").filter(Boolean).length,
    });
  }

  const chosen: string[] = [];
  const used = new Set<string>();
  const legal = PAGE_KINDS[PAGE_KINDS.length - 1].pattern;
  for (const { kind, pattern } of PAGE_KINDS) {
    if (chosen.length >= MAX_EXTRA_PAGES) break;
    const best = [...candidates.values()]
      .filter((candidate) => !used.has(candidate.url))
      // "Terms of Service" is not the services page.
      .filter((candidate) => kind === "legal" || !legal.test(candidate.path))
      .map((candidate) => ({
        candidate,
        score:
          (pattern.test(candidate.path) ? 2 : 0) +
          (pattern.test(candidate.text) ? 1 : 0) -
          candidate.depth * 0.2,
      }))
      .filter((entry) => entry.score > 0.5)
      .sort((a, b) => b.score - a.score)[0];
    if (best) {
      chosen.push(best.candidate.url);
      used.add(best.candidate.url);
    }
  }
  return chosen;
}

const isHtml = (result: SafeFetchResult) =>
  /html|xml/i.test(result.contentType) ||
  (!result.contentType && /<(html|head|body)[\s>]/i.test(result.body.slice(0, 4000)));

async function crawlPages(
  run: Run,
  home: PageFacts,
  finalUrl: URL,
  robots: RobotsPolicy,
): Promise<{ pages: PageFacts[]; broken: Array<{ url: string; status: number }> }> {
  const targets = pickInternalPages(home, finalUrl).filter((url) => {
    const target = new URL(url);
    return robots.isAllowed(`${target.pathname}${target.search}`);
  });
  const results = await Promise.all(
    targets.map((url) => budgetFetch(run, url, { timeoutMs: 6000 })),
  );
  const pages: PageFacts[] = [];
  const broken: Array<{ url: string; status: number }> = [];
  const seen = new Set([finalUrl.href]);
  for (const result of results) {
    if (!result || seen.has(result.finalUrl)) continue;
    seen.add(result.finalUrl);
    if (result.status === 404 || result.status === 410 || result.status >= 500) {
      broken.push({ url: result.requestedUrl, status: result.status });
      continue;
    }
    if (result.status >= 400 || !isHtml(result)) continue;
    try {
      pages.push(extractPage(result.body, result.finalUrl, result.status));
    } catch (error) {
      console.warn("[scan] could not parse", result.finalUrl, error);
    }
  }
  return { pages, broken };
}

function countUrls(xml: string) {
  return (xml.match(/<url[\s>]/g) ?? []).length;
}

async function fetchSitemap(run: Run, origin: string, declared: string[]): Promise<SitemapInfo> {
  const host = siteHost(new URL(origin).hostname);
  const sameSite = (url: string) => {
    try {
      return siteHost(new URL(url).hostname) === host && !/\.gz($|\?)/i.test(url);
    } catch {
      return false;
    }
  };
  const candidates = [
    ...new Set([
      ...declared.filter(sameSite).slice(0, 2),
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/wp-sitemap.xml`,
    ]),
  ];
  for (const candidate of candidates) {
    const result = await budgetFetch(run, candidate, {
      timeoutMs: 5000,
      headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.5" },
    });
    if (!result || result.status !== 200) continue;
    const xml = result.body;
    if (/<sitemapindex[\s>]/i.test(xml)) {
      const children = [...xml.matchAll(/<sitemap[\s>][\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
        .map((match) => match[1].replace(/&amp;/g, "&"))
        .filter(sameSite);
      const sample = children.slice(0, 3);
      const counts = await Promise.all(
        sample.map(async (child) => {
          const childResult = await budgetFetch(run, child, { timeoutMs: 5000 });
          return childResult?.status === 200 ? countUrls(childResult.body) : null;
        }),
      );
      const known = counts.filter((count): count is number => count !== null);
      return {
        found: true,
        url: result.finalUrl,
        childSitemaps: children.length,
        urlCount: known.length ? known.reduce((sum, count) => sum + count, 0) : undefined,
        partial: children.length > known.length,
      };
    }
    if (/<urlset[\s>]/i.test(xml)) {
      return {
        found: true,
        url: result.finalUrl,
        urlCount: countUrls(xml),
        partial: result.truncated,
      };
    }
  }
  return { found: false };
}

async function checkHttpRedirect(run: Run, finalUrl: URL): Promise<boolean | undefined> {
  const http = new URL(finalUrl.origin);
  http.protocol = "http:";
  const result = await budgetFetch(run, http.href, {
    timeoutMs: 4000,
    followRedirects: false,
    readBody: false,
  });
  if (!result) return undefined;
  const location = result.headers.get("location") ?? "";
  if (result.status >= 300 && result.status < 400) return /^https:\/\//i.test(location);
  return result.status < 400 ? false : undefined;
}

async function probeImages(run: Run, home: PageFacts): Promise<ImageProbe[]> {
  const sources = [
    ...new Set(
      home.images
        .map((image) => image.src)
        .filter((src) => /^https?:\/\//.test(src) && !/\.svg(\?|$)/i.test(src)),
    ),
  ].slice(0, 4);
  const probes = await Promise.all(
    sources.map(async (url): Promise<ImageProbe | null> => {
      const result = await budgetFetch(run, url, {
        method: "HEAD",
        timeoutMs: 4000,
        headers: { accept: "image/avif,image/webp,image/*;q=0.8,*/*;q=0.5" },
      });
      if (!result || result.status !== 200) return null;
      const length = Number(result.headers.get("content-length"));
      return {
        url: result.finalUrl,
        bytes: Number.isFinite(length) && length > 0 ? length : undefined,
        contentType: result.contentType || undefined,
      };
    }),
  );
  return probes.filter((probe): probe is ImageProbe => probe !== null);
}

async function probeAssets(run: Run, home: PageFacts, finalUrl: URL): Promise<AssetProbe[]> {
  const host = siteHost(finalUrl.hostname);
  const own = (url?: string) => Boolean(url && siteHost(new URL(url).hostname) === host);
  // Versioned files are the ones that should be cached long; prefer them.
  const versioned = (url?: string) =>
    Boolean(url && /[-._][A-Za-z0-9_]{8,}\.(css|js)(\?|$)|[?&](ver|v|version)=/.test(url));
  const ownCss = home.stylesheets.filter(own);
  const ownJs = home.scripts.map((script) => script.src).filter(own);
  const css = ownCss.find(versioned) ?? ownCss[0];
  const js = ownJs.find(versioned);
  const targets: Array<{ url: string; kind: AssetProbe["kind"] }> = [];
  if (css) targets.push({ url: css, kind: "css" });
  if (js) targets.push({ url: js, kind: "js" });
  const probes = await Promise.all(
    targets.map(async ({ url, kind }): Promise<AssetProbe | null> => {
      const result = await budgetFetch(run, url, { method: "HEAD", timeoutMs: 4000 });
      if (!result) return null;
      return {
        url: result.finalUrl,
        status: result.status,
        cacheControl: result.headers.get("cache-control") ?? undefined,
        expires: result.headers.get("expires") ?? undefined,
        kind,
      };
    }),
  );
  return probes.filter((probe): probe is AssetProbe => probe !== null);
}

async function probeFavicon(run: Run, origin: string): Promise<boolean> {
  const result = await budgetFetch(run, `${origin}/favicon.ico`, {
    method: "HEAD",
    timeoutMs: 3000,
  });
  return Boolean(result && result.status === 200 && !/html/i.test(result.contentType));
}

/**
 * A client-rendered page shows nothing until its main bundle has loaded, so
 * its size is the first performance fact we can measure without a browser.
 */
async function probeAppBundle(
  run: Run,
  home: PageFacts,
  finalUrl: URL,
): Promise<AuditContext["appBundle"]> {
  const host = siteHost(finalUrl.hostname);
  const entry = home.scripts.find(
    (script) => script.module && script.src && siteHost(new URL(script.src).hostname) === host,
  )?.src;
  if (!entry) return undefined;
  const result = await budgetFetch(run, entry, { timeoutMs: 8000, maxBytes: 1200 * 1024 });
  if (!result || result.status !== 200) return undefined;
  return { url: result.finalUrl, bytes: result.bytes, truncated: result.truncated };
}

const CHALLENGE =
  /just a moment|cf-chl|challenge-platform|attention required|checking your browser|sgcaptcha|incapsula incident|ddos protection|captcha/i;

function unreachableAudit(
  url: string,
  host: string,
  fetchedAt: string,
  findings: AuditFinding[],
  extra: Partial<WebsiteAudit> = {},
): WebsiteAudit {
  return {
    url,
    finalUrl: url,
    host,
    fetchedAt,
    reachable: false,
    https: url.startsWith("https:"),
    pages: [],
    meta: {},
    technologies: [],
    signals: EMPTY_SIGNALS,
    scores: UNREACHABLE_SCORES,
    findings: sortFindings(findings),
    ...extra,
  };
}

export async function auditWebsite(input: AuditInput): Promise<WebsiteAudit> {
  const fetchedAt = new Date().toISOString();
  const start = normalizeInputUrl(input.url);
  if (!start) {
    return unreachableAudit(input.url, "", fetchedAt, [blockedAddressFinding("Not a valid URL")]);
  }
  const blocked = urlBlockReason(start);
  if (blocked) {
    return unreachableAudit(start.href, start.hostname, fetchedAt, [
      blockedAddressFinding(blocked),
    ]);
  }

  const controller = new AbortController();
  const budget = setTimeout(() => controller.abort(), TOTAL_BUDGET_MS);
  const run: Run = {
    started: Date.now(),
    signal: controller.signal,
    limit: createLimiter(MAX_IN_FLIGHT),
  };
  const robotsCache = createRobotsCache(run.signal);

  try {
    // The owner's explicit no comes before the visitor's request.
    if ((await robotsCache.get(start.origin)).optsOut) {
      return unreachableAudit(start.href, start.hostname, fetchedAt, [
        scanOptOutFinding(start.hostname),
      ]);
    }

    let homepage: Awaited<ReturnType<typeof fetchHomepage>>;
    try {
      homepage = await fetchHomepage(input.url, start, run);
    } catch (error) {
      if (error instanceof SafeFetchError && error.code === "blocked") {
        return unreachableAudit(start.href, start.hostname, fetchedAt, [
          blockedAddressFinding(error.message),
        ]);
      }
      return unreachableAudit(start.href, start.hostname, fetchedAt, [
        unreachableFinding(start.hostname, failureReason(error)),
      ]);
    }

    const { result, tlsFailed } = homepage;
    const finalUrl = new URL(result.finalUrl);
    const https = finalUrl.protocol === "https:";
    const headers = result.headers;
    const setCookies =
      (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    const looksLikeHtml = isHtml(result);
    const challenge =
      headers.get("cf-mitigated") === "challenge" ||
      ([403, 429, 503].includes(result.status) && CHALLENGE.test(result.body.slice(0, 20_000)));

    const home = extractPage(looksLikeHtml ? result.body : "", finalUrl.href, result.status);
    const challengeOn200 = result.status < 400 && home.wordCount < 80 && CHALLENGE.test(home.text);
    const contentAvailable = result.status < 400 && looksLikeHtml && !challenge && !challengeOn200;
    // A bot check or a refusal is a "no": nothing more is requested from the host.
    const blockedByBot = challenge || challengeOn200 || [401, 403, 429].includes(result.status);

    const origin = finalUrl.origin;
    // A redirect to another origin (www., another domain) gets the same test.
    if (origin !== start.origin && (await robotsCache.get(origin)).optsOut) {
      return unreachableAudit(start.href, finalUrl.hostname, fetchedAt, [
        scanOptOutFinding(finalUrl.hostname),
      ]);
    }
    const robotsPromise = run.limit(() => robotsCache.get(origin));
    const [robots, sitemap, httpRedirectsToHttps, crawl, images, assets, faviconFound, appBundle] =
      await Promise.all([
        robotsPromise,
        blockedByBot
          ? Promise.resolve<SitemapInfo>({ found: false, skipped: true })
          : robotsPromise.then((policy) => fetchSitemap(run, origin, policy.sitemaps)),
        https && !blockedByBot ? checkHttpRedirect(run, finalUrl) : Promise.resolve(undefined),
        contentAvailable
          ? robotsPromise.then((policy) => crawlPages(run, home, finalUrl, policy))
          : Promise.resolve({ pages: [], broken: [] }),
        contentAvailable ? probeImages(run, home) : Promise.resolve([]),
        contentAvailable ? probeAssets(run, home, finalUrl) : Promise.resolve([]),
        contentAvailable && !home.favicon ? probeFavicon(run, origin) : Promise.resolve(false),
        contentAvailable && home.clientRendered
          ? probeAppBundle(run, home, finalUrl)
          : Promise.resolve(undefined),
      ]);

    const pages = [home, ...crawl.pages];
    const technologies = detectTechnologies({
      html: [
        home.html.slice(0, HTML_FOR_FINGERPRINTS),
        ...crawl.pages.map((page) => page.html.slice(0, EXTRA_HTML_FOR_FINGERPRINTS)),
      ].join("\n"),
      scriptSrcs: pages.flatMap((page) =>
        page.scripts.map((script) => script.src).filter((src): src is string => Boolean(src)),
      ),
      headers,
      cookies: setCookies.map((cookie) => cookie.split("=")[0].trim()),
      generators: [...new Set(pages.flatMap((page) => page.generators))],
    });
    const { signals, extra } = contentAvailable
      ? buildSignals(pages, technologies, input.cui)
      : { signals: EMPTY_SIGNALS, extra: buildSignals([], technologies).extra };

    const context: AuditContext = {
      requestedUrl: start.href,
      finalUrl,
      https,
      statusCode: result.status,
      ttfbMs: result.ttfbMs,
      redirects: result.redirects,
      headers,
      setCookies,
      htmlEncoded: /gzip|br|deflate|zstd/i.test(headers.get("content-encoding") ?? ""),
      contentAvailable,
      home,
      pages,
      brokenPages: crawl.broken,
      robots: {
        found: robots.found,
        status: robots.status,
        sitemaps: robots.sitemaps,
        blocksEveryone: robots.found && !robots.isAllowedFor("*", "/"),
        blocksGoogle: robots.found && !robots.isAllowedFor("googlebot", "/"),
      },
      sitemap,
      httpRedirectsToHttps,
      images,
      assets,
      faviconFound,
      appBundle,
      technologies,
      signals,
      extra,
      cui: input.cui,
      name: input.name,
      now: new Date(),
    };

    const findings = runChecks(context);
    if (tlsFailed) findings.unshift(unreachableFinding(finalUrl.hostname, "tls"));

    const pageList = [
      ...pages.map((page) => ({ url: page.url, status: page.status, title: page.title })),
      ...crawl.broken.map((page) => ({ url: page.url, status: page.status })),
    ];
    const meta = {
      title: home.title,
      description: home.description,
      lang: home.lang,
      canonical: home.canonical,
      ogImage: home.og.image,
      favicon: home.favicon ?? (faviconFound ? `${origin}/favicon.ico` : undefined),
    };

    if (!contentAvailable) {
      const explanation = blockedByBot
        ? scanBlockedFinding(result.status, challenge || challengeOn200)
        : homepageErrorFinding(result.status);
      return unreachableAudit(
        start.href,
        finalUrl.hostname,
        fetchedAt,
        [explanation, ...findings],
        {
          finalUrl: finalUrl.href,
          https,
          statusCode: result.status,
          responseMs: result.ttfbMs,
          pages: pageList,
          meta,
          technologies: toDetectedTechnologies(technologies),
        },
      );
    }

    return {
      url: start.href,
      finalUrl: finalUrl.href,
      host: finalUrl.hostname,
      fetchedAt,
      reachable: true,
      https,
      statusCode: result.status,
      responseMs: result.ttfbMs,
      pages: pageList,
      meta,
      technologies: toDetectedTechnologies(technologies),
      signals,
      scores: scoreAudit(sortFindings(findings)),
      findings: sortFindings(findings),
      coverage: findings.some((finding) => finding.id === "seo.client-rendered")
        ? "client-rendered"
        : "full",
      crawl: {
        robotsTxt: robots.found,
        sitemapUrls: sitemap.found ? sitemap.urlCount : undefined,
        sitemapPartial: sitemap.found ? sitemap.partial : undefined,
        checksRun: CHECK_COUNT,
      },
    };
  } finally {
    clearTimeout(budget);
  }
}

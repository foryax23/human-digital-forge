import type { Fact, Gap } from "../contracts";
import type { StepEnv } from "../env.server";
import { bi, count } from "../parse/format";
import { fold } from "../parse/text";
import { classifySocialUrl, normalizeSocialUrl } from "@/lib/scan/audit/social";

import { paidCall } from "../llm/paid.server";

import { fact, gap } from "./common.server";

/*
 * Active intelligence inside the "signals" step: recent press coverage
 * (Google News RSS, last 24 months) and social profiles found by web search
 * (not only the ones the website links to). Social networks themselves are
 * never fetched: the search result URL is the evidence, marked "probabil"
 * when the handle or title matches the brand.
 */

const UA = "Mozilla/5.0 (compatible; VortexScan/1.0; +https://vortexhub.dev/privacy#vortex-scan-bot)";
const LEGAL_WORDS =
  /\b(s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?|s\.?\s?c\.?|srl-d|pfa|i\.?\s?i\.?|i\.?\s?f\.?|company|impex|com|prod|trading|grup|group|romania)\b/gi;

export function brandOf(name: string): string {
  return name.replace(LEGAL_WORDS, " ").replace(/[^\p{L}\p{N}&\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function brandTokens(brand: string): string[] {
  return fold(brand)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export type NewsItem = { title: string; url: string; date: string; outlet?: string; tone: "risk" | "growth" | "neutral" };

const RISK_WORDS =
  /insolven|faliment|amend|sanc[tț]i|anchet|perchezi|dosar|fraud|evaziun|scandal|reclama[tț]i|anpc|inchis|închis|concedier|datori|executare|controvers/i;
const GROWTH_WORDS =
  /investi|lanseaz|lansare|extinde|deschide|achizi|finan[tț]are|cre[sș]tere|record|premiu|parteneriat|export|fonduri|angajeaz|nou magazin|inaugur|dezvolt|complex comercial/i;

export function parseNewsRss(xml: string, tokens: string[], sinceMs: number): NewsItem[] {
  const out: NewsItem[] = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1];
    const raw = decode(body.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const url = decode(body.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const pub = body.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    const outlet = decode(body.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "") || undefined;
    if (!raw || !url || !pub) continue;
    const time = Date.parse(pub);
    if (!Number.isFinite(time) || time < sinceMs) continue;
    const title = outlet && raw.endsWith(` - ${outlet}`) ? raw.slice(0, -outlet.length - 3) : raw;
    const folded = fold(title);
    if (tokens.length && !tokens.some((t) => folded.includes(t))) continue;
    const key = folded.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: title.slice(0, 200),
      url: url.slice(0, 600),
      date: new Date(time).toISOString().slice(0, 10),
      outlet: outlet?.slice(0, 80),
      tone: RISK_WORDS.test(title) ? "risk" : GROWTH_WORDS.test(title) ? "growth" : "neutral",
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
}

async function fetchText(env: StepEnv, url: string, init?: RequestInit): Promise<string | null> {
  if (env.deadline - env.now() < 5000) return null;
  try {
    const res = await env.fetch(url, {
      ...init,
      headers: { "user-agent": UA, "accept-language": "ro-RO,ro;q=0.9,en;q=0.6", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(Math.min(10_000, env.deadline - env.now() - 2000)),
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 1_500_000);
  } catch (error) {
    env.log({ intel: url.slice(0, 60), error: String((error as Error)?.message ?? error) });
    return null;
  }
}

export async function searchNews(env: StepEnv): Promise<NewsItem[] | null> {
  const brand = brandOf(env.identity.name);
  const tokens = brandTokens(brand);
  if (!tokens.length) return [];
  const since = env.now() - 730 * 86_400_000;
  const queries = [`"${brand}"`, env.identity.city ? `"${brand}" ${env.identity.city}` : null].filter(
    Boolean,
  ) as string[];
  const all = new Map<string, NewsItem>();
  let answered = false;
  for (const q of queries) {
    const xml = await fetchText(
      env,
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ro&gl=RO&ceid=RO:ro`,
    );
    if (xml === null) continue;
    answered = true;
    for (const item of parseNewsRss(xml, tokens, since)) all.set(fold(item.title).slice(0, 60), item);
  }
  if (!answered) return null;
  return [...all.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
}

/** Result links from DuckDuckGo's HTML page (redirect links unwrapped). */
export function parseSearchLinks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href=["']([^"']*[?&]uddg=[^"']+)["']/g)) {
    const uddg = decode(m[1]).match(/[?&]uddg=([^&]+)/);
    if (!uddg) continue;
    try {
      const href = decodeURIComponent(uddg[1]);
      if (!out.includes(href)) out.push(href);
    } catch {
      // malformed link
    }
  }
  return out;
}

export type FoundProfile = { platform: string; url: string; via: "search" | "linkhub" | "ai_search" };

const SOCIAL_SITES = ["instagram.com", "facebook.com", "tiktok.com", "linkedin.com/company", "youtube.com"];
const LINKHUB = /^https?:\/\/(www\.)?(linktr\.ee|bio\.site|beacons\.ai|campsite\.bio)\/[^/?#]+/i;

function handleMatches(url: string, tokens: string[]): boolean {
  // The handle must start with the brand and add little else (rejects "brandvenezia" lookalikes
  // only partly, so profiles stay "probabil" with a check-at-source note).
  const segment = fold(decodeURIComponent(new URL(url).pathname))
    .split("/")
    .filter((p) => p && !["company", "pages", "channel", "c", "user"].includes(p))[0]
    ?.replace(/[^a-z0-9]/g, "");
  if (!segment) return false;
  const joined = tokens.join("");
  return segment.startsWith(joined) && segment.length <= joined.length + 6;
}

export async function discoverSocial(env: StepEnv): Promise<FoundProfile[] | null> {
  const brand = brandOf(env.identity.name);
  const tokens = brandTokens(brand);
  if (!tokens.length) return [];
  const found = new Map<string, FoundProfile>();
  let answered = false;
  const hubs: string[] = [];
  const q = `"${brand}" (${SOCIAL_SITES.map((s) => `site:${s}`).join(" OR ")})`;
  for (const query of [q, `${brand} instagram facebook tiktok`]) {
    const html = await fetchText(
      env,
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}&kl=ro-ro`,
    );
    if (html === null) continue;
    answered = true;
    for (const link of parseSearchLinks(html)) {
      if (LINKHUB.test(link)) {
        if (handleMatches(link, tokens)) hubs.push(link);
        continue;
      }
      const match = classifySocialUrl(link);
      if (!match?.profile || found.has(match.platform)) continue;
      if (!handleMatches(link, tokens)) continue;
      found.set(match.platform, { platform: match.platform, url: normalizeSocialUrl(link), via: "search" });
    }
  }
  // Link hubs (Linktree etc.) list every channel the brand runs.
  for (const hub of hubs.slice(0, 1)) {
    const html = await fetchText(env, hub);
    if (!html) continue;
    for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
      const match = classifySocialUrl(m[1]);
      if (!match?.profile || found.has(match.platform)) continue;
      found.set(match.platform, { platform: match.platform, url: normalizeSocialUrl(m[1]), via: "linkhub" });
    }
  }
  // Search engines often refuse server traffic; Claude's web search finds the brand's real
  // channels (also when the trade name differs from the legal name) within the run budget.
  if (found.size < 3 && env.llm) {
    const extra = await claudeSocialSearch(env, brand);
    if (extra) {
      answered = true;
      for (const p of extra) if (!found.has(p.platform)) found.set(p.platform, p);
    }
  }
  if (!answered) return null;
  return [...found.values()];
}

async function claudeSocialSearch(env: StepEnv, brand: string): Promise<FoundProfile[] | null> {
  const llm = env.llm;
  if (!llm || env.deadline - env.now() < 12_000) return null;
  const model = llm.models.extraction;
  const where = [env.identity.city, env.identity.county].filter(Boolean).join(", ");
  const prompt = `Find the official social media profiles of the Romanian company "${env.identity.name}" (CUI ${env.cui}${where ? `, based in ${where}` : ""}). Its trade name may be "${brand}" or a different brand. Search the web. Reply ONLY with one profile URL per line (Instagram, Facebook, TikTok, LinkedIn company page, YouTube), only profiles you are confident belong to this company. If none, reply NONE.`;
  try {
    const outcome = await paidCall({
      ledger: env.ledger,
      runId: env.runId,
      step: env.step,
      idemKey: `${env.runId}|${env.step}|social-search`,
      plan: { model, inputTokens: 25_000, maxTokens: 800, fallback: false },
      floor: 400,
      exec: (maxTokens) =>
        llm.transport.create(
          {
            model,
            max_tokens: maxTokens,
            messages: [{ role: "user", content: prompt }],
            tools: [
              {
                type: "web_search_20250305",
                name: "web_search",
                max_uses: 3,
                user_location: { type: "approximate", country: "RO" },
              },
            ],
          },
          { timeoutMs: Math.max(8000, env.deadline - env.now() - 2000) },
        ),
      deadline: env.deadline,
      now: env.now,
      log: env.log,
    });
    if (outcome.kind !== "ok") return null;
    const text = outcome.message.content
      .map((b) => (b.type === "text" && typeof b.text === "string" ? b.text : ""))
      .join("\n");
    const out: FoundProfile[] = [];
    for (const m of text.matchAll(/https?:\/\/[^\s)\]>"']+/g)) {
      const match = classifySocialUrl(m[0]);
      if (!match?.profile || out.some((p) => p.platform === match.platform)) continue;
      out.push({ platform: match.platform, url: normalizeSocialUrl(m[0]), via: "ai_search" });
    }
    return out;
  } catch (error) {
    env.log({ intel: "claude-search", error: String((error as Error)?.message ?? error) });
    return null;
  }
}

const PLATFORM: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  x: "X",
  "google-business": "Google",
};

export function intelFacts(
  news: NewsItem[] | null,
  social: FoundProfile[] | null,
  today: string,
): { facts: Fact[]; gaps: Gap[] } {
  const facts: Fact[] = [];
  const gaps: Gap[] = [];
  if (news) {
    const risk = news.filter((n) => n.tone === "risk").length;
    const growth = news.filter((n) => n.tone === "growth").length;
    facts.push(
      fact({
        id: "presence.news.count",
        section: "presence",
        predicate: "presence.news.count",
        value: { total: news.length, risk, growth, latest: news[0]?.date ?? null },
        display: news.length
          ? bi(
              `${news.length} press articles in 24 months (${growth} growth, ${risk} risk), latest ${news[0].date}`,
              `${news.length} articole de presă în 24 de luni (${growth} de creștere, ${risk} de risc), ultimul ${news[0].date}`,
            )
          : bi("No press coverage found in 24 months", "Nicio apariție în presă în ultimele 24 de luni"),
        source: "news",
        asOf: today,
        confidence: "probabil",
        method: "api",
        evidence: { url: "https://news.google.com" },
      }),
    );
    news.forEach((n, i) => {
      const tag = n.tone === "risk" ? ["risk", "risc"] : n.tone === "growth" ? ["growth", "creștere"] : null;
      facts.push(
        fact({
          id: `presence.news.item.${i}`,
          section: "presence",
          predicate: "presence.news.item",
          value: { title: n.title, date: n.date, outlet: n.outlet ?? null, tone: n.tone },
          display: bi(
            `${n.date}${n.outlet ? ` · ${n.outlet}` : ""}${tag ? ` [${tag[0]}]` : ""}: ${n.title}`,
            `${n.date}${n.outlet ? ` · ${n.outlet}` : ""}${tag ? ` [${tag[1]}]` : ""}: ${n.title}`,
          ),
          source: "news",
          asOf: n.date,
          confidence: "probabil",
          score: 0.75,
          method: "api",
          adverse: n.tone === "risk" ? true : undefined,
          evidence: { url: n.url },
        }),
      );
    });
  } else {
    gaps.push(
      gap("presence", bi("Press coverage", "Apariții în presă"), bi("The news search did not answer", "Căutarea de știri nu a răspuns"), today, "https://news.google.com"),
    );
  }
  if (social) {
    facts.push(
      fact({
        id: "presence.social_found.count",
        section: "presence",
        predicate: "presence.social_found",
        value: social.map((s) => s.platform),
        display: social.length
          ? bi(
              `Found by search: ${social.map((s) => PLATFORM[s.platform] ?? s.platform).join(", ")}`,
              `Găsite prin căutare: ${social.map((s) => PLATFORM[s.platform] ?? s.platform).join(", ")}`,
            )
          : bi("No social profiles found by search", "Niciun profil social găsit prin căutare"),
        short: count(social.length),
        source: "web_search",
        asOf: today,
        confidence: "probabil",
        method: "html",
      }),
    );
    for (const s of social) {
      facts.push(
        fact({
          id: `presence.social_found.${s.platform}`,
          section: "presence",
          predicate: "presence.social_profile",
          value: { platform: s.platform, url: s.url, via: s.via },
          display: bi(
            `${PLATFORM[s.platform] ?? s.platform}: ${s.url}`,
            `${PLATFORM[s.platform] ?? s.platform}: ${s.url}`,
          ),
          source: "web_search",
          asOf: today,
          confidence: "probabil",
          score: s.via === "linkhub" ? 0.85 : 0.75,
          method: "html",
          evidence: {
            url: s.url,
            note: bi(
              "Found by web search on the brand name; check it is the company's page.",
              "Găsit prin căutare după numele brandului; verifică dacă e pagina firmei.",
            ),
          },
        }),
      );
    }
  } else {
    gaps.push(
      gap("presence", bi("Social profiles by search", "Profiluri sociale prin căutare"), bi("The web search did not answer", "Căutarea web nu a răspuns"), today),
    );
  }
  return { facts, gaps };
}

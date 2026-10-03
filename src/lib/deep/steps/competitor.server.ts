import type { StepResult } from "../contracts";
import type { StepEnv } from "../env.server";
import { bi } from "../parse/format";
import { extractPageLite } from "../parse/page";
import { detectProviders } from "../parse/providers";
import { textProvesCompany } from "../parse/registry";
import { detectParked } from "../parse/web";

import { fact, isoDay, type StepDraft } from "./common.server";

/*
 * Step 8, "competitor" ×3 (plan A3, D8): a rival's own homepage, read
 * politely (robots first, one page), for booking, shop and the important
 * website issues. The CUI must be one of the rivals in the attested peers
 * result (the dispatcher refuses any other). Rivals' sites come only from the
 * Trade Register index: no guessing of other people's domains.
 */

export type RivalValue = {
  cui: string;
  name: string;
  website?: string;
  turnover?: number;
};

export function rivalFromPeers(peers: StepResult, cui: string): RivalValue | null {
  const f = peers.facts.find((x) => x.id === `peers.rival.${cui}` && x.predicate === "peers.rival");
  return f ? (f.value as RivalValue) : null;
}

export async function runCompetitor(
  env: StepEnv,
  input: { peers: StepResult; cui: string },
): Promise<StepDraft> {
  const today = isoDay(env.now());
  const rival = rivalFromPeers(input.peers, input.cui);
  if (!rival) return { status: "failed", facts: [], gaps: [] };
  const base = {
    id: `competitors.site.${rival.cui}`,
    section: "competitors" as const,
    predicate: "competitors.site",
    source: "competitor_site" as const,
    asOf: today,
    method: "html" as const,
  };
  if (!rival.website) {
    return {
      status: "skipped",
      facts: [
        fact({
          ...base,
          value: { cui: rival.cui, website: null },
          display: bi(
            `${rival.name}: no website listed in the Trade Register`,
            `${rival.name}: niciun site declarat la Registrul Comerțului`,
          ),
          source: "onrc",
          confidence: "confirmat",
          method: "bulk",
        }),
      ],
      gaps: [],
    };
  }
  const page = await env.polite.get(rival.website);
  if (!page.ok || page.status >= 400 || !page.html) {
    const why = page.ok ? `HTTP ${page.status}` : page.blocked;
    return {
      status: "partial",
      facts: [
        fact({
          ...base,
          value: { cui: rival.cui, website: rival.website, reachable: false },
          display: bi(
            `${rival.name}: the website could not be read (${why})`,
            `${rival.name}: site-ul nu a putut fi citit (${why})`,
          ),
          confidence: "confirmat",
        }),
      ],
      gaps: [],
    };
  }
  const parked = detectParked(page.text, new URL(page.url).hostname);
  const lite = extractPageLite(page.text, page.url, page.status);
  const providers = detectProviders(page.text);
  const ld = JSON.stringify(lite.jsonLd);
  const shop =
    /"Product"/.test(ld) ||
    /add to cart|adaug[aă] [îi]n co[sș]/i.test(lite.text) ||
    lite.links.some((l) => /\/(cart|cos|checkout)(\/|$)/i.test(l.url ?? ""));
  const booking =
    providers.booking.length > 0 ||
    lite.links.some((l) =>
      /programar|rezerv|booking|appointment/i.test(`${l.url ?? ""} ${l.text}`),
    );
  const proof = textProvesCompany(`${lite.text}\n${lite.footerText}`, { cui: rival.cui });
  let importantIssues: number | undefined;
  if (!parked.parked) {
    const audit = await env.auditSite({
      requestedUrl: page.requestedUrl,
      cui: rival.cui,
      name: rival.name,
      home: {
        url: page.url,
        status: page.status,
        html: page.text,
        headers: page.headers,
        ttfbMs: page.ttfbMs,
        redirects: page.redirects,
      },
      pages: [],
      brokenPages: [],
      robots: {},
      sitemap: { found: false },
      faviconFound: /<link[^>]+rel=["'][^"']*icon/i.test(page.text),
    });
    importantIssues = audit?.findings.filter(
      (f) => f.severity === "critical" || f.severity === "high",
    ).length;
  }
  const parts = [
    booking ? bi("online booking", "programare online") : null,
    shop ? bi("online shop", "magazin online") : null,
    providers.chat.length ? bi("chat", "chat") : null,
  ].filter((p): p is { en: string; ro: string } => p !== null);
  const summary = parked.parked
    ? bi("parked or for-sale page", "pagină parcată sau de vânzare")
    : parts.length
      ? bi(parts.map((p) => p.en).join(", "), parts.map((p) => p.ro).join(", "))
      : bi(
          "no booking or shop seen on the homepage",
          "nu am văzut programare sau magazin pe pagina principală",
        );
  return {
    status: "done",
    facts: [
      fact({
        ...base,
        value: {
          cui: rival.cui,
          website: page.url,
          reachable: true,
          parked: parked.parked,
          booking,
          bookingProviders: providers.booking,
          shop,
          chat: providers.chat,
          importantIssues,
          siteVerified: proof.cui,
        },
        display: bi(`${rival.name}: ${summary.en}`, `${rival.name}: ${summary.ro}`),
        confidence: proof.cui ? "confirmat" : "probabil",
        score: proof.cui ? 1 : 0.8,
        evidence: { url: page.url },
        observed: { pagesRead: 1 },
      }),
    ],
    gaps: [],
    counters: { pagesRead: 1, subrequests: env.counters().subrequests },
  };
}

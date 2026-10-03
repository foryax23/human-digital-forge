import type { Bilingual, Fact } from "../contracts";
import { bi, count } from "../parse/format";
import type { PageLite } from "../parse/page";
import { peopleGates } from "../parse/people";
import type { RulesExtraction } from "../parse/rules-extract";
import {
  canonicalPageUrl,
  classifyPageUrl,
  SKIP_PATH,
  siteHost,
  type PageKind,
} from "../parse/web";

import { fact, presenceDisplay } from "./common.server";

/*
 * Shared by the audit and crawl steps: which pages to read next (homepage
 * links first, then the sitemap, by kind with quotas, canonical URLs, robots
 * rules, never logins or carts) and how deterministic extraction becomes
 * facts. Presence facts keep one ID per run ("site.booking.present"); the
 * finish step merges them across batches (found anywhere wins, pages read add up).
 */

export const PAGE_QUOTA: Record<PageKind, number> = {
  home: 1,
  contact: 2,
  services: 4,
  pricing: 2,
  booking: 1,
  about: 2,
  team: 2,
  careers: 2,
  legal: 3,
  locations: 2,
  products: 3,
  faq: 1,
  blog: 1,
  other: 4,
};
const KIND_PRIORITY: PageKind[] = [
  "contact",
  "services",
  "pricing",
  "booking",
  "about",
  "team",
  "careers",
  "legal",
  "locations",
  "products",
  "faq",
  "other",
  "blog",
];

export type QueuedPage = { url: string; kind: PageKind; fromHome: boolean };

/** Candidate pages, best first, deduplicated against what was read. */
export function rankCandidates(
  links: Array<{ url?: string; text: string; internal: boolean }>,
  sitemapUrls: string[],
  origin: string,
  read: Set<string>,
  kindsRead: Partial<Record<PageKind, number>>,
): QueuedPage[] {
  const host = siteHost(new URL(origin).hostname);
  const seen = new Set(read);
  const out: QueuedPage[] = [];
  const add = (raw: string | undefined, fromHome: boolean, text = "") => {
    if (!raw) return;
    let url: URL;
    try {
      url = new URL(raw, origin);
    } catch {
      return;
    }
    if (siteHost(url.hostname) !== host || !/^https?:$/.test(url.protocol)) return;
    url.hash = "";
    if (SKIP_PATH.test(`${url.pathname}${url.search}`) || url.search.length > 60) return;
    const key = canonicalPageUrl(url.href);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url: url.href, kind: classifyPageUrl(url.href, text), fromHome });
  };
  for (const link of links) if (link.internal) add(link.url, true, link.text);
  for (const url of sitemapUrls.slice(0, 3000)) add(url, false);
  const used: Partial<Record<PageKind, number>> = { ...kindsRead };
  const chosen: QueuedPage[] = [];
  const byKind = (kind: PageKind) =>
    out
      .filter((c) => c.kind === kind)
      .sort((a, b) => Number(b.fromHome) - Number(a.fromHome) || a.url.length - b.url.length);
  for (const kind of KIND_PRIORITY) {
    for (const candidate of byKind(kind)) {
      if ((used[kind] ?? 0) >= PAGE_QUOTA[kind]) break;
      if (kind === "other" && !candidate.fromHome) continue;
      used[kind] = (used[kind] ?? 0) + 1;
      chosen.push(candidate);
    }
  }
  return chosen;
}

/** <loc> URLs of a sitemap or the child sitemaps of an index (pages first, products last). */
export function parseSitemap(xml: string): { urls: string[]; children: string[] } {
  const locs = [
    ...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi),
  ].map((m) => m[1].replace(/&amp;/g, "&"));
  if (/<sitemapindex[\s>]/i.test(xml.slice(0, 5000))) {
    const score = (u: string) =>
      /page|pagin/i.test(u)
        ? 0
        : /categor|service|post/i.test(u)
          ? 1
          : /product|image|media|attachment/i.test(u)
            ? 3
            : 2;
    return { urls: [], children: locs.sort((a, b) => score(a) - score(b)) };
  }
  return { urls: locs, children: [] };
}

/** Deterministic extraction → facts for one batch of pages. */
export function rulesToFacts(
  rules: RulesExtraction,
  opts: { batch: string; asOf: string; caen?: string; firstBatch: boolean },
): Fact[] {
  const facts: Fact[] = [];
  const pages = rules.pagesRead;
  const gates = peopleGates(opts.caen);
  const site = {
    section: "site" as const,
    source: "site" as const,
    asOf: opts.asOf,
    method: "html" as const,
    observed: { pagesRead: pages },
  };
  const presence = (
    id: string,
    value: boolean,
    what: Bilingual,
    detail?: Bilingual,
    url?: string,
    confidence: "confirmat" | "probabil" = "confirmat",
  ) =>
    fact({
      ...site,
      id,
      predicate: id,
      value,
      display: presenceDisplay(value, what, pages, detail),
      confidence: value ? confidence : "confirmat",
      evidence: url ? { url } : undefined,
    });

  facts.push(
    presence(
      "site.cui.present",
      rules.identity.cui,
      bi("the tax code (CUI)", "codul fiscal (CUI)"),
      undefined,
      rules.identity.cuiUrl,
    ),
    presence(
      "site.reg_no.present",
      rules.identity.regNo,
      bi("the Trade Register number", "numărul de la Registrul Comerțului"),
      undefined,
      rules.identity.regNoUrl,
    ),
    presence(
      "site.phone.present",
      rules.contact.phone,
      bi("a phone number", "un număr de telefon"),
    ),
    presence(
      "site.contact_form.present",
      rules.contact.contactForm,
      bi("a contact form", "un formular de contact"),
    ),
    presence(
      "site.contact.present",
      rules.contact.phone ||
        rules.contact.contactForm ||
        rules.contact.genericEmails.length > 0 ||
        rules.contact.whatsapp,
      bi("a way to contact the company", "o cale de contact"),
    ),
  );
  if (rules.contact.genericEmails.length) {
    const list = rules.contact.genericEmails.join(", ");
    facts.push(
      fact({
        ...site,
        id: "site.email.generic",
        predicate: "site.email.generic",
        value: rules.contact.genericEmails,
        display: bi(list, list),
        confidence: "confirmat",
      }),
    );
  }
  if (rules.contact.personalEmailCount) {
    facts.push(
      fact({
        ...site,
        id: `site.email.personal_count.${opts.batch}`,
        predicate: "site.email.personal_count",
        value: rules.contact.personalEmailCount,
        display: count(rules.contact.personalEmailCount),
        confidence: "confirmat",
        gdpr: "G1",
      }),
    );
  }
  const booking = rules.providers.booking.length > 0 || Boolean(rules.bookingPage);
  facts.push(
    presence(
      "site.booking.present",
      booking,
      bi("online booking or a quote request", "programare online sau cerere de ofertă"),
      rules.providers.booking.length
        ? bi(rules.providers.booking.join(", "), rules.providers.booking.join(", "))
        : undefined,
      rules.bookingPage,
    ),
  );
  const providerFact = (id: string, names: string[]) =>
    names.length
      ? fact({
          ...site,
          id,
          predicate: id,
          value: names,
          display: bi(names.join(", "), names.join(", ")),
          confidence: "confirmat",
        })
      : null;
  for (const f of [
    providerFact("site.booking.provider", rules.providers.booking),
    providerFact("site.delivery.provider", rules.providers.delivery),
    providerFact("site.chat.provider", rules.providers.chat),
  ]) {
    if (f) facts.push(f);
  }
  facts.push(presence("site.shop.present", rules.shop, bi("an online shop", "un magazin online")));
  if (rules.analytics.length) {
    facts.push(
      fact({
        ...site,
        id: "site.analytics.present",
        predicate: "site.analytics.present",
        value: rules.analytics,
        display: bi(rules.analytics.join(", "), rules.analytics.join(", ")),
        confidence: "confirmat",
      }),
    );
    if (!rules.consentManagers.length && opts.firstBatch) {
      facts.push(
        fact({
          ...site,
          id: "site.consent.before_analytics",
          predicate: "site.consent.before_analytics",
          value: true,
          display: bi(
            "Visitor statistics load with the page; we saw no consent banner tool",
            "Statisticile despre vizitatori pornesc odată cu pagina; nu am văzut un instrument pentru acordul vizitatorului",
          ),
          confidence: "probabil",
          score: 0.7,
        }),
      );
    }
  }
  facts.push(
    presence(
      "site.legal.privacy",
      rules.legal.privacy,
      bi("a privacy policy", "o politică de confidențialitate"),
    ),
    presence(
      "site.legal.terms",
      rules.legal.terms,
      bi("terms and conditions", "termeni și condiții"),
    ),
    presence(
      "site.legal.anpc",
      rules.legal.anpc,
      bi("the consumer-protection (ANPC) links", "linkurile ANPC"),
    ),
  );
  if (rules.social.length) {
    const names = rules.social.map((s) => s.platform);
    facts.push(
      fact({
        id: "presence.social_linked",
        section: "presence",
        predicate: "presence.social_linked",
        value: rules.social,
        display: bi(names.join(", "), names.join(", ")),
        source: "site",
        asOf: opts.asOf,
        confidence: "confirmat",
        method: "html",
      }),
    );
  }
  facts.push(
    fact({
      id: "presence.google_profile_linked",
      section: "presence",
      predicate: "presence.google_profile_linked",
      value: rules.googleProfileLinked,
      display: presenceDisplay(
        rules.googleProfileLinked,
        bi("a link to a Google profile", "un link către profilul Google"),
        pages,
      ),
      source: "site",
      asOf: opts.asOf,
      confidence: "confirmat",
      method: "html",
      observed: { pagesRead: pages },
    }),
  );
  rules.hours.slice(0, 3).forEach((h, i) =>
    facts.push(
      fact({
        id: `offers.hours.r${opts.batch}.${i}`,
        section: "offers",
        predicate: "offers.hours",
        value: h.text,
        display: bi(h.text, h.text),
        source: "site",
        asOf: opts.asOf,
        confidence: "confirmat",
        method: /^ld:/.test(h.text) ? "jsonld" : "html",
        evidence: { url: h.url, quote: h.quote },
      }),
    ),
  );
  rules.prices.slice(0, 8).forEach((p, i) => {
    const amount = p.currency === "lei" ? `${p.amount} lei` : `${p.amount} EUR`;
    const text = p.item ? `${p.item}: ${amount}` : amount;
    facts.push(
      fact({
        id: `offers.price.r${opts.batch}.${i}`,
        section: "offers",
        predicate: "offers.price",
        value: { item: p.item, amount: p.amount, currency: p.currency },
        display: bi(text, text),
        source: "site",
        asOf: opts.asOf,
        confidence: "confirmat",
        method: "html",
        evidence: { url: p.url, quote: p.quote },
      }),
    );
  });
  rules.services.slice(0, 10).forEach((s, i) =>
    facts.push(
      fact({
        id: `offers.services.r${opts.batch}.${i}`,
        section: "offers",
        predicate: "offers.services",
        value: s.text,
        display: bi(s.text, s.text),
        source: "site",
        asOf: opts.asOf,
        confidence: "probabil",
        method: "html",
        evidence: { url: s.url, quote: s.quote },
      }),
    ),
  );
  if (!gates.skipPupils) {
    facts.push(
      fact({
        id: "people.hiring",
        section: "people",
        predicate: "people.hiring",
        value: rules.jobs.length > 0,
        display: rules.jobs.length
          ? bi(
              `Yes: ${rules.jobs.length} jobs advertised`,
              `Da: ${rules.jobs.length} posturi anunțate`,
            )
          : presenceDisplay(false, bi("job ads", "anunțuri de angajare"), pages),
        source: "site",
        asOf: opts.asOf,
        confidence: "confirmat",
        method: "html",
        observed: { pagesRead: pages },
        gdpr: "G1",
      }),
    );
    if (!gates.countsOnly) {
      rules.jobs.slice(0, 6).forEach((j, i) =>
        facts.push(
          fact({
            id: `people.job_titles.r${opts.batch}.${i}`,
            section: "people",
            predicate: "people.job_titles",
            value: j.text,
            display: bi(j.text, j.text),
            source: "site",
            asOf: opts.asOf,
            confidence: "confirmat",
            method: "html",
            evidence: { url: j.url, quote: j.quote },
            gdpr: "G1",
          }),
        ),
      );
      rules.roles.slice(0, 8).forEach((r, i) =>
        facts.push(
          fact({
            id: `people.roles.r${opts.batch}.${i}`,
            section: "people",
            predicate: "people.roles",
            value: { title: r.title, count: r.count },
            display: bi(
              r.count > 1 ? `${r.title} (${r.count})` : r.title,
              r.count > 1 ? `${r.title} (${r.count})` : r.title,
            ),
            source: "site",
            asOf: opts.asOf,
            confidence: "probabil",
            method: "html",
            gdpr: "G1",
          }),
        ),
      );
    }
    if (rules.teamCards >= 2) {
      facts.push(
        fact({
          id: `people.team_size_published.r${opts.batch}`,
          section: "people",
          predicate: "people.team_size_published",
          value: rules.teamCards,
          display: count(rules.teamCards),
          source: "site",
          asOf: opts.asOf,
          confidence: "probabil",
          method: "html",
          gdpr: "G1",
          evidence: {
            note: bi(
              "Team cards counted; no names kept.",
              "Am numărat cardurile echipei; nu păstrăm nume.",
            ),
          },
        }),
      );
    }
  }
  if (rules.tdmReserved) {
    facts.push(
      fact({
        ...site,
        id: "site.tdm_reserved",
        predicate: "site.tdm_reserved",
        value: true,
        display: bi(
          "The site reserves text-and-data mining: short quotes only, no text sent to AI",
          "Site-ul își rezervă drepturile de extragere: doar citate scurte, fără text trimis la AI",
        ),
        confidence: "confirmat",
      }),
    );
  }
  return facts;
}

/** A text-and-data-mining reservation sent as an HTTP header counts like the meta tag. */
export function withTdmHeader<T extends PageLite>(page: T, headers: Record<string, string>): T {
  const header = /^\s*1\s*$/.test(headers["tdm-reservation"] ?? "");
  return header && !page.tdmReserved ? { ...page, tdmReserved: true } : page;
}

/** Plain text of a page for extraction: title, headings and body text. */
export function pageText(page: PageLite): string {
  return [page.title, page.description, page.text].filter(Boolean).join("\n").slice(0, 20_000);
}

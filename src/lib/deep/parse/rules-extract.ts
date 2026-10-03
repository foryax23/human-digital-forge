import type { PageLite } from "./page";
import { jsonLdObjects, jsonLdTypes } from "./page";
import {
  cleanRoleTitle,
  containsPersonalName,
  isGenericEmail,
  looksLikePersonalName,
} from "./people";
import { detectAnalytics, detectConsentManager, detectProviders } from "./providers";
import { amountInQuote, parseLocaleNumber, quoteLimit, verifyQuote } from "./quotes";
import { findCompanyIdsInText, normalizeRegNo } from "./registry";
import { clip, collapse, fold } from "./text";
import { classifyPageUrl, isBuilderSocialLink, type PageKind } from "./web";

/*
 * Deterministic extraction over the pages read (client-safe): identity on the
 * site, contacts (business only), providers, shop and analytics signals,
 * legal pages, social links, opening hours and prices with verified quotes,
 * job titles and role titles without names. This is the whole extraction in
 * rules-only mode and the baseline that the Haiku pass adds to.
 */

export type ExtractedItem = { text: string; quote: string; url: string };
export type ExtractedPrice = {
  item?: string;
  amount: number;
  currency: "lei" | "eur";
  quote: string;
  url: string;
};

export type RulesExtraction = {
  pagesRead: number;
  kinds: PageKind[];
  identity: {
    cui: boolean;
    regNo: boolean;
    cuiUrl?: string;
    regNoUrl?: string;
    otherCuis: string[];
  };
  contact: {
    phone: boolean;
    genericEmails: string[];
    personalEmailCount: number;
    contactForm: boolean;
    whatsapp: boolean;
  };
  providers: { booking: string[]; delivery: string[]; chat: string[] };
  bookingPage?: string;
  shop: boolean;
  analytics: string[];
  consentManagers: string[];
  legal: { privacy: boolean; terms: boolean; anpc: boolean };
  social: Array<{ platform: string; url: string }>;
  googleProfileLinked: boolean;
  hours: ExtractedItem[];
  prices: ExtractedPrice[];
  services: ExtractedItem[];
  jobs: ExtractedItem[];
  roles: Array<{ title: string; count: number }>;
  teamCards: number;
  tdmReserved: boolean;
};

const PHONE_RO = /(?<![\d/])(?:\+40|0040|\(?0)\s?\)?\s?[237](?:[\s.\-()]*\d){8}(?![\d/])/;
const EMAIL_G = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}\b/gi;
const EMAIL_NOISE =
  /\.(png|jpe?g|webp|gif|svg|avif)$|@(example|sentry|wixpress|domain|email|sentry-next)\.|@\d+x\./i;
const PRICE_G =
  /(?<!capital(?: social)?:?\s{0,3})(\d{1,3}(?:[.\s\u00a0]\d{3})*(?:[.,]\d{1,2})?)\s?(lei|ron|€|eur|euro)\b/gi;
const HOURS_RO =
  /\b(luni|lun\.?|l)\s*[-–—]\s*(vineri|vin\.?|v|s[âa]mb[ăa]t[ăa]|s[âa]m\.?|duminic[ăa]|dum\.?)\s*[:,]?\s*(?:între\s*)?(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})/gi;
const CART =
  /\/(cart|cos|cos-de-cumparaturi|checkout|finalizare-comanda|basket)(\/|$|\?)|[?&]add-to-cart=/i;
const ADD_TO_CART = /\badd to (cart|basket)\b|adaug[aă] [îi]n co[sș]/i;
// Unicode lookarounds instead of \b: JavaScript's \b does not see "Ș" in "Șofer" as a letter.
const JOB_WORDS =
  /(?<![\p{L}\p{N}])(angaj[ăa]m|post(ul)?|job|c[ăa]ut[ăa]m|hiring|vacan|recrut|[șs]ofer|contabil|inginer|v[âa]nz[ăa]tor|operator|muncitor|electrician|tehnician|asistent|medic|osp[ăa]tar|buc[ăa]tar|barman|cosmetician|stilist|manager|developer|designer|agent|dispecer|gestionar|lucr[ăa]tor|consultant|specialist)/iu;
const SOCIAL: Array<[string, RegExp]> = [
  ["facebook", /(^|\.)facebook\.com\/(?!sharer|share|dialog|plugins|tr\b)/i],
  ["instagram", /(^|\.)instagram\.com\/(?!p\/|explore)/i],
  ["linkedin", /(^|\.)linkedin\.com\/(company|in|school)\//i],
  ["youtube", /(^|\.)youtube\.com\/(channel|c|user|@)|youtu\.be\//i],
  ["tiktok", /(^|\.)tiktok\.com\/@/i],
  ["x", /(^|\.)(twitter|x)\.com\/(?!intent|share|home)[A-Za-z0-9_]{2,}/i],
  ["pinterest", /(^|\.)pinterest\.(com|ro)\/(?!pin\/create)/i],
];
const GOOGLE_PROFILE =
  /\bg\.page\/|maps\.app\.goo\.gl\/|google\.[a-z.]+\/maps\/place\/|business\.google\.com|search\.google\.com\/local\/writereview|goo\.gl\/maps/i;

export function extractRules(
  pages: Array<PageLite & { html?: string }>,
  company: { cui: string; regNo?: string },
): RulesExtraction {
  const ok = pages.filter((p) => p.status < 400);
  const tdmReserved = ok.some((p) => p.tdmReserved);
  const limit = quoteLimit(tdmReserved);
  const kinds = ok.map((p) => classifyPageUrl(p.url));
  const reg = company.regNo ? normalizeRegNo(company.regNo) : null;

  const identity: RulesExtraction["identity"] = { cui: false, regNo: false, otherCuis: [] };
  const otherCuis = new Set<string>();
  for (const page of ok) {
    const ids = findCompanyIdsInText(`${page.text}\n${page.footerText}`);
    if (ids.cuis.includes(company.cui) && !identity.cui) {
      identity.cui = true;
      identity.cuiUrl = page.url;
    }
    if (reg && ids.regNos.includes(reg.key) && !identity.regNo) {
      identity.regNo = true;
      identity.regNoUrl = page.url;
    }
    for (const cui of ids.cuis) if (cui !== company.cui) otherCuis.add(cui);
  }
  identity.otherCuis = [...otherCuis].slice(0, 5);

  const allLinks = ok.flatMap((p) => p.links);
  const emails = new Set<string>();
  for (const page of ok)
    for (const m of page.text.matchAll(EMAIL_G)) emails.add(m[0].toLowerCase());
  for (const link of allLinks) {
    if (/^mailto:/i.test(link.href))
      emails.add(
        link.href
          .replace(/^mailto:/i, "")
          .split("?")[0]
          .toLowerCase(),
      );
  }
  const cleanEmails = [...emails].filter((e) => e.includes("@") && !EMAIL_NOISE.test(e));
  const generic = cleanEmails.filter(isGenericEmail);
  const html = (p: PageLite & { html?: string }) =>
    p.html ??
    `${p.scriptSrcs.join("\n")}\n${p.iframes.join("\n")}\n${p.links.map((l) => l.href).join("\n")}\n${p.inlineScripts}`;
  const allHtml = ok.map(html).join("\n");
  const providers = detectProviders(allHtml);

  const contact: RulesExtraction["contact"] = {
    phone: allLinks.some((l) => /^tel:/i.test(l.href)) || ok.some((p) => PHONE_RO.test(p.text)),
    genericEmails: generic.slice(0, 5),
    personalEmailCount: cleanEmails.length - generic.length,
    contactForm: ok.some((p) => p.forms.some((f) => f.kind === "contact")),
    whatsapp: providers.chat.includes("WhatsApp"),
  };

  const bookingPage = ok.find((p) => classifyPageUrl(p.url) === "booking")?.url;
  const ld = ok.flatMap((p) => jsonLdObjects(p.jsonLd).map((o) => ({ o, url: p.url })));
  const ldTypes = new Set(ld.flatMap(({ o }) => jsonLdTypes(o)));
  const shop =
    (ldTypes.has("Product") && (ldTypes.has("Offer") || ldTypes.has("AggregateOffer"))) ||
    allLinks.some((l) => l.url && CART.test(l.url)) ||
    ok.some((p) => ADD_TO_CART.test(p.text));

  const linkText = fold(allLinks.map((l) => `${l.text} ${l.url ?? l.href}`).join(" "));
  const legal = {
    privacy: /confiden|privacy|gdpr|prelucrarea datelor|protectia datelor/.test(linkText),
    terms: /termeni|terms|conditii/.test(linkText),
    anpc: /anpc\.ro|reclamatii\.anpc|\bsal\b|solutionarea alternativa|ec\.europa\.eu\/consumers\/odr/.test(
      linkText,
    ),
  };

  const social: RulesExtraction["social"] = [];
  for (const link of allLinks) {
    const url = link.url ?? link.href;
    if (!/^https?:/i.test(url) || isBuilderSocialLink(url)) continue;
    let host = "";
    let path = "";
    try {
      const u = new URL(url);
      host = u.hostname;
      path = `${u.hostname}${u.pathname}`;
    } catch {
      continue;
    }
    const hit = SOCIAL.find(([, re]) => re.test(path));
    if (!hit || !host) continue;
    if (!social.some((s) => s.platform === hit[0]))
      social.push({ platform: hit[0], url: url.split("?")[0] });
  }
  const googleProfileLinked = allLinks.some((l) => GOOGLE_PROFILE.test(l.url ?? l.href));

  const hours: ExtractedItem[] = [];
  for (const { o, url } of ld) {
    const spec = o.openingHoursSpecification;
    const simple = o.openingHours;
    for (const h of Array.isArray(simple) ? simple : simple ? [simple] : []) {
      if (typeof h === "string" && hours.length < 6)
        hours.push({ text: h, quote: clip(h, limit), url });
    }
    for (const s of Array.isArray(spec) ? spec : spec ? [spec] : []) {
      if (!s || typeof s !== "object" || hours.length >= 6) continue;
      const r = s as Record<string, unknown>;
      const days = ([] as unknown[])
        .concat(r.dayOfWeek ?? [])
        .map((d) => String(d).replace(/^https?:\/\/schema\.org\//, ""));
      const text = `${days.join(", ")} ${r.opens ?? ""}–${r.closes ?? ""}`.trim();
      hours.push({ text, quote: clip(text, limit), url });
    }
  }
  for (const page of ok) {
    for (const m of page.text.matchAll(HOURS_RO)) {
      if (hours.length >= 6) break;
      const quote = verifyQuote(m[0], page.text, limit);
      if (quote) hours.push({ text: collapse(m[0]), quote, url: page.url });
    }
  }

  const prices: ExtractedPrice[] = [];
  for (const page of ok) {
    if (prices.length >= 20) break;
    for (const line of page.text.split("\n")) {
      if (prices.length >= 20) break;
      for (const m of line.matchAll(PRICE_G)) {
        const amount = parseLocaleNumber(m[1]);
        // Prices a customer pays: not insurance covers, capital, budgets or grants.
        if (!Number.isFinite(amount) || amount <= 0 || amount > 50_000) continue;
        const index = m.index ?? 0;
        const start = Math.max(0, index - 70);
        if (
          /asigur|capital|valoare de|cifr[aă] de afaceri|profit|buget|finan[țt]are|grant|fonduri|proiect cu/i.test(
            line.slice(start, index),
          )
        )
          continue;
        const snippet = collapse(line.slice(start, index + m[0].length));
        const quote = verifyQuote(snippet, page.text, limit);
        if (!quote || !amountInQuote(amount, quote)) continue;
        const rawItem =
          collapse(line.slice(start, index).replace(/[:\-–|•]+\s*$/, "")).slice(-60) || undefined;
        const item = rawItem && !containsPersonalName(rawItem) ? rawItem : undefined;
        if (containsPersonalName(quote)) continue;
        if (prices.some((p) => p.amount === amount && p.item === item)) continue;
        prices.push({
          item,
          amount,
          currency: /€|eur/i.test(m[2]) ? "eur" : "lei",
          quote,
          url: page.url,
        });
        if (prices.length >= 20) break;
      }
    }
  }

  const services: ExtractedItem[] = [];
  const GENERIC_HEADING =
    /^(contact|despre( noi)?|about( us)?|servicii(le noastre)?|services|blog|noutati|acasa|home|meniu|menu|newsletter|program|adresa|telefon|e-?mail|categorii|produse( recomandate)?|cos|login|cont|cariere|echipa|parteneri|testimoniale|recenzii|faq|intrebari frecvente|politica.*|termeni.*|cookie.*|gdpr|anpc|.*copyright.*|follow us|urmareste-ne|\d+)$/;
  for (const page of ok) {
    const kind = classifyPageUrl(page.url);
    // Service and price pages only: shop and home headings are taglines, filters and authors.
    if (!["services", "pricing"].includes(kind)) continue;
    for (const h of page.headings) {
      if (services.length >= 25) break;
      if (h.level < 2 || h.level > 3) continue;
      const text = collapse(h.text);
      if (text.length < 4 || text.length > 80 || GENERIC_HEADING.test(fold(text))) continue;
      // Taglines and questions are not service names ("Vă mai putem oferi", "De ce noi?").
      if (/[?!]$/.test(text) || text.split(" ").length > 6) continue;
      if (
        /^(va|ne|noi|de ce|cum|ce|why|how|our|we|let|hai|afla|descopera|colaborator)/.test(
          fold(text),
        )
      )
        continue;
      if (looksLikePersonalName(text) || containsPersonalName(text)) continue;
      if (services.some((s) => fold(s.text) === fold(text))) continue;
      services.push({ text, quote: clip(text, limit), url: page.url });
    }
  }

  const jobs: ExtractedItem[] = [];
  for (const { o, url } of ld) {
    if (!jsonLdTypes(o).includes("JobPosting")) continue;
    const title = typeof o.title === "string" ? cleanRoleTitle(o.title) : null;
    if (title && !containsPersonalName(title) && jobs.length < 15)
      jobs.push({ text: title, quote: clip(title, limit), url });
  }
  for (const page of ok.filter((p) => classifyPageUrl(p.url) === "careers")) {
    for (const h of page.headings) {
      if (jobs.length >= 15) break;
      if (!JOB_WORDS.test(h.text) || h.text.length > 80) continue;
      const title = cleanRoleTitle(h.text);
      if (
        title &&
        !containsPersonalName(title) &&
        !jobs.some((j) => fold(j.text) === fold(title))
      ) {
        jobs.push({ text: title, quote: clip(title, limit), url: page.url });
      }
    }
  }

  const roleCounts = new Map<string, number>();
  let teamCards = 0;
  for (const page of ok.filter((p) => ["team", "about"].includes(classifyPageUrl(p.url)))) {
    for (const h of page.headings) {
      if (looksLikePersonalName(h.text)) {
        teamCards++;
        continue;
      }
      const title = h.text.length <= 60 ? cleanRoleTitle(h.text) : null;
      if (title && !containsPersonalName(title))
        roleCounts.set(title, (roleCounts.get(title) ?? 0) + 1);
    }
    for (const line of page.text.split("\n")) {
      if (line.length > 50 || looksLikePersonalName(line)) continue;
      const title = cleanRoleTitle(line);
      if (title && !containsPersonalName(title))
        roleCounts.set(title, (roleCounts.get(title) ?? 0) + 1);
    }
  }
  const roles = [...roleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([title, n]) => ({ title, count: n }));

  return {
    pagesRead: ok.length,
    kinds,
    identity,
    contact,
    providers,
    bookingPage,
    shop,
    analytics: detectAnalytics(allHtml),
    consentManagers: detectConsentManager(allHtml),
    legal,
    social,
    googleProfileLinked,
    hours,
    prices,
    services,
    jobs,
    roles,
    teamCards,
    tdmReserved,
  };
}

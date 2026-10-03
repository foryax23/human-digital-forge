import { fold } from "./text";

/*
 * Pure helpers for reading websites (client-safe, unit-tested): content-type
 * sniffing, parked-domain detection, canonical page URLs, page classification,
 * site-builder social links and domain guesses from a company name. Eng 3
 * imports looksLikeHtml and detectParked for the quick scan's discovery (B4).
 */

/** Some servers (e.g. Jetty on libris.ro) send no Content-Type: sniff the head of the body. */
export function looksLikeHtml(contentType: string, head: string): boolean {
  if (/html|xhtml/i.test(contentType)) return true;
  if (contentType && !/^(text\/plain|application\/octet-stream)/i.test(contentType)) return false;
  return /^\s*(<!doctype html|<html|<head|<body|<!--|<meta|<title)/i.test(head.slice(0, 600));
}

const PARKED_PATTERNS: Array<[RegExp, string]> = [
  [/\b(este|is) de v[aâ]nzare\b/, "de vânzare"],
  [
    /domeniul?\s+(este\s+)?de\s+v[aâ]nzare|acest domeniu (este )?de v[aâ]nzare/,
    "domeniu de vânzare",
  ],
  [/domeniu(l)? (este )?disponibil/, "domeniu disponibil"],
  [
    /(this )?domain (name )?(is |may be )?for sale|buy this domain|make an offer/,
    "domain for sale",
  ],
  [
    /sedo(parking)?\b|afternic|hugedomains|dan\.com|bodis\.com|parkingcrew|above\.com/,
    "parking service",
  ],
  [/parked (free|domain|by)|domain parking/, "parked domain"],
  [
    /default web ?site page|apache2? (ubuntu |debian )?default page|welcome to nginx|it works!/,
    "server default page",
  ],
  [
    /account (has been )?suspended|cont suspendat|this account has been suspended/,
    "account suspended",
  ],
  [
    /site [îi]n construc[țt]ie|under construction|coming soon|website coming soon/,
    "under construction",
  ],
];

/**
 * A parked, for-sale, default or suspended page. Checked on the title and the
 * first part of the text, and only for short pages, so a real site that
 * mentions "coming soon" for one product is not flagged. "<host> este de
 * vânzare" (esthetique.ro) counts on any page length.
 */
export function detectParked(html: string, host: string): { parked: boolean; reason?: string } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const haystack = fold(`${title} ${text.slice(0, 4000)}`);
  const bare = fold(host.replace(/^www\./, ""));
  if (bare && haystack.includes(`${bare} este de vanzare`)) {
    return { parked: true, reason: `${host} este de vânzare` };
  }
  const words = text.split(" ").filter(Boolean).length;
  if (words > 600) return { parked: false };
  for (const [pattern, reason] of PARKED_PATTERNS) {
    if (pattern.test(haystack)) return { parked: true, reason };
  }
  return { parked: false };
}

const DROP_PARAMS =
  /^(utm_|fbclid$|gclid$|msclkid$|mc_|language$|lang$|ref$|_ga$|hl$|sessionid$|sid$)/i;

/**
 * Dedupe key of a page: no fragment, tracking and language parameters
 * dropped, index files folded, trailing slash removed, "www." ignored.
 */
export function canonicalPageUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()])
      if (DROP_PARAMS.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    const path =
      u.pathname
        .replace(/\/(index|default|home)\.(html?|php|aspx?|jsp)$/i, "/")
        .replace(/\/+$/, "") || "/";
    const query = u.searchParams.toString();
    return `${u.protocol}//${u.host.replace(/^www\./, "").toLowerCase()}${path}${query ? `?${query}` : ""}`;
  } catch {
    return url;
  }
}

/** Social links that site builders insert by default (Wix, Squarespace…), not the firm's own. */
export function isBuilderSocialLink(url: string): boolean {
  return /(facebook|instagram|twitter|x|linkedin|youtube|pinterest|tiktok)\.com\/(wix|wixcom|squarespace|wordpressdotcom|wordpress|godaddy|weebly|webflow|shopify|jimdo|strikingly|site123|mozello|gomag|incomaker|elementor)\/?($|\?)/i.test(
    url,
  );
}

/** "www.Libris.ro" → "libris.ro". */
export const siteHost = (hostname: string) => hostname.toLowerCase().replace(/^www\./, "");

/**
 * Social networks, link hubs, maps and company directories: never the firm's own
 * site and never fetched by deep research (plan A9, D4). Matches the domain and
 * its subdomains ("m.facebook.com", "ro.linkedin.com").
 */
const SOCIAL_OR_DIRECTORY_DOMAINS = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "instagr.am",
  "linkedin.com",
  "lnkd.in",
  "twitter.com",
  "x.com",
  "t.co",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "pinterest.com",
  "threads.net",
  "whatsapp.com",
  "wa.me",
  "t.me",
  "telegram.me",
  "linktr.ee",
  "google.com",
  "google.ro",
  "goo.gl",
  "g.page",
  "wikipedia.org",
  "listafirme.ro",
  "termene.ro",
  "risco.ro",
  "firme.info",
  "totalfirme.ro",
  "romanian-companies.eu",
  "infocui.ro",
  "confidas.ro",
  "kompass.com",
  "olx.ro",
  "emag.ro",
  "booking.com",
  "tripadvisor.com",
  "tripadvisor.ro",
  "paginiaurii.ro",
  "cylex.ro",
  "firmepenet.ro",
  "lista-firme.info",
  "eurolista.ro",
  "glassdoor.com",
  "ejobs.ro",
  "bestjobs.eu",
  "topfirme.com",
  "yelp.com",
  "foursquare.com",
  "anaf.ro",
  "onrc.ro",
  "mfinante.gov.ro",
];

export function isSocialOrDirectoryHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  return SOCIAL_OR_DIRECTORY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export type PageKind =
  | "home"
  | "contact"
  | "about"
  | "services"
  | "pricing"
  | "team"
  | "careers"
  | "blog"
  | "legal"
  | "locations"
  | "products"
  | "booking"
  | "faq"
  | "other";

const KIND_PATTERNS: Array<[PageKind, RegExp]> = [
  ["contact", /contact|kontakt|unde-ne-gasiti|locatie-contact/],
  [
    "careers",
    /cariere|careers|jobs?(\/|$|-)|locuri-de-munca|angajam|recrutare|posturi|join-us|alatura-te/,
  ],
  ["team", /echipa|team|medici|doctori|specialisti|our-people|staff/],
  ["pricing", /pret|tarif|pricing|prices|abonament|plans|packages|pachete|costuri/],
  ["booking", /programar|programeaz|rezerv|booking|book-|appointment/],
  ["locations", /locati|librarii|showroom|puncte-de-lucru|filiale|sucursale|unde-ne-gasesti/],
  ["about", /despre|about|cine-suntem|povestea|our-story|istoric|misiune/],
  [
    "services",
    /servic|tratament|treatment|solutii|solution|ce-facem|what-we-do|oferta|offer|proiecte|projects|portofoliu|portfolio|activitat/,
  ],
  ["faq", /faq|intrebari|questions/],
  [
    "legal",
    /termeni|terms|conditii|legal|impressum|date-firma|confidentialitate|privacy|gdpr|cookie|anpc/,
  ],
  ["blog", /blog|noutati|stiri|articole|news|insights|evenimente|events/],
  ["products", /produs|product|shop|magazin|catalog|categor|colecti|collection|meniu|menu/],
];

/** What a page is about, from its path first and its link text second. */
export function classifyPageUrl(url: string, linkText = ""): PageKind {
  let path: string;
  try {
    path = fold(decodeURIComponent(new URL(url).pathname));
  } catch {
    return "other";
  }
  if (path === "/" || path === "") return "home";
  for (const [kind, re] of KIND_PATTERNS) if (re.test(path)) return kind;
  const text = fold(linkText);
  for (const [kind, re] of KIND_PATTERNS) if (re.test(text)) return kind;
  return "other";
}

/** Paths never worth reading (assets, logins, carts, feeds, search). */
export const SKIP_PATH =
  /\.(pdf|jpe?g|png|gif|webp|svg|zip|rar|docx?|xlsx?|pptx?|mp4|mp3|xml|json|css|js|ico|woff2?)(\?|$)|\/(wp-admin|wp-login|wp-json|login|logout|signin|signup|register|auth|cart|cos|checkout|my-account|contul-meu|account|feed|tag|author|search|cauta|cdn-cgi)(\/|$)|add-to-cart|[?&](s|q|sort|orderby|filter|page|replytocom)=/i;

/* ---------------------------------------------------------- domain guesses */

const LEGAL_TOKENS = new Set([
  "srl",
  "srld",
  "sa",
  "sc",
  "snc",
  "scs",
  "sca",
  "pfa",
  "ii",
  "if",
  "ra",
  "societate",
  "societatea",
  "comerciala",
  "cooperativa",
  "ltd",
  "llc",
  "gmbh",
]);
const GENERIC_TOKENS = new Set([
  "com",
  "impex",
  "prod",
  "productie",
  "prestari",
  "comert",
  "trading",
  "trade",
  "group",
  "grup",
  "international",
  "romania",
  "consulting",
  "serv",
  "servicii",
  "invest",
  "holding",
  "company",
  "co",
  "si",
  "and",
  "the",
]);

/** Distinctive lower-case ASCII tokens of a company name, legal form removed. */
export function companyNameTokens(name: string): { all: string[]; core: string[] } {
  const raw = fold(name)
    .replace(/&/g, " si ")
    .replace(/\./g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const merged: string[] = [];
  let letters = "";
  for (const token of raw) {
    if (token.length === 1) {
      letters += token;
      continue;
    }
    if (letters) merged.push(letters);
    letters = "";
    merged.push(token);
  }
  if (letters) merged.push(letters);
  const all = merged.filter((token) => !LEGAL_TOKENS.has(token));
  const core = all.filter((token) => !GENERIC_TOKENS.has(token));
  return { all, core: core.length ? core : all };
}

/**
 * The brand inside quotes in an official name: 'X ,,CONFISCAL'' SRL' →
 * "CONFISCAL". ANAF sometimes drops the closing quote and glues the legal form
 * ("…,,CONFISCALSRL"): an unclosed brand at the end loses a glued SRL/SA.
 */
export function quotedBrand(name: string): string | undefined {
  const closed = /(?:,,|„|"|“|«|'')\s*([^"”“»,']{3,60}?)\s*(?:''|"|”|»|')/.exec(name);
  if (closed?.[1]?.trim()) return closed[1].trim();
  const open = /(?:,,|„|“|«)\s*([^"”“»,']{3,60})\s*$/.exec(name);
  if (!open) return undefined;
  const brand = open[1]
    .trim()
    .replace(/\s*(S\.?R\.?L\.?(-?D)?|S\.?A\.?)$/i, "")
    .trim();
  return brand.length >= 3 ? brand : undefined;
}

/**
 * Up to 12 domains to try: the full and core names joined or hyphenated, the
 * quoted brand, the first distinctive word; .ro and .dev first (the trial
 * missed vortexhub.dev behind a 4-guess cap), then .com, .eu, .net.
 */
export function domainGuesses(name: string): string[] {
  const { all, core } = companyNameTokens(name);
  const labels: string[] = [];
  const add = (label: string) => {
    if (label.length >= 3 && label.length <= 40 && !labels.includes(label)) labels.push(label);
  };
  const brand = quotedBrand(name);
  if (brand) add(companyNameTokens(brand).all.join(""));
  add(core.join(""));
  add(all.join(""));
  if (core.length > 1) add(core.join("-"));
  if (core.length > 2) add(core.slice(0, 2).join(""));
  if (core.length >= 2 && core[0].length >= 4) add(core[0]);
  const out: string[] = [];
  const top = labels.slice(0, 4);
  for (const tld of ["ro", "dev", "com"]) for (const label of top) out.push(`${label}.${tld}`);
  if (top[0]) for (const tld of ["eu", "net"]) out.push(`${top[0]}.${tld}`);
  return [...new Set(out)].slice(0, 12);
}

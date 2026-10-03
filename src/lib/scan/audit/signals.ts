import type { SiteSignals } from "@/lib/scan/types";

import type { AuditContext, PageFacts, TechMatch } from "./model";
import { classifySocialUrl, isGoogleBusinessUrl, normalizeSocialUrl } from "./social";

/** Business signals read from the analysed pages and the detected stack. */

const CUI_KEY = [7, 5, 3, 2, 1, 7, 5, 3, 2];

/** Romanian fiscal code (CUI/CIF) checksum. */
export function isValidCui(value: string): boolean {
  if (!/^\d{2,10}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const control = digits.pop()!;
  const padded = [...new Array<number>(9 - digits.length).fill(0), ...digits];
  const sum = padded.reduce((total, digit, i) => total + digit * CUI_KEY[i], 0);
  const check = ((sum * 10) % 11) % 10;
  return check === control;
}

const CUI_LABELLED =
  /\b(?:C\.?\s?U\.?\s?I\.?|C\.?\s?I\.?\s?F\.?|C\.?\s?F\.?|cod\s+(?:unic\s+de\s+[îi]nregistrare|fiscal|de\s+identificare\s+fiscal[ăa])|VAT(?:\s+(?:no|number|ID))?|Tax\s+ID)\s*(?:nr\.?|no\.?)?\s*[:.\-–]?\s*(?:RO)?\s?(\d{2,10})\b/gi;
const CUI_VAT = /\bRO\s?(\d{6,10})\b/g;

/** Finds a valid CUI printed on the page, preferring the one we expect. */
export function findCuiInText(text: string, expected?: string): string | undefined {
  const candidates: string[] = [];
  for (const match of text.matchAll(CUI_LABELLED)) candidates.push(match[1]);
  for (const match of text.matchAll(CUI_VAT)) candidates.push(match[1]);
  const valid = candidates.filter(isValidCui);
  if (expected && valid.includes(expected)) return expected;
  return valid[0];
}

const PHONE_RO = /(?<![\d/])(?:\+40|0040|\(?0)\s?\)?\s?[237](?:[\s.\-()]*\d){8}(?![\d/])/;
const PHONE_INTL = /(?<![\w/])\+\d{1,3}[\s.\-()]*\d(?:[\s.\-()]*\d){6,11}(?![\d/])/;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}\b/i;
const EMAIL_NOISE = /\.(png|jpe?g|webp|gif|svg|avif)$|@(example|sentry|wixpress|domain|email)\./i;
const WHATSAPP_LINK =
  /^(https?:\/\/)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|web\.whatsapp\.com)|^whatsapp:/i;
/** Click-to-chat buttons wired up in JavaScript (href="#", class or id names it). */
const WHATSAPP_ELEMENT = /<(a|button)\b[^>]*\b(class|id)=["'][^"']*whatsapp/i;
const CART_PATH =
  /\/(cart|cos|cos-de-cumparaturi|cosul-meu|checkout|finalizare-comanda|comanda|basket|shopping-cart)(\/|$|\?)/i;
/** Visible "add to cart" wording (theme CSS often contains cart class names on non-shops). */
const ADD_TO_CART = /\badd to (cart|basket)\b|adaug[aă] [îi]n co[sș]/i;
const PRICE =
  /(?<!capital( social)?:?\s{0,3})(?:\b\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?\s?(?:lei|ron|€|eur|euro)\b|(?:€|£|\$)\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\bde la\s+\d+)/gi;
const REVIEWS_TEXT =
  /testimonial|recenzi|review|p[ăa]reri|ce spun (clien|pacien|oamenii)|clien[țt]i (mul[țt]umi[țt]i|fericiți)|feedback/i;
const REVIEWS_WIDGET =
  /trustindex|elfsight|trustpilot|reviews\.io|judge\.me|yotpo|feefo|stamped\.io|google-reviews|widget-google-reviews/i;
const TRUST =
  /plat[ăa] securizat|secure (payment|checkout)|retur gratuit|livrare gratuit|garan[țt]ie|free (returns|shipping)|money[- ]back|anpc|visa|mastercard|netopia|euplatesc/i;
const ADDRESS =
  /\b(str\.|strada|bd\.|b-dul|bulevardul|calea|[șs]os\.|[șs]oseaua|aleea|pia[țt]a|splaiul)\s+[A-ZĂÂÎȘȚ0-9]/i;
const BOOKING_INTENT =
  /programeaz[ăa]|programare|programări|rezerv[ăa]|rezervare|book (now|online|an appointment|a table)|appointment|reservation|booking/i;
const BLOG_LINK =
  /\/(blog|noutati|stiri|articole|news|jurnal|insights|resurse|resources|magazine|revista|sfaturi|ghiduri?)(\/|$)/i;
const BLOG_TEXT =
  /^(blog|noutăți|noutati|știri|stiri|articole|news|insights|jurnal|resurse|resources|sfaturi)$/i;
const NEWSLETTER_TEXT = /newsletter|abonea?z[ăa]-te|subscribe to our|aboneaz[ăa]-te/i;
const PRIVACY =
  /privacy|confiden[țt]ialitate|gdpr|protec[țt]ia datelor|date(lor)? personale|prelucrarea datelor/i;
const TERMS = /termeni|terms|condi[țt]ii|t&c|tos\b/i;
const COOKIE_POLICY = /cookie/i;

const LANGUAGE_NAMES: Record<string, string> = {
  english: "en",
  engleză: "en",
  română: "ro",
  romana: "ro",
  romanian: "ro",
  deutsch: "de",
  german: "de",
  français: "fr",
  francais: "fr",
  french: "fr",
  magyar: "hu",
  hungarian: "hu",
  italiano: "it",
  español: "es",
  espanol: "es",
};

function primaryLang(value?: string) {
  const code = value?.toLowerCase().split(/[-_]/)[0];
  return code && /^[a-z]{2,3}$/.test(code) ? code : undefined;
}

function detectLanguages(pages: PageFacts[]): string[] {
  const langs = new Set<string>();
  for (const page of pages) {
    const own = primaryLang(page.lang);
    if (own) langs.add(own);
    for (const hreflang of page.hreflangs) {
      const code = primaryLang(hreflang);
      if (code && hreflang !== "x-default") langs.add(code);
    }
    for (const link of page.links) {
      if (!link.internal || !link.url) continue;
      const label = link.text.trim().toLowerCase();
      const fromName = LANGUAGE_NAMES[label];
      const segment = /^\/(en|ro|de|fr|hu|it|es)(\/|$)/.exec(new URL(link.url).pathname)?.[1];
      if (fromName && (segment || /[?&]lang=/.test(link.url))) langs.add(fromName);
      else if (segment && /^(en|ro|de|fr|hu|it|es)$/i.test(label)) langs.add(segment);
    }
  }
  return [...langs];
}

export type ExtraSignals = AuditContext["extra"];

/** Profiles first, at most two links per platform. */
function limitPerPlatform(entries: Array<{ url: string; profile: boolean }>): string[] {
  const perPlatform = new Map<string, number>();
  return entries
    .sort((a, b) => Number(b.profile) - Number(a.profile))
    .filter((entry) => {
      const platform = classifySocialUrl(entry.url)?.platform ?? "other";
      const count = perPlatform.get(platform) ?? 0;
      perPlatform.set(platform, count + 1);
      return count < 2;
    })
    .map((entry) => entry.url);
}

export function buildSignals(
  pages: PageFacts[],
  technologies: TechMatch[],
  expectedCui?: string,
): { signals: SiteSignals; extra: ExtraSignals } {
  const has = (category: TechMatch["category"]) =>
    technologies.some((t) => t.category === category);
  const hasTech = (name: string) => technologies.some((t) => t.name === name);
  const allLinks = pages.flatMap((page) => page.links);
  const allText = pages.map((page) => page.text).join(" \n ");
  const allHtml = pages.map((page) => page.html).join("\n");

  const telLinks = allLinks.some((link) => /^tel:/i.test(link.href));
  const phoneInText = PHONE_RO.test(allText) || PHONE_INTL.test(allText);
  const mailLinks = allLinks.some((link) => /^mailto:/i.test(link.href));
  const emailInText = (allText.match(new RegExp(EMAIL.source, "gi")) ?? []).some(
    (email) => !EMAIL_NOISE.test(email),
  );

  const socialLinks = new Map<string, { url: string; profile: boolean }>();
  const linkCandidates = [
    ...allLinks.map((link) => link.url ?? ""),
    ...pages.flatMap((page) => page.jsonLdSameAs),
  ];
  for (const raw of linkCandidates) {
    const match = classifySocialUrl(raw);
    if (!match) continue;
    const url = normalizeSocialUrl(raw);
    if (!socialLinks.has(url)) socialLinks.set(url, { url, profile: match.profile });
  }

  const forms = pages.flatMap((page) => page.forms);
  const embeddedForms = pages.flatMap((page) => page.embeddedForms);
  const structuredTypes = new Set(pages.flatMap((page) => page.jsonLdTypes));
  const hasCart =
    allLinks.some(
      (link) =>
        link.url &&
        (CART_PATH.test(new URL(link.url).pathname) || /[?&]add-to-cart=/.test(link.url)),
    ) || ADD_TO_CART.test(allText);
  const prices = (allText.match(PRICE) ?? []).length;
  const productSchema = structuredTypes.has("Product") && structuredTypes.has("Offer");
  // WooCommerce is a plugin that can sit unused on a brochure site; ask for shop evidence.
  const shopPlatform = technologies.some(
    (t) => t.category === "ecommerce" && t.name !== "WooCommerce",
  );
  const hasEcommerce =
    shopPlatform ||
    productSchema ||
    (hasTech("WooCommerce") && (hasCart || prices >= 2)) ||
    (hasCart && prices >= 2);

  const blogLinks = allLinks.some(
    (link) =>
      link.internal &&
      ((link.url && BLOG_LINK.test(new URL(link.url).pathname)) ||
        BLOG_TEXT.test(link.text.trim())),
  );
  const hasBlog = blogLinks || structuredTypes.has("BlogPosting") || structuredTypes.has("Blog");

  const cuiOnSite =
    findCuiInText(pages.map((page) => page.footerText).join(" \n "), expectedCui) ??
    findCuiInText(allText, expectedCui);

  const linkMatches = (pattern: RegExp) =>
    allLinks.some((link) => pattern.test(link.text) || pattern.test(link.href));
  const dates = pages.flatMap((page) => page.contentDates).sort();

  const signals: SiteSignals = {
    hasContactForm: forms.some((form) => form.kind === "contact") || embeddedForms.length > 0,
    hasPhone: telLinks || phoneInText,
    hasEmail: mailLinks || emailInText,
    hasWhatsApp:
      allLinks.some((link) => WHATSAPP_LINK.test(link.href) || /whatsapp/i.test(link.text)) ||
      WHATSAPP_ELEMENT.test(allHtml) ||
      hasTech("WhatsApp chat widget"),
    hasLiveChat: technologies.some(
      (t) => t.category === "chat" && t.name !== "WhatsApp chat widget",
    ),
    hasOnlineBooking: has("booking"),
    hasEcommerce,
    hasCookieConsent: has("consent"),
    hasAnalytics: has("analytics"),
    hasMarketingPixel:
      has("marketing") &&
      technologies.some((t) => /Pixel|Ads|Insight|Tag|Advertising/.test(t.name)),
    hasStructuredData: structuredTypes.size > 0,
    hasNewsletter:
      forms.some((form) => form.kind === "newsletter") ||
      ["Mailchimp", "Brevo", "MailerLite", "Klaviyo", "Newsman"].some(hasTech) ||
      NEWSLETTER_TEXT.test(allText),
    hasBlog,
    languages: detectLanguages(pages),
    socialLinks: limitPerPlatform([...socialLinks.values()]),
    cuiOnSite,
  };

  const extra: ExtraSignals = {
    phoneInTextOnly: phoneInText && !telLinks,
    hasReviews:
      REVIEWS_TEXT.test(allText) ||
      REVIEWS_WIDGET.test(allHtml) ||
      structuredTypes.has("AggregateRating") ||
      structuredTypes.has("Review"),
    hasPrices: prices >= 2,
    hasTrustBadges:
      TRUST.test(allText) ||
      pages.some((page) =>
        page.images.some((image) =>
          /visa|mastercard|netopia|anpc|secure/i.test(`${image.alt ?? ""} ${image.src}`),
        ),
      ),
    hasAddress: ADDRESS.test(allText) || structuredTypes.has("PostalAddress"),
    hasMap:
      pages.some((page) => page.hasMapEmbed) ||
      allLinks.some((link) => {
        try {
          return Boolean(link.url && isGoogleBusinessUrl(new URL(link.url)));
        } catch {
          return false;
        }
      }) ||
      allLinks.some((link) => /waze\.com\/ul|maps\.apple\.com/i.test(link.href)),
    hasPrivacyPolicy: linkMatches(PRIVACY),
    hasTerms: linkMatches(TERMS),
    hasCookiePolicy: linkMatches(COOKIE_POLICY),
    hasAnpcLink: allLinks.some((link) => /anpc\.ro/i.test(link.href)),
    hasOdrLink: allLinks.some((link) => /ec\.europa\.eu\/consumers\/odr/i.test(link.href)),
    hasConsentMode: /gtag\(\s*['"]consent['"]\s*,\s*['"]default['"]/.test(allHtml),
    bookingIntent: BOOKING_INTENT.test(allText),
    latestContentDate: dates[dates.length - 1],
  };

  return { signals, extra };
}

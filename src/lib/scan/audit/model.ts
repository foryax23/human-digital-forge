import type { DetectedTechnology, SiteSignals } from "@/lib/scan/types";

/** Internal shapes of the website audit (not part of the shared contract). */

export type ImageFact = {
  src: string;
  /** null when the attribute is absent; "" is a valid decorative alt. */
  alt: string | null;
  hasDimensions: boolean;
  lazy: boolean;
  /** Linked from an <a> that has no other text (the alt is the link's name). */
  inEmptyLink: boolean;
};

export type ScriptFact = {
  src?: string;
  host?: string;
  inHead: boolean;
  async: boolean;
  defer: boolean;
  module: boolean;
  /** type attribute (text/plain marks consent-gated scripts). */
  type?: string;
  inlineBytes: number;
};

export type LinkFact = {
  href: string;
  /** Absolute URL for http(s) links. */
  url?: string;
  text: string;
  internal: boolean;
  /** Looks like a button (class btn/button/cta or role=button). */
  buttonLike: boolean;
};

export type FormFact = {
  kind: "contact" | "newsletter" | "search" | "login" | "other";
  action?: string;
  fields: number;
  unlabeled: number;
};

export type PageFacts = {
  url: string;
  status: number;
  htmlBytes: number;
  title?: string;
  description?: string;
  lang?: string;
  canonical?: string;
  robotsMeta?: string;
  viewport?: string;
  favicon?: string;
  generators: string[];
  og: { title?: string; description?: string; image?: string; siteName?: string };
  twitterCard?: string;
  h1: string[];
  headingLevels: number[];
  /** Visible body text, whitespace-collapsed. */
  text: string;
  wordCount: number;
  footerText: string;
  images: ImageFact[];
  scripts: ScriptFact[];
  stylesheets: string[];
  links: LinkFact[];
  forms: FormFact[];
  /** Third-party form embeds (Google Forms, Typeform, Jotform…). */
  embeddedForms: string[];
  iframes: Array<{ src?: string; title?: string }>;
  jsonLdTypes: string[];
  jsonLdSameAs: string[];
  /** ISO dates found in JSON-LD, <time> and article meta. */
  contentDates: string[];
  hreflangs: string[];
  feeds: string[];
  mixedContent: string[];
  insecureFormActions: string[];
  emptyLinks: number;
  emptyButtons: number;
  positiveTabindex: number;
  autoplayMedia: number;
  landmarks: { main: boolean; nav: boolean; header: boolean; footer: boolean };
  copyrightYear?: number;
  ctaNearTop?: string;
  hasMapEmbed: boolean;
  /** A language switcher control exists (its other languages may only load with JS). */
  languageSwitcher: boolean;
  /** Content is rendered by JavaScript (little or no text in the HTML). */
  clientRendered: boolean;
  /** Raw HTML (bounded by the 2 MB fetch cap) for fingerprinting. */
  html: string;
};

export type TechMatch = DetectedTechnology & {
  version?: string;
  /** What matched, e.g. "script: cdn.shopify.com". */
  evidence: string;
};

export type SitemapInfo = {
  found: boolean;
  url?: string;
  urlCount?: number;
  /** Child sitemaps when the file is an index. */
  childSitemaps?: number;
  /** urlCount covers only some child sitemaps. */
  partial?: boolean;
};

export type ImageProbe = { url: string; bytes?: number; contentType?: string };
export type AssetProbe = {
  url: string;
  status: number;
  cacheControl?: string;
  expires?: string;
  kind: "css" | "js";
};

/** Everything the checks look at, gathered once per audit. */
export type AuditContext = {
  requestedUrl: string;
  finalUrl: URL;
  https: boolean;
  statusCode: number;
  ttfbMs: number;
  redirects: string[];
  headers: Headers;
  setCookies: string[];
  htmlEncoded: boolean;
  /** Homepage HTML could be read (not an error page or a bot wall). */
  contentAvailable: boolean;
  home: PageFacts;
  /** All analysed pages, homepage first. */
  pages: PageFacts[];
  brokenPages: Array<{ url: string; status: number }>;
  robots: {
    found: boolean;
    status?: number;
    sitemaps: string[];
    blocksEveryone: boolean;
    blocksGoogle: boolean;
  };
  sitemap: SitemapInfo;
  /** undefined when not tested (site is http-only or the test failed). */
  httpRedirectsToHttps?: boolean;
  images: ImageProbe[];
  assets: AssetProbe[];
  /** /favicon.ico answered when no icon is declared in the HTML. */
  faviconFound: boolean;
  /** Entry JavaScript of a client-rendered app (uncompressed bytes read, capped at 1.2 MB). */
  appBundle?: { url: string; bytes: number; truncated: boolean };
  technologies: TechMatch[];
  signals: SiteSignals;
  /** Signals the shared contract doesn't carry but checks need. */
  extra: {
    phoneInTextOnly: boolean;
    hasReviews: boolean;
    hasPrices: boolean;
    hasTrustBadges: boolean;
    hasAddress: boolean;
    hasMap: boolean;
    hasPrivacyPolicy: boolean;
    hasTerms: boolean;
    hasCookiePolicy: boolean;
    hasAnpcLink: boolean;
    hasOdrLink: boolean;
    hasConsentMode: boolean;
    bookingIntent: boolean;
    latestContentDate?: string;
  };
  cui?: string;
  name?: string;
  now: Date;
};

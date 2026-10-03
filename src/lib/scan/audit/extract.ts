import { NodeType, parse, type HTMLElement, type Node } from "node-html-parser";

import type { FormFact, ImageFact, LinkFact, PageFacts, ScriptFact } from "./model";

/** Turns one fetched HTML page into the facts the checks and fingerprints read. */

const PARSE_OPTIONS = {
  comment: false,
  blockTextElements: { script: true, noscript: true, style: true, pre: true },
};

/** Action phrases that are a call to action wherever they appear. */
const STRONG_CTA =
  /(programeaz|programare|rezerv|sun[aă]|cere(ți)? (o )?ofert|solicit|contacteaz|scrie-ne|comand|cump[aă]r|adaug[aă] [îi]n co|[îi]ncepe|[îi]ncearc|\b(book|call|get (a |an |your |started|in touch|quote)|contact us|request|shop now|buy|order|start|try|schedule|reserve|sign up|subscribe|join|whatsapp)\b)/i;
/** Softer phrases that count when styled as a button or outside the menu. */
const WEAK_CTA =
  /(contact|vezi|afl[aă]|descoper|ofert|\b(shop|learn|explore|discover|see|view|more)\b)/i;
const CTA_HREF =
  /^(tel:|mailto:|https?:\/\/(wa\.me|api\.whatsapp\.com|calendly\.com|booksy\.com|www\.fresha\.com|cal\.com))/i;
const BUTTON_CLASS = /\b(btn|button|cta)\b|elementor-button|wp-block-button|wp-element-button/i;
/** Utility-class buttons (Tailwind and similar): padded, rounded or filled links. */
const UTILITY_BUTTON = /\bpx-\d.*\bpy-\d|\bpy-\d.*\bpx-\d/;
const NEWSLETTER_HINT =
  /newsletter|subscribe|abon|mc4wp|mailchimp|sib-form|newsman|klaviyo|mailerlite|mailpoet/i;
const CONTACT_HINT =
  /wpcf7|wpforms|gform|elementor-form|fluentform|ninja-forms|forminator|contact/i;
const LANGUAGE_HINT =
  /\blang(uage)?[-_ ]?(switch|toggle|select|picker|menu)|\blimb[aă]|wpml-ls|pll-|trp-language|gtranslate|weglot/i;
const LANGUAGE_LABEL = /^(en|ro|de|fr|hu|it|es|english|română|romana|deutsch|français|magyar)$/i;
const FORM_EMBED =
  /docs\.google\.com\/forms|forms\.gle|typeform\.com|jotform|tally\.so|hsforms|formstack|cognitoforms|123formbuilder|paperform|fillout\.com/i;

const attr = (el: HTMLElement, name: string) => el.getAttribute(name)?.trim() || undefined;
const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

function resolveUrl(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Lower-case ASCII folding for matching Romanian text ("Programări" → "programari"). */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function siteHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function collectText(node: Node, out: string[]) {
  for (const child of node.childNodes) {
    if (child.nodeType === NodeType.TEXT_NODE) out.push(child.text);
    else if (child.nodeType === NodeType.ELEMENT_NODE) collectText(child, out);
  }
}

function textOf(node: Node | null | undefined): string {
  if (!node) return "";
  const out: string[] = [];
  collectText(node, out);
  return collapse(out.join(" "));
}

/** Accessible name approximation: text, aria-label, title or an image alt. */
function accessibleName(el: HTMLElement): string {
  const own = textOf(el) || attr(el, "aria-label") || attr(el, "title") || "";
  if (own) return own;
  if (attr(el, "aria-labelledby")) return "labelledby";
  const img = el.querySelector("img[alt]");
  const alt = img ? attr(img, "alt") : undefined;
  if (alt) return alt;
  const svgTitle = el.querySelector("svg title");
  return svgTitle ? textOf(svgTitle) : "";
}

function walkJsonLd(
  value: unknown,
  sink: { types: Set<string>; sameAs: Set<string>; dates: Set<string> },
) {
  if (Array.isArray(value)) {
    for (const item of value) walkJsonLd(item, sink);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  for (const t of Array.isArray(type) ? type : [type]) {
    if (typeof t === "string") sink.types.add(t.replace(/^https?:\/\/schema\.org\//, ""));
  }
  const sameAs = record.sameAs;
  for (const s of Array.isArray(sameAs) ? sameAs : [sameAs]) {
    if (typeof s === "string") sink.sameAs.add(s);
  }
  for (const key of ["datePublished", "dateModified", "uploadDate"]) {
    if (typeof record[key] === "string") sink.dates.add(record[key] as string);
  }
  for (const [key, child] of Object.entries(record)) {
    if (key !== "@type" && key !== "sameAs" && child && typeof child === "object") {
      walkJsonLd(child, sink);
    }
  }
}

function classifyForm(form: HTMLElement, fields: HTMLElement[]): FormFact["kind"] {
  const hints = `${attr(form, "class") ?? ""} ${attr(form, "id") ?? ""} ${attr(form, "action") ?? ""} ${attr(form, "name") ?? ""}`;
  const types = fields.map((field) =>
    field.tagName === "INPUT" ? (attr(field, "type") ?? "text").toLowerCase() : field.tagName,
  );
  if (types.includes("password")) return "login";
  if (
    attr(form, "role") === "search" ||
    types.includes("search") ||
    (fields.length <= 2 &&
      fields.some((field) => /^(s|q|search|query|keyword)$/i.test(attr(field, "name") ?? "")))
  ) {
    return "search";
  }
  const hasTextarea = types.includes("TEXTAREA");
  const hasEmail = types.includes("email");
  if (NEWSLETTER_HINT.test(hints) && !hasTextarea) return "newsletter";
  if (hasTextarea || CONTACT_HINT.test(hints)) return "contact";
  if (hasEmail && fields.length <= 2) return "newsletter";
  if ((hasEmail || types.includes("tel")) && fields.length >= 3) return "contact";
  return "other";
}

function copyrightYear(text: string): number | undefined {
  const pattern =
    /(?:©|\(c\)|copyright)[^0-9]{0,60}((?:19|20)\d{2})(?:\s*[-–—/]\s*((?:19|20)\d{2}))?/gi;
  let best: number | undefined;
  for (const match of text.matchAll(pattern)) {
    const year = Number(match[2] ?? match[1]);
    if (!best || year > best) best = year;
  }
  return best;
}

export function extractPage(html: string, pageUrl: string, status: number): PageFacts {
  const root = parse(html, PARSE_OPTIONS);
  const page = new URL(pageUrl);
  const host = siteHost(page.hostname);
  const base =
    resolveUrl(root.querySelector("base[href]")?.getAttribute("href"), pageUrl) ?? pageUrl;
  const isHttps = page.protocol === "https:";

  /* --------------------------------------------------------------- head */
  const metas = root.querySelectorAll("meta");
  const metaBy = (key: "name" | "property", value: string) =>
    metas
      .find((meta) => attr(meta, key)?.toLowerCase() === value)
      ?.getAttribute("content")
      ?.trim();
  const titleEl = root.querySelectorAll("title").find((el) => !el.closest("svg"));
  const linkRel = (rel: RegExp) =>
    root.querySelectorAll("link[rel]").filter((link) => rel.test(attr(link, "rel") ?? ""));

  const generators = metas
    .filter((meta) => attr(meta, "name")?.toLowerCase() === "generator")
    .map((meta) => attr(meta, "content") ?? "")
    .filter(Boolean);
  const iconLink = linkRel(/\bicon\b/i)[0];
  const favicon = iconLink ? resolveUrl(attr(iconLink, "href"), base) : undefined;
  const canonicalLink = linkRel(/\bcanonical\b/i)[0];
  const hreflangs = linkRel(/\balternate\b/i)
    .map((link) => attr(link, "hreflang")?.toLowerCase())
    .filter((value): value is string => Boolean(value));
  const feeds = linkRel(/\balternate\b/i)
    .filter((link) => /rss|atom/i.test(attr(link, "type") ?? ""))
    .map((link) => resolveUrl(attr(link, "href"), base))
    .filter((value): value is string => Boolean(value));

  /* ------------------------------------------------------------ scripts */
  const scripts: ScriptFact[] = root.querySelectorAll("script").map((el) => {
    const src = resolveUrl(attr(el, "src"), base);
    let scriptHost: string | undefined;
    if (src) scriptHost = new URL(src).hostname.toLowerCase();
    return {
      src,
      host: scriptHost,
      inHead: Boolean(el.closest("head")),
      async: el.hasAttribute("async"),
      defer: el.hasAttribute("defer"),
      module: attr(el, "type") === "module",
      type: attr(el, "type")?.toLowerCase(),
      inlineBytes: src ? 0 : el.rawText.length,
    };
  });
  const stylesheets = linkRel(/\bstylesheet\b/i)
    .map((link) => resolveUrl(attr(link, "href"), base))
    .filter((value): value is string => Boolean(value));

  /* ------------------------------------------------------- structured data */
  const sink = { types: new Set<string>(), sameAs: new Set<string>(), dates: new Set<string>() };
  for (const el of root.querySelectorAll('script[type="application/ld+json"]')) {
    const raw = el.rawText.trim();
    try {
      walkJsonLd(JSON.parse(raw), sink);
    } catch {
      for (const match of raw.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) sink.types.add(match[1]);
    }
  }
  for (const el of root.querySelectorAll("[itemtype]")) {
    const type = attr(el, "itemtype")?.split("/").pop();
    if (type) sink.types.add(type);
  }
  for (const el of root.querySelectorAll("time[datetime]")) {
    const value = attr(el, "datetime");
    if (value) sink.dates.add(value);
  }
  for (const key of ["article:published_time", "article:modified_time", "og:updated_time"]) {
    const value = metaBy("property", key);
    if (value) sink.dates.add(value);
  }
  const tomorrow = Date.now() + 86_400_000;
  const contentDates = [...sink.dates]
    .map((value) => Date.parse(value))
    .filter((time) => Number.isFinite(time) && time > Date.UTC(1995, 0, 1) && time < tomorrow)
    .map((time) => new Date(time).toISOString());

  /* --------------------------------------------------------------- body */
  const body = root.querySelector("body") ?? root;
  const firstH1 = root.querySelector("h1");
  const bodyStart = body.range?.[0] ?? 0;
  const ctaCutoff = firstH1
    ? Math.max((firstH1.range?.[1] ?? 0) + 6000, bodyStart + 15_000)
    : bodyStart + 20_000;

  const labelFor = new Set(
    root
      .querySelectorAll("label[for]")
      .map((label) => attr(label, "for"))
      .filter(Boolean) as string[],
  );

  const images: ImageFact[] = root
    .querySelectorAll("img")
    .filter((img) => !(attr(img, "width") === "1" && attr(img, "height") === "1"))
    .map((img) => {
      const rawSrc =
        attr(img, "src") ??
        attr(img, "data-src") ??
        attr(img, "data-lazy-src") ??
        attr(img, "srcset")?.split(/\s+/)[0] ??
        "";
      const anchor = img.closest("a");
      return {
        src: rawSrc.startsWith("data:")
          ? rawSrc.slice(0, 40)
          : (resolveUrl(rawSrc, base) ?? rawSrc),
        alt: img.hasAttribute("alt") ? (img.getAttribute("alt") ?? "") : null,
        hasDimensions: img.hasAttribute("width") && img.hasAttribute("height"),
        lazy:
          attr(img, "loading") === "lazy" ||
          img.hasAttribute("data-src") ||
          img.hasAttribute("data-lazy-src") ||
          /lazy/i.test(attr(img, "class") ?? ""),
        inEmptyLink: Boolean(anchor && !textOf(anchor)),
      };
    })
    .filter((image) => !/facebook\.com\/tr|google-analytics|bat\.bing|pixel/i.test(image.src));

  let ctaNearTop: string | undefined;
  const links: LinkFact[] = [];
  let emptyLinks = 0;
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = attr(anchor, "href") ?? "";
    const url = resolveUrl(href, base);
    const text = accessibleName(anchor);
    const className = attr(anchor, "class") ?? "";
    const buttonLike =
      BUTTON_CLASS.test(className) ||
      UTILITY_BUTTON.test(className) ||
      attr(anchor, "role") === "button";
    if (!text && attr(anchor, "aria-hidden") !== "true") emptyLinks++;
    let internal = false;
    if (url) internal = siteHost(new URL(url).hostname) === host;
    links.push({ href, url, text: text.slice(0, 120), internal, buttonLike });
    if (!ctaNearTop && (anchor.range?.[0] ?? Infinity) < ctaCutoff) {
      const short = text && text.length <= 60;
      if (CTA_HREF.test(href)) ctaNearTop = `${href.split(":")[0]} link`;
      else if (short && STRONG_CTA.test(text)) ctaNearTop = `"${text}"`;
      else if (short && WEAK_CTA.test(text) && (buttonLike || !anchor.closest("nav"))) {
        ctaNearTop = `"${text}"`;
      } else if (buttonLike && short) ctaNearTop = `"${text}" button`;
    }
  }
  let emptyButtons = 0;
  for (const button of root.querySelectorAll("button")) {
    const text = accessibleName(button);
    if (!text && attr(button, "aria-hidden") !== "true") emptyButtons++;
    const nearTop = (button.range?.[0] ?? Infinity) < ctaCutoff;
    if (!ctaNearTop && text && nearTop && (STRONG_CTA.test(text) || WEAK_CTA.test(text))) {
      ctaNearTop = `"${text.slice(0, 40)}" button`;
    }
  }

  const forms: FormFact[] = [];
  const insecureFormActions: string[] = [];
  for (const form of root.querySelectorAll("form")) {
    const fields = form
      .querySelectorAll("input, select, textarea")
      .filter(
        (field) =>
          !/^(hidden|submit|button|image|reset)$/i.test(attr(field, "type") ?? "") &&
          attr(field, "aria-hidden") !== "true",
      );
    const unlabeled = fields.filter((field) => {
      const id = attr(field, "id");
      return !(
        (id && labelFor.has(id)) ||
        field.closest("label") ||
        attr(field, "aria-label") ||
        attr(field, "aria-labelledby") ||
        attr(field, "title") ||
        attr(field, "placeholder")
      );
    }).length;
    const action = attr(form, "action");
    if (isHttps && action?.startsWith("http://")) insecureFormActions.push(action);
    forms.push({ kind: classifyForm(form, fields), action, fields: fields.length, unlabeled });
  }

  const iframes = root.querySelectorAll("iframe").map((frame) => ({
    src: resolveUrl(attr(frame, "src") ?? attr(frame, "data-src"), base),
    title: attr(frame, "title"),
  }));
  const embeddedForms = [
    ...iframes.map((frame) => frame.src ?? ""),
    ...scripts.map((script) => script.src ?? ""),
  ].filter((src) => FORM_EMBED.test(src));

  const mixedContent: string[] = [];
  if (isHttps) {
    const candidates: Array<[string, string]> = [
      ["img", "src"],
      ["script", "src"],
      ["iframe", "src"],
      ["video", "src"],
      ["audio", "src"],
      ["source", "src"],
      ["embed", "src"],
    ];
    for (const [tag, name] of candidates) {
      for (const el of root.querySelectorAll(tag)) {
        const value = attr(el, name);
        if (value?.startsWith("http://")) mixedContent.push(value);
      }
    }
    for (const link of linkRel(/\bstylesheet\b/i)) {
      const value = attr(link, "href");
      if (value?.startsWith("http://")) mixedContent.push(value);
    }
  }

  const headingLevels = root
    .querySelectorAll("h1, h2, h3, h4, h5, h6")
    .map((heading) => Number(heading.tagName.slice(1)));
  const positiveTabindex = root
    .querySelectorAll("[tabindex]")
    .filter((el) => Number(attr(el, "tabindex")) > 0).length;
  const autoplayMedia =
    root.querySelectorAll("video[autoplay]").filter((video) => !video.hasAttribute("muted"))
      .length + root.querySelectorAll("audio[autoplay]").length;
  const languageSwitcher = root
    .querySelectorAll("button, a, select, [role='button']")
    .some((el) => {
      const hint = `${attr(el, "aria-label") ?? ""} ${attr(el, "class") ?? ""} ${attr(el, "id") ?? ""}`;
      return LANGUAGE_HINT.test(hint) || (el.tagName !== "A" && LANGUAGE_LABEL.test(textOf(el)));
    });
  const hasMapEmbed =
    iframes.some((frame) =>
      /google\.[a-z.]+\/maps|maps\.google|openstreetmap|waze\.com/i.test(frame.src ?? ""),
    ) || scripts.some((script) => /maps\.googleapis\.com\/maps\/api/i.test(script.src ?? ""));

  /* ------------------------------------------------------ visible text */
  for (const el of root.querySelectorAll("script, style, noscript, template, svg")) el.remove();
  const text = textOf(body);
  const footerEl =
    root.querySelector("footer") ??
    root.querySelector('[role="contentinfo"]') ??
    root.querySelector('[id*="footer"], [class*="footer"]');
  const footerText = textOf(footerEl) || text.slice(-4000);
  const wordCount = text.split(" ").filter((word) => /\p{L}/u.test(word)).length;
  const appShell = root.querySelector(
    "#root, #app, #__next, #__nuxt, #q-app, #svelte, app-root, [data-reactroot]",
  );
  const clientRendered =
    wordCount < 60 && (Boolean(appShell) || scripts.some((script) => script.module));

  const htmlEl = root.querySelector("html");
  const lang = htmlEl ? attr(htmlEl, "lang")?.toLowerCase() : undefined;

  return {
    url: pageUrl,
    status,
    htmlBytes: new TextEncoder().encode(html).byteLength,
    title: titleEl ? collapse(titleEl.text) || undefined : undefined,
    description: metaBy("name", "description"),
    lang,
    canonical: canonicalLink ? resolveUrl(attr(canonicalLink, "href"), base) : undefined,
    robotsMeta: [metaBy("name", "robots"), metaBy("name", "googlebot")].filter(Boolean).join(", "),
    viewport: metaBy("name", "viewport"),
    favicon,
    generators,
    og: {
      title: metaBy("property", "og:title"),
      description: metaBy("property", "og:description"),
      image: resolveUrl(metaBy("property", "og:image"), base),
      siteName: metaBy("property", "og:site_name"),
    },
    twitterCard: metaBy("name", "twitter:card"),
    h1: root.querySelectorAll("h1").map((h1) => textOf(h1)),
    headingLevels,
    text,
    wordCount,
    footerText,
    images,
    scripts,
    stylesheets,
    links,
    forms,
    embeddedForms,
    iframes,
    jsonLdTypes: [...sink.types],
    jsonLdSameAs: [...sink.sameAs],
    contentDates,
    hreflangs,
    feeds,
    mixedContent,
    insecureFormActions,
    emptyLinks,
    emptyButtons,
    positiveTabindex,
    autoplayMedia,
    landmarks: {
      main: Boolean(root.querySelector('main, [role="main"]')),
      nav: Boolean(root.querySelector('nav, [role="navigation"]')),
      header: Boolean(root.querySelector('header, [role="banner"]')),
      footer: Boolean(footerEl),
    },
    copyrightYear: copyrightYear(footerText),
    ctaNearTop,
    hasMapEmbed,
    languageSwitcher,
    clientRendered,
    html,
  };
}

import { parse, type HTMLElement } from "node-html-parser";

import { collapse } from "./text";
import { siteHost } from "./web";

/*
 * One fetched HTML page reduced to what deep research reads (client-safe):
 * visible text, footer text, headings, links, script and iframe sources, a
 * bounded copy of inline scripts (for provider and analytics fingerprints),
 * JSON-LD blocks and the text-and-data-mining reservation. The page's text
 * never leaves the server: steps turn it into facts with short verified quotes.
 */

export type PageLink = { href: string; url?: string; text: string; internal: boolean };
export type PageLite = {
  url: string;
  status: number;
  title?: string;
  description?: string;
  lang?: string;
  /** Visible text with one line per block element. */
  text: string;
  footerText: string;
  headings: Array<{ level: number; text: string }>;
  links: PageLink[];
  scriptSrcs: string[];
  /** First 60 KB of inline script text (fingerprints only, never sent anywhere). */
  inlineScripts: string;
  iframes: string[];
  jsonLd: unknown[];
  forms: Array<{ kind: "contact" | "newsletter" | "search" | "login" | "other" }>;
  hreflangs: string[];
  wordCount: number;
  /** <meta name="tdm-reservation" content="1"> on the page. */
  tdmReserved: boolean;
  /** Little or no text in the HTML: rendered by JavaScript. */
  clientRendered: boolean;
};

const attr = (el: HTMLElement, name: string) => el.getAttribute(name)?.trim() || undefined;

function resolve(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href, base);
    url.hash = "";
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function blockText(el: HTMLElement | null | undefined): string {
  if (!el) return "";
  return el.structuredText
    .split("\n")
    .map((line) => collapse(line))
    .filter(Boolean)
    .join("\n");
}

function formKind(form: HTMLElement): PageLite["forms"][number]["kind"] {
  const hints = `${attr(form, "class") ?? ""} ${attr(form, "id") ?? ""} ${attr(form, "action") ?? ""}`;
  const fields = form.querySelectorAll("input, textarea, select");
  const types = fields.map((f) => (attr(f, "type") ?? f.tagName).toLowerCase());
  if (types.includes("password")) return "login";
  if (attr(form, "role") === "search" || types.includes("search")) return "search";
  if (
    /newsletter|subscribe|abon|mailchimp|mc4wp|newsman/i.test(hints) &&
    !types.includes("textarea")
  ) {
    return "newsletter";
  }
  if (types.includes("textarea") || /contact|wpcf7|wpforms|gform|elementor-form/i.test(hints)) {
    return "contact";
  }
  if ((types.includes("email") || types.includes("tel")) && fields.length >= 3) return "contact";
  return "other";
}

export function extractPageLite(html: string, pageUrl: string, status: number): PageLite {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: true, noscript: false, style: false, pre: true },
  });
  const title = collapse(root.querySelector("title")?.text ?? "") || undefined;
  const description =
    attr(root.querySelector('meta[name="description"]') ?? root, "content") || undefined;
  const lang = attr(root.querySelector("html") ?? root, "lang");
  const tdmReserved = /^\s*1\s*$/.test(
    attr(root.querySelector('meta[name="tdm-reservation"]') ?? root, "content") ?? "",
  );
  const hreflangs = root
    .querySelectorAll('link[rel="alternate"][hreflang]')
    .map((el) => attr(el, "hreflang") ?? "")
    .filter(Boolean);

  const scriptSrcs: string[] = [];
  let inline = "";
  const jsonLd: unknown[] = [];
  for (const script of root.querySelectorAll("script")) {
    const src = resolve(attr(script, "src"), pageUrl);
    if (src) scriptSrcs.push(src);
    const type = (attr(script, "type") ?? "").toLowerCase();
    const body = script.rawText ?? "";
    if (type.includes("ld+json")) {
      try {
        jsonLd.push(JSON.parse(body.trim()));
      } catch {
        // Invalid JSON-LD is ignored here; the audit reports it.
      }
    } else if (!src && body && inline.length < 60_000) {
      inline += `${body.slice(0, 60_000 - inline.length)}\n`;
    }
  }
  const iframes = root
    .querySelectorAll("iframe")
    .map((el) => resolve(attr(el, "src") ?? attr(el, "data-src"), pageUrl))
    .filter((src): src is string => Boolean(src));

  for (const el of root.querySelectorAll("script, style, noscript, template, svg")) el.remove();
  const body = root.querySelector("body") ?? root;
  const text = blockText(body);
  const footerEl =
    body.querySelector("footer") ?? body.querySelector('[class*="footer"], [id*="footer"]');
  const footerText = footerEl ? blockText(footerEl) : text.slice(-1500);

  const host = (() => {
    try {
      return siteHost(new URL(pageUrl).hostname);
    } catch {
      return "";
    }
  })();
  const links: PageLink[] = [];
  const seen = new Set<string>();
  for (const a of body.querySelectorAll("a[href]")) {
    const href = attr(a, "href") ?? "";
    if (!href || href.startsWith("#") || /^javascript:/i.test(href)) continue;
    const url = resolve(href, pageUrl);
    const key = url ?? href;
    if (seen.has(key)) continue;
    seen.add(key);
    let internal = false;
    if (url) {
      try {
        internal = siteHost(new URL(url).hostname) === host;
      } catch {
        internal = false;
      }
    }
    const linkText = collapse(a.text) || attr(a, "aria-label") || attr(a, "title") || "";
    links.push({ href, url, text: linkText.slice(0, 120), internal });
    if (links.length >= 600) break;
  }
  const headings = body
    .querySelectorAll("h1, h2, h3, h4")
    .map((el) => ({ level: Number(el.tagName.slice(1)), text: collapse(el.text).slice(0, 160) }))
    .filter((h) => h.text)
    .slice(0, 200);
  const forms = body.querySelectorAll("form").map((form) => ({ kind: formKind(form) }));
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return {
    url: pageUrl,
    status,
    title,
    description,
    lang,
    text,
    footerText,
    headings,
    links,
    scriptSrcs,
    inlineScripts: inline,
    iframes,
    jsonLd,
    forms,
    hreflangs,
    wordCount,
    tdmReserved,
    clientRendered: wordCount < 60 && scriptSrcs.length > 0,
  };
}

/** Flattens JSON-LD (arrays and @graph) into a list of typed objects. */
export function jsonLdObjects(blocks: unknown[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const walk = (value: unknown, depth: number) => {
    if (depth > 6) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    out.push(record);
    if (record["@graph"]) walk(record["@graph"], depth + 1);
  };
  walk(blocks, 0);
  return out;
}

export function jsonLdTypes(record: Record<string, unknown>): string[] {
  const type = record["@type"];
  return (Array.isArray(type) ? type : [type])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.replace(/^https?:\/\/schema\.org\//, ""));
}

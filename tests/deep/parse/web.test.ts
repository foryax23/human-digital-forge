import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detectAnalytics,
  detectConsentManager,
  detectProviders,
} from "../../../src/lib/deep/parse/providers";
import { parseRobots, robotsFromResponse } from "../../../src/lib/deep/parse/robots";
import {
  canonicalPageUrl,
  classifyPageUrl,
  companyNameTokens,
  detectParked,
  domainGuesses,
  isBuilderSocialLink,
  isSocialOrDirectoryHost,
  looksLikeHtml,
  quotedBrand,
} from "../../../src/lib/deep/parse/web";

test("content-type sniffing (libris.ro sends none)", () => {
  assert.equal(looksLikeHtml("", "<!DOCTYPE html><html><head>"), true);
  assert.equal(looksLikeHtml("", "  <html lang=ro>"), true);
  assert.equal(looksLikeHtml("text/html; charset=utf-8", "anything"), true);
  assert.equal(looksLikeHtml("application/json", "<html>"), false);
  assert.equal(looksLikeHtml("", "%PDF-1.7"), false);
});

test("parked pages", () => {
  assert.deepEqual(
    detectParked(
      "<title>esthetique.ro</title><h1>esthetique.ro este de vânzare!</h1>",
      "www.esthetique.ro",
    ),
    {
      parked: true,
      reason: "www.esthetique.ro este de vânzare",
    },
  );
  assert.equal(detectParked("<p>This domain may be for sale. Sedo</p>", "x.ro").parked, true);
  assert.equal(detectParked("<p>Acest domeniu este de vânzare</p>", "x.ro").parked, true);
  assert.equal(detectParked("<p>domain for sale, make an offer</p>", "x.ro").parked, true);
  const real = `<title>Libris</title><p>${"carte nouă ".repeat(400)} coming soon: noi titluri</p>`;
  assert.equal(detectParked(real, "libris.ro").parked, false);
});

test("canonical page URLs", () => {
  assert.equal(canonicalPageUrl("https://www.x.ro/despre/?language=en"), "https://x.ro/despre");
  assert.equal(canonicalPageUrl("https://x.ro/index.html"), "https://x.ro/");
  assert.equal(canonicalPageUrl("https://x.ro/a?utm_source=fb&id=2#top"), "https://x.ro/a?id=2");
  assert.equal(canonicalPageUrl("https://X.ro/contact/"), canonicalPageUrl("https://x.ro/contact"));
});

test("builder social links and page kinds", () => {
  assert.equal(isBuilderSocialLink("https://www.facebook.com/wix"), true);
  assert.equal(isBuilderSocialLink("https://www.facebook.com/librisro"), false);
  assert.equal(classifyPageUrl("https://x.ro/"), "home");
  assert.equal(classifyPageUrl("https://x.ro/contact"), "contact");
  assert.equal(classifyPageUrl("https://x.ro/cariere/sofer"), "careers");
  assert.equal(classifyPageUrl("https://x.ro/p/12", "Programări online"), "booking");
});

test("name tokens, quoted brands and domain guesses (.dev reached)", () => {
  assert.deepEqual(companyNameTokens("VORTEX HUB S.R.L.").core, ["vortex", "hub"]);
  assert.equal(
    quotedBrand('PRODUCTIE PRESTARI SI COMERT "VANCSA-MULTIPAST" SRL'),
    "VANCSA-MULTIPAST",
  );
  assert.equal(quotedBrand("CONSILIER FINANCIAR CONTABIL SI FISCAL,,CONFISCALSRL"), "CONFISCAL");
  const guesses = domainGuesses("VORTEX HUB S.R.L.");
  assert.ok(guesses.includes("vortexhub.dev"));
  assert.ok(guesses.includes("vortexhub.ro"));
  assert.ok(guesses.length <= 12);
  assert.ok(
    domainGuesses("CONSILIER FINANCIAR CONTABIL SI FISCAL,,CONFISCALSRL").includes("confiscal.ro"),
  );
});

test("robots.txt with Crawl-delay and the VortexScan group", () => {
  const policy = parseRobots(
    [
      "User-agent: *",
      "Disallow: /admin",
      "Crawl-delay: 2",
      "",
      "User-agent: VortexScan",
      "Disallow: /private",
      "Crawl-delay: 5",
      "Sitemap: https://x.ro/sitemap.xml",
    ].join("\n"),
  );
  assert.equal(policy.crawlDelay, 5);
  assert.equal(policy.isAllowed("/admin"), true);
  assert.equal(policy.isAllowed("/private/a"), false);
  assert.deepEqual(policy.sitemaps, ["https://x.ro/sitemap.xml"]);
  assert.equal(parseRobots("User-agent: vortexscan\nDisallow: /").optsOut, true);
  assert.equal(parseRobots("User-agent: *\nDisallow: /").optsOut, false);
  assert.equal(robotsFromResponse(404, "").isAllowed("/x"), true);
  assert.equal(robotsFromResponse(503, "").isAllowed("/x"), false);
  assert.equal(robotsFromResponse(200, "<!doctype html><html>").found, false);
});

test("providers from script, iframe and link fixtures", () => {
  const html = `
    <script src="https://widget.mero.ro/embed.js"></script>
    <iframe src="https://booksy.com/widget/123"></iframe>
    <a href="https://wa.me/40700000000">WhatsApp</a>
    <a href="https://glovoapp.com/ro/ro/timisoara/lloyd/">Glovo</a>
    <script>(function(){var s=document.createElement('script');s.src='//code.tidio.co/abc.js';})()</script>`;
  const found = detectProviders(html);
  assert.deepEqual(found.booking, ["Mero", "Booksy"]);
  assert.deepEqual(found.delivery, ["Glovo"]);
  assert.deepEqual(found.chat.sort(), ["Tidio", "WhatsApp"]);
  assert.deepEqual(detectProviders("<p>Programări la telefon</p>"), {
    booking: [],
    delivery: [],
    chat: [],
  });
  assert.deepEqual(
    detectAnalytics(
      '<script async src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>',
    ),
    ["Google Analytics"],
  );
  assert.deepEqual(
    detectConsentManager('<script src="https://consent.cookiebot.com/uc.js"></script>'),
    ["Cookiebot"],
  );
});

test("social networks and directories are recognised (never fetched); Crawl-delay is never capped", () => {
  for (const host of [
    "facebook.com",
    "m.facebook.com",
    "www.instagram.com",
    "ro.linkedin.com",
    "x.com",
    "www.tiktok.com",
    "listafirme.ro",
    "maps.app.goo.gl",
  ])
    assert.equal(isSocialOrDirectoryHost(host), true, host);
  for (const host of [
    "exprestransport.ro",
    "fbtransport.ro",
    "xcom.ro",
    "vortexhub.dev",
    "linkedinfo.ro",
  ])
    assert.equal(isSocialOrDirectoryHost(host), false, host);
  assert.equal(parseRobots("User-agent: *\nCrawl-delay: 60\n").crawlDelay, 60);
});

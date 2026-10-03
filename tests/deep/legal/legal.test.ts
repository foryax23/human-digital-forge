import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { findBannedWords } from "../../../src/lib/deep/report/words";
import { lookupAnaf } from "../../../src/lib/scan/anaf.server";
import { auditWebsitePolite } from "../../../src/lib/scan/audit/index.server";
import { allGuesses, discoverWebsite } from "../../../src/lib/scan/discover.server";
import { COMPANY, COMPANY_LINE } from "../../../src/lib/scan/legal/company";
import {
  DEEP_NOTICE,
  DEEP_RETENTION_DAYS,
  DEEP_TERMS,
  DEEP_TERMS_VERSION,
  deepConsentRecord,
  deepTermsText,
  LEAD_NOTICE_VERSION,
  leadConsentRecord,
  PRIVACY_EMAIL,
} from "../../../src/lib/scan/legal/lead-notice";
import { safeFetch, SafeFetchError } from "../../../src/lib/scan/net.server";

import { doh, installFetch, page } from "./fake-net";

const src = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

/* ------------------------------------------------------------- consent */

test("deep-start record: server text for the version, required terms, optional marketing, no IP", () => {
  for (const lang of ["ro", "en"] as const) {
    const at = new Date("2026-10-03T10:00:00Z");
    const r = deepConsentRecord(lang, true, at);
    assert.equal(r.channel, "vortex-deep/start");
    assert.equal(r.recordedAt, "2026-10-03T10:00:00.000Z");
    assert.equal(r.terms?.version, DEEP_TERMS_VERSION);
    assert.equal(r.terms?.accepted, true);
    assert.equal(r.terms?.text, deepTermsText(lang));
    assert.ok(r.notice.startsWith(DEEP_NOTICE[lang].notice));
    assert.equal(r.marketing.granted, true);
    assert.equal(r.marketing.text, DEEP_NOTICE[lang].marketing);
    assert.match(r.reportBasis, /6\(1\)\(b\)/);
    assert.equal(deepConsentRecord(lang, false).marketing.granted, false);
    // No IP or user agent field, and the function takes no text from a client.
    assert.deepEqual(Object.keys(r).sort(), [
      "channel",
      "lang",
      "marketing",
      "notice",
      "recordedAt",
      "reportBasis",
      "terms",
      "version",
    ]);
    assert.equal(deepConsentRecord.length, 2);
  }
  const pdf = leadConsentRecord("ro", false);
  assert.equal(pdf.channel, "vortex-scan/pdf-dialog");
  assert.equal(pdf.version, LEAD_NOTICE_VERSION);
  assert.equal(pdf.terms, undefined);
});

test("deep notice and terms: who processes, the AI processor, retention, error review, both languages, plain words", () => {
  for (const lang of ["ro", "en"] as const) {
    const n = DEEP_NOTICE[lang].notice;
    assert.match(n, /Mihai Dandea, Director/);
    assert.match(n, /Anthropic/);
    assert.ok(n.includes(String(DEEP_RETENTION_DAYS)));
    assert.ok(n.includes(PRIVACY_EMAIL));
    assert.ok(n.includes("30"));
    const terms = DEEP_TERMS[lang].points.join(" ");
    assert.match(terms, lang === "ro" ? /5 zile lucrătoare/ : /5 working days/);
    assert.match(
      terms,
      lang === "ro"
        ? /nu este consultanță juridică, fiscală sau financiară/i
        : /not legal, tax or financial advice/i,
    );
    assert.deepEqual(findBannedWords(`${n} ${terms}`), []);
  }
  assert.equal(DEEP_TERMS.ro.points.length, DEEP_TERMS.en.points.length);
});

test("the terms page renders the same report terms the start form stores, under a stable anchor", () => {
  const terms = src("src/routes/terms.tsx");
  assert.match(terms, /DEEP_TERMS\[lang\]/);
  assert.match(terms, /id="rapoarte-vortex-scan"/);
  assert.match(terms, /DEEP_TERMS_VERSION/);
});

test("privacy page: contact person, deep research, Anthropic, retention, robot, analytics disclosure", () => {
  const p = src("src/routes/privacy.tsx");
  for (const needle of [
    "Persoana de contact pentru protecția datelor: Mihai Dandea, Director",
    'id="vortex-scan-deep"',
    'id="vortex-scan-bot"',
    "Anthropic (Statele Unite)",
    "DEEP_RETENTION_DAYS",
    "DEEP_FEEDBACK_RETENTION_MONTHS",
    "Cel mult 30 de pagini publice",
    "cel mult 30 de pagini publice ale site-ului firmei la o cercetare",
    "/~flock.js",
    "Nu păstrăm adresa IP",
    "User-agent: VortexScan",
  ])
    assert.ok(p.includes(needle), `privacy page misses: ${needle}`);
  const cookies = src("src/routes/cookies.tsx");
  assert.ok(cookies.includes("/~flock.js"));
  assert.ok(cookies.includes("Șterge din acest browser"));
});

test("Vortex Hub's identity line carries the CUI and the J number, in every footer", () => {
  assert.equal(COMPANY_LINE, `© ${COMPANY.legalName}, CUI 54747928, J2026033767000, Timișoara`);
  assert.match(src("src/components/landing/ContactFooter.tsx"), /COMPANY_LINE/);
  assert.match(src("src/components/layout/SiteFooter.tsx"), /ContactFooter/);
  assert.match(
    src("src/components/scan/pdf/pages-plan.tsx"),
    /Recomandări de la \$\{COMPANY\.signatory\}, \$\{COMPANY\.role\.ro\}/,
  );
});

test("no e-Factura finding left in the scan types, the sample fixture or the PDF", () => {
  for (const file of [
    "src/lib/scan/types.ts",
    "src/lib/scan/fixtures/sample-blueprint.ts",
    "src/components/scan/pdf/pages-findings.tsx",
    "src/components/scan/pdf/pages-plan.tsx",
  ]) {
    const text = src(file);
    assert.ok(!/eInvoice|e-Factura: (Da|Nu)|TVA și e-Factura/.test(text), file);
  }
  assert.match(src("src/components/scan/pdf/pages-findings.tsx"), /"Sediul social"/);
});

test("checkout never trusts an account ID or e-mail sent by the browser", () => {
  const c = src("src/lib/checkout.functions.ts");
  assert.ok(!/data\.userId|data\.email/.test(c));
  assert.match(c, /verifiedAccount\(\)/);
  assert.match(c, /getClaims/);
});

/* ------------------------------------------------- PFA guard, ANAF spacing */

const v9 = (general: Record<string, unknown>, seat: Record<string, unknown> = {}) =>
  page(
    JSON.stringify({
      cod: 200,
      found: [
        {
          date_generale: { stare_inregistrare: "INREGISTRAT din data 01.01.2015", ...general },
          inregistrare_scop_Tva: { scpTVA: false },
          stare_inactiv: { statusInactivi: false },
          adresa_sediu_social: {
            sdenumire_Localitate: "Mun. Timişoara",
            sdenumire_Judet: "TIMIŞ",
            ...seat,
          },
        },
      ],
      notFound: [],
    }),
    { "content-type": "application/json" },
  );

test("quick scan: a PFA shows no address, locality, phone or registration number (shared guard)", async () => {
  const net = installFetch([
    [
      /PlatitorTvaRest/,
      () =>
        v9({
          cui: 41234567,
          denumire: "POPESCU ION PERSOANA FIZICA AUTORIZATA",
          adresa: "STR. X NR. 1",
          telefon: "0722000000",
          nrRegCom: "F35/1/2015",
          forma_juridica: "PERSOANA FIZICA AUTORIZATA",
          cod_CAEN: "6201",
        }),
    ],
    [/caen/i, () => page("{}", { "content-type": "application/json" })],
  ]);
  try {
    const profile = await lookupAnaf("41234567");
    assert.ok(profile);
    assert.equal(profile!.legalForm, "Persoană fizică autorizată (PFA)");
    assert.equal(profile!.address, undefined);
    assert.equal(profile!.city, undefined);
    assert.equal(profile!.phone, undefined);
    assert.equal(profile!.regNo, undefined);
    assert.equal(net.calls.filter((c) => c.url.includes("bilant")).length, 0);
  } finally {
    net.restore();
  }
});

test("quick scan: a seat on a numbered floor or in a flat keeps the locality only; ANAF calls ≥ 1.1 s apart", async () => {
  const net = installFetch([
    [
      /PlatitorTvaRest/,
      () =>
        v9(
          {
            cui: 9259999,
            denumire: "EXEMPLU SRL",
            adresa: "JUD. TIMIŞ, MUN. TIMIŞOARA, STR. ARMONIEI, NR.23A, ET. 2",
            telefon: "0256000000",
            nrRegCom: "J35/1/2015",
            forma_juridica: "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ",
          },
          { sdenumire_Strada: "Str. Armoniei", snumar_Strada: "23A", sdetalii_Adresa: "Et. 2" },
        ),
    ],
    [
      /webservicesp\.anaf\.ro\/bilant/,
      () =>
        page(
          JSON.stringify({
            i: [
              { indicator: "I20", val_indicator: 4, val_den_indicator: "Numar mediu de salariati" },
            ],
          }),
          { "content-type": "application/json" },
        ),
    ],
  ]);
  try {
    const profile = await lookupAnaf("9259999");
    assert.equal(profile!.address, "Timișoara, jud. Timiș");
    assert.equal(profile!.phone, undefined, "under 10 employees: no registry phone");
    const anaf = net.calls.filter((c) => c.url.includes("webservicesp.anaf.ro"));
    assert.equal(anaf.length, 2);
    assert.ok(anaf[1].at - anaf[0].at >= 1100, `gap ${anaf[1].at - anaf[0].at} ms`);
  } finally {
    net.restore();
  }
});

/* --------------------------------------------------- network safety (B3) */

test("the DNS safety check fails closed when the resolver does not answer, and does not remember the failure", async () => {
  let dohUp = false;
  const net = installFetch([
    [
      /cloudflare-dns\.com/,
      (url) => (dohUp ? doh(["shop-exemplu.ro"])[1](url) : new Response("oops", { status: 502 })),
    ],
    [/^https:\/\/shop-exemplu\.ro\//, () => page("<html><body>ok</body></html>")],
  ]);
  try {
    await assert.rejects(
      safeFetch("https://shop-exemplu.ro/"),
      (e: unknown) => e instanceof SafeFetchError && e.code === "dns",
    );
    assert.equal(
      net.calls.filter((c) => c.url.startsWith("https://shop-exemplu.ro")).length,
      0,
      "nothing sent unchecked",
    );
    dohUp = true;
    const ok = await safeFetch("https://shop-exemplu.ro/");
    assert.equal(ok.status, 200);
  } finally {
    net.restore();
  }
});

/* ------------------------------------------------ discovery hygiene (B4) */

test("discovery: .ro and .dev first, every live guess checked, J number accepted as proof", async () => {
  const guesses = allGuesses("VORTEX HUB S.R.L.");
  assert.ok(guesses.length <= 12);
  assert.deepEqual(
    guesses.slice(0, 2).map((g) => g.split(".").pop()),
    ["ro", "ro"],
  );
  assert.ok(guesses.indexOf("vortexhub.dev") < guesses.indexOf("vortexhub.com"));
  const net = installFetch([
    doh(["vortexhub.dev"]),
    [
      /vortexhub\.dev\/robots\.txt/,
      () => page("User-agent: *\nAllow: /\n", { "content-type": "text/plain" }),
    ],
    [
      /^https:\/\/vortexhub\.dev\/$/,
      () =>
        page(
          `<html lang="ro"><head><title>Vortex Hub</title></head><body><h1>Studio digital</h1><footer>VORTEX HUB S.R.L. · J2026033767000 · Timișoara</footer></body></html>`,
        ),
    ],
  ]);
  try {
    const found = await discoverWebsite({
      cui: "54747928",
      name: "VORTEX HUB S.R.L.",
      city: "Timișoara",
      regNo: "J2026033767000",
    });
    assert.equal(found?.host, "vortexhub.dev");
    assert.ok(found!.confidence >= 0.9);
    assert.ok(found!.evidence.some((e) => /Trade Register number/.test(e)));
  } finally {
    net.restore();
  }
});

test("discovery: '<domain> este de vânzare' is parked; a page without a content type is read", async () => {
  const net = installFetch([
    doh(["esthetique.ro", "libris.ro"]),
    [/robots\.txt/, () => page("", { "content-type": "text/plain" }, 404)],
    [
      /^https:\/\/esthetique\.ro\/$/,
      () =>
        page(
          `<html><head><title>esthetique.ro</title></head><body><h1>esthetique.ro este de vânzare!</h1><p>Contactați-ne pentru ofertă.</p></body></html>`,
        ),
    ],
    [
      /^https:\/\/libris\.ro\/$/,
      () =>
        page(
          `<!doctype html><html lang="ro"><head><title>Libris</title></head><body><h1>Librăria Libris</h1><footer>LIBRIS SRL CUI RO1094992 Brașov</footer></body></html>`,
          {},
        ),
    ],
  ]);
  try {
    assert.equal(
      await discoverWebsite({
        cui: "15266478",
        name: "ESTHETIQUE BEAUTY CENTER SRL",
        knownWebsite: "https://esthetique.ro",
      }).then((d) => (d && d.confidence >= 0.45 ? d.host : null)),
      null,
    );
    const libris = await discoverWebsite({ cui: "1094992", name: "LIBRIS SRL", city: "Brașov" });
    assert.equal(libris?.host, "libris.ro");
  } finally {
    net.restore();
  }
});

test("discovery: a broken certificate is retried over http and reported, not lost", async () => {
  const net = installFetch([
    doh(["skiriders.ro"]),
    [/robots\.txt/, () => page("", { "content-type": "text/plain" }, 404)],
    [
      /^https:\/\/skiriders\.ro\//,
      () => {
        throw Object.assign(new TypeError("fetch failed"), {
          cause: { code: "CERT_HAS_EXPIRED", message: "certificate has expired" },
        });
      },
    ],
    [
      /^http:\/\/skiriders\.ro\/$/,
      () =>
        page(
          `<html lang="ro"><head><title>Skiriders</title></head><body><h1>Skiriders Shop</h1><p>Echipament de schi în Timișoara. CUI 37355711</p></body></html>`,
        ),
    ],
  ]);
  try {
    const found = await discoverWebsite({
      cui: "37355711",
      name: "SKIRIDERS SHOP SRL",
      city: "Timișoara",
      knownWebsite: "https://skiriders.ro",
    });
    assert.equal(found?.url, "http://skiriders.ro/");
    assert.ok(found!.evidence.some((e) => /certificate is invalid/.test(e)));
  } finally {
    net.restore();
  }
});

/* ------------------------------------------------ polite audit mode (B4) */

test("polite audit: one request at a time, ≥ 1 s apart, ≤ 3 asset HEAD checks, pages handed back", async () => {
  const home = `<!doctype html><html lang="ro"><head><title>Exemplu</title><meta name="viewport" content="width=device-width">
<link rel="stylesheet" href="https://exemplu-polite.ro/style.abcdef123.css"><script src="https://exemplu-polite.ro/app.abcdef123.js"></script></head>
<body><a href="/contact">Contact</a><img src="https://exemplu-polite.ro/a.jpg"><img src="https://exemplu-polite.ro/b.jpg"><img src="https://exemplu-polite.ro/c.jpg">
<footer>EXEMPLU SRL CUI RO9259999</footer></body></html>`;
  const net = installFetch([
    doh(["exemplu-polite.ro"]),
    [/robots\.txt/, () => page("User-agent: *\nAllow: /\n", { "content-type": "text/plain" })],
    [/sitemap/, () => page("", { "content-type": "text/plain" }, 404)],
    [/^https:\/\/exemplu-polite\.ro\/$/, () => page(home)],
    [
      /^http:\/\/exemplu-polite\.ro\/$/,
      () =>
        new Response(null, { status: 301, headers: { location: "https://exemplu-polite.ro/" } }),
    ],
    [
      /\/contact$/,
      () => page(`<html lang="ro"><body><h1>Contact</h1><p>Telefon 0256 000 000</p></body></html>`),
    ],
    [
      /\.(css|js|jpg)$/,
      () =>
        new Response(null, {
          status: 200,
          headers: { "content-type": "image/jpeg", "content-length": "1000" },
        }),
    ],
  ]);
  try {
    const { audit, pages } = await auditWebsitePolite({
      url: "https://exemplu-polite.ro/",
      cui: "9259999",
      name: "Exemplu",
    });
    assert.equal(audit.reachable, true);
    assert.ok(
      pages.some((p) => p.url === "https://exemplu-polite.ro/" && p.html.includes("CUI RO9259999")),
    );
    assert.ok(pages.some((p) => p.url.endsWith("/contact")));
    const site = net.calls.filter((c) => new URL(c.url).hostname === "exemplu-polite.ro");
    assert.equal(site[0].url, "https://exemplu-polite.ro/robots.txt", "robots.txt first");
    for (let i = 1; i < site.length; i++)
      assert.ok(
        site[i].at - site[i - 1].at >= 990,
        `${site[i].url}: ${site[i].at - site[i - 1].at} ms after the previous`,
      );
    const heads = site.filter((c) => c.method === "HEAD");
    assert.ok(heads.length <= 3, `${heads.length} HEAD checks`);
    assert.equal(
      site.filter((c) => c.url === "https://exemplu-polite.ro/").length,
      1,
      "homepage once",
    );
    assert.equal(site.filter((c) => c.url.endsWith("favicon.ico")).length, 0);
  } finally {
    net.restore();
  }
});

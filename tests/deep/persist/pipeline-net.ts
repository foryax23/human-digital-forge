import { readFileSync } from "node:fs";

import { html, json, scriptedFetch, virtualClock } from "../steps/helpers";

/*
 * The scripted network of the whole-run tests (stopgap and tables stores): ANAF v9 and
 * bilanț for Expres Transport (CUI 3365133), courts and TED empty, and the company's
 * small website. No real request is ever made.
 */

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/deep/${name}`, import.meta.url), "utf8");
const V9 = JSON.parse(fixture("anaf-v9.json")).records as Record<string, unknown>;
const BILANT = JSON.parse(fixture("bilant.json"));

function bilantFor(cui: string, year: number) {
  if (cui !== "3365133" || year < 2019)
    return { an: year, cui: Number(cui), deni: "", caen: 0, den_caen: "", i: [] };
  const scale = 1 - (2025 - year) * 0.08;
  const base = BILANT.expres2025;
  return {
    ...base,
    an: year,
    i: base.i.map((row: { indicator: string; val_indicator: number }) => ({
      ...row,
      val_indicator:
        row.indicator === "I20"
          ? Math.round(25 - (2025 - year))
          : Math.round(row.val_indicator * scale),
    })),
  };
}

const HOME = `<!doctype html><html lang="ro"><head><title>Expres Transport – transport marfă</title></head>
<body><nav><a href="/contact">Contact</a></nav><main><h1>Transport rutier de mărfuri din Pecica</h1>
<p>Facem transport intern și internațional. Cere o ofertă la telefon sau prin formular.</p></main>
<footer>EXPRES TRANSPORT SRL · CUI RO3365133 · J02/151/1993</footer></body></html>`;
const CONTACT = `<html lang="ro"><body><h1>Contact</h1><p>Telefon: <a href="tel:+40257000000">0257 000 000</a></p>
<form class="wpcf7"><input type="text" name="n"><input type="email" name="e"><textarea name="m"></textarea></form></body></html>`;

export function network(clock: ReturnType<typeof virtualClock>) {
  return scriptedFetch(
    [
      [
        /PlatitorTvaRest\/v9\/tva/,
        async (_u, init) => {
          const asked = JSON.parse(String(init?.body ?? "[]")) as Array<{ cui: number }>;
          return json({
            cod: 200,
            found: asked.map(({ cui }) => V9[String(cui)]).filter(Boolean),
            notFound: [],
          });
        },
      ],
      [
        /webservicesp\.anaf\.ro\/bilant/,
        (u) => json(bilantFor(u.searchParams.get("cui")!, Number(u.searchParams.get("an")))),
      ],
      [
        /portalquery\.just\.ro/,
        () =>
          new Response(
            "<soap:Envelope><soap:Body><CautareDosareResponse><CautareDosareResult></CautareDosareResult></CautareDosareResponse></soap:Body></soap:Envelope>",
            { status: 200, headers: { "content-type": "text/xml" } },
          ),
      ],
      [/api\.ted\.europa\.eu/, () => json({ notices: [], totalNoticeCount: 0 })],
      [
        /exprestransport\.ro\/robots\.txt$/,
        () =>
          new Response("User-agent: *\nDisallow: /wp-admin\n", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      ],
      [
        /^https:\/\/exprestransport\.ro\/$/,
        () =>
          new Response(null, {
            status: 301,
            headers: { location: "https://www.exprestransport.ro/" },
          }),
      ],
      [/^https:\/\/www\.exprestransport\.ro\/$/, () => html(HOME)],
      [/exprestransport\.ro\/contact$/, () => html(CONTACT)],
    ],
    clock,
  );
}

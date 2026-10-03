import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { lei, leiShort, pct } from "../../../src/lib/deep/parse/format";
import {
  daysToCollect,
  parseFinShard,
  peerBands,
  pickRivals,
  selectPeers,
} from "../../../src/lib/deep/parse/fin-shard";
import { extractPageLite } from "../../../src/lib/deep/parse/page";
import { extractRules } from "../../../src/lib/deep/parse/rules-extract";

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/deep/${name}`, import.meta.url), "utf8");

test("number formats used in fact displays", () => {
  assert.deepEqual(lei(4620000), { en: "4,620,000 lei", ro: "4.620.000 lei" });
  assert.deepEqual(leiShort(4620000), { en: "4.62M lei", ro: "4,62 mil. lei" });
  assert.deepEqual(leiShort(94500000), { en: "94.5M lei", ro: "94,5 mil. lei" });
  assert.deepEqual(leiShort(254000), { en: "254k lei", ro: "254 mii lei" });
  assert.deepEqual(leiShort(-120000), { en: "-120k lei", ro: "-120 mii lei" });
  assert.deepEqual(pct(0.0918), { en: "9.2%", ro: "9,2%" });
  assert.deepEqual(pct(0.21), { en: "21%", ro: "21%" });
  // Round values keep their zeros (a 20% margin is never shown as 2%).
  assert.deepEqual(pct(0.2), { en: "20%", ro: "20%" });
  assert.deepEqual(pct(0.5), { en: "50%", ro: "50%" });
  assert.deepEqual(pct(1), { en: "100%", ro: "100%" });
  assert.deepEqual(pct(-0.3), { en: "-30%", ro: "-30%" });
  assert.deepEqual(pct(0.2953), { en: "30%", ro: "30%" });
  assert.deepEqual(pct(0.05), { en: "5%", ro: "5%" });
  assert.deepEqual(pct(0.0), { en: "0%", ro: "0%" });
  assert.deepEqual(leiShort(120e6), { en: "120M lei", ro: "120 mil. lei" });
  assert.deepEqual(leiShort(200e6), { en: "200M lei", ro: "200 mil. lei" });
  assert.deepEqual(leiShort(1e7), { en: "10M lei", ro: "10 mil. lei" });
  assert.deepEqual(leiShort(2e6), { en: "2M lei", ro: "2 mil. lei" });
  assert.deepEqual(leiShort(4.5e6), { en: "4.5M lei", ro: "4,5 mil. lei" });
});

test("page extraction and rules: identity, contacts, providers, prices, roles without names", () => {
  const html = fixture("site-dental.html");
  const page = extractPageLite(html, "https://www.exemplu-dent.ro/", 200);
  assert.equal(page.title, "Exemplu Dent – clinică stomatologică");
  assert.ok(page.text.includes("Consultație inițială"));
  assert.ok(page.footerText.includes("CUI"));
  assert.equal(page.tdmReserved, false);
  const team = extractPageLite(
    fixture("site-dental-team.html"),
    "https://www.exemplu-dent.ro/echipa",
    200,
  );
  const rules = extractRules(
    [
      { ...page, html },
      { ...team, html: fixture("site-dental-team.html") },
    ],
    { cui: "9259999", regNo: "J1997000126021" },
  );
  assert.equal(rules.identity.cui, true);
  assert.equal(rules.identity.regNo, true);
  assert.equal(rules.contact.phone, true);
  assert.deepEqual(rules.contact.genericEmails, ["receptie@exemplu-dent.ro"]);
  assert.equal(rules.contact.personalEmailCount, 1);
  assert.deepEqual(rules.providers.booking, ["Mero"]);
  assert.equal(rules.prices.length >= 2, true);
  assert.equal(rules.prices[0].amount, 150);
  assert.ok(rules.hours.length >= 1);
  assert.equal(rules.legal.privacy, true);
  assert.equal(rules.legal.anpc, true);
  assert.deepEqual(
    rules.social.map((s) => s.platform),
    ["facebook"],
    "builder link ignored",
  );
  assert.equal(rules.teamCards, 2, "two people counted");
  const titles = rules.roles.map((r) => r.title);
  assert.ok(titles.includes("Medic stomatolog"));
  assert.ok(!JSON.stringify(rules).includes("Popescu"), "no personal name survives");
  assert.ok(!JSON.stringify(rules).includes("ana.popescu"), "personal e-mail never shown");
});

test("MF shard: parse, scope, size band, bands and rivals", () => {
  const rows = parseFinShard(fixture("fin-4646-sample.txt"));
  assert.ok(rows.length >= 30);
  const subject = {
    cui: "9259999",
    countyCode: "AR",
    city: "Arad",
    turnover: 15_390_000,
    turnoverPrev: 14_000_000,
    profitPretax: 900_000,
    employees: 16,
    receivables: 3_000_000,
  };
  const selection = selectPeers(rows, subject)!;
  assert.ok(selection.peers.length >= 10);
  assert.ok(
    selection.peers.every(
      (p) => p.turnover >= selection.band[0] && p.turnover <= selection.band[1],
    ),
  );
  assert.ok(!selection.peers.some((p) => p.cui === "9259999"));
  const bands = peerBands(selection.peers, subject);
  assert.ok(
    bands.turnover &&
      bands.turnover.p25 <= bands.turnover.p50 &&
      bands.turnover.p50 <= bands.turnover.p75,
  );
  assert.ok(bands.marginPretax?.you !== undefined);
  const rivals = pickRivals(selection.peers, subject);
  assert.equal(rivals.length, 5);
  assert.equal(
    daysToCollect(700, 1000),
    undefined,
    "receivables above 60% of turnover are dropped",
  );
  assert.equal(Math.round(daysToCollect(100, 1000)!), 37);
  assert.equal(selectPeers([], subject), null);
});

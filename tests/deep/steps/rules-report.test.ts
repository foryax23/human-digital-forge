import assert from "node:assert/strict";
import { test } from "node:test";

import type { Fact } from "../../../src/lib/deep/contracts";
import { TU_FORMS } from "../../../src/lib/deep/llm/words";
import { moneyFacts } from "../../../src/lib/deep/steps/money.server";
import { provisionalReportParts } from "../../../src/lib/deep/steps/report-fallback.server";

const years = [2025, 2024, 2023, 2022].map((year, i) => ({
  year,
  caen2: "4646",
  caenLabel: "Comerț cu ridicata al produselor farmaceutice",
  turnover: 15_000_000 - i * 1_000_000,
  profitPretax: 900_000 - i * 100_000,
  profitNet: 760_000 - i * 80_000,
  expenses: 14_000_000 - i * 900_000,
  employees: 16 - i,
}));

const site = (id: string, value: boolean | string): Fact => ({
  id,
  section: "site",
  predicate: id,
  value,
  display: { ro: String(value), en: String(value) },
  source: "site",
  asOf: "2026-10-03",
  confidence: "confirmat",
  score: 1,
  method: "html",
  gdpr: "G0",
});

const facts: Fact[] = [
  ...moneyFacts(years, "2026-10-03"),
  {
    id: "money.filed",
    section: "money",
    predicate: "money.filed",
    value: { filed: true },
    display: { ro: "Bilanțuri", en: "Accounts" },
    source: "anaf_bilant",
    asOf: "FY2025",
    confidence: "confirmat",
    score: 1,
    method: "api",
    gdpr: "G0",
  },
  site("site.status", "verified"),
  site("site.contact.present", true),
  site("site.cui.present", false),
  site("people.hiring", true),
];

const company = {
  name: "DORIOT DENT SRL",
  displayName: "Doriot Dent SRL",
  cui: "9259999",
  activity: { ro: "Comerț", en: "Trade" },
  caen2: "4646",
};

test("rules report: five lines, money facts, legal must-do first, every sentence cites facts", () => {
  const parts = provisionalReportParts({
    facts,
    gaps: [],
    company,
    relationship: "proprietar",
    lang: "ro",
    competitors: [],
  });
  assert.equal(parts.lights.length, 5);
  assert.equal(parts.firm, "established");
  assert.equal(parts.vocab, "b2b_wholesale");
  assert.equal(parts.audience, "owner");
  assert.equal(parts.actions[0]?.id, "legal.company_details");
  assert.equal(parts.actions[0]?.mandatory, true);
  const sentences = [
    parts.rulesBrief.headline,
    parts.rulesBrief.meaning,
    ...parts.rulesBrief.findings,
  ].flatMap((s) => s.sentences);
  assert.ok(sentences.length >= 3);
  for (const s of sentences) assert.ok(s.factIds.length > 0, s.text);
  assert.equal(parts.counts.facts, facts.length);
  assert.equal(parts.lights.find((l) => l.area === "echipa")?.state, "bine", "hiring is positive");
});

test("rules report for a client or supplier: third person, no actions, no 'tu' forms", () => {
  const parts = provisionalReportParts({
    facts,
    gaps: [],
    company,
    relationship: "client_furnizor",
    lang: "ro",
    competitors: [],
  });
  assert.equal(parts.audience, "third_party");
  assert.equal(parts.actions.length, 0);
  const brief = parts.rulesBrief;
  const all = [
    brief.headline,
    brief.meaning,
    brief.customerView,
    brief.rivals,
    ...brief.findings,
  ].flatMap((s) => s.sentences);
  for (const s of all) assert.equal(TU_FORMS.test(s.text), false, s.text);
  for (const l of parts.lights) assert.equal(TU_FORMS.test(l.reason.ro), false, l.reason.ro);
  assert.ok(brief.headline.sentences[0].text.startsWith("Doriot Dent SRL"));
});

/* ----------------------------------------------- review fixes: honest lines */

const filedFact = (value: Fact["value"]): Fact => ({
  id: "money.filed",
  section: "money",
  predicate: "money.filed",
  value,
  display: { ro: "-", en: "-" },
  source: "anaf_bilant",
  asOf: "FY2025",
  confidence: "confirmat",
  score: 1,
  method: "api",
  gdpr: "G0",
});
const linesFor = (list: Fact[], relationship: "proprietar" | "client_furnizor" = "proprietar") =>
  provisionalReportParts({
    facts: list,
    gaps: [],
    company,
    relationship,
    lang: "ro",
    competitors: [],
  });
const lineOf = (parts: ReturnType<typeof linesFor>, area: string) =>
  parts.lights.find((l) => l.area === area)!;

test("money facts: round percentages keep their zeros; turnover takes a singular verb", () => {
  const grow = [2025, 2024, 2023, 2022].map((year, i) => ({
    year,
    turnover: [1_300_000, 1_100_000, 1_000_000, 1_000_000][i],
    profitPretax: [260_000, 200_000, 100_000, 50_000][i],
    expenses: [1_040_000, 900_000, 800_000, 950_000][i],
  }));
  const list = moneyFacts(grow, "2026-10-03");
  const byId = (id: string) => list.find((x) => x.id === id)!;
  assert.equal(byId("money.margin_pretax.2025").display.ro, "20%");
  assert.equal(byId("money.growth_turnover_3y").display.ro, "+30% (2022–2025)");
  assert.equal(
    byId("money.expenses_vs_revenue").display.ro,
    "2023–2025: cheltuielile au crescut cu 30%, cifra de afaceri a crescut cu 30%",
  );
});

test("Bani: unanswered years, a missing money step and a dormant year are never 'new' or 'Bine'", () => {
  const unanswered = linesFor([filedFact({ filed: null, years: [], unchecked: [2025, 2024] })]);
  assert.equal(unanswered.firm, "established");
  assert.deepEqual(
    [lineOf(unanswered, "bani").state, lineOf(unanswered, "bani").reason.ro],
    ["neverificat", "ANAF nu a răspuns; verifică la sursă"],
  );
  const third = linesFor([filedFact({ filed: null, years: [] })], "client_furnizor");
  assert.equal(lineOf(third, "bani").reason.ro, "ANAF nu a răspuns; de verificat la sursă");
  const missing = linesFor([]);
  assert.equal(missing.firm, "established");
  assert.equal(lineOf(missing, "bani").state, "neverificat");
  const fresh = linesFor([filedFact({ filed: false, years: [] })]);
  assert.equal(fresh.firm, "new");
  const dormant = linesFor([
    ...moneyFacts([{ year: 2025, turnover: 0, profitPretax: 0, profitNet: 0, expenses: 0 }], "x"),
    filedFact({ filed: true, years: [2025] }),
  ]);
  assert.deepEqual(
    [lineOf(dormant, "bani").state, lineOf(dormant, "bani").reason.ro],
    ["atentie", "fără activitate în bilanțul 2025"],
  );
  const zero = linesFor([
    ...moneyFacts(
      [{ year: 2025, turnover: 500_000, profitPretax: 1000, profitNet: 800, expenses: 499_000 }],
      "x",
    ),
    filedFact({ filed: true, years: [2025] }),
  ]);
  assert.equal(lineOf(zero, "bani").state, "atentie", "nothing left of 100 lei is not 'Bine'");
});

test("Risc: uncertain court matches are 'verifică la sursă'; struck-off firms are named as such", () => {
  const court = (id: string, value: number, score: number): Fact => ({
    id,
    section: "risk",
    predicate: id,
    value,
    display: { ro: String(value), en: String(value) },
    source: "courts",
    asOf: "2026-10-03",
    confidence: "probabil",
    score,
    method: "api",
    gdpr: "G0",
  });
  const checked: Fact = { ...court("risk.courts.checked", 1, 1), value: { checked: true } };
  const status = (value: string): Fact => ({
    ...court("identity.status", 0, 1),
    section: "identity",
    source: "anaf_v9",
    value,
  });
  const unsure = linesFor([checked, status("activ"), court("risk.courts.as_defendant", 2, 0.7)]);
  assert.deepEqual(
    [lineOf(unsure, "risc").state, lineOf(unsure, "risc").reason.ro],
    ["neverificat", "potrivire nesigură; verifică la sursă"],
  );
  const sure = linesFor([checked, status("activ"), court("risk.courts.as_defendant", 2, 0.95)]);
  assert.equal(lineOf(sure, "risc").state, "atentie");
  const clean = linesFor([checked, status("activ")]);
  assert.equal(lineOf(clean, "risc").state, "bine");
  assert.equal(lineOf(linesFor([status("radiat")]), "risc").reason.ro, "radiată din registru");
  assert.equal(lineOf(linesFor([status("inactiv")]), "risc").reason.ro, "inactivă la ANAF");
});

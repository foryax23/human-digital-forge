import assert from "node:assert/strict";
import { test } from "node:test";

import type { AreaLight, CompetitorCard, Fact } from "../../../src/lib/deep/contracts";
import { estimateArithmetic } from "../../../src/lib/deep/report/estimates";
import { HEADLINE_MAX } from "../../../src/lib/deep/report/headline";
import {
  buildReportParts,
  cleanCompanyName,
  dueDiligence,
  recomputeEstimates,
  rivalEdge,
} from "../../../src/lib/deep/report/index";
import { REASON_MAX } from "../../../src/lib/deep/report/lights";
import { vortexTotal } from "../../../src/lib/deep/report/prices";
import { prettyName } from "../../../src/lib/deep/steps/start.server";

import {
  band,
  courtsChecked,
  f,
  healthyYears,
  input,
  money,
  newFirm,
  site,
  status,
} from "./helpers";

/*
 * The fix wave's review findings, as tests: quote sectors, headline length, Bani without
 * similar firms, the trend headline, rivals that really do better, footnote arithmetic, the
 * new firm without lei, the third-party order and court row, and the registry name.
 */

const light = (lights: AreaLight[], area: AreaLight["area"]) =>
  lights.find((l) => l.area === area)!;
const parts = (facts: Fact[], opts: Parameters<typeof input>[1] = {}) =>
  buildReportParts(input(facts, opts));

test("quote sectors: the quote form is its own action and nothing names online booking", () => {
  for (const caen of ["4941", "4120", "4646", "6920"]) {
    const facts = [
      ...money(healthyYears(caen)),
      ...site("verified", {
        contact: true,
        booking: false,
        contact_form: false,
        cui: true,
        reg_no: true,
      }),
    ];
    const p = parts(facts, { caen2: caen });
    assert.ok(!p.actions.some((a) => a.id === "clients.online_booking"), caen);
    const text = [
      p.rulesBrief.headline.sentences[0].text,
      ...p.rulesBrief.meaning.sentences.map((s) => s.text),
    ].join(" ");
    assert.doesNotMatch(text, /programăril?e online/i, `${caen}: ${text}`);
    // Professional services value the form in time (often under 100 lei, then not shown);
    // the other quote sectors always list it, and the first step names it.
    if (caen === "6920") continue;
    assert.ok(
      p.actions.some((a) => a.id === "clients.quote_request"),
      `${caen}: a quote request action`,
    );
    assert.match(text, /Primul pas: un formular de cerere de ofertă pe site/, `${caen}: ${text}`);
    assert.ok(p.rulesBrief.headline.sentences[0].text.length <= HEADLINE_MAX, caen);
  }
});

test("headlines: every owner template fits two lines on a phone (≤ 70 characters)", () => {
  const cases: Fact[][] = [
    money(healthyYears()),
    [...money(healthyYears()), band("growth3y", { p25: 0, p50: 0.05, p75: 0.2, n: 30, you: 0.3 })],
    money(
      healthyYears().map((r, i) =>
        i === 0 ? { ...r, profitNet: -10_000, profitPretax: -10_000 } : r,
      ),
    ),
    money(healthyYears().map((r, i) => (i === 0 ? { ...r, profitPretax: 100_000 } : r))),
    money(healthyYears().map((r, i) => (i === 0 ? { ...r, turnover: 1_500_000 } : r))),
    newFirm(),
    [...money(healthyYears()), status("inactiv")],
  ];
  for (const facts of cases) {
    const text = parts(facts).rulesBrief.headline.sentences[0].text;
    assert.ok(text.length <= HEADLINE_MAX, `${text.length}: ${text}`);
    assert.doesNotMatch(text, /Iată unde mai poți câștiga/);
  }
});

test("Bani without similar firms: never Bine on the margin alone", () => {
  // Kept 17 of 100 in 2022, 10 in 2025: a warning, with the years in the reason.
  const falling = [
    { year: 2025, turnover: 2_000_000, profitPretax: 200_000, profitNet: 170_000 },
    { year: 2024, turnover: 1_800_000, profitPretax: 215_000, profitNet: 190_000 },
    { year: 2023, turnover: 1_600_000, profitPretax: 240_000, profitNet: 210_000 },
    { year: 2022, turnover: 1_400_000, profitPretax: 238_000, profitNet: 205_000 },
  ];
  const b1 = light(parts(money(falling)).lights, "bani");
  assert.equal(b1.state, "atentie");
  assert.equal(b1.reason.ro, "îți rămân 10 din 100, față de 17 în 2022");
  assert.ok(b1.reason.ro.length <= REASON_MAX);
  // A profit drop is said as such, not as the margin.
  const drop = healthyYears().map((r, i) => (i === 0 ? { ...r, profitPretax: 150_000 } : r));
  const b2 = light(parts(money(drop)).lights, "bani");
  assert.equal(b2.state, "atentie");
  assert.match(b2.reason.ro, /^profitul a scăzut cu \d+% față de 2024$/);
  // Steady: Bine, with a neutral reason and the note that no comparison exists yet.
  const steady = [2025, 2024, 2023, 2022].map((year) => ({
    year,
    turnover: 1_000_000,
    profitPretax: 70_000,
    profitNet: 60_000,
  }));
  const b3 = light(parts(money(steady)).lights, "bani");
  assert.equal(b3.state, "bine");
  assert.equal(b3.reason.ro, "profit în fiecare din ultimii 3 ani");
  assert.equal(b3.note?.ro, "fără comparație cu firme similare încă");
});

test("no 'no money problems' headline when turnover fell or expenses outgrew it", () => {
  const down = [
    {
      year: 2025,
      turnover: 1_930_000,
      profitPretax: 80_000,
      profitNet: 70_000,
      expenses: 1_850_000,
    },
    {
      year: 2024,
      turnover: 2_000_000,
      profitPretax: 82_000,
      profitNet: 71_000,
      expenses: 1_900_000,
    },
    {
      year: 2023,
      turnover: 1_650_000,
      profitPretax: 50_000,
      profitNet: 44_000,
      expenses: 1_500_000,
    },
    {
      year: 2022,
      turnover: 1_500_000,
      profitPretax: 45_000,
      profitNet: 40_000,
      expenses: 1_350_000,
    },
  ];
  const text = parts(money(down)).rulesBrief.headline.sentences[0].text;
  assert.doesNotMatch(text, /Nu am găsit probleme la bani/);
  assert.match(text, /^Cifra de afaceri a scăzut cu 3,5%, iar cheltuielile cresc mai repede\.$/);
});

test("rivals: what a rival does better is checked against the company's own facts", () => {
  const facts = [...money(healthyYears()), ...site("verified", { contact: true, booking: false })];
  const card = (over: Partial<CompetitorCard>): CompetitorCard => ({
    cui: "1",
    name: "Rival SRL",
    whyChosen: { ro: "", en: "" },
    origin: "official",
    factIds: [],
    ...over,
  });
  // Keeps 21 of 100 against our 15, books online where we don't: both said, with our value.
  const better = rivalEdge(
    card({ turnover: 1_000_000, profitPretax: 210_000, booking: true }),
    facts,
    "owner",
  );
  assert.match(better!.ro, /programare online pe site/);
  assert.match(better!.ro, /păstrează 21 de lei din 100 \(tu: 15\)/);
  // Grows more slowly and keeps less: it beats us on nothing, so nothing is listed.
  const worse = rivalEdge(
    card({ turnover: 1_000_000, turnoverPrev: 990_000, profitPretax: 50_000, booking: false }),
    facts,
    "owner",
  );
  assert.equal(worse, undefined);
  // Third parties read "(firma: …)", never "tu".
  assert.doesNotMatch(
    rivalEdge(card({ turnover: 1_000_000, profitPretax: 210_000 }), facts, "third_party")!.ro,
    /\btu\b/,
  );
});

test("footnotes: the arithmetic line recomputes from the numbers it prints", () => {
  const facts = [
    ...money(healthyYears()),
    ...site("verified", { contact: true, booking: false, cui: true, reg_no: true }),
  ];
  const p = parts(facts, { caen2: "8623" });
  const reminders = p.actions.find((a) => a.id === "clients.reminders")!.effect!;
  // Minutes print with one decimal (1,5, not "2"), so the reader's product matches.
  assert.ok(reminders.assumptions.some((a) => /câte 1,5 minute fiecare/.test(a.ro)));
  const valued = p.actions.filter((x) => x.effect && x.effect.value > 0);
  assert.ok(valued.length >= 1);
  for (const a of valued) {
    const line = estimateArithmetic(a.effect!)!.ro;
    const m = /= ([\d,]+) ore pe lună × (\d+) lei ≈ ([\d.]+) lei, rotunjit la ([\d.]+) lei/.exec(
      line,
    );
    assert.ok(m, line);
    const hours = Number(m![1].replace(",", "."));
    const hour = Number(m![2]);
    const shown = Number(m![3].replace(/\./g, ""));
    const rounded = Number(m![4].replace(/\./g, ""));
    assert.equal(shown, Math.round(hours * hour), line);
    assert.equal(rounded, a.effect!.value);
    assert.ok(Math.abs(shown - rounded) <= 10, line);
  }
});

test("a new firm gets no lei from sector defaults until the owner gives a volume", () => {
  const facts = [
    ...newFirm(),
    ...site("verified", { contact: true, booking: false, cui: true, reg_no: true }),
  ];
  const p = parts(facts, { caen2: "8623" });
  const reminders = p.actions.find((a) => a.id === "clients.reminders");
  assert.ok(reminders, "the action stays, without a value");
  assert.equal(reminders!.effect!.value, 0);
  assert.equal(p.counts.estimates, 0);
  assert.equal(p.totals.timeValueMonth, undefined);
  // The owner's own number gives the value back, and the footnote says it is theirs.
  const owned = recomputeEstimates(p.actions, { bookingsPerDay: 20 });
  const e = owned.actions.find((a) => a.id === "clients.reminders")!.effect!;
  assert.ok(e.value > 0);
  assert.ok(e.assumptions.some((a) => /\(cifra ta\)/.test(a.ro)));
});

test("third parties read the risk first; the court row says when nobody sued", () => {
  const facts = [
    ...money(healthyYears()),
    status("activ"),
    courtsChecked(),
    f("risk.courts.as_plaintiff", 2, { section: "risk", source: "courts" }),
    f("risk.courts.as_defendant", 0, { section: "risk", source: "courts" }),
  ];
  const p = parts(facts, { relationship: "client_furnizor" });
  assert.deepEqual(
    p.lights.map((l) => l.area),
    ["risc", "bani", "echipa", "online", "clienti"],
  );
  const courts = dueDiligence({ facts, registers: p.registers }).find((d) => d.id === "courts")!;
  assert.equal(courts.value.ro, "a deschis 2 procese; nu a fost dată în judecată");
});

test("one system is priced once; the Vortex Hub total counts it once", () => {
  const price = { setupLei: 1200, monthlyLei: 50 };
  const total = vortexTotal([
    { id: "clients.online_booking", cost: { vortex: price } },
    { id: "clients.reminders", cost: { vortex: price } },
    { id: "site.cookie_consent", cost: { vortex: { setupLei: 800, monthlyLei: 0 } } },
  ])!;
  assert.deepEqual(total.shared, [["clients.online_booking", "clients.reminders"]]);
  assert.equal(total.setupLei, 2000);
  assert.equal(total.monthlyLei, 50);
});

test("registry names read as people write them", () => {
  assert.equal(
    cleanCompanyName("Consilier Financiar Contabil si Fiscal,,Confiscalsrl"),
    "Consilier Financiar Contabil si Fiscal, Confiscal SRL",
  );
  assert.equal(cleanCompanyName("Casa Mimosa SRL"), "Casa Mimosa SRL");
  assert.match(
    prettyName("CONSILIER FINANCIAR CONTABIL SI FISCAL,,CONFISCALSRL"),
    /, Confiscal SRL$/,
  );
});

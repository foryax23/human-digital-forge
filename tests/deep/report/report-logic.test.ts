import assert from "node:assert/strict";
import { test } from "node:test";

import type { Action, AreaLight, Estimate, Fact } from "../../../src/lib/deep/contracts";
import { MIN_TIME_VALUE_MONTH } from "../../../src/lib/deep/report/actions";
import {
  buildTimeEstimates,
  FORMULA,
  marginGapEstimate,
  roundLei,
  timeEstimatesFor,
} from "../../../src/lib/deep/report/estimates";
import {
  HOURS_PER_MONTH,
  officeHourValue,
  WORKING_DAYS_PER_MONTH,
} from "../../../src/lib/deep/report/hourly";
import {
  applyCorrections,
  buildReportParts,
  dueDiligence,
  previewLights,
  recomputeEstimates,
} from "../../../src/lib/deep/report/index";
import { computeLights, REASON_MAX } from "../../../src/lib/deep/report/lights";
import { findBannedWords, TU_FORMS } from "../../../src/lib/deep/report/words";
import { vocabFor, vocabId } from "../../../src/lib/deep/vocab";
import { hourlyCostFor } from "../../../src/lib/scan/blueprint/economics";
import { getBusinessType } from "../../../src/lib/scan/blueprint/taxonomy";

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

const light = (lights: AreaLight[], area: AreaLight["area"]) =>
  lights.find((l) => l.area === area)!;
const parts = (facts: Fact[], opts: Parameters<typeof input>[1] = {}) =>
  buildReportParts(input(facts, opts));

/* ------------------------------------------------------------ hour value */

test("hour value: about 30 lei for office work in CAEN 86, 82, 43 and 49, and one calendar", () => {
  for (const caen of ["8623", "8211", "4321", "4941"]) {
    const h = officeHourValue(caen);
    assert.ok(h.value >= 28 && h.value <= 40, `${caen}: ${h.value}`);
    assert.match(
      h.assumption.ro,
      new RegExp(`presupunem ${h.value} lei/oră pentru munca de birou`),
    );
  }
  assert.equal(WORKING_DAYS_PER_MONTH, 21);
  assert.equal(HOURS_PER_MONTH, 168);
  // 4.325 × 1,2 × 1,0225 ÷ 168 = 31,59 → 32 lei.
  assert.equal(officeHourValue("8623").value, 32);
  // A sector paid below 1.2 × the minimum wage caps it (beauty, division 96).
  const beauty = officeHourValue("9602");
  assert.equal(beauty.cappedByDivision, "96");
  assert.ok(beauty.value < 32 && beauty.value >= 28);
});

test("the quick scan and deep research show the same hour value for the same company", () => {
  const type = getBusinessType("dental-clinic");
  for (const caen of ["8623", "9602", "4941", undefined]) {
    const quick = hourlyCostFor(caen, type).hourlyCostRon;
    const deep = officeHourValue(caen ?? type.wageDivision).value;
    assert.equal(quick, deep, `CAEN ${caen}`);
  }
});

/* ------------------------------------------------------------- estimates */

test("time estimates: overlap and the 20% cap; values equal the shown parts", () => {
  const big = { bookingsPerDay: 400, hourValue: 32, roleHours: 168 };
  const [booking, reminders] = buildTimeEstimates([
    {
      formulaId: FORMULA.booking,
      inputs: {
        ...big,
        phoneShare: 1,
        minutesPerBooking: 5,
        onlineShareLow: 0.5,
        onlineShare: 0.6,
        onlineShareHigh: 0.7,
      },
      assumptions: [],
      factIds: [],
    },
    {
      formulaId: FORMULA.reminders,
      inputs: {
        ...big,
        minutesPerReminder: 2,
        reminderShareLow: 0.5,
        reminderShare: 0.6,
        reminderShareHigh: 0.7,
      },
      assumptions: [],
      factIds: [],
    },
  ]);
  // Capped at 20% of one person's 168 hours: 33.6 hours in all.
  assert.ok((booking.hours ?? 0) + (reminders.hours ?? 0) <= 33.6 + 0.1);
  assert.equal(
    booking.value + reminders.value,
    roundLei((booking.hours! + reminders.hours!) * 32, "time_value_month") ||
      booking.value + reminders.value,
  );
  for (const e of [booking, reminders])
    assert.ok(e.low <= e.value && e.value <= e.high, JSON.stringify(e));
  // Reminders are applied on the hours booking left: they cannot exceed the cap's remainder.
  assert.ok(reminders.value <= booking.value + 1);
});

test("booking estimate from sector defaults: hours × hour value, with its assumptions shown", () => {
  const e = timeEstimatesFor([FORMULA.booking], { vocab: "health", caen: "8623", factIds: ["x"] })[
    FORMULA.booking
  ];
  // 25 a day × 21 days × 70% by phone × 3 min × 30% online = 5,5 h → × 32 lei = 176 → 180 lei.
  assert.equal(e.hours, 5.5);
  assert.equal(e.value, 180);
  assert.ok(e.low < e.value && e.value < e.high);
  assert.ok(e.assumptions.some((a) => a.ro === "presupunem 32 lei/oră pentru munca de birou"));
  assert.ok(e.assumptions.some((a) => a.ro.includes("presupunem ~25 de programări pe zi")));
  // The owner's own numbers replace the defaults and say so.
  const own = timeEstimatesFor([FORMULA.booking], {
    vocab: "health",
    caen: "8623",
    factIds: ["x"],
    clientsPerMonth: 1050,
    hourValue: 40,
  })[FORMULA.booking];
  assert.equal(own.inputs.bookingsPerDay, 50);
  assert.equal(own.inputs.hourValue, 40);
  assert.ok(own.assumptions.some((a) => a.ro.includes("cifra ta")));
});

test("margin gap: (typical − own) × turnover, only below the lower quarter, never negative", () => {
  const e = marginGapEstimate({
    turnover: 4_000_000,
    marginOwn: 0.04,
    marginP25: 0.08,
    marginP50: 0.12,
    n: 37,
    scope: { ro: "județul Timiș", en: "Timiș county" },
    year: 2025,
    ownerTurnover: false,
    factIds: ["a"],
  })!;
  assert.equal(e.kind, "profit_year_pretax");
  assert.equal(e.value, 320_000); // (0,12 − 0,04) × 4.000.000
  assert.equal(e.low, 160_000); // (0,08 − 0,04) × 4.000.000
  assert.ok(e.low <= e.value && e.value <= e.high);
  assert.equal(
    marginGapEstimate({
      turnover: 4_000_000,
      marginOwn: 0.09,
      marginP25: 0.08,
      marginP50: 0.12,
      n: 37,
      scope: { ro: "x", en: "x" },
      year: 2025,
      ownerTurnover: false,
      factIds: [],
    }),
    null,
  );
});

test("recompute: the Ajustează panel reruns the same arithmetic and the totals follow", () => {
  const facts = [
    ...money(healthyYears("8623")),
    ...site("verified", { contact: true, booking: false, cui: true, reg_no: true }),
  ];
  const p = parts(facts, { caen2: "8623" });
  const booking = p.actions.find((a) => a.id === "clients.online_booking")!;
  assert.ok(booking.effect, "booking has an estimate");
  const again = recomputeEstimates(p.actions, { bookingsPerDay: 50 });
  const b2 = again.actions.find((a) => a.id === "clients.online_booking")!.effect!;
  assert.ok(b2.value > booking.effect!.value);
  // Footnote arithmetic: hours × hour value, rounded to 10 lei.
  assert.equal(b2.value, roundLei(b2.hours! * b2.inputs.hourValue, "time_value_month"));
  const timeSum = again.actions
    .filter((a) => a.effect?.kind === "time_value_month")
    .reduce((n, a) => n + a.effect!.value, 0);
  assert.equal(again.totals.timeValueMonth?.value, timeSum);
});

/* -------------------------------------------------------------- the lines */

test("Bani: loss → De rezolvat; below the lower quarter and falling → De rezolvat; below typical → Atenție", () => {
  const loss = money([
    {
      year: 2025,
      turnover: 1_000_000,
      profitPretax: -50_000,
      profitNet: -60_000,
      expenses: 1_050_000,
      employees: 5,
    },
    {
      year: 2024,
      turnover: 1_100_000,
      profitPretax: 20_000,
      profitNet: 15_000,
      expenses: 1_080_000,
      employees: 5,
    },
  ]);
  assert.equal(
    light(computeLights(loss, { vocab: "generic", audience: "owner" }), "bani").state,
    "de_rezolvat",
  );

  const falling = [
    ...money([
      { year: 2025, turnover: 1_000_000, profitPretax: 30_000, profitNet: 25_000, employees: 5 },
      { year: 2024, turnover: 1_000_000, profitPretax: 50_000, profitNet: 40_000, employees: 5 },
      { year: 2023, turnover: 1_000_000, profitPretax: 70_000, profitNet: 60_000, employees: 5 },
    ]),
    band("marginPretax", { p25: 0.05, p50: 0.1, p75: 0.15, n: 30, you: 0.03 }),
  ];
  const fl = light(computeLights(falling, { vocab: "generic", audience: "owner" }), "bani");
  assert.equal(fl.state, "de_rezolvat");
  assert.equal(fl.reason.ro, "îți rămân 3 lei din 100");

  const below = [
    ...money([
      { year: 2025, turnover: 1_000_000, profitPretax: 80_000, profitNet: 70_000, employees: 5 },
      { year: 2024, turnover: 900_000, profitPretax: 70_000, profitNet: 60_000, employees: 5 },
    ]),
    band("marginPretax", { p25: 0.05, p50: 0.1, p75: 0.15, n: 30, you: 0.08 }),
  ];
  assert.equal(
    light(computeLights(below, { vocab: "generic", audience: "owner" }), "bani").state,
    "atentie",
  );

  const good = money(healthyYears());
  assert.equal(
    light(computeLights(good, { vocab: "generic", audience: "owner" }), "bani").state,
    "bine",
  );
  assert.equal(
    light(computeLights(newFirm(), { vocab: "generic", audience: "owner" }), "bani").state,
    "neverificat",
  );
});

test("Online: no site found → Atenție; parked → De rezolvat; missing CUI → Atenție; blocked → Neverificat", () => {
  const L = (facts: Fact[]) =>
    light(computeLights(facts, { vocab: "generic", audience: "owner" }), "online");
  assert.equal(L(site("none")).state, "atentie");
  assert.equal(L(site("none")).reason.ro, "nu am găsit un site al firmei");
  assert.equal(L(site("parked")).state, "de_rezolvat");
  assert.equal(L(site("broken_certificate")).state, "de_rezolvat");
  // The J number alone does not satisfy the law: the CUI must be there too.
  assert.equal(L(site("verified", { cui: false, reg_no: true })).state, "atentie");
  assert.equal(L(site("verified", { cui: true, reg_no: true })).state, "bine");
  assert.equal(L(site("blocked")).state, "neverificat");
});

test("Clienți: renamed by sector; booking not found where expected → Atenție, worded as an observation", () => {
  const facts = site("verified", { contact: true, booking: false });
  const health = light(computeLights(facts, { vocab: "health", audience: "owner" }), "clienti");
  assert.equal(health.label.ro, "Pacienți");
  assert.equal(health.state, "atentie");
  assert.match(health.reason.ro, /^nu am găsit/);
  // A quote-request sector is satisfied by a contact form.
  const quote = light(
    computeLights(site("verified", { contact: true, booking: false, contact_form: true }), {
      vocab: "construction",
      audience: "owner",
    }),
    "clienti",
  );
  assert.equal(quote.state, "bine");
  assert.equal(
    light(
      computeLights(site("verified", { contact: false }), { vocab: "generic", audience: "owner" }),
      "clienti",
    ).state,
    "de_rezolvat",
  );
  assert.equal(
    light(computeLights(site("none"), { vocab: "generic", audience: "owner" }), "clienti").state,
    "neverificat",
  );
});

test("Echipă: hiring is never a warning; a real drop is", () => {
  const hiring = [...money(healthyYears()), f("people.hiring", true, { section: "people" })];
  const h = light(computeLights(hiring, { vocab: "generic", audience: "owner" }), "echipa");
  assert.equal(h.state, "bine");
  assert.equal(h.reason.ro, "angajezi");
  const drop = money([
    { year: 2025, turnover: 1_000_000, profitPretax: 50_000, profitNet: 40_000, employees: 8 },
    { year: 2024, turnover: 1_000_000, profitPretax: 50_000, profitNet: 40_000, employees: 40 },
  ]);
  assert.equal(
    light(computeLights(drop, { vocab: "generic", audience: "owner" }), "echipa").state,
    "atentie",
  );
  // 3 → 2 people is not a trend.
  const tiny = money([
    { year: 2025, turnover: 1_000_000, profitPretax: 50_000, profitNet: 40_000, employees: 2 },
    { year: 2024, turnover: 1_000_000, profitPretax: 50_000, profitNet: 40_000, employees: 3 },
  ]);
  assert.equal(
    light(computeLights(tiny, { vocab: "generic", audience: "owner" }), "echipa").state,
    "bine",
  );
});

test("Risc: inactive → De rezolvat; defendant ≥ 0.9 → Atenție; weak match → Neverificat; creditor-only → Bine", () => {
  const R = (facts: Fact[]) =>
    light(computeLights(facts, { vocab: "generic", audience: "owner" }), "risc");
  assert.equal(R([status("inactiv")]).state, "de_rezolvat");
  assert.equal(R([status("radiat")]).reason.ro, "radiată din registru");
  const defendant = (score: number) => f("risk.courts.as_defendant", 2, { section: "risk", score });
  assert.equal(R([status("activ"), courtsChecked(), defendant(0.95)]).state, "atentie");
  assert.equal(R([status("activ"), courtsChecked(), defendant(0.6)]).state, "neverificat");
  const creditor = f("risk.courts.as_creditor", 3, { section: "risk", score: 1 });
  const ok = R([status("activ"), courtsChecked(), creditor]);
  assert.equal(ok.state, "bine");
  assert.equal(ok.reason.ro, "fără semnale în ce am verificat");
  assert.equal(R([status("activ")]).state, "neverificat");
});

test("every line reason fits on one row (≤ 40 characters) in both languages and audiences", () => {
  const scenarios: Fact[][] = [
    money(healthyYears()),
    newFirm(),
    [
      ...money(healthyYears()),
      ...site("verified", { contact: true, booking: false, cui: false, reg_no: false }),
    ],
    [...site("parked"), status("inactiv")],
    [
      ...site("broken_certificate"),
      status("activ"),
      courtsChecked(),
      f("risk.courts.as_defendant", 12, { section: "risk", score: 0.95 }),
    ],
    [f("money.filed", { filed: null, years: [] }, { section: "money" }), ...site("blocked")],
  ];
  for (const facts of scenarios)
    for (const vocab of ["health", "auto", "construction", "generic"] as const)
      for (const audience of ["owner", "third_party"] as const)
        for (const l of computeLights(facts, { vocab, audience })) {
          assert.ok(l.reason.ro.length <= REASON_MAX, `${l.area}: ${l.reason.ro}`);
          assert.ok(l.reason.en.length <= REASON_MAX, `${l.area}: ${l.reason.en}`);
        }
});

/* --------------------------------------------------- headline and report */

test("the headline comes from Bani or Risc first and never contradicts the lines", () => {
  const cases: Fact[][] = [
    money(healthyYears()),
    [...money(healthyYears()), status("inactiv")],
    money([
      { year: 2025, turnover: 1_000_000, profitPretax: -50_000, profitNet: -60_000, employees: 5 },
      { year: 2024, turnover: 1_100_000, profitPretax: 20_000, profitNet: 15_000, employees: 5 },
    ]),
    newFirm(),
    [
      ...money(healthyYears()),
      status("activ"),
      courtsChecked(),
      f("risk.courts.as_defendant", 1, { section: "risk", score: 0.95 }),
    ],
  ];
  for (const facts of cases) {
    const p = parts(facts);
    const area = p.headlineKey.split(".")[0];
    const bani = light(p.lights, "bani");
    const risc = light(p.lights, "risc");
    const problem = [bani, risc].filter((l) => l.state === "de_rezolvat" || l.state === "atentie");
    if (problem.length) {
      assert.ok(area === "bani" || area === "risc", `${p.headlineKey} with a problem line`);
      assert.notEqual(light(p.lights, area as "bani" | "risc").state, "bine");
    } else {
      assert.ok(area !== "bani" && area !== "risc", `${p.headlineKey} with clean lines`);
    }
  }
  assert.equal(parts([...money(healthyYears()), status("inactiv")]).headlineKey, "risc.inactive");
  assert.equal(parts(newFirm()).headlineKey, "new_firm");
});

test("new firm: firm 'new', Bani Neverificat, headline about the missing accounts", () => {
  const p = parts([...newFirm(), ...site("verified", { contact: true, cui: true, reg_no: true })]);
  assert.equal(p.firm, "new");
  assert.equal(light(p.lights, "bani").state, "neverificat");
  assert.match(p.rulesBrief.headline.sentences[0].text, /Încă nu ai bilanț depus/);
});

test("actions: legal must-dos first and outside the three; ranked by value; one done alone", () => {
  const facts = [
    ...money(healthyYears("8623")),
    ...site("verified", { contact: true, booking: false, cui: false, reg_no: true, google: false }),
    f("site.consent.before_analytics", true, {
      section: "site",
      confidence: "probabil",
      score: 0.7,
    }),
  ];
  const p = parts(facts, { caen2: "8623" });
  const mandatory = p.actions.filter((a) => a.mandatory);
  assert.deepEqual(
    mandatory.map((a) => a.id),
    ["legal.company_details"],
  );
  assert.equal(p.actions[0].mandatory, true);
  const ranked = p.actions.filter((a) => !a.mandatory);
  assert.ok(ranked.length <= 3);
  assert.deepEqual(
    ranked.map((a) => a.rank),
    ranked.map((_, i) => i + 1),
  );
  // Valued actions come before text-only ones.
  const firstText = ranked.findIndex((a) => !a.effect);
  if (firstText >= 0) assert.ok(ranked.slice(firstText).every((a) => !a.effect));
  assert.ok(
    ranked.some((a) => a.who === "singur" || a.who === "contabil"),
    "one action done alone",
  );
  // Costs come from the price table.
  for (const a of p.actions)
    assert.ok(a.cost.diyHours !== undefined || a.cost.vortex !== undefined, a.id);
});

test("totals: one line per kind of money, equal to the shown parts, never added across kinds", () => {
  const facts = [
    ...money([
      { year: 2025, turnover: 3_000_000, profitPretax: 60_000, profitNet: 50_000, employees: 10 },
      { year: 2024, turnover: 2_800_000, profitPretax: 70_000, profitNet: 60_000, employees: 10 },
    ]),
    band("marginPretax", { p25: 0.06, p50: 0.1, p75: 0.15, n: 25, you: 0.02 }),
    ...site("verified", { contact: true, booking: false, cui: true, reg_no: true }),
  ];
  const p = parts(facts, {
    caen2: "8623",
    peers: {
      n: 25,
      scope: "judet",
      scopeLabel: { ro: "județul Timiș", en: "Timiș county" },
      year: 2025,
      sizeBand: [1e6, 9e6],
      bands: {},
    },
  });
  const effects = p.actions.map((a) => a.effect).filter((e): e is Estimate => Boolean(e));
  const kinds = new Set(effects.map((e) => e.kind));
  assert.ok(
    kinds.has("profit_year_pretax") && kinds.has("time_value_month"),
    JSON.stringify([...kinds]),
  );
  const sum = (kind: Estimate["kind"]) =>
    effects.filter((e) => e.kind === kind).reduce((n, e) => n + e.value, 0);
  assert.equal(p.totals.timeValueMonth!.value, sum("time_value_month"));
  assert.equal(p.totals.profitYearPretax!.value, sum("profit_year_pretax"));
  for (const t of [p.totals.timeValueMonth!, p.totals.profitYearPretax!])
    assert.ok(t.low <= t.value && t.value <= t.high);
  // Small time values do not take an action slot.
  for (const e of effects)
    if (e.kind === "time_value_month") assert.ok(e.value >= MIN_TIME_VALUE_MONTH);
});

test("margin gap in the panel: a new turnover reruns (typical − own) × turnover and keeps the scope", () => {
  const facts = [
    ...money([
      { year: 2025, turnover: 3_000_000, profitPretax: 60_000, profitNet: 50_000, employees: 10 },
      { year: 2024, turnover: 2_800_000, profitPretax: 70_000, profitNet: 60_000, employees: 10 },
    ]),
    band("marginPretax", { p25: 0.06, p50: 0.1, p75: 0.15, n: 25, you: 0.02 }),
  ];
  const p = parts(facts, {
    peers: {
      n: 25,
      scope: "judet",
      scopeLabel: { ro: "județul Timiș", en: "Timiș county" },
      year: 2025,
      sizeBand: [1e6, 9e6],
      bands: {},
    },
  });
  const gap = p.actions.find((a) => a.id === "money.margin_gap")!;
  assert.equal(gap.effect!.value, 240_000); // (0,10 − 0,02) × 3.000.000
  assert.match(gap.effect!.assumptions[0].ro, /25 de firme, județul Timiș/);
  const again = recomputeEstimates(p.actions, { turnover: 4_000_000 });
  const e = again.actions.find((a) => a.id === "money.margin_gap")!.effect!;
  assert.equal(e.value, 320_000);
  assert.match(e.assumptions[0].ro, /județul Timiș/);
  assert.equal(again.totals.profitYearPretax!.value, 320_000);
});

test("days to collect: a comparison only, never a lei figure", () => {
  const facts = [
    ...money(healthyYears()),
    band("daysToCollect", { p25: 30, p50: 45, p75: 60, n: 25, you: 120 }, "estimare"),
  ];
  const p = parts(facts);
  const collect = p.actions.find((a) => a.id === "money.collect_faster")!;
  assert.ok(collect);
  assert.equal(collect.effect, undefined);
  assert.match(collect.why.ro, /mai încet decât majoritatea/);
  // "De ce contează" states the gain, not the problem again.
  assert.match(collect.comparison!.ro, /mai repede în cont/);
});

test("counts equal the lists the reader can open", () => {
  const facts = [
    ...money(healthyYears()),
    ...site("verified", { contact: true, booking: false, cui: true, reg_no: true }),
    f("x.ephemeral", 1, { section: "presence" }),
  ];
  facts[facts.length - 1] = { ...facts[facts.length - 1], ephemeral: true };
  const p = parts(facts, { caen2: "8623" });
  const shown = facts.filter((x) => !x.ephemeral);
  assert.equal(p.counts.facts, shown.length);
  assert.equal(p.counts.pagesRead, 12);
  assert.equal(
    p.counts.estimates,
    p.actions.filter((a) => a.effect && a.effect.value > 0).length +
      shown.filter((x) => x.confidence === "estimare").length,
  );
  assert.equal(
    p.counts.officialSources,
    new Set(
      shown
        .map((x) => x.source)
        .filter((s) => ["anaf_v9", "anaf_bilant", "mf_bulk", "onrc", "courts", "ted"].includes(s)),
    ).size,
  );
});

test("third parties: third-person wording, no actions, a due-diligence block instead", () => {
  const facts = [
    ...money(healthyYears()),
    ...site("verified", { contact: true, booking: false, cui: false, reg_no: false }),
    status("activ"),
    courtsChecked(),
  ];
  for (const relationship of ["client_furnizor", "concurent", "altceva"] as const) {
    const p = parts(facts, { relationship, caen2: "8623" });
    assert.equal(p.audience, "third_party");
    assert.equal(p.actions.length, 0);
    const brief = p.rulesBrief;
    const sentences = [
      brief.headline,
      brief.meaning,
      brief.customerView,
      ...brief.findings,
    ].flatMap((s) => s.sentences.map((x) => x.text));
    for (const s of [...sentences, ...p.lights.map((l) => l.reason.ro)])
      assert.ok(!TU_FORMS.test(s), `tu form: ${s}`);
    const dd = dueDiligence({ facts, registers: p.registers });
    assert.ok(dd.some((d) => d.id === "status"));
    assert.ok(dd.some((d) => d.link === "https://www.anaf.ro/restante/"));
  }
});

test("no banned words in the rules templates, actions and lines", () => {
  const scenarios: Fact[][] = [
    money(healthyYears()),
    newFirm(),
    [
      ...money(healthyYears()),
      ...site("verified", {
        contact: true,
        booking: false,
        cui: false,
        reg_no: false,
        google: false,
      }),
    ],
    [...site("parked"), status("inactiv")],
  ];
  for (const facts of scenarios)
    for (const relationship of ["proprietar", "client_furnizor"] as const)
      for (const lang of ["ro", "en"] as const) {
        const p = parts(facts, { relationship, lang, caen2: "8623" });
        const text = [
          ...p.lights.map((l) => l.reason.ro),
          ...p.findings.map((x) => x.sentence.ro),
          ...p.actions.flatMap((a) => [a.title.ro, a.why.ro, a.comparison?.ro ?? ""]),
          ...[
            p.rulesBrief.headline,
            p.rulesBrief.meaning,
            p.rulesBrief.customerView,
            p.rulesBrief.rivals,
            ...p.rulesBrief.findings,
          ].flatMap((s) => s.sentences.map((x) => x.text)),
        ].join("\n");
        assert.deepEqual(findBannedWords(text), [], text);
      }
  assert.deepEqual(findBannedWords("Rezultat garantat cu noi"), ["garantat", "cu noi"]);
});

test("rules brief: every sentence cites facts that exist, except honest gaps", () => {
  const facts = [
    ...money(healthyYears()),
    ...site("verified", { contact: true, booking: false, cui: true, reg_no: true }),
  ];
  const p = parts(facts, {
    caen2: "8623",
    gaps: [
      {
        section: "peers",
        what: { ro: "Comparația", en: "Comparison" },
        where: {
          ro: "Comparația apare după ce încărcăm bilanțurile Ministerului Finanțelor",
          en: "x",
        },
        at: "2026-10-03",
      },
    ],
  });
  const ids = new Set(facts.map((x) => x.id));
  const b = p.rulesBrief;
  for (const s of [b.headline, b.meaning, b.customerView, ...b.findings].flatMap(
    (x) => x.sentences,
  )) {
    assert.ok(s.factIds.length > 0, `uncited: ${s.text}`);
    for (const id of s.factIds) assert.ok(ids.has(id), `missing fact ${id}`);
  }
  assert.match(b.rivals.sentences[0].text, /^Comparația cu firme similare nu e încă gata/);
  assert.ok(b.headline.sentences.every((s) => s.text.split(/\s+/).length <= 40));
  assert.ok(b.meaning.sentences.reduce((n, s) => n + s.text.split(/\s+/).length, 0) <= 60);
});

test("'Dacă nu faci nimic' only after three years moving the same way, never below zero", () => {
  const p = parts(money(healthyYears()));
  assert.ok(p.rulesBrief.ifNothing);
  assert.match(p.rulesBrief.ifNothing!.sentences[0].text, /^Dacă tendința din 2023–2025 continuă/);
  const flat = parts(
    money([
      { year: 2025, turnover: 1_000_000, profitPretax: 1, profitNet: 1 },
      { year: 2024, turnover: 1_200_000, profitPretax: 1, profitNet: 1 },
      { year: 2023, turnover: 900_000, profitPretax: 1, profitNet: 1 },
    ]),
  );
  assert.equal(flat.rulesBrief.ifNothing, undefined);
  const collapsing = parts(
    money([
      { year: 2025, turnover: 100_000, profitPretax: 1, profitNet: 1 },
      { year: 2024, turnover: 400_000, profitPretax: 1, profitNet: 1 },
      { year: 2023, turnover: 2_000_000, profitPretax: 1, profitNet: 1 },
    ]),
  );
  assert.ok(!/-\d/.test(collapsing.rulesBrief.ifNothing!.sentences[0].text));
});

test("corrections recompute the lines and actions at once and hide the AI sentences citing the fact", () => {
  const facts = [
    ...money(healthyYears("8623")),
    ...site("verified", { contact: true, booking: false, cui: true, reg_no: true }),
  ];
  const p = parts(facts, { caen2: "8623" });
  assert.ok(p.actions.some((a) => a.id === "clients.online_booking"));
  const report = {
    schema: 1 as const,
    runId: "r",
    cui: "9259999",
    lang: "ro" as const,
    relationship: "proprietar" as const,
    audience: p.audience,
    firm: p.firm,
    generatedAt: "2026-10-03T10:00:00Z",
    aiMode: "ai" as const,
    company: input(facts, { caen2: "8623" }).company,
    facts,
    gaps: [],
    sources: [],
    registers: p.registers,
    lights: p.lights,
    findings: p.findings,
    actions: p.actions,
    totals: p.totals,
    brief: {
      ...p.rulesBrief,
      customerView: {
        source: "ai" as const,
        sentences: [
          {
            text: "Nu am găsit programare online pe cele 12 pagini citite.",
            factIds: ["site.booking.present"],
          },
          { text: "Contactul e ușor de găsit.", factIds: ["site.contact.present"] },
        ],
      },
    },
    competitors: [],
    counts: p.counts,
    vocab: p.vocab,
  };
  const fixed = applyCorrections(
    report,
    [{ predicate: "site.booking.present", url: "https://exemplu.ro/programari" }],
    "2026-10-03",
  );
  assert.ok(!fixed.actions.some((a) => a.id === "clients.online_booking"));
  assert.equal(light(fixed.lights, "clienti").state, "bine");
  const hidden = fixed.brief.customerView.sentences.find((s) =>
    s.factIds.includes("site.booking.present"),
  )!;
  assert.equal(hidden.hiddenBy, "site.booking.present");
  assert.equal(
    fixed.brief.customerView.sentences.find((s) => s.factIds.includes("site.contact.present"))!
      .hiddenBy,
    undefined,
  );
  const declared = fixed.facts.find((x) => x.id === "site.booking.present")!;
  assert.equal(declared.confidence, "declarat");
  // The totals follow the actions shown.
  const timeSum = fixed.actions
    .filter((a: Action) => a.effect?.kind === "time_value_month")
    .reduce((n, a) => n + a.effect!.value, 0);
  assert.equal(fixed.totals.timeValueMonth?.value ?? 0, timeSum);
});

test("provisional lines while running, and the sector vocabulary by CAEN division", () => {
  const lights = previewLights([...money(healthyYears("8623"))]);
  assert.ok(lights.every((l) => l.provisional === true));
  assert.equal(lights.find((l) => l.area === "clienti")!.label.ro, "Pacienți");
  assert.equal(vocabId("8623"), "health");
  assert.equal(vocabFor("5510").words.line.ro, "Oaspeți");
  assert.equal(vocabId("4646"), "b2b_wholesale");
  assert.equal(vocabId("1071"), "manufacturing");
  assert.equal(vocabId("4520"), "auto");
  assert.equal(vocabId("4321"), "construction");
  assert.equal(vocabId("4941"), "transport");
  assert.equal(vocabId("6201"), "it");
  assert.equal(vocabId("6920"), "professional");
  assert.equal(vocabId("9602"), "beauty");
  assert.equal(vocabId("0111"), "generic");
  assert.equal(vocabId(undefined), "generic");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  caenRev3ToRev2,
  cleanLocality,
  findCompanyIdsInText,
  isNaturalPersonEntity,
  isResidentialAddress,
  isValidCui,
  naturalPersonForm,
  normalizeRegNo,
  parseAnafV9,
  parseBilant,
  publicSeat,
  regNoVariants,
  textProvesCompany,
} from "../../../src/lib/deep/parse/registry";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../fixtures/deep/${name}`, import.meta.url), "utf8"));
const v9 = fixture("anaf-v9.json").records as Record<string, unknown>;
const bilant = fixture("bilant.json");

test("CUI checksum: valid, invalid, RO prefix", () => {
  for (const cui of ["54747928", "9259999", "1094992", "RO 3365133", "ro8643290"]) {
    assert.equal(isValidCui(cui), true, cui);
  }
  assert.equal(isValidCui("54747927"), false);
  assert.equal(isValidCui("1"), false);
  assert.equal(isValidCui("12345678901"), false);
});

test("J numbers: legacy and 2024 formats compare equal", () => {
  const fresh = normalizeRegNo("J1993000151025")!;
  const legacy = normalizeRegNo("J02/151/1993")!;
  const spaced = normalizeRegNo("J 2 / 151 / 1993")!;
  assert.equal(fresh.key, legacy.key);
  assert.equal(spaced.key, legacy.key);
  assert.equal(fresh.legacy, "J02/151/1993");
  assert.equal(fresh.canonical, "J1993000151025");
  // National numbers issued after the reform have no legacy form.
  assert.equal(normalizeRegNo("J2026033767000")!.legacy, undefined);
  assert.equal(normalizeRegNo("not a number"), null);
  const variants = regNoVariants("J1993000151025");
  assert.ok(variants.includes("J02/151/1993"));
  assert.ok(variants.includes("J2/151/1993"));
});

test("company identifiers in footer text", () => {
  const text =
    "© 2026 Expres Transport SRL · CUI: RO3365133 · Nr. Reg. Com. J02/151/1993 · Telefon 0257 000 000";
  const ids = findCompanyIdsInText(text);
  assert.deepEqual(ids.cuis, ["3365133"]);
  assert.equal(ids.regNos.length, 1);
  assert.deepEqual(textProvesCompany(text, { cui: "3365133", regNo: "J1993000151025" }), {
    cui: true,
    regNo: true,
  });
  const vortex = "VORTEX HUB S.R.L. · J2026033767000 · Timișoara";
  assert.deepEqual(textProvesCompany(vortex, { cui: "54747928", regNo: "J2026033767000" }), {
    cui: false,
    regNo: true,
  });
  // A checksum-invalid number next to "CUI" is not an identifier.
  assert.deepEqual(findCompanyIdsInText("CUI 12345678").cuis, []);
});

test("natural-person forms are guarded", () => {
  assert.equal(isNaturalPersonEntity({ legalForm: "PERSOANA FIZICA AUTORIZATA" }), true);
  assert.equal(isNaturalPersonEntity({ legalForm: "INTREPRINDERE INDIVIDUALA" }), true);
  assert.equal(isNaturalPersonEntity({ legalForm: "ÎNTREPRINDERE FAMILIALĂ" }), true);
  assert.equal(isNaturalPersonEntity({ name: "POPESCU ION PFA" }), true);
  assert.equal(isNaturalPersonEntity({ name: "X", regNo: "F35/123/2010" }), true);
  assert.equal(
    isNaturalPersonEntity({
      name: "LIBRIS SRL",
      legalForm: "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ",
    }),
    false,
  );
  assert.equal(naturalPersonForm({ name: "POPESCU ION PFA" }), "Persoană fizică autorizată (PFA)");
  assert.equal(
    naturalPersonForm({ legalForm: "INTREPRINDERE FAMILIALA" }),
    "Întreprindere familială (IF)",
  );
});

test("flats: apartment-block markers", () => {
  assert.equal(isResidentialAddress("STR. ARMONIEI, NR.23A, AP.B1"), true);
  assert.equal(isResidentialAddress("BL. 4, SC. A, ET. 2"), true);
  assert.equal(isResidentialAddress("Str. Apusului nr. 3"), false);
  assert.equal(isResidentialAddress("Bld. Revoluției 5"), false);
});

test("ANAF v9: identity, status, seat in a flat shows the town only", () => {
  const expres = parseAnafV9(v9["3365133"]);
  assert.equal(expres.name, "EXPRES TRANSPORT SRL");
  assert.equal(expres.regNo, "J1993000151025");
  assert.equal(expres.caen, "4941");
  assert.equal(expres.status, "activ");
  assert.equal(expres.vatPayer, true);
  assert.equal(expres.naturalPerson, false);
  assert.equal(cleanLocality(expres.seat.locality), "Pecica");
  assert.deepEqual(publicSeat(expres), {
    city: "Pecica",
    county: "Arad",
    street: "Str. 203 nr. 19",
    flat: false,
  });

  const vortex = parseAnafV9(v9["54747928"]);
  const seat = publicSeat(vortex);
  assert.equal(seat.flat, true);
  assert.equal(seat.street, undefined);
  assert.equal(seat.city, "Timișoara");

  const confiscal = publicSeat(parseAnafV9(v9["8643290"]));
  assert.equal(confiscal.flat, true);

  const radiated = parseAnafV9({
    date_generale: { cui: 1, denumire: "X SRL", stare_inregistrare: "RADIERE din data 29.03.2002" },
  });
  assert.equal(radiated.status, "radiat");
  const inactive = parseAnafV9({
    date_generale: { cui: 1, denumire: "X SRL" },
    stare_inactiv: { statusInactivi: true },
  });
  assert.equal(inactive.status, "inactiv");
});

test("bilanț: labels, pre-tax and net result, missing years, losses", () => {
  const y = parseBilant(bilant.expres2025)!;
  assert.equal(y.year, 2025);
  assert.equal(y.caen2, "4941");
  assert.equal(y.turnover, 13000841);
  assert.equal(y.expenses, 12259815);
  assert.equal(y.profitPretax, 1276425);
  assert.equal(y.profitNet, 1108356);
  assert.equal(y.employees, 25);
  assert.equal(y.receivables, 2448083);
  assert.equal(y.debts, 2871449);
  assert.equal(y.equity, 3771774);
  assert.equal(parseBilant(bilant.empty), null);
  const loss = parseBilant(bilant.loss)!;
  assert.equal(loss.profitPretax, -95000);
  assert.equal(loss.profitNet, -100000);
  assert.equal(loss.employees, undefined);
});

test("CAEN Rev.3 → Rev.2 for the trial's mismatches", () => {
  const map = { "5611": ["5610"], "4763": ["4764"], "7112": ["7112"], "4752": ["4752"] };
  assert.deepEqual(caenRev3ToRev2("5611", map), ["5610"]);
  assert.deepEqual(caenRev3ToRev2("4763", map), ["4764"]);
  assert.deepEqual(caenRev3ToRev2("7112", map), ["7112"]);
  assert.notDeepEqual(caenRev3ToRev2("7112", map), caenRev3ToRev2("4752", map));
  assert.deepEqual(caenRev3ToRev2("9999", map), []);
});

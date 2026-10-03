import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyRole,
  coreCompanyName,
  courtMatchScore,
  courtNameVariants,
  courtQueryNames,
  filterExactParty,
  parseCourtsXml,
  summarizeCases,
} from "../../../src/lib/deep/parse/courts";
import {
  cleanRoleTitle,
  containsPersonalName,
  isGenericEmail,
  looksLikePersonalName,
  peopleGates,
} from "../../../src/lib/deep/parse/people";
import { amountInQuote, parseLocaleNumber, verifyQuote } from "../../../src/lib/deep/parse/quotes";

/** Synthetic court answer (the trial never stored real ones): names are invented. */
function dosar(
  parties: Array<[string, string]>,
  category: string,
  date: string,
  institution = "TribunalulTIMIS",
  object = "pretenţii",
) {
  return `<Dosar><parti>${parties
    .map(
      ([n, r]) => `<DosarParte><nume>${n}</nume><calitateParte>${r}</calitateParte></DosarParte>`,
    )
    .join(
      "",
    )}</parti><numar>123/30/2025</numar><data>${date}T00:00:00</data><institutie>${institution}</institutie><categorieCazNume>${category}</categorieCazNume><stadiuProcesualNume>Fond</stadiuProcesualNume><obiect>${object}</obiect></Dosar>`;
}

const XML = `<soap:Envelope><soap:Body><CautareDosareResponse><CautareDosareResult>${[
  dosar(
    [
      ["CONFISCAL SRL", "Reclamant"],
      ["CLIENT EXEMPLU SRL", "Pârât"],
    ],
    "Litigii cu profesioniştii",
    "2025-04-02",
  ),
  dosar(
    [
      ["CONFISCALSRL", "Creditor"],
      ["ALTA FIRMA SRL", "Debitor"],
    ],
    "Insolvenţă",
    "2025-06-10",
  ),
  dosar([["CONFISCAL GRUP SRL", "Pârât"]], "Civil", "2025-01-15"),
  dosar(
    [
      ["SC CONFISCAL SRL", "Pârât"],
      ["ANAF", "Reclamant"],
    ],
    "Contencios administrativ şi fiscal",
    "2024-11-20",
  ),
  dosar([["CONFISCAL SRL", "Reclamant"]], "Civil", "2019-01-01"),
].join("")}</CautareDosareResult></CautareDosareResponse></soap:Body></soap:Envelope>`;

test("court name variants and queries", () => {
  assert.equal(coreCompanyName("SC EXPRES TRANSPORT S.R.L."), "EXPRES TRANSPORT");
  assert.equal(coreCompanyName("MIMOSA SRL"), "MIMOSA");
  const official = "CONSILIER FINANCIAR CONTABIL SI FISCAL,,CONFISCALSRL";
  assert.deepEqual(courtQueryNames(official), [
    "CONSILIER FINANCIAR CONTABIL SI FISCAL CONFISCALSRL",
    "CONFISCAL",
    "CONFISCALSRL",
  ]);
  const variants = courtNameVariants("CONFISCAL SRL");
  for (const v of ["CONFISCAL SRL", "SC CONFISCAL SRL", "CONFISCAL S.R.L.", "CONFISCALSRL"])
    assert.ok(variants.includes(v), v);
});

test("exact-party filter, roles, creditor-only is never adverse", () => {
  const cases = parseCourtsXml(XML);
  assert.equal(cases.length, 5);
  assert.equal(JSON.stringify(cases).includes("123/30/2025"), false, "case numbers are not read");
  const exact = filterExactParty(cases, courtNameVariants("CONFISCAL SRL"));
  assert.equal(exact.length, 4, "CONFISCAL GRUP SRL is name noise");
  assert.equal(classifyRole("Pârât"), "defendant");
  assert.equal(classifyRole("Reclamant"), "plaintiff");
  assert.equal(classifyRole("Debitor"), "debtor");
  assert.equal(classifyRole("Creditor"), "creditor");
  assert.equal(classifyRole("Intimat"), "other");

  const summary = summarizeCases(cases, "CONFISCAL SRL", {
    fromIso: "2023-10-03",
    seatCounty: "Timiș",
    seatCity: "Timișoara",
  });
  assert.equal(summary.exactCases, 3);
  assert.equal(summary.byRole.plaintiff, 1);
  assert.equal(summary.byRole.defendant, 1);
  assert.equal(summary.byRole.creditor, 1);
  assert.equal(summary.insolvencyAsDebtor, 0);
  assert.equal(summary.byCategory.insolventa, 1);
  assert.equal(summary.byCategory.fiscal, 1);
  assert.equal(summary.match, "official");
  assert.equal(summary.seatCountyCourt, true);
  assert.equal(courtMatchScore(summary), 0.95);

  const brandOnly = summarizeCases(cases, "CONSILIER FINANCIAR CONTABIL SI FISCAL,,CONFISCALSRL", {
    fromIso: "2023-10-03",
  });
  assert.equal(brandOnly.match, "brand");
  assert.ok(courtMatchScore(brandOnly) < 0.9, "a brand-only match is never shown as adverse");
});

test("quotes: verbatim with diacritics and whitespace normalised, limits", () => {
  const page = "Programul nostru:\nLuni – Vineri  09:00–18:00\nConsultație inițială: 150 lei";
  assert.equal(verifyQuote("Luni - Vineri 09:00-18:00", page, 200), "Luni - Vineri 09:00-18:00");
  assert.equal(
    verifyQuote("consultatie initiala: 150 lei", page, 200),
    "consultatie initiala: 150 lei",
  );
  assert.equal(verifyQuote("Sâmbătă 10:00", page, 200), null);
  const long = "a ".repeat(200).trim();
  const quote = verifyQuote(long, long, 120)!;
  assert.ok(quote.length <= 120);
  assert.equal(amountInQuote(150, "Consultație inițială: 150 lei"), true);
  assert.equal(amountInQuote(1250, "Pachet: 1.250 lei"), true);
  assert.equal(amountInQuote(1250.5, "Pachet: 1.250,50 lei"), true);
  assert.equal(amountInQuote(99, "Pachet: 1.250 lei"), false);
  assert.equal(parseLocaleNumber("1 250"), 1250);
  assert.equal(parseLocaleNumber("12,5"), 12.5);
});

test("people: names dropped, roles kept, e-mails counted", () => {
  assert.equal(looksLikePersonalName("Ion Popescu"), true);
  assert.equal(looksLikePersonalName("Dr. Maria Ionescu"), true);
  assert.equal(looksLikePersonalName("Medic stomatolog"), false);
  assert.equal(looksLikePersonalName("Director Vânzări"), false);
  assert.equal(cleanRoleTitle("Ion Popescu - Medic stomatolog"), "Medic stomatolog");
  assert.equal(cleanRoleTitle("Ion Popescu"), null);
  assert.equal(
    cleanRoleTitle("Șofer profesionist categoria C+E"),
    "Șofer profesionist categoria C+E",
  );
  assert.equal(isGenericEmail("office@firma.ro"), true);
  assert.equal(isGenericEmail("comenzi2@firma.ro"), true);
  assert.equal(isGenericEmail("ion.popescu@firma.ro"), false);
  assert.equal(
    containsPersonalName("De (autor): Andrei Ionescu"),
    true,
    "book authors on a shop page",
  );
  assert.equal(containsPersonalName("Dr. Popescu vă așteaptă"), true);
  assert.equal(
    containsPersonalName("Str. Dr. Ioan Rațiu nr. 17"),
    false,
    "a street named after a person is an address",
  );
  assert.equal(containsPersonalName("Transport Intern"), false);
  assert.equal(containsPersonalName("Detartraj 250 lei"), false);
  assert.deepEqual(peopleGates("8623"), { noReviews: true, countsOnly: false, skipPupils: false });
  assert.equal(peopleGates("9412").countsOnly, true);
  assert.equal(peopleGates("8891").skipPupils, true);
});

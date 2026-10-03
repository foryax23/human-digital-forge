import { decodeEntities, foldUpper } from "./text";
import { quotedBrand } from "./web";

/*
 * Court cases from portal.just.ro, parsed in memory (client-safe, pure).
 * Only exact-party cases count (the trial saw 79% name noise in raw results),
 * counted by role and category for 36 months. No case numbers, no other
 * parties and nothing from the files ever leave this module's callers: the
 * step turns the summary into counts.
 */

const LEGAL_FORMS = [
  "SRL",
  "SRL-D",
  "SRLD",
  "S.R.L.",
  "S.R.L.-D.",
  "SA",
  "S.A.",
  "SNC",
  "SCS",
  "SCA",
];
const FORM_TAIL =
  /\s*\b(S\.?\s?R\.?\s?L\.?(\s?-?\s?D\.?)?|S\.?\s?A\.?|S\.?\s?N\.?\s?C\.?|S\.?\s?C\.?\s?S\.?|S\.?\s?C\.?\s?A\.?|SOCIETATE CU RASPUNDERE LIMITATA)\s*$/;

/** Legal name without legal form, "SC" prefix, quotes and punctuation: "SC X S.R.L." → "X". */
export function coreCompanyName(name: string): string {
  let s = foldUpper(decodeEntities(name))
    .replace(/[,„”“"'`´«»]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/^S\.?\s?C\.?\s+/, "");
  for (let i = 0; i < 2; i++) s = s.replace(FORM_TAIL, "").trim();
  return s
    .replace(/[^A-Z0-9&\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Compact comparison key: upper-case ASCII letters and digits only. */
export const partyKey = (name: string) => foldUpper(decodeEntities(name)).replace(/[^A-Z0-9]/g, "");

/**
 * Spellings under which the company appears as a party: "X SRL", "SC X SRL",
 * "X S.R.L.", "XSRL", and the same for a brand in quotes in the official name.
 */
export function courtNameVariants(officialName: string): string[] {
  const out = new Set<string>();
  const add = (core: string) => {
    if (!core) return;
    out.add(`${core} SRL`);
    out.add(`SC ${core} SRL`);
    out.add(`${core} S.R.L.`);
    out.add(`${core.replace(/\s+/g, "")}SRL`);
    out.add(`${core} SA`);
  };
  add(coreCompanyName(officialName));
  const brand = quotedBrand(officialName);
  if (brand) add(coreCompanyName(brand));
  return [...out];
}

/** Names to send to the portal search (it matches substrings): official core, brand, glued brand. */
export function courtQueryNames(officialName: string): string[] {
  const core = coreCompanyName(officialName);
  const brand = quotedBrand(officialName);
  const out = [core];
  if (brand) {
    const brandCore = coreCompanyName(brand);
    out.push(brandCore, `${brandCore.replace(/\s+/g, "")}SRL`);
  }
  return [...new Set(out.filter((n) => n.length >= 3))].slice(0, 3);
}

export type CourtParty = { name: string; role: string };
export type CourtCase = {
  parties: CourtParty[];
  institution: string;
  category: string;
  stage: string;
  object: string;
  date: string;
};

/** Parses the SOAP answer of CautareDosare. Case numbers are not read at all. */
export function parseCourtsXml(xml: string): CourtCase[] {
  const cases: CourtCase[] = [];
  const tag = (block: string, name: string) =>
    decodeEntities(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block)?.[1] ?? "").trim();
  for (const block of xml.split("<Dosar>").slice(1)) {
    const parties = [
      ...block.matchAll(
        /<DosarParte>\s*<nume>([\s\S]*?)<\/nume>\s*<calitateParte>([\s\S]*?)<\/calitateParte>\s*<\/DosarParte>/g,
      ),
    ].map((m) => ({ name: decodeEntities(m[1]).trim(), role: decodeEntities(m[2]).trim() }));
    cases.push({
      parties,
      institution: tag(block, "institutie"),
      category: tag(block, "categorieCazNume") || tag(block, "categorieCaz"),
      stage: tag(block, "stadiuProcesualNume") || tag(block, "stadiuProcesual"),
      object: tag(block, "obiect").slice(0, 200),
      date: tag(block, "data").slice(0, 10),
    });
  }
  return cases;
}

/** Cases where one party is exactly the company (any of its name variants). */
export function filterExactParty<T extends { parties: { name: string; role: string }[] }>(
  cases: T[],
  variants: string[],
): T[] {
  const keys = new Set(variants.map(partyKey));
  return cases.filter((c) => c.parties.some((p) => keys.has(partyKey(p.name))));
}

export type PartyRole = "plaintiff" | "defendant" | "debtor" | "creditor" | "other";

export function classifyRole(role: string): PartyRole {
  const r = foldUpper(role);
  if (/DEBITOR/.test(r)) return "debtor";
  if (/CREDITOR/.test(r)) return "creditor";
  if (/RECLAMANT|PETENT|CONTESTATOR|PARTE CIVILA|PERSOANA VATAMATA/.test(r)) return "plaintiff";
  if (/PARAT|INCULPAT|PARTE RESPONSABILA|CHEMAT IN GARANTIE|INTERVENIENT FORTAT/.test(r))
    return "defendant";
  return "other";
}

export type CaseCategory = "plata" | "insolventa" | "munca" | "fiscal" | "penal" | "altele";

export function classifyCategory(category: string, object: string): CaseCategory {
  const c = foldUpper(`${category} ${object}`);
  if (/INSOLVEN|FALIMENT|PROCEDURA COLECTIVA/.test(c)) return "insolventa";
  if (/PENAL/.test(c)) return "penal";
  if (/MUNCA|ASIGURARI SOCIALE|CONFLICT DE MUNCA/.test(c)) return "munca";
  if (/CONTENCIOS|FISCAL/.test(c)) return "fiscal";
  if (/PRETENTII|ORDONANTA DE PLATA|VALOARE REDUSA|EXECUTARE|PLATA|FACTUR/.test(c)) return "plata";
  return "altele";
}

export type CourtSummary = {
  exactCases: number;
  rawCases: number;
  byRole: Record<PartyRole, number>;
  byCategory: Record<CaseCategory, number>;
  /** Cases where the company is the debtor in an insolvency procedure. */
  insolvencyAsDebtor: number;
  /** A court in the seat's county decided at least one exact-party case. */
  seatCountyCourt: boolean;
  /** Best match quality: "official" (official name + form), "core" (no form), "brand" (quoted brand). */
  match: "official" | "core" | "brand" | "none";
  /** Raw answer was cut by the size cap: counts are lower bounds ("cel puțin N"). */
  capped: boolean;
};

/**
 * Exact-party cases since `fromIso`, by role and category. A case where the
 * company is only a creditor in someone else's insolvency is counted as
 * creditor and is never adverse.
 */
export function summarizeCases(
  cases: CourtCase[],
  officialName: string,
  opts: { fromIso: string; seatCounty?: string; seatCity?: string; capped?: boolean },
): CourtSummary {
  const core = coreCompanyName(officialName);
  const officialKeys = new Set(
    [
      `${core} SRL`,
      `SC ${core} SRL`,
      `${core} SA`,
      `${core} SRL-D`,
      ...LEGAL_FORMS.map((f) => `${core} ${f}`),
    ].map(partyKey),
  );
  const coreKey = partyKey(core);
  const brand = quotedBrand(officialName);
  const brandKeys = new Set(
    brand
      ? courtNameVariants(brand)
          .map(partyKey)
          .concat(partyKey(coreCompanyName(brand)))
      : [],
  );
  const summary: CourtSummary = {
    exactCases: 0,
    rawCases: cases.length,
    byRole: { plaintiff: 0, defendant: 0, debtor: 0, creditor: 0, other: 0 },
    byCategory: { plata: 0, insolventa: 0, munca: 0, fiscal: 0, penal: 0, altele: 0 },
    insolvencyAsDebtor: 0,
    seatCountyCourt: false,
    match: "none",
    capped: Boolean(opts.capped),
  };
  const rank = { none: 0, brand: 1, core: 2, official: 3 } as const;
  const placeKeys = [opts.seatCounty, opts.seatCity].filter(Boolean).map((p) => partyKey(p!));
  for (const c of cases) {
    if (c.date && c.date < opts.fromIso) continue;
    let level: CourtSummary["match"] = "none";
    const mine: CourtParty[] = [];
    for (const party of c.parties) {
      const key = partyKey(party.name);
      const hit: CourtSummary["match"] = officialKeys.has(key)
        ? "official"
        : key === coreKey
          ? "core"
          : brandKeys.has(key)
            ? "brand"
            : "none";
      if (hit !== "none") {
        mine.push(party);
        if (rank[hit] > rank[level]) level = hit;
      }
    }
    if (!mine.length) continue;
    summary.exactCases++;
    if (rank[level] > rank[summary.match]) summary.match = level;
    const category = classifyCategory(c.category, c.object);
    summary.byCategory[category]++;
    const roles = new Set(mine.map((p) => classifyRole(p.role)));
    for (const role of roles) summary.byRole[role]++;
    if (category === "insolventa" && roles.has("debtor")) summary.insolvencyAsDebtor++;
    const institution = partyKey(c.institution);
    if (placeKeys.some((p) => p.length >= 4 && institution.includes(p.slice(0, 5)))) {
      summary.seatCountyCourt = true;
    }
  }
  return summary;
}

/**
 * How sure we are the cases are this company's: official name with its legal
 * form 0.9, a court in the seat's county +0.05; name without form 0.8; quoted
 * brand only 0.75. Adverse facts are shown only at >= 0.9.
 */
export function courtMatchScore(summary: CourtSummary): number {
  const base = { official: 0.9, core: 0.8, brand: 0.75, none: 0 }[summary.match];
  return base
    ? Math.round(Math.min(0.99, base + (summary.seatCountyCourt ? 0.05 : 0)) * 100) / 100
    : 0;
}

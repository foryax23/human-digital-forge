import { collapse, fixCedilla, fold, titleCase } from "./text";

/*
 * Pure parsers for the official registers (client-safe, unit-tested):
 * CUI checksum, both Trade Register number formats, company identifiers in
 * page text, the natural-person guard (lifted unchanged in behaviour from
 * src/lib/scan/anaf.server.ts so the quick scan and deep research share one
 * rule), the ANAF v9 record and the ANAF bilanț (annual accounts) payload.
 */

/* ------------------------------------------------------------------ CUI */

const CUI_KEY = [7, 5, 3, 2, 1, 7, 5, 3, 2];

/** Romanian fiscal code (CUI/CIF) checksum; accepts an "RO" prefix and spaces. */
export function isValidCui(cui: string): boolean {
  const digits = cui.trim().replace(/^ro/i, "").replace(/[\s.]/g, "");
  if (!/^\d{2,10}$/.test(digits)) return false;
  const all = digits.split("").map(Number);
  const control = all.pop()!;
  const padded = [...new Array<number>(9 - all.length).fill(0), ...all];
  const sum = padded.reduce((total, digit, i) => total + digit * CUI_KEY[i], 0);
  return ((sum * 10) % 11) % 10 === control;
}

/** "RO 9259999" → "9259999"; null when not a well-formed CUI. */
export function cleanCui(raw: string): string | null {
  const digits = raw.trim().replace(/^ro/i, "").replace(/[\s.]/g, "").replace(/^0+/, "");
  return /^\d{2,10}$/.test(digits) ? digits : null;
}

/* ------------------------------------------------- Trade Register number */

/**
 * Both formats of a Trade Register number. The legacy one is
 * "J02/151/1993" (letter, county code, order number, year). The 2024+ one is
 * "J1993000151025": letter, year, 6-digit order number, 2-digit county code
 * ("00" for national numbers issued after the reform) and one trailing digit.
 * `key` drops that trailing digit, so both formats compare equal.
 */
export type RegNo = { canonical: string; legacy?: string; key: string };

const REG_NEW = /^([JFC])((?:19|20)\d{2})(\d{6})(\d{2})(\d)$/;
const REG_LEGACY = /^([JFC])(\d{1,2})\/(\d{1,7})\/((?:19|20)\d{2})$/;

export function normalizeRegNo(raw: string): RegNo | null {
  const compact = fixCedilla(raw)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[.\\-]/g, "/")
    .replace(/\/+/g, "/");
  const fresh = REG_NEW.exec(compact.replace(/\//g, ""));
  if (fresh && !compact.includes("/")) {
    const [, letter, year, number, county] = fresh;
    const key = `${letter}${year}${number}${county}`;
    const order = String(Number(number));
    const legacy = county !== "00" ? `${letter}${county}/${order}/${year}` : undefined;
    return { canonical: compact, legacy, key };
  }
  const old = REG_LEGACY.exec(compact);
  if (old) {
    const [, letter, countyRaw, numberRaw, year] = old;
    const county = countyRaw.padStart(2, "0");
    const number = numberRaw.replace(/^0+/, "") || "0";
    if (number.length > 6) return null;
    const key = `${letter}${year}${number.padStart(6, "0")}${county}`;
    return { canonical: key, legacy: `${letter}${county}/${number}/${year}`, key };
  }
  return null;
}

/** Every spelling worth searching for in page text (both formats, padded and not). */
export function regNoVariants(raw: string): string[] {
  const reg = normalizeRegNo(raw);
  if (!reg) return [];
  const out = new Set<string>([reg.canonical, reg.key]);
  if (reg.legacy) {
    const [letterCounty, number, year] = reg.legacy.split("/");
    const letter = letterCounty[0];
    const county = letterCounty.slice(1);
    const short = String(Number(county));
    for (const c of new Set([county, short])) {
      out.add(`${letter}${c}/${number}/${year}`);
      out.add(`${letter}${c}/${number.padStart(4, "0")}/${year}`);
    }
  }
  return [...out];
}

const CUI_LABELLED =
  /\b(?:C\.?\s?U\.?\s?I\.?|C\.?\s?I\.?\s?F\.?|C\.?\s?F\.?|cod\s+(?:unic\s+de\s+[îi]nregistrare|fiscal|de\s+identificare\s+fiscal[ăa])|VAT(?:\s+(?:no|number|ID))?|Tax\s+ID|fiscal\s+code|tax\s+code)(?:\s*\((?:C\.?U\.?I\.?|C\.?I\.?F\.?)\))?\s*(?:nr\.?|no\.?)?\s*[:.\-–]?\s*(?:RO)?\s?(\d{2,10})\b/gi;
const CUI_VAT = /\bRO\s?(\d{6,10})\b/g;
const REG_IN_TEXT =
  /\b([JFC])\s?(\d{1,2})\s?\/\s?(\d{1,7})\s?\/\s?((?:19|20)\d{2})\b|\b([JFC])\s?((?:19|20)\d{2})\s?(\d{6})\s?(\d{2})\s?(\d)\b/g;

/** Valid CUIs (checksum) and Trade Register numbers printed in a text. */
export function findCompanyIdsInText(text: string): { cuis: string[]; regNos: string[] } {
  const cuis = new Set<string>();
  for (const match of text.matchAll(CUI_LABELLED)) {
    if (isValidCui(match[1])) cuis.add(match[1].replace(/^0+/, ""));
  }
  for (const match of text.matchAll(CUI_VAT)) {
    if (isValidCui(match[1])) cuis.add(match[1].replace(/^0+/, ""));
  }
  const regNos = new Set<string>();
  for (const match of text.matchAll(REG_IN_TEXT)) {
    const raw = match[1]
      ? `${match[1]}${match[2]}/${match[3]}/${match[4]}`
      : `${match[5]}${match[6]}${match[7]}${match[8]}${match[9]}`;
    const reg = normalizeRegNo(raw);
    if (reg) regNos.add(reg.key);
  }
  return { cuis: [...cuis], regNos: [...regNos] };
}

/** True when the text names this company: its CUI (checksum-valid) or its J number in either format. */
export function textProvesCompany(
  text: string,
  company: { cui: string; regNo?: string },
): { cui: boolean; regNo: boolean } {
  const ids = findCompanyIdsInText(text);
  const reg = company.regNo ? normalizeRegNo(company.regNo) : null;
  return {
    cui: ids.cuis.includes(company.cui.replace(/^0+/, "")),
    regNo: Boolean(reg && ids.regNos.includes(reg.key)),
  };
}

/* ------------------------------------------------------ natural persons */

/**
 * Sole traders, individual and family businesses and individual practices.
 * ONRC files natural persons under "F" numbers; the name rules match the
 * company index build (scripts/scan/build-company-index.mjs).
 */
const NATURAL_PERSON_FORM =
  /persoan[aă] fizic|[iî]ntreprindere (individual|familial)|asocia[tț]ie familial|^(pf|pfa|ii|if|af)$/i;
const NATURAL_PERSON_NAME =
  /persoan[aă] fizic[aă]|[iî]ntreprindere (individual|familial)|asocia[tț]ie familial|\b(cabinet|birou)\b.*\bindividual|\s(p\.?f\.?a\.?|p\.?f\.?|i\.?i\.?|i\.?f\.?|a\.?f\.?)$/i;

export type EntityInput = {
  legalForm?: string;
  name?: string;
  /** Trade Register number: natural persons have "F" numbers. */
  regNo?: string;
  /** ANAF "forma_organizare" ("PERSOANA JURIDICA" for companies). */
  organizationForm?: string;
};

export function isNaturalPersonEntity(input: EntityInput): boolean {
  if (/^F/i.test(input.regNo?.trim() ?? "")) return true;
  if (/persoan[aă] fizic/i.test(fixCedilla(input.organizationForm ?? ""))) return true;
  if (NATURAL_PERSON_FORM.test(fixCedilla(input.legalForm ?? "").trim())) return true;
  return NATURAL_PERSON_NAME.test(collapse(fixCedilla(input.name ?? "")));
}

/** A readable legal form for a natural-person business. */
export function naturalPersonForm(input: EntityInput): string {
  const text = collapse(fixCedilla(`${input.legalForm ?? ""} ${input.name ?? ""}`));
  if (/familial|\si\.?f\.?$/i.test(text)) return "Întreprindere familială (IF)";
  if (/[iî]ntreprindere individual|\si\.?i\.?$/i.test(text)) {
    return "Întreprindere individuală (II)";
  }
  if (/autorizat|\bp\.?f\.?a\.?$/i.test(text)) return "Persoană fizică autorizată (PFA)";
  return "Persoană fizică (activitate independentă)";
}

/** Apartment-block markers (ap., bl., sc., et., cam.): a seat in a flat is usually a home. */
const FLAT = /(^|[\s,.])(ap|apt|apartament|bl|bloc|sc|scara|et|etaj|cam|camera)(\.|\s)\s*\w/i;

export function isResidentialAddress(address: string): boolean {
  return FLAT.test(fixCedilla(address));
}

/* ------------------------------------------------------------- ANAF v9 */

export type AnafAddress = {
  street?: string;
  number?: string;
  details?: string;
  locality?: string;
  county?: string;
  countyCode?: string;
  postalCode?: string;
};

export type AnafCompany = {
  cui: string;
  name: string;
  regNo?: string;
  legalForm?: string;
  organizationForm?: string;
  /** Main activity, CAEN Rev.3 (ANAF switched in 2025). */
  caen?: string;
  registeredAt?: string;
  status: "activ" | "inactiv" | "radiat";
  statusText?: string;
  vatPayer?: boolean;
  /** Registered seat (sediu social). */
  seat: AnafAddress;
  /** Fiscal address: ANAF's one-line `adresa` plus its structured block. */
  fiscal: AnafAddress & { line?: string };
  /** The registry phone exists (it is never parsed further: often a private mobile). */
  hasPhone: boolean;
  naturalPerson: boolean;
};

type Raw = Record<string, unknown>;
const str = (v: unknown) =>
  (typeof v === "string" ? collapse(fixCedilla(v)) : undefined) || undefined;

function cleanCounty(raw?: string): string | undefined {
  const s = collapse(fixCedilla(raw ?? ""));
  if (!s) return undefined;
  if (/bucure[șs]ti/i.test(s)) return "București";
  return titleCase(s.replace(/^(jud\.|județul|judetul)\s*/i, ""));
}

/** "Mun. Timişoara" → "Timișoara"; "Sector 6 Mun. Bucureşti" → "București"; "Sat Pecica Orş. Pecica" → "Pecica". */
export function cleanLocality(raw?: string): string | undefined {
  let s = collapse(fixCedilla(raw ?? ""));
  if (!s) return undefined;
  if (/bucure[șs]ti/i.test(s)) return "București";
  s = s
    .replace(/^sector(ul)?\s*\d+\s*/i, "")
    .replace(
      /^(mun\.|municipiul|ora[șs]ul|ora[șs]|or[șs]?\.|com\.|comuna|sat(ul)?|loc\.|localitatea)\s*/i,
      "",
    )
    .split(/\s+(?:com\.|comuna|ora[șs]|or[șs]?\.|mun\.|municipiul)\s+/i)[0]
    .trim();
  return s ? titleCase(s) : undefined;
}

export function parseAnafV9(record: unknown): AnafCompany {
  const r = (record ?? {}) as Raw;
  const g = (r.date_generale ?? {}) as Raw;
  const seat = (r.adresa_sediu_social ?? {}) as Raw;
  const fiscal = (r.adresa_domiciliu_fiscal ?? {}) as Raw;
  const inactive = (r.stare_inactiv ?? {}) as Raw;
  const vat = (r.inregistrare_scop_Tva ?? {}) as Raw;
  const name = str(g.denumire) ?? "";
  const statusText = str(g.stare_inregistrare);
  const radiated =
    /^radiere/i.test(statusText ?? "") || Boolean(str(inactive.dataRadiere as string));
  const isInactive = inactive.statusInactivi === true;
  const regNo = str(g.nrRegCom);
  const legalForm = str(g.forma_juridica);
  const organizationForm = str(g.forma_organizare);
  const caenRaw = str(g.cod_CAEN)?.replace(/\D/g, "");
  const registeredAt = /^\d{4}-\d{2}-\d{2}$/.test(str(g.data_inregistrare) ?? "")
    ? str(g.data_inregistrare)
    : undefined;
  return {
    cui: String(g.cui ?? "").replace(/\D/g, ""),
    name,
    regNo,
    legalForm,
    organizationForm,
    caen: caenRaw ? caenRaw.padStart(4, "0") : undefined,
    registeredAt,
    status: radiated ? "radiat" : isInactive ? "inactiv" : "activ",
    statusText,
    vatPayer: typeof vat.scpTVA === "boolean" ? vat.scpTVA : undefined,
    seat: {
      street: str(seat.sdenumire_Strada),
      number: str(seat.snumar_Strada),
      details: str(seat.sdetalii_Adresa),
      locality: str(seat.sdenumire_Localitate),
      county: cleanCounty(str(seat.sdenumire_Judet)),
      countyCode: str(seat.scod_JudetAuto),
      postalCode: str(seat.scod_Postal),
    },
    fiscal: {
      line: str(g.adresa),
      street: str(fiscal.ddenumire_Strada),
      number: str(fiscal.dnumar_Strada),
      details: str(fiscal.ddetalii_Adresa),
      locality: str(fiscal.ddenumire_Localitate),
      county: cleanCounty(str(fiscal.ddenumire_Judet)),
      countyCode: str(fiscal.dcod_JudetAuto),
    },
    hasPhone: Boolean(str(g.telefon)),
    naturalPerson: isNaturalPersonEntity({ legalForm, name, regNo, organizationForm }),
  };
}

/**
 * The seat as it may be shown: town and county always; the street only when
 * the seat is not in a flat (flat markers checked on the seat details and on
 * the fiscal line when it is the same street).
 */
export function publicSeat(company: AnafCompany): {
  city?: string;
  county?: string;
  street?: string;
  flat: boolean;
} {
  const city = cleanLocality(company.seat.locality ?? company.fiscal.locality);
  const county = company.seat.county ?? company.fiscal.county;
  const streetName = company.seat.street ? titleCase(company.seat.street) : undefined;
  const fiscalLine = fold(company.fiscal.line ?? "");
  const sameStreet =
    Boolean(streetName && company.seat.number) &&
    fiscalLine.includes(fold(streetName!.replace(/^\p{L}+\.\s*/u, "")));
  const flat =
    isResidentialAddress(company.seat.details ?? "") ||
    (sameStreet && isResidentialAddress(company.fiscal.line ?? ""));
  if (company.naturalPerson || flat || !streetName) return { city, county, flat };
  const street = company.seat.number ? `${streetName} nr. ${company.seat.number}` : streetName;
  return { city, county, street, flat };
}

/* -------------------------------------------------------------- bilanț */

export type BilantYear = {
  year: number;
  /** CAEN Rev.2 class the accounts were filed under (4 digits). */
  caen2?: string;
  caenLabel?: string;
  turnover?: number;
  revenueTotal?: number;
  expenses?: number;
  /** Pre-tax result: profit brut − pierdere brută (negative = loss). */
  profitPretax?: number;
  /** Net result: profit net − pierdere netă (negative = loss). */
  profitNet?: number;
  employees?: number;
  receivables?: number;
  debts?: number;
  equity?: number;
  cash?: number;
  fixedAssets?: number;
  currentAssets?: number;
};

/** Label prefixes (folded) of the standard balance-sheet layout, with their I-codes as fallback. */
const BILANT_LABELS: Array<[RegExp, keyof Omit<BilantYear, "year" | "caen2" | "caenLabel">]> = [
  [/^cifra de afaceri/, "turnover"],
  [/^venituri totale/, "revenueTotal"],
  [/^cheltuieli totale/, "expenses"],
  [/^numar mediu (de )?salariati/, "employees"],
  [/^creante/, "receivables"],
  [/^datorii/, "debts"],
  [/^capitaluri/, "equity"],
  [/^casa si conturi/, "cash"],
  [/^active imobilizate/, "fixedAssets"],
  [/^active circulante/, "currentAssets"],
];
const CODE_FALLBACK: Record<string, keyof BilantYear> = {
  I1: "fixedAssets",
  I2: "currentAssets",
  I4: "receivables",
  I5: "cash",
  I7: "debts",
  I10: "equity",
  I13: "turnover",
  I14: "revenueTotal",
  I15: "expenses",
  I20: "employees",
};

/** Parses one ANAF bilanț response; null when the year has no filing (`i: []`). */
export function parseBilant(json: unknown): BilantYear | null {
  const data = (json ?? {}) as Raw;
  const rows = Array.isArray(data.i) ? (data.i as Raw[]) : [];
  if (!rows.length) return null;
  const year = Number(data.an);
  if (!Number.isInteger(year)) return null;
  const out: BilantYear = { year };
  const caen = data.caen;
  if (typeof caen === "number" || (typeof caen === "string" && /^\d+$/.test(caen))) {
    out.caen2 = String(caen).padStart(4, "0");
  }
  out.caenLabel = str(data.den_caen);
  let grossProfit: number | undefined;
  let grossLoss: number | undefined;
  let netProfit: number | undefined;
  let netLoss: number | undefined;
  const assign = (key: keyof BilantYear, value: number) => {
    if ((out as Record<string, unknown>)[key] === undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  };
  for (const row of rows) {
    const value =
      typeof row.val_indicator === "number" ? row.val_indicator : Number(row.val_indicator);
    if (!Number.isFinite(value)) continue;
    const label = fold(String(row.val_den_indicator ?? ""))
      .replace(/\s+/g, " ")
      .trim();
    if (/^profit brut/.test(label)) grossProfit = value;
    else if (/^pierdere?a? bruta/.test(label)) grossLoss = value;
    else if (/^profit net/.test(label)) netProfit = value;
    else if (/^pierdere?a? neta/.test(label)) netLoss = value;
    else {
      const hit = BILANT_LABELS.find(([pattern]) => pattern.test(label));
      if (hit) assign(hit[1], value);
      else {
        const code = String(row.indicator ?? "");
        if (!label && CODE_FALLBACK[code]) assign(CODE_FALLBACK[code], value);
      }
    }
  }
  if (grossProfit !== undefined || grossLoss !== undefined) {
    out.profitPretax = (grossProfit ?? 0) - (grossLoss ?? 0);
  }
  if (netProfit !== undefined || netLoss !== undefined) {
    out.profitNet = (netProfit ?? 0) - (netLoss ?? 0);
  }
  if (out.employees !== undefined && out.employees < 0) delete out.employees;
  return out;
}

/** A filing with every figure at zero is a dormant company, not a real year of activity. */
export function isDormantYear(year: BilantYear): boolean {
  return !year.turnover && !year.revenueTotal && !year.expenses && !year.employees;
}

/* ---------------------------------------------------------------- CAEN */

/**
 * CAEN Rev.3 class → the Rev.2 class(es) it was split from (generated map,
 * src/lib/deep/data/caen-rev3-rev2.json). Unknown codes return [] so callers
 * fall back to the class the company filed its accounts under (Rev.2).
 */
export function caenRev3ToRev2(code: string, map: Record<string, string[]>): string[] {
  const normalised = code.replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  return map[normalised] ?? [];
}

import {
  isNaturalPersonEntity,
  isResidentialAddress,
  naturalPersonForm as naturalPersonFormOf,
} from "@/lib/deep/parse/registry";
import { loadCaenLabel } from "@/lib/scan/caen";
import { prettifyCompanyName } from "@/lib/scan/company-search";
import type { CompanyProfile } from "@/lib/scan/types";

/*
 * Official company details from ANAF's public VAT-registry API (v9: free, no
 * key, ~1 request/second per client). fetch only, so it runs on Workers.
 *
 * Privacy rules applied here, before anything reaches the UI or the PDF
 * (deep-engine plan §2.0 and §3.1):
 * - Natural-person businesses (PFA, II, IF, individual practices) are their
 *   owners: only name, legal form, status, main CAEN and county are returned.
 * - The registry phone of a firm is often the owner's mobile: it is returned
 *   only when the latest annual accounts show 10 or more employees.
 * - A registered seat in a flat is usually someone's home: the address is cut
 *   to locality and county.
 * - ANAF's e-Factura flag is dropped: it reads false for companies that
 *   invoice through e-Factura every day (eMAG, OMV Petrom, Vortex Hub), so
 *   showing it would be a false finding.
 */

const ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
const BILANT_URL = "https://webservicesp.anaf.ro/bilant";
const TIMEOUT_MS = 8_000;
const BILANT_TIMEOUT_MS = 2_500;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 200;
/** From this headcount up the registry phone is a switchboard, not a person. */
const PHONE_MIN_EMPLOYEES = 10;

type AnafRecord = {
  date_generale?: {
    cui?: number;
    denumire?: string;
    /** The fiscal address (domiciliu fiscal), not the registered seat. */
    adresa?: string;
    telefon?: string;
    nrRegCom?: string;
    cod_CAEN?: string;
    forma_juridica?: string;
    /** "PERSOANA JURIDICA" for companies. */
    forma_organizare?: string;
    data_inregistrare?: string;
    /** e.g. "INREGISTRAT din data 22.05.2026" or "RADIERE din data 29.03.2002". */
    stare_inregistrare?: string;
  };
  inregistrare_scop_Tva?: { scpTVA?: boolean };
  stare_inactiv?: { statusInactivi?: boolean };
  /** The registered seat (sediu social). */
  adresa_sediu_social?: {
    sdenumire_Strada?: string;
    snumar_Strada?: string;
    sdetalii_Adresa?: string;
    sdenumire_Localitate?: string;
    sdenumire_Judet?: string;
  };
  adresa_domiciliu_fiscal?: { ddenumire_Localitate?: string; ddenumire_Judet?: string };
};

type AnafResponse = { cod?: number; message?: string; found?: AnafRecord[]; notFound?: unknown[] };

const cache = new Map<string, { at: number; value: CompanyProfile | null }>();

/** ANAF still writes ş/ţ with a cedilla; Romanian uses the comma below (ș/ț). */
const fixCedilla = (s: string) =>
  s.replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț");

const SMALL_WORDS = new Set(["de", "din", "la", "pe", "sub", "lui", "cu"]);

/** "DROBETA-TURNU SEVERIN" → "Drobeta-Turnu Severin", "BAIA DE ARIEŞ" → "Baia de Arieș". */
function titleCase(s: string): string {
  return fixCedilla(s)
    .toLocaleLowerCase("ro")
    .split(" ")
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word)
        ? word
        : word.replace(
            /(^|[-.(])(\p{L})/gu,
            (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("ro"),
          ),
    )
    .join(" ");
}

function cleanCounty(raw?: string): string | undefined {
  const s = fixCedilla(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return undefined;
  if (/bucure[șs]ti/i.test(s)) return "București";
  return titleCase(s.replace(/^(jud\.|județul|judetul)\s*/i, ""));
}

/** "Mun. Timişoara" → "Timișoara"; "Sector 6 Mun. Bucureşti" → "București"; "Sat X Com. Y" → "X". */
function cleanCity(raw?: string): string | undefined {
  let s = fixCedilla(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return undefined;
  if (/bucure[șs]ti/i.test(s)) return "București";
  s = s
    .replace(/^sector(ul)?\s*\d+\s*/i, "")
    .replace(
      /^(mun\.|municipiul|ora[șs]ul|ora[șs]|or\.|com\.|comuna|sat(ul)?|loc\.|localitatea)\s*/i,
      "",
    )
    .split(/\s+(?:com\.|comuna|ora[șs]|mun\.|municipiul)\s+/i)[0]
    .trim();
  return s ? titleCase(s) : undefined;
}

/** "JUD. TIMIŞ, MUN. TIMIŞOARA, STR. ARMONIEI, NR.23A" → "Jud. Timiș, Mun. Timișoara, Str. Armoniei, Nr.23A". */
function cleanAddress(raw?: string): string | undefined {
  const s = fixCedilla(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return undefined;
  return s
    .toLocaleLowerCase("ro")
    .replace(
      /(^|[\s.,\-/(]|\d)(\p{L})/gu,
      (_, before: string, ch: string) => before + ch.toLocaleUpperCase("ro"),
    );
}

/* ------------------------------------------------------------- privacy */

/*
 * Sole traders, individual and family businesses and individual practices, and
 * seats in a flat: one rule for the quick scan and deep research (plan B2), in
 * the pure src/lib/deep/parse/registry.ts (unit-tested there). ONRC files
 * natural persons under "F" numbers; the name rules match the company index
 * build (scripts/scan/build-company-index.mjs). The flat test now also counts
 * "et." / "etaj" (stricter than before: a seat on a numbered floor shows the
 * locality and county only).
 */
function isNaturalPerson(general: NonNullable<AnafRecord["date_generale"]>): boolean {
  return isNaturalPersonEntity({
    legalForm: general.forma_juridica,
    name: general.denumire,
    regNo: general.nrRegCom,
    organizationForm: general.forma_organizare,
  });
}

/** A readable legal form for a natural-person business. */
function naturalPersonForm(general: NonNullable<AnafRecord["date_generale"]>): string {
  return naturalPersonFormOf({ legalForm: general.forma_juridica, name: general.denumire });
}

/** Apartment-block markers (ap., bl., sc., et., cam.): a seat in a flat is usually a home. */
const FLAT = { test: (value: string) => isResidentialAddress(value) };

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** "Sector 6 Mun. București" → "Sector 6, București"; "Mun. Timișoara" → "Timișoara". */
function addressLocality(raw?: string): string | undefined {
  const s = fixCedilla(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return undefined;
  const sector = /sector(?:ul)?\s*(\d)/i.exec(s)?.[1];
  if (/bucure[șs]ti/i.test(s)) return sector ? `Sector ${sector}, București` : "București";
  return titleCase(
    s
      .replace(/^(mun\.|municipiul|ora[șs]ul|ora[șs]|or\.)\s*/i, "")
      // "Sat Izvin Com. Remetea Mare" → "Sat Izvin, Com. Remetea Mare"
      .replace(/\s+(?=(com\.|comuna|ora[șs]ul|ora[șs]|mun\.|municipiul)\s)/gi, ", "),
  );
}

/**
 * The registered seat as one line, from ANAF's structured seat block (the
 * `adresa` string is the fiscal address, which can differ). A seat in a flat
 * keeps only locality and county; so does a seat without a street. ANAF
 * leaves the flat number out of the seat block, so the flat test also reads
 * the fiscal address when it is the same street and number.
 */
function seatAddress(record: AnafRecord): string | undefined {
  const seat = record.adresa_sediu_social ?? {};
  const street = titleCase(
    fixCedilla(seat.sdenumire_Strada ?? "")
      .replace(/\s+/g, " ")
      .trim(),
  );
  const number = fixCedilla(seat.snumar_Strada ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const details = fixCedilla(seat.sdetalii_Adresa ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const locality = addressLocality(seat.sdenumire_Localitate);
  const county = cleanCounty(seat.sdenumire_Judet);
  const area: string[] = [];
  if (locality) area.push(locality);
  if (county === "București") {
    if (!locality?.includes("București")) area.push("București");
  } else if (county) {
    area.push(`jud. ${county}`);
  }

  const fiscal = fold(record.date_generale?.adresa ?? "");
  const streetName = fold(street.replace(/^\p{L}+\.\s*/u, ""));
  const sameAsFiscal =
    Boolean(streetName && number) &&
    fiscal.includes(streetName) &&
    new RegExp(`\\b${fold(number).replace(/[^a-z0-9]/g, "")}\\b`).test(
      fiscal.replace(/[^a-z0-9 ]/g, " "),
    );
  const flat = FLAT.test(details) || (sameAsFiscal && FLAT.test(fiscal));

  if (!street || flat) return area.length ? area.join(", ") : undefined;
  const line = [number ? `${street} nr. ${number}` : street, details || undefined, ...area];
  return line.filter(Boolean).join(", ");
}

/**
 * Average headcount (indicator I20) from the latest annual accounts ANAF
 * publishes, or undefined (none filed yet, ANAF slow or down). Accounts are
 * due by the end of May and appear over the summer.
 */
async function latestHeadcount(cui: string): Promise<number | undefined> {
  const now = new Date();
  const year = now.getUTCFullYear() - (now.getUTCMonth() >= 7 ? 1 : 2);
  try {
    const res = await fetch(`${BILANT_URL}?an=${year}&cui=${cui}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(BILANT_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      i?: Array<{ indicator?: string; val_indicator?: number; val_den_indicator?: string }>;
    };
    const row = data.i?.find(
      (item) => item.indicator === "I20" && /salaria/i.test(item.val_den_indicator ?? ""),
    );
    return typeof row?.val_indicator === "number" && row.val_indicator >= 0
      ? row.val_indicator
      : undefined;
  } catch {
    return undefined;
  }
}

/** "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ" → "Societate comercială cu răspundere limitată". */
function sentenceCase(raw?: string): string | undefined {
  const s = fixCedilla(raw ?? "").trim();
  if (!s) return undefined;
  const lower = s.toLocaleLowerCase("ro");
  return lower[0].toLocaleUpperCase("ro") + lower.slice(1);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function queryAnaf(cui: number): Promise<AnafResponse> {
  const body = JSON.stringify([{ cui, data: new Date().toISOString().slice(0, 10) }]);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ANAF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      // ANAF throttles bursts to about one request per second.
      await sleep(res.status === 429 ? 1_200 : 600);
      continue;
    }
    // An unknown CUI comes back as 404 with {"found":[],"notFound":[cui]}.
    if (!res.ok && res.status !== 404) throw new Error(`ANAF responded ${res.status}`);
    const text = await res.text();
    let parsed: AnafResponse;
    try {
      parsed = JSON.parse(text) as AnafResponse;
    } catch {
      throw new Error(`ANAF returned an unreadable response (${res.status})`);
    }
    if (!res.ok && !parsed.notFound) throw new Error(`ANAF responded ${res.status}`);
    return parsed;
  }
}

async function toProfile(cui: string, record: AnafRecord): Promise<CompanyProfile> {
  const general = record.date_generale ?? {};
  const seat = record.adresa_sediu_social ?? {};
  const fiscal = record.adresa_domiciliu_fiscal ?? {};
  const name = fixCedilla(general.denumire ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const caen = general.cod_CAEN?.replace(/\D/g, "") || undefined;
  const county = cleanCounty(seat.sdenumire_Judet || fiscal.ddenumire_Judet);
  // Radiated companies are still returned; for the scan they count as inactive.
  const inactive =
    record.stare_inactiv?.statusInactivi || /^radiere/i.test(general.stare_inregistrare ?? "");
  const caenLabel = caen ? await loadCaenLabel(caen) : undefined;

  if (isNaturalPerson(general)) {
    // The business is its owner: no address, locality, phone, registration
    // number, dates or tax status (they describe a private person).
    return {
      cui,
      name,
      displayName: prettifyCompanyName(name),
      legalForm: naturalPersonForm(general),
      county,
      caen,
      caenLabel,
      inactive,
      sources: ["anaf"],
    };
  }

  const registeredAt = /^\d{4}-\d{2}-\d{2}$/.test(general.data_inregistrare ?? "")
    ? general.data_inregistrare
    : undefined;
  const rawPhone = general.telefon?.trim();
  // ANAF allows one request a second: wait 1.1 s after the v9 call before /bilant.
  const employees = rawPhone ? await sleep(1_100).then(() => latestHeadcount(cui)) : undefined;

  return {
    cui,
    name,
    displayName: prettifyCompanyName(name),
    regNo: general.nrRegCom?.trim() || undefined,
    legalForm: sentenceCase(general.forma_juridica),
    // The fiscal address stands in only when ANAF has no seat at all, and never for a flat.
    address:
      seatAddress(record) ??
      (FLAT.test(general.adresa ?? "") ? undefined : cleanAddress(general.adresa)),
    county,
    city: cleanCity(seat.sdenumire_Localitate || fiscal.ddenumire_Localitate),
    phone: rawPhone && (employees ?? 0) >= PHONE_MIN_EMPLOYEES ? rawPhone : undefined,
    caen,
    caenLabel,
    registeredAt,
    vatPayer: record.inregistrare_scop_Tva?.scpTVA,
    inactive,
    sources: ["anaf"],
  };
}

/**
 * Company details for a CUI from ANAF, or null when ANAF has no such company.
 * Times out after 8 s and retries once on 429/5xx; other failures throw, so
 * callers can tell "not registered" from "ANAF unavailable".
 */
export async function lookupAnaf(cui: string): Promise<CompanyProfile | null> {
  const digits = cui.replace(/^ro/i, "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits || digits.length > 10) return null;

  const hit = cache.get(digits);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const response = await queryAnaf(Number(digits));
  const record = response.found?.find((r) => String(r.date_generale?.cui ?? digits) === digits);
  const value = record?.date_generale?.denumire ? await toProfile(digits, record) : null;

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(digits, { at: Date.now(), value });
  return value;
}

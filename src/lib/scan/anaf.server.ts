import { loadCaenLabel } from "@/lib/scan/caen";
import { prettifyCompanyName } from "@/lib/scan/company-search";
import type { CompanyProfile } from "@/lib/scan/types";

/*
 * Official company details from ANAF's public VAT-registry API (v9: free, no
 * key, ~1 request/second per client). fetch only, so it runs on Workers.
 */

const ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 200;

type AnafRecord = {
  date_generale?: {
    cui?: number;
    denumire?: string;
    adresa?: string;
    telefon?: string;
    nrRegCom?: string;
    cod_CAEN?: string;
    forma_juridica?: string;
    data_inregistrare?: string;
    /** e.g. "INREGISTRAT din data 22.05.2026" or "RADIERE din data 29.03.2002". */
    stare_inregistrare?: string;
    statusRO_e_Factura?: boolean;
  };
  inregistrare_scop_Tva?: { scpTVA?: boolean };
  stare_inactiv?: { statusInactivi?: boolean };
  adresa_sediu_social?: { sdenumire_Localitate?: string; sdenumire_Judet?: string };
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
  const registeredAt = /^\d{4}-\d{2}-\d{2}$/.test(general.data_inregistrare ?? "")
    ? general.data_inregistrare
    : undefined;

  return {
    cui,
    name,
    displayName: prettifyCompanyName(name),
    regNo: general.nrRegCom?.trim() || undefined,
    legalForm: sentenceCase(general.forma_juridica),
    address: cleanAddress(general.adresa),
    county: cleanCounty(seat.sdenumire_Judet || fiscal.ddenumire_Judet),
    city: cleanCity(seat.sdenumire_Localitate || fiscal.ddenumire_Localitate),
    phone: general.telefon?.trim() || undefined,
    caen,
    caenLabel: caen ? await loadCaenLabel(caen) : undefined,
    registeredAt,
    vatPayer: record.inregistrare_scop_Tva?.scpTVA,
    eInvoice: general.statusRO_e_Factura,
    // Radiated companies are still returned; for the scan they count as inactive.
    inactive:
      record.stare_inactiv?.statusInactivi || /^radiere/i.test(general.stare_inregistrare ?? ""),
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

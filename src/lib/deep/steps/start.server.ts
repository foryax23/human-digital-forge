import type { Fact, Gap } from "../contracts";
import type { StepEnv } from "../env.server";
import { bi, dateLabel } from "../parse/format";
import { normalizeRegNo, parseAnafV9, publicSeat, type AnafCompany } from "../parse/registry";
import { titleCase } from "../parse/text";
import type { TicketIdentity } from "../ticket.server";

import { fact, gap, isoDay, type StepDraft } from "./common.server";

/*
 * Step 0, "start" (plan A3): one ANAF v9 call for the company's identity,
 * the natural-person guard (PFA, II, IF are their owners: refused, B2), the
 * seat shown as town and county when it is in a flat, and the registry website
 * from the company index (no ANAF call). The identity summary goes into the
 * run ticket so no later step asks ANAF for the name again.
 */

export type StartOutcome =
  | { kind: "ok"; draft: StepDraft; identity: TicketIdentity; company: AnafCompany }
  | { kind: "not_found" }
  | { kind: "natural_person" }
  | { kind: "anaf_unavailable" };

const SMALL = new Set(["si", "și", "de", "din", "la", "pe", "cu", "in", "în"]);

/** "PRODUCTIE PRESTARI SI COMERT \"VANCSA-MULTIPAST\" SRL" → "Productie Prestari si Comert \"Vancsa-Multipast\" SRL". */
export function prettyName(name: string): string {
  // Registry quirks: quotes, doubled commas and "srl" glued to the name ("…Fiscal,,Confiscalsrl").
  const cleaned = name
    .replace(/[„“”"«»]/g, "")
    .replace(/\s*,{2,}\s*/g, ", ")
    .replace(/(\p{L})srl\b/giu, "$1 srl");
  const words = titleCase(cleaned.replace(/\s+/g, " ").trim()).split(" ");
  return words
    .map((word, i) => {
      const bare = word.toLocaleLowerCase("ro").replace(/[^\p{L}.-]/gu, "");
      if (/^s\.?r\.?l\.?(-d\.?)?$/.test(bare)) return /d/.test(bare) ? "SRL-D" : "SRL";
      if (/^s\.?a\.?$/.test(bare) && i === words.length - 1) return "SA";
      if (i > 0 && SMALL.has(bare)) return word.toLocaleLowerCase("ro");
      return word.replace(
        /(^|["'„“(,])(\p{Ll})/gu,
        (_, before: string, ch: string) => before + ch.toLocaleUpperCase("ro"),
      );
    })
    .join(" ");
}

export function caenLabelFor(
  env: Pick<StepEnv, "data">,
  code?: string,
): { en: string; ro: string } | undefined {
  if (!code) return undefined;
  const division = env.data.caenLabels.divisions[code.slice(0, 2)];
  const ro = env.data.caenLabels.rev3[code];
  if (!division && !ro) return undefined;
  return { ro: ro ?? division?.ro ?? code, en: division?.en ?? ro ?? code };
}

export async function runStart(
  env: StepEnv,
  input: { cui: string; hintSite?: string },
): Promise<StartOutcome> {
  let records: unknown[];
  try {
    records = await env.anaf.v9([input.cui]);
  } catch (error) {
    env.log({ start: "anaf_unavailable", error: String(error) });
    return { kind: "anaf_unavailable" };
  }
  const record = records.find((r) => {
    const general = (r as { date_generale?: { cui?: number } })?.date_generale;
    return String(general?.cui ?? "") === input.cui;
  });
  if (!record) return { kind: "not_found" };
  const company = parseAnafV9(record);
  if (!company.name) return { kind: "not_found" };
  if (company.naturalPerson) return { kind: "natural_person" };

  const now = env.now();
  const today = isoDay(now);
  const asOf = today;
  const seat = publicSeat(company);
  const facts: Fact[] = [];
  const gaps: Gap[] = [];
  const displayName = prettyName(company.name);
  const base = {
    section: "identity" as const,
    source: "anaf_v9" as const,
    asOf,
    confidence: "confirmat" as const,
    method: "api" as const,
  };

  facts.push(
    fact({
      ...base,
      id: "identity.name",
      predicate: "identity.name",
      value: company.name,
      display: bi(displayName, displayName),
    }),
  );
  facts.push(
    fact({
      ...base,
      id: "identity.cui",
      predicate: "identity.cui",
      value: company.cui,
      display: bi(company.cui, company.cui),
    }),
  );
  const reg = company.regNo ? normalizeRegNo(company.regNo) : null;
  if (company.regNo) {
    const shown = reg?.legacy ? `${company.regNo} (${reg.legacy})` : company.regNo;
    facts.push(
      fact({
        ...base,
        id: "identity.reg_no",
        predicate: "identity.reg_no",
        value: { canonical: company.regNo, legacy: reg?.legacy },
        display: bi(shown, shown),
      }),
    );
  }
  if (company.legalForm) {
    const form = company.legalForm.toLocaleLowerCase("ro");
    const shown = form.charAt(0).toLocaleUpperCase("ro") + form.slice(1);
    facts.push(
      fact({
        ...base,
        id: "identity.legal_form",
        predicate: "identity.legal_form",
        value: company.legalForm,
        display: bi(shown, shown),
      }),
    );
  }
  const statusText = {
    activ: bi("Active (registered)", "Activă (înregistrată)"),
    inactiv: bi("Declared inactive by ANAF", "Declarată inactivă de ANAF"),
    radiat: bi("Struck off the register", "Radiată din registru"),
  }[company.status];
  facts.push(
    fact({
      ...base,
      id: "identity.status",
      predicate: "identity.status",
      value: company.status,
      display: statusText,
      adverse: company.status !== "activ",
    }),
  );
  const label = caenLabelFor(env, company.caen);
  if (company.caen) {
    facts.push(
      fact({
        ...base,
        id: "identity.caen",
        predicate: "identity.caen",
        value: { code: company.caen, revision: 3 },
        display: bi(
          `${company.caen} · ${label?.en ?? ""}`.trim(),
          `${company.caen} · ${label?.ro ?? ""}`.trim(),
        ),
        short: label ? bi(label.en, label.ro) : undefined,
      }),
    );
  }
  if (seat.city || seat.county) {
    const place = [
      seat.street,
      seat.city,
      seat.county && seat.county !== seat.city ? `jud. ${seat.county}` : undefined,
    ]
      .filter(Boolean)
      .join(", ");
    const placeEn = [
      seat.street,
      seat.city,
      seat.county && seat.county !== seat.city ? `${seat.county} county` : undefined,
    ]
      .filter(Boolean)
      .join(", ");
    facts.push(
      fact({
        ...base,
        id: "identity.seat",
        predicate: "identity.seat",
        value: { city: seat.city, county: seat.county, street: seat.street, flat: seat.flat },
        display: bi(placeEn, place),
        evidence: seat.flat
          ? {
              note: bi(
                "Seat in a residential building: town only.",
                "Sediu într-un bloc de locuințe: arătăm doar localitatea.",
              ),
            }
          : undefined,
      }),
    );
  }
  if (company.vatPayer !== undefined) {
    facts.push(
      fact({
        ...base,
        id: "identity.vat_payer",
        predicate: "identity.vat_payer",
        value: company.vatPayer,
        display: company.vatPayer ? bi("Yes", "Da") : bi("No", "Nu"),
      }),
    );
  }
  if (company.registeredAt) {
    facts.push(
      fact({
        ...base,
        id: "identity.registered_at",
        predicate: "identity.registered_at",
        value: company.registeredAt,
        display: dateLabel(company.registeredAt),
      }),
    );
  }

  // The Trade Register's website (company index, ONRC open data): no ANAF call.
  const indexed = await env.index.byCui(company.cui).catch(() => null);
  if (indexed?.website) {
    facts.push(
      fact({
        id: "identity.website_registry",
        section: "identity",
        predicate: "identity.website_registry",
        value: indexed.website,
        display: bi(
          indexed.website.replace(/^https?:\/\//, ""),
          indexed.website.replace(/^https?:\/\//, ""),
        ),
        source: "onrc",
        asOf: "2026-09-02",
        confidence: "confirmat",
        method: "bulk",
      }),
    );
  }
  if (!company.caen) {
    gaps.push(
      gap(
        "identity",
        bi("Main activity", "Activitatea principală"),
        bi("ANAF did not return a CAEN code", "ANAF nu a întors un cod CAEN"),
        today,
      ),
    );
  }

  const identity: TicketIdentity = {
    name: company.name,
    displayName,
    regNo: company.regNo,
    caen3: company.caen,
    city: seat.city,
    county: seat.county,
    countyCode: company.seat.countyCode ?? company.fiscal.countyCode,
    registrySite: indexed?.website,
    hintSite: input.hintSite,
    registeredAt: company.registeredAt,
  };
  return {
    kind: "ok",
    company,
    identity,
    draft: {
      status: "done",
      facts,
      gaps,
      counters: { anafCalls: env.anaf.calls(), sourcesOk: 1 + (indexed ? 1 : 0) },
      next: { anafNextAt: env.anaf.nextAt() },
    },
  };
}

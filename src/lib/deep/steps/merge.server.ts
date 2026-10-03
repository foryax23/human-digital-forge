import type {
  Bilingual,
  Correction,
  DeepReport,
  Fact,
  FactValue,
  Gap,
  StepResult,
  WebsiteStatus,
} from "../contracts";
import { bi, count } from "../parse/format";

import { fact } from "./common.server";

/*
 * Merging attested step results for synthesis and finish: identical results
 * (same attestation) once, one fact per ID (presence facts: found anywhere
 * wins and pages read add up across batches; other facts: the later step
 * wins), one total for pages read (per batch fact ID), gaps deduplicated, owner corrections applied as "declarat" facts (typed values
 * only, never free text) with the IDs they hide.
 */

const PRESENCE =
  /^site\.(cui|reg_no|phone|contact_form|contact|booking|shop|legal\.\w+)\.present$|^site\.legal\.\w+$|^presence\.google_profile_linked$|^people\.hiring$/;

function withPages(text: Bilingual, pages: number): Bilingual {
  const ro = text.ro.replace(
    /cele \d+ pagini citite|pagina citită/,
    pages === 1 ? "pagina citită" : `cele ${pages} pagini citite`,
  );
  const en = text.en.replace(
    /the \d+ pages we read|the page we read/,
    pages === 1 ? "the page we read" : `the ${pages} pages we read`,
  );
  return { ro, en };
}

/** One copy of each result: a retried step kept twice by the runner (same attestation) counts once. */
export function uniqueResults(results: StepResult[]): StepResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = typeof r.att === "string" && r.att ? r.att : "";
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeFacts(input: StepResult[]): Fact[] {
  const results = uniqueResults(input);
  const merged = new Map<string, Fact>();
  const pagesById = new Map<string, number>();
  // Pages read per batch fact ("site.pages_read.a", ".c1"…): the last one of an ID wins.
  const pagesRead = new Map<string, number>();
  let pagesAsOf = "";
  for (const result of results) {
    for (const f of result.facts) {
      if (f.predicate === "site.pages_read") {
        pagesRead.set(f.id, typeof f.value === "number" ? f.value : 0);
        pagesAsOf = f.asOf;
        continue;
      }
      const prev = merged.get(f.id);
      if (
        prev &&
        PRESENCE.test(f.id) &&
        typeof f.value === "boolean" &&
        typeof prev.value === "boolean"
      ) {
        const pages =
          (pagesById.get(f.id) ?? prev.observed?.pagesRead ?? 0) + (f.observed?.pagesRead ?? 0);
        pagesById.set(f.id, pages);
        const winner = prev.value ? prev : f.value ? f : prev;
        merged.set(f.id, {
          ...winner,
          observed: { pagesRead: pages },
          display: winner.value ? winner.display : withPages(winner.display, pages),
        });
        continue;
      }
      if (f.observed?.pagesRead !== undefined && !pagesById.has(f.id))
        pagesById.set(f.id, f.observed.pagesRead);
      merged.set(f.id, f);
    }
  }
  // A booking method stated on the site (Haiku, verified quote) means booking was found.
  const online = [...merged.values()].find(
    (f) => f.predicate === "offers.booking_method" && f.value === "online",
  );
  const booking = merged.get("site.booking.present");
  if (online && booking && booking.value === false) {
    merged.set("site.booking.present", {
      ...booking,
      value: true,
      confidence: "probabil",
      method: "llm",
      display: bi(
        `Yes: «${online.evidence?.quote ?? "online"}»`,
        `Da: «${online.evidence?.quote ?? "online"}»`,
      ),
      evidence: online.evidence,
    });
  }
  const pagesTotal = [...pagesRead.values()].reduce((n, v) => n + v, 0);
  if (pagesTotal) {
    merged.set(
      "site.pages_read",
      fact({
        id: "site.pages_read",
        section: "site",
        predicate: "site.pages_read",
        value: pagesTotal,
        display: count(pagesTotal),
        source: "site",
        asOf: pagesAsOf,
        confidence: "confirmat",
        method: "html",
      }),
    );
  }
  return [...merged.values()];
}

export function mergeGaps(results: StepResult[]): Gap[] {
  const seen = new Set<string>();
  const out: Gap[] = [];
  for (const g of uniqueResults(results).flatMap((r) => r.gaps)) {
    const key = `${g.section}|${g.what.ro}|${g.where.ro}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

/** Typed corrections → declared facts, plus the fact IDs whose AI sentences they hide. */
export function applyCorrectionFacts(
  facts: Fact[],
  corrections: Correction[] | undefined,
  today: string,
): { facts: Fact[]; hidden: Map<string, string> } {
  const out = new Map(facts.map((f) => [f.id, f]));
  const hidden = new Map<string, string>();
  for (const c of (corrections ?? []).slice(0, 10)) {
    const url = c.url && /^https?:\/\//i.test(c.url) ? c.url.slice(0, 300) : undefined;
    const declared = (
      id: string,
      section: Fact["section"],
      value: FactValue,
      display: Bilingual,
    ) => {
      hidden.set(id, id);
      out.set(id, {
        id,
        section,
        predicate: id,
        value,
        display,
        source: "user",
        asOf: today,
        confidence: "declarat",
        score: 1,
        method: "user",
        gdpr: "G0",
        evidence: url ? { url } : undefined,
      });
    };
    switch (c.predicate) {
      case "site.booking.present":
        declared(
          "site.booking.present",
          "site",
          true,
          bi("Yes (declared by you)", "Da (declarat de tine)"),
        );
        break;
      case "site.cui.present":
        declared(
          "site.cui.present",
          "site",
          true,
          bi("Yes (declared by you)", "Da (declarat de tine)"),
        );
        break;
      case "site.contact.present":
        declared(
          "site.contact.present",
          "site",
          true,
          bi("Yes (declared by you)", "Da (declarat de tine)"),
        );
        break;
      case "presence.social_only":
        declared(
          "presence.social_only",
          "presence",
          { url },
          bi("Only social pages (declared by you)", "Doar pagini sociale (declarat de tine)"),
        );
        break;
      case "site.url":
        if (url) {
          declared(
            "site.url",
            "site",
            url,
            bi(url.replace(/^https?:\/\//, ""), url.replace(/^https?:\/\//, "")),
          );
          hidden.set("site.status", "site.url");
        }
        break;
    }
  }
  return { facts: [...out.values()], hidden };
}

const value = <T>(facts: Fact[], id: string) =>
  facts.find((f) => f.id === id)?.value as T | undefined;

/** The company block of the report, from identity, money and site facts. */
export function companyFromFacts(
  facts: Fact[],
  cui: string,
  displayName: string,
): DeepReport["company"] {
  const caen = value<{ code: string }>(facts, "identity.caen");
  const caen2 = value<{ code: string }>(facts, "money.caen_rev2");
  const activity =
    facts.find((f) => f.id === "identity.caen")?.short ??
    facts.find((f) => f.id === "money.caen_rev2")?.display ??
    bi("", "");
  const seat = value<{ city?: string; county?: string }>(facts, "identity.seat");
  const site = value<string>(facts, "site.url");
  const status = value<WebsiteStatus>(facts, "site.status");
  return {
    name: value<string>(facts, "identity.name") ?? displayName,
    displayName,
    cui,
    regNo: value<{ canonical: string }>(facts, "identity.reg_no")?.canonical,
    caen3: caen?.code,
    caen2: caen2?.code,
    activity,
    city: seat?.city,
    county: seat?.county,
    website: site && status ? { url: site, status } : undefined,
  };
}

/** The peers block of the report from the peers facts. */
export function peersFromFacts(facts: Fact[]): DeepReport["peers"] | undefined {
  const scope = value<{ scope: "oras" | "judet" | "national" }>(facts, "peers.scope");
  const n = value<number>(facts, "peers.n");
  if (!scope || !n) return undefined;
  const scopeFact = facts.find((f) => f.id === "peers.scope")!;
  const band = value<[number, number]>(facts, "peers.size_band") ?? [0, 0];
  const bands: NonNullable<DeepReport["peers"]>["bands"] = {};
  for (const f of facts.filter((x) => x.predicate === "peers.band")) {
    const { metric, ...rest } = f.value as { metric: string } & Record<string, unknown>;
    (bands as Record<string, unknown>)[metric] = rest;
  }
  return {
    n,
    scope: scope.scope,
    scopeLabel: scopeFact.display,
    year: Number(scopeFact.asOf.replace(/\D/g, "")) || new Date().getUTCFullYear() - 1,
    sizeBand: band,
    bands,
  };
}

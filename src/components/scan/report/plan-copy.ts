import type { DisplayStrategy } from "@/lib/scan/blueprint/display";
import { withCommaBelow } from "@/lib/scan/localize";
import type { Blueprint, Lang } from "@/lib/scan/types";
import { softenCaps } from "./format";

/*
 * Plain-text helpers shared by the strategy and results steps: a long result
 * split at its colon, the category of a strategy card, and the company line
 * of the step header.
 */

/**
 * "4 lucruri care te fac să pierzi pacienți: pagini lente pe mobil, …" → the claim
 * and the list, so a long result reads as a statement plus its detail.
 */
export function splitResult(text: string): { head: string; tail: string | null } {
  const at = text.indexOf(": ");
  if (at < 0) return { head: text, tail: null };
  const rest = text.slice(at + 2).trim();
  const tail = rest ? `${rest[0].toLocaleUpperCase("ro")}${rest.slice(1)}` : "";
  return { head: text.slice(0, at), tail: tail ? (/[.!?]$/.test(tail) ? tail : `${tail}.`) : null };
}

/** The category tag of a strategy card: what kind of work it is. */
export function categoryOf(strategy: DisplayStrategy, lang: Lang): string {
  const ro = lang === "ro";
  if (strategy.id === "automate") return ro ? "Automatizare" : "Automation";
  if (strategy.id === "assist") return ro ? "Asistent AI" : "AI assistant";
  if (strategy.id === "acquire") {
    const site = strategy.phases.some((p) => p.key === "foundation");
    return site ? (ro ? "Site" : "Website") : ro ? "Recenzii" : "Reviews";
  }
  return ro ? "Direcție" : "Direction";
}

/** The sample blueprint behind /scan?demo= (labelled "Date de exemplu"). */
export function isSample(blueprint: Blueprint): boolean {
  return blueprint.id.startsWith("demo-");
}

/** Company name and city for the step header, registry spelling fixed. */
export function companyLine(blueprint: Blueprint): { company?: string; place?: string } {
  const company = blueprint.company;
  if (!company) return { company: blueprint.audit?.host };
  return {
    company: withCommaBelow(company.displayName),
    place: company.city ? withCommaBelow(softenCaps(company.city)) : undefined,
  };
}

/** "4–9" never breaks at its dash (word joiners around the en dash). */
export function keepRanges(text: string): string {
  return text.replace(/(\d)–(\d)/g, "$1\u2060–\u2060$2");
}

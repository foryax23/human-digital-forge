import type { DeepReport, Lang, LightState, SourceId } from "@/lib/deep/contracts";
import { SOURCE_LABELS } from "@/lib/deep/parse/labels";
import type { AreaLight, BriefSection, Correction } from "@/lib/deep/contracts";
import { LINE_WORDS } from "@/lib/deep/report/words";

/*
 * Non-component helpers of the report's parts (kept apart so the component files only export
 * components, for fast refresh).
 */

export const stateWord = (state: LightState, lang: Lang) => LINE_WORDS[state][lang];

/** Plain-language source name ("Ministerul Finanțelor, bilanț (ANAF)"). */
export const sourceName = (source: SourceId, lang: Lang) => SOURCE_LABELS[source]?.[lang] ?? source;

export const visibleText = (section?: BriefSection) =>
  section
    ? section.sentences
        .filter((s) => !s.hiddenBy)
        .map((s) => s.text)
        .join(" ")
    : "";

/** Tags at the report's 13 px minimum for older readers (the system Tag is 12 px). */
export const TAG_13 = "h-6 px-2 text-[0.8125rem]";

/** Section of the "Details" list each line opens. */
export const AREA_DETAIL: Record<AreaLight["area"], string> = {
  bani: "detalii-bani",
  clienti: "detalii-site",
  online: "detalii-site",
  echipa: "detalii-echipa",
  risc: "detalii-risc",
};

/** Which correction answers an absence fact, if any. */
export function correctionFor(factId: string, value: unknown): Correction["predicate"] | null {
  if (factId === "site.booking.present" && value === false) return "site.booking.present";
  if (factId === "site.cui.present" && value === false) return "site.cui.present";
  if (factId === "site.contact.present" && value === false) return "site.contact.present";
  if (factId === "site.status" && value !== "verified" && value !== "declared") return "site.url";
  return null;
}

/** A report that ended early (a missing core step or a timed-out last step). */
export function isPartial(report: DeepReport): boolean {
  return report.gaps.some((g) => /parțial|Neverificat în această rulare/.test(g.where.ro));
}

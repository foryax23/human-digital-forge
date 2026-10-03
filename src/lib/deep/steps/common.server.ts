import type {
  Bilingual,
  Confidence,
  Fact,
  FactMethod,
  Gap,
  SectionId,
  SourceId,
  SourceRef,
  StepResult,
  StepStatus,
} from "../contracts";
import { SOURCE_LABELS, SOURCE_URLS } from "../parse/labels";

/*
 * Builders shared by the step modules: facts with every required field
 * (source, as-of date, confidence, method, score, GDPR class), gaps worded as
 * observations, and the draft a step returns before the dispatcher times,
 * sizes and attests it.
 */

export type StepDraft = Omit<StepResult, "att" | "runId" | "ms" | "step"> & { status: StepStatus };

export type FactInput<T> = {
  id: string;
  section: SectionId;
  predicate: string;
  value: T;
  display: Bilingual;
  short?: Bilingual;
  source: SourceId;
  asOf: string;
  confidence: Confidence;
  method: FactMethod;
  score?: number;
  evidence?: Fact["evidence"];
  observed?: Fact["observed"];
  gdpr?: "G0" | "G1";
  adverse?: boolean;
};

export function fact<T>(input: FactInput<T>): Fact<T> {
  const out: Fact<T> = {
    id: input.id,
    section: input.section,
    predicate: input.predicate,
    value: input.value,
    display: input.display,
    source: input.source,
    asOf: input.asOf,
    confidence: input.confidence,
    score:
      input.score ??
      (input.confidence === "probabil" ? 0.7 : input.confidence === "estimare" ? 0.5 : 1),
    method: input.method,
    gdpr: input.gdpr ?? "G0",
  };
  if (input.short) out.short = input.short;
  if (input.evidence) out.evidence = input.evidence;
  if (input.observed) out.observed = input.observed;
  if (input.adverse) out.adverse = true;
  return out;
}

export function gap(
  section: SectionId,
  what: Bilingual,
  where: Bilingual,
  at: string,
  link?: string,
): Gap {
  return link ? { section, what, where, at, link } : { section, what, where, at };
}

export function sourceRef(
  id: SourceId,
  asOf: string,
  retrievedAt: string,
  licence?: string,
): SourceRef {
  const ref: SourceRef = { id, label: SOURCE_LABELS[id], asOf, retrievedAt };
  if (SOURCE_URLS[id]) ref.url = SOURCE_URLS[id];
  if (licence) ref.licence = licence;
  return ref;
}

export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** "Am găsit" / "Nu am găsit … pe cele N pagini citite" (absences as observations, D25). */
export function presenceDisplay(
  present: boolean,
  what: Bilingual,
  pagesRead: number,
  detail?: Bilingual,
): Bilingual {
  if (present) {
    return {
      ro: detail ? `Da: ${detail.ro}` : `Da, am găsit ${what.ro} pe site`,
      en: detail ? `Yes: ${detail.en}` : `Yes, we found ${what.en} on the website`,
    };
  }
  const pagesRo = pagesRead === 1 ? "pagina citită" : `cele ${pagesRead} pagini citite`;
  const pagesEn = pagesRead === 1 ? "the page we read" : `the ${pagesRead} pages we read`;
  return {
    ro: `Nu am găsit ${what.ro} pe ${pagesRo}`,
    en: `We did not find ${what.en} on ${pagesEn}`,
  };
}

/** Error text without stack traces or secrets, for logs. */
export const errorText = (error: unknown) =>
  String((error as Error)?.message ?? error).slice(0, 200);

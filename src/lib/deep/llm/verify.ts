import type { Audience, CitedSentence, Fact } from "../contracts";
import { containsPersonalName } from "../parse/people";
import { fixCedilla, fold } from "../parse/text";

import { citedFactIds } from "./documents";
import type { LlmBlock, LlmCitation, LlmMessage } from "./types";
import { BANNED_INFERENCES, BANNED_PHRASES, NUMBER_WORDS, TU_FORMS } from "./words";

/*
 * Response parsing and the code verifier (plan A7), pure and unit-tested:
 * 1. thinking blocks are skipped; with a fallback block, text before the last
 *    one is discarded (a mid-stream refusal leaves invalid partial text);
 *    refusal → the section uses its rules template; max_tokens → the last,
 *    truncated marker section is dropped;
 * 2. markers are parsed, sentences split; a sentence is kept only when cited
 *    text covers at least 80% of its letters and digits, or the uncited rest is
 *    only connectives ("și", "dar", "în"…); a personal name not in the cited
 *    facts cuts it;
 * 3. every number (digits or number words) must appear in a fact it cites;
 * 4. banned words and banned inferences are cut;
 * 5. sentences citing an estimate are cut; for third parties, "tu" forms are cut.
 * Word checks run on the text with old cedilla letters (ş, ţ) normalised.
 */

/** Uncited words a kept sentence may still contain (folded). */
const CONNECTIVES = new Set(
  (
    "si dar iar care din de la cu in pe a al ale o un una sau ca pentru mai este e are au fost " +
    "iar insa deci adica fata the and of in on with to an is are has but which by from at for or"
  ).split(" "),
);
const ALNUM = /[^\p{L}\p{N}]/gu;

export type CutReason =
  | "uncited"
  | "number"
  | "banned"
  | "inference"
  | "estimate"
  | "second_person"
  | "truncated";

export type VerifiedSections = {
  status: "ok" | "refusal" | "empty";
  sections: Record<string, CitedSentence[]>;
  cut: { kept: number; byCode: number; reasons: Partial<Record<CutReason, number>> };
};

type Segment = { start: number; end: number; factIds: string[] };

/** Text blocks after the last fallback boundary, thinking skipped. */
export function usableTextBlocks(
  content: LlmBlock[],
): Array<{ text: string; citations: LlmCitation[] }> {
  const lastFallback = content.map((b) => b.type).lastIndexOf("fallback");
  return content
    .slice(lastFallback + 1)
    .filter(
      (b): b is { type: "text"; text: string; citations?: LlmCitation[] | null } =>
        b.type === "text",
    )
    .map((b) => ({ text: b.text, citations: b.citations ?? [] }));
}

const NUMBER_TOKEN = /\d+(?:[.,]\d+)*\s?%?/g;
const normNumber = (token: string) => token.replace(/\s/g, "").replace(/%$/, "");

function factNumberTokens(fact: Fact): Set<string> {
  const text = [
    fact.display.ro,
    fact.display.en,
    fact.short?.ro,
    fact.short?.en,
    fact.id,
    fact.asOf,
  ]
    .filter(Boolean)
    .join(" ");
  return new Set((text.match(NUMBER_TOKEN) ?? []).map(normNumber));
}

function factWordsText(fact: Fact): string {
  return fold(
    [fact.display.ro, fact.display.en, fact.short?.ro, fact.short?.en].filter(Boolean).join(" "),
  );
}

const ABBREVIATION =
  /(?:^|[^\p{L}])(?:dr|prof|ing|str|nr|bd|av|ec|dl|dna|sf|jud|mun|com|loc|tel|ap|bl|sc|et|art|alin|lit|pag)$/iu;

/** Splits text into sentences with their character offsets (abbreviations like "mil." are kept). */
export function splitSentences(
  text: string,
  offset = 0,
): Array<{ text: string; start: number; end: number }> {
  const out: Array<{ text: string; start: number; end: number }> = [];
  let start = 0;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    const trimmed = raw.trim();
    if (trimmed) {
      const lead = raw.length - raw.trimStart().length;
      out.push({
        text: trimmed,
        start: offset + start + lead,
        end: offset + start + lead + trimmed.length,
      });
    }
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n") {
      push(i + 1);
      continue;
    }
    if (!".!?…".includes(ch)) continue;
    // "Dr. Popescu", "Str. Mihai", "nr. 4" do not end a sentence.
    if (ch === "." && ABBREVIATION.test(text.slice(Math.max(0, i - 6), i))) continue;
    let j = i + 1;
    while (j < text.length && ".!?…".includes(text[j])) j++;
    let k = j;
    while (k < text.length && (text[k] === " " || text[k] === "\u00a0")) k++;
    // A sentence ends before whitespace and a capital, a digit or a quote ("4,62 mil. lei" does not end one).
    if (k > j && k < text.length && /[\p{Lu}„"«(\d]/u.test(text[k])) {
      push(j);
      i = j - 1;
    }
  }
  if (start < text.length) push(text.length);
  return out;
}

export function verifySections(input: {
  message: LlmMessage;
  markers: string[];
  factIndex: string[][];
  facts: Map<string, Fact>;
  audience: Audience;
  /** Names the prose may use (the company's): not counted as personal names. */
  knownNames?: string[];
}): VerifiedSections {
  const result: VerifiedSections = {
    status: "ok",
    sections: {},
    cut: { kept: 0, byCode: 0, reasons: {} },
  };
  if (input.message.stop_reason === "refusal") return { ...result, status: "refusal" };
  const blocks = usableTextBlocks(input.message.content);
  let full = "";
  const segments: Segment[] = [];
  for (const block of blocks) {
    const ids = [...new Set(block.citations.flatMap((c) => citedFactIds(c, input.factIndex)))];
    segments.push({ start: full.length, end: full.length + block.text.length, factIds: ids });
    full += block.text;
  }
  // Marker positions, in order of appearance.
  const found: Array<{ marker: string; index: number }> = [];
  for (const marker of input.markers) {
    const index = full.indexOf(marker);
    if (index >= 0) found.push({ marker, index });
  }
  found.sort((a, b) => a.index - b.index);
  if (!found.length) return { ...result, status: "empty" };
  const cut = (reason: CutReason) => {
    result.cut.byCode++;
    result.cut.reasons[reason] = (result.cut.reasons[reason] ?? 0) + 1;
  };
  const truncated = input.message.stop_reason === "max_tokens";
  found.forEach((m, i) => {
    const start = m.index + m.marker.length;
    const end = i + 1 < found.length ? found[i + 1].index : full.length;
    const body = full.slice(start, end);
    const sentences = splitSentences(body, start);
    if (truncated && i === found.length - 1) {
      for (const s of sentences) if (s.text.split(/\s+/).length >= 3) cut("truncated");
      result.sections[m.marker] = [];
      return;
    }
    const kept: CitedSentence[] = [];
    for (const s of sentences) {
      if (s.text.replace(/[^\p{L}\d]/gu, "").length < 6) continue;
      const overlapping = segments.filter((seg) => seg.end > s.start && seg.start < s.end);
      const cited = overlapping.filter((seg) => seg.factIds.length);
      const ids = [...new Set(cited.flatMap((seg) => seg.factIds))].filter((id) =>
        input.facts.has(id),
      );
      // The text of the sentence outside cited segments, measured on letters and digits only.
      let uncited = "";
      let pos = s.start;
      for (const seg of [...cited].sort((a, b) => a.start - b.start)) {
        if (seg.start > pos) uncited += `${full.slice(pos, Math.min(seg.start, s.end))} `;
        pos = Math.max(pos, seg.end);
      }
      if (pos < s.end) uncited += full.slice(pos, s.end);
      const letters = s.text.replace(ALNUM, "").length;
      const uncitedLetters = uncited.replace(ALNUM, "").length;
      const connectivesOnly = uncited
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .every((w) => CONNECTIVES.has(fold(w)));
      if (!ids.length || (uncitedLetters / Math.max(1, letters) > 0.2 && !connectivesOnly)) {
        cut("uncited");
        continue;
      }
      const citedFacts = ids.map((id) => input.facts.get(id)!);
      // Old cedilla letters (ş, ţ) would slip past the word lists, which use ș and ț.
      const text = fixCedilla(s.text);
      if (citedFacts.some((f) => f.confidence === "estimare")) {
        cut("estimate");
        continue;
      }
      const tokens = new Set(citedFacts.flatMap((f) => [...factNumberTokens(f)]));
      const numbers = (text.match(NUMBER_TOKEN) ?? []).map(normNumber);
      if (numbers.some((n) => !tokens.has(n))) {
        cut("number");
        continue;
      }
      const words = citedFacts.map(factWordsText).join(" ");
      const numberWords = [...text.matchAll(new RegExp(NUMBER_WORDS.source, "giu"))].map((w) =>
        fold(w[0]),
      );
      if (numberWords.some((w) => !words.includes(w))) {
        cut("number");
        continue;
      }
      const folded = fold(text);
      if (BANNED_PHRASES.some((p) => folded.includes(fold(p)))) {
        cut("banned");
        continue;
      }
      if (BANNED_INFERENCES.some((p) => folded.includes(fold(p)))) {
        cut("inference");
        continue;
      }
      if (input.audience === "third_party" && TU_FORMS.test(text)) {
        cut("second_person");
        continue;
      }
      // No personal names in v1: words that appear in the cited facts or the company's name
      // (company and rival names) are set aside first.
      const known = new Set(
        [
          ...(input.knownNames ?? []),
          ...citedFacts.flatMap((f) => [f.display.ro, f.display.en, f.short?.ro, f.short?.en]),
        ]
          .filter((x): x is string => Boolean(x))
          .flatMap((x) => fixCedilla(x).split(/\s+/)),
      );
      const unknownWords = text
        .split(/\s+/)
        .map((w) => (known.has(w) ? "x" : w))
        .join(" ");
      if (containsPersonalName(unknownWords)) {
        cut("inference");
        continue;
      }
      kept.push({ text: s.text.replace(/\s+/g, " ").trim(), factIds: ids });
    }
    result.sections[m.marker] = kept;
    result.cut.kept += kept.length;
  });
  return result;
}

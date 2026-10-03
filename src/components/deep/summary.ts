import type { DeepReport, Fact, Lang, LightState } from "@/lib/deep/contracts";
import { CONFIDENCE_LABELS, factLabel, SOURCE_LABELS } from "@/lib/deep/parse/labels";

import { asOfLabel } from "./format";

/*
 * Plain-text outputs of the report: "Copiază rezumatul" (five lines for WhatsApp) and the
 * CSV export of the "Dovezi" tab. Both read the same report object as the screen.
 */

export const STATE_WORD: Record<LightState, { ro: string; en: string }> = {
  bine: { ro: "Bine", en: "Good" },
  atentie: { ro: "Atenție", en: "Watch" },
  de_rezolvat: { ro: "De rezolvat", en: "To fix" },
  neverificat: { ro: "Neverificat", en: "Not checked" },
};

/** Shapes used in plain text (the screen draws them as SVG). */
export const STATE_GLYPH: Record<LightState, string> = {
  bine: "■",
  atentie: "◆",
  de_rezolvat: "●",
  neverificat: "□",
};

const visible = (text: { text: string; hiddenBy?: string }[]) =>
  text
    .filter((s) => !s.hiddenBy)
    .map((s) => s.text)
    .join(" ");

/** Five lines plus the headline, for a WhatsApp message (no links, no personal data). */
export function summaryText(report: DeepReport, lang: Lang): string {
  const lines = report.lights.map(
    (l) =>
      `${STATE_GLYPH[l.state]} ${l.label[lang]}: ${STATE_WORD[l.state][lang]} · ${l.reason[lang]}`,
  );
  const head = visible(report.brief.headline.sentences);
  const title =
    lang === "ro"
      ? `${report.company.displayName} · Cercetare aprofundată Vortex Scan`
      : `${report.company.displayName} · Vortex Scan deep research`;
  const first = report.actions.find((a) => !a.mandatory);
  const next = first
    ? lang === "ro"
      ? `Primul pas: ${first.title.ro}`
      : `First step: ${first.title.en}`
    : "";
  return [title, head, "", ...lines, ...(next ? ["", next] : [])].join("\n").trim();
}

/** A CSV cell: quoted, and prefixed with an apostrophe when it could start a formula. */
export function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Every fact as one CSV row (value, source, valid at, confidence, method, evidence). */
export function factsCsv(report: DeepReport, lang: Lang): string {
  const head =
    lang === "ro"
      ? ["Secțiune", "Ce", "Valoare", "Sursa", "Valabil la", "Cât de sigur", "Metodă", "Dovadă"]
      : ["Section", "What", "Value", "Source", "Valid at", "Confidence", "Method", "Evidence"];
  const rows = report.facts
    .filter((f: Fact) => !f.ephemeral)
    .map((f) => [
      f.section,
      factLabel(f, lang),
      f.display[lang],
      SOURCE_LABELS[f.source]?.[lang] ?? f.source,
      asOfLabel(f.asOf, lang),
      CONFIDENCE_LABELS[f.confidence]?.[lang] ?? f.confidence,
      f.method,
      f.evidence?.quote ?? f.evidence?.url ?? "",
    ]);
  return [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

import { createElement, type ReactElement } from "react";

import type { DocumentProps } from "@react-pdf/renderer";

import type { Blueprint, Lang } from "@/lib/scan/types";

import { asciiSlug } from "./format";
import { subjectName } from "./model";

/**
 * "Vortex-Blueprint-Dental-Smile-Clinic-SRL-2026-10-03.pdf", or
 * "Vortex-Plan-Digital-…" for the Romanian edition.
 */
export function blueprintFileName(blueprint: Blueprint, lang: Lang = "en"): string {
  const date = new Date(blueprint.generatedAt);
  const day = Number.isNaN(date.getTime()) ? new Date() : date;
  // en-CA formats as YYYY-MM-DD; Bucharest so a late-night scan keeps its local date.
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(day);
  const prefix = lang === "ro" ? "Vortex-Plan-Digital" : "Vortex-Blueprint";
  return `${prefix}-${asciiSlug(subjectName(blueprint))}-${stamp}.pdf`;
}

/**
 * Renders the blueprint PDF in the browser and starts the download. The PDF
 * renderer, fonts and document load on demand, so none of it ships with the
 * scan page itself. Rejects if rendering fails (e.g. fonts can't be fetched).
 */
export async function downloadBlueprintPdf(blueprint: Blueprint, lang: Lang): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("downloadBlueprintPdf can only run in the browser");
  }

  const [
    { pdf },
    { BlueprintDocument },
    { registerPdfFonts },
    { resolvePdfAssets },
    { withMeasurements },
  ] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./BlueprintDocument"),
    import("./fonts"),
    import("./assets"),
    import("./measure"),
  ]);

  const origin = window.location.origin;
  registerPdfFonts(`${origin}/fonts`);

  // A quick first pass measures the blocks whose page breaks we choose.
  const props = await withMeasurements({
    blueprint,
    lang,
    reportUrl: window.location.href,
    assets: resolvePdfAssets((publicPath) => `${origin}${publicPath}`),
  });
  const element = createElement(BlueprintDocument, props) as unknown as ReactElement<DocumentProps>;

  const blob = await pdf(element).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = blueprintFileName(blueprint, lang);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

import { createElement, type ReactElement } from "react";

import type { DocumentProps } from "@react-pdf/renderer";

import { SIGNATORY } from "@/components/deep/contact";
import type { DeepReport, Lang } from "@/lib/deep/contracts";

import { deepPdfFileName, type DeepPdfVariant } from "./model";

/*
 * Browser entry of the deep report PDF. Import this module only behind the
 * SSR fence, so the PDF renderer never reaches the Worker bundle:
 *
 *   if (!import.meta.env.SSR) {
 *     const { downloadDeepReportPdf } = await import("@/components/deep/pdf/download");
 *     await downloadDeepReportPdf(report, { lang, variant: "full" });
 *   }
 *
 * The renderer, the fonts and the document load on demand inside these
 * functions (a second fence), so nothing ships with the /scan/deep page.
 */

export type DeepPdfOptions = {
  lang?: Lang;
  /** "full" (default) or "brief" (the one-page "Pe scurt"). */
  variant?: DeepPdfVariant;
  /** The public sample report ("Exemplu cu o firmă inventată" on every page). */
  sample?: boolean;
  /** Server storage is on: print the /scan/deep?verify= link next to the code. */
  verifiable?: boolean;
};

/** The signatory photo from src/components/deep/contact.ts, when the owner has sent it. */
async function photoIfPresent(origin: string): Promise<string | null> {
  if (!SIGNATORY.photo) return null;
  const url = `${origin}${SIGNATORY.photo}`;
  try {
    const response = await fetch(url, { method: "HEAD" });
    const type = response.headers.get("content-type") ?? "";
    // React-PDF draws PNG and JPEG only.
    return response.ok && /image\/(jpeg|png)/.test(type) ? url : null;
  } catch {
    return null;
  }
}

/** Renders the PDF to a Blob (for the share sheet, "Trimite contabilului"). */
export async function renderDeepReportPdf(
  report: DeepReport,
  options: DeepPdfOptions = {},
): Promise<Blob> {
  if (import.meta.env.SSR || typeof window === "undefined") {
    throw new Error("renderDeepReportPdf runs in the browser only");
  }
  const [
    { pdf, Font },
    { DeepReportDocument },
    { registerPdfFonts },
    { resolvePdfAssets },
    { freshPdfFonts },
  ] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./DeepReportDocument"),
    import("@/components/scan/pdf/fonts"),
    import("@/components/scan/pdf/assets"),
    import("./fonts"),
  ]);
  const origin = window.location.origin;
  registerPdfFonts(`${origin}/fonts`);
  const element = createElement(DeepReportDocument, {
    report,
    lang: options.lang ?? report.lang,
    variant: options.variant ?? "full",
    sample: options.sample,
    verifiable: options.verifiable,
    photo: await photoIfPresent(origin),
    assets: resolvePdfAssets((publicPath) => `${origin}${publicPath}`),
  }) as unknown as ReactElement<DocumentProps>;
  // Fresh font instances before and after: a render may otherwise print wrong letters (fonts.ts).
  freshPdfFonts(Font);
  try {
    return await pdf(element).toBlob();
  } finally {
    freshPdfFonts(Font);
  }
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Renders the PDF and starts the download. Rejects if rendering fails (e.g. fonts can't load). */
export async function downloadDeepReportPdf(
  report: DeepReport,
  options: DeepPdfOptions = {},
): Promise<void> {
  const blob = await renderDeepReportPdf(report, options);
  saveBlob(blob, deepPdfFileName(report, options.lang ?? report.lang, options.variant ?? "full"));
}

/**
 * Shares the PDF through the system share sheet where files can be shared
 * (phones), else downloads it. Resolves "shared", "downloaded" or "canceled".
 */
export async function shareDeepReportPdf(
  report: DeepReport,
  options: DeepPdfOptions & { title?: string; text?: string } = {},
): Promise<"shared" | "downloaded" | "canceled"> {
  const blob = await renderDeepReportPdf(report, options);
  const name = deepPdfFileName(report, options.lang ?? report.lang, options.variant ?? "full");
  const file = new File([blob], name, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: options.title ?? name, text: options.text });
      return "shared";
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return "canceled";
    }
  }
  saveBlob(blob, name);
  return "downloaded";
}

export { deepPdfFileName };

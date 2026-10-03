import type { BlueprintDocumentProps } from "./BlueprintDocument";

/*
 * React-PDF can't tell whether a block still fits on the current page. The
 * earlier layout chose some page breaks by hand from a measuring render; the
 * current pages flow (rows and blocks are unbreakable, wrap={false}), so no
 * block needs measuring and this pass returns the props as they are. The
 * entry point stays so callers (the download, scripts/scan/try-pdf.tsx) keep
 * one call shape if a measured break is ever needed again.
 */

/** The document props, ready for BlueprintDocument. */
export async function withMeasurements(
  props: BlueprintDocumentProps,
): Promise<BlueprintDocumentProps> {
  return props;
}

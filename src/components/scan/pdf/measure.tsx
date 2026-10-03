import type { ReactNode } from "react";

import { Document, Page, pdf } from "@react-pdf/renderer";

import type { BlueprintDocumentProps } from "./BlueprintDocument";
import { createContext, type PdfContext, type PdfMeasurements } from "./model";
import { OpportunityCard, OpportunityHead, OpportunityTotals } from "./pages-findings";
import { CONTACT, CONTENT_WIDTH, FONT, INK } from "./theme";

/*
 * React-PDF can't tell whether a block still fits on the current page, so
 * the blocks whose breaks we choose (the opportunity cards and their totals
 * table) are measured first: each is drawn on its own unbroken page of the
 * content width with no height set, which React-PDF grows to fit, and the
 * heights are read back from the pages' MediaBox entries. It costs one small extra
 * render; without it (or if it fails) the estimates in estimate.ts decide.
 */

/** Height of every page, in order, from the MediaBox entries of a PDF file. */
function pageHeights(bytes: Uint8Array): number[] {
  const source = new TextDecoder("latin1").decode(bytes);
  const boxes = source.matchAll(/\/MediaBox\s*\[\s*[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s*\]/g);
  return Array.from(boxes, (match) => Number(match[1]));
}

/** One block on a content-wide page with no set height, which React-PDF grows to fit. */
function measurePage(key: string, children: ReactNode) {
  return (
    <Page
      key={key}
      size={{ width: CONTENT_WIDTH }}
      wrap={false}
      style={{ fontFamily: FONT.body, color: INK.body, fontSize: 8.5 }}
    >
      {children}
    </Page>
  );
}

/** Measures the opportunity blocks; undefined when there are none or the render fails. */
export async function measureBlueprint(ctx: PdfContext): Promise<PdfMeasurements | undefined> {
  const opportunities = ctx.blueprint.opportunities;
  if (!opportunities.length) return undefined;
  try {
    const blob = await pdf(
      <Document>
        {measurePage("head", <OpportunityHead ctx={ctx} />)}
        {opportunities.map((o, i) =>
          measurePage(o.id, <OpportunityCard ctx={ctx} opportunity={o} index={i} />),
        )}
        {measurePage("totals", <OpportunityTotals ctx={ctx} />)}
      </Document>,
    ).toBlob();
    const heights = pageHeights(new Uint8Array(await blob.arrayBuffer()));
    if (heights.length !== opportunities.length + 2 || heights.some((h) => !(h > 0))) {
      return undefined;
    }
    return {
      opportunityHead: heights[0],
      opportunityCards: heights.slice(1, -1),
      opportunityTotals: heights[heights.length - 1],
    };
  } catch (error) {
    console.warn("[pdf] layout measurement failed; using estimates", error);
    return undefined;
  }
}

/** The document props with `measured` filled in, ready for BlueprintDocument. */
export async function withMeasurements(
  props: BlueprintDocumentProps,
): Promise<BlueprintDocumentProps> {
  const { blueprint, lang, reportUrl, assets } = props;
  const ctx = createContext(blueprint, lang, reportUrl || `${CONTACT.siteUrl}/scan`, assets);
  return { ...props, measured: await measureBlueprint(ctx) };
}

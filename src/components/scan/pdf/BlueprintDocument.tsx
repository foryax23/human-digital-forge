import { Document } from "@react-pdf/renderer";

import type { Blueprint, Lang } from "@/lib/scan/types";

import type { PdfAssets } from "./assets";
import { pick } from "./format";
import { createContext, isLightPlan, type PdfMeasurements } from "./model";
import { AuditPage, OpportunitiesPage, SnapshotPage } from "./pages-findings";
import { CoverPage, SummaryPage } from "./pages-intro";
import {
  BackCover,
  MethodologyPage,
  OfferPage,
  PlanPage,
  RoadmapPage,
  StrategyPage,
} from "./pages-plan";
import { CONTACT } from "./theme";

export type BlueprintDocumentProps = {
  blueprint: Blueprint;
  lang: Lang;
  /** Link to the live, animated report (the page the PDF was downloaded from). */
  reportUrl?: string;
  /** Brand images: absolute URLs in the browser, file paths in Node (see resolvePdfAssets). */
  assets: PdfAssets;
  /** Block heights from measureBlueprint (see withMeasurements); estimates stand in without them. */
  measured?: PdfMeasurements;
};

/**
 * The personalised Vortex blueprint: cover, summary with the three scores,
 * company snapshot, website audit, automation opportunities, strategy options,
 * roadmap, the offer, the methodology and the back cover. Sections without
 * data (no website, nothing to automate) are left out instead of printing
 * empty pages. Fonts must be registered first (registerPdfFonts).
 */
export function BlueprintDocument({
  blueprint,
  lang,
  reportUrl,
  assets,
  measured,
}: BlueprintDocumentProps) {
  const ctx = createContext(
    blueprint,
    lang,
    reportUrl || `${CONTACT.siteUrl}/scan`,
    assets,
    measured,
  );
  // Pages read the cleaned-up copy in ctx (see createContext), not the raw prop.
  const { blueprint: data } = ctx;
  const title = `${ctx.t("Digital blueprint", "Plan digital")} · ${ctx.name}`;
  return (
    <Document
      title={title}
      author="Vortex Hub"
      creator="Vortex Hub"
      producer="Vortex Hub"
      subject={pick(data.headline, lang)}
      keywords={ctx.t(
        "Vortex Hub, digital blueprint, automation",
        "Vortex Hub, plan digital, automatizare",
      )}
      language={lang === "ro" ? "ro-RO" : "en-GB"}
    >
      <CoverPage ctx={ctx} />
      <SummaryPage ctx={ctx} />
      <SnapshotPage ctx={ctx} />
      {data.audit ? <AuditPage ctx={ctx} /> : null}
      {data.opportunities.length ? <OpportunitiesPage ctx={ctx} /> : null}
      {isLightPlan(data) ? (
        <PlanPage ctx={ctx} />
      ) : (
        <>
          <StrategyPage ctx={ctx} />
          <RoadmapPage ctx={ctx} />
        </>
      )}
      <OfferPage ctx={ctx} />
      <MethodologyPage ctx={ctx} />
      <BackCover ctx={ctx} />
    </Document>
  );
}

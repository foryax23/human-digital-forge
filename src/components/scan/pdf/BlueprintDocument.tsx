import { Document } from "@react-pdf/renderer";

import type { Blueprint, Lang } from "@/lib/scan/types";

import type { PdfAssets } from "./assets";
import { monthsQty, pick } from "./format";
import { createContext, hasImpact, isLightPlan, planSpan, type PdfMeasurements } from "./model";
import { AuditPage, SnapshotPage } from "./pages-findings";
import { CoverPage, SummaryPage } from "./pages-intro";
import {
  BackCover,
  ImpactPage,
  MethodologyPage,
  OfferPage,
  OpportunitiesPage,
  PlanPage,
  RoadmapPage,
  WorkPage,
} from "./pages-plan";
import { COMPANY, CONTACT } from "./theme";

export type BlueprintDocumentProps = {
  blueprint: Blueprint;
  lang: Lang;
  /** Link to the live report (the page the PDF was downloaded from). */
  reportUrl?: string;
  /** Brand images: absolute URLs in the browser, file paths in Node (see resolvePdfAssets). */
  assets: PdfAssets;
  /** Block heights from a first render (see withMeasurements); optional. */
  measured?: PdfMeasurements;
};

/**
 * The Vortex report: cover, summary, company profile, website audit, what can
 * be automated, the directions, the plan month by month, the impact, the
 * offer, how we worked it out and the back cover. Every figure comes from
 * displayPlan(), the selector the scan screens read, so the PDF prints the
 * numbers of the web results. Sections without data (no website, nothing to
 * automate) are left out instead of printing empty pages. Fonts must be
 * registered first (registerPdfFonts).
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
  const span = monthsQty(planSpan(ctx.plan));
  const title = ctx.t(
    `Analysis and ${span.en} plan for ${ctx.name}`,
    `Analiză și plan pe ${span.ro} pentru ${ctx.name}`,
  );
  return (
    <Document
      title={title}
      author={COMPANY.legalName}
      creator={COMPANY.legalName}
      producer={COMPANY.legalName}
      subject={pick(ctx.plan.text.headline, lang)}
      keywords={ctx.t(
        "Vortex Hub, report, automation, plan",
        "Vortex Hub, raport, automatizare, plan",
      )}
      language={lang === "ro" ? "ro-RO" : "en-GB"}
    >
      <CoverPage ctx={ctx} />
      <SummaryPage ctx={ctx} />
      <SnapshotPage ctx={ctx} />
      {data.audit ? <AuditPage ctx={ctx} /> : null}
      {isLightPlan(ctx) ? (
        <>
          {data.opportunities.length ? <OpportunitiesPage ctx={ctx} /> : null}
          <PlanPage ctx={ctx} />
        </>
      ) : (
        <>
          <WorkPage ctx={ctx} />
          <RoadmapPage ctx={ctx} />
        </>
      )}
      {hasImpact(ctx) ? <ImpactPage ctx={ctx} /> : null}
      <OfferPage ctx={ctx} />
      <MethodologyPage ctx={ctx} />
      <BackCover ctx={ctx} />
    </Document>
  );
}

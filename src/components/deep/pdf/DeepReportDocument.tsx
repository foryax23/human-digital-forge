import { Document } from "@react-pdf/renderer";

import { COMPANY } from "@/lib/scan/legal/company";

import { createDeepContext, sectionText, type DeepPdfInput, type DeepPdfVariant } from "./model";
import { BriefPages, CoverPage, OnePage } from "./pages-brief";
import { FiguresPage, RiskPage, SitePage } from "./pages-detail";
import { AppendixPage, PlanPage } from "./pages-plan";

export type DeepReportDocumentProps = DeepPdfInput & { variant?: DeepPdfVariant };

/**
 * The deep research PDF (plan A11), built in the browser from the report JSON:
 * cover; "Pe scurt"; "Cifre și comparații"; "Site și prezență"; "Risc,
 * registre și echipă"; the plan for 30, 60 and 90 days with the signed offer
 * of a call (owners only; third parties get "Ce să verifici" in "Pe scurt"
 * instead); then the appendix "Surse și metodă". Light pages for print, at
 * most 8 before the appendix. `variant: "brief"` is the one-page "Pe scurt"
 * for forwarding. Fonts must be registered first (registerPdfFonts).
 */
export function DeepReportDocument({ variant = "full", ...input }: DeepReportDocumentProps) {
  const ctx = createDeepContext(input);
  const subject = [
    sectionText(ctx.report.brief?.headline),
    ctx.report.aiMode === "ai"
      ? ctx.t("text drafted with AI", "text redactat cu ajutorul AI")
      : ctx.t("rule-based analysis, no AI", "analiză pe reguli, fără AI"),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Document
      title={ctx.t(`Deep Research: ${ctx.name}`, `Deep Research: ${ctx.name}`)}
      author={COMPANY.legalName}
      creator={COMPANY.legalName}
      producer={COMPANY.legalName}
      subject={subject}
      keywords={ctx.t(
        "Vortex Hub, Deep Research, report",
        "Vortex Hub, Deep Research, cercetare aprofundată, raport",
      )}
      language={ctx.lang === "ro" ? "ro-RO" : "en-GB"}
    >
      {variant === "brief" ? (
        <OnePage ctx={ctx} />
      ) : (
        <>
          <CoverPage ctx={ctx} />
          <BriefPages ctx={ctx} />
          <FiguresPage ctx={ctx} />
          <SitePage ctx={ctx} />
          <RiskPage ctx={ctx} />
          {ctx.owner ? <PlanPage ctx={ctx} /> : null}
          <AppendixPage ctx={ctx} />
        </>
      )}
    </Document>
  );
}

import { useId, useState } from "react";

import { Button, Count, Priority, type PriorityLevel } from "@/components/system";
import { useI18n } from "@/i18n";
import { compareFindings } from "@/lib/scan/blueprint/strategies";
import { localizeEvidence } from "@/lib/scan/localize";
import type { AuditFinding, Severity } from "@/lib/scan/types";
import { pick } from "../../report/format";
import { SubHeading } from "./shared";

const LEVEL: Record<Severity, PriorityLevel> = {
  critical: "high",
  high: "high",
  medium: "medium",
  low: "low",
};
/** Rows shown before "Arată toate". */
const FIRST = 6;

/**
 * "Ce am găsit pe site": the audit findings sorted by priority, as a dense table from
 * 1024 px (priority, the problem with its measured proof, what we would do, the effort)
 * and stacked rows on phones. One marker per row: the three-bar priority signal.
 */
export function FindingsList({ findings }: { findings: AuditFinding[] }) {
  const { t, lang } = useI18n();
  const headingId = useId();
  const [all, setAll] = useState(false);
  // The same order as the plan and the PDF: severity, then effort.
  const sorted = [...findings].sort(compareFindings);
  const shown = all ? sorted : sorted.slice(0, FIRST);

  const effort = (finding: AuditFinding) =>
    ({
      quick: t("little effort", "efort mic"),
      medium: t("medium effort", "efort mediu"),
      project: t("a lot of effort", "efort mare"),
    })[finding.effort];

  const columns = "lg:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1fr)_7rem]";

  return (
    <section aria-labelledby={headingId}>
      <SubHeading
        id={headingId}
        meta={
          <span className="inline-flex items-center gap-1.5">
            {t("Problems", "Probleme")} <Count>{findings.length}</Count>
          </span>
        }
      >
        {t("What we found on the website", "Ce am găsit pe site")}
      </SubHeading>

      <div
        aria-hidden
        className={`hidden gap-x-6 border-b border-rule pb-2 text-xs font-medium text-fg-3 lg:grid ${columns}`}
      >
        <span>{t("Priority", "Prioritate")}</span>
        <span>{t("Problem", "Problema")}</span>
        <span>{t("What we do", "Ce facem")}</span>
        <span className="text-right">{t("Effort", "Efort")}</span>
      </div>
      <ol className="divide-y divide-line-1 border-b border-line-1 lg:border-b-0">
        {shown.map((finding) => {
          const detail = pick(finding.detail, lang);
          const evidence = finding.evidence ? localizeEvidence(finding.evidence, lang) : null;
          // The proof line only when the detail doesn't already quote the measured value.
          const quoted = evidence?.match(/\d+(?:[.,]\d+)?/)?.[0];
          const showEvidence = Boolean(
            evidence && !(quoted && quoted.length > 1 && detail.includes(quoted)),
          );
          return (
            <li key={finding.id} className={`grid gap-x-6 gap-y-1.5 py-3 ${columns}`}>
              <div className="flex items-center justify-between gap-3 lg:block">
                <Priority level={LEVEL[finding.severity]}>
                  {finding.severity === "critical" ? t("Urgent", "Urgent") : undefined}
                </Priority>
                <span className="text-xs text-fg-3 lg:hidden">{effort(finding)}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-[1.4] text-fg">
                  {pick(finding.title, lang)}
                </p>
                <p className="mt-0.5 text-[0.8125rem] leading-[1.45] text-fg-3">{detail}</p>
                {showEvidence ? (
                  <p className="mt-0.5 text-[0.8125rem] leading-[1.45] text-fg-3">
                    <span className="text-fg-2">{t("What we saw: ", "Ce am văzut: ")}</span>
                    {evidence}
                  </p>
                ) : null}
              </div>
              <p className="min-w-0 text-[0.8125rem] leading-[1.45] text-fg-2">
                {/* One label at every width: the column head on desktop, inline on phones. */}
                <span className="font-medium text-fg lg:sr-only">
                  {t("What we do: ", "Ce facem: ")}
                </span>
                {pick(finding.recommendation, lang)}
              </p>
              <p className="hidden text-right text-xs leading-[1.45] text-fg-3 lg:block">
                {effort(finding)}
              </p>
            </li>
          );
        })}
      </ol>
      {sorted.length > FIRST ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 -ml-2.5"
          onClick={() => setAll((v) => !v)}
        >
          {all
            ? t("Show fewer", "Arată mai puține")
            : t(`Show all ${sorted.length}`, `Arată toate cele ${sorted.length}`)}
        </Button>
      ) : null}
    </section>
  );
}

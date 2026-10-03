import { useId, useState } from "react";

import type { ScanState } from "@/components/scan/scan-state";
import { DeepEntry } from "@/components/deep/DeepEntry";
import { Button, Panel } from "@/components/system";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { getBusinessType } from "@/lib/scan/blueprint/taxonomy";
import { withCommaBelow } from "@/lib/scan/localize";
import type { Blueprint } from "@/lib/scan/types";
import { displayHost, pick } from "../report/format";
import { StepHeader } from "../report/StepHeader";
import { CompanyStrip } from "./overview/CompanyStrip";
import { JourneyPanel } from "./overview/JourneyPanel";
import { MarketPanel } from "./overview/MarketPanel";
import { PresencePanel } from "./overview/PresencePanel";
import { shortName } from "./overview/names";
import type { EditPatch } from "./overview/shared";
import { TechnologiesPanel } from "./overview/TechnologiesPanel";

type TabId = "presence" | "technologies" | "market" | "journey";

/**
 * Step 3a, what the scan found: the company strip (editable), then one panel with four
 * underline tabs (online presence, technologies, market, customer journey). Only
 * measured data is shown; anything we couldn't check says so. The parts live in
 * ./overview; this file keeps the orchestration.
 */
export function OverviewStep({
  state,
  blueprint,
  demo: demoProp,
  onEdit,
  onContinue,
}: {
  state: ScanState;
  blueprint: Blueprint;
  /** Sample data (the flow's ?demo=): adds the "Date de exemplu" tag. */
  demo?: boolean;
  onEdit: (patch: EditPatch) => void;
  onContinue: () => void;
}) {
  const { t, lang } = useI18n();
  const headingId = useId();
  const [tab, setTab] = useState<TabId>("presence");

  const company = blueprint.company ?? state.company ?? undefined;
  const audit = blueprint.audit ?? state.audit ?? undefined;
  const pagespeed = audit?.pagespeed ?? state.pagespeed ?? undefined;
  const presence = blueprint.presence ?? state.presence ?? undefined;
  const competitors = blueprint.competitors ?? state.competitors ?? [];
  const typeLabel = pick(blueprint.businessType.label, lang);
  const name = shortName(
    withCommaBelow(
      company?.displayName ?? displayHost(audit?.finalUrl ?? blueprint.target.url) ?? "",
    ),
  );
  // Sample data (/scan?demo=…): the flow says so; a stored sample also carries a "demo-" id.
  const demo = demoProp ?? blueprint.id.startsWith("demo-");

  // Phones get the short names so all four tabs fit without scrolling the row.
  const tabs: Array<{ id: TabId; label: string; short: string }> = [
    {
      id: "presence",
      label: t("Online presence", "Prezență online"),
      short: t("Presence", "Prezență"),
    },
    { id: "technologies", label: t("Technologies", "Tehnologii"), short: t("Tech", "Tehnologii") },
    { id: "market", label: t("Market", "Piață"), short: t("Market", "Piață") },
    {
      id: "journey",
      label: t("Customer journey", "Parcursul clientului"),
      short: t("Journey", "Parcurs"),
    },
  ];
  const next = t("See the three directions", "Vezi cele trei direcții");

  return (
    <section aria-labelledby={headingId} className="w-full">
      <StepHeader
        id={headingId}
        demo={demo}
        title={
          name
            ? t(`What we found about ${name}`, `Ce am găsit despre ${name}`)
            : t("What we found", "Ce am găsit")
        }
        lead={t("Public data, nothing estimated.", "Date publice, nimic estimat.")}
        actions={
          <Button size="lg" onClick={onContinue} className="max-md:hidden">
            {next}
          </Button>
        }
      />

      <div className="mt-6 space-y-6 max-sm:space-y-4">
        <CompanyStrip
          blueprint={blueprint}
          company={company}
          audit={audit}
          presence={presence}
          onEdit={onEdit}
        />
        <DeepEntry variant="compact" blueprint={blueprint} />

        <Panel as="section" aria-label={t("Findings", "Rezultatele analizei")}>
          <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
            <TabsList
              aria-label={t("Findings", "Rezultatele analizei")}
              className="h-11 gap-5 px-4 sm:gap-6 sm:px-5"
            >
              {tabs.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>
                  <span className="sm:hidden">{item.short}</span>
                  <span className="max-sm:hidden">{item.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="presence" className="mt-0 p-4 sm:p-5">
              <PresencePanel
                blueprint={blueprint}
                audit={audit}
                pagespeed={pagespeed}
                presence={presence}
                websiteFailed={
                  state.steps.find((step) => step.id === "website")?.status === "failed"
                }
              />
            </TabsContent>
            <TabsContent value="technologies" className="mt-0 p-4 sm:p-5">
              <TechnologiesPanel audit={audit} />
            </TabsContent>
            <TabsContent value="market" className="mt-0 p-4 sm:p-5">
              <MarketPanel
                competitors={competitors}
                audit={audit}
                company={company}
                typeLabel={typeLabel}
              />
            </TabsContent>
            <TabsContent value="journey" className="mt-0 p-4 sm:p-5">
              <JourneyPanel
                audit={audit}
                presence={presence}
                company={company}
                bookings={getBusinessType(blueprint.businessType.id).bookings}
              />
            </TabsContent>
          </Tabs>
        </Panel>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-4 border-t border-line-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[60ch] text-sm leading-[1.5] text-fg-2">
          {t(
            "Next: three directions for the business, each with its cost and what it brings.",
            "Urmează: trei direcții pentru afacere, fiecare cu costul și câștigul ei.",
          )}
        </p>
        <Button size="lg" onClick={onContinue} className="max-sm:w-full">
          {next}
        </Button>
      </div>
    </section>
  );
}

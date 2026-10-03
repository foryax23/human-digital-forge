import { useCallback, useEffect, useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonClass, Panel, PanelBody, SegmentedControl, Tag } from "@/components/system";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DeepReport } from "@/lib/deep/contracts";
import { factLabel } from "@/lib/deep/parse/labels";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { whatsappLink } from "../contact";
import { RULES_LABEL } from "../copy";
import { dayLabel } from "../format";
import { diffReports } from "../report-adapter";
import { summaryText } from "../summary";
import { noPrintClass, reportClass } from "../theme-context";
import { Actions, type AdjustField } from "./Actions";
import { AdminPanel } from "./AdminPanel";
import {
  CustomerView,
  Details,
  Findings,
  FiguresStrip,
  IfNothing,
  Lines,
  Meaning,
  NextLink,
  TrustStrip,
} from "./Brief";
import { CallBlock } from "./CallBlock";
import { useReport, type ReportTab } from "./context";
import { EvidenceTab } from "./Evidence";
import { FiguresTab } from "./Figures";
import { Feedback, ReportFooter } from "./Footer";
import { Rivals } from "./Rivals";
import { isPartial, TAG_13 } from "./helpers";
import { Sentences } from "./shared";

/*
 * The finished report (plan A1, A10): tabs "Pe scurt" · "Cifre și comparații" · "Dovezi și
 * surse" (a segmented control "Pe scurt · Cifre · Dovezi" on phones, the full names as
 * headings inside each tab), the call and the tools in a side column on wide screens, and the
 * sticky bar on phones (Discutăm · WhatsApp · PDF).
 */

export function DeepReportView({
  tab,
  onTab,
  previous,
}: {
  tab: ReportTab;
  onTab: (tab: ReportTab) => void;
  previous?: { report: DeepReport; at: number } | null;
}) {
  const { t, lang } = useI18n();
  const ctx = useReport();
  const { report, onEvent, sample } = ctx;
  const [detail, setDetail] = useState<string | null>(null);
  const [adjust, setAdjust] = useState(false);
  const [adjustFocus, setAdjustFocus] = useState<AdjustField | undefined>(undefined);
  const onAdjustOpen = useCallback((open: boolean, focus?: AdjustField) => {
    setAdjust(open);
    setAdjustFocus(open ? focus : undefined);
  }, []);
  const third = report.audience === "third_party";
  const partial = isPartial(report);

  useEffect(() => {
    onEvent(`tab_${tab}`);
  }, [tab, onEvent]);

  const headline = report.brief.headline;
  const tabs: Array<{ id: ReportTab; label: string; short: string }> = [
    { id: "pe-scurt", label: t("In short", "Pe scurt"), short: t("In short", "Pe scurt") },
    {
      id: "cifre",
      label: t("Figures and comparisons", "Cifre și comparații"),
      short: t("Figures", "Cifre"),
    },
    {
      id: "dovezi",
      label: t("Evidence and sources", "Dovezi și surse"),
      short: t("Evidence", "Dovezi"),
    },
  ];
  const changes =
    previous && !sample
      ? diffReports(previous.report, report, lang, (f) => factLabel(f, lang))
      : [];

  // A line opens its reason in place (no jump down the page); the tap is counted.
  const openDetail = useCallback((area: string) => onEvent(`line_${area}`), [onEvent]);

  return (
    <div className={cn("min-w-0", reportClass)}>
      {/* Admins test cost and speed on a computer: there the panel is a strip above the tabs;
          on phones it waits at the end, so the first screen stays the report's. */}
      <div className={cn("mb-4 max-lg:hidden", noPrintClass, !ctx.access?.admin && "hidden")}>
        <AdminPanel />
      </div>
      <Tabs value={tab} onValueChange={(v) => onTab(v as ReportTab)}>
        <div className={noPrintClass}>
          <SegmentedControl<ReportTab>
            label={t("Report view", "Vederea raportului")}
            value={tab}
            onChange={onTab}
            options={tabs.map((x) => ({ value: x.id, label: x.short }))}
            className="h-12 w-full sm:hidden [&>button]:h-11 [&>button]:text-[0.9375rem]"
          />
          <TabsList
            aria-label={t("Report view", "Vederea raportului")}
            className="h-11 max-sm:hidden"
          >
            {tabs.map((x) => (
              <TabsTrigger key={x.id} value={x.id}>
                {x.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="pe-scurt" className="mt-3 sm:mt-6">
          <h2 className="sr-only">{tabs[0].label}</h2>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_23rem]">
            <div className="min-w-0 space-y-8 sm:space-y-10">
              <div className="space-y-3 sm:space-y-4">
                {partial ? (
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.875rem] leading-[1.4] text-fg-2">
                    <Tag variant="dashed" className={TAG_13}>
                      {t("Partial report", "Raport parțial")}
                    </Tag>
                    <span className="sm:hidden">{partialLine(report, t, true)}</span>
                    <span className="max-sm:hidden">{partialLine(report, t)}</span>
                  </p>
                ) : null}
                <FiguresStrip
                  onAdjust={() => {
                    onAdjustOpen(true, "turnover2026");
                    window.requestAnimationFrame(() =>
                      document.getElementById("ajusteaza")?.scrollIntoView({ block: "start" }),
                    );
                  }}
                />
                <Sentences
                  as="p"
                  section={headline}
                  className="type-title max-w-[30ch] text-balance text-fg [font-size:1.375rem] min-[380px]:[font-size:clamp(1.5rem,1.3rem+0.8vw,1.875rem)]"
                />
                <Lines lights={report.lights} onOpen={openDetail} />
                <NextLink />
              </div>
              <Meaning />
              <TrustStrip />
              {changes.length ? (
                <section aria-labelledby="schimbari" className="min-w-0">
                  <h2 id="schimbari" className="type-h4 text-fg">
                    {t(
                      `What changed since the report of ${dayLabel(new Date(previous!.at).toISOString(), "en")}`,
                      `Ce s-a schimbat față de raportul din ${dayLabel(new Date(previous!.at).toISOString(), "ro")}`,
                    )}
                  </h2>
                  <ul className="mt-2 border-t border-line-1">
                    {changes.map((c) => (
                      <li
                        key={c.id}
                        className="grid gap-x-4 border-b border-line-1 py-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
                      >
                        <span className="text-[0.875rem] text-fg-3">{c.label}</span>
                        <span className="text-fg">
                          {c.before ? (
                            <>
                              <span className="text-fg-3 line-through">{c.before}</span> → {c.after}
                            </>
                          ) : (
                            <>
                              {c.after} <span className="text-fg-3">({t("new", "nou")})</span>
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <Findings />
              <Actions adjustOpen={adjust} adjustFocus={adjustFocus} onAdjustOpen={onAdjustOpen} />
              <Rivals />
              <CustomerView />
              <IfNothing />
              {!third ? (
                <div className="lg:hidden">
                  <CallBlock />
                </div>
              ) : null}
              <div className="lg:hidden">
                <Tools />
              </div>
              <Details open={detail} onToggle={setDetail} />
              <Feedback />
              <ReportFooter />
            </div>
            {/* Desktop: keep-or-send first (the reader's own tools), then the call, which alone
                stays in view while scrolling (the column is never taller than the screen). */}
            <aside className="min-w-0 space-y-6 max-lg:hidden">
              <Tools />
              {!third ? (
                <div className="sticky top-24">
                  <Panel>
                    <PanelBody>
                      <CallBlock id="discutam-aside" />
                    </PanelBody>
                  </Panel>
                </div>
              ) : null}
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="cifre" className="mt-4 sm:mt-6">
          <h2 className="type-title mb-6 text-fg">{tabs[1].label}</h2>
          <FiguresTab />
        </TabsContent>
        <TabsContent value="dovezi" className="mt-4 sm:mt-6">
          <h2 className="type-title mb-6 text-fg">{tabs[2].label}</h2>
          <EvidenceTab />
        </TabsContent>
      </Tabs>

      <div className={cn("mt-10 lg:hidden", noPrintClass, !ctx.access?.admin && "hidden")}>
        <AdminPanel />
      </div>

      <StickyBar />
    </div>
  );
}

/** PDF in the browser through a fenced dynamic import (react-pdf never reaches the Worker). */
async function pdf(
  report: DeepReport,
  how: "download" | "share",
  variant: "full" | "brief",
  sample: boolean,
  lang: "ro" | "en",
  verifiable: boolean,
) {
  if (import.meta.env.SSR) return;
  const mod = await import("@/components/deep/pdf/download");
  const opts = { lang, variant, sample, verifiable };
  if (how === "download") await mod.downloadDeepReportPdf(report, opts);
  else await mod.shareDeepReportPdf(report, opts);
}

/**
 * The PDF's code can be checked online when the report was kept on the server: the stopgap
 * rows and the tables both answer /scan/deep?verify= (the run's store, else today's access).
 */
function useVerifiable(): boolean {
  const { sample, access, store, report } = useReport();
  if (sample || !report.verifyCode) return false;
  if (store) return store !== "memory";
  return access?.persistence === "tables" || access?.persistence === "stopgap";
}

/** "Raport parțial: …" in one line, naming what did not finish. */
function partialLine(
  report: DeepReport,
  t: (en: string, ro: string) => string,
  short = false,
): string {
  const peers = report.gaps.some(
    (g) => g.section === "peers" && /Neverificat în această rulare|parțial/.test(g.where.ro),
  );
  if (short)
    return peers
      ? t("the Money line may be incomplete.", "linia Bani poate fi incompletă.")
      : t("some steps did not finish.", "unii pași nu s-au terminat.");
  return peers
    ? t(
        "the comparison with similar firms did not finish; the Money verdict may be incomplete.",
        "comparația cu firme similare nu s-a terminat; verdictul la Bani poate fi incomplet.",
      )
    : t(
        "some steps did not finish; see “What we could not check”.",
        "unii pași nu s-au terminat; vezi «Ce nu am putut verifica».",
      );
}

function Tools() {
  const { t, lang } = useI18n();
  const { report, sample, onEvent } = useReport();
  const verifiable = useVerifiable();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    try {
      await work();
      onEvent(key);
    } catch {
      toast.error(
        t(
          "The PDF could not be made. Try again.",
          "PDF-ul nu a putut fi generat. Încearcă din nou.",
        ),
      );
    } finally {
      setBusy(null);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(report, lang));
      toast.success(t("Summary copied", "Rezumatul e copiat"));
      onEvent("summary_copied");
    } catch {
      toast.error(t("Could not copy", "Nu am putut copia"));
    }
  };
  return (
    <section aria-labelledby="pastreaza" className={cn("min-w-0", noPrintClass)}>
      <h2 id="pastreaza" className="type-h4 text-fg">
        {t("Keep or send the report", "Păstrează sau trimite raportul")}
      </h2>
      <div className="mt-2 flex flex-col items-start gap-1">
        <Button
          variant="ghost"
          className="-ml-3 h-11"
          icon={<Download aria-hidden />}
          loading={busy === "pdf_full"}
          onClick={() =>
            run("pdf_full", () => pdf(report, "download", "full", sample, lang, verifiable))
          }
        >
          {t("Download the PDF", "Descarcă PDF-ul")}
        </Button>
        <Button
          variant="ghost"
          className="-ml-3 h-11"
          icon={<Share2 aria-hidden />}
          loading={busy === "pdf_share"}
          onClick={() =>
            run("pdf_share", () => pdf(report, "share", "full", sample, lang, verifiable))
          }
        >
          {t("Send to your accountant", "Trimite contabilului")}
        </Button>
        <Button
          variant="ghost"
          className="-ml-3 h-11"
          icon={<Share2 aria-hidden />}
          loading={busy === "pdf_brief"}
          onClick={() =>
            run("pdf_brief", () => pdf(report, "share", "brief", sample, lang, verifiable))
          }
        >
          {t("Send the one-page summary", "Trimite pe scurt")}
        </Button>
        <Button variant="ghost" className="-ml-3 h-11" icon={<Copy aria-hidden />} onClick={copy}>
          {t("Copy the summary", "Copiază rezumatul")}
        </Button>
      </div>
    </section>
  );
}

/** Phones: Discutăm · WhatsApp · PDF, always in reach (owners); PDF and copy for others. */
function StickyBar() {
  const { t, lang } = useI18n();
  const { report, sample, onEvent } = useReport();
  const verifiable = useVerifiable();
  const third = report.audience === "third_party";
  const [busy, setBusy] = useState(false);
  const wa = third ? null : whatsappLink(report.company.displayName, report.cui, lang);
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line-2 bg-background px-4 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5 sm:hidden",
        noPrintClass,
      )}
    >
      <div className="flex gap-2">
        {!third ? (
          <Button
            size="lg"
            className="h-11 flex-1"
            onClick={() => {
              onEvent("cta_bar");
              document.getElementById("discutam")?.scrollIntoView({ block: "start" });
            }}
          >
            {t("Let's talk", "Discutăm")}
          </Button>
        ) : null}
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className={buttonClass("secondary", "lg", "h-11 flex-1")}
            onClick={() => onEvent("cta_whatsapp_bar")}
          >
            WhatsApp
          </a>
        ) : null}
        <Button
          variant="secondary"
          size="lg"
          className="h-11 flex-1"
          icon={<Download aria-hidden />}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await pdf(report, "download", "full", sample, lang, verifiable);
              onEvent("pdf_bar");
            } catch {
              toast.error(
                t(
                  "The PDF could not be made. Try again.",
                  "PDF-ul nu a putut fi generat. Încearcă din nou.",
                ),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          PDF
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useId, useMemo, useState } from "react";
import { Check, ChevronLeft, Copy, Download } from "lucide-react";

import { useI18n } from "@/i18n";
import {
  displayPlan,
  kpiCells,
  tableRows,
  type DisplayPlan,
  type Horizon,
} from "@/lib/scan/blueprint/display";
import { approxLei, hoursPerMonth, monthsQty } from "@/lib/scan/blueprint/format";
import type { Blueprint, VortexOffer } from "@/lib/scan/types";
import {
  Button,
  ButtonLink,
  buttonClass,
  NoteList,
  NoteRef,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  SegmentedControl,
  Stat,
  StatStrip,
  Status,
  StepHeader,
  Tag,
} from "@/components/system";
import { cn } from "@/lib/utils";
import { LeadGateDialog } from "../LeadGateDialog";
import { StepBarActions } from "../ScanShell";
import { formatNumber, NBSP, pick } from "../report/format";
import { Gantt, type GanttRow } from "../report/Gantt";
import { ImpactChart } from "../report/ImpactChart";
import { companyLine, isSample, keepRanges, splitResult } from "../report/plan-copy";
import { Figures, Statement } from "../report/plan-text";

/**
 * Screen 04, the plan: "Pe scurt", the month-by-month calendar with hours and
 * cost, the impact chart with its KPI strip, what changes for the business,
 * the matching subscription and "Cum am calculat". Every figure comes from
 * displayPlan(), so the screen, the table and the PDF print the same numbers.
 */
export function ResultsStep({ blueprint, onBack }: { blueprint: Blueprint; onBack: () => void }) {
  const { t, lang } = useI18n();
  const headingId = useId();
  const plan = useMemo(() => displayPlan(blueprint), [blueprint]);
  const [leadOpen, setLeadOpen] = useState(false);
  const span = Math.max(6, ...plan.phases.map((p) => p.months[1]));
  const { company, place } = companyLine(blueprint);
  // Phones keep the lead's first sentence; "ranges and assumptions are in the notes" is
  // for the wider screens, where the notes are in reach.
  const lead = keepRanges(pick(plan.text.lead, lang));
  const cut = lead.indexOf(". ");

  return (
    <>
      <section aria-labelledby={headingId} className="w-full">
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
          <StepHeader
            id={headingId}
            className="lg:col-span-6 lg:self-start"
            company={company}
            place={place}
            demo={isSample(blueprint)}
            title={t(
              `Your ${span}-month plan and its cost`,
              `Planul pe ${monthsQty(span).ro}: ce facem și cât costă`,
            )}
            lead={
              cut < 0 ? (
                lead
              ) : (
                <>
                  {lead.slice(0, cut + 1)}
                  <span className="max-sm:hidden"> {lead.slice(cut + 2)}</span>
                </>
              )
            }
          />
          <InShort plan={plan} className="lg:col-span-6" />
        </div>

        <div className="mt-4 grid items-start gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2 xl:grid-cols-12">
          <div data-results-col className="min-w-0 xl:col-span-7">
            <PlanPanel plan={plan} />
          </div>
          <div data-results-col className="flex min-w-0 flex-col gap-6 xl:col-span-5">
            <ImpactPanel plan={plan} />
            <WhatChanges plan={plan} />
          </div>
        </div>

        <BarActions onDownload={() => setLeadOpen(true)} />
        <OfferRow offer={blueprint.offer} feePayback={plan.text.feePayback} className="mt-8" />
        <KeepRow onDownload={() => setLeadOpen(true)} />

        <div id="cum-am-calculat" className="mt-6 scroll-mt-32">
          <NoteList
            title={t("How we worked it out", "Cum am calculat")}
            headingId={`${headingId}-notes`}
            items={[
              pick(plan.notes.payback, lang),
              pick(plan.notes.scope, lang),
              pick(plan.notes.hourValue, lang),
              ...plan.notes.assumptions.map((note) => pick(note, lang)),
            ]}
            footer={pick(plan.notes.disclaimer, lang)}
          />
        </div>

        <div className="mt-8 border-t border-line-1 pt-4">
          <Button
            variant="ghost"
            className="-ml-3"
            icon={<ChevronLeft aria-hidden />}
            onClick={onBack}
          >
            {t("Back to strategies", "Înapoi la strategii")}
          </Button>
        </div>
      </section>

      <LeadGateDialog blueprint={blueprint} open={leadOpen} onOpenChange={setLeadOpen} />
    </>
  );
}

/* ----------------------------------------------------------- "Pe scurt" */

function InShort({ plan, className }: { plan: DisplayPlan; className?: string }) {
  const { t, lang } = useI18n();
  const labelId = useId();
  return (
    <aside
      aria-labelledby={labelId}
      className={cn("min-w-0 lg:self-start lg:border-l lg:border-line-1 lg:pl-6", className)}
    >
      {/* fg-2: it sits straight on the backdrop, where fg-3 drops under 4.5:1. */}
      <p id={labelId} className="type-label text-fg-2">
        {t("In short", "Pe scurt")}
      </p>
      <ol className="mt-1.5 space-y-1">
        {plan.summary.map((line, i) => (
          <li key={i} className="flex gap-2.5 text-[0.9375rem] leading-[1.45] text-fg">
            <span className="type-pnum w-2.5 shrink-0 text-fg-3">{i + 1}</span>
            <span className="min-w-0 text-pretty">
              {keepRanges(pick(line, lang))}
              {i === 2 ? <NoteRef n={1} /> : null}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

/* ---------------------------------------------------------------- plan */

function PlanPanel({ plan }: { plan: DisplayPlan }) {
  const { t, lang } = useI18n();
  const titleId = useId();
  const [listOnly, setListOnly] = useState(false);
  const months = Math.max(6, ...plan.phases.map((p) => p.months[1]));

  const rows: GanttRow[] = plan.phases.map((phase) => ({
    key: phase.key,
    name: pick(phase.title, lang),
    segments: [phase.months],
    start: Boolean(phase.start),
    milestone: phase.siteMilestone,
    hours: phase.hoursPerMonth,
    hoursText: pick(phase.hoursText, lang),
    cost: phase.setupLei,
    costText: pick(phase.costText, lang),
    when: pick(phase.dateLabel, lang),
  }));
  const totalCost = approxLei(plan.totals.setupLei);

  return (
    <Panel as="section" aria-labelledby={titleId}>
      <PanelHeader
        titleId={titleId}
        title={pick(plan.text.roadmapTitle, lang)}
        sub={pick(plan.text.roadmapLead, lang)}
        actions={
          <Button
            variant="link"
            size="sm"
            className="text-fg-2 sm:hidden"
            aria-pressed={listOnly}
            onClick={() => setListOnly((v) => !v)}
          >
            {listOnly
              ? t("Show the calendar", "Vezi calendarul")
              : t("View as a list", "Vezi ca listă")}
          </Button>
        }
      />
      <PanelBody className={cn(listOnly && "max-sm:hidden")}>
        <Gantt
          rows={rows}
          months={months}
          label={t("Plan month by month", "Planul lună de lună")}
          total={{
            hours: plan.totals.hoursPerMonth,
            cost: plan.totals.setupLei,
            note: pick(plan.text.totalNote, lang),
            hoursText: pick(hoursPerMonth(plan.totals.hoursPerMonth), lang),
            costText: t(`${totalCost.en} one-off.`, `${totalCost.ro} o singură dată.`),
          }}
        />
      </PanelBody>

      <ol className="mx-4 border-t border-rule sm:mx-5">
        {plan.phases.map((phase) => (
          <li
            key={phase.key}
            className="grid gap-1 border-b border-line-1 py-3 last:border-b-0 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-0"
          >
            <p className="type-pnum text-[0.8125rem] leading-[1.35] text-fg-3 sm:pt-0.5">
              {pick(phase.dateLabel, lang)}
            </p>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h4 className="type-h4 text-fg">{pick(phase.title, lang)}</h4>
                {/* One marker per row: the start, else the phase that wins the most hours. */}
                {phase.start ? (
                  <Tag variant="start">{t("We start here", "Începem aici")}</Tag>
                ) : phase.mostTime ? (
                  <Status tone="brand">
                    {t("Most time won back", "Cel mai mult timp câștigat")}
                  </Status>
                ) : null}
              </div>
              {phase.start ? (
                <p className="mt-1 text-sm leading-[1.5] text-fg-2">
                  {pick(phase.start.reason, lang)}
                </p>
              ) : null}
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.8125rem] leading-[1.4] text-fg-3">
                <Figures text={pick(phase.hoursText, lang)} />
                <Figures text={pick(phase.costText, lang)} />
              </p>
              {phase.items.length ? (
                <ul className="mt-2 space-y-1">
                  {phase.items.slice(0, 4).map((item) => (
                    <li key={item.en} className="flex gap-2.5 text-sm leading-[1.45] text-fg-2">
                      <span aria-hidden className="mt-[0.7em] h-px w-1.5 shrink-0 bg-fg-3" />
                      <span className="min-w-0">{pick(item, lang)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {phase.brings ? (
                <p className="mt-2 text-sm leading-[1.5] text-fg-2">{pick(phase.brings, lang)}</p>
              ) : null}
              {phase.tools.length ? (
                <ToolsLine tools={phase.tools.map((tool) => pick(tool, lang))} />
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <PanelFooter>
        <span>{pick(plan.text.footer, lang)}</span>
        <a href="#cum-am-calculat" className={buttonClass("link", "sm", "text-fg-2")}>
          {t("How we worked it out", "Cum am calculat")}
        </a>
      </PanelFooter>
    </Panel>
  );
}

/** "Instrumente: calendar de programări, SMS, …": the first four, no hidden count. */
function ToolsLine({ tools }: { tools: string[] }) {
  const { t } = useI18n();
  return (
    <p className="mt-2 text-[0.8125rem] leading-[1.45] text-fg-3">
      {t("Tools", "Instrumente")}: {tools.slice(0, 4).join(", ")}.
    </p>
  );
}

/* -------------------------------------------------------------- impact */

function ImpactPanel({ plan }: { plan: DisplayPlan }) {
  const { t, lang } = useI18n();
  const titleId = useId();
  const tableId = useId();
  const [picked, setPicked] = useState<Horizon | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const covered = Math.max(0, ...plan.series.map((p) => p.month));
  const horizons = ([6, 12, 24] as const).filter((h) => h === 6 || covered >= h);
  const wanted = picked ?? plan.defaultHorizon;
  const horizon: Horizon = horizons.includes(wanted) ? wanted : horizons[horizons.length - 1];
  const cells = kpiCells(plan, horizon);
  const rows = tableRows(plan, horizon);

  return (
    <Panel as="section" aria-labelledby={titleId}>
      <PanelHeader
        titleId={titleId}
        title={pick(plan.text.conclusion, lang)}
        sub={pick(plan.text.chartLead, lang)}
        actions={
          <SegmentedControl<string>
            label={t("Period shown", "Perioada afișată")}
            value={String(horizon)}
            onChange={(value) => setPicked(Number(value) as Horizon)}
            options={horizons.map((h) => ({ value: String(h), label: pick(monthsQty(h), lang) }))}
          />
        }
      />
      <PanelBody className="pb-3">
        <ImpactChart plan={plan} horizon={horizon} />
      </PanelBody>

      <div data-kpi-strip className="border-t border-line-1">
        <StatStrip columns={4} label={t("Key figures", "Cifrele principale")}>
          {cells.map((cell) => {
            const text = pick(cell.value, lang);
            const money = text.split(NBSP);
            const unit = money.length > 1 && /^(lei|RON)$/.test(money[money.length - 1]);
            return (
              <Stat
                key={cell.key}
                label={pick(cell.label, lang)}
                value={unit ? money.slice(0, -1).join(NBSP) : text}
                unit={unit ? money[money.length - 1] : undefined}
                note={cell.note ? <NoteRef n={cell.note} /> : undefined}
                sub={pick(cell.sub, lang)}
                swatch={
                  cell.key === "value"
                    ? "bg-brand-line"
                    : cell.key === "cost"
                      ? "bg-fg/45"
                      : undefined
                }
              />
            );
          })}
        </StatStrip>
      </div>

      <div className="border-t border-line-1 px-4 py-3 sm:px-5">
        <button
          type="button"
          aria-expanded={tableOpen}
          aria-controls={tableId}
          onClick={() => setTableOpen((v) => !v)}
          className={buttonClass("link", "sm", "text-fg-2")}
        >
          {tableOpen
            ? t("Hide the table", "Ascunde tabelul")
            : t("See the figures in a table", "Vezi cifrele într-un tabel")}
        </button>
        {tableOpen ? (
          <table id={tableId} className="mt-3 w-full text-sm">
            <caption className="sr-only">
              {t(
                "Cumulative value of the hours, cost and net, in RON",
                "Valoarea orelor, costul și câștigul net, cumulat, în lei",
              )}
            </caption>
            <thead>
              <tr className="border-b border-rule text-left text-xs font-medium text-fg-3">
                <th scope="col" className="py-2 pr-2 font-medium">
                  {t("Month", "Luna")}
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  {t("Value of hours, RON", "Valoarea orelor, lei")}
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  {t("Cost, RON", "Cost, lei")}
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  {t("Net, RON", "Net, lei")}
                </th>
                <th scope="col" className="hidden py-2 pl-2 font-medium sm:table-cell">
                  {t("Status", "Stare")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.month}
                  className={cn("h-9 border-b border-line-1", row.breakEven && "bg-brand-tint")}
                >
                  <th
                    scope="row"
                    className="type-pnum py-1.5 pr-2 pl-0 text-left font-normal text-fg-2"
                  >
                    {pick(row.label, lang)}
                  </th>
                  <td className="type-num px-2 text-right text-fg">
                    {formatNumber(row.value, lang)}
                  </td>
                  <td className="type-num px-2 text-right text-fg">
                    {formatNumber(row.cost, lang)}
                  </td>
                  <td className="type-num px-2 text-right text-fg">
                    {row.net > 0 ? "+" : ""}
                    {formatNumber(row.net, lang)}
                  </td>
                  <td
                    className={cn(
                      "hidden pl-2 text-[0.8125rem] sm:table-cell",
                      row.breakEven ? "text-brand-fg" : "text-fg-3",
                    )}
                  >
                    {row.breakEven ? t("Pays back", "Se recuperează") : pick(row.status, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------ "Ce se schimbă" */

function WhatChanges({ plan }: { plan: DisplayPlan }) {
  const { t, lang } = useI18n();
  const titleId = useId();
  if (!plan.strategies.length) return null;
  // Note ⁴ is the first assumption (the share of questions the assistant takes).
  const assumptionNote = 4;

  return (
    <section aria-labelledby={titleId} className="@container border-t border-rule pt-4">
      <h3 id={titleId} className="type-h3 text-fg">
        {t("What changes", "Ce se schimbă")}
      </h3>
      <p className="mt-1 text-[0.8125rem] leading-[1.45] text-fg-3">
        {keepRanges(pick(plan.text.team, lang))}
      </p>
      <dl className="mt-3 grid @[40rem]:grid-cols-3">
        {plan.strategies.map((strategy, i) => {
          const { head, tail } = splitResult(pick(strategy.result, lang));
          return (
            <div
              key={strategy.id}
              className={cn(
                "grid gap-x-4 gap-y-1 py-3 grid-cols-[7rem_minmax(0,1fr)] @[40rem]:flex @[40rem]:flex-col @[40rem]:px-4",
                strategy.start ? "border-t-2 border-brand-line" : "border-t border-line-1",
                i > 0 && "@[40rem]:border-l @[40rem]:border-l-line-1",
                i === 0 && "@[40rem]:pl-0",
              )}
            >
              <dt className="text-[0.8125rem] leading-[1.35] text-fg-3">
                {pick(strategy.label, lang)}
              </dt>
              <dd className="min-w-0">
                <p className="text-fg">
                  <Statement text={head} />
                  {strategy.assumption ? (
                    <span className="ml-2 inline-flex translate-y-[-1px] items-center align-middle">
                      <Tag variant="dashed">{pick(strategy.assumption, lang)}</Tag>
                      <NoteRef n={assumptionNote} />
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm leading-[1.5] text-fg-2">
                  {tail ?? pick(strategy.support, lang)}
                </p>
                <p className="mt-1.5 text-xs leading-[1.4] text-fg-3">
                  {pick(strategy.title, lang)}
                  {strategy.optional ? t(" (optional)", " (opțional)") : null}
                </p>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/* --------------------------------------------------------------- offer */

function OfferRow({
  offer,
  feePayback,
  className,
}: {
  offer: VortexOffer;
  /** The payback month with this plan's fee added (display.ts), stated under the price. */
  feePayback: DisplayPlan["text"]["feePayback"];
  className?: string;
}) {
  const { t, lang } = useI18n();
  const titleId = useId();
  const price = pick(offer.priceNote, lang);
  const amount = /(\d[\d.,]*\s?(?:lei|RON))/.exec(price);

  return (
    <section
      aria-labelledby={titleId}
      className={cn("grid gap-6 border-y border-line-1 py-6 lg:grid-cols-12", className)}
    >
      <div className="min-w-0 lg:col-span-7">
        <p className="text-[0.8125rem] leading-[1.35] text-fg-3">
          {t("The subscription that fits this plan", "Abonamentul potrivit pentru acest plan")}
        </p>
        <h3 id={titleId} className="type-h3 mt-1 text-fg">
          {pick(offer.title, lang)}
        </h3>
        <p className="mt-2 max-w-[60ch] text-[0.9375rem] leading-[1.5] text-fg-2">
          {pick(offer.why, lang)}
        </p>
        {offer.includes.length ? (
          <ul className="mt-3 space-y-1">
            {offer.includes.map((item) => (
              <li key={item.en} className="flex gap-2.5 text-sm leading-[1.45] text-fg-2">
                <span aria-hidden className="mt-[0.7em] h-px w-1.5 shrink-0 bg-fg-3" />
                <span className="min-w-0">{pick(item, lang)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-5 lg:pt-6">
        <p className="text-[0.9375rem] leading-[1.5] text-fg-2">
          {amount ? (
            <>
              {price.slice(0, amount.index)}
              <span className="type-pnum font-semibold text-fg">{amount[1]}</span>
              {price.slice(amount.index + amount[1].length)}
            </>
          ) : (
            price
          )}
          {feePayback ? (
            <span className="mt-1 block text-[0.8125rem] leading-[1.45] text-fg-3">
              {pick(feePayback, lang)}
            </span>
          ) : null}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <ButtonLink to="/consultancy" size="lg">
            {t("Book a call", "Programează o discuție")}
          </ButtonLink>
          <ButtonLink to="/" hash="pricing" variant="secondary" size="lg">
            {t("See the subscriptions", "Vezi abonamentele")}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- keep / share */

/** Copies the page address (the shareable plan link); the state resets after 2 s. */
function useCopyLink() {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copy === "idle") return;
    const timer = window.setTimeout(() => setCopy("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copy]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return { copy, copyLink };
}

/**
 * The results actions in the step bar, in reach while the page scrolls: ghost "Copiază
 * linkul" (from md) and the primary "Descarcă raportul" ("Raport" on phones).
 */
function BarActions({ onDownload }: { onDownload: () => void }) {
  const { t } = useI18n();
  const { copy, copyLink } = useCopyLink();

  return (
    <StepBarActions>
      <Button
        variant="ghost"
        size="sm"
        icon={copy === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
        onClick={copyLink}
        className="max-md:hidden"
      >
        {copy === "copied"
          ? t("Link copied", "Link copiat")
          : copy === "failed"
            ? t("Copy it from the address bar", "Copiază-l din bara de adrese")
            : t("Copy the link", "Copiază linkul")}
      </Button>
      <Button icon={<Download aria-hidden />} onClick={onDownload}>
        <span className="sm:hidden">{t("Report", "Raport")}</span>
        <span className="max-sm:hidden">{t("Download the report", "Descarcă raportul")}</span>
      </Button>
      <span className="sr-only" aria-live="polite">
        {copy === "copied" ? t("Link copied to the clipboard", "Link copiat în clipboard") : ""}
      </span>
    </StepBarActions>
  );
}

function KeepRow({ onDownload }: { onDownload: () => void }) {
  const { t } = useI18n();
  const { copy, copyLink } = useCopyLink();

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-fg-2">{t("Keep the plan", "Păstrează planul")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={copy === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
          onClick={copyLink}
        >
          {copy === "copied"
            ? t("Link copied", "Link copiat")
            : copy === "failed"
              ? t("Copy it from the address bar", "Copiază-l din bara de adrese")
              : t("Copy the link", "Copiază linkul")}
        </Button>
        <Button variant="secondary" size="sm" icon={<Download aria-hidden />} onClick={onDownload}>
          {t("Download the PDF", "Descarcă PDF-ul")}
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copy === "copied" ? t("Link copied to the clipboard", "Link copiat în clipboard") : ""}
      </span>
    </div>
  );
}

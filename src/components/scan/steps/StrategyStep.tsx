import { useId, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { useI18n } from "@/i18n";
import { displayPlan, type DisplayPlan, type DisplayStrategy } from "@/lib/scan/blueprint/display";
import { hoursPerMonth, monthsQty, roNeedsDe, ucFirst } from "@/lib/scan/blueprint/format";
import type { Blueprint, SimulationInputs, StrategyOption } from "@/lib/scan/types";
import {
  Button,
  Panel,
  PanelBody,
  PanelHeader,
  SegmentedControl,
  Stat,
  StatStrip,
  StepHeader,
  Tag,
} from "@/components/system";
import { BrandSlider } from "../report/BrandSlider";
import { formatNumber, pick } from "../report/format";
import { Gantt, type GanttRow } from "../report/Gantt";
import { categoryOf, companyLine, isSample, splitResult } from "../report/plan-copy";

type View = "comparison" | "roadmap";

const COUNT_RO: Record<number, string> = { 2: "Două", 3: "Trei", 4: "Patru" };
const COUNT_EN: Record<number, string> = { 2: "Two", 3: "Three", 4: "Four" };

/**
 * Screen 03b: the strategic directions as content cards with the same figures
 * as the plan (hours and cost per row come from displayPlan(), never
 * re-rounded), the same rows on a month calendar, and a simulation: the
 * visitor's own team size, hourly cost and volume feed the engine's formulas
 * (the parent re-simulates the blueprint on every change, so every number on
 * this screen stays deterministic).
 */
export function StrategyStep({
  blueprint,
  simulation,
  onSimulationChange,
  onContinue,
}: {
  blueprint: Blueprint;
  simulation: SimulationInputs;
  onSimulationChange: (inputs: SimulationInputs) => void;
  onContinue: () => void;
}) {
  const { t, lang } = useI18n();
  const headingId = useId();
  const [view, setView] = useState<View>("comparison");
  const plan = useMemo(() => displayPlan(blueprint), [blueprint]);
  const options = useMemo(
    () => new Map(blueprint.strategies.map((s) => [s.id, s])),
    [blueprint.strategies],
  );
  const { company, place } = companyLine(blueprint);
  const count = plan.strategies.length;
  const span = Math.max(6, ...plan.phases.map((p) => p.months[1]));

  return (
    <section aria-labelledby={headingId} className="w-full">
      <StepHeader
        id={headingId}
        company={company}
        place={place}
        demo={isSample(blueprint)}
        title={t(
          `${COUNT_EN[count] ?? count} directions, each with its cost and gain`,
          `${COUNT_RO[count] ?? count} direcții, fiecare cu cost și câștig`,
        )}
        lead={t("You can do them one at a time or together.", "Le poți face pe rând sau împreună.")}
        actions={
          <SegmentedControl<View>
            label={t("Strategy view", "Mod de afișare")}
            value={view}
            onChange={setView}
            options={[
              { value: "comparison", label: t("Comparison", "Comparație") },
              { value: "roadmap", label: t("By month", "Plan pe luni") },
            ]}
          />
        }
      />

      <div className="mt-4 sm:mt-6">
        {view === "comparison" ? (
          <ol className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plan.strategies.map((strategy) => (
              <li key={strategy.id} className="min-w-0">
                <StrategyCard strategy={strategy} option={options.get(strategy.id)} />
              </li>
            ))}
          </ol>
        ) : (
          <StrategyCalendar plan={plan} />
        )}
      </div>

      <SimulationPanel
        blueprint={blueprint}
        plan={plan}
        simulation={simulation}
        onSimulationChange={onSimulationChange}
      />

      <div className="mt-6 flex flex-col-reverse gap-4 border-t border-line-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[60ch] text-sm leading-[1.5] text-fg-2">
          {plan.text.startNote
            ? pick(plan.text.startNote, lang)
            : t(
                "The plan puts these directions in order, with the hours and cost of each stage.",
                "Planul pune aceste direcții în ordine, cu orele și costul fiecărei etape.",
              )}
        </p>
        <Button size="lg" onClick={onContinue}>
          {t(`See the ${span}-month plan`, `Vezi planul pe ${monthsQty(span).ro}`)}
        </Button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- cards */

function StrategyCard({
  strategy,
  option,
}: {
  strategy: DisplayStrategy;
  option?: StrategyOption;
}) {
  const { t, lang } = useI18n();
  const titleId = useId();
  const start = strategy.start;

  return (
    <Panel
      as="article"
      aria-labelledby={titleId}
      recommended={Boolean(start)}
      className="flex h-full flex-col gap-2.5 px-4 pb-3.5 pt-4 sm:px-[18px]"
    >
      <div className="flex min-h-5 items-center justify-between gap-3">
        <Tag>{categoryOf(strategy, lang)}</Tag>
        {start ? (
          <Tag variant="start">{t("We start here", "Începem aici")}</Tag>
        ) : strategy.optional ? (
          <Tag>{t("Optional", "Opțional")}</Tag>
        ) : null}
      </div>
      <h3 id={titleId} className="type-h4 text-fg">
        {pick(strategy.title, lang)}
      </h3>
      {start ? <p className="text-sm leading-[1.5] text-fg">{pick(start.reason, lang)}</p> : null}
      {option ? (
        <p className="line-clamp-2 text-sm leading-[1.5] text-fg-2">{pick(option.summary, lang)}</p>
      ) : null}
      {option?.tactics.length ? (
        <ul className="space-y-1">
          {/* Four at most: a site card lists one line per gap it counts ("4 lucruri…"). */}
          {option.tactics.slice(0, 4).map((tactic) => (
            <li key={tactic.en} className="flex gap-2.5 text-sm leading-[1.45] text-fg-2">
              <span aria-hidden className="mt-[0.7em] h-px w-1.5 shrink-0 bg-fg-3" />
              <span className="min-w-0">{pick(tactic, lang)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-auto border-t border-line-1 pt-0.5">
        {strategy.facts.map((fact, i) => {
          const result = i === strategy.facts.length - 1;
          const value = pick(fact.value, lang);
          return (
            <div
              key={fact.label.en}
              className="flex min-h-9 items-center justify-between gap-4 border-b border-line-1 py-1.5 text-[0.8125rem] leading-[1.4] last:border-b-0"
            >
              <dt className="shrink-0 text-fg-3">{pick(fact.label, lang)}</dt>
              <dd className="type-pnum flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right text-fg">
                <span>{result ? ucFirst(splitResult(value).head) : value}</span>
                {result && strategy.assumption ? (
                  <Tag variant="dashed">{pick(strategy.assumption, lang)}</Tag>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </Panel>
  );
}

/* -------------------------------------------------------------- calendar */

function StrategyCalendar({ plan }: { plan: DisplayPlan }) {
  const { t, lang } = useI18n();
  const titleId = useId();
  const months = Math.max(6, ...plan.phases.map((p) => p.months[1]));
  const monthsOf = new Map(plan.phases.map((p) => [p.key, p.months]));

  const rows: GanttRow[] = plan.strategies.map((s) => {
    const segments = s.phases
      .map((p) => monthsOf.get(p.key))
      .filter((m): m is [number, number] => Boolean(m))
      .sort((a, b) => a[0] - b[0]);
    const buildFact = s.facts.find((f) => f.key === "build");
    const build = buildFact ? pick(buildFact.value, lang) : "";
    const cost = s.facts.find((f) => f.key === "cost");
    return {
      key: s.id,
      name: pick(s.title, lang),
      segments,
      start: Boolean(s.start),
      hours: s.hoursPerMonth,
      hoursText:
        s.hoursPerMonth !== null
          ? pick(hoursPerMonth(s.hoursPerMonth), lang)
          : t("brings enquiries, not hours", "aduce solicitări, nu ore"),
      cost: s.setupLei,
      costText: cost ? pick(cost.value, lang) : "",
      when: ucFirst(build),
      empty: s.optional ? t("optional", "opțional") : undefined,
    };
  });

  return (
    <Panel as="section" aria-labelledby={titleId}>
      <PanelHeader
        titleId={titleId}
        title={t("The directions, month by month", "Direcțiile, lună de lună")}
        sub={t(
          "When each one is built, its hours a month and its one-off cost.",
          "Când se face fiecare, câte ore câștigă pe lună și cât costă o singură dată.",
        )}
      />
      <PanelBody>
        <Gantt
          rows={rows}
          months={months}
          density="compact"
          label={t("Directions by month", "Direcțiile pe luni")}
          nameHeader={t("Direction", "Direcție")}
        />
      </PanelBody>
    </Panel>
  );
}

/* ------------------------------------------------------------ simulation */

function SimulationPanel({
  blueprint,
  plan,
  simulation,
  onSimulationChange,
}: {
  blueprint: Blueprint;
  plan: DisplayPlan;
  simulation: SimulationInputs;
  onSimulationChange: (inputs: SimulationInputs) => void;
}) {
  const { t, lang } = useI18n();
  const titleId = useId();
  const defaults = blueprint.assumptions.simulation;
  const teamMax = Math.max(
    20,
    Math.ceil(blueprint.assumptions.teamSize.high * 3),
    simulation.teamSize,
  );
  const hourlyMax = Math.max(250, simulation.hourlyCostRon);
  const changed =
    simulation.teamSize !== defaults.teamSize ||
    simulation.hourlyCostRon !== defaults.hourlyCostRon ||
    Math.abs(simulation.volumeFactor - defaults.volumeFactor) > 0.001;
  const set = (patch: Partial<SimulationInputs>) => onSimulationChange({ ...simulation, ...patch });

  const team = simulation.teamSize;
  const volume = Math.round(simulation.volumeFactor * 100);
  const busyness =
    volume === 100
      ? t("typical (100%)", "tipic (100%)")
      : volume < 100
        ? t(`quieter (${volume}%)`, `mai liniștit (${volume}%)`)
        : t(`busier (${volume}%)`, `mai aglomerat (${volume}%)`);

  const totals = plan.totals;
  const hours = totals.hoursPerMonth;
  const n = plan.breakEven.month;
  const tools = formatNumber(totals.toolsLeiPerMonth, lang);
  // The figure is the automations' setup (the chart's cost); the website work, which
  // the calendar above includes, is named with its amount so the two totals reconcile.
  const site = totals.siteLei ? formatNumber(totals.siteLei, lang) : null;
  const newSite = plan.phases.some((p) => p.siteMilestone);
  const monthly =
    totals.toolsLeiPerMonth > 0
      ? t(
          `then about ${tools} RON a month for tools`,
          `apoi cam ${tools} lei pe lună pentru instrumente`,
        )
      : t("no monthly tools", "fără instrumente lunare");
  const siteNote = site
    ? newSite
      ? t(`; the website comes on top (≈ ${site} RON)`, `; site-ul se adaugă (≈ ${site} lei)`)
      : t(
          `; the website work comes on top (≈ ${site} RON)`,
          `; lucrările la site se adaugă (≈ ${site} lei)`,
        )
    : "";

  return (
    <Panel as="section" aria-labelledby={titleId} className="mt-4 overflow-hidden sm:mt-6">
      <PanelHeader
        titleId={titleId}
        title={t("Adjust the estimate", "Ajustează estimarea")}
        sub={t(
          "Change the team, the volume and the cost of an hour; the figures above recalculate.",
          "Schimbă echipa, volumul și costul orei; cifrele de mai sus se recalculează.",
        )}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCcw aria-hidden />}
            disabled={!changed}
            onClick={() => onSimulationChange({ ...defaults })}
          >
            {t("Back to our estimate", "Revino la estimarea noastră")}
          </Button>
        }
      />
      <PanelBody className="grid gap-5 md:grid-cols-3 md:gap-6">
        <BrandSlider
          label={t("Team size", "Mărimea echipei")}
          value={team}
          min={1}
          max={teamMax}
          step={1}
          onChange={(teamSize) => set({ teamSize })}
          display={t(
            `${team} ${team === 1 ? "person" : "people"}`,
            `${team} ${team === 1 ? "persoană" : roNeedsDe(team) ? "de persoane" : "persoane"}`,
          )}
          bounds={["1", String(teamMax)]}
        />
        <BrandSlider
          label={t("Cost of an hour of work", "Costul unei ore de lucru")}
          value={simulation.hourlyCostRon}
          min={15}
          max={hourlyMax}
          step={1}
          onChange={(hourlyCostRon) => set({ hourlyCostRon })}
          display={t(
            `${simulation.hourlyCostRon} RON an hour`,
            `${simulation.hourlyCostRon} lei pe oră`,
          )}
          bounds={[t("15 RON", "15 lei"), t(`${hourlyMax} RON`, `${hourlyMax} lei`)]}
          hint={pick(plan.notes.hourValue, lang)}
        />
        <BrandSlider
          label={t("How busy you are", "Cât de aglomerați sunteți")}
          value={simulation.volumeFactor}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(volumeFactor) => set({ volumeFactor: Math.round(volumeFactor * 100) / 100 })}
          display={busyness}
          valueText={t(`${volume}% of a typical volume`, `${volume}% din volumul tipic`)}
          bounds={[t("half", "jumătate"), t("double", "dublu")]}
          hint={t(
            "Bookings, orders or requests compared with a typical business like yours.",
            "Programări, comenzi sau solicitări, față de o afacere tipică de același fel.",
          )}
        />
      </PanelBody>
      <div className="border-t border-line-1">
        <StatStrip columns={4} label={t("Recalculated figures", "Cifrele recalculate")}>
          <Stat
            label={t("Hours won back", "Ore câștigate")}
            value={formatNumber(hours, lang)}
            unit={t(
              "hours a month",
              `${roNeedsDe(hours) ? "de " : ""}${hours === 1 ? "oră" : "ore"} pe lună`,
            )}
            sub={pick(plan.text.fte, lang)}
          />
          <Stat
            label={t("Value of the hours", "Valoarea orelor")}
            value={formatNumber(totals.monthlyValueLei, lang)}
            unit={t("RON a month", "lei pe lună")}
            sub={t(
              `at ${formatNumber(totals.hourlyLei, lang)} RON an hour`,
              `la ${formatNumber(totals.hourlyLei, lang)} lei pe oră`,
            )}
          />
          <Stat
            label={
              site ? t("Automation setup", "Implementare automatizări") : t("Setup", "Implementare")
            }
            value={formatNumber(totals.automationsSetupLei, lang)}
            unit={t("RON", "lei")}
            sub={`${monthly}${siteNote}`}
          />
          <Stat
            label={t("Pays back in", "Se recuperează")}
            value={n === null ? "–" : t(`month ${n}`, `luna ${n}`)}
            sub={
              n === null
                ? t("not within the first 24 months", "nu în primele 24 de luni")
                : changed
                  ? t("with your figures", "cu cifrele tale")
                  : t("on the base estimate", "cu estimarea de bază")
            }
          />
        </StatStrip>
      </div>
    </Panel>
  );
}

import { useId, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  ArrowRight,
  CalendarRange,
  Check,
  Clock,
  Columns3,
  Hourglass,
  Info,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  Wrench,
} from "lucide-react";

import { useI18n } from "@/i18n";
import type { Blueprint, SimulationInputs, StrategyOption } from "@/lib/scan/types";
import { cn } from "@/lib/utils";
import { AnimatedRange } from "../report/AnimatedNumber";
import { BrandSlider } from "../report/BrandSlider";
import { scanButton } from "../report/buttons";
import { formatMonthsRange, formatNumber, formatRange, pick, unitSuffix } from "../report/format";
import { GLASS, TILE } from "../report/GlassCard";
import { InfoTip } from "../report/InfoTip";
import { EASE_OUT, riseIn, staggerParent, useScanMotion } from "../report/motion";
import { SegmentedControl } from "../report/SegmentedControl";
import { Sparkline } from "../report/Sparkline";
import { StepHeader } from "../report/StepHeader";
import { Tag } from "../report/Tag";

type View = "comparison" | "roadmap";

/**
 * Screen 03b: three strategic directions to compare side by side or on a
 * timeline, plus a live simulation: the visitor's own team size, hourly cost
 * and volume feed the engine's formulas (the parent re-simulates the
 * blueprint on every change, so every number here stays deterministic).
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
  const recommended = blueprint.strategies.find((s) => s.recommended);

  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby={headingId} className="w-full">
        <StepHeader
          id={headingId}
          eyebrow={t("03 · Strategy", "03 · Strategie")}
          title={
            <>
              {t("Strategy ", "Variante de ")}
              <span className="heading-accent">{t("options", "strategie")}</span>
            </>
          }
          description={t(
            "Based on our analysis, here are the most effective strategies for your business.",
            "Pe baza analizei noastre, acestea sunt cele mai eficiente strategii pentru afacerea ta.",
          )}
          aside={
            <SegmentedControl<View>
              label={t("Strategy view", "Mod de afișare")}
              value={view}
              onChange={setView}
              options={[
                {
                  value: "comparison",
                  label: t("Comparison view", "Comparație"),
                  icon: <Columns3 aria-hidden />,
                },
                {
                  value: "roadmap",
                  label: t("Roadmap view", "Plan pe luni"),
                  icon: <CalendarRange aria-hidden />,
                },
              ]}
            />
          }
        />

        <div className="mt-8">
          <AnimatePresence mode="wait" initial={false}>
            {view === "comparison" ? (
              <motion.div
                key="comparison"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
              >
                <motion.ol
                  variants={staggerParent}
                  initial="hidden"
                  animate="show"
                  className="grid gap-5 pt-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-6"
                >
                  {blueprint.strategies.map((strategy, i) => (
                    <StrategyCard key={strategy.id} strategy={strategy} index={i} />
                  ))}
                </motion.ol>
              </motion.div>
            ) : (
              <motion.div
                key="roadmap"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
              >
                <StrategyTimeline strategies={blueprint.strategies} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <SimulationPanel
          blueprint={blueprint}
          simulation={simulation}
          onSimulationChange={onSimulationChange}
        />

        <div className="mt-8 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="type-body-sm max-w-md text-white/50">
            {recommended
              ? t(
                  `We recommend starting with “${pick(recommended.title, "en")}”; the roadmap shows it month by month.`,
                  `Recomandăm să începi cu „${pick(recommended.title, "ro")}”; planul de implementare arată pașii lună de lună.`,
                )
              : t(
                  "The roadmap puts these strategies in order, month by month.",
                  "Planul de implementare pune aceste strategii în ordine, lună de lună.",
                )}
          </p>
          <button type="button" onClick={onContinue} className={scanButton("primary", "lg")}>
            {t("View recommended roadmap", "Vezi planul recomandat")}
            <ArrowRight aria-hidden />
          </button>
        </div>
      </section>
    </MotionConfig>
  );
}

/* ---------------------------------------------------------------- cards */

/** Illustrative ramp of the stated outcome over a year: flat during setup, then easing in. */
function outcomeCurve(strategy: StrategyOption) {
  const ramp = Math.max(strategy.timeToValueMonths.high, 1) + 1;
  const ease = (month: number) => 1 - (1 - Math.min(1, month / ramp)) ** 3;
  const months = Array.from({ length: 13 }, (_, m) => m);
  const { low, high } = strategy.outcome.range;
  return {
    values: months.map((m) => ((low + high) / 2) * ease(m)),
    low: months.map((m) => low * ease(m)),
    high: months.map((m) => high * ease(m)),
  };
}

function useLevelLabel() {
  const { t } = useI18n();
  return (level: StrategyOption["implementation"]) =>
    ({
      low: t("Light", "Ușoară"),
      medium: t("Medium", "Medie"),
      high: t("Involved", "Complexă"),
    })[level];
}

function StrategyCard({ strategy, index }: { strategy: StrategyOption; index: number }) {
  const { t, lang } = useI18n();
  const { still, reduce } = useScanMotion();
  const levelLabel = useLevelLabel();
  const curve = outcomeCurve(strategy);
  const rec = strategy.recommended;
  const level = { low: 1, medium: 2, high: 3 }[strategy.implementation];

  const card = (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-3xl p-5 sm:p-6",
        rec
          ? "bg-[#070a1f]/95 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
          : cn(GLASS, "transition-colors hover:border-white/20"),
      )}
    >
      {/* Fixed height, so titles line up whether or not a card has a tag. */}
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span aria-hidden className="type-label text-[#89cbf6]">
          {String(index + 1).padStart(2, "0")}
        </span>
        {strategy.opportunityIds.length > 0 && (
          <Tag tone="neutral">
            {t(
              `${strategy.opportunityIds.length} ${strategy.opportunityIds.length === 1 ? "automation" : "automations"}`,
              `${strategy.opportunityIds.length} ${strategy.opportunityIds.length === 1 ? "automatizare" : "automatizări"}`,
            )}
          </Tag>
        )}
      </div>
      <h3 className="type-h3 mt-4 text-white">
        <span className="sr-only">{`${index + 1}. `}</span>
        {pick(strategy.title, lang)}
      </h3>
      <p className="type-body-sm mt-2 text-white/60">{pick(strategy.summary, lang)}</p>

      <ul className="mt-5 space-y-2.5">
        {strategy.tactics.map((tactic) => (
          <li key={tactic.en} className="type-body-sm flex items-start gap-2.5 text-white/85">
            <span
              aria-hidden
              className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-[#5fe3d0]/15 p-0.5 text-[#5fe3d0]"
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {pick(tactic, lang)}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <div className={cn(TILE, "p-4")}>
          <div className="flex items-end justify-between gap-3">
            <p className="type-h3 text-white">
              <AnimatedRange
                range={strategy.outcome.range}
                format={(v) => formatNumber(v, lang)}
                delay={0.2 + index * 0.1}
              />
              <span className="text-white/70">{unitSuffix(strategy.outcome.unit)}</span>
            </p>
            <Sparkline
              values={curve.values}
              low={curve.low}
              high={curve.high}
              delay={0.3 + index * 0.12}
              className="shrink-0"
            />
          </div>
          <p className="type-micro mt-2 text-white/60">
            {pick(strategy.outcome.label, lang)}
            <InfoTip
              label={t("How we estimate this", "Cum am estimat")}
              className="-my-1 ml-0.5 align-middle"
            >
              <p>{pick(strategy.outcome.basis, lang)}</p>
              <p className="mt-1.5 text-white/50">
                {t("Estimate, not a guarantee.", "Estimare, nu garanție.")}
              </p>
            </InfoTip>
          </p>
        </div>

        <dl className="type-body-sm mt-5 grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-white/55">
              <Wrench aria-hidden className="h-4 w-4 text-[#89cbf6]" />
              {t("Implementation", "Implementare")}
            </dt>
            <dd className="flex items-center gap-2 text-white/90">
              <span aria-hidden className="flex gap-0.5">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={cn(
                      "h-3 w-1.5 rounded-full",
                      n <= level ? "bg-gradient-to-t from-[#6c63ff] to-[#89cbf6]" : "bg-white/12",
                    )}
                  />
                ))}
              </span>
              {levelLabel(strategy.implementation)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-white/55">
              <Clock aria-hidden className="h-4 w-4 text-[#89cbf6]" />
              {t("Time to value", "Primele rezultate")}
            </dt>
            <dd className="text-white/90">{formatMonthsRange(strategy.timeToValueMonths, lang)}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-2 text-white/55">
              <Wallet aria-hidden className="h-4 w-4 text-[#89cbf6]" />
              {t("Investment", "Investiție")}
            </dt>
            <dd className="text-right">
              <span
                className="font-semibold"
                aria-label={t(
                  `Level ${strategy.investmentLevel} of 3`,
                  `Nivel ${strategy.investmentLevel} din 3`,
                )}
              >
                <span className="text-white">{"€".repeat(strategy.investmentLevel)}</span>
                <span aria-hidden className="text-white/20">
                  {"€".repeat(3 - strategy.investmentLevel)}
                </span>
              </span>
              <span className="type-micro block text-white/50">
                {formatRange(strategy.investmentRon, lang)} RON
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );

  return (
    <motion.li
      variants={riseIn}
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="relative min-w-0"
    >
      {rec ? (
        <div className="relative h-full">
          {/* Breathing glow behind the recommended card (stops under pause / reduced motion). */}
          <motion.div
            aria-hidden
            className="absolute -inset-2 rounded-[2rem] bg-gradient-to-b from-[#6c63ff]/70 via-[#5b8cf0]/45 to-[#89cbf6]/25 blur-2xl"
            animate={still ? { opacity: 0.8 } : { opacity: [0.55, 1, 0.55] }}
            transition={
              still ? { duration: 0 } : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
            }
          />
          <div className="relative h-full rounded-3xl bg-gradient-to-b from-[#6c63ff] via-[#5b8cf0] to-[#89cbf6]/50 p-px">
            {card}
          </div>
          <span className="type-label absolute -top-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-primary-foreground">
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            {t("Recommended", "Recomandat")}
          </span>
        </div>
      ) : (
        card
      )}
    </motion.li>
  );
}

/* -------------------------------------------------------------- timeline */

function StrategyTimeline({ strategies }: { strategies: StrategyOption[] }) {
  const { t, lang } = useI18n();
  const { reduce } = useScanMotion();
  const end = Math.max(6, ...strategies.map((s) => Math.ceil(s.timeToValueMonths.high) + 2));
  const ticks = Array.from({ length: end + 1 }, (_, m) => m);
  const pct = (month: number) => `${(Math.min(month, end) / end) * 100}%`;

  return (
    <div className={cn(GLASS, "p-5 sm:p-6")}>
      <div className="type-micro flex flex-wrap items-center gap-x-5 gap-y-2 text-white/60">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-5 rounded-full bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.22)_0_3px,transparent_3px_6px)]"
          />
          {t("Setup", "Implementare")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-5 rounded-full bg-gradient-to-r from-[#6c63ff] to-[#89cbf6]"
          />
          {t("First results arrive", "Apar primele rezultate")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-5 rounded-full bg-[#89cbf6]/20" />
          {t("Ongoing value", "Beneficii pe termen lung")}
        </span>
      </div>

      <ol className="mt-6 space-y-6">
        {strategies.map((strategy, i) => {
          const low = strategy.timeToValueMonths.low;
          const high = strategy.timeToValueMonths.high;
          return (
            <li
              key={strategy.id}
              className="grid gap-3 md:grid-cols-[15rem_minmax(0,1fr)] md:items-center md:gap-6"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span aria-hidden className="type-label text-[#89cbf6]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="type-h3 text-white">{pick(strategy.title, lang)}</h3>
                  {strategy.recommended && (
                    <Tag tone="violet" icon={<Sparkles />} className="shrink-0">
                      {t("Recommended", "Recomandat")}
                    </Tag>
                  )}
                </div>
                <p className="type-micro mt-1 text-white/55">
                  {formatRange(strategy.outcome.range, lang)}
                  {unitSuffix(strategy.outcome.unit)} {pick(strategy.outcome.label, lang)} ·{" "}
                  {"€".repeat(strategy.investmentLevel)} (
                  {formatRange(strategy.investmentRon, lang)} RON)
                </p>
              </div>

              <div>
                <div className="relative h-9 rounded-full bg-white/[0.04]">
                  <motion.div
                    className="absolute inset-y-1.5 left-1.5 origin-left rounded-full bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.2)_0_3px,transparent_3px_6px)]"
                    style={{ width: `calc(${pct(low)} - 0.375rem)` }}
                    initial={{ scaleX: reduce ? 1 : 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, delay: 0.1 + i * 0.12, ease: EASE_OUT }}
                  />
                  <motion.div
                    className="absolute inset-y-1 origin-left rounded-full bg-gradient-to-r from-[#6c63ff] via-[#5b8cf0] to-[#89cbf6] shadow-[0_0_18px_rgb(108_99_255/0.5)]"
                    style={{
                      left: pct(low),
                      width: `max(0.75rem, calc(${pct(high)} - ${pct(low)}))`,
                    }}
                    initial={{ scaleX: reduce ? 1 : 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.12, ease: EASE_OUT }}
                  />
                  <motion.div
                    className="absolute inset-y-2 right-1.5 origin-left rounded-full bg-gradient-to-r from-[#89cbf6]/25 to-[#89cbf6]/5"
                    style={{ left: pct(high) }}
                    initial={{ opacity: reduce ? 1 : 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.75 + i * 0.12 }}
                  />
                </div>
                <p className="type-micro mt-1.5 text-white/55">
                  {t(
                    `First results in ${formatMonthsRange(strategy.timeToValueMonths, "en")}`,
                    `Primele rezultate în ${formatMonthsRange(strategy.timeToValueMonths, "ro")}`,
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div aria-hidden className="mt-4 hidden md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-6">
        <span />
        <div className="relative h-5 border-t border-white/10">
          {ticks.map((month) => (
            <span
              key={month}
              className="type-tech absolute top-1.5 -translate-x-1/2 tabular-nums text-white/40 first:translate-x-0 last:-translate-x-full"
              style={{ left: pct(month) }}
            >
              {lang === "ro" ? `L${month}` : `M${month}`}
            </span>
          ))}
        </div>
      </div>
      <p className="type-micro mt-4 text-white/40">
        {t(
          "Months from the start of the project. Bars show when each strategy starts paying off, not how long it runs.",
          "Luni de la începutul proiectului. Barele arată când începe fiecare strategie să aducă rezultate, nu cât durează.",
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ simulation */

function SimulationPanel({
  blueprint,
  simulation,
  onSimulationChange,
}: {
  blueprint: Blueprint;
  simulation: SimulationInputs;
  onSimulationChange: (inputs: SimulationInputs) => void;
}) {
  const { t, lang } = useI18n();
  const headingId = useId();
  const defaults = blueprint.assumptions.simulation;
  const teamMax = Math.max(
    20,
    Math.ceil(blueprint.assumptions.teamSize.high * 3),
    simulation.teamSize,
  );
  const changed =
    simulation.teamSize !== defaults.teamSize ||
    simulation.hourlyCostRon !== defaults.hourlyCostRon ||
    Math.abs(simulation.volumeFactor - defaults.volumeFactor) > 0.001;
  const set = (patch: Partial<SimulationInputs>) => onSimulationChange({ ...simulation, ...patch });
  const totals = blueprint.totals;
  const whole = (v: number) => formatNumber(v, lang);
  const oneDecimal = (v: number) => formatNumber(v, lang, 1);

  const tiles = [
    {
      key: "hours",
      icon: <Clock aria-hidden />,
      label: t("Hours saved a month", "Ore economisite pe lună"),
      value: <AnimatedRange range={totals.hoursSavedPerMonth} format={whole} />,
      unit: " h",
    },
    {
      key: "savings",
      icon: <Wallet aria-hidden />,
      label: t("Savings a month", "Economii pe lună"),
      value: <AnimatedRange range={totals.monthlySavingsRon} format={whole} />,
      unit: " RON",
    },
    {
      key: "payback",
      icon: <Hourglass aria-hidden />,
      label: t("Payback", "Recuperarea investiției"),
      value: <AnimatedRange range={totals.paybackMonths} format={oneDecimal} />,
      unit: lang === "ro" ? " luni" : " months",
    },
    {
      key: "setup",
      icon: <Wrench aria-hidden />,
      label: t("One-off setup", "Implementare unică"),
      value: <AnimatedRange range={totals.setupCostRon} format={whole} />,
      unit: " RON",
    },
  ];

  return (
    <motion.section
      aria-labelledby={headingId}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      className={cn(GLASS, "relative mt-8 overflow-hidden p-5 sm:p-7")}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#6c63ff]/20 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="type-label inline-flex items-center gap-2 text-[#89cbf6]">
            <SlidersHorizontal aria-hidden className="h-3.5 w-3.5" />
            {t("Strategy simulation", "Simularea strategiei")}
          </p>
          <h3 id={headingId} className="type-h3 mt-2 text-white">
            {t("Simulate your numbers", "Simulează cu cifrele tale")}
          </h3>
          <p className="type-body-sm mt-1.5 text-white/60">
            {t(
              "Tell us about your team and the estimates recalculate with the same formulas behind the strategies.",
              "Spune-ne câteva lucruri despre echipă, iar estimările se recalculează cu aceleași formule folosite pentru strategii.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSimulationChange({ ...defaults })}
          disabled={!changed}
          className={scanButton("secondary", "sm")}
        >
          <RotateCcw aria-hidden />
          {t("Reset to our assumptions", "Revino la valorile noastre")}
        </button>
      </div>

      <div className="relative mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10">
        <div className="space-y-7">
          <BrandSlider
            label={t("Team size", "Mărimea echipei")}
            value={simulation.teamSize}
            min={1}
            max={teamMax}
            step={1}
            onChange={(teamSize) => set({ teamSize })}
            display={t(
              `${simulation.teamSize} ${simulation.teamSize === 1 ? "person" : "people"}`,
              `${simulation.teamSize} ${simulation.teamSize === 1 ? "persoană" : simulation.teamSize >= 20 ? "de persoane" : "persoane"}`,
            )}
          />
          <div>
            <BrandSlider
              label={t("Hourly staff cost", "Costul orar al unui angajat")}
              value={simulation.hourlyCostRon}
              min={15}
              max={Math.max(250, simulation.hourlyCostRon)}
              step={1}
              onChange={(hourlyCostRon) => set({ hourlyCostRon })}
              display={t(
                `${simulation.hourlyCostRon} RON/h`,
                `${simulation.hourlyCostRon} lei/oră`,
              )}
              valueText={t(
                `${simulation.hourlyCostRon} RON per hour`,
                `${simulation.hourlyCostRon} lei pe oră`,
              )}
              bounds={["15 RON", `${Math.max(250, simulation.hourlyCostRon)} RON`]}
            />
            <p className="type-micro mt-1 flex items-start gap-1 text-white/45">
              {t(
                `Our default: ${blueprint.assumptions.hourlyCostRon} RON/h`,
                `Valoarea noastră: ${blueprint.assumptions.hourlyCostRon} lei/oră`,
              )}
              <InfoTip label={t("Where the hourly cost comes from", "De unde vine costul orar")}>
                {pick(blueprint.assumptions.hourlyCostBasis, lang)}
              </InfoTip>
            </p>
          </div>
          <BrandSlider
            label={t("Work volume", "Volumul de lucru")}
            value={simulation.volumeFactor}
            min={0.5}
            max={2}
            step={0.05}
            onChange={(volumeFactor) => set({ volumeFactor: Math.round(volumeFactor * 100) / 100 })}
            display={`×${formatNumber(simulation.volumeFactor, lang, 2)}`}
            valueText={t(
              `${Math.round(simulation.volumeFactor * 100)}% of a typical volume`,
              `${Math.round(simulation.volumeFactor * 100)}% din volumul tipic`,
            )}
            bounds={[t("×0.5 quieter", "×0,5 mai puțin"), t("×2 busier", "×2 mai mult")]}
            hint={t(
              "Bookings, orders or requests compared with a typical business like yours.",
              "Programări, comenzi sau solicitări, comparativ cu o afacere tipică de același fel.",
            )}
          />
        </div>

        <div>
          <ul className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {tiles.map((tile) => (
              <li key={tile.key} className={cn(TILE, "relative overflow-hidden p-3.5 sm:p-4")}>
                <p className="type-micro flex items-center gap-1.5 text-white/55 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-[#89cbf6]">
                  {tile.icon}
                  {tile.label}
                </p>
                <p className="type-h3 mt-2 text-white">
                  {tile.value}
                  <span className="type-body-sm font-medium text-white/55">{tile.unit}</span>
                </p>
              </li>
            ))}
          </ul>
          <p className="type-body-sm mt-3 text-white/65">
            {t("That's about ", "Adică aproximativ ")}
            <span className="font-semibold text-white">
              <AnimatedRange range={totals.annualSavingsRon} format={whole} /> RON
            </span>
            {t(" a year.", " pe an.")}
          </p>
          <div className="type-micro mt-4 rounded-2xl border border-[#89cbf6]/20 bg-[#89cbf6]/[0.06] p-3.5 text-white/65">
            <p className="type-label flex items-center gap-1.5 text-[#c4e6fb]">
              <Info aria-hidden className="h-3.5 w-3.5" />
              {t("Estimates, not guarantees", "Estimări, nu garanții")}
            </p>
            <ul className="mt-1.5 space-y-1">
              {blueprint.assumptions.notes.map((note) => (
                <li key={note.en}>{pick(note, lang)}</li>
              ))}
              <li>{pick(blueprint.disclaimer, lang)}</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

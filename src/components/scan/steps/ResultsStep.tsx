import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Hourglass,
  Link2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";

import { useI18n } from "@/i18n";
import type {
  AutomationOpportunity,
  Blueprint,
  RoadmapPhase,
  StrategyOption,
  VortexOffer,
} from "@/lib/scan/types";
import { cn } from "@/lib/utils";
import { LeadGateDialog } from "../LeadGateDialog";
import { AnimatedRange } from "../report/AnimatedNumber";
import { PHASE_ART } from "../report/brand-art";
import { scanButton } from "../report/buttons";
import {
  formatMonthSpan,
  formatMonthsRange,
  formatNumber,
  formatRange,
  pick,
  unitSuffix,
} from "../report/format";
import { GLASS, PanelEyebrow, TILE } from "../report/GlassCard";
import { ImpactChart } from "../report/ImpactChart";
import { InfoTip } from "../report/InfoTip";
import { EASE_OUT, riseIn, staggerParent, useScanMotion } from "../report/motion";
import { projectionUntil } from "../report/projection";
import { SegmentedControl } from "../report/SegmentedControl";
import { StepHeader } from "../report/StepHeader";
import { Tag, type TagTone } from "../report/Tag";

type Horizon = "6" | "12" | "24";

/**
 * Screen 04, the personalised roadmap: phases month by month, the 6/12/24
 * month impact chart, estimated results, the matching Vortex offer and the
 * actions (start, consult, download the PDF behind consent, share).
 */
export function ResultsStep({ blueprint, onBack }: { blueprint: Blueprint; onBack: () => void }) {
  const { t, lang } = useI18n();
  const headingId = useId();
  const [horizon, setHorizon] = useState<Horizon>("12");
  const [leadOpen, setLeadOpen] = useState(false);
  const typeLabel = pick(blueprint.businessType.label, lang).toLowerCase();

  const lastMonth = Math.max(0, ...blueprint.projection.map((p) => p.month));
  const horizons = (["6", "12", "24"] as const).filter((h) => h === "6" || lastMonth >= Number(h));
  // Falls back to the longest horizon the projection covers.
  const activeHorizon = horizons.includes(horizon) ? horizon : horizons[horizons.length - 1];
  const months = Number(activeHorizon);
  const points = useMemo(
    () => projectionUntil(blueprint.projection, months),
    [blueprint.projection, months],
  );
  const end = points[points.length - 1];

  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby={headingId} className="w-full">
        <StepHeader
          id={headingId}
          eyebrow={t("04 · Results", "04 · Rezultate")}
          title={
            <>
              {t("Your personalised ", "Planul tău ")}
              <span className="heading-accent">{t("roadmap", "personalizat")}</span>
            </>
          }
          description={t(
            `Our recommended implementation plan to get the best results for your ${typeLabel}.`,
            `Planul de implementare pe care îl recomandăm ca afacerea ta (${typeLabel}) să obțină cele mai bune rezultate.`,
          )}
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-6">
          <RoadmapTimeline blueprint={blueprint} />

          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            <motion.section
              aria-label={t("Estimated impact", "Impact estimat")}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT }}
              className={cn(GLASS, "min-w-0 p-5 sm:p-6")}
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <PanelEyebrow>{t("Estimated impact", "Impact estimat")}</PanelEyebrow>
                  <h3 className="type-h3 mt-1.5 text-white">
                    {t("Savings vs. cost", "Economii față de cost")}
                  </h3>
                </div>
                <SegmentedControl<Horizon>
                  size="sm"
                  label={t("Impact horizon", "Orizont de timp")}
                  value={activeHorizon}
                  onChange={setHorizon}
                  options={horizons.map((h) => ({
                    value: h,
                    label:
                      lang === "ro" ? `${h} ${Number(h) >= 20 ? "de " : ""}luni` : `${h} months`,
                  }))}
                />
              </div>

              <ImpactChart projection={blueprint.projection} horizon={months} className="mt-5" />

              {end && (
                <dl className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <ImpactFigure
                    icon={<TrendingUp />}
                    label={t(`Saved by month ${end.month}`, `Economisit până în luna ${end.month}`)}
                    value={
                      <AnimatedRange
                        range={end.cumulativeSavingsRon}
                        format={(v) => formatNumber(v, lang)}
                      />
                    }
                    unit="RON"
                  />
                  <ImpactFigure
                    icon={<Wallet />}
                    label={t(`Spent by month ${end.month}`, `Cheltuit până în luna ${end.month}`)}
                    value={
                      <AnimatedRange
                        range={end.cumulativeCostRon}
                        format={(v) => formatNumber(v, lang)}
                      />
                    }
                    unit="RON"
                  />
                  <ImpactFigure
                    icon={<Hourglass />}
                    label={t("Payback", "Recuperare")}
                    value={
                      <AnimatedRange
                        range={blueprint.totals.paybackMonths}
                        format={(v) => formatNumber(v, lang, 1)}
                      />
                    }
                    unit={lang === "ro" ? "luni" : "months"}
                  />
                </dl>
              )}
            </motion.section>

            <EstimatedResults strategies={blueprint.strategies} />

            <OfferCard offer={blueprint.offer} />

            <KeepPanel onDownload={() => setLeadOpen(true)} />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-start sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className={scanButton("ghost", "md", "self-start")}
          >
            <ArrowLeft aria-hidden />
            {t("Back to strategies", "Înapoi la strategii")}
          </button>
          <div className="type-micro max-w-xl text-white/45 sm:text-right">
            <p className="type-label text-white/70">
              {t("Estimates, not guarantees", "Estimări, nu garanții")}
            </p>
            <p className="mt-1">{pick(blueprint.disclaimer, lang)}</p>
            <p className="mt-1">
              {blueprint.engine === "ai"
                ? t(
                    "Built from our playbooks and refined with AI; the money math stays rule-based.",
                    "Construit pe modelele noastre de lucru și revizuit cu AI; calculele financiare rămân pe formule fixe.",
                  )
                : t(
                    "Built from our playbooks for this business type.",
                    "Construit pe modelele noastre de lucru pentru acest tip de afacere.",
                  )}
            </p>
          </div>
        </div>
      </section>

      <LeadGateDialog blueprint={blueprint} open={leadOpen} onOpenChange={setLeadOpen} />
    </MotionConfig>
  );
}

function ImpactFigure({
  icon,
  label,
  value,
  unit,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  unit: string;
}) {
  return (
    <div className={cn(TILE, "px-3.5 py-3")}>
      <dt className="type-micro flex items-center gap-1.5 text-white/55 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-[#89cbf6]">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      {/* Three across under the chart: compact figures (a range never breaks at its
          dash; only the unit may drop to a new line). */}
      <dd className="type-body mt-1.5 font-semibold tabular-nums text-white">
        <span className="whitespace-nowrap">{value}</span>{" "}
        <span className="type-micro font-medium text-white/50">{unit}</span>
      </dd>
    </div>
  );
}

/* --------------------------------------------------------------- timeline */

const PHASE_TAGS: Record<
  RoadmapPhase["tag"],
  { tone: TagTone; icon: ReactNode; en: string; ro: string }
> = {
  essential: { tone: "sky", icon: <ShieldCheck />, en: "Essential", ro: "Esențial" },
  "high-impact": { tone: "violet", icon: <Zap />, en: "High impact", ro: "Impact mare" },
  growth: { tone: "mint", icon: <TrendingUp />, en: "Growth", ro: "Creștere" },
};

function RoadmapTimeline({ blueprint }: { blueprint: Blueprint }) {
  const { t, lang } = useI18n();
  const { reduce } = useScanMotion();
  const byId = useMemo(
    () => new Map(blueprint.opportunities.map((o) => [o.id, o])),
    [blueprint.opportunities],
  );
  const phases = blueprint.roadmap;
  const lastMonth = Math.max(0, ...phases.map((p) => p.endMonth));

  return (
    <motion.section
      aria-label={t("Implementation plan", "Planul de implementare")}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      className={cn(GLASS, "min-w-0 self-start p-4 sm:p-6")}
    >
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <PanelEyebrow>{t("Implementation plan", "Planul de implementare")}</PanelEyebrow>
          <h3 className="type-h3 mt-1.5 text-white">{t("Month by month", "Lună de lună")}</h3>
        </div>
        <p className="type-micro inline-flex items-center gap-1.5 text-white/50">
          <CalendarClock aria-hidden className="h-3.5 w-3.5 text-[#89cbf6]" />
          {t(
            `${phases.length} phases · ${lastMonth} months`,
            `${phases.length} etape · ${lastMonth} ${lastMonth === 1 ? "lună" : "luni"}`,
          )}
        </p>
      </div>

      <div className="relative mt-6">
        {/* The rail draws downward as the plan scrolls in. */}
        <motion.span
          aria-hidden
          className="absolute bottom-6 left-5 top-5 w-px origin-top bg-gradient-to-b from-[#6c63ff] via-[#5b8cf0] to-[#89cbf6]/10"
          initial={{ scaleY: reduce ? 1 : 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, margin: "0px 0px -80px 0px" }}
          transition={{ duration: 1.4, ease: EASE_OUT }}
        />
        <motion.ol
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "0px 0px -60px 0px" }}
          className="relative space-y-4"
        >
          {phases.map((phase, i) => (
            <PhaseItem
              key={`${phase.startMonth}-${phase.stage.en}`}
              phase={phase}
              index={i}
              opportunities={phase.opportunityIds
                .map((id) => byId.get(id))
                .filter((o): o is AutomationOpportunity => Boolean(o))}
            />
          ))}
        </motion.ol>
      </div>
    </motion.section>
  );
}

function PhaseItem({
  phase,
  index,
  opportunities,
}: {
  phase: RoadmapPhase;
  index: number;
  opportunities: AutomationOpportunity[];
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const art = PHASE_ART[index % PHASE_ART.length];
  const tag = PHASE_TAGS[phase.tag];
  const hours = opportunities.reduce(
    (sum, o) => ({
      low: sum.low + o.hoursSavedPerMonth.low,
      high: sum.high + o.hoursSavedPerMonth.high,
    }),
    { low: 0, high: 0 },
  );

  return (
    <motion.li
      variants={riseIn}
      className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 sm:gap-4"
    >
      <div className="flex justify-center pt-3">
        <span className="type-label relative grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-[#070a1f] text-white shadow-[0_0_0_4px_#070a1f,0_0_22px_rgb(108_99_255/0.55)]">
          <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
          <span className="sr-only">{t(`Phase ${index + 1}`, `Etapa ${index + 1}`)}</span>
        </span>
      </div>

      <article
        className={cn(TILE, "min-w-0 overflow-hidden transition-colors hover:border-white/15")}
      >
        <div className="flex flex-col gap-3 p-3 min-[480px]:flex-row sm:gap-4 sm:p-4">
          <div className="relative h-20 w-full shrink-0 overflow-hidden rounded-xl border border-white/10 min-[480px]:h-20 min-[480px]:w-20 sm:h-24 sm:w-24">
            <img
              src={art.src}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
              className="h-full w-full scale-[1.35] object-cover"
              style={{ objectPosition: art.position }}
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-[#6c63ff]/35 via-transparent to-[#04061a]/60 mix-blend-screen"
            />
            <span
              aria-hidden
              className="type-label absolute bottom-1 right-1.5 text-white/85 drop-shadow"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <p className="type-label text-[#89cbf6]">
                {pick(phase.stage, lang)}
                <span className="text-white/45">
                  {" "}
                  · {formatMonthSpan(phase.startMonth, phase.endMonth, lang)}
                </span>
              </p>
              <Tag tone={tag.tone} icon={tag.icon}>
                {lang === "ro" ? tag.ro : tag.en}
              </Tag>
            </div>
            <h4 className="type-h3 mt-1.5 text-white">{pick(phase.title, lang)}</h4>
            <ul className="mt-2 space-y-1.5">
              {phase.items.map((item) => (
                <li key={item.en} className="type-body-sm flex items-start gap-2 text-white/70">
                  <Check
                    aria-hidden
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5fe3d0]"
                    strokeWidth={3}
                  />
                  {pick(item, lang)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {opportunities.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailsId}
              onClick={() => setOpen((v) => !v)}
              className="type-body-sm flex w-full items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-2.5 text-left text-white/70 transition-colors hover:bg-white/[0.03] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#89cbf6]/70"
            >
              <span className="min-w-0">
                {t("What it delivers", "Ce aduce")}
                <span className="text-white/45">
                  {" · "}
                  {t(
                    `${formatRange(hours, "en")} h saved a month`,
                    `${formatRange(hours, "ro")} ore economisite pe lună`,
                  )}
                </span>
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-300",
                  open && "rotate-180",
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  id={detailsId}
                  key="details"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                  className="overflow-hidden"
                >
                  <ul className="space-y-2.5 border-t border-white/[0.07] p-3 sm:p-4">
                    {opportunities.map((o) => (
                      <li
                        key={o.id}
                        className="rounded-xl border border-white/[0.07] bg-[#04061a]/60 p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="type-body-sm font-medium text-white">
                            {pick(o.title, lang)}
                          </p>
                          <InfoTip
                            label={t("Assumptions behind these numbers", "Ipotezele de calcul")}
                          >
                            <ul className="list-disc space-y-0.5 pl-4">
                              {o.assumptions.map((a) => (
                                <li key={a.en}>{pick(a, lang)}</li>
                              ))}
                            </ul>
                          </InfoTip>
                        </div>
                        <p className="type-micro mt-1 text-white/55">{pick(o.solution, lang)}</p>
                        <dl className="type-micro mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Mini
                            label={t("Hours / month", "Ore / lună")}
                            value={formatRange(o.hoursSavedPerMonth, lang)}
                          />
                          <Mini
                            label={t("Saves / month", "Economie / lună")}
                            value={`${formatRange(o.monthlySavingsRon, lang)} RON`}
                          />
                          <Mini
                            label={t("Setup", "Implementare")}
                            value={`${formatRange(o.setupCostRon, lang)} RON`}
                          />
                          <Mini
                            label={t("Payback", "Recuperare")}
                            value={formatMonthsRange(o.paybackMonths, lang, 1)}
                          />
                        </dl>
                        {o.tools.length > 0 && (
                          <ul className="mt-3 flex flex-wrap gap-1.5">
                            {o.tools.map((tool) => (
                              <li
                                key={tool}
                                className="type-micro rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-white/65"
                              >
                                {tool}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </article>
    </motion.li>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-white/45">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums text-white/90">{value}</dd>
    </div>
  );
}

/* ---------------------------------------------------- estimated results */

const STRATEGY_ICONS: Record<string, ReactNode> = {
  acquire: <TrendingUp />,
  automate: <Clock />,
  assist: <Bot />,
};

function EstimatedResults({ strategies }: { strategies: StrategyOption[] }) {
  const { t, lang } = useI18n();
  if (!strategies.length) return null;
  return (
    <section aria-label={t("Estimated results", "Rezultate estimate")}>
      <PanelEyebrow className="px-1">{t("Estimated results", "Rezultate estimate")}</PanelEyebrow>
      <motion.ul
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "0px 0px -40px 0px" }}
        className="mt-3 grid gap-2.5 min-[480px]:grid-cols-3"
      >
        {strategies.map((s, i) => (
          <motion.li
            key={s.id}
            variants={riseIn}
            className={cn(
              GLASS,
              "relative rounded-2xl p-4",
              s.recommended && "border-[#6c63ff]/50 shadow-[0_0_40px_-12px_rgb(108_99_255/0.65)]",
            )}
          >
            <div className="flex items-center justify-between">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#6c63ff]/40 to-[#5b8cf0]/15 text-white [&_svg]:h-4 [&_svg]:w-4"
              >
                {STRATEGY_ICONS[s.id] ?? <Sparkles />}
              </span>
              <InfoTip label={t("How we estimate this", "Cum am estimat")}>
                {pick(s.outcome.basis, lang)}
              </InfoTip>
            </div>
            <p className="type-h3 mt-3 text-white">
              <AnimatedRange
                range={s.outcome.range}
                format={(v) => formatNumber(v, lang)}
                delay={0.1 * i}
              />
              <span className="text-white/65">{unitSuffix(s.outcome.unit)}</span>
            </p>
            <p className="type-micro mt-1.5 text-white/60">{pick(s.outcome.label, lang)}</p>
            <p className="type-label mt-2 text-white/40">{pick(s.title, lang)}</p>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

/* ------------------------------------------------------------------ offer */

function OfferCard({ offer }: { offer: VortexOffer }) {
  const { t, lang } = useI18n();
  const plan = {
    starter: t("Starter plan", "Planul Starter"),
    growth: t("Growth plan", "Planul Growth"),
    pro: t("Pro plan", "Planul Pro"),
    project: t("Custom project", "Proiect personalizat"),
  }[offer.planId];

  return (
    <motion.section
      aria-label={t("Recommended offer", "Oferta recomandată")}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      className="relative rounded-3xl bg-gradient-to-br from-[#6c63ff] via-[#5b8cf0]/60 to-[#89cbf6]/25 p-px shadow-[0_30px_80px_-40px_rgb(108_99_255/0.8)]"
    >
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-[#070a1f]/95 p-5 sm:p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#5b8cf0]/20 blur-3xl"
        />
        <div className="relative">
          <Tag tone="violet" icon={<Sparkles />}>
            {t("Recommended for you", "Recomandat pentru tine")} · {plan}
          </Tag>
          <h3 className="type-h3 mt-3 text-white">{pick(offer.title, lang)}</h3>
          <p className="type-body-sm mt-2 text-white/60">{pick(offer.why, lang)}</p>
          <ul className="mt-4 space-y-2">
            {offer.includes.map((item) => (
              <li key={item.en} className="type-body-sm flex items-start gap-2.5 text-white/85">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-[#5fe3d0]/15 p-0.5 text-[#5fe3d0]"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {pick(item, lang)}
              </li>
            ))}
          </ul>
          <p className="type-h3 mt-4 heading-accent">{pick(offer.priceNote, lang)}</p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Link to="/contact" className={scanButton("primary", "md", "sm:flex-1")}>
              {t("Start your project", "Începe proiectul")}
              <ArrowRight aria-hidden />
            </Link>
            <Link to="/consultancy" className={scanButton("secondary", "md", "sm:flex-1")}>
              {t("Book a consultation", "Programează o discuție")}
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ---------------------------------------------------------- keep / share */

function KeepPanel({ onDownload }: { onDownload: () => void }) {
  const { t } = useI18n();
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copy === "idle") return;
    const timer = setTimeout(() => setCopy("idle"), 2600);
    return () => clearTimeout(timer);
  }, [copy]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <section
      aria-label={t("Keep your plan", "Păstrează planul")}
      className={cn(GLASS, "flex flex-col gap-2.5 rounded-2xl p-3 sm:flex-row")}
    >
      <button
        type="button"
        onClick={onDownload}
        className={scanButton("secondary", "md", "sm:flex-1")}
      >
        <Download aria-hidden />
        {t("Download the blueprint (PDF)", "Descarcă planul (PDF)")}
      </button>
      <button type="button" onClick={copyLink} className={scanButton("ghost", "md")}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copy}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-2"
          >
            {copy === "copied" ? (
              <Check aria-hidden className="text-[#5fe3d0]" />
            ) : copy === "failed" ? (
              <Link2 aria-hidden />
            ) : (
              <Copy aria-hidden />
            )}
            {copy === "copied"
              ? t("Link copied", "Link copiat")
              : copy === "failed"
                ? t("Copy the address bar link", "Copiază linkul din bara de adrese")
                : t("Copy share link", "Copiază linkul de distribuire")}
          </motion.span>
        </AnimatePresence>
      </button>
      <span className="sr-only" aria-live="polite">
        {copy === "copied" ? t("Link copied to the clipboard", "Link copiat în clipboard") : ""}
      </span>
    </section>
  );
}

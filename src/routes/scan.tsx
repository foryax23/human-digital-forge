import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import type { AsciiVortexState } from "@/components/landing/ascii";
import { HeroCosmos } from "@/components/landing/HeroCosmos";
import { LandingNav } from "@/components/landing/LandingNav";
import { MotionPauseProvider } from "@/components/landing/motion-pause";
import { VortexSearch } from "@/components/landing/VortexSearch";
import { scanButton } from "@/components/scan/report/buttons";
import { StepHeader } from "@/components/scan/report/StepHeader";
import type { ScanStage } from "@/components/scan/scan-state";
import { ScanShell } from "@/components/scan/ScanShell";
import { AnalyseStep } from "@/components/scan/steps/AnalyseStep";
import { OverviewStep } from "@/components/scan/steps/OverviewStep";
import { ResultsStep } from "@/components/scan/steps/ResultsStep";
import { StrategyStep } from "@/components/scan/steps/StrategyStep";
import { scanKey, toScanTarget, useVortexScan } from "@/components/scan/useVortexScan";
import { useI18n } from "@/i18n";
import { simulateBlueprint } from "@/lib/scan/blueprint/simulate";
import type { ScanTarget, SimulationInputs } from "@/lib/scan/types";

/** A search param as a trimmed string; the router parses "123" into a number. */
const param = z
  .preprocess(
    (value) => (typeof value === "number" ? String(value) : value),
    z.string().trim().min(1).max(2048).optional(),
  )
  .catch(undefined);

/**
 * A CUI stays a number, so the router writes ?cui=54747928 (a digit-only string
 * would be serialised in quotes).
 */
const cuiParam = z
  .preprocess(
    (value) =>
      typeof value === "string" && /^\d{2,10}$/.test(value.trim()) ? Number(value.trim()) : value,
    z.number().int().positive().optional(),
  )
  .catch(undefined);

const searchSchema = z.object({ cui: cuiParam, url: param, q: param, demo: param });
type ScanSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/scan")({
  validateSearch: (search: Record<string, unknown>): ScanSearch => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Vortex Scan | Vortex Hub" },
      {
        name: "description",
        content:
          "Vortex Scan analyses a business's public digital footprint and turns it into a personalised automation and growth plan.",
      },
      // Results are personal to the visitor.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScanPage,
});

const STAGE_ORDER: ScanStage[] = ["find", "analyse", "strategy", "results"];
type StrategyView = "overview" | "strategy";
type Position = { stage: ScanStage; view: StrategyView };
/** What the ASCII vortex behind the flow shows: the real scan progress, 0..1. */
type Backdrop = { state: AsciiVortexState; progress: number };

/** Where ?demo= starts: "1" opens the overview; a stage name opens that screen. */
function demoPosition(demo: string): Position {
  if (demo === "analyse") return { stage: "analyse", view: "overview" };
  if (demo === "strategy") return { stage: "strategy", view: "strategy" };
  if (demo === "results") return { stage: "results", view: "strategy" };
  return { stage: "strategy", view: "overview" };
}

const UI_PREFIX = "vortex-scan-ui:v1:";

function readPosition(key: string): Position | null {
  try {
    const raw = window.sessionStorage.getItem(UI_PREFIX + key);
    const value = raw ? (JSON.parse(raw) as Position) : null;
    return value && STAGE_ORDER.includes(value.stage) ? value : null;
  } catch {
    return null;
  }
}

function writePosition(key: string, position: Position) {
  try {
    window.sessionStorage.setItem(UI_PREFIX + key, JSON.stringify(position));
  } catch {
    /* ignore */
  }
}

function ScanPage() {
  const search = Route.useSearch();
  const target = useMemo(
    () =>
      toScanTarget({
        cui: search.cui != null ? String(search.cui) : undefined,
        url: search.url,
        q: search.q,
      }),
    [search.cui, search.url, search.q],
  );
  const demo = search.demo;
  const flowKey = demo ? `demo:${demo}` : target ? scanKey(target) : "find";
  const [backdrop, setBackdrop] = useState<Backdrop>({ state: "idle", progress: 0 });
  const onBackdropChange = useCallback((next: Backdrop) => {
    setBackdrop((current) =>
      current.state === next.state && current.progress === next.progress ? current : next,
    );
  }, []);

  return (
    <div className="cinematic relative isolate min-h-screen overflow-x-clip bg-background text-foreground">
      <MotionPauseProvider>
        {/* The homepage's deep-space backdrop, dimmed so the data reads first; its
            vortex follows the real scan (see ScanFlow). */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <HeroCosmos
            className="opacity-40"
            asciiState={backdrop.state}
            progress={backdrop.progress}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_30%,transparent_0%,rgb(0_2_15/0.55)_70%,rgb(0_2_15/0.85)_100%)]" />
        </div>
        <LandingNav offPage />
        <ScanFlow key={flowKey} target={target} demo={demo} onBackdropChange={onBackdropChange} />
      </MotionPauseProvider>
    </div>
  );
}

function ScanFlow({
  target,
  demo,
  onBackdropChange,
}: {
  target: ScanTarget | null;
  demo?: string;
  onBackdropChange: (backdrop: Backdrop) => void;
}) {
  const { t, lang } = useI18n();
  const scan = useVortexScan(target, { demo: Boolean(demo) });
  const { state, origin } = scan;
  const blueprint = state.blueprint;
  const key = demo ? null : target ? scanKey(target) : null;

  const [position, setPosition] = useState<Position>(() =>
    demo ? demoPosition(demo) : { stage: target ? "analyse" : "find", view: "overview" },
  );
  const [furthest, setFurthest] = useState(() => STAGE_ORDER.indexOf(position.stage));
  const [simulation, setSimulation] = useState<{ id: string; inputs: SimulationInputs } | null>(
    null,
  );
  const advanced = useRef(Boolean(demo));

  const goTo = useCallback((stage: ScanStage, view: StrategyView = "overview") => {
    setPosition({ stage, view });
    setFurthest((value) => Math.max(value, STAGE_ORDER.indexOf(stage)));
  }, []);

  // A finished live run moves on to the overview after a beat; a run restored
  // from this session goes straight back to where the visitor was.
  useEffect(() => {
    if (advanced.current || !blueprint || state.status !== "done") return;
    if (position.stage !== "analyse") return;
    if (origin === "cache") {
      advanced.current = true;
      const saved = key ? readPosition(key) : null;
      const stage = saved && saved.stage !== "find" && saved.stage !== "analyse" ? saved : null;
      goTo(stage?.stage ?? "strategy", stage?.view ?? "overview");
      return;
    }
    const timer = window.setTimeout(() => {
      advanced.current = true;
      goTo("strategy");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [blueprint, state.status, origin, position.stage, key, goTo]);

  useEffect(() => {
    if (key && blueprint) writePosition(key, position);
  }, [key, blueprint, position]);

  const simulationInputs =
    blueprint && simulation?.id === blueprint.id
      ? simulation.inputs
      : blueprint?.assumptions.simulation;
  const simulated = useMemo(
    () => (blueprint && simulationInputs ? simulateBlueprint(blueprint, simulationInputs) : null),
    [blueprint, simulationInputs],
  );

  const runAgain = () => {
    advanced.current = false;
    setPosition({ stage: "analyse", view: "overview" });
    setFurthest(1);
    setSimulation(null);
    scan.rerun();
  };

  const hasTarget = Boolean(target || demo);
  const completed: ScanStage[] = [];
  if (hasTarget) completed.push("find");
  if (state.status === "done") completed.push("analyse");
  if (furthest >= 3) completed.push("strategy");

  const reachable: ScanStage[] = ["find"];
  if (hasTarget) reachable.push("analyse");
  if (blueprint) reachable.push("strategy");
  if (blueprint && furthest >= 3) reachable.push("results");

  const runningStep = state.steps.find((step) => step.status === "running");
  const activity =
    scan.updating && position.stage !== "analyse"
      ? {
          label: t("Updating your analysis…", "Actualizăm analiza…"),
          detail: runningStep?.label[lang],
          onView: () => goTo("analyse"),
        }
      : null;

  let content: React.ReactNode;
  const { stage, view } = position;
  if (stage === "find" || !hasTarget) {
    content = (
      <FindStage
        hasScan={hasTarget}
        onBack={hasTarget ? () => goTo(blueprint ? "strategy" : "analyse") : undefined}
      />
    );
  } else if (stage === "analyse" || !blueprint || !simulated || !simulationInputs) {
    content = (
      <AnalyseStep
        state={state}
        origin={origin}
        onContinue={() => goTo("strategy")}
        onRunAgain={demo ? undefined : runAgain}
        onFindAnother={() => goTo("find")}
      />
    );
  } else if (stage === "strategy" && view === "overview") {
    content = (
      <OverviewStep
        state={state}
        blueprint={blueprint}
        onEdit={scan.edit}
        onContinue={() => goTo("strategy", "strategy")}
      />
    );
  } else if (stage === "strategy") {
    content = (
      <StrategyStep
        blueprint={simulated}
        simulation={simulationInputs}
        onSimulationChange={(inputs) => setSimulation({ id: blueprint.id, inputs })}
        onContinue={() => goTo("results", "strategy")}
      />
    );
  } else {
    content = <ResultsStep blueprint={simulated} onBack={() => goTo("strategy", "strategy")} />;
  }

  const shownStage: ScanStage = !hasTarget
    ? "find"
    : stage !== "find" && !blueprint
      ? "analyse"
      : stage;

  // The backdrop: calm on the search, "analysis" while real steps run (filled as
  // far as they have finished), "result" once the blueprint is ready.
  const finishedSteps = state.steps.filter(
    (step) => step.status !== "pending" && step.status !== "running",
  ).length;
  const progress = state.steps.length ? finishedSteps / state.steps.length : 0;
  const backdropState: AsciiVortexState =
    shownStage === "find" || state.status === "error"
      ? "idle"
      : state.status !== "running" && blueprint
        ? "result"
        : "analysis";
  useEffect(() => {
    onBackdropChange({ state: backdropState, progress });
  }, [backdropState, progress, onBackdropChange]);

  return (
    <ScanShell
      stage={shownStage}
      completed={completed}
      reachable={reachable}
      onStageSelect={(next) => goTo(next, next === "results" ? "strategy" : "overview")}
      contentKey={`${shownStage}:${shownStage === "strategy" ? view : ""}`}
      activity={activity}
    >
      {content}
    </ScanShell>
  );
}

/** Stage 01 on /scan: the hero's company search, for starting another scan. */
function FindStage({ hasScan, onBack }: { hasScan: boolean; onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="scan-find-title" className="mx-auto max-w-2xl py-6 text-center">
      {/* No eyebrow: the stepper above already names the step. */}
      <StepHeader
        id="scan-find-title"
        title={
          <>
            {t("Which business should we ", "Ce afacere ")}
            <span className="heading-accent">{t("scan", "scanăm")}</span>?
          </>
        }
        description={t(
          "Search a Romanian company by name or fiscal code (CUI), or enter any website.",
          "Caută o firmă din România după nume sau cod fiscal (CUI), ori introdu orice site.",
        )}
        className="[&>div]:mx-auto"
      />
      {/* The description above says what the search takes; the line under it names the source. */}
      <VortexSearch
        className="mx-auto mt-10 max-w-xl text-left"
        micro={t("Companies: Trade Register open data", "Firme: date deschise ONRC")}
      />
      {hasScan && onBack && (
        <button type="button" onClick={onBack} className={scanButton("ghost", "md", "mt-8")}>
          <ArrowLeft aria-hidden />
          {t("Back to the current scan", "Înapoi la scanarea curentă")}
        </button>
      )}
    </section>
  );
}

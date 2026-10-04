import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import type { AsciiVortexState } from "@/components/landing/ascii";
import { HeroCosmos } from "@/components/landing/HeroCosmos";
import { LandingNav } from "@/components/landing/LandingNav";
import { MotionPauseProvider } from "@/components/landing/motion-pause";
import { VortexSearch } from "@/components/landing/VortexSearch";
import type { ScanStage } from "@/components/scan/scan-state";
import { ScanShell } from "@/components/scan/ScanShell";
import { AnalyseStep } from "@/components/scan/steps/AnalyseStep";
import { OverviewStep } from "@/components/scan/steps/OverviewStep";
import { ResultsStep } from "@/components/scan/steps/ResultsStep";
import { StrategyStep } from "@/components/scan/steps/StrategyStep";
import { scanKey, toScanTarget, useVortexScan } from "@/components/scan/useVortexScan";
import { Button, ButtonLink, FOCUS_RING, StepHeader } from "@/components/system";
import { pageMeta, useI18n } from "@/i18n";
import { canonicalLink } from "@/i18n/seo";
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

/**
 * Which demo screen ?demo= opens. A word, never a digit: the router writes a digit-only
 * string in quotes (?demo=%221%22), so the old "1" is read and written back as "overview".
 */
const DEMO_VIEWS = ["overview", "analyse", "strategy", "results"] as const;
const demoParam = z
  .preprocess(
    (value) => (value === 1 || value === "1" ? "overview" : value),
    z.enum(DEMO_VIEWS).optional(),
  )
  .catch(undefined);

const searchSchema = z.object({ cui: cuiParam, url: param, q: param, demo: demoParam });
type ScanSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/scan")({
  validateSearch: (search: Record<string, unknown>): ScanSearch => searchSchema.parse(search),
  head: ({ matches, match }) => {
    // The start page is indexed (sitemap); a scan's own screens are personal to the visitor.
    const { cui, url, q, demo } = match.search;
    const personal = Boolean(cui || url || q || demo);
    return {
      meta: personal
        ? [...pageMeta(matches, "/scan"), { name: "robots", content: "noindex" }]
        : pageMeta(matches, "/scan"),
      links: personal ? [] : [canonicalLink("/scan")],
    };
  },
  component: ScanPage,
});

const STAGE_ORDER: ScanStage[] = ["find", "analyse", "strategy", "results"];
type StrategyView = "overview" | "strategy";
type Position = { stage: ScanStage; view: StrategyView };
/** What the ASCII vortex behind the flow shows: the real scan progress, 0..1. */
type Backdrop = { state: AsciiVortexState; progress: number };

/** Where ?demo= starts: "overview" opens the findings; a stage name opens that screen. */
function demoPosition(demo: string): Position {
  if (demo === "analyse") return { stage: "analyse", view: "overview" };
  if (demo === "strategy") return { stage: "strategy", view: "strategy" };
  if (demo === "results") return { stage: "results", view: "strategy" };
  return { stage: "strategy", view: "overview" };
}

/**
 * The step a screen belongs to in the step bar: the overview ("Ce am găsit despre …") is
 * the analysis result, so it shows as step 2; step 3 starts with the three directions.
 */
function shownIndex({ stage, view }: Position): number {
  return stage === "strategy" && view === "overview" ? 1 : STAGE_ORDER.indexOf(stage);
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
  // The furthest step reached, in step-bar terms (the overview counts as step 2).
  const [furthest, setFurthest] = useState(() => shownIndex(position));
  const [simulation, setSimulation] = useState<{ id: string; inputs: SimulationInputs } | null>(
    null,
  );
  const advanced = useRef(Boolean(demo));

  const goTo = useCallback((stage: ScanStage, view: StrategyView = "overview") => {
    setPosition({ stage, view });
    setFurthest((value) => Math.max(value, shownIndex({ stage, view })));
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
  // Analysis is done once its findings were seen and the visitor moved on to step 3.
  const completed: ScanStage[] = [];
  if (hasTarget) completed.push("find");
  if (state.status === "done" && furthest >= 2) completed.push("analyse");
  if (furthest >= 3) completed.push("strategy");

  const reachable: ScanStage[] = ["find"];
  if (hasTarget) reachable.push("analyse");
  if (blueprint) reachable.push("strategy");
  if (blueprint && furthest >= 3) reachable.push("results");

  // Step 2 opens the findings once there are some (the checklist while the scan runs);
  // steps 3 and 4 open the directions and the plan.
  const selectStage = (next: ScanStage) => {
    if (next === "analyse" && blueprint && state.status === "done") goTo("strategy", "overview");
    else if (next === "strategy" || next === "results") goTo(next, "strategy");
    else goTo(next);
  };

  const runningStep = state.steps.find((step) => step.status === "running");
  const activity =
    scan.updating && position.stage !== "analyse"
      ? {
          label: t("Updating your analysis…", "Actualizăm analiza…"),
          detail: runningStep?.label[lang],
          onView: () => goTo("analyse"),
          onCancel: scan.cancelUpdate,
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
        demo={origin === "demo"}
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
      : (STAGE_ORDER[shownIndex(position)] ?? stage);

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
      onStageSelect={selectStage}
      contentKey={`${shownStage}:${stage}:${view}`}
      activity={activity}
    >
      {content}
    </ScanShell>
  );
}

const CREDIT_LINK = `rounded-sm underline decoration-fg/30 underline-offset-4 transition-colors hover:text-fg hover:decoration-fg ${FOCUS_RING}`;

/**
 * Stage 1 on /scan: the hero's company search for starting a scan, then what the scan
 * gives in three lines and a link to a finished example, so the screen is useful before
 * anything is typed.
 */
function FindStage({ hasScan, onBack }: { hasScan: boolean; onBack?: () => void }) {
  const { t } = useI18n();
  const outcomes = [
    {
      title: t("Website and online presence check", "Analiza site-ului și a prezenței online"),
      body: t(
        "Speed, Google search, profiles and what is missing, from public data.",
        "Viteză, căutare Google, profiluri și ce lipsește, din date publice.",
      ),
    },
    {
      title: t("Three directions and a 6-month plan", "Trei direcții și planul pe 6 luni"),
      body: t(
        "Each with its cost, the hours it frees and, as an estimate, whether and when it pays back.",
        "Fiecare cu costul, orele câștigate și, estimat, dacă și când se recuperează.",
      ),
    },
    {
      title: t("The full report, as a PDF", "Raportul complet, în PDF"),
      body: t(
        "Every figure with its source, to keep or send to your team.",
        "Toate cifrele, cu sursele lor, de păstrat sau de trimis echipei.",
      ),
    },
  ];

  return (
    <section aria-labelledby="scan-find-title" className="max-w-[60rem] pt-2">
      <StepHeader
        id="scan-find-title"
        title={t("Analyse a business", "Analizează o afacere")}
        lead={t(
          "Type the company name, its fiscal code (CUI) or the website address. It is free; for the PDF we only ask for your e-mail address.",
          "Scrie numele firmei, CUI-ul sau adresa site-ului. E gratuit; pentru PDF îți cerem doar adresa de e-mail.",
        )}
      />
      {/* The lead above says what the field takes; the search menu names its sources. */}
      <VortexSearch className="mt-6 w-full max-w-[40rem]" showHint={false} />

      <ul className="mt-12 grid gap-x-8 gap-y-5 border-t border-line-1 pt-6 sm:grid-cols-3">
        {outcomes.map((item) => (
          <li key={item.title} className="min-w-0">
            <h3 className="type-h4 text-fg">{item.title}</h3>
            <p className="mt-1 text-sm leading-[1.5] text-fg-2">{item.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <ButtonLink to="/scan" search={{ demo: "results" }} variant="link">
          {t("See an example", "Vezi un exemplu")}
        </ButtonLink>
        {hasScan && onBack ? (
          <Button variant="ghost" icon={<ArrowLeft aria-hidden />} onClick={onBack}>
            {t("Back to the current scan", "Înapoi la scanarea curentă")}
          </Button>
        ) : null}
      </div>
      {/* CC BY 4.0 attribution for the company index (public/scan-index/v1/meta.json):
          source, licence and that we changed it (filtered and indexed). fg-2 on the backdrop. */}
      <p className="mt-10 text-[0.8125rem] leading-[1.45] text-fg-2">
        {t("ONRC data from ", "Date ONRC de pe ")}
        <a
          href="https://data.gov.ro/organization/onrc"
          target="_blank"
          rel="noopener noreferrer"
          className={CREDIT_LINK}
        >
          data.gov.ro
        </a>
        {t(", licensed ", ", licență ")}
        <a
          href={t(
            "https://creativecommons.org/licenses/by/4.0/deed.en",
            "https://creativecommons.org/licenses/by/4.0/deed.ro",
          )}
          target="_blank"
          rel="noopener noreferrer license"
          className={CREDIT_LINK}
        >
          CC BY 4.0
        </a>
        {t(", processed by Vortex Hub.", ", prelucrate de Vortex Hub.")}
      </p>
    </section>
  );
}

import { useId } from "react";
import { RotateCcw } from "lucide-react";

import { ScanGlobe } from "@/components/scan/globe/ScanGlobe";
import { buildDataCards, type DataCardId } from "@/components/scan/globe/data-cards";
import { StepHeader } from "@/components/scan/report/StepHeader";
import type { ScanState } from "@/components/scan/scan-state";
import { Button, Panel, PanelBody, PanelHeader, Spinner } from "@/components/system";
import { useI18n } from "@/i18n";
import type { Lang, ScanStep, ScanStepId, ScanTarget } from "@/lib/scan/types";
import { withCommaBelow } from "@/lib/scan/localize";
import { cn } from "@/lib/utils";

/** How this screen names each real step of the scan (numbered in run order). */
const STAGE_LABELS: Record<ScanStepId, { en: string; ro: string }> = {
  identify: { en: "Reading the company record", ro: "Citim datele firmei" },
  website: { en: "Checking the website", ro: "Verificăm site-ul" },
  technology: { en: "Recognising the technologies", ro: "Recunoaștem tehnologiile" },
  presence: { en: "Looking for the online profiles", ro: "Căutăm profilurile online" },
  competitors: { en: "Finding similar local businesses", ro: "Căutăm firme asemănătoare" },
  journey: { en: "Following a customer's path", ro: "Urmărim drumul unui client" },
  opportunities: { en: "Finding what can be automated", ro: "Vedem ce se poate automatiza" },
  strategy: { en: "Working out the three directions", ro: "Calculăm cele trei direcții" },
};

/** The globe card that shows what a checklist step found (phones print it under the row). */
const FOUND_CARD: Partial<Record<ScanStepId, DataCardId>> = {
  identify: "business",
  website: "website",
  technology: "technology",
  presence: "social",
  competitors: "competitors",
};

const stageLabel = (step: ScanStep, lang: Lang) =>
  STAGE_LABELS[step.id]?.[lang] ?? step.label[lang];

/** "0,3 s" for a finished step. */
function seconds(step: ScanStep, lang: Lang) {
  if (!step.startedAt || !step.finishedAt) return null;
  const value = Math.max(0.1, (step.finishedAt - step.startedAt) / 1000);
  return `${value.toLocaleString(lang === "ro" ? "ro-RO" : "en-GB", { maximumFractionDigits: 1 })} s`;
}

/** The status glyph column: a square, the running spinner, or a hollow square. */
function StepMark({ status }: { status: ScanStep["status"] }) {
  if (status === "running") return <Spinner size={12} className="text-brand-line" />;
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-[1px]",
        status === "done" && "bg-ok",
        status === "failed" && "bg-bad",
        status === "skipped" && "bg-fg-4",
        status === "pending" && "border border-fg-4",
      )}
    />
  );
}

function ChecklistItem({
  step,
  number,
  found,
}: {
  step: ScanStep;
  number: number;
  /** What this step found, printed under the row on phones (the globe shows it on wider screens). */
  found?: string;
}) {
  const { t, lang } = useI18n();
  const note = step.notes[step.notes.length - 1]?.[lang];
  const label = stageLabel(step, lang);
  const statusText = {
    pending: t("waiting", "în așteptare"),
    running: t("in progress", "în curs"),
    done: t("done", "gata"),
    skipped: t("skipped", "omis"),
    failed: t("couldn't finish", "nu s-a putut termina"),
  }[step.status];
  const took = step.status === "done" ? seconds(step, lang) : null;
  const ended = step.status === "skipped" || step.status === "failed";
  // One 13 px line under the title: the reason for a skipped step, the live note while it
  // runs, and on phones what it found.
  const line = ended ? note : step.status === "running" ? note : found;

  return (
    <li className="py-2">
      <div className="grid min-h-5 grid-cols-[1.25rem_0.75rem_minmax(0,1fr)_auto] items-center gap-x-2.5">
        <span aria-hidden className="type-num text-xs text-fg-4">
          {number}
        </span>
        <span className="flex justify-center">
          <StepMark status={step.status} />
        </span>
        <span
          className={cn(
            "min-w-0 text-sm leading-[1.4]",
            step.status === "pending" || ended ? "text-fg-3" : "text-fg",
          )}
        >
          {label}
          <span className="sr-only">, {statusText}</span>
        </span>
        <span className="type-num shrink-0 text-xs text-fg-3">
          {took ?? (ended ? statusText : null)}
        </span>
      </div>
      {line ? (
        <p
          className={cn(
            "mt-0.5 pl-[3.25rem] text-[0.8125rem] leading-[1.45] text-fg-3",
            // Found values print here only where the globe is hidden.
            !ended && step.status !== "running" && "md:hidden",
          )}
        >
          {line}
        </p>
      ) : null}
    </li>
  );
}

/** The business being scanned, as far as we know it yet. */
function targetName(state: ScanState, target: ScanTarget) {
  if (state.company?.displayName) return withCommaBelow(state.company.displayName);
  if (target.cui) return `CUI ${target.cui}`;
  return target.query ?? "";
}

function hostOf(url: string | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Step 2, the analysis: the real checklist in a 400 px panel (each row ticks only when its
 * call returns, with its timing), and the globe with a card per data source beside it.
 * Phones drop the globe and print each finding under its row.
 */
export function AnalyseStep({
  state,
  origin = "live",
  onContinue,
  onRunAgain,
  onFindAnother,
}: {
  state: ScanState;
  origin?: "live" | "cache" | "demo";
  /** Shown once the analysis is done. */
  onContinue?: () => void;
  /** Clears the result and scans again. */
  onRunAgain?: () => void;
  /** Back to step 1, offered when the business couldn't be found. */
  onFindAnother?: () => void;
}) {
  const { t, lang } = useI18n();
  const headingId = useId();
  const checklistId = useId();
  const total = state.steps.length;
  // The step that finished last, announced to screen readers.
  const latest = state.steps
    .filter((step) => step.finishedAt)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0];
  const finished = state.steps.filter(
    (step) => step.status !== "pending" && step.status !== "running",
  ).length;
  // "Gata" counts only what actually ran; skipped and failed steps are counted apart, so a
  // run that could not start never reads "8 din 8".
  const completedCount = state.steps.filter((step) => step.status === "done").length;
  const missed = finished - completedCount;
  const done = state.status === "done";
  const failed = state.status === "error";
  const website = state.audit?.host ?? state.discovery?.host ?? hostOf(state.target.url);
  const name = targetName(state, state.target);
  const found = Object.fromEntries(
    buildDataCards(state, t, lang).map((card) => [
      card.id,
      // The tech card's detail is only a count of the names already listed.
      card.id === "technology" ? card.value : [card.value, card.detail].filter(Boolean).join(", "),
    ]),
  ) as Partial<Record<DataCardId, string>>;

  const websiteStep = state.steps.find((step) => step.id === "website");
  const nothingFound = !state.company && !state.audit;
  const siteFailed =
    Boolean(state.audit && !state.audit.reachable) || websiteStep?.status === "failed";

  const title = done
    ? t("The analysis is ready", "Analiza e gata")
    : failed
      ? t("We couldn't finish the analysis", "Nu am putut termina analiza")
      : t("Analysing the business…", "Analizăm afacerea…");

  // On a failure the lead says what went wrong and what to try next.
  const lead = !failed
    ? t(
        "We read the company record from ANAF, check the website and look for similar local businesses.",
        "Citim datele firmei de la ANAF, verificăm site-ul și căutăm firme asemănătoare din zonă.",
      )
    : nothingFound
      ? t(
          "We couldn't find this business or a website to analyse. Check the name, CUI or address and search again.",
          "Nu am găsit firma sau un site de analizat. Verifică numele, CUI-ul sau adresa și caută din nou.",
        )
      : siteFailed
        ? t(
            "We couldn't open the website. Check the address or try with the CUI.",
            "Nu am putut deschide site-ul. Verifică adresa sau încearcă cu CUI-ul.",
          )
        : t(
            "We collected the data, but the plan couldn't be worked out. Try again in a minute.",
            "Am adunat datele, dar planul nu s-a putut calcula. Încearcă din nou peste un minut.",
          );

  const canRunAgain = Boolean(onRunAgain) && origin !== "demo";
  const actions = done ? (
    <>
      {canRunAgain ? (
        <Button variant="ghost" icon={<RotateCcw aria-hidden />} onClick={onRunAgain}>
          {t("Run again", "Reia analiza")}
        </Button>
      ) : null}
      {onContinue ? (
        <Button size="lg" onClick={onContinue}>
          {t("See what we found", "Vezi ce am găsit")}
        </Button>
      ) : null}
    </>
  ) : failed ? (
    <>
      {canRunAgain && !nothingFound ? (
        <Button size="lg" icon={<RotateCcw aria-hidden />} onClick={onRunAgain}>
          {t("Try again", "Încearcă din nou")}
        </Button>
      ) : null}
      {onFindAnother ? (
        <Button
          variant={canRunAgain && !nothingFound ? "secondary" : "primary"}
          size="lg"
          onClick={onFindAnother}
        >
          {nothingFound ? t("Search again", "Caută din nou") : t("Search by CUI", "Caută după CUI")}
        </Button>
      ) : null}
    </>
  ) : null;

  return (
    <section aria-labelledby={headingId}>
      <StepHeader
        id={headingId}
        company={name || undefined}
        place={
          website && website !== name ? <span className="type-code">{website}</span> : undefined
        }
        demo={origin === "demo"}
        title={title}
        lead={lead}
        actions={actions}
      />

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[25rem_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0">
          <Panel as="section" aria-labelledby={checklistId}>
            <PanelHeader
              titleId={checklistId}
              title={t("Analysis", "Analiza")}
              sub={
                <span className="type-pnum">
                  {t(
                    `${completedCount} of ${total} done${missed ? `, ${missed} skipped` : ""}`,
                    `${completedCount} din ${total} gata${missed ? `, ${missed} ${missed === 1 ? "omis" : "omise"}` : ""}`,
                  )}
                </span>
              }
            >
              <div
                role="progressbar"
                aria-label={t("Analysis progress", "Progresul analizei")}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={finished}
                className={cn(
                  "relative mt-3 h-0.5 overflow-hidden",
                  failed ? "bg-bad/40" : "bg-line-1",
                )}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-fg-2 transition-[width] duration-200"
                  style={{ width: `${total ? (finished / total) * 100 : 0}%` }}
                />
              </div>
            </PanelHeader>
            <PanelBody className="pb-3">
              <p aria-live="polite" className="sr-only">
                {latest ? `${stageLabel(latest, lang)}: ${latest.notes.at(-1)?.[lang] ?? ""}` : ""}
              </p>
              <ol aria-labelledby={checklistId} className="divide-y divide-line-1">
                {state.steps.map((step, index) => {
                  const card = FOUND_CARD[step.id];
                  return (
                    <ChecklistItem
                      key={step.id}
                      step={step}
                      number={index + 1}
                      found={card ? found[card] : undefined}
                    />
                  );
                })}
              </ol>
            </PanelBody>
          </Panel>
          {origin === "cache" ? (
            <p className="mt-2 text-xs leading-[1.45] text-fg-3">
              {t(
                "Restored from earlier in this session.",
                "Rezultat salvat mai devreme, în această sesiune.",
              )}
            </p>
          ) : null}
        </div>

        <ScanGlobe state={state} className="hidden md:block lg:sticky lg:top-40" />
      </div>
    </section>
  );
}

import { useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Building2, Globe2, Minus, RotateCcw, Search } from "lucide-react";

import { ScanGlobe } from "@/components/scan/globe/ScanGlobe";
import { scanButton } from "@/components/scan/report/buttons";
import { GLASS } from "@/components/scan/report/GlassCard";
import { InfoTip } from "@/components/scan/report/InfoTip";
import { StepHeader } from "@/components/scan/report/StepHeader";
import type { ScanState } from "@/components/scan/scan-state";
import { useI18n } from "@/i18n";
import type { ScanStep, ScanStepId, ScanTarget } from "@/lib/scan/types";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** How this screen names each real step of the scan (numbered in run order). */
const STAGE_LABELS: Record<ScanStepId, { en: string; ro: string }> = {
  identify: { en: "Identifying the company", ro: "Identificăm compania" },
  website: { en: "Analysing the website", ro: "Analizăm website-ul" },
  technology: { en: "Detecting the technologies", ro: "Detectăm tehnologiile" },
  presence: { en: "Mapping the digital presence", ro: "Cartografiem prezența digitală" },
  competitors: { en: "Researching competitors", ro: "Analizăm concurența" },
  journey: { en: "Mapping the customer journey", ro: "Urmărim parcursul clientului" },
  opportunities: { en: "Finding opportunities", ro: "Căutăm oportunități" },
  strategy: { en: "Simulating strategies", ro: "Simulăm strategii" },
};

const stageLabel = (step: ScanStep, lang: "en" | "ro") =>
  STAGE_LABELS[step.id]?.[lang] ?? step.label[lang];

function StatusIcon({ status }: { status: ScanStep["status"] }) {
  const base = "relative grid h-7 w-7 shrink-0 place-items-center rounded-full";
  if (status === "done") {
    return (
      <span className={cn(base, "bg-[#5fe3d0]/12 ring-1 ring-[#5fe3d0]/55")}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            fill="none"
            stroke="#5fe3d0"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
          />
        </svg>
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className={base}>
        <svg
          viewBox="0 0 28 28"
          className="absolute inset-0 h-full w-full animate-spin [animation-duration:1.1s] motion-reduce:animate-none"
          aria-hidden
        >
          <defs>
            <linearGradient id="scan-spinner" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#89cbf6" />
              <stop offset="100%" stopColor="#6c63ff" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <circle
            cx="14"
            cy="14"
            r="12"
            fill="none"
            stroke="rgb(255 255 255 / 0.1)"
            strokeWidth="2"
          />
          <path
            d="M14 2a12 12 0 0 1 12 12"
            fill="none"
            stroke="url(#scan-spinner)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <span className="h-1.5 w-1.5 rounded-full bg-[#89cbf6] shadow-[0_0_8px_#89cbf6]" />
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className={cn(base, "ring-1 ring-white/15")}>
        <Minus aria-hidden className="h-3.5 w-3.5 text-white/45" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={cn(base, "bg-white/[0.04] ring-1 ring-white/25")}>
        <span aria-hidden className="type-label text-white/75">
          !
        </span>
      </span>
    );
  }
  return (
    <span className={cn(base, "ring-1 ring-white/10")}>
      <span className="h-1 w-1 rounded-full bg-white/25" />
    </span>
  );
}

function seconds(step: ScanStep, lang: "en" | "ro") {
  if (!step.startedAt || !step.finishedAt) return null;
  const value = Math.max(0.1, (step.finishedAt - step.startedAt) / 1000);
  return `${value.toLocaleString(lang === "ro" ? "ro-RO" : "en-GB", { maximumFractionDigits: 1 })} s`;
}

function ChecklistItem({ step, number, last }: { step: ScanStep; number: number; last: boolean }) {
  const { t, lang } = useI18n();
  const note = step.notes[step.notes.length - 1];
  const noteText = note ? note[lang] : undefined;
  const label = stageLabel(step, lang);
  const statusText = {
    pending: t("waiting", "în așteptare"),
    running: t("in progress", "în curs"),
    done: t("done", "finalizat"),
    skipped: t("skipped", "omis"),
    failed: t("couldn't finish", "nefinalizat"),
  }[step.status];
  const took = step.status === "done" ? seconds(step, lang) : null;
  const finishedReason = step.status === "skipped" || step.status === "failed";

  return (
    <li className="relative flex gap-3.5 pb-4 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className={cn(
            "absolute left-[0.8125rem] top-8 h-[calc(100%-2.25rem)] w-px transition-colors duration-500",
            step.status === "done" ? "bg-[#5fe3d0]/35" : "bg-white/[0.08]",
          )}
        />
      )}
      <StatusIcon status={step.status} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "type-label w-5 shrink-0 tabular-nums transition-colors duration-300",
              step.status === "done" ? "text-[#5fe3d0]/75" : "text-white/30",
              step.status === "running" && "text-[#89cbf6]",
            )}
          >
            {String(number).padStart(2, "0")}
          </span>
          <span
            className={cn(
              "type-body transition-colors duration-300",
              step.status === "running" && "font-medium text-white",
              step.status === "done" && "text-white/90",
              step.status === "pending" && "text-white/40",
              finishedReason && "text-white/50",
            )}
          >
            {label}
            <span className="sr-only">, {statusText}</span>
          </span>
          {finishedReason && note && (
            <InfoTip
              label={
                step.status === "skipped"
                  ? t(`Why “${label}” was skipped`, `De ce „${label}” a fost omis`)
                  : t(`Why “${label}” couldn't finish`, `De ce „${label}” nu s-a finalizat`)
              }
              side="top"
            >
              {noteText}
            </InfoTip>
          )}
          {step.status === "skipped" && (
            <span aria-hidden className="type-label text-white/35">
              {t("Skipped", "Omis")}
            </span>
          )}
          {took && (
            <span className="type-tech ml-auto shrink-0 tabular-nums text-white/30">{took}</span>
          )}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {noteText && (step.status === "running" || step.status === "done") && (
            <motion.p
              key={noteText}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className={cn(
                "type-micro mt-0.5 truncate pl-7",
                step.status === "running" ? "text-[#89cbf6]" : "text-white/45",
              )}
              title={noteText}
            >
              {noteText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

/** The business being scanned, as far as we know it yet. */
function targetName(state: ScanState, target: ScanTarget) {
  if (state.company?.displayName) return state.company.displayName;
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
 * Stage 02, "Analysing your business…": the live checklist on the left (each
 * item ticks only when its call returns, with what it just found), and the
 * globe with a card per data source on the right.
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
  /** Back to stage 01, offered when the business couldn't be found. */
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
  // The counter only calls finished what actually ran; skipped and failed
  // steps are counted apart, so a run that could not start never reads "8 of 8".
  const completedCount = state.steps.filter((step) => step.status === "done").length;
  const missed = finished - completedCount;
  const done = state.status === "done";
  const failed = state.status === "error";
  const website = state.audit?.host ?? state.discovery?.host ?? hostOf(state.target.url);
  const name = targetName(state, state.target);

  const title = done ? (
    <>
      {t("Analysis ", "Analiză ")}
      <span className="heading-accent">{t("complete", "finalizată")}</span>
    </>
  ) : failed ? (
    t("We couldn't finish the analysis", "Nu am putut finaliza analiza")
  ) : (
    <>
      {t("Analysing your ", "Analizăm ")}
      <span className="heading-accent">{t("business", "afacerea")}</span>
      {t("…", " ta…")}
    </>
  );

  return (
    <section
      aria-labelledby={headingId}
      className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] xl:gap-14"
    >
      <div>
        <StepHeader
          id={headingId}
          eyebrow={t("02 · Analysis", "02 · Analiză")}
          title={title}
          description={t(
            "Vortex Hub is collecting and analysing publicly available data to understand your business, market and opportunities.",
            "Vortex Hub colectează și analizează date publice pentru a înțelege afacerea, piața și oportunitățile tale.",
          )}
        />

        {(name || website) && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {name && (
              <span className="type-body-sm inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/85">
                <Building2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#89cbf6]" />
                <span className="truncate">{name}</span>
              </span>
            )}
            {website && website !== name && (
              <span className="type-body-sm inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/70">
                <Globe2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#89cbf6]" />
                <span className="truncate">{website}</span>
              </span>
            )}
            {origin === "demo" && (
              <span className="type-label rounded-full border border-[#5fe3d0]/30 bg-[#5fe3d0]/10 px-3 py-1.5 text-[#5fe3d0]">
                {t("Sample data · fictional clinic", "Date de exemplu · clinică fictivă")}
              </span>
            )}
          </div>
        )}

        <div className={cn(GLASS, "mt-6 p-5 sm:p-6")}>
          <div className="flex items-center justify-between gap-4">
            <h3 id={checklistId} className="type-label flex items-center gap-2 text-white/50">
              {!done && !failed && (
                <span
                  aria-hidden
                  className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-[#89cbf6] shadow-[0_0_8px_#89cbf6]"
                />
              )}
              {done
                ? t("Analysis complete", "Analiză finalizată")
                : failed
                  ? t("Analysis incomplete", "Analiză incompletă")
                  : t("Analysis in progress", "Analiză în curs")}
            </h3>
            <span className="type-tech text-right tabular-nums text-white/55">
              {t(
                `${completedCount} of ${total} complete${missed ? ` · ${missed} skipped` : ""}`,
                `${completedCount} din ${total} finalizate${missed ? ` · ${missed} omise` : ""}`,
              )}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={t("Analysis progress", "Progresul analizei")}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={finished}
            className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]"
          >
            <motion.div
              className="h-full origin-left rounded-full bg-gradient-to-r from-[#6c63ff] via-[#5b8cf0] to-[#89cbf6]"
              initial={false}
              animate={{ scaleX: total ? finished / total : 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            />
          </div>

          <p aria-live="polite" className="sr-only">
            {latest ? `${stageLabel(latest, lang)}: ${latest.notes.at(-1)?.[lang] ?? ""}` : ""}
          </p>
          <ol aria-labelledby={checklistId} className="mt-5">
            {state.steps.map((step, index) => (
              <ChecklistItem
                key={step.id}
                step={step}
                number={index + 1}
                last={index === state.steps.length - 1}
              />
            ))}
          </ol>
        </div>

        {(done || failed) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="mt-6 flex flex-wrap items-center gap-3"
          >
            {done && onContinue && (
              <button type="button" onClick={onContinue} className={scanButton("primary", "lg")}>
                {t("See what we found", "Vezi ce am găsit")}
                <ArrowRight aria-hidden />
              </button>
            )}
            {failed && onFindAnother && (
              <button
                type="button"
                onClick={onFindAnother}
                className={scanButton(state.company || state.audit ? "secondary" : "primary", "lg")}
              >
                <Search aria-hidden />
                {t("Search another business", "Caută altă afacere")}
              </button>
            )}
            {onRunAgain && origin !== "demo" && (state.company || state.audit || !failed) && (
              <button
                type="button"
                onClick={onRunAgain}
                className={scanButton(failed ? "primary" : "secondary", "lg")}
              >
                <RotateCcw aria-hidden />
                {failed ? t("Try again", "Încearcă din nou") : t("Run again", "Reia analiza")}
              </button>
            )}
            {origin === "cache" && (
              <p className="type-micro w-full text-white/45">
                {t(
                  "Restored from earlier in this session.",
                  "Rezultat salvat mai devreme, în această sesiune.",
                )}
              </p>
            )}
            {failed && (
              <p className="type-body-sm w-full text-white/60">
                {state.company || state.audit
                  ? t(
                      "Something went wrong while building your strategy. Please try again in a moment.",
                      "A apărut o problemă la pregătirea strategiei. Te rugăm să încerci din nou în câteva momente.",
                    )
                  : t(
                      "We couldn't find this business or a website to analyse. Check the name, CUI or address and search again.",
                      "Nu am găsit această afacere sau un site de analizat. Verifică numele, CUI-ul sau adresa și caută din nou.",
                    )}
              </p>
            )}
          </motion.div>
        )}
      </div>

      <ScanGlobe state={state} className="lg:sticky lg:top-28" />
    </section>
  );
}

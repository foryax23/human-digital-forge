import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { LandingNav } from "@/components/landing/LandingNav";
import { Spinner, Tag } from "@/components/system";
import { supabase } from "@/integrations/supabase/client";
import type {
  AccessReason,
  CompetitorCard,
  Correction,
  DeepAccess,
  DeepReport,
  FeedbackKind,
  OwnerInputs,
  StartDeepRunInput,
} from "@/lib/deep/contracts";
import { applyCorrections } from "@/lib/deep/report";
import { DEEP_TERMS_VERSION } from "@/lib/scan/legal/lead-notice";
import { findCompanyByCui } from "@/lib/scan/company-search";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { PAGE_TITLE, REASON_COPY, RULES_LABEL } from "./copy";
import { DeepEntry } from "./DeepEntry";
import { DeepGate } from "./DeepGate";
import { DeepStartForm, type StartCompany } from "./DeepStartForm";
import { DeepTimeline } from "./DeepTimeline";
import type { DemoSector } from "./fixtures/demo-report";
import {
  DEMO_USER_ID,
  demoAccess,
  demoReportFor,
  demoRunning,
  GATE_REASON,
  type DemoState,
} from "./fixtures/states";
import { dayLabel } from "./format";
import {
  browserStorage,
  clearJournal,
  clearPending,
  hasAnyJournal,
  previousReport,
  readIndex,
  readPending,
  rememberTerms,
  removeRun,
  savePending,
  termsAccepted,
  unfinishedRun,
  type RunSnapshot,
} from "./journal";
import { ReportContext, type DeepReportCtx, type ReportTab } from "./report/context";
import { DeepReportView } from "./report/DeepReportView";
import { TAG_13 } from "./report/helpers";
import { SampleTag } from "./report/shared";
import { applyRivalEdits, withOwnerInputs } from "./report-adapter";
import { DeepTheme, ThemeSwitch } from "./theme";
import {
  fetchAccess,
  fetchStoredRun,
  sendCallRequest,
  sendEvents,
  sendFeedback,
  serverTransport,
  verifyCode,
} from "./transport";
import { useDeepResearch } from "./useDeepResearch";

/*
 * /scan/deep (plan A10): the gate, the start form, the running timeline and the report, plus
 * the ?demo= sample and screenshot states and ?verify= for PDF codes. Rendered inside
 * .cinematic with LandingNav, like /scan; the report area follows the light/dark choice.
 * No route loader: all deep work starts on the client after hydration.
 */

export type DeepSearch = {
  cui?: number;
  site?: string;
  run?: string;
  view?: ReportTab;
  demo?: DemoState;
  sector?: DemoSector;
  verify?: string;
  theme?: "light" | "dark";
};

type SetSearch = (patch: Partial<DeepSearch>, opts?: { replace?: boolean }) => void;

export function DeepPage({ search, setSearch }: { search: DeepSearch; setSearch: SetSearch }) {
  return (
    <div className="cinematic relative isolate min-h-screen overflow-x-clip bg-background text-foreground">
      <LandingNav offPage />
      {/* Keeps the nav bar solid over the light report (the nav's top scrim is for dark pages). */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-40 h-14 bg-background md:h-16" />
      <DeepTheme forced={search.theme}>
        <main className="container-vx pb-28 pt-[4.75rem] sm:pb-20 md:pt-24">
          {search.demo ? (
            <DemoPage search={search} setSearch={setSearch} />
          ) : search.verify ? (
            <VerifyView code={search.verify} />
          ) : (
            <LivePage search={search} setSearch={setSearch} />
          )}
        </main>
      </DeepTheme>
    </div>
  );
}

/* ------------------------------------------------------------------ header */

function PageHeader({
  company,
  sample,
  cui,
  rules,
  ai,
}: {
  company?: { name: string; city?: string };
  sample?: boolean;
  cui?: string;
  /** A rules-only report: "Analiză pe reguli, fără AI" in the company line. */
  rules?: boolean;
  /** An AI-written report: disclosed at first sight (AI Act art. 50), linking to how we worked. */
  ai?: boolean;
}) {
  const { t, lang } = useI18n();
  return (
    <header className="mb-3 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 text-[0.8125rem] leading-[1.35] text-fg-3">
          <Link
            to="/scan"
            search={cui ? { cui: Number(cui) } : undefined}
            className="-my-3 inline-flex min-h-11 items-center gap-1.5 rounded-sm hover:text-fg"
          >
            <ArrowLeft aria-hidden className="size-3.5" />
            Vortex Scan
          </Link>
          <span aria-hidden>/</span>
          <h1 className="font-medium text-fg-3">
            {PAGE_TITLE[lang]}
            {company ? <span className="sr-only">: {company.name}</span> : null}
          </h1>
        </div>
        {company ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] font-medium text-fg">
            <span className="min-w-0">{company.name}</span>
            {company.city ? <span className="font-normal text-fg-2">{company.city}</span> : null}
            {cui ? <span className="type-code font-normal text-fg-3">CUI {cui}</span> : null}
            {sample ? <SampleTag /> : null}
            {rules ? (
              <Tag variant="outline" className={TAG_13}>
                {RULES_LABEL[lang]}
              </Tag>
            ) : null}
            {ai ? (
              <a
                href="#cum-am-lucrat"
                className="inline-flex min-h-11 items-center rounded-sm sm:min-h-0"
                onClick={(e) => {
                  const target = document.getElementById("cum-am-lucrat");
                  if (!target) return;
                  e.preventDefault();
                  target.scrollIntoView({ block: "start" });
                }}
              >
                <Tag variant="outline" className={cn(TAG_13, "font-normal hover:text-fg")}>
                  {t("Text drafted with AI · how we worked", "Text redactat cu AI · cum am lucrat")}
                </Tag>
              </a>
            ) : null}
          </p>
        ) : sample ? (
          <p className="mt-1">
            <SampleTag />
          </p>
        ) : null}
      </div>
      <ThemeSwitch className="max-sm:hidden" />
    </header>
  );
}

function BottomThemeSwitch() {
  return (
    <div className="mt-10 border-t border-line-1 pt-4 sm:hidden">
      <ThemeSwitch />
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-fg-2" role="status">
      <Spinner size={14} className="text-brand-line" />
      {label}
    </p>
  );
}

/* ------------------------------------------------------------------ report */

type Edits = { removed: string[]; added: CompetitorCard[] };

/** The report as shown: corrections, then the owner's numbers, then the rival edits. */
function useShownReport(
  official: DeepReport | null,
  corrections: Correction[],
  owner: OwnerInputs | undefined,
  edits: Edits,
) {
  return useMemo(() => {
    if (!official) return null;
    let report = official;
    if (corrections.length) report = applyCorrections(report, corrections);
    report = withOwnerInputs(report, owner);
    return applyRivalEdits(report, edits);
  }, [official, corrections, owner, edits]);
}

function ReportScreen({
  official,
  sample,
  access,
  corrections,
  owner,
  edits,
  onCorrections,
  onOwner,
  onEdits,
  onFeedbackSend,
  onEvent,
  tab,
  onTab,
  previous,
  onForget,
  timings,
  activeMs,
  store,
}: {
  official: DeepReport;
  sample: boolean;
  access: DeepAccess | null;
  corrections: Correction[];
  owner?: OwnerInputs;
  edits: Edits;
  onCorrections: (next: Correction[]) => void;
  onOwner: (owner: OwnerInputs | undefined) => void;
  onEdits: (next: Edits) => void;
  onFeedbackSend: (
    kind: FeedbackKind,
    extra?: { factId?: string; message?: string; value?: unknown },
  ) => Promise<"sent" | "kept" | "sample">;
  onEvent: (name: string) => void;
  tab: ReportTab;
  onTab: (tab: ReportTab) => void;
  previous?: { report: DeepReport; at: number } | null;
  onForget?: () => void;
  timings?: RunSnapshot["timings"];
  activeMs?: number;
  /** The run's storage kind (decides whether the PDF code can be checked online). */
  store?: string;
}) {
  const report = useShownReport(official, corrections, owner, edits)!;
  const pendingAnchor = useRef<string | null>(null);

  useEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = null;
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() =>
        document.getElementById(anchor)?.scrollIntoView({ block: "start" }),
      ),
    );
  }, [tab]);

  const ctx: DeepReportCtx = {
    report,
    official,
    sample,
    access,
    corrections,
    owner,
    rivalEdits: edits,
    onCorrect: (c) => {
      onCorrections([...corrections.filter((x) => x.predicate !== c.predicate), c]);
      onEvent("correction");
      void onFeedbackSend("correction", { factId: c.predicate, value: c });
    },
    onOwnerInputs: (next) => {
      onOwner(next);
      onEvent("owner_inputs");
    },
    onRemoveRival: (cui) => {
      onEdits({ ...edits, removed: [...new Set([...edits.removed, cui])] });
      onEvent("rival_removed");
      void onFeedbackSend("competitor_edit", { value: { remove: cui } });
    },
    onAddRival: (card) => {
      onEdits({
        ...edits,
        added: [
          ...edits.added.filter((c) => c.cui !== card.cui),
          {
            ...card,
            whyChosen: { en: "Added by you", ro: "Adăugat de tine" },
            origin: "owner_added",
            factIds: [],
          },
        ],
      });
      onEvent("rival_added");
      void onFeedbackSend("competitor_edit", { value: { add: card.cui } });
    },
    onFeedback: onFeedbackSend,
    onEvent,
    onCallRequest: async (phone, when) => {
      if (sample) return true;
      const out = await sendCallRequest({
        runId: official.runId,
        phone,
        when,
        lang: official.lang,
      });
      return out.ok;
    },
    goTo: (next, anchor) => {
      if (next === tab) {
        if (anchor)
          window.requestAnimationFrame(() =>
            document.getElementById(anchor)?.scrollIntoView({ block: "start" }),
          );
        return;
      }
      pendingAnchor.current = anchor ?? null;
      onTab(next);
      if (!anchor) window.scrollTo({ top: 0 });
    },
    onForget,
    timings,
    activeMs,
    store,
  };

  return (
    <ReportContext.Provider value={ctx}>
      <DeepReportView tab={tab} onTab={onTab} previous={previous} />
    </ReportContext.Provider>
  );
}

/* ------------------------------------------------------------------ demo */

function DemoPage({ search, setSearch }: { search: DeepSearch; setSearch: SetSearch }) {
  const { lang } = useI18n();
  const state = search.demo!;
  const sector = search.sector ?? "sanatate";
  const access = demoAccess(state);
  const official = useMemo(() => demoReportFor(state, sector, lang), [state, sector, lang]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [owner, setOwner] = useState<OwnerInputs | undefined>(undefined);
  const [edits, setEdits] = useState<Edits>({ removed: [], added: [] });
  const tab = search.view ?? "pe-scurt";
  const gate = GATE_REASON[state];
  const sampleCompany = official?.company ?? demoReportFor("exemplu", sector, lang)!.company;

  let content: React.ReactNode;
  if (gate) {
    content = (
      <DeepGate
        reason={gate}
        userId={DEMO_USER_ID}
        onCode={() => undefined}
        onRetry={() => undefined}
      />
    );
  } else if (state === "intrare") {
    content = (
      <div className="max-w-[60rem] space-y-8">
        <p className="text-fg-2">
          {lang === "ro"
            ? "Cum apare intrarea pe /scan: linia scurtă după firma analizată și blocul de la finalul planului."
            : "How the entry looks on /scan: the short line after the company and the block at the end of the plan."}
        </p>
        <DeepEntry cui={sampleCompany.cui} variant="compact" preview />
        <DeepEntry cui={sampleCompany.cui} variant="full" preview />
      </div>
    );
  } else if (state === "formular") {
    content = (
      <DeepStartForm
        company={{
          cui: sampleCompany.cui,
          name: sampleCompany.displayName,
          city: sampleCompany.city,
        }}
        access={access}
        termsRemembered={false}
        busy={false}
        sample
        onStart={() => setSearch({ demo: "ruleaza" })}
      />
    );
  } else if (state === "ruleaza" || state === "site" || state === "pauza") {
    const snap = demoRunning(lang, state, sector);
    content = (
      <DeepTimeline
        snap={snap}
        ask={state === "site" ? (snap.askSite ?? null) : null}
        onAnswer={() => setSearch({ demo: "ruleaza" })}
        paused={state === "pauza"}
        onResume={() => setSearch({ demo: "ruleaza" })}
      />
    );
  } else if (official) {
    content = (
      <ReportScreen
        official={official}
        sample
        access={access}
        corrections={corrections}
        owner={owner}
        edits={edits}
        onCorrections={setCorrections}
        onOwner={setOwner}
        onEdits={setEdits}
        onFeedbackSend={async () => "sample"}
        onEvent={() => undefined}
        tab={tab}
        onTab={(view) => setSearch({ view }, { replace: true })}
        timings={
          state.startsWith("raport")
            ? [
                { slot: "start", status: "done", ms: 1180, anafCalls: 1 },
                { slot: "money", status: "done", ms: 7940, anafCalls: 7 },
                { slot: "site", status: "done", ms: 2210, subrequests: 9 },
                { slot: "signals", status: "done", ms: 3410, subrequests: 4 },
                { slot: "peers", status: "done", ms: 2480, anafCalls: 1 },
                { slot: "audit", status: "done", ms: 9120, subrequests: 12 },
                { slot: "crawl1", status: "done", ms: 12800, subrequests: 9 },
                { slot: "finish", status: official.aiMode, ms: 1900 },
              ]
            : undefined
        }
        activeMs={state.startsWith("raport") ? 148_000 : undefined}
      />
    );
  }

  const showCompany = !gate && state !== "intrare";
  return (
    <>
      <PageHeader
        company={
          showCompany ? { name: sampleCompany.displayName, city: sampleCompany.city } : undefined
        }
        cui={showCompany ? sampleCompany.cui : undefined}
        sample
        rules={official?.aiMode === "rules"}
        ai={official?.aiMode === "ai" && !gate && state !== "intrare"}
      />
      {content}
      <BottomThemeSwitch />
    </>
  );
}

/* ------------------------------------------------------------------ verify */

function VerifyView({ code }: { code: string }) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<Awaited<ReturnType<typeof verifyCode>> | null>(null);
  useEffect(() => {
    let live = true;
    void verifyCode(code).then((out) => live && setState(out));
    return () => {
      live = false;
    };
  }, [code]);
  return (
    <>
      <PageHeader />
      <section aria-labelledby="verify-title" className="max-w-[40rem]">
        <h2 id="verify-title" className="type-title text-fg">
          {t("Check a report code", "Verifică un cod de raport")}
        </h2>
        <p className="type-code mt-2 text-fg-2">{code}</p>
        <div className="mt-4">
          {!state ? (
            <Loading label={t("Checking…", "Verificăm…")} />
          ) : state.ok ? (
            <p className="text-fg">
              {t(
                `Real report: ${state.company} (CUI ${state.cui}), generated on ${dayLabel(state.generatedAt, "en")}.`,
                `Raport real: ${state.company} (CUI ${state.cui}), generat la ${dayLabel(state.generatedAt, "ro")}.`,
              )}
            </p>
          ) : state.reason === "not_found" ? (
            <p className="text-fg">{t("We can't find this code.", "Nu găsim acest cod.")}</p>
          ) : (
            <p className="text-fg-2">
              {lang === "ro"
                ? "Verificarea codurilor pornește odată cu salvarea rapoartelor pe server. Codul rămâne valabil și poate fi verificat atunci."
                : "Code checks start once reports are saved on our server. The code stays valid and can be checked then."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ live */

function LivePage({ search, setSearch }: { search: DeepSearch; setSearch: SetSearch }) {
  const { t, lang } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const uid = user?.id ?? null;
  const storage = browserStorage();
  const cui = search.cui ? String(search.cui) : undefined;
  const [access, setAccess] = useState<DeepAccess | null>(null);
  const [accessError, setAccessError] = useState(false);
  const [testCode, setTestCode] = useState<string | undefined>(undefined);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [company, setCompany] = useState<StartCompany | null>(null);
  const [stored, setStored] = useState<DeepReport | null | "none">(null);
  const research = useDeepResearch({ uid, transport: serverTransport, runId: search.run });
  const { snap, phase } = research;
  const events = useRef<Array<{ name: string; at: string }>>([]);

  // Sign-out clears every deep journal in this browser; a signed-out visitor keeps none.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") clearJournal(browserStorage());
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!authLoading && !uid && hasAnyJournal(storage)) clearJournal(storage);
  }, [authLoading, uid, storage]);

  // After the login, the pending target (kept 1 hour) brings the visitor back to the company.
  useEffect(() => {
    if (authLoading || !uid || cui || search.run) return;
    const pending = readPending(storage, Date.now());
    if (!pending) return;
    clearPending(storage);
    setSearch(
      {
        ...(pending.cui ? { cui: Number(pending.cui) } : {}),
        ...(pending.site ? { site: pending.site } : {}),
        ...(pending.run ? { run: pending.run } : {}),
      },
      { replace: true },
    );
  }, [authLoading, uid, cui, search.run, storage, setSearch]);

  const loadAccess = useCallback(async (code?: string) => {
    setAccessError(false);
    try {
      const value = await fetchAccess(code);
      setAccess(value);
      return value;
    } catch {
      setAccessError(true);
      return null;
    }
  }, []);
  useEffect(() => {
    if (authLoading) return;
    void loadAccess(testCode);
  }, [authLoading, uid, loadAccess, testCode]);

  // Not signed in: keep the target for after the login (1 hour, this browser).
  useEffect(() => {
    if (access?.reason === "login_required" && (cui || search.run))
      savePending(storage, { cui, site: search.site, run: search.run }, Date.now());
  }, [access?.reason, cui, search.site, search.run, storage]);

  // The company line of the form, from the public company index (no server call).
  useEffect(() => {
    if (!cui) return;
    let live = true;
    setCompany({ cui });
    void findCompanyByCui(cui)
      .then((c) => {
        if (live && c) setCompany({ cui, name: c.displayName, city: c.city });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [cui]);

  // A run that is not in this browser: the server copy when storage has one (tables only).
  useEffect(() => {
    if (!search.run || !uid || snap || phase !== "idle") return;
    let live = true;
    setStored(null);
    void fetchStoredRun(search.run).then((out) => live && setStored(out ? out.report : "none"));
    return () => {
      live = false;
    };
  }, [search.run, uid, snap, phase]);

  const onEvent = useCallback((name: string) => {
    if (events.current.length < 50) events.current.push({ name, at: new Date().toISOString() });
  }, []);
  // Events go once the report is shown and whenever the page is hidden.
  useEffect(() => {
    const runId = snap?.runId;
    if (!runId) return;
    const flush = () => {
      const batch = events.current.splice(0);
      void sendEvents(runId, batch);
    };
    const onHide = () => {
      if (document.hidden) flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [snap?.runId]);

  const start = async (input: StartDeepRunInput) => {
    if (uid) rememberTerms(storage, uid, DEEP_TERMS_VERSION, Date.now());
    const started = await research.start(input);
    if (started) setSearch({ run: started.runId, cui: Number(started.cui) }, { replace: true });
  };

  const header = (
    <PageHeader
      company={
        snap
          ? { name: snap.report?.company.displayName ?? snap.name, city: snap.report?.company.city }
          : company?.name
            ? { name: company.name, city: company.city }
            : undefined
      }
      cui={snap?.cui ?? cui}
      rules={
        snap?.report?.aiMode === "rules" || (snap?.status === "running" && snap.aiMode === "rules")
      }
      ai={snap?.report?.aiMode === "ai" && snap.status === "done"}
    />
  );

  let content: React.ReactNode;
  if (authLoading) content = <Loading label={t("Loading…", "Se încarcă…")} />;
  else if (snap && (snap.status === "done" || phase === "done") && snap.report) {
    content = (
      <ReportScreen
        official={snap.report}
        sample={false}
        access={access}
        corrections={snap.corrections}
        owner={snap.owner}
        edits={snap.rivalEdits}
        onCorrections={(next) => research.update((s) => ({ ...s, corrections: next }))}
        onOwner={(next) => research.update((s) => ({ ...s, owner: next }))}
        onEdits={(next) => research.update((s) => ({ ...s, rivalEdits: next }))}
        onFeedbackSend={async (kind, extra) => {
          const out = await sendFeedback({ runId: snap.runId, kind, ...extra });
          return out.ok ? "sent" : "kept";
        }}
        onEvent={onEvent}
        tab={search.view ?? "pe-scurt"}
        onTab={(view) => setSearch({ view }, { replace: true })}
        previous={uid ? previousReport(storage, uid, snap.cui, snap.runId) : null}
        onForget={() => {
          if (uid) removeRun(storage, uid, snap.runId);
          setSearch({ run: undefined, view: undefined }, { replace: true });
          window.location.reload();
        }}
        timings={snap.timings}
        activeMs={snap.activeMs}
        store={snap.store}
      />
    );
  } else if (snap && snap.status === "failed") {
    const reason: AccessReason = snap.failure ?? "ledger_unavailable";
    content = (
      <DeepGate reason={reason} onRetry={() => setSearch({ run: undefined }, { replace: true })} />
    );
  } else if (snap && phase === "busy_elsewhere") {
    content = (
      <section className="max-w-[40rem]">
        <h2 className="type-title text-fg">
          {t("The research runs in another tab", "Cercetarea rulează în alt tab")}
        </h2>
        <p className="mt-2 text-fg-2">
          {t(
            "Keep that tab open; the report appears there. You can close this one.",
            "Ține acel tab deschis; raportul apare acolo. Pe acesta îl poți închide.",
          )}
        </p>
      </section>
    );
  } else if (snap && snap.status === "running") {
    content = (
      <DeepTimeline
        snap={snap}
        ask={research.ask}
        onAnswer={research.answerSite}
        paused={phase === "paused" || phase === "idle"}
        onResume={research.resume}
      />
    );
  } else if (search.run && stored && stored !== "none") {
    content = (
      <ReportScreen
        official={stored}
        sample={false}
        access={access}
        corrections={[]}
        edits={{ removed: [], added: [] }}
        onCorrections={() => undefined}
        onOwner={() => undefined}
        onEdits={() => undefined}
        onFeedbackSend={async (kind, extra) => {
          const out = await sendFeedback({ runId: stored.runId, kind, ...extra });
          return out.ok ? "sent" : "kept";
        }}
        onEvent={onEvent}
        tab={search.view ?? "pe-scurt"}
        onTab={(view) => setSearch({ view }, { replace: true })}
      />
    );
  } else if (search.run && uid && stored === "none") {
    content = (
      <section className="max-w-[40rem]">
        <h2 className="type-title text-fg">
          {t("We can't open this research here", "Nu putem deschide cercetarea aici")}
        </h2>
        <p className="mt-2 text-fg-2">
          {t(
            "An unfinished research continues only in the browser where it started, and finished reports are kept for 90 days on the account that made them.",
            "O cercetare neterminată continuă doar în browserul în care a pornit, iar rapoartele terminate rămân 90 de zile în contul care le-a făcut.",
          )}
        </p>
        <p className="mt-4">
          <Link
            to="/dashboard/research"
            className="font-medium text-fg underline underline-offset-4"
          >
            {t("See your reports", "Vezi rapoartele tale")}
          </Link>
        </p>
      </section>
    );
  } else if (phase === "starting") {
    content = (
      <Loading
        label={t("Starting: reading the official registers…", "Pornim: citim registrele oficiale…")}
      />
    );
  } else if (phase === "refused" && research.refusal) {
    const unfinished = uid ? unfinishedRun(storage, uid, Date.now()) : null;
    content = (
      <DeepGate
        reason={research.refusal.reason}
        replayRunId={research.refusal.replayRunId}
        unfinishedRunId={unfinished?.runId}
        onRetry={() => window.location.reload()}
      />
    );
  } else if (accessError) {
    content = <DeepGate reason="ledger_unavailable" onRetry={() => void loadAccess(testCode)} />;
  } else if (!access) {
    content = <Loading label={t("Checking access…", "Verificăm accesul…")} />;
  } else if (!access.allowed) {
    const reason = access.reason ?? "admin_only";
    content = (
      <DeepGate
        reason={reason}
        userId={uid}
        codeBusy={codeBusy}
        codeError={codeError}
        onCode={async (code) => {
          setCodeBusy(true);
          const value = await loadAccess(code);
          setCodeBusy(false);
          if (value?.allowed) {
            setTestCode(code);
            setCodeError(false);
          } else setCodeError(true);
        }}
        onRetry={() => void loadAccess(testCode)}
      />
    );
  } else if (!cui) {
    content = <NoCompany uid={uid} />;
  } else {
    content = (
      <DeepStartForm
        company={company ?? { cui }}
        site={search.site}
        access={access}
        termsRemembered={Boolean(uid && termsAccepted(storage, uid, DEEP_TERMS_VERSION))}
        busy={false}
        testCode={testCode}
        onStart={start}
      />
    );
  }

  const ready = Boolean(snap?.report && snap.status === "done");
  return (
    <>
      {/* "Raportul e gata", announced without moving focus (the timeline's region goes away). */}
      <div aria-live="polite" className="sr-only">
        {ready && phase === "done" ? t("The report is ready", "Raportul e gata") : ""}
      </div>
      {header}
      {content}
      <BottomThemeSwitch />
    </>
  );
}

/** Allowed but no company chosen: where to pick one, and this browser's reports. */
function NoCompany({ uid }: { uid: string | null }) {
  const { t, lang } = useI18n();
  const list = uid ? readIndex(browserStorage(), uid) : [];
  return (
    <section className="max-w-[44rem]">
      <h2 className="type-title text-fg">{t("Choose a company", "Alege firma")}</h2>
      <p className="mt-2 text-fg-2">
        {t(
          "Search the company in Vortex Scan; the deep research starts from its results.",
          "Caută firma în Vortex Scan; cercetarea aprofundată pornește din rezultatele ei.",
        )}
      </p>
      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <Link to="/scan" className="font-medium text-fg underline underline-offset-4">
          {t("Go to Vortex Scan", "Mergi la Vortex Scan")}
        </Link>
        {uid ? (
          <Link
            to="/dashboard/research"
            className="font-medium text-fg underline underline-offset-4"
          >
            {t("All your reports", "Toate rapoartele tale")}
          </Link>
        ) : null}
      </p>
      {list.length ? (
        <div className="mt-8">
          <h3 className="type-h4 text-fg">
            {t("Your reports in this browser", "Rapoartele tale din acest browser")}
          </h3>
          <ul className="mt-2 border-t border-line-1">
            {list.map((e) => (
              <li key={e.runId} className="border-b border-line-1">
                <Link
                  to="/scan/deep"
                  search={{ run: e.runId }}
                  className={cn(
                    "flex min-h-11 items-center justify-between gap-3 py-2 hover:bg-fill-1",
                  )}
                >
                  <span className="font-medium text-fg">{e.name}</span>
                  <span className="text-[0.8125rem] text-fg-3">
                    {dayLabel(new Date(e.createdAt).toISOString(), lang)}
                    {e.status === "running" ? ` · ${t("unfinished", "neterminată")}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

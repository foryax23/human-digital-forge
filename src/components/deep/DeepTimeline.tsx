import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Check } from "lucide-react";

import { Button, Panel, PanelBody, Spinner } from "@/components/system";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Fact } from "@/lib/deep/contracts";
import { previewLights } from "@/lib/deep/report";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { RUNNING_NOTE } from "./copy";
import { Disclosure } from "./report/shared";
import { leiParts, NBSP } from "./format";
import type { AskSite, RunSnapshot } from "./journal";
import { Lines } from "./report/Brief";
import { stageProgress, stagesOf, timeLeftMs, timeLeftText, type Stage } from "./stages";

/*
 * The running view (plan A10 "Timeline"): honest stages with real counts, skips with their
 * reason, "4 din 9 pași" and the time left from measured medians (no percentages), the site
 * question without blocking the other steps, and what was found so far: the official figures
 * within seconds, then the provisional lines. An aria-live region announces finished stages
 * and "Raportul e gata" without moving focus.
 */

function Marker({ status }: { status: Stage["status"] }) {
  if (status === "running") return <Spinner size={12} className="text-brand-line" />;
  if (status === "done")
    return <Check aria-hidden className="size-3.5 text-fg-3" strokeWidth={2.5} />;
  if (status === "waiting")
    return (
      <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="text-warn">
        <path d="M6 0.6 11.4 6 6 11.4 0.6 6Z" fill="currentColor" />
      </svg>
    );
  if (status === "failed") return <span aria-hidden className="size-2 rounded-[1px] bg-bad" />;
  if (status === "skipped") return <span aria-hidden className="h-px w-2.5 bg-fg-3" />;
  return <span aria-hidden className="size-2 rounded-[1px] border border-fg-4" />;
}

const STATUS_WORD: Record<Stage["status"], [string, string]> = {
  pending: ["waiting", "urmează"],
  running: ["in progress", "în lucru"],
  waiting: ["needs your answer", "așteaptă răspunsul tău"],
  done: ["done", "gata"],
  skipped: ["skipped", "omis"],
  failed: ["did not work", "nu a mers"],
};

function mergedFacts(snap: RunSnapshot): Fact[] {
  const byId = new Map<string, Fact>();
  for (const slot of snap.order) for (const f of snap.results[slot]?.facts ?? []) byId.set(f.id, f);
  return [...byId.values()];
}

export function DeepTimeline({
  snap,
  ask,
  onAnswer,
  paused,
  onResume,
}: {
  snap: RunSnapshot;
  ask: AskSite | null;
  onAnswer: (answer: { url: string; yes: boolean } | null) => void;
  paused?: boolean;
  onResume?: () => void;
}) {
  const { t, lang } = useI18n();
  const titleId = useId();
  const mobile = useIsMobile();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  void now;

  const stages = stagesOf(snap, lang);
  const progress = stageProgress(stages);
  const left = timeLeftText(timeLeftMs(snap));
  const facts = useMemo(() => mergedFacts(snap), [snap]);
  const audience =
    snap.relationship === "proprietar" || snap.relationship === "angajat" ? "owner" : "third_party";
  const lights = useMemo(
    () => (snap.results.money ? previewLights(facts, { audience }) : []),
    [facts, audience, snap.results.money],
  );

  const stageList = <StageList stages={stages} />;

  // Announce finished stages (polite, no focus change).
  const [announce, setAnnounce] = useState("");
  const seen = useRef<Record<string, string>>({});
  useEffect(() => {
    for (const s of stages) {
      const before = seen.current[s.id];
      if (
        before !== s.status &&
        (s.status === "done" || s.status === "skipped" || s.status === "failed")
      ) {
        if (before !== undefined)
          setAnnounce(`${s.label[lang]}: ${t(STATUS_WORD[s.status][0], STATUS_WORD[s.status][1])}`);
      }
      seen.current[s.id] = s.status;
    }
  }, [stages, lang, t]);

  return (
    <section aria-labelledby={titleId} className="max-w-[48rem]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <h2 id={titleId} className="type-title text-balance text-fg">
          {t(`Researching ${snap.name}`, `Cercetăm ${snap.name}`)}
        </h2>
        <p className="type-pnum shrink-0 text-[0.9375rem] text-fg-2">
          {lang === "ro"
            ? `${progress.done} din ${progress.total} pași`
            : `${progress.done} of ${progress.total} steps`}
          {paused ? null : <span className="text-fg-3"> · {left[lang]}</span>}
        </p>
      </div>
      <p className="mt-2 max-w-[60ch] text-fg-2">{RUNNING_NOTE[lang]}</p>
      {mobile ? (
        <div
          aria-hidden
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-fill-2"
          title={`${progress.done}/${progress.total}`}
        >
          <div
            className="h-full rounded-full bg-brand-line transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
          />
        </div>
      ) : null}

      {paused ? (
        <Panel className="mt-4">
          <PanelBody className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-fg">
              {t("We continue from where we stopped.", "Continuăm de unde a rămas.")}
            </p>
            {onResume ? (
              <Button size="lg" className="h-11" onClick={onResume}>
                {t("Continue the research", "Continuă cercetarea")}
              </Button>
            ) : null}
          </PanelBody>
        </Panel>
      ) : null}

      {ask ? <AskSitePanel ask={ask} onAnswer={onAnswer} /> : null}

      {/* Phones: what was found so far first; the steps fold into one row. */}
      {mobile && snap.results.money ? <SoFar facts={facts} /> : null}
      {mobile && lights.length ? (
        <div className="mt-6">
          <Lines lights={lights} provisional />
        </div>
      ) : null}
      {mobile ? (
        <Disclosure
          className="mt-5 border-y border-line-1"
          summaryClassName="font-medium"
          summary={t("The research steps", "Pașii cercetării")}
          meta={
            lang === "ro"
              ? `${progress.done} din ${progress.total}`
              : `${progress.done} of ${progress.total}`
          }
        >
          {stageList}
        </Disclosure>
      ) : (
        stageList
      )}
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      {!mobile && snap.results.money ? <SoFar facts={facts} /> : null}
      {!mobile && lights.length ? (
        <div className="mt-6">
          <Lines lights={lights} provisional />
        </div>
      ) : null}
    </section>
  );
}

function StageList({ stages }: { stages: Stage[] }) {
  const { t, lang } = useI18n();
  return (
    <ol className="mt-5 border-t border-line-1">
      {stages.map((s) => (
        <li
          key={s.id}
          className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line-1 py-2.5 sm:grid-cols-[1.25rem_14rem_minmax(0,1fr)]"
        >
          <span className="flex h-5 items-center justify-center self-start">
            <Marker status={s.status} />
          </span>
          <span className={cn("font-medium", s.status === "pending" ? "text-fg-3" : "text-fg")}>
            {s.label[lang]}
            <span className="sr-only">
              : {t(STATUS_WORD[s.status][0], STATUS_WORD[s.status][1])}
            </span>
          </span>
          <span className="col-start-2 min-w-0 text-[0.9375rem] text-fg-2 sm:col-start-3">
            {s.detail?.[lang] ?? ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** "Ce am găsit până acum": the official figures as soon as the accounts are read. */
function SoFar({ facts }: { facts: Fact[] }) {
  const { t, lang } = useI18n();
  const years = facts
    .filter((f) => f.predicate === "money.turnover")
    .map((f) => Number(f.id.slice(-4)));
  if (!years.length) return null;
  const y = Math.max(...years);
  const get = (p: string) => facts.find((f) => f.id === `${p}.${y}`)?.value as number | undefined;
  const items: Array<[string, number | undefined, boolean]> = [
    [t("Turnover", "Cifra de afaceri"), get("money.turnover"), true],
    [t("Net profit", "Profit net"), get("money.profit_net"), true],
    [t("Employees", "Salariați"), get("people.employees"), false],
  ];
  return (
    <div className="mt-6">
      <h3 className="type-h4 text-fg">
        {t(`What we found so far · accounts ${y}`, `Ce am găsit până acum · bilanț ${y}`)}
      </h3>
      <dl className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line-2 bg-line-1">
        {items.map(([label, value, isMoney]) => {
          const p =
            value === undefined
              ? null
              : isMoney
                ? leiParts(value, lang)
                : { value: String(value), unit: "" };
          return (
            <div key={label} className="min-w-0 bg-s1 px-3 py-2.5">
              <dt className="text-[0.8125rem] text-fg-3">{label}</dt>
              <dd className="mt-1 text-fg">
                <span className="type-figure">{p?.value ?? "—"}</span>
                {p?.unit ? (
                  <span className="text-[0.8125rem] text-fg-3">{`${NBSP}${p.unit}`}</span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-1.5 text-[0.8125rem] text-fg-3">
        {t("Ministry of Finance", "Ministerul Finanțelor")} · {t(`accounts ${y}`, `bilanț ${y}`)}
      </p>
    </div>
  );
}

function AskSitePanel({
  ask,
  onAnswer,
}: {
  ask: AskSite;
  onAnswer: (answer: { url: string; yes: boolean } | null) => void;
}) {
  const { t, lang } = useI18n();
  const id = useId();
  const [other, setOther] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const host = ask.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const raw = url.trim();
    const normal = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!raw || !/^https?:\/\/[^\s/]+\.[^\s]{2,}/i.test(normal)) {
      setError(
        t(
          "Write the website address, e.g. firma.ro",
          "Scrie adresa site-ului, de exemplu firma.ro",
        ),
      );
      return;
    }
    onAnswer({ url: normal.slice(0, 300), yes: true });
  };
  return (
    <Panel className="mt-4" role="group" aria-labelledby={`${id}-q`}>
      <PanelBody>
        <h3 id={`${id}-q`} className="type-h4 text-fg">
          {t("Is this the company's website?", "Acesta e site-ul firmei?")}
        </h3>
        <p className="mt-1 break-all font-medium text-fg">{host}</p>
        <p className="mt-1 text-[0.875rem] text-fg-3">{ask.reason[lang]}</p>
        {other ? (
          <form onSubmit={submit} className="mt-3 flex max-w-md flex-col gap-2">
            <label htmlFor={id} className="text-[0.8125rem] font-medium text-fg-2">
              {t("The company's website", "Site-ul firmei")}
            </label>
            <Input
              id={id}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
              aria-invalid={error ? true : undefined}
              className="h-11 text-base"
            />
            {error ? <p className="text-[0.8125rem] text-bad">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" className="h-11">
                {t("Use this site", "Folosește acest site")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => setOther(false)}
              >
                {t("Back", "Înapoi")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="h-11 min-w-20"
              onClick={() => onAnswer({ url: ask.url, yes: true })}
            >
              {t("Yes", "Da")}
            </Button>
            <Button
              variant="secondary"
              className="h-11 min-w-20"
              onClick={() => onAnswer({ url: ask.url, yes: false })}
            >
              {t("No", "Nu")}
            </Button>
            <Button variant="ghost" className="h-11" onClick={() => setOther(true)}>
              {t("Another site", "Alt site")}
            </Button>
          </div>
        )}
        <p className="mt-3 text-[0.8125rem] text-fg-3">
          {t(
            "The other steps carry on meanwhile. Without an answer, we read only what we can confirm.",
            "Ceilalți pași merg mai departe între timp. Fără răspuns, citim doar ce putem confirma.",
          )}
        </p>
      </PanelBody>
    </Panel>
  );
}

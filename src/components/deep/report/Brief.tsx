import { useState } from "react";
import { ArrowDown, ChevronDown } from "lucide-react";

import { Button, Tag } from "@/components/system";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AreaLight, DeepReport, Fact, Lang } from "@/lib/deep/contracts";
import { VOCAB } from "@/lib/deep/vocab";
import { factLabel, SOURCE_URLS } from "@/lib/deep/parse/labels";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { dayLabel, leiParts, NBSP, roCount } from "../format";
import { useReport } from "./context";
import { CorrectButton } from "./Correct";
import { correctionFor, stateWord, TAG_13 } from "./helpers";
import { Disclosure, ReportHeading, Sentences, Shape, SourceLine } from "./shared";

/*
 * "Pe scurt", the default view (plan A1): the official figures, the verdict, the five lines
 * with their reasons and "Ce faci acum" on the first phone screen; then what it means, the
 * trust strip, the three findings, the customer's view and "Dacă tendința continuă". Actions,
 * rivals and the call live in their own files.
 */

const year = (r: DeepReport) => {
  const ys = r.facts
    .filter((f) => f.predicate === "money.turnover")
    .map((f) => Number(f.id.slice(-4)))
    .filter(Boolean);
  return ys.length ? Math.max(...ys) : undefined;
};

/** The company's own official figures, one line of three (the strip stays official). */
export function FiguresStrip({ onAdjust }: { onAdjust?: () => void }) {
  const { t, lang } = useI18n();
  const { official, report } = useReport();
  const y = year(official);
  const fact = (p: string) => official.facts.find((f) => f.id === `${p}.${y}`);
  const turnover = fact("money.turnover");
  const net = fact("money.profit_net");
  const staff = fact("people.employees");
  const third = report.audience === "third_party";

  if (official.firm === "new" || !turnover) {
    // No accounts yet (the Bani line says so). A typical firm of the activity is a sentence,
    // never the large figures strip that holds a firm's own official numbers.
    const band = official.peers?.bands;
    const scope = official.peers ? ` ${official.peers.scopeLabel[lang]}` : "";
    const parts = [
      band?.turnover
        ? t(
            `turnover ${leiParts(band.turnover.p50, "en").value}${NBSP}${leiParts(band.turnover.p50, "en").unit}`,
            `cifra de afaceri ${leiParts(band.turnover.p50, "ro").value}${NBSP}${leiParts(band.turnover.p50, "ro").unit}`,
          )
        : null,
      band?.employees
        ? t(`${band.employees.p50} employees`, roCount(band.employees.p50, "salariat", "salariați"))
        : null,
    ].filter(Boolean);
    if (!parts.length) return null;
    return (
      <section aria-labelledby="cifre-oficiale" className="min-w-0">
        <h2 id="cifre-oficiale" className="sr-only">
          {t("A typical firm in the activity", "O firmă obișnuită din activitate")}
        </h2>
        <p className="text-[0.9375rem] text-fg-2">
          {third
            ? t("A typical firm in the same activity", "O firmă obișnuită din aceeași activitate")
            : t("A typical firm in your activity", "O firmă obișnuită din activitatea ta")}
          {scope}: {parts.join(", ")}.
        </p>
        <p className="mt-1 text-[0.8125rem] leading-[1.45] text-fg-3">
          {t(
            "Ministry of Finance · accounts 2025 of similar firms",
            "Ministerul Finanțelor · bilanțurile 2025 ale firmelor similare",
          )}
        </p>
      </section>
    );
  }

  const staffLabel = t(`Employees, average ${y} (accounts)`, `Salariați, medie ${y} (din bilanț)`);
  return (
    <section aria-labelledby="cifre-oficiale" className="min-w-0">
      <h2 id="cifre-oficiale" className="sr-only">
        {t(`Official figures ${y}`, `Cifrele oficiale ${y}`)}
      </h2>
      <dl className="grid grid-cols-[1.3fr_1fr_0.8fr] gap-px overflow-hidden rounded-xl border border-line-2 bg-line-1 sm:grid-cols-3">
        <Figure
          label={
            <>
              {t("Turnover", "Cifra de afaceri")}
              <span className="max-sm:hidden"> {y}</span>
            </>
          }
          {...leiParts(turnover.value as number, lang)}
        />
        {net ? (
          <Figure
            label={
              <>
                {t("Net profit", "Profit net")}
                <span className="max-sm:hidden"> {y}</span>
              </>
            }
            {...leiParts(net.value as number, lang)}
          />
        ) : (
          <Figure label={t("Net profit", "Profit net")} value="—" unit="" />
        )}
        <Figure
          label={
            <>
              <span className="sm:hidden">{t("Employees", "Salariați")}</span>
              <span className="max-sm:hidden">{staffLabel}</span>
            </>
          }
          value={staff ? String(staff.value) : "—"}
          unit=""
          title={staffLabel}
        />
      </dl>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-1 text-[0.8125rem] leading-[1.45] text-fg-3">
        <span>
          {t("Ministry of Finance", "Ministerul Finanțelor")} · {t(`accounts ${y}`, `bilanț ${y}`)}{" "}
          ·
        </span>
        <a
          href={SOURCE_URLS.anaf_bilant}
          target="_blank"
          rel="noreferrer"
          className="-my-3 inline-flex min-h-11 items-center rounded-sm underline decoration-fg-3/50 underline-offset-2 hover:text-fg sm:my-0 sm:min-h-0"
        >
          {t("check at the source", "verifică la sursă")}
        </a>
      </p>
      {onAdjust && !third ? (
        <p className="mt-0.5 text-[0.875rem] text-fg-2">
          {t("What does 2026 look like for you?", "Cum arată 2026 la tine?")}{" "}
          <button
            type="button"
            onClick={onAdjust}
            className="-my-3 inline-flex min-h-11 items-center rounded-sm font-medium text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line/55 sm:my-0 sm:min-h-0"
          >
            {t("Adjust", "Ajustează")}
          </button>
        </p>
      ) : null}
    </section>
  );
}

function Figure({
  label,
  value,
  unit,
  title,
}: {
  label: React.ReactNode;
  value: string;
  unit: string;
  title?: string;
}) {
  return (
    <div className="min-w-0 bg-s1 px-3 py-2 sm:px-4 sm:py-3" title={title}>
      <dt className="text-[0.8125rem] leading-[1.3] text-fg-3">{label}</dt>
      <dd className="mt-1 text-fg">
        <span className="type-figure">{value}</span>
        {unit ? <span className="text-[0.8125rem] text-fg-3">{`${NBSP}${unit}`}</span> : null}
      </dd>
    </div>
  );
}

/** The five lines: a shape, a word and a reason on one row; tapping shows why, in place. */
export function Lines({
  lights,
  provisional = false,
  onOpen,
}: {
  lights: AreaLight[];
  provisional?: boolean;
  onOpen?: (area: AreaLight["area"]) => void;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState<AreaLight["area"] | null>(null);
  return (
    <section aria-labelledby="cele-cinci-linii" className="min-w-0">
      <h2 id="cele-cinci-linii" className="sr-only">
        {t("Five lines", "Cele cinci linii")}
      </h2>
      {provisional ? (
        <p className="mb-2 flex items-center gap-2 text-[0.8125rem] text-fg-3">
          <Tag variant="dashed" className={TAG_13}>
            {t("provisional", "provizoriu")}
          </Tag>
          {t("from the official figures read so far", "din cifrele oficiale citite până acum")}
        </p>
      ) : null}
      <ul className="border-y border-line-1">
        {lights.map((l) => {
          const isOpen = open === l.area;
          const body = (
            <>
              <span className="flex min-w-0 items-center gap-2 font-medium text-fg">
                <Shape state={l.state} />
                <span className="truncate">{l.label[lang]}</span>
              </span>
              <span className="min-w-0 text-fg-2">
                <span className="font-medium text-fg">{stateWord(l.state, lang)}</span>
                <span aria-hidden> · </span>
                <span className="sr-only">: </span>
                {/* A last short word never wraps alone ("din 100", "pe site"). */}
                {l.reason[lang].replace(/ (\S{1,4})$/, "\u00a0$1")}
              </span>
            </>
          );
          const grid =
            "grid min-h-11 w-full grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-x-2.5 py-0.5 text-left leading-[1.3] min-[380px]:grid-cols-[6.25rem_minmax(0,1fr)] min-[380px]:gap-x-3 min-[380px]:leading-[1.35] sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:py-2";
          return (
            <li key={l.area} className="border-b border-line-1 last:border-b-0">
              {onOpen ? (
                <>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`linie-${l.area}`}
                    aria-describedby="linii-indiciu"
                    onClick={() => {
                      setOpen(isOpen ? null : l.area);
                      if (!isOpen) onOpen(l.area);
                    }}
                    className={cn(
                      grid,
                      "grid-cols-[5.75rem_minmax(0,1fr)_0.875rem] min-[380px]:grid-cols-[6.25rem_minmax(0,1fr)_0.875rem] sm:grid-cols-[8.5rem_minmax(0,1fr)_1rem]",
                      "cursor-pointer rounded-sm transition-colors duration-150 hover:bg-fill-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-line/55",
                    )}
                  >
                    {body}
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "size-3.5 text-fg-3 transition-transform duration-150 motion-reduce:transition-none sm:size-4",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {isOpen ? <LineWhy id={`linie-${l.area}`} light={l} /> : null}
                </>
              ) : (
                <div className={grid}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {onOpen ? (
        <p id="linii-indiciu" className="sr-only">
          {t("Shows why, with the figures and the source.", "Arată de ce, cu cifrele și sursa.")}
        </p>
      ) : null}
    </section>
  );
}

/** A fact's value in words for "De ce": a peer band as a sentence, a margin as lei of 100. */
function whyValue(f: Fact, lang: Lang): string {
  if (f.predicate === "peers.band") {
    const v = f.value as { metric?: string; p25?: number; p50?: number; p75?: number } | null;
    if (v?.metric === "marginPretax" && [v.p25, v.p50, v.p75].every((x) => typeof x === "number")) {
      const k = (x: number) => Math.round(x * 100);
      return lang === "ro"
        ? `o firmă obișnuită păstrează ${k(v.p50!)} lei din 100; jumătate dintre firme, între ${k(v.p25!)} și ${k(v.p75!)}`
        : `a typical firm keeps ${k(v.p50!)} lei of 100; half of the firms between ${k(v.p25!)} and ${k(v.p75!)}`;
    }
  }
  return f.short?.[lang] ?? f.display[lang];
}

/** "De ce Atenție": the facts behind a line, newest first, with their source, and where to read more. */
function LineWhy({ id, light }: { id: string; light: AreaLight }) {
  const { t, lang } = useI18n();
  const { report, goTo } = useReport();
  const year = (f: Fact) => Number(/\.(\d{4})$/.exec(f.id)?.[1] ?? 0);
  const facts = light.factIds
    .map((fid) => report.facts.find((f) => f.id === fid))
    .filter((f): f is Fact => Boolean(f))
    .sort((a, b) => year(b) - year(a));
  const toCifre = light.area === "bani" || light.area === "echipa";
  return (
    <div id={id} className="mb-2 ml-[1.25rem] border-l-2 border-line-2 pb-1 pl-3 text-[0.9375rem]">
      <p className="font-medium text-fg">
        {t(`Why “${stateWord(light.state, "en")}”`, `De ce «${stateWord(light.state, "ro")}»`)}
      </p>
      {facts.length ? (
        <ul className="mt-1 space-y-1">
          {facts.slice(0, 4).map((f) => (
            <li key={f.id} className="text-fg-2">
              {f.predicate === "money.margin_pretax" && typeof f.value === "number" ? (
                lang === "ro" ? (
                  `În ${f.id.slice(-4)} au rămas ${Math.round(f.value * 100)} lei din 100 facturați, înainte de impozit.`
                ) : (
                  `In ${f.id.slice(-4)}, ${Math.round(f.value * 100)} lei of every 100 invoiced were left, before tax.`
                )
              ) : (
                <>
                  <span className="text-fg-3">{factLabel(f, lang)}: </span>
                  {whyValue(f, lang)}
                </>
              )}
              <SourceLine fact={f} check={false} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-fg-2">{light.reason[lang]}</p>
      )}
      {light.note ? <p className="mt-1 text-[0.875rem] text-fg-3">{light.note[lang]}</p> : null}
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 mt-1 h-11 sm:h-8"
        onClick={() => (toCifre ? goTo("cifre") : goTo("dovezi"))}
      >
        {toCifre ? t("See in Figures", "Vezi în Cifre") : t("See in Evidence", "Vezi în Dovezi")}
      </Button>
    </div>
  );
}

/** "Ce înseamnă pentru tine": at most 60 words, one line on phones until opened. */
export function Meaning() {
  const { t } = useI18n();
  const { report } = useReport();
  const [open, setOpen] = useState(false);
  const third = report.audience === "third_party";
  if (!report.brief.meaning.sentences.length) return null;
  return (
    <section aria-labelledby="ce-inseamna" className="min-w-0">
      <h2 id="ce-inseamna" className="type-h4 text-fg">
        {third
          ? t("What it means", "Ce înseamnă")
          : t("What it means for you", "Ce înseamnă pentru tine")}
      </h2>
      <Sentences
        section={report.brief.meaning}
        className={cn("mt-1 max-w-[62ch] text-fg-2", !open && "max-sm:line-clamp-2")}
      />
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 min-h-11 rounded-sm text-[0.875rem] font-medium text-fg underline decoration-fg/30 underline-offset-4 sm:hidden"
        >
          {t("Read it all", "Citește tot")}
        </button>
      ) : null}
    </section>
  );
}

/** "Verificat azi … · Ce nu am putut verifica": every count opens the list it counts. */
export function TrustStrip() {
  const { t, lang } = useI18n();
  const { report, goTo } = useReport();
  const y = year(report);
  const c = report.counts;
  const item = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-sm text-left underline decoration-fg-3/40 underline-offset-4 hover:text-fg hover:decoration-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line/55 sm:min-h-0"
    >
      {label}
    </button>
  );
  const sep = (
    <span aria-hidden className="text-fg-4">
      ·
    </span>
  );
  return (
    <section aria-label={t("How we checked", "Cum am verificat")} className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0 text-[0.875rem] leading-[1.5] text-fg-2">
        <span>
          {t("Checked today", "Verificat azi")}, {dayLabel(report.generatedAt, lang)}
        </span>
        {y ? (
          <>
            {sep}
            <span>{t(`accounts ${y}`, `bilanț ${y}`)}</span>
          </>
        ) : null}
        {sep}
        {item(
          lang === "ro"
            ? roCount(c.officialSources, "sursă oficială", "surse oficiale")
            : `${c.officialSources} official sources`,
          () => goTo("dovezi", "surse"),
        )}
        {c.pagesRead ? (
          <>
            {sep}
            {item(
              lang === "ro"
                ? roCount(c.pagesRead, "pagină citită", "pagini citite")
                : `${c.pagesRead} pages read`,
              () => goTo("dovezi", "dovezi-site"),
            )}
          </>
        ) : null}
        {c.estimates ? (
          <>
            {sep}
            {item(
              lang === "ro"
                ? roCount(c.estimates, "estimare", "estimări")
                : `${c.estimates} estimates`,
              () => goTo("pe-scurt", "ce-faci-acum"),
            )}
          </>
        ) : null}
        {sep}
        {item(t("What we could not check", "Ce nu am putut verifica"), () =>
          goTo("dovezi", "neverificat"),
        )}
      </p>
    </section>
  );
}

/** Three findings: one big figure, one everyday sentence, the source line. */
export function Findings() {
  const { t, lang } = useI18n();
  const { report } = useReport();
  if (!report.findings.length) return null;
  const factOf = (ids: string[]) =>
    ids.map((id) => report.facts.find((f) => f.id === id)).find(Boolean);
  return (
    <section aria-labelledby="constatari" className="min-w-0">
      <ReportHeading id="constatari">
        {t("Three things we found", "Trei lucruri pe care le-am găsit")}
      </ReportHeading>
      <ol className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
        {report.findings.slice(0, 3).map((f, i) => {
          const sentence = report.brief.findings[i];
          const fact = factOf(f.factIds);
          const absence = f.factIds
            .map((id) => report.facts.find((x) => x.id === id))
            .map((x) => (x ? correctionFor(x.id, x.value) : null))
            .find(Boolean);
          return (
            <li key={f.id} className="min-w-0 border-t border-line-2 pt-3">
              <p className="type-figure text-fg">{f.figure[lang]}</p>
              {sentence?.sentences.length && sentence.source === "ai" ? (
                <Sentences section={sentence} className="mt-1 text-fg-2" />
              ) : (
                <p className="mt-1 text-fg-2">{f.sentence[lang]}</p>
              )}
              <SourceLine fact={fact} check={false} className="mt-1.5" />
              {absence ? <CorrectButton predicate={absence} className="mt-1" /> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** "Ce vede un client nou": three short lines from the pages read (one row on phones until opened). */
export function CustomerView() {
  const { t, lang } = useI18n();
  const { report } = useReport();
  const mobile = useIsMobile();
  const section = report.brief.customerView;
  if (!section.sentences.length) return null;
  const title =
    VOCAB[report.vocab]?.words.customerView[lang] ??
    t("What a new customer sees", "Ce vede un client nou");
  const list = (
    <ul className="space-y-2">
      {section.sentences.map((s, i) => {
        const absence = s.factIds
          .map((id) => report.facts.find((x) => x.id === id))
          .map((x) => (x ? correctionFor(x.id, x.value) : null))
          .find(Boolean);
        return (
          <li key={i} className="flex min-w-0 gap-3 text-fg-2">
            <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-fg-3" />
            <span className="min-w-0">
              {s.hiddenBy ? (
                <span className="text-fg-3">{t("(corrected by you)", "(corectat de tine)")}</span>
              ) : (
                s.text
              )}
              {absence && !s.hiddenBy ? (
                <span className="block">
                  <CorrectButton predicate={absence} />
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
  if (mobile)
    return (
      <section aria-label={title} className="min-w-0">
        <Disclosure
          as="h2"
          className="border-y border-line-1"
          summaryClassName="type-h4"
          summary={title}
          meta={
            lang === "ro"
              ? roCount(section.sentences.length, "lucru", "lucruri")
              : `${section.sentences.length} things`
          }
        >
          {list}
        </Disclosure>
      </section>
    );
  return (
    <section aria-labelledby="client-nou" className="min-w-0">
      <ReportHeading id="client-nou">{title}</ReportHeading>
      {list}
    </section>
  );
}

/** "Dacă tendința continuă": only when three years moved the same way; tagged "Estimare". */
export function IfNothing() {
  const { t } = useI18n();
  const { report } = useReport();
  const section = report.brief.ifNothing;
  if (!section || !section.sentences.length) return null;
  return (
    <section aria-labelledby="daca-nu" className="min-w-0">
      <ReportHeading id="daca-nu">
        <span className="inline-flex flex-wrap items-center gap-2">
          {t("If the trend continues", "Dacă tendința continuă")}
          <Tag variant="dashed" className={TAG_13}>
            {t("Estimate", "Estimare")}
          </Tag>
        </span>
      </ReportHeading>
      <Sentences section={section} className="max-w-[62ch] text-fg-2" />
    </section>
  );
}

/** "Ce faci acum →" (owners) or "Ce să verifici →" (third parties). */
export function NextLink() {
  const { t } = useI18n();
  const { report, goTo } = useReport();
  const third = report.audience === "third_party";
  return (
    <Button
      variant="secondary"
      size="lg"
      className="h-11 w-full justify-between sm:w-auto"
      iconEnd={<ArrowDown aria-hidden />}
      onClick={() => goTo("pe-scurt", third ? "de-verificat" : "ce-faci-acum")}
    >
      {third ? t("What to check", "Ce să verifici") : t("What to do now", "Ce faci acum")}
    </Button>
  );
}

const DETAIL_GROUPS: Array<{ id: string; title: [string, string]; sections: Fact["section"][] }> = [
  { id: "detalii-bani", title: ["Money", "Bani"], sections: ["money", "peers"] },
  {
    id: "detalii-site",
    title: ["Website and presence", "Site și prezență"],
    sections: ["site", "presence", "offers"],
  },
  { id: "detalii-echipa", title: ["Team", "Echipă"], sections: ["people"] },
  {
    id: "detalii-risc",
    title: ["Risk and registers", "Risc și registre"],
    sections: ["identity", "risk"],
  },
  { id: "detalii-concurenti", title: ["Rivals", "Concurenți"], sections: ["competitors"] },
];

/** "Detalii, dacă vrei să verifici": the facts by area, expandable. */
export function Details({
  open,
  onToggle,
}: {
  open: string | null;
  onToggle: (id: string | null) => void;
}) {
  const { t, lang } = useI18n();
  const { report, goTo } = useReport();
  return (
    <section aria-labelledby="detalii" className="min-w-0">
      <ReportHeading
        id="detalii"
        sub={t("Every item with its source and date.", "Fiecare dată verificată, cu sursa ei.")}
      >
        {t("Details, if you want to check", "Detalii, dacă vrei să verifici")}
      </ReportHeading>
      <div className="border-t border-line-1">
        {DETAIL_GROUPS.map((g) => {
          const facts = report.facts.filter(
            (f) =>
              g.sections.includes(f.section) &&
              !f.id.startsWith("peers.band") &&
              f.predicate !== "site.audit.issue",
          );
          if (!facts.length) return null;
          const isOpen = open === g.id;
          return (
            <div key={g.id} id={g.id} className="scroll-mt-28 border-b border-line-1">
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${g.id}-panel`}
                  onClick={() => onToggle(isOpen ? null : g.id)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left font-display text-[1rem] font-semibold text-fg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-line/55"
                >
                  {t(g.title[0], g.title[1])}
                  <span className="text-[0.8125rem] font-normal text-fg-3">
                    {lang === "ro"
                      ? roCount(facts.length, "dată verificată", "date verificate")
                      : `${facts.length} checked items`}
                  </span>
                </button>
              </h3>
              {isOpen ? (
                <ul id={`${g.id}-panel`} className="pb-3">
                  {facts.map((f) => (
                    <li
                      key={f.id}
                      className="grid gap-x-4 border-t border-line-1 py-2 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
                    >
                      <span className="text-[0.875rem] text-fg-3">{factLabel(f, lang)}</span>
                      <span className="min-w-0 text-fg">
                        {f.display[lang]}
                        <SourceLine fact={f} check={false} className="mt-0.5" />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
      <Button variant="link" className="mt-3 min-h-11" onClick={() => goTo("dovezi")}>
        {t(
          "All the evidence, with confidence and method",
          "Toate dovezile, cu cât de sigure sunt și metoda",
        )}
      </Button>
    </section>
  );
}

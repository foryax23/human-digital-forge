import { useId, useState, type FormEvent } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/system";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Fact, FactMethod, Lang, SectionId } from "@/lib/deep/contracts";
import { CONFIDENCE_LABELS, factLabel } from "@/lib/deep/parse/labels";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { asOfPhrase, roCount } from "../format";
import { factsCsv } from "../summary";
import { useDeepTheme } from "../theme-context";
import { useReport } from "./context";
import { CorrectButton } from "./Correct";
import { correctionFor, sourceName } from "./helpers";
import { Disclosure, ReportHeading } from "./shared";

/*
 * "Dovezi și surse" (plan A1): every fact by section with its value, source, date, how sure
 * we are, the method and "vezi dovada" (the verified quote or the link; a bottom sheet on
 * phones), one legend, "Ce nu am putut verifica" with the registers not checked, the sources
 * with their licences, and the CSV export. Sections start closed with their count; money
 * reads as one table per figure with one source line. "Raportează o eroare" on every fact.
 */

const SECTIONS: Array<{ id: SectionId; anchor: string; title: [string, string] }> = [
  { id: "identity", anchor: "dovezi-registre", title: ["Registers", "Registre"] },
  { id: "money", anchor: "dovezi-bani", title: ["Money", "Bani"] },
  { id: "peers", anchor: "dovezi-comparatie", title: ["Comparison", "Comparație"] },
  { id: "competitors", anchor: "dovezi-concurenti", title: ["Rivals", "Concurenți"] },
  { id: "site", anchor: "dovezi-site", title: ["Website", "Site"] },
  { id: "offers", anchor: "dovezi-oferte", title: ["Offers and hours", "Oferte și program"] },
  { id: "presence", anchor: "dovezi-prezenta", title: ["Presence", "Prezență"] },
  { id: "people", anchor: "dovezi-echipa", title: ["Team", "Echipă"] },
  { id: "risk", anchor: "dovezi-risc", title: ["Risk", "Risc"] },
];

const METHOD: Record<FactMethod, [string, string]> = {
  api: ["official API", "API oficial"],
  bulk: ["official open data file", "fișier oficial de date deschise"],
  html: ["read on the page", "citit pe pagină"],
  jsonld: ["structured data on the page", "date structurate pe pagină"],
  llm: ["read by AI, quote checked by code", "citit de AI, citat verificat de cod"],
  derived: ["our arithmetic", "calculul nostru"],
  user: ["declared by you", "declarat de tine"],
};

const LEGEND: Array<{ key: Fact["confidence"]; text: [string, string] }> = [
  {
    key: "confirmat",
    text: ["official source or the firm's own site", "sursă oficială sau site-ul firmei"],
  },
  { key: "probabil", text: ["good match, not certain", "potrivire bună, nu sigură"] },
  {
    key: "calculat",
    text: ["our arithmetic on official figures", "calculul nostru pe cifre oficiale"],
  },
  {
    key: "estimare",
    text: ["our estimate, see the assumptions", "estimarea noastră, vezi ipotezele"],
  },
  { key: "declarat", text: ["you told us", "ne-ai spus tu"] },
];

export function EvidenceTab() {
  const { t, lang } = useI18n();
  const { report, onEvent, sample } = useReport();
  // The VAT row repeats the ANAF status when the status already says it.
  const statusSaysVat = /TVA|VAT/.test(
    report.facts.find((f) => f.id === "identity.status")?.display.ro ?? "",
  );
  const facts = report.facts.filter(
    (f) =>
      !f.ephemeral &&
      !f.id.startsWith("peers.band") &&
      !(statusSaysVat && f.id === "identity.vat_payer"),
  );

  const exportCsv = () => {
    const blob = new Blob([`\ufeff${factsCsv(report, lang)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vortex-dovezi-${report.cui}${sample ? "-exemplu" : ""}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 20_000);
    onEvent("csv_export");
  };

  return (
    <div className="space-y-10">
      <section aria-labelledby="legenda" className="min-w-0">
        <h2 id="legenda" className="type-h4 text-fg">
          {t("How sure we are", "Cât de siguri suntem")}
        </h2>
        <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {LEGEND.map((l) => (
            <div key={l.key} className="flex flex-wrap gap-x-2 text-[0.9375rem]">
              <dt className="font-medium text-fg">{CONFIDENCE_LABELS[l.key][lang]}</dt>
              <dd className="text-fg-2">{t(l.text[0], l.text[1])}</dd>
            </div>
          ))}
        </dl>
        <Button
          variant="secondary"
          className="mt-4 h-11"
          icon={<Download aria-hidden />}
          onClick={exportCsv}
        >
          {t("Export as CSV", "Exportă în CSV")}
        </Button>
      </section>

      <div className="border-t border-line-1">
        {SECTIONS.map((s) => {
          const list = sortFacts(facts.filter((f) => f.section === s.id));
          if (!list.length) return null;
          const years = yearGroups(list);
          const single = list.filter((f) => !years.some((g) => g.facts.includes(f)));
          return (
            <section key={s.id} aria-label={t(s.title[0], s.title[1])} className="min-w-0">
              <Disclosure
                id={s.anchor}
                as="h2"
                className="border-b border-line-1"
                summaryClassName="font-display text-[1.0625rem] font-semibold"
                summary={t(s.title[0], s.title[1])}
                meta={
                  lang === "ro"
                    ? roCount(list.length, "dată", "date")
                    : `${list.length} item${list.length === 1 ? "" : "s"}`
                }
              >
                {years.map((g) => (
                  <YearTable key={g.predicate} facts={g.facts} />
                ))}
                {single.length ? (
                  <ul className="border-t border-line-1">
                    {single.map((f) => (
                      <EvidenceRow key={f.id} fact={f} />
                    ))}
                  </ul>
                ) : null}
              </Disclosure>
            </section>
          );
        })}
      </div>

      <section id="neverificat" aria-labelledby="neverificat-t" className="min-w-0 scroll-mt-28">
        <ReportHeading id="neverificat-t">
          {t("What we could not check", "Ce nu am putut verifica")}
        </ReportHeading>
        <ul className="border-t border-line-1">
          {report.gaps.map((g, i) => (
            <li key={i} className="border-b border-line-1 py-2.5">
              <p className="font-medium text-fg">{g.what[lang]}</p>
              <p className="text-fg-2">
                {g.where[lang]}
                {g.link ? (
                  <>
                    {" · "}
                    <a
                      href={g.link}
                      target="_blank"
                      rel="noreferrer"
                      className="-my-3 inline-flex min-h-11 items-center rounded-sm underline underline-offset-2"
                    >
                      {t("see at the source", "vezi la sursă")}
                    </a>
                  </>
                ) : null}
              </p>
            </li>
          ))}
          {report.registers.notChecked.map((r) => (
            <li key={r.link} className="border-b border-line-1 py-2.5">
              <p className="font-medium text-fg">{r.name[lang]}</p>
              <p className="text-fg-2">
                {t("We don't check this automatically", "Nu verificăm automat")}
                {" · "}
                <a
                  href={r.link}
                  target="_blank"
                  rel="noreferrer"
                  className="-my-3 inline-flex min-h-11 items-center rounded-sm underline underline-offset-2"
                >
                  {t("see at the source", "vezi la sursă")}
                </a>
              </p>
            </li>
          ))}
        </ul>
        {report.registers.checked.length ? (
          <p className="mt-3 text-[0.9375rem] text-fg-2">
            {t("Checked: ", "Verificate: ")}
            {report.registers.checked.map((c) => c[lang]).join(" · ")}
          </p>
        ) : null}
      </section>

      <section id="surse" aria-labelledby="surse-t" className="min-w-0 scroll-mt-28">
        <ReportHeading id="surse-t">{t("Sources", "Surse")}</ReportHeading>
        <ul className="border-t border-line-1">
          {report.sources.map((s) => (
            <li key={s.id} className="border-b border-line-1 py-2.5">
              <p className="font-medium text-fg">{s.label[lang]}</p>
              <p className="text-[0.875rem] text-fg-3">
                {asOfPhrase(s.asOf, lang)}
                {s.licence ? ` · ${t("licence", "licență")} ${s.licence}` : ""}
                {s.url ? (
                  <>
                    {" · "}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="-my-3 inline-flex min-h-11 items-center break-all rounded-sm underline underline-offset-2"
                    >
                      {s.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** One predicate together, newest year first (the merge order interleaves years). */
function sortFacts(list: Fact[]): Fact[] {
  const first = new Map<string, number>();
  list.forEach((f, i) => {
    if (!first.has(f.predicate)) first.set(f.predicate, i);
  });
  const year = (f: Fact) => Number(/\.(\d{4})$/.exec(f.id)?.[1] ?? 0);
  return [...list].sort(
    (a, b) => first.get(a.predicate)! - first.get(b.predicate)! || year(b) - year(a),
  );
}

/** Per-year facts of one figure ("money.turnover.2019…2025"), shown as one table. */
function yearGroups(list: Fact[]): Array<{ predicate: string; facts: Fact[] }> {
  const by = new Map<string, Fact[]>();
  for (const f of list) {
    if (!/\.\d{4}$/.test(f.id)) continue;
    by.set(f.predicate, [...(by.get(f.predicate) ?? []), f]);
  }
  return [...by.entries()]
    .filter(([, facts]) => facts.length >= 2)
    .map(([predicate, facts]) => ({ predicate, facts }));
}

/** One figure over the years: one source line, a row per year, tap a row for its evidence. */
function YearTable({ facts }: { facts: Fact[] }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const first = facts[0];
  const label = factLabel(first, lang).replace(/\s*\d{4}$/, "");
  const years = facts.map((f) => Number(f.id.slice(-4)));
  const span = `${Math.min(...years)}–${Math.max(...years)}`;
  const confidence = new Set(facts.map((f) => f.confidence)).size === 1 ? first.confidence : null;
  return (
    <div className="border-t border-line-1 py-3">
      <p className="font-medium text-fg">{label}</p>
      <p className="text-[0.8125rem] leading-[1.45] text-fg-3">
        {sourceName(first.source, lang)} · {t(`accounts ${span}`, `bilanțuri ${span}`)}
        {confidence ? (
          <>
            {" · "}
            <span className="text-fg-2">{CONFIDENCE_LABELS[confidence][lang]}</span>
          </>
        ) : null}
      </p>
      <ul className="mt-1.5">
        {facts.map((f) => {
          const isOpen = open === f.id;
          const year = f.id.slice(-4);
          return (
            <li key={f.id} className="border-b border-line-1 last:border-b-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={t(`Details: ${label} ${year}`, `Detalii: ${label} ${year}`)}
                onClick={() => setOpen(isOpen ? null : f.id)}
                className="grid min-h-11 w-full grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-3 py-1 text-left hover:bg-fill-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-line/55"
              >
                <span className="type-pnum text-fg-3">{year}</span>
                <span className="type-num text-fg">{f.display[lang]}</span>
              </button>
              {isOpen ? (
                <div className="mb-2 border-l-2 border-line-2 pl-4">
                  <EvidenceDetail fact={f} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EvidenceRow({ fact }: { fact: Fact }) {
  const { t, lang } = useI18n();
  const mobile = useIsMobile();
  const { portalClass } = useDeepTheme();
  const [open, setOpen] = useState(false);
  const label = factLabel(fact, lang);
  const absence = correctionFor(fact.id, fact.value);
  return (
    <li className="border-b border-line-1 py-2.5">
      <div className="grid gap-x-4 gap-y-0.5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:items-baseline">
        <p className="text-[0.875rem] text-fg-3">{label}</p>
        <div className="min-w-0">
          <p className="text-fg">{fact.display[lang]}</p>
          <p className="text-[0.8125rem] leading-[1.45] text-fg-3">
            {sourceName(fact.source, lang)} · {asOfPhrase(fact.asOf, lang)} ·{" "}
            <span className="text-fg-2">{CONFIDENCE_LABELS[fact.confidence][lang]}</span> ·{" "}
            {t(METHOD[fact.method][0], METHOD[fact.method][1])}
          </p>
          {absence ? <CorrectButton predicate={absence} /> : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={!mobile ? open : undefined}
          aria-label={`${
            fact.evidence?.quote || fact.evidence?.url
              ? t("See the evidence", "Vezi dovada")
              : t("Details", "Detalii")
          }: ${label}`}
          className="-ml-2 h-11 justify-self-start md:ml-0 md:h-8"
          onClick={() => setOpen((v) => !v)}
        >
          {fact.evidence?.quote || fact.evidence?.url
            ? t("See the evidence", "Vezi dovada")
            : t("Details", "Detalii")}
        </Button>
      </div>
      {mobile ? (
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
          <DrawerContent className={cn(portalClass, "max-h-[85vh]")}>
            <DrawerHeader>
              <DrawerTitle>{label}</DrawerTitle>
              <DrawerDescription>{fact.display[lang]}</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <EvidenceDetail fact={fact} />
            </div>
          </DrawerContent>
        </Drawer>
      ) : open ? (
        <div className="mt-2 border-l-2 border-line-2 pl-4">
          <EvidenceDetail fact={fact} />
        </div>
      ) : null}
    </li>
  );
}

function EvidenceDetail({ fact }: { fact: Fact }) {
  const { t, lang } = useI18n();
  const { onFeedback } = useReport();
  const id = useId();
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "open" | "sent" | "kept" | "sample">("idle");
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const out = await onFeedback("error_report", {
      factId: fact.id,
      message: text.trim().slice(0, 1000) || undefined,
    });
    setState(out);
  };
  return (
    <div className="space-y-2 text-[0.9375rem]">
      {fact.evidence?.quote ? (
        <blockquote className="border-l-2 border-brand-line/60 pl-3 text-fg-2">
          <span className="sr-only">{t("Quote from the site: ", "Citat de pe site: ")}</span>«
          {fact.evidence.quote}»
        </blockquote>
      ) : null}
      {fact.evidence?.url ? (
        <p>
          <a
            href={fact.evidence.url}
            target="_blank"
            rel="noreferrer nofollow"
            className="break-all rounded-sm text-fg underline underline-offset-2"
          >
            {fact.evidence.url.replace(/^https?:\/\//, "")}
          </a>
        </p>
      ) : null}
      {fact.observed ? (
        <p className="text-fg-3">
          {lang === "ro"
            ? `Am citit ${fact.observed.pagesRead} pagini.`
            : `We read ${fact.observed.pagesRead} pages.`}
        </p>
      ) : null}
      {fact.evidence?.note ? <p className="text-fg-3">{fact.evidence.note[lang]}</p> : null}
      {state === "idle" ? (
        <Button variant="link" size="sm" className="min-h-11" onClick={() => setState("open")}>
          {t("Report an error", "Raportează o eroare")}
        </Button>
      ) : state === "open" ? (
        <form onSubmit={send} className="flex flex-col gap-2">
          <label htmlFor={id} className="text-[0.8125rem] font-medium text-fg-2">
            {t(
              "What is wrong? (optional, up to 1,000 characters)",
              "Ce e greșit? (opțional, până la 1.000 de caractere)",
            )}
          </label>
          <Textarea
            id={id}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            className="text-base"
          />
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" className="h-11">
              {t("Send", "Trimite")}
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setState("idle")}>
              {t("Cancel", "Renunță")}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-fg-2" role="status">
          {state === "sent"
            ? t(
                "Thank you. We answer within 5 working days.",
                "Mulțumim. Răspundem în cel mult 5 zile lucrătoare.",
              )
            : state === "sample"
              ? t("In the sample nothing is sent.", "În exemplu nu se trimite nimic.")
              : t(
                  "We can't store reports yet (server storage is not on). Write to us at hello@vortexhub.ro.",
                  "Nu putem păstra încă sesizările (salvarea pe server nu e pornită). Scrie-ne la hello@vortexhub.ro.",
                )}
        </p>
      )}
    </div>
  );
}

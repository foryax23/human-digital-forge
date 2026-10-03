import { useEffect, useId, useRef, useState } from "react";

import { Button, Spinner, Tag } from "@/components/system";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { DEEP_LIMITS, type Bilingual, type CompetitorCard } from "@/lib/deep/contracts";
import { rivalEdge } from "@/lib/deep/report";
import { searchCompanies } from "@/lib/scan/company-search";
import type { CompanySuggestion } from "@/lib/scan/types";
import { useI18n } from "@/i18n";

import { leiParts, NBSP } from "../format";
import { useReport } from "./context";
import { TAG_13 } from "./helpers";
import { Disclosure, ReportHeading, Sentences } from "./shared";

/*
 * "Unde te depășesc concurenții" (plan A1, D8): the rivals from the official filings, each with
 * what it does better than the company (checked against the company's own facts, never a
 * rival that grows more slowly or keeps less), and "Nu e concurentul meu". Without the peer
 * file there are no rivals yet: the section says so plainly. "Adaugă un concurent" waits until
 * competitor steps can run after the report (the run closes at finish, so an added rival would
 * have no figures).
 */

/** Rivals can be added once the server accepts competitor steps after finish (not yet). */
const CAN_ADD_RIVALS = false;

function money(v: number | undefined, lang: "ro" | "en") {
  if (v === undefined) return "";
  const p = leiParts(v, lang);
  return `${p.value}${NBSP}${p.unit}`;
}

export function Rivals() {
  const { t, lang } = useI18n();
  const { report, official, rivalEdits, onRemoveRival } = useReport();
  const owner = report.audience === "owner";
  const edits = rivalEdits.removed.length + rivalEdits.added.length;
  const canEdit = owner && edits < DEEP_LIMITS.peerEditsMax;
  const rows = report.competitors.slice(0, 5);
  const y = Math.max(
    0,
    ...official.facts
      .filter((f) => f.predicate === "money.turnover")
      .map((f) => Number(f.id.slice(-4))),
  );
  const own = official.facts.find((f) => f.id === `money.turnover.${y}`)?.value as
    | number
    | undefined;
  const mobile = useIsMobile();
  const edgeOf = (c: CompetitorCard) => rivalEdge(c, report.facts, report.audience);
  const anyEdge = rows.some((c) => edgeOf(c));

  const title =
    owner && rows.length && anyEdge
      ? t("Where rivals do better", "Unde te depășesc concurenții")
      : t("Rivals", "Concurenți");
  const body = (
    <>
      {/* The rules text only repeats the rows below; an AI paragraph adds to them. */}
      {rows.length && report.brief.rivals.source === "ai" ? (
        <Sentences section={report.brief.rivals} className="mb-3 max-w-[62ch] text-fg-2" />
      ) : null}
      {rows.length ? (
        <ul className="border-t border-line-1">
          {rows.map((c) => (
            <RivalRow
              key={c.cui}
              card={c}
              edge={edgeOf(c)}
              own={own}
              owner={owner}
              canEdit={canEdit}
              onRemove={() => onRemoveRival(c.cui)}
            />
          ))}
        </ul>
      ) : (
        <p className="max-w-[62ch] text-fg-2">
          {t(
            "The comparison with similar firms is not ready yet; it appears here once we load their annual accounts.",
            "Comparația cu firme similare nu e încă gata; apare aici când încărcăm bilanțurile lor.",
          )}
        </p>
      )}
      {rivalEdits.removed.length ? (
        <p className="mt-2 text-[0.8125rem] text-fg-3">
          {lang === "ro"
            ? `Ai scos ${rivalEdits.removed.length === 1 ? "un concurent" : `${rivalEdits.removed.length} concurenți`} din listă.`
            : `You removed ${rivalEdits.removed.length} rival${rivalEdits.removed.length === 1 ? "" : "s"}.`}
        </p>
      ) : null}
      {CAN_ADD_RIVALS && canEdit && rows.length ? <AddRival /> : null}
      {owner && rows.length && !canEdit ? (
        <p className="mt-2 text-[0.8125rem] text-fg-3">
          {t(
            "You used the 3 changes of this report.",
            "Ai folosit cele 3 schimbări ale acestui raport.",
          )}
        </p>
      ) : null}
    </>
  );
  const scopeLine = report.peers
    ? t(
        `Same activity, similar size, ${report.peers.scopeLabel.en}: from the Ministry of Finance filings.`,
        `Aceeași activitate, mărime apropiată, ${report.peers.scopeLabel.ro}: din bilanțurile depuse la Ministerul Finanțelor.`,
      )
    : undefined;
  // Phones: one row until opened (the page stays short before the call block).
  if (mobile)
    return (
      <section aria-label={title} className="min-w-0">
        <Disclosure
          as="h2"
          className="border-y border-line-1"
          summaryClassName="type-h4"
          summary={title}
          meta={
            rows.length
              ? lang === "ro"
                ? `${rows.length} ${rows.length === 1 ? "firmă" : "firme"}`
                : `${rows.length} firm${rows.length === 1 ? "" : "s"}`
              : t("not ready yet", "nu e încă gata")
          }
        >
          {scopeLine ? <p className="mb-2 text-[0.875rem] text-fg-3">{scopeLine}</p> : null}
          {body}
        </Disclosure>
      </section>
    );
  return (
    <section aria-labelledby="concurenti" className="min-w-0">
      <ReportHeading id="concurenti" sub={scopeLine}>
        {title}
      </ReportHeading>
      {body}
    </section>
  );
}

function RivalRow({
  card,
  edge,
  own,
  owner,
  canEdit,
  onRemove,
}: {
  card: CompetitorCard;
  edge?: Bilingual;
  own?: number;
  owner: boolean;
  canEdit: boolean;
  onRemove: () => void;
}) {
  const { t, lang } = useI18n();
  const above = card.turnover !== undefined && own !== undefined && card.turnover > own;
  const by =
    card.turnover !== undefined
      ? above
        ? owner
          ? t(
              `turnover ${money(card.turnover, lang)}, above yours`,
              `cifra de afaceri ${money(card.turnover, lang)}, peste a ta`,
            )
          : t(
              `turnover ${money(card.turnover, lang)}, above the company's`,
              `cifra de afaceri ${money(card.turnover, lang)}, peste a firmei`,
            )
        : t(
            `turnover ${money(card.turnover, lang)}`,
            `cifra de afaceri ${money(card.turnover, lang)}`,
          )
      : t("figures at the next research", "cifrele apar la următoarea cercetare");
  return (
    <li className="grid gap-x-4 gap-y-1 border-b border-line-1 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <p className="font-medium text-fg">{card.name}</p>
        <p className="text-[0.8125rem] text-fg-3">
          {[
            card.city,
            card.employees ? t(`${card.employees} employees`, `${card.employees} salariați`) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          {card.origin === "owner_added" ? (
            <>
              {" "}
              <Tag variant="dashed" className={TAG_13}>
                {t("Added by you", "Adăugat de tine")}
              </Tag>
            </>
          ) : null}
        </p>
      </div>
      <div className="min-w-0 text-fg-2">
        <p>
          {edge
            ? edge[lang]
            : owner
              ? t("does not beat you on what we checked", "nu te depășește la ce am verificat")
              : t(
                  "does not beat the company on what we checked",
                  "nu depășește firma la ce am verificat",
                )}
        </p>
        <p className="text-[0.875rem] text-fg-3">{by}</p>
      </div>
      {canEdit && card.origin !== "owner_added" ? (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-11 justify-self-start sm:ml-0 sm:h-8"
          aria-label={t(`Not my rival: ${card.name}`, `Nu e concurentul meu: ${card.name}`)}
          onClick={onRemove}
        >
          {t("Not my rival", "Nu e concurentul meu")}
        </Button>
      ) : (
        <span />
      )}
    </li>
  );
}

function AddRival() {
  const { t } = useI18n();
  const { report, onAddRival, sample } = useReport();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<CompanySuggestion[]>([]);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    const q = query.trim();
    if (!open || q.length < 3) {
      setFound([]);
      return;
    }
    const controller = new AbortController();
    timer.current = window.setTimeout(async () => {
      setBusy(true);
      try {
        const list = await searchCompanies(q, { limit: 5, signal: controller.signal });
        setFound(list.filter((c) => c.cui !== report.cui && c.status !== "dissolved"));
      } catch {
        setFound([]);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer.current);
    };
  }, [query, open, report.cui]);

  if (!open)
    return (
      <Button variant="link" className="mt-2 min-h-11" onClick={() => setOpen(true)}>
        {t("Add a rival", "Adaugă un concurent")}
      </Button>
    );
  return (
    <div className="mt-3 max-w-md">
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-fg-2">
        {t("Company name or tax code (CUI)", "Numele firmei sau CUI-ul")}
      </label>
      <div className="relative mt-1.5">
        <Input
          id={id}
          value={query}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 text-base"
          aria-describedby={`${id}-hint`}
        />
        {busy ? (
          <Spinner size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-3" />
        ) : null}
      </div>
      <p id={`${id}-hint`} className="mt-1 text-[0.8125rem] text-fg-3">
        {sample
          ? t("In the sample nothing is saved.", "În exemplu nu se salvează nimic.")
          : t(
              "Its official figures appear at the next research.",
              "Cifrele lui oficiale apar la următoarea cercetare.",
            )}
      </p>
      {found.length ? (
        <ul
          className="mt-2 border-t border-line-1"
          aria-label={t("Companies found", "Firme găsite")}
        >
          {found.map((c) => (
            <li key={c.cui} className="border-b border-line-1">
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left hover:bg-fill-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-line/55"
                onClick={() => {
                  onAddRival({ cui: c.cui, name: c.displayName, city: c.city, website: c.website });
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-fg">{c.displayName}</span>
                  <span className="text-[0.8125rem] text-fg-3">
                    {[c.city, c.county].filter(Boolean).join(", ")}
                  </span>
                </span>
                <span className="type-code shrink-0 text-fg-3">{c.cui}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button variant="ghost" className="mt-2 h-11" onClick={() => setOpen(false)}>
        {t("Cancel", "Renunță")}
      </Button>
    </div>
  );
}

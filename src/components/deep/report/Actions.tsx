import { useEffect, useId, useState, type FormEvent } from "react";

import {
  Button,
  Field,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  Tag,
} from "@/components/system";
import { Input } from "@/components/ui/input";
import type { Action, Estimate, Lang, OwnerInputs } from "@/lib/deep/contracts";
import { formatInt } from "@/lib/deep/parse/format";
import { dueDiligence } from "@/lib/deep/report";
import { volumeNoun } from "@/lib/deep/report/estimates";
import { WORKING_DAYS_PER_MONTH } from "@/lib/deep/report/hourly";
import { vortexTotal } from "@/lib/deep/report/prices";
import { roCount } from "@/lib/deep/report/read";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { DISCLOSURE } from "../copy";
import { approxLei, lei, leiRange, NBSP } from "../format";
import { adjustableInputs, assumedClients, assumedHourValue } from "../report-adapter";
import { useReport } from "./context";
import { CorrectButton } from "./Correct";
import { correctionFor, TAG_13 } from "./helpers";
import { Disclosure } from "./shared";

/*
 * "Ce faci acum" (plan A8): three actions for the next 30 days. Each reads as a title and one
 * line (what it brings, who does it and for how much, when it shows), with the details on
 * tap: why, the effect with its range, the cost both ways, the assumption behind the first lei
 * figure. Legal must-dos apart; the totals as separate lines, never added together; the cost
 * with Vortex Hub once (a shared system is priced once); then the disclosure. Third parties
 * get "Ce să verifici înainte să lucrezi cu ei" instead.
 */

export type AdjustField = keyof OwnerInputs;

const BOTH: [string, string] = ["On your own or with Vortex Hub", "Singur sau cu Vortex Hub"];
const WHO: Record<Action["who"], [string, string]> = {
  singur: ["On your own", "Singur"],
  contabil: ["With your accountant", "Cu contabilul"],
  cu_vortex: ["With Vortex Hub", "Cu Vortex Hub"],
};

/** Who does it: both paths when the action has a do-it-yourself path and a Vortex Hub price. */
function whoText(a: Action, lang: Lang): string {
  const both = a.cost.vortex && (a.cost.diyHow || a.cost.diyHours !== undefined);
  const pair = both && a.who !== "contabil" ? BOTH : WHO[a.who];
  return lang === "ro" ? pair[1] : pair[0];
}

/** "15 minute", "o oră", "3 ore". */
function hoursText(hours: number, lang: Lang): string {
  if (hours > 0 && hours < 1) {
    const m = Math.round(hours * 60);
    return lang === "ro" ? roCount(m, "minute") : `${m} minutes`;
  }
  if (!hours) return "";
  if (lang === "ro") return hours === 1 ? "o oră" : roCount(hours, "ore");
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** "de la 1.200 lei, plus 50 lei pe lună" (the Vortex Hub price). */
function vortexPrice(v: { setupLei: number; monthlyLei: number }, lang: Lang): string {
  const monthly = v.monthlyLei
    ? lang === "ro"
      ? `, plus ${lei(v.monthlyLei, lang)} pe lună`
      : `, plus ${lei(v.monthlyLei, lang)} a month`
    : "";
  return lang === "ro"
    ? `de la ${lei(v.setupLei, lang)}${monthly}`
    : `from ${lei(v.setupLei, lang)}${monthly}`;
}

/** Both ways to do it, in full: "Poți face singur: …" · "Cu Vortex Hub: de la …". */
function costText(a: Action, lang: Lang): string {
  const ro = lang === "ro";
  const parts: string[] = [];
  if (a.cost.diyHow) {
    parts.push(
      ro ? `Poți face singur: ${a.cost.diyHow.ro}` : `You can do it yourself: ${a.cost.diyHow.en}`,
    );
  } else if (a.cost.diyLei !== undefined || a.cost.diyHours !== undefined) {
    const time = hoursText(a.cost.diyHours ?? 0, lang);
    const money = a.cost.diyLei ? lei(a.cost.diyLei, lang) : ro ? "gratuit" : "free";
    parts.push(
      ro
        ? `Poți face singur: ${money}${time ? `, ${time}` : ""}`
        : `You can do it yourself: ${money}${time ? `, ${time}` : ""}`,
    );
  }
  if (a.cost.vortex)
    parts.push(
      ro
        ? `Cu Vortex Hub: ${vortexPrice(a.cost.vortex, lang)}`
        : `With Vortex Hub: ${vortexPrice(a.cost.vortex, lang)}`,
    );
  return parts.join(" · ");
}

/** The cost in the action's one-line summary: the Vortex Hub price, or the DIY cost. */
function costShort(a: Action, lang: Lang): string {
  if (a.cost.vortex) return vortexPrice(a.cost.vortex, lang);
  if (a.cost.diyHow) return "";
  const time = hoursText(a.cost.diyHours ?? 0, lang);
  const money = a.cost.diyLei ? lei(a.cost.diyLei, lang) : lang === "ro" ? "gratuit" : "free";
  return `${money}${time ? `, ${time}` : ""}`;
}

/** "Singur sau cu Vortex Hub" → "singur sau cu Vortex Hub" (the brand keeps its capitals). */
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

const isMarginGap = (e?: Estimate) => e?.kind === "profit_year_pretax";
const needsVolume = (e?: Estimate) => Boolean(e?.inputs.needsVolume);

/** The effect in a few words: "≈ 200 lei pe lună" or "până la 360.000 lei pe an". */
function effectShort(e: Estimate, lang: Lang): string {
  if (isMarginGap(e))
    return lang === "ro"
      ? `până la ${lei(e.value, lang)} pe an, înainte de impozit`
      : `up to ${lei(e.value, lang)} a year, before tax`;
  return `${approxLei(e.value, lang)} ${lang === "ro" ? "pe lună" : "a month"}`;
}

function EffectText({
  e,
  showHour,
  onChangeHour,
}: {
  e: Estimate;
  showHour: boolean;
  onChangeHour?: () => void;
}) {
  const { t, lang } = useI18n();
  const { report } = useReport();
  const adjusted = Boolean(report.ownerInputs);
  const ownHour = report.ownerInputs?.hourValue;
  if (isMarginGap(e))
    return (
      <span className="text-fg">
        {t(
          `up to ${lei(e.value, lang)} a year before tax, if you get to keep what a typical firm in your activity keeps (at least ${lei(e.low, lang)} if you reach the lower end)`,
          `până la ${lei(e.value, lang)} pe an, înainte de impozit, dacă ajungi să păstrezi cât o firmă obișnuită din activitatea ta (cel puțin ${lei(e.low, lang)} dacă ajungi la pragul de jos)`,
        )}{" "}
        <Tag variant="dashed" className={`${TAG_13} align-[1px]`}>
          {adjusted ? t("with your numbers", "cu cifrele tale") : t("Estimate", "Estimare")}
        </Tag>
      </span>
    );
  return (
    <span className="text-fg">
      <span className="type-pnum font-medium">{effectShort(e, lang)}</span>
      {e.low !== e.value || e.high !== e.value ? (
        <span className="text-fg-3">{` (${leiRange(e.low, e.high, lang)})`}</span>
      ) : null}{" "}
      <Tag variant="dashed" className={`${TAG_13} align-[1px]`}>
        {adjusted ? t("with your numbers", "cu cifrele tale") : t("Estimate", "Estimare")}
      </Tag>
      {showHour && e.inputs.hourValue ? (
        <span className="mt-0.5 block text-[0.8125rem] text-fg-3">
          {ownHour
            ? t(
                `we use ${Math.round(ownHour)} lei an hour (your number)`,
                `folosim ${Math.round(ownHour)}${NBSP}lei/oră (cifra ta)`,
              )
            : t(
                `we assume ${Math.round(e.inputs.hourValue)} lei an hour for office work`,
                `presupunem ${Math.round(e.inputs.hourValue)}${NBSP}lei/oră pentru munca de birou`,
              )}
          {onChangeHour ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={onChangeHour}
                className="-my-3 inline-flex min-h-11 items-center rounded-sm underline underline-offset-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line/55"
              >
                {t("change", "schimbă")}
              </button>
            </>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 border-t border-line-1 py-2 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <dt className="text-[0.875rem] text-fg-3">{label}</dt>
      <dd className="min-w-0 text-[0.9375rem] leading-[1.5] text-fg-2">{children}</dd>
    </div>
  );
}

export function Actions({
  adjustOpen,
  adjustFocus,
  onAdjustOpen,
}: {
  adjustOpen: boolean;
  adjustFocus?: AdjustField;
  onAdjustOpen: (open: boolean, focus?: AdjustField) => void;
}) {
  const { t, lang } = useI18n();
  const { report, onEvent } = useReport();
  const [details, setDetails] = useState<string | null>(null);
  if (report.audience === "third_party") return <DueDiligence />;
  const shown = report.actions.filter((a) => !a.mandatory).slice(0, 3);
  const mandatory = report.actions.filter((a) => a.mandatory);
  const firstValued = shown.find(
    (a) => a.effect && a.effect.kind === "time_value_month" && a.effect.value > 0,
  );
  const valued = shown.some((a) => a.effect && a.effect.value > 0);
  const adjustable = adjustableInputs(report);
  const askVolume = shown.some((a) => needsVolume(a.effect)) && adjustable.has("clientsPerMonth");
  const { timeValueMonth, profitYearPretax } = report.totals;
  const total = vortexTotal(shown);
  const noun = volumeNoun(report.vocab);
  const openAdjust = (focus?: AdjustField) => {
    onAdjustOpen(true, focus);
    onEvent("adjust_open");
    window.requestAnimationFrame(() =>
      document.getElementById("ajusteaza")?.scrollIntoView({ block: "start" }),
    );
  };
  const sub = valued
    ? t(
        "Ranked by what they bring in lei. At least one you can do on your own or with your accountant.",
        "Ordonate după cât aduc în lei. Cel puțin una o poți face singur sau cu contabilul.",
      )
    : askVolume
      ? t(
          `We can't put a value in lei on them without your number of ${noun.en} a day.`,
          `Nu putem calcula valori în lei fără numărul tău de ${noun.ro} pe zi.`,
        )
      : t(
          "No values in lei: for your activity we don't have a calculation we can stand behind yet. At least one you can do on your own.",
          "Fără valori în lei: pentru activitatea ta nu avem încă un calcul pe care să ne bazăm. Cel puțin una o poți face singur.",
        );

  return (
    <section
      id="ce-faci-acum"
      aria-labelledby="ce-faci-acum-titlu"
      className="min-w-0 scroll-mt-28"
    >
      <Panel as="div">
        <PanelHeader
          titleAs="h2"
          titleId="ce-faci-acum-titlu"
          title={t("What to do in the next 30 days", "Ce faci în următoarele 30 de zile")}
          sub={sub}
        />
        <PanelBody className="pt-0">
          {adjustOpen || (askVolume && !report.ownerInputs) ? (
            <AdjustPanel
              autoFocus={adjustOpen}
              focusKey={adjustFocus}
              onClose={adjustOpen ? () => onAdjustOpen(false) : undefined}
            />
          ) : null}
          {shown.length ? (
            <ol className="space-y-4">
              {shown.map((a, i) => {
                const absence = a.factIds
                  .map((id) => report.facts.find((f) => f.id === id))
                  .map((f) => (f ? correctionFor(f.id, f.value) : null))
                  .find(Boolean);
                const e = a.effect && a.effect.value > 0 ? a.effect : undefined;
                const summary = [
                  e ? effectShort(e, lang) : null,
                  lowerFirst(whoText(a, lang)),
                  costShort(a, lang) || null,
                  a.firstEffect[lang],
                ]
                  .filter(Boolean)
                  .join(" · ");
                const label = e
                  ? isMarginGap(e)
                    ? t("Difference from a typical firm", "Diferența față de o firmă obișnuită")
                    : t("What it brings", "Ce aduce")
                  : t("Why it matters", "De ce contează");
                return (
                  <li
                    key={a.id}
                    className="min-w-0 border-t border-line-1 pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="type-pnum w-4 shrink-0 text-[1rem] font-semibold text-fg-3">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="type-h4 text-fg">{a.title[lang]}</h3>
                        <p className="mt-0.5 text-[0.9375rem] leading-[1.5] text-fg-2">
                          {summary}
                          {e ? (
                            <>
                              {" "}
                              <Tag variant="dashed" className={`${TAG_13} align-[1px]`}>
                                {report.ownerInputs
                                  ? t("with your numbers", "cu cifrele tale")
                                  : t("Estimate", "Estimare")}
                              </Tag>
                            </>
                          ) : null}
                        </p>
                        {needsVolume(a.effect) && !e ? (
                          <p className="mt-0.5 text-[0.875rem] text-fg-3">
                            {t(
                              `How many ${noun.en} a day do you have?`,
                              `Câte ${noun.ro} ai pe zi?`,
                            )}{" "}
                            <button
                              type="button"
                              onClick={() => openAdjust("clientsPerMonth")}
                              className="-my-3 inline-flex min-h-11 items-center rounded-sm font-medium text-fg underline underline-offset-4"
                            >
                              {t("Tell us and we calculate", "Spune-ne și calculăm")}
                            </button>
                          </p>
                        ) : null}
                        <Disclosure
                          className="mt-1"
                          summaryClassName="min-h-11 w-auto justify-start py-1 text-[0.875rem] font-medium text-fg-2"
                          open={details === a.id}
                          onOpenChange={(open) => setDetails(open ? a.id : null)}
                          label={t(`Details: ${a.title.en}`, `Detalii: ${a.title.ro}`)}
                          summary={t("Details", "Detalii")}
                        >
                          <p className="max-w-[62ch] text-fg-2">{a.why[lang]}</p>
                          <dl className="mt-2">
                            <Row label={label}>
                              {e ? (
                                <EffectText
                                  e={e}
                                  showHour={a === firstValued}
                                  onChangeHour={
                                    adjustable.has("hourValue")
                                      ? () => openAdjust("hourValue")
                                      : undefined
                                  }
                                />
                              ) : (
                                <span>
                                  {a.comparison?.[lang] ??
                                    t("not valued in lei", "nu are o valoare în lei")}
                                </span>
                              )}
                            </Row>
                            <Row label={t("What it costs", "Cât costă")}>{costText(a, lang)}</Row>
                            <Row label={t("Who does it", "Cine o face")}>{whoText(a, lang)}</Row>
                            <Row label={t("When it shows", "Când se vede")}>
                              {a.firstEffect[lang]}
                            </Row>
                          </dl>
                          {absence ? <CorrectButton predicate={absence} className="mt-1" /> : null}
                        </Disclosure>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-fg-2">
              {t(
                "The facts we have point to no particular action.",
                "Din faptele pe care le avem nu reiese o acțiune anume.",
              )}
            </p>
          )}

          {total ? (
            <div className="mt-5 space-y-1 border-t border-line-1 pt-3 text-[0.875rem] text-fg-2">
              {total.shared.map((ids) => {
                const names = ids
                  .map((id) => shown.find((a) => a.id === id)?.title[lang])
                  .filter((n): n is string => Boolean(n))
                  .map((n, i) => (i ? lowerFirst(n) : n));
                const price = shown.find((a) => a.id === ids[0])!.cost.vortex!;
                return (
                  <p key={ids.join()}>
                    {t(
                      `${names.join(" and ")}: the same system, ${vortexPrice(price, lang)} for both.`,
                      `${names.join(" și ")}: același sistem, ${vortexPrice(price, lang)} pentru amândouă.`,
                    )}
                  </p>
                );
              })}
              <p>
                <span className="font-medium text-fg">
                  {t(
                    "Total cost if you work with Vortex Hub: ",
                    "Cost total dacă lucrezi cu Vortex Hub: ",
                  )}
                </span>
                {vortexPrice(total, lang)}.
              </p>
            </div>
          ) : null}

          {mandatory.length ? (
            <div className="mt-6">
              <h3 className="type-h4 text-fg">{t("Required by law", "Obligatoriu prin lege")}</h3>
              <ul className="mt-2">
                {mandatory.map((a) => (
                  <li key={a.id} className="border-t border-line-1 py-2.5">
                    <p className="font-medium text-fg">{a.title[lang]}</p>
                    <p className="mt-0.5 text-[0.9375rem] text-fg-2">{a.why[lang]}</p>
                    <p className="mt-0.5 text-[0.875rem] text-fg-3">{costText(a, lang)}</p>
                    {a.factIds
                      .map((id) => report.facts.find((f) => f.id === id))
                      .map((f) => (f ? correctionFor(f.id, f.value) : null))
                      .filter(Boolean)
                      .slice(0, 1)
                      .map((p) => (
                        <CorrectButton key={p!} predicate={p!} />
                      ))}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {timeValueMonth || profitYearPretax ? (
            <div className="mt-6">
              <h3 className="type-h4 text-fg">
                {t("In total, as separate lines", "În total, pe linii separate")}
              </h3>
              <dl className="mt-2">
                {timeValueMonth ? (
                  <Row label={t("Value of hours won", "Valoarea orelor câștigate")}>
                    <EffectText e={timeValueMonth} showHour={false} />
                  </Row>
                ) : null}
                {profitYearPretax ? (
                  <Row label={t("Extra profit", "Profit în plus")}>
                    <EffectText e={profitYearPretax} showHour={false} />
                  </Row>
                ) : null}
              </dl>
              {timeValueMonth && profitYearPretax ? (
                <p className="mt-1 text-[0.8125rem] text-fg-3">
                  {t(
                    "We never add them up: they are different kinds of money.",
                    "Nu le adunăm: sunt feluri diferite de bani.",
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
        </PanelBody>
        <PanelFooter>
          <span>{DISCLOSURE[lang]}</span>
          {!adjustOpen && adjustable.size ? (
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-11 sm:h-8"
              onClick={() => openAdjust()}
            >
              {t("Adjust the numbers", "Ajustează cifrele")}
            </Button>
          ) : null}
        </PanelFooter>
      </Panel>
    </section>
  );
}

/** "Ajustează cifrele" (D11): the owner's numbers; estimates recompute in the browser. */
function AdjustPanel({
  onClose,
  autoFocus = true,
  focusKey,
}: {
  onClose?: () => void;
  autoFocus?: boolean;
  focusKey?: AdjustField;
}) {
  const { t } = useI18n();
  const { report, owner, onOwnerInputs } = useReport();
  const id = useId();
  const fields = adjustableInputs(report);
  const perDay = (perMonth?: number) =>
    perMonth ? String(Math.round((perMonth / WORKING_DAYS_PER_MONTH) * 10) / 10) : "";
  const [values, setValues] = useState<Record<keyof OwnerInputs, string>>({
    turnover2026: owner?.turnover2026 ? String(owner.turnover2026) : "",
    // The volume is asked per day (how owners count it); it is kept per month.
    clientsPerMonth: perDay(owner?.clientsPerMonth),
    avgTicket: owner?.avgTicket ? String(owner.avgTicket) : "",
    hourValue: owner?.hourValue ? String(owner.hourValue) : "",
  });
  const [error, setError] = useState("");
  useEffect(() => {
    if (!autoFocus) return;
    const target = focusKey ? document.getElementById(`${id}-${focusKey}`) : null;
    (target ?? document.getElementById(`${id}-first`))?.focus();
  }, [id, autoFocus, focusKey]);
  const num = (v: string) => {
    const clean = v.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    return clean ? Number(clean) : undefined;
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: OwnerInputs = {};
    for (const key of Object.keys(values) as Array<keyof OwnerInputs>) {
      const v = num(values[key]);
      if (v === undefined) continue;
      if (!Number.isFinite(v) || v <= 0) {
        setError(t("Use positive numbers.", "Folosește numere pozitive."));
        return;
      }
      next[key] = key === "clientsPerMonth" ? Math.round(v * WORKING_DAYS_PER_MONTH) : v;
    }
    onOwnerInputs(Object.keys(next).length ? next : undefined);
    setError("");
  };
  const hour = assumedHourValue(report);
  const clients = assumedClients(report);
  const noun = volumeNoun(report.vocab);
  const turnover = report.actions.find((a) => a.effect?.inputs.turnover)?.effect?.inputs.turnover;
  const filedYear = report.actions.find((a) => a.effect?.inputs.year)?.effect?.inputs.year;
  const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const order: Array<{ key: keyof OwnerInputs; label: [string, string]; hint?: string }> = [
    {
      key: "turnover2026",
      label: ["Your 2026 turnover estimate (lei)", "Cifra de afaceri estimată pentru 2026 (lei)"],
      hint: owner?.turnover2026
        ? t(
            `we use ${formatInt(owner.turnover2026, "en")} lei (your number)`,
            `folosim ${formatInt(owner.turnover2026, "ro")} lei (cifra ta)`,
          )
        : turnover
          ? t(
              `we use ${formatInt(turnover, "en")} lei (the ${filedYear ?? ""} figure)`,
              `folosim ${formatInt(turnover, "ro")} lei (cifra din ${filedYear ?? "bilanț"})`,
            )
          : undefined,
    },
    {
      key: "clientsPerMonth",
      label: [`${cap(noun.en)} a day`, `${cap(noun.ro)} pe zi`],
      hint: owner?.clientsPerMonth
        ? t(
            `we use ${perDay(owner.clientsPerMonth)} a day (your number)`,
            `folosim ${perDay(owner.clientsPerMonth)} pe zi (cifra ta)`,
          )
        : clients
          ? t(`we assume about ${perDay(clients)} a day`, `presupunem cam ${perDay(clients)} pe zi`)
          : undefined,
    },
    { key: "avgTicket", label: ["Average ticket (lei)", "Bon mediu (lei)"] },
    {
      key: "hourValue",
      label: ["Value of an hour of office work (lei)", "Valoarea unei ore de muncă de birou (lei)"],
      hint: owner?.hourValue
        ? t(
            `we use ${Math.round(owner.hourValue)} lei (your number)`,
            `folosim ${Math.round(owner.hourValue)} lei (cifra ta)`,
          )
        : hour
          ? t(`we assume ${Math.round(hour)} lei`, `presupunem ${Math.round(hour)} lei`)
          : undefined,
    },
  ];
  const visible = order.filter((o) => fields.has(o.key));
  return (
    <form
      id="ajusteaza"
      onSubmit={submit}
      aria-labelledby={`${id}-title`}
      className="mb-6 scroll-mt-28 border-y border-line-1 py-4"
    >
      <h3 id={`${id}-title`} className="type-h4 text-fg">
        {t("Adjust the numbers", "Ajustează cifrele")}
      </h3>
      <p className="mt-1 text-[0.875rem] text-fg-3">
        {t(
          "Estimates recompute at once with your numbers. Official figures stay as filed.",
          "Estimările se recalculează imediat cu cifrele tale. Cifrele oficiale rămân cele din bilanț.",
        )}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {visible.map((o, i) => (
          <Field key={o.key} label={t(o.label[0], o.label[1])} optional hint={o.hint}>
            <Input
              id={i === 0 ? `${id}-first` : `${id}-${o.key}`}
              inputMode="decimal"
              value={values[o.key]}
              onChange={(e) => setValues((v) => ({ ...v, [o.key]: e.target.value }))}
              className="h-11 text-base"
            />
          </Field>
        ))}
      </div>
      {error ? <p className="mt-2 text-[0.8125rem] text-bad">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" className="h-11">
          {t("Recalculate", "Recalculează")}
        </Button>
        {owner ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => {
              onOwnerInputs(undefined);
              setValues({ turnover2026: "", clientsPerMonth: "", avgTicket: "", hourValue: "" });
            }}
          >
            {t("Back to our numbers", "Revino la cifrele noastre")}
          </Button>
        ) : null}
        {onClose ? (
          <Button type="button" variant="ghost" className="h-11" onClick={onClose}>
            {t("Close", "Închide")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** "Ce să verifici înainte să lucrezi cu ei" for clients, suppliers and others. */
function DueDiligence() {
  const { t, lang } = useI18n();
  const { report } = useReport();
  const items = dueDiligence(report);
  return (
    <section
      id="de-verificat"
      aria-labelledby="de-verificat-titlu"
      className="min-w-0 scroll-mt-28"
    >
      <Panel>
        <PanelHeader
          titleAs="h2"
          titleId="de-verificat-titlu"
          title={t(
            "What to check before working with them",
            "Ce să verifici înainte să lucrezi cu ei",
          )}
          sub={t(
            "From public registers; nothing here is a legal opinion.",
            "Din registre publice; nimic de aici nu e o opinie juridică.",
          )}
        />
        <PanelBody className="pt-0">
          <dl>
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "grid gap-x-4 gap-y-0.5 border-t border-line-1 py-2.5 sm:grid-cols-[13rem_minmax(0,1fr)]",
                )}
              >
                <dt className="text-[0.875rem] text-fg-3">{item.label[lang]}</dt>
                <dd className="min-w-0 text-fg">
                  {item.value[lang]}
                  {item.link ? (
                    <>
                      {" · "}
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="-my-3 inline-flex min-h-11 items-center rounded-sm text-fg-2 underline underline-offset-2 hover:text-fg"
                      >
                        {t("see at the source", "vezi la sursă")}
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </PanelBody>
      </Panel>
    </section>
  );
}

import { useId, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";

import { Button, CheckboxField, Field, Panel, PanelBody } from "@/components/system";
import { Input } from "@/components/ui/input";
import type {
  Correction,
  DeepAccess,
  Lang,
  OwnerInputs,
  Relationship,
  StartDeepRunInput,
} from "@/lib/deep/contracts";
import {
  DEEP_NOTICE,
  DEEP_RETENTION_DAYS,
  DEEP_TERMS,
  DEEP_TERMS_VERSION,
} from "@/lib/scan/legal/lead-notice";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { OUTCOME, RELATIONSHIPS, startCostLine } from "./copy";
import { usd } from "./format";
import { Disclosure } from "./report/shared";

/*
 * The start form (plan A10): the company line, "Ce relație ai cu firma?", the report language
 * behind "Schimbă limba raportului", optional numbers for sharper estimates, a social page if
 * that is all the firm has (declared, never fetched), the deep notice, box 1 (required, shown
 * as accepted with a "vezi" link when this account accepted this terms version before), box 2
 * (optional, unticked marketing) and "Pornește cercetarea". Admins see the budget line.
 */

export type StartCompany = { cui: string; name?: string; city?: string };

export function DeepStartForm({
  company,
  site,
  access,
  termsRemembered,
  busy,
  testCode,
  sample,
  onStart,
}: {
  company: StartCompany;
  site?: string;
  access: DeepAccess | null;
  termsRemembered: boolean;
  busy: boolean;
  testCode?: string;
  sample?: boolean;
  onStart: (input: StartDeepRunInput) => void;
}) {
  const { t, lang } = useI18n();
  const id = useId();
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [reportLang, setReportLang] = useState<Lang | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [owner, setOwner] = useState({ turnover2026: "", clientsPerMonth: "", avgTicket: "" });
  const [social, setSocial] = useState("");
  const [terms, setTerms] = useState(termsRemembered);
  const [marketing, setMarketing] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [errors, setErrors] = useState<{
    relationship?: string;
    terms?: string;
    social?: string;
    numbers?: string;
  }>({});
  const chosenLang: Lang = reportLang ?? lang;
  const notice = DEEP_NOTICE[lang];
  const cost = sample ? null : startCostLine(access);

  const num = (v: string) => {
    const clean = v.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    return clean ? Number(clean) : undefined;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!relationship) next.relationship = t("Choose one.", "Alege una.");
    if (!terms && !termsRemembered)
      next.terms = t("Tick the box to start.", "Bifează căsuța ca să pornești.");
    const socialUrl = social.trim()
      ? /^https?:\/\//i.test(social.trim())
        ? social.trim()
        : `https://${social.trim()}`
      : "";
    if (socialUrl && !/^https?:\/\/[^\s/]+\.[^\s]{2,}/i.test(socialUrl))
      next.social = t("Write the full address of the page.", "Scrie adresa completă a paginii.");
    const ownerInputs: OwnerInputs = {};
    for (const key of ["turnover2026", "clientsPerMonth", "avgTicket"] as const) {
      const v = num(owner[key]);
      if (v === undefined) continue;
      if (!Number.isFinite(v) || v <= 0)
        next.numbers = t("Use positive numbers.", "Folosește numere pozitive.");
      else ownerInputs[key] = v;
    }
    setErrors(next);
    if (Object.keys(next).length || !relationship) return;
    const corrections: Correction[] = socialUrl
      ? [{ predicate: "presence.social_only", url: socialUrl.slice(0, 300) }]
      : [];
    onStart({
      cui: company.cui,
      ...(site ? { site } : {}),
      relationship,
      lang: chosenLang,
      // The notice and boxes were shown in the interface language: the record says so.
      consent: { termsVersion: DEEP_TERMS_VERSION, marketing, lang },
      ...(testCode ? { testCode } : {}),
      ...(Object.keys(ownerInputs).length ? { owner: ownerInputs } : {}),
      ...(corrections.length ? { corrections } : {}),
    });
  };

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${id}-title`} className="max-w-[44rem]">
      <h2 id={`${id}-title`} className="type-title text-balance text-fg">
        {t("Start Deep Research", "Pornește Deep Research")}
      </h2>
      <p className="mt-2 max-w-[60ch] text-fg-2">{t(OUTCOME.en, OUTCOME.ro)}</p>

      <fieldset
        className="mt-6"
        aria-describedby={errors.relationship ? `${id}-rel-error` : undefined}
      >
        <legend className="type-h4 text-fg">
          {t("How are you related to the company?", "Ce relație ai cu firma?")}
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {RELATIONSHIPS.map((r) => (
            <label
              key={r.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-[0.9375rem] transition-colors duration-150",
                relationship === r.value
                  ? "border-fg/40 bg-fill-2 text-fg"
                  : "border-line-2 text-fg-2 hover:border-line-3",
              )}
            >
              <input
                type="radio"
                name={`${id}-rel`}
                value={r.value}
                checked={relationship === r.value}
                onChange={() => {
                  setRelationship(r.value);
                  setErrors((e) => ({ ...e, relationship: undefined }));
                }}
                className="size-4 accent-[var(--vx-brand)]"
              />
              {r.label[lang]}
            </label>
          ))}
        </div>
        {errors.relationship ? (
          <p id={`${id}-rel-error`} className="mt-1.5 text-[0.8125rem] text-bad">
            {errors.relationship}
          </p>
        ) : null}
        {relationship && relationship !== "proprietar" && relationship !== "angajat" ? (
          <p className="mt-2 text-[0.875rem] text-fg-3">
            {t(
              "The report is written in the third person and ends with what to check before working with them.",
              "Raportul e scris la persoana a treia și se încheie cu ce să verifici înainte să lucrezi cu ei.",
            )}
          </p>
        ) : null}
      </fieldset>

      <div className="mt-6 space-y-2">
        <p className="text-[0.9375rem] text-fg-2">
          {t("Report language: ", "Limba raportului: ")}
          <span className="font-medium text-fg">{chosenLang === "ro" ? "română" : "English"}</span>
          {" · "}
          <button
            type="button"
            className="min-h-11 rounded-sm underline decoration-fg/30 underline-offset-4 hover:decoration-fg sm:min-h-0"
            aria-expanded={langOpen}
            onClick={() => setLangOpen((v) => !v)}
          >
            {t("Change the report language", "Schimbă limba raportului")}
          </button>
        </p>
        {langOpen ? (
          <div className="flex gap-2">
            {(["ro", "en"] as const).map((l) => (
              <Button
                key={l}
                type="button"
                variant={chosenLang === l ? "secondary" : "ghost"}
                className="h-11"
                aria-pressed={chosenLang === l}
                onClick={() => setReportLang(l)}
              >
                <span lang={l}>{l === "ro" ? "Română" : "English"}</span>
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls={`${id}-more`}
          onClick={() => setMoreOpen((v) => !v)}
          className="min-h-11 rounded-sm text-left font-medium text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
        >
          {t("Want sharper estimates? (optional)", "Vrei estimări mai exacte? (opțional)")}
        </button>
        {moreOpen ? (
          <div id={`${id}-more`} className="mt-3 grid gap-4 sm:grid-cols-3">
            <Field
              label={t("2026 turnover estimate (lei)", "Cifra de afaceri estimată 2026 (lei)")}
              optional
            >
              <Input
                inputMode="numeric"
                value={owner.turnover2026}
                onChange={(e) => setOwner((o) => ({ ...o, turnover2026: e.target.value }))}
                className="h-11 text-base"
              />
            </Field>
            <Field label={t("Clients a month", "Clienți pe lună")} optional>
              <Input
                inputMode="numeric"
                value={owner.clientsPerMonth}
                onChange={(e) => setOwner((o) => ({ ...o, clientsPerMonth: e.target.value }))}
                className="h-11 text-base"
              />
            </Field>
            <Field
              label={t("Average ticket (lei)", "Bon mediu (lei)")}
              optional
              error={errors.numbers}
            >
              <Input
                inputMode="numeric"
                value={owner.avgTicket}
                onChange={(e) => setOwner((o) => ({ ...o, avgTicket: e.target.value }))}
                className="h-11 text-base"
              />
            </Field>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <Field
          label={t(
            "I only have a Facebook or Instagram page",
            "Am doar pagină de Facebook sau Instagram",
          )}
          optional
          hint={t(
            "We note it as declared by you; we never open it.",
            "O notăm ca declarată de tine; nu o deschidem.",
          )}
          error={errors.social}
        >
          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={social}
            onChange={(e) => setSocial(e.target.value)}
            className="h-11 text-base"
          />
        </Field>
      </div>

      <Panel className="mt-6">
        <PanelBody className="space-y-4">
          {/* A layered notice: two lines first, the full note (unchanged) one tap away. */}
          <div className="text-[0.9375rem] leading-[1.55] text-fg-2">
            <p>
              {t(
                `We use only public data about the company. The report is yours alone; we keep it ${DEEP_RETENTION_DAYS} days.`,
                `Folosim doar date publice despre firmă. Raportul e doar al tău; îl păstrăm ${DEEP_RETENTION_DAYS} de zile.`,
              )}
            </p>
            <Disclosure
              className="border-b border-line-1"
              summaryClassName="text-[0.875rem] font-medium text-fg"
              summary={t("Read the full notice", "Citește nota completă")}
            >
              <p className="text-[0.875rem] leading-[1.55]">{notice.notice}</p>
            </Disclosure>
          </div>
          {termsRemembered ? (
            <p className="text-[0.9375rem] text-fg">
              {t(
                "You accepted the report terms of use.",
                "Ai acceptat Termenii de utilizare a raportului.",
              )}{" "}
              <button
                type="button"
                className="min-h-11 rounded-sm underline underline-offset-2 sm:min-h-0"
                onClick={() => setShowTerms((v) => !v)}
              >
                {t("see them", "vezi")}
              </button>
            </p>
          ) : (
            <CheckboxField
              checked={terms}
              onCheckedChange={(v) => {
                setTerms(v === true);
                setErrors((e) => ({ ...e, terms: undefined }));
              }}
              error={errors.terms}
              label={
                <>
                  {notice.termsBox}{" "}
                  <span className="text-fg-3">
                    (
                    <button
                      type="button"
                      className="-my-3 inline-flex min-h-11 items-center rounded-sm underline underline-offset-2 sm:my-0 sm:min-h-0"
                      onClick={() => setShowTerms((v) => !v)}
                    >
                      {t("read the terms", "citește termenii")}
                    </button>
                    )
                  </span>
                </>
              }
            />
          )}
          {showTerms ? (
            <div className="border-l-2 border-line-2 pl-3 text-[0.875rem] text-fg-2">
              <p className="font-medium text-fg">{DEEP_TERMS[lang].title}</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                {DEEP_TERMS[lang].points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              <p className="mt-2">
                <Link
                  to="/terms"
                  hash="rapoarte-vortex-scan"
                  className="rounded-sm underline underline-offset-2"
                >
                  {t("The terms page", "Pagina cu termenii")}
                </Link>
              </p>
            </div>
          ) : null}
          <CheckboxField
            checked={marketing}
            onCheckedChange={(v) => setMarketing(v === true)}
            label={notice.marketing}
          />
        </PanelBody>
      </Panel>

      {access?.admin ? (
        <p className="mt-4 text-[0.875rem] text-fg-3">
          {t("Budget", "Buget")}: {usd(access.budgetUsd, lang)} · {t("today", "azi")}:{" "}
          {usd(access.admin.todayUsd, lang)} {t("of", "din")} {usd(access.admin.dayCapUsd, lang)} ·{" "}
          {t("left today", "rămase azi")}: {access.runsLeftToday}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Button type="submit" size="lg" className="h-11 w-full sm:w-auto" loading={busy}>
          {t("Start the research", "Pornește cercetarea")}
        </Button>
        {sample || cost ? (
          <span className="text-[0.875rem] text-fg-3">
            {sample ? t("Sample: nothing is sent.", "Exemplu: nu se trimite nimic.") : cost?.[lang]}
          </span>
        ) : null}
      </div>
    </form>
  );
}

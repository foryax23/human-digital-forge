import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button, ButtonLink, Panel, PanelBody } from "@/components/system";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlan, myPlanQueryKey } from "@/lib/client-plan.functions";
import { CLIENT_PLANS, formatPlanDay, formatRenewalDay } from "@/lib/client-plans";
import type { AccessReason, DeepAccess } from "@/lib/deep/contracts";
import { monthlyText, PLAN_CATALOG, PLAN_ORDER, reportsText } from "@/lib/pricing";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { SIGNATORY } from "./contact";
import {
  creditsKeptLine,
  FREE_NEEDS_GOOGLE,
  FREE_USED,
  MORE_WITH_PLANS,
  planReportsUsedCopy,
  planStartsLaterCopy,
  REASON_COPY,
  REPORT_CONTENTS,
  VALUE_ESTIMATE,
  type AccessExtras,
  type GateCopy,
} from "./copy";
import { DEEP_PATH } from "./safe-next";

/*
 * The access states (plan A4, A10) in plain Romanian: switched off, not signed in ("Primul
 * raport Deep Research e gratuit"), e-mail not confirmed, the free report used (no checks left
 * and no plan: the plans and "Cere contractul"), a plan's reports used, test code, daily
 * limits, storage down, plus the refusals a start can get. The gate never embeds the Google
 * button in the server render: "Intră în cont" goes to /login?next=/scan/deep.
 */

/** Refusals that mean "no checks left" once the account's checks are known to be 0. */
const NO_CHECKS: AccessReason[] = [
  "premium_required",
  "admin_only",
  "code_required",
  "free_run_used",
];
/** Refusals that spend nothing (a check spent on a run that did not start is given back). */
const NOTHING_SPENT: AccessReason[] = [
  "daily_cap_user",
  "daily_cap_global",
  "ledger_unavailable",
  "budget_exhausted",
  "anaf_unavailable",
];

export function DeepGate({
  reason,
  userId,
  onCode,
  codeBusy,
  codeError,
  replayRunId,
  unfinishedRunId,
  onRetry,
  access,
}: {
  reason: AccessReason;
  userId?: string | null;
  onCode?: (code: string) => void;
  codeBusy?: boolean;
  codeError?: boolean;
  replayRunId?: string;
  unfinishedRunId?: string;
  onRetry?: () => void;
  /** The access answer behind the refusal: the account's deep checks (absent when unknown). */
  access?: DeepAccess | null;
}) {
  const { t, lang } = useI18n();
  const pathname = useLocation({ select: (l) => l.pathname });
  const extras = access as AccessExtras | null | undefined;
  const credits = extras?.credits;
  // The free check is there but waits for a Google sign-in: the way to use it comes first.
  const needsGoogle =
    NO_CHECKS.includes(reason) && extras?.creditNeeds === "google" && (credits?.left ?? 0) > 0;
  const planCopy = usePlanGateCopy(reason);
  // No checks left and no plan that admits: say the free report is used, whatever the mode.
  const freeUsed =
    !needsGoogle &&
    !planCopy &&
    NO_CHECKS.includes(reason) &&
    (reason === "free_run_used" || credits?.left === 0);
  const copy = needsGoogle
    ? FREE_NEEDS_GOOGLE
    : (planCopy ?? (freeUsed ? FREE_USED : REASON_COPY[reason]));
  const showPlans = !needsGoogle && !planCopy && (freeUsed || reason === "premium_required");
  const kept = NOTHING_SPENT.includes(reason) ? creditsKeptLine(credits) : null;
  const titleId = useId();
  const showSample =
    !freeUsed &&
    [
      "login_required",
      "admin_only",
      "code_required",
      "premium_required",
      "mode_disabled",
      "email_unconfirmed",
    ].includes(reason);
  const showReports = freeUsed && !pathname.startsWith("/dashboard/research");

  return (
    <section aria-labelledby={titleId} className="max-w-[40rem]">
      <h2 id={titleId} className="type-title text-balance text-fg">
        {copy.title[lang]}
      </h2>
      <p className="mt-2 max-w-[60ch] text-fg-2">{copy.body[lang]}</p>
      {kept ? <p className="mt-2 max-w-[60ch] text-fg">{kept[lang]}</p> : null}

      {reason === "login_required" ? <LoginOffer /> : null}

      {needsGoogle ? (
        <div className="mt-5">
          <GoogleLink />
        </div>
      ) : null}

      {reason === "admin_only" && userId && !freeUsed && !needsGoogle ? (
        <AccountId userId={userId} />
      ) : null}

      {reason === "email_unconfirmed" ? (
        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row">
          <GoogleLink />
          <ResendLink />
        </div>
      ) : null}

      {reason === "code_required" && onCode && !freeUsed ? (
        <CodeForm onCode={onCode} busy={codeBusy} error={codeError} />
      ) : null}

      {planCopy && !needsGoogle ? (
        <div className="mt-5">
          <ButtonLink to="/dashboard/billing" variant="secondary" size="lg" className="h-11">
            {t("See your plan", "Vezi abonamentul tău")}
          </ButtonLink>
        </div>
      ) : null}

      {showPlans ? (
        <div className="mt-4">
          {/* The reports each plan includes (src/lib/pricing.ts), as the pricing section lists them. */}
          <ul className="mb-5 space-y-1">
            {PLAN_ORDER.map((id) => (
              <li key={id} className="flex flex-wrap gap-x-2 text-fg">
                <span className="font-medium">{PLAN_CATALOG[id].name}</span>
                <span className="text-fg-2">
                  {`${monthlyText(PLAN_CATALOG[id].priceLei)[lang]}: ${reportsText(id)[lang]}`}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Growth, the recommended plan, chosen in the form; the visitor can change it there. */}
            <ButtonLink to="/contact" search={{ plan: "growth" }} size="lg" className="h-11">
              {t("Request the contract", "Cere contractul")}
            </ButtonLink>
            <ButtonLink to="/" hash="pricing" variant="secondary" size="lg" className="h-11">
              {t("See the plans", "Vezi abonamentele")}
            </ButtonLink>
          </div>
        </div>
      ) : null}

      {reason === "same_company_today" && replayRunId ? (
        <div className="mt-5">
          <ButtonLink to={DEEP_PATH} search={{ run: replayRunId }} size="lg" className="h-11">
            {t("Open today's report", "Deschide raportul de azi")}
          </ButtonLink>
        </div>
      ) : null}

      {reason === "already_running" && unfinishedRunId ? (
        <div className="mt-5">
          <ButtonLink to={DEEP_PATH} search={{ run: unfinishedRunId }} size="lg" className="h-11">
            {t("Continue the research", "Continuă cercetarea")}
          </ButtonLink>
        </div>
      ) : null}

      {(reason === "ledger_unavailable" ||
        reason === "anaf_unavailable" ||
        reason === "terms_outdated" ||
        (reason === "admin_only" && !freeUsed && !needsGoogle)) &&
      onRetry ? (
        <div className="mt-5">
          <Button size="lg" className="h-11" onClick={onRetry}>
            {t("Try again", "Încearcă din nou")}
          </Button>
        </div>
      ) : null}

      {reason === "code_required" && onCode && freeUsed ? (
        <div className="mt-6 border-t border-line-1 pt-4">
          <p className="font-medium text-fg">
            {t("Do you have a test code?", "Ai un cod de test?")}
          </p>
          <CodeForm onCode={onCode} busy={codeBusy} error={codeError} className="mt-2" />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        {showReports ? (
          <ButtonLink to="/dashboard/research" variant="link" className="min-h-11">
            {t("See your reports", "Vezi rapoartele tale")}
          </ButtonLink>
        ) : null}
        {showSample ? (
          <ButtonLink
            to={DEEP_PATH}
            search={{ demo: "exemplu" }}
            variant="link"
            className="min-h-11"
          >
            {t("See a sample report", "Vezi un exemplu de raport")}
          </ButtonLink>
        ) : null}
        <ButtonLink to="/scan" variant="link" className="min-h-11">
          {t("Back to Vortex Scan", "Înapoi la Vortex Scan")}
        </ButtonLink>
      </div>
    </section>
  );
}

/**
 * Not signed in: what the free report contains, the owner's labelled value estimate, the way
 * in ("Intră cu Google sau cu e-mail"), and that the plans by contract add more reports.
 */
function LoginOffer() {
  const { t, lang } = useI18n();
  return (
    <>
      <ul
        aria-label={t("What the report contains", "Ce cuprinde raportul")}
        className="mt-4 max-w-[60ch] space-y-1.5"
      >
        {REPORT_CONTENTS.map((line) => (
          <li key={line.en} className="flex gap-2 text-fg-2">
            <span aria-hidden className="text-fg-3">
              –
            </span>
            {line[lang]}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.875rem] text-fg-3">{VALUE_ESTIMATE[lang]}</p>
      <div className="mt-5">
        <GoogleLink />
      </div>
      <p className="mt-3 text-[0.875rem] text-fg-3">
        {t(
          "With Google your account is made in one step. We keep the company you chose for an hour.",
          "Cu Google, contul se face dintr-un pas. Păstrăm firma aleasă o oră.",
        )}
      </p>
      <p className="mt-5 max-w-[60ch] border-t border-line-1 pt-4 text-[0.875rem] text-fg-2">
        {MORE_WITH_PLANS[lang]}{" "}
        {/* An inline link in a sentence (no 44 px box, which would push the line apart). */}
        <Link
          to="/"
          hash="pricing"
          className="rounded-sm font-medium text-fg underline underline-offset-4"
        >
          {t("See the plans", "Vezi abonamentele")}
        </Link>
      </p>
    </>
  );
}

/**
 * premium_required for a signed-in account with a plan assigned by contract: its reports for
 * this period are used, or it starts later. Null otherwise (and until the plan is read), so the
 * gate shows the plans as before. Only the browser asks (getMyPlan); the server render and the
 * first client render are the same.
 */
function usePlanGateCopy(reason: AccessReason): GateCopy | null {
  const { user } = useAuth();
  const fetchPlan = useServerFn(getMyPlan);
  const { data } = useQuery({
    queryKey: myPlanQueryKey(user?.id),
    queryFn: () => fetchPlan(),
    enabled: Boolean(user) && reason === "premium_required",
    staleTime: 60_000,
  });
  if (reason !== "premium_required" || data?.status !== "active") return null;
  const { plan, research } = data;
  const name = CLIENT_PLANS[plan.id].label;
  if (plan.state === "scheduled")
    return plan.researchIncluded
      ? planStartsLaterCopy({
          plan: name,
          startsOn: {
            en: formatPlanDay(plan.startsOn, "en"),
            ro: formatPlanDay(plan.startsOn, "ro"),
          },
        })
      : null;
  if (
    !research ||
    research.reports === null ||
    research.period === null ||
    research.used === null ||
    research.used < research.reports
  )
    return null;
  return planReportsUsedCopy({
    plan: name,
    reports: research.reports,
    period: research.period,
    renews: research.renewsAt
      ? {
          en: formatRenewalDay(research.renewsAt, "en"),
          ro: formatRenewalDay(research.renewsAt, "ro"),
        }
      : null,
  });
}

function AccountId({ userId }: { userId: string }) {
  const { t } = useI18n();
  const inbox = SIGNATORY.email;
  const subject = encodeURIComponent(t("Deep Research access", "Acces la Deep Research"));
  const body = encodeURIComponent(t(`My account ID: ${userId}`, `ID-ul contului meu: ${userId}`));
  const sendIdHref = `mailto:${inbox}?subject=${subject}&body=${body}`;
  return (
    <Panel className="mt-5">
      <PanelBody>
        <p className="text-[0.8125rem] text-fg-3">{t("Your account ID", "ID-ul contului tău")}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="type-code break-all text-fg">{userId}</code>
          <Button
            variant="secondary"
            size="sm"
            className="h-11 sm:h-9"
            icon={<Copy aria-hidden />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(userId);
                toast.success(t("ID copied", "ID-ul e copiat"));
              } catch {
                toast.error(t("Could not copy", "Nu am putut copia"));
              }
            }}
          >
            {t("Copy", "Copiază")}
          </Button>
        </div>
        <a
          href={sendIdHref}
          className="mt-2 inline-flex min-h-11 items-center rounded-sm font-medium text-fg underline underline-offset-4"
        >
          {t("Send the ID by e-mail", "Trimite ID-ul pe e-mail")}
        </a>
      </PanelBody>
    </Panel>
  );
}

/**
 * "Intră cu Google": the sign-in page, back to /scan/deep after it. The gate never embeds the
 * Google button itself (it renders on the server for the samples).
 */
function GoogleLink() {
  const { t } = useI18n();
  return (
    <ButtonLink to="/login" search={{ next: DEEP_PATH }} size="lg" className="h-11">
      {t("Sign in with Google", "Intră cu Google")}
    </ButtonLink>
  );
}

/** "Retrimite linkul": the confirmation e-mail again, for the signed-in account. */
function ResendLink() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const email = user?.email;
  if (!email) return null;
  if (state === "sent")
    return (
      <p className="text-fg sm:self-center" role="status">
        {t("We sent the link again.", "Am retrimis linkul.")}
      </p>
    );
  return (
    <div>
      <Button
        variant="secondary"
        size="lg"
        className="h-11"
        loading={state === "busy"}
        onClick={async () => {
          setState("busy");
          const { error } = await supabase.auth.resend({
            type: "signup",
            email,
            options: { emailRedirectTo: `${window.location.origin}${DEEP_PATH}` },
          });
          setState(error ? "error" : "sent");
        }}
      >
        {t("Send the link again", "Retrimite linkul")}
      </Button>
      {state === "error" ? (
        <p className="mt-2 text-[0.8125rem] text-bad" role="alert">
          {t(
            "We couldn't send it now. Try again in a minute.",
            "Nu am putut trimite acum. Încearcă peste un minut.",
          )}
        </p>
      ) : null}
    </div>
  );
}

function CodeForm({
  onCode,
  busy,
  error,
  className,
}: {
  onCode: (code: string) => void;
  busy?: boolean;
  error?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const [code, setCode] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim()) onCode(code.trim());
  };
  return (
    <form onSubmit={submit} className={cn("flex max-w-sm flex-col gap-2", className ?? "mt-5")}>
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-fg-2">
        {t("Test code", "Codul de test")}
      </label>
      <Input
        id={id}
        value={code}
        autoComplete="off"
        autoCapitalize="characters"
        onChange={(e) => setCode(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="type-code h-11 text-base"
      />
      {error ? (
        <p id={`${id}-error`} className="text-[0.8125rem] text-bad">
          {t(
            "The code is not valid. Check the letters and digits.",
            "Codul nu e valid. Verifică literele și cifrele.",
          )}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11 self-start" loading={busy}>
        {t("Use the code", "Folosește codul")}
      </Button>
    </form>
  );
}

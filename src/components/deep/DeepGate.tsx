import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button, ButtonLink, Panel, PanelBody } from "@/components/system";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlan, myPlanQueryKey } from "@/lib/client-plan.functions";
import { CLIENT_PLANS, formatPlanDay, formatRenewalDay } from "@/lib/client-plans";
import type { AccessReason } from "@/lib/deep/contracts";
import { monthlyText, PLAN_CATALOG, PLAN_ORDER, reportsText } from "@/lib/pricing";
import { useI18n } from "@/i18n";

import { SIGNATORY } from "./contact";
import { planReportsUsedCopy, planStartsLaterCopy, REASON_COPY, type GateCopy } from "./copy";
import { DEEP_PATH } from "./safe-next";

/*
 * The access states (plan A4, A10) in plain Romanian: switched off, not signed in, e-mail not
 * confirmed, in testing (admins only, with the account ID to send), test code, Premium later,
 * daily limits, storage down, plus the refusals a start can get. The gate never embeds the
 * Google button in the server render: "Intră în cont" goes to /login?next=/scan/deep.
 */

export function DeepGate({
  reason,
  userId,
  onCode,
  codeBusy,
  codeError,
  replayRunId,
  unfinishedRunId,
  onRetry,
}: {
  reason: AccessReason;
  userId?: string | null;
  onCode?: (code: string) => void;
  codeBusy?: boolean;
  codeError?: boolean;
  replayRunId?: string;
  unfinishedRunId?: string;
  onRetry?: () => void;
}) {
  const { t, lang } = useI18n();
  const planCopy = usePlanGateCopy(reason);
  const copy = planCopy ?? REASON_COPY[reason];
  const titleId = useId();
  const showSample = [
    "login_required",
    "admin_only",
    "code_required",
    "premium_required",
    "free_run_used",
    "mode_disabled",
    "email_unconfirmed",
  ].includes(reason);

  return (
    <section aria-labelledby={titleId} className="max-w-[40rem]">
      <h2 id={titleId} className="type-title text-balance text-fg">
        {copy.title[lang]}
      </h2>
      <p className="mt-2 max-w-[60ch] text-fg-2">{copy.body[lang]}</p>

      {reason === "login_required" ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <ButtonLink to="/login" search={{ next: DEEP_PATH }} size="lg" className="h-11">
            {t("Sign in with Google or e-mail", "Intră cu Google sau cu e-mail")}
          </ButtonLink>
          <ButtonLink
            to="/register"
            search={{ next: DEEP_PATH }}
            variant="secondary"
            size="lg"
            className="h-11"
          >
            {t("Create an account", "Creează cont")}
          </ButtonLink>
        </div>
      ) : null}
      {reason === "login_required" ? (
        <p className="mt-3 text-[0.875rem] text-fg-3">
          {t(
            "With Google it takes one step. We keep the company you chose for an hour, while you make your account.",
            "Cu Google durează un pas. Păstrăm firma aleasă o oră, cât îți faci contul.",
          )}
        </p>
      ) : null}

      {reason === "admin_only" && userId ? <AccountId userId={userId} /> : null}

      {reason === "email_unconfirmed" ? <ResendLink /> : null}

      {reason === "code_required" && onCode ? (
        <CodeForm onCode={onCode} busy={codeBusy} error={codeError} />
      ) : null}

      {planCopy ? (
        <div className="mt-5">
          <ButtonLink to="/dashboard/billing" variant="secondary" size="lg" className="h-11">
            {t("See your plan", "Vezi abonamentul tău")}
          </ButtonLink>
        </div>
      ) : null}

      {!planCopy && (reason === "premium_required" || reason === "free_run_used") ? (
        <div className="mt-5">
          {/* The reports each plan includes (src/lib/pricing.ts), as the pricing section lists them. */}
          <ul className="mb-4 space-y-1">
            {PLAN_ORDER.map((id) => (
              <li key={id} className="flex flex-wrap gap-x-2 text-fg">
                <span className="font-medium">{PLAN_CATALOG[id].name}</span>
                <span className="text-fg-2">
                  {`${monthlyText(PLAN_CATALOG[id].priceLei)[lang]}: ${reportsText(id)[lang]}`}
                </span>
              </li>
            ))}
          </ul>
          <ButtonLink to="/" hash="pricing" size="lg" className="h-11">
            {t("See the plans", "Vezi abonamentele")}
          </ButtonLink>
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
        reason === "terms_outdated") &&
      onRetry ? (
        <div className="mt-5">
          <Button size="lg" className="h-11" onClick={onRetry}>
            {t("Try again", "Încearcă din nou")}
          </Button>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
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
  const subject = encodeURIComponent(t("Deep research access", "Acces la cercetarea aprofundată"));
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

/** "Retrimite linkul": the confirmation e-mail again, for the signed-in account. */
function ResendLink() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const email = user?.email;
  if (!email) return null;
  if (state === "sent")
    return (
      <p className="mt-4 text-fg" role="status">
        {t("We sent the link again.", "Am retrimis linkul.")}
      </p>
    );
  return (
    <div className="mt-4">
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
}: {
  onCode: (code: string) => void;
  busy?: boolean;
  error?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const [code, setCode] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim()) onCode(code.trim());
  };
  return (
    <form onSubmit={submit} className="mt-5 flex max-w-sm flex-col gap-2">
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

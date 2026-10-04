import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/components/auth/AuthProvider";
import { ButtonLink, Panel, PanelBody, PanelHeader, Stat, StatStrip } from "@/components/system";
import { useI18n } from "@/i18n";
import { getMyPlan, myPlanQueryKey, type MyPlan } from "@/lib/client-plan.functions";
import {
  CLIENT_PLANS,
  formatPlanDay as formatDay,
  formatRenewalDay as formatRenewal,
  hoursPerMonthLabel,
  reportsLabel,
} from "@/lib/client-plans";
import { monthlyText, PLAN_CATALOG } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/*
 * The client's plan (assigned by an admin after the contract) on the dashboard overview and the
 * billing page: the plan, since when and until when, the hours it includes each month and,
 * only while clients can use it, the deep research reports left this period. Nothing renders
 * while plans are unavailable (drizzle/pending/client_plans.sql not applied yet, or a failed read).
 */

type ActivePlan = Extract<MyPlan, { status: "active" }>;

/** The signed-in client's plan (one request shared by every card on the page and the deep gate). */
function useMyPlan() {
  const { user } = useAuth();
  const fetchPlan = useServerFn(getMyPlan);
  return useQuery({
    queryKey: myPlanQueryKey(user?.id),
    queryFn: () => fetchPlan(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
}

export function ClientPlanCard({
  showNone = false,
  className,
}: {
  /** Show a short "no plan" note (billing page) instead of nothing. */
  showNone?: boolean;
  className?: string;
}) {
  const { data } = useMyPlan();
  if (!data || data.status === "unavailable") return null;
  if (data.status === "none") return showNone ? <NoPlan className={className} /> : null;
  return <PlanPanel data={data} className={className} />;
}

function PlanPanel({ data, className }: { data: ActivePlan; className?: string }) {
  const { t, lang } = useI18n();
  const titleId = useId();
  const { plan, research } = data;
  const spec = CLIENT_PLANS[plan.id];
  const entry = PLAN_CATALOG[plan.id];
  // The list price (src/lib/pricing.ts); the contract carries the same fee.
  const fee = monthlyText(entry.priceLei)[lang];
  const scheduled = plan.state === "scheduled";
  const hoursUnit = hoursPerMonthLabel(plan.hoursPerMonth, lang).replace(/^\d+\s/, "");

  const reportsLeft =
    research && research.reports !== null && research.used !== null
      ? Math.max(0, research.reports - research.used)
      : null;
  const one = research?.reports === 1;
  const period =
    research?.period === "quarter"
      ? t("this quarter", "în acest trimestru")
      : t("this month", "luna aceasta");
  const renews = research?.renewsAt ? formatRenewal(research.renewsAt, lang) : "";
  const renewal = renews
    ? one
      ? t(` It renews on ${renews}.`, ` Se reînnoiește pe ${renews}.`)
      : t(` They renew on ${renews}.`, ` Se reînnoiesc pe ${renews}.`)
    : "";

  return (
    <Panel as="section" aria-labelledby={titleId} className={className}>
      <PanelHeader
        titleAs="h2"
        titleId={titleId}
        title={
          <>
            {t(`The ${spec.label} plan`, `Abonamentul ${spec.label}`)}
            <span className="ml-2 text-sm font-normal text-fg-3">{entry.role[lang]}</span>
          </>
        }
        sub={`${fee} · ${
          plan.contractRef
            ? `${t("Contract", "Contractul")} ${plan.contractRef}`
            : t("Signed by contract", "Încheiat prin contract")
        }`}
      />
      <PanelBody>
        <StatStrip
          columns={research && research.reports !== null ? 3 : 2}
          bleed
          label={t("What your plan includes", "Ce include abonamentul")}
        >
          <Stat
            label={t("Hours included", "Ore incluse")}
            value={plan.hoursPerMonth}
            unit={hoursUnit}
          />
          <Stat
            label={scheduled ? t("Starts on", "Începe pe") : t("Active since", "Activ din")}
            value={formatDay(plan.startsOn, lang)}
            sub={
              plan.endsOn
                ? t(
                    `Until ${formatDay(plan.endsOn, lang)}`,
                    `Până pe ${formatDay(plan.endsOn, lang)}`,
                  )
                : t("No end date", "Fără dată de încheiere")
            }
          />
          {research && research.reports !== null && research.period !== null ? (
            reportsLeft === null ? (
              <Stat
                label={t("Deep research", "Cercetare aprofundată")}
                value={research.reports}
                unit={reportsLabel(research.reports, research.period, lang).replace(/^\d+\s/, "")}
              />
            ) : (
              <Stat
                label={t("Reports left", "Rapoarte rămase")}
                value={t(
                  `${reportsLeft} of ${research.reports}`,
                  `${reportsLeft} din ${research.reports}`,
                )}
                sub={`${t(`Deep research, ${period}.`, `Cercetare aprofundată, ${period}.`)}${renewal}`}
              />
            )
          ) : null}
        </StatStrip>
      </PanelBody>
    </Panel>
  );
}

function NoPlan({ className }: { className?: string }) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <Panel as="section" aria-labelledby={titleId} className={cn(className)}>
      <PanelBody className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id={titleId} className="type-h4 text-fg">
            {t("You have no plan yet", "Nu ai încă un abonament")}
          </h2>
          <p className="type-body-sm mt-1 text-fg-3">
            {t(
              "The Starter, Growth and Pro plans are signed by contract.",
              "Abonamentele Starter, Growth și Pro se încheie prin contract.",
            )}
          </p>
        </div>
        <ButtonLink to="/" hash="pricing" variant="secondary" size="md">
          {t("See the plans", "Vezi abonamentele")}
        </ButtonLink>
      </PanelBody>
    </Panel>
  );
}

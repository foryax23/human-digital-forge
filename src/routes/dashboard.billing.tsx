import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/components/auth/AuthProvider";
import { ClientPlanCard } from "@/components/dashboard/ClientPlanCard";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { formatDay, formatMoney, invoiceStatus } from "@/components/dashboard/format";
import { Panel, PanelBody, PanelDivider, PanelHeader, Status } from "@/components/system";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { getMyPayments } from "@/lib/account.functions";
import { COMPANY } from "@/lib/scan/legal/company";

/*
 * Billing. Plans are signed and invoiced by contract (src/lib/pricing.ts), so the page shows
 * the plan, one line on how it is invoiced, and only real records: invoices the team has
 * issued in the invoices table, an older card subscription from Stripe, and paid one-off
 * Stripe payments. Nothing is shown for a record that does not exist (no empty tables).
 */

export const Route = createFileRoute("/dashboard/billing")({
  component: BillingPage,
});

interface Invoice {
  id: string;
  invoice_number: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
}

interface CardSubscription {
  tier: string | null;
  status: string;
  current_period_end: string | null;
}

const LIVE_SUBSCRIPTION = new Set(["active", "trialing", "past_due"]);

function useBillingRecords(userId: string | undefined) {
  const [state, setState] = useState<{
    invoices: Invoice[];
    subscription: CardSubscription | null;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    void (async () => {
      const [invoices, subs] = await Promise.all([
        supabase
          .from("invoices")
          .select(
            "id, invoice_number, description, amount_cents, currency, status, issued_at, due_at, paid_at",
          )
          .eq("user_id", userId)
          .neq("status", "draft")
          .order("issued_at", { ascending: false })
          .limit(100),
        supabase
          .from("subscribers")
          .select("tier, status, current_period_end")
          .eq("user_id", userId)
          .limit(1),
      ]);
      if (!live) return;
      if (invoices.error) console.error("[billing] invoices failed", invoices.error);
      const sub = ((subs.data as CardSubscription[] | null) ?? [])[0] ?? null;
      setState({
        invoices: (invoices.data as Invoice[] | null) ?? [],
        subscription: sub && LIVE_SUBSCRIPTION.has(sub.status) ? sub : null,
      });
    })();
    return () => {
      live = false;
    };
  }, [userId]);

  return state;
}

function InvoicesPanel({ invoices }: { invoices: Invoice[] }) {
  const { t, lang } = useI18n();
  return (
    <Panel as="section" aria-labelledby="billing-invoices">
      <PanelHeader titleAs="h2" titleId="billing-invoices" title={t("Invoices", "Facturi")} />
      <ul>
        {invoices.map((invoice) => {
          const status = invoiceStatus(invoice.status, lang);
          const dates = [
            formatDay(invoice.issued_at, lang),
            invoice.due_at ? `${t("due", "scadentă")} ${formatDay(invoice.due_at, lang)}` : null,
            invoice.paid_at ? `${t("paid", "plătită")} ${formatDay(invoice.paid_at, lang)}` : null,
          ].filter(Boolean);
          return (
            <li key={invoice.id}>
              <PanelDivider />
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4 sm:px-5">
                <div className="min-w-0">
                  <p className="type-body-sm flex flex-wrap items-center gap-x-3 gap-y-1 text-fg">
                    <span className="type-code">{invoice.invoice_number}</span>
                    <Status tone={status.tone}>{status.label}</Status>
                  </p>
                  {invoice.description ? (
                    <p className="type-body-sm mt-0.5 text-fg-2">{invoice.description}</p>
                  ) : null}
                  <p className="type-micro mt-0.5 text-fg-3">{dates.join(" · ")}</p>
                </div>
                <p className="type-num text-base font-semibold text-fg">
                  {formatMoney(invoice.amount_cents, invoice.currency, lang)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function PaymentsPanel() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const fetchPayments = useServerFn(getMyPayments);
  const { data } = useQuery({
    queryKey: ["my-payments", user?.id],
    queryFn: () => fetchPayments(),
    enabled: Boolean(user),
    staleTime: 60_000,
    retry: false,
  });
  // Only real payments: no key, an error or an empty list shows nothing.
  if (!data || data.status !== "ok" || data.payments.length === 0) return null;
  return (
    <Panel as="section" aria-labelledby="billing-payments">
      <PanelHeader
        titleAs="h2"
        titleId="billing-payments"
        title={t("Card payments", "Plăți cu cardul")}
        sub={t(
          `One-off payments made through Stripe, which e-mails you the receipt. For an invoice in your company's name, write to ${COMPANY.email}.`,
          `Plăți unice făcute prin Stripe, care îți trimite chitanța pe e-mail. Pentru factură pe firmă, scrie\u2011ne la ${COMPANY.email}.`,
        )}
      />
      <ul>
        {data.payments.map((p) => (
          <li key={p.id}>
            <PanelDivider />
            <div className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="type-body-sm text-fg">
                  {p.description ?? t("Online payment", "Plată online")}
                </p>
                <p className="type-micro mt-0.5 text-fg-3">{formatDay(p.createdAt, lang)}</p>
              </div>
              <p className="type-num shrink-0 text-base font-semibold text-fg">
                {formatMoney(p.amountMinor, p.currency, lang)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function BillingPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const records = useBillingRecords(user?.id);
  const sub = records?.subscription ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("Billing", "Facturare")}
        lead={t("Your plan, invoices and payments.", "Abonamentul, facturile și plățile tale.")}
      />

      <ClientPlanCard showNone />

      <Panel as="section" aria-label={t("How billing works", "Cum facturăm")}>
        <PanelBody>
          <p className="type-body-sm max-w-[64ch] text-fg-2">
            {t(
              "Plans and projects are invoiced under the signed contract, not charged to a card. For a copy of an invoice or a question about a payment, write to ",
              "Abonamentele și proiectele se facturează pe baza contractului semnat, nu se plătesc cu cardul. Pentru o copie a unei facturi sau o întrebare despre o plată, scrie-ne la ",
            )}
            <a
              href={`mailto:${COMPANY.email}`}
              className="text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
            >
              {COMPANY.email}
            </a>
            .
          </p>
        </PanelBody>
      </Panel>

      {sub ? (
        <Panel as="section" aria-labelledby="billing-card-plan">
          <PanelHeader
            titleAs="h2"
            titleId="billing-card-plan"
            title={t("Card subscription", "Abonament plătit cu cardul")}
            sub={[
              sub.tier ? sub.tier.charAt(0).toUpperCase() + sub.tier.slice(1) : null,
              sub.current_period_end
                ? t(
                    `next charge on ${formatDay(sub.current_period_end, lang)}`,
                    `următoarea plată pe ${formatDay(sub.current_period_end, lang)}`,
                  )
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <PanelBody>
            <p className="type-body-sm max-w-[64ch] text-fg-2">
              {sub.status === "past_due"
                ? t(
                    "Stripe could not take the last payment. Write to us and we will sort it out together.",
                    "Stripe nu a putut încasa ultima plată. Scrie-ne și o rezolvăm împreună.",
                  )
                : t(
                    "You started this plan by card before plans moved to contracts. To change or cancel it, write to us.",
                    "Ai pornit acest abonament cu cardul, înainte ca abonamentele să treacă pe contract. Ca să-l schimbi sau să-l anulezi, scrie-ne.",
                  )}
            </p>
          </PanelBody>
        </Panel>
      ) : null}

      {records && records.invoices.length > 0 ? (
        <InvoicesPanel invoices={records.invoices} />
      ) : null}

      <PaymentsPanel />
    </div>
  );
}

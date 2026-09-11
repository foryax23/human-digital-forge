import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

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

const statusStyles: Record<string, string> = {
  paid: "bg-teal/15 text-teal",
  sent: "bg-primary/10 text-primary",
  overdue: "bg-destructive/10 text-destructive",
  draft: "bg-muted text-muted-foreground",
};

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function BillingPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function load() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, description, amount_cents, currency, status, issued_at, due_at, paid_at",
        )
        .order("issued_at", { ascending: false });
      if (err) {
        console.error("[billing] load failed", err);
        setError(t(
          "We couldn't load your invoices. Please refresh to try again.",
          "Nu am putut încărca facturile tale. Te rugăm să reîmprospătezi pagina.",
        ));
      } else {
        setError(null);
        setInvoices((data as Invoice[]) ?? []);
      }
      setLoading(false);
    }

    void load();

    const channel = supabase
      .channel("billing-invoices")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const outstanding = invoices
    .filter((i) => i.status !== "paid" && i.status !== "draft")
    .reduce((sum, i) => sum + i.amount_cents, 0);
  const currency = invoices[0]?.currency ?? "USD";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl">{t("Billing", "Facturare")}</h1>
      <p className="mt-1 text-muted-foreground">
        {t("Invoices and payment details for your projects.", "Facturi și detalii de plată pentru proiectele tale.")}
      </p>

      {loading && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="mt-8 rounded-sm border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="mt-8 rounded-sm border border-dashed border-border bg-card p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-sm bg-primary/10 text-primary">
            <CreditCard className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-2xl">{t("No invoices yet", "Nicio factură încă")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t(
              "When your project lead issues an invoice, it will appear here with its amount, due date, and payment status.",
              "Când responsabilul de proiect emite o factură, aceasta va apărea aici cu suma, scadența și starea plății.",
            )}
          </p>
        </div>
      )}

      {!loading && !error && invoices.length > 0 && (
        <>
          {outstanding > 0 && (
            <div className="mt-8 rounded-sm border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">{t("Outstanding balance", "Sold restant")}</p>
              <p className="mt-1 text-3xl font-semibold">{formatMoney(outstanding, currency)}</p>
            </div>
          )}

          <ul className="mt-8 space-y-3">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="rounded-sm border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg">{invoice.invoice_number}</h2>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                          statusStyles[invoice.status] ?? statusStyles.draft
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </div>
                    {invoice.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{invoice.description}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("Issued", "Emisă")} {formatDate(invoice.issued_at)} · {t("Due", "Scadentă")} {formatDate(invoice.due_at)}
                      {invoice.paid_at && ` · ${t("Paid", "Plătită")} ${formatDate(invoice.paid_at)}`}
                    </p>
                  </div>
                  <p className="text-xl font-semibold">
                    {formatMoney(invoice.amount_cents, invoice.currency)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

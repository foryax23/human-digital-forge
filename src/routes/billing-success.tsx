import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/components/auth/AuthProvider";
import { formatDay, formatMoney } from "@/components/dashboard/format";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button, ButtonLink, Status, type Tone } from "@/components/system";
import { languageFromMatches, seoMeta, useI18n } from "@/i18n";
import { checkCheckoutSession, type CheckoutCheck } from "@/lib/account.functions";
import { COMPANY } from "@/lib/scan/legal/company";

/*
 * After a Stripe Checkout. The page claims nothing on its own: it reads session_id from the
 * address, asks the server to verify it with Stripe (the session exists, belongs to the
 * signed-in account and is paid) and shows what Stripe said. Without STRIPE_SECRET_KEY, or
 * for a session that is missing or someone else's, it says so in neutral words.
 */

const SEO = {
  title: { en: "Payment check | Vortex Hub", ro: "Verificarea plății | Vortex Hub" },
  description: {
    en: "We check your payment with Stripe.",
    ro: "Verificăm plata ta la Stripe.",
  },
  robots: "noindex",
};

/** Kept while the visitor signs in, so the check can run after the login brings them back. */
const PENDING_KEY = "vortex-billing-session";

export const Route = createFileRoute("/billing-success")({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = typeof search.session_id === "string" ? search.session_id.trim() : "";
    return raw && raw.length <= 300 ? { session_id: raw } : {};
  },
  head: ({ matches }) => ({
    meta: seoMeta(languageFromMatches(matches), SEO),
  }),
  component: BillingSuccessPage,
});

type View = CheckoutCheck | { status: "checking" } | { status: "signed_out" };

const POLL_MS = 4000;
const POLLS = 5;

function readPending(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function writePending(value: string | null) {
  try {
    if (value) window.sessionStorage.setItem(PENDING_KEY, value);
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* private mode: the visitor opens the link again after signing in */
  }
}

function BillingSuccessPage() {
  const { t, lang } = useI18n();
  const { user, loading } = useAuth();
  const search = Route.useSearch();
  const check = useServerFn(checkCheckoutSession);
  const [view, setView] = useState<View>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [polls, setPolls] = useState(0);
  // The address wins; else a session ID kept from before the login (which returns here
  // without it). The first render is "checking" either way, so server and browser agree.
  const [kept] = useState(() => (typeof window === "undefined" ? null : readPending()));
  const sessionId = search.session_id ?? kept;

  useEffect(() => {
    if (loading) return;
    if (!sessionId) {
      setView({ status: "invalid" });
      return;
    }
    if (!user) {
      writePending(sessionId);
      setView({ status: "signed_out" });
      return;
    }
    let live = true;
    setView((v) => (v.status === "pending" ? v : { status: "checking" }));
    check({ data: { sessionId } })
      .then((result) => {
        if (!live) return;
        writePending(null);
        setView(result);
      })
      .catch(() => live && setView({ status: "error" }));
    return () => {
      live = false;
    };
    // `check` is the server function's caller; the check reruns on these inputs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id, sessionId, attempt]);

  // A delayed payment method: ask Stripe again a few times, then leave it to the account page.
  useEffect(() => {
    if (view.status !== "pending" || polls >= POLLS) return;
    const timer = setTimeout(() => {
      setPolls((n) => n + 1);
      setAttempt((n) => n + 1);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [view.status, polls]);

  const email = (
    <a
      href={`mailto:${COMPANY.email}`}
      className="text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
    >
      {COMPANY.email}
    </a>
  );

  let tone: Tone = "neutral";
  let marker = "";
  let title = "";
  let lead: React.ReactNode = null;
  let actions: React.ReactNode = (
    <ButtonLink to="/dashboard/billing" size="lg" variant="secondary">
      {t("Go to Billing", "Mergi la Facturare")}
    </ButtonLink>
  );

  switch (view.status) {
    case "checking":
      marker = t("Checking", "Se verifică");
      title = t("We are checking your payment with Stripe.", "Verificăm plata la Stripe.");
      lead = t("This takes a few seconds.", "Durează câteva secunde.");
      actions = null;
      break;
    case "paid": {
      tone = "ok";
      marker = t("Payment confirmed", "Plată confirmată");
      title = t("Thank you. Your payment is confirmed.", "Mulțumim. Plata a fost confirmată.");
      const facts = [
        view.description,
        view.amountMinor !== null && view.currency
          ? formatMoney(view.amountMinor, view.currency, lang)
          : null,
        view.createdAt ? formatDay(view.createdAt, lang) : null,
      ].filter(Boolean);
      lead = (
        <>
          {facts.length ? <span className="block text-fg">{facts.join(" · ")}</span> : null}
          <span className="mt-2 block">
            {t(
              "Stripe e-mails you the receipt. The payment also shows in your account, under Billing.",
              "Stripe îți trimite chitanța pe e-mail. Plata apare și în contul tău, la Facturare.",
            )}
          </span>
        </>
      );
      actions = (
        <ButtonLink to="/dashboard/billing" size="lg">
          {t("Go to Billing", "Mergi la Facturare")}
        </ButtonLink>
      );
      break;
    }
    case "pending":
      tone = "warn";
      marker = t("Payment in progress", "Plată în curs");
      title = t("The payment is not confirmed yet.", "Plata nu este confirmată încă.");
      lead =
        polls >= POLLS
          ? t(
              "Some payment methods take longer. You can close this page: the payment shows under Billing once Stripe confirms it.",
              "Unele metode de plată durează mai mult. Poți închide pagina: plata apare la Facturare după ce o confirmă Stripe.",
            )
          : t(
              "Some payment methods take a little longer. We check again in a few seconds.",
              "Unele metode de plată durează puțin mai mult. Verificăm din nou în câteva secunde.",
            );
      break;
    case "expired":
      marker = t("Not completed", "Nefinalizată");
      title = t("The payment was not completed.", "Plata nu a fost finalizată.");
      lead = t(
        "The payment session expired and nothing was charged.",
        "Sesiunea de plată a expirat și nu s-a încasat nimic.",
      );
      break;
    case "signed_out":
      marker = t("Sign in needed", "Trebuie să intri în cont");
      title = t("Sign in so we can check your payment.", "Intră în cont ca să verificăm plata.");
      lead = t(
        "Use the account you paid from. You come back here after signing in.",
        "Folosește contul din care ai plătit. Revii aici după conectare.",
      );
      actions = (
        <ButtonLink to="/login" search={{ redirect: "/billing-success" }} size="lg">
          {t("Sign in", "Intră în cont")}
        </ButtonLink>
      );
      break;
    case "unconfigured":
    case "error":
      tone = "unverified";
      marker = t("Not checked", "Neverificată");
      title = t("We cannot check the payment right now.", "Nu putem verifica plata acum.");
      lead = (
        <>
          {view.status === "error"
            ? t("Try again in a few minutes. ", "Încearcă din nou peste câteva minute. ")
            : null}
          {t(
            "If the payment went through, Stripe e-mails you the receipt. For any question, write to ",
            "Dacă plata a trecut, Stripe îți trimite chitanța pe e-mail. Pentru orice întrebare, scrie-ne la ",
          )}
          {email}.
        </>
      );
      if (view.status === "error")
        actions = (
          <Button size="lg" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {t("Check again", "Verifică din nou")}
          </Button>
        );
      break;
    case "invalid":
    case "not_found":
      marker = t("No payment found", "Nicio plată găsită");
      title = t("We could not find this payment.", "Nu am găsit plata.");
      lead = (
        <>
          {t(
            "This link does not match a payment on your account. If you paid, check Billing in your account, or write to ",
            "Linkul nu corespunde unei plăți din contul tău. Dacă ai plătit, verifică pagina Facturare din cont sau scrie-ne la ",
          )}
          {email}
          {t(" with the e-mail from Stripe.", " cu e-mailul primit de la Stripe.")}
        </>
      );
      break;
  }

  return (
    <SiteLayout>
      <section className="container-vx section-y">
        <div className="max-w-2xl py-8 md:py-16" aria-live="polite">
          <Status tone={tone}>{marker}</Status>
          <h1 className="type-h2 mt-3 text-balance text-fg">{title}</h1>
          {lead ? (
            <p className="type-lead mt-3 max-w-[56ch] text-pretty text-fg-2">{lead}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-2">
            {actions}
            <ButtonLink to="/" size="lg" variant="ghost">
              {t("Back to the homepage", "Înapoi la prima pagină")}
            </ButtonLink>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

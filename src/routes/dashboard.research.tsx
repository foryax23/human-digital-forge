import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, Search, Telescope } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { DeepGate } from "@/components/deep/DeepGate";
import { fetchAccess, fetchRunList, type RunList } from "@/components/deep/transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import type { DeepAccess, RunStatus } from "@/lib/deep/contracts";

/*
 * The workspace side of "Cercetare aprofundată": one product with /scan/deep. This page
 * lists the account's reports kept on the server (Lovable's deep tables, 90 days) and
 * opens each one in /scan/deep, where the start form, the consent, the live timeline and
 * the full report live. It never runs a step itself. Access is the same server check as
 * /scan/deep (getDeepAccess): admins only for now.
 */

export const Route = createFileRoute("/dashboard/research")({
  head: () => ({
    meta: [
      { title: "Deep research | Vortex Hub" },
      { name: "description", content: "Your deep company research reports." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResearchPage,
});

type Runs = Extract<RunList, { ok: true }>["runs"];

const ACTIVE_MS = 10 * 60_000;

function ResearchPage() {
  const { t } = useI18n();
  const { user, isAdmin } = useAuth();
  const [access, setAccess] = useState<DeepAccess | null>(null);
  const [accessError, setAccessError] = useState(false);
  const [list, setList] = useState<RunList | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let live = true;
    setAccessError(false);
    fetchAccess()
      .then((value) => live && setAccess(value))
      .catch(() => live && setAccessError(true));
    void fetchRunList().then((value) => live && setList(value));
    return () => {
      live = false;
    };
  }, [user, attempt]);

  const retry = () => setAttempt((n) => n + 1);
  const runs = list?.ok ? list.runs : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl">
            <Telescope className="h-7 w-7 text-primary" aria-hidden />
            {t("Deep research", "Cercetare aprofundată")}
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {t(
              "Official registers and filed accounts, the company's website read as a new customer would, and three actions for the next 30 days. Your reports are kept here for 90 days.",
              "Registrele oficiale și bilanțurile, site-ul firmei citit ca de un client nou și trei acțiuni pentru următoarele 30 de zile. Rapoartele tale rămân aici 90 de zile.",
            )}
          </p>
        </div>
        {/* The admin panel's own check (claim_admin_role), so the link never leads to its refusal. */}
        {isAdmin ? (
          <Button asChild variant="outline">
            <Link to="/dashboard/admin">{t("All runs (admin)", "Toate rulările (admin)")}</Link>
          </Button>
        ) : null}
      </div>

      {accessError ? (
        <DeepGate reason="ledger_unavailable" onRetry={retry} />
      ) : !access ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
      ) : access.allowed ? (
        <StartCard access={access} />
      ) : (
        <DeepGate reason={access.reason ?? "admin_only"} userId={user?.id} onRetry={retry} />
      )}

      {list === null ? null : !list.ok ? (
        list.reason === "mode_disabled" ? null : (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            {t(
              "We couldn't load your reports. Please try again in a minute.",
              "Nu am putut încărca rapoartele. Încearcă din nou peste un minut.",
            )}
          </div>
        )
      ) : list.storage === "stopgap" ? (
        <p className="text-sm text-muted-foreground">
          {t(
            "Reports are kept in the browser where they were made until server storage is on.",
            "Rapoartele rămân în browserul în care au fost făcute, până pornim salvarea pe server.",
          )}{" "}
          <Link to="/scan/deep" className="text-foreground underline underline-offset-4">
            {t("Open them on the research page", "Deschide-le pe pagina cercetării")}
          </Link>
        </p>
      ) : runs.length || access?.allowed ? (
        <ReportList runs={runs} admin={list.admin} />
      ) : null}
    </div>
  );
}

/** The shortest way in: a CUI opens the start form on /scan/deep (relationship, consent, start). */
function StartCard({ access }: { access: DeepAccess }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [cui, setCui] = useState("");
  const digits = cui.trim().replace(/^RO/i, "").replace(/\s+/g, "");
  const valid = /^\d{2,10}$/.test(digits);

  function open(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    void navigate({ to: "/scan/deep", search: { cui: Number(digits) } });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-xl">{t("Start a new report", "Pornește un raport nou")}</h2>
      <form onSubmit={open} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="deep-cui">{t("Company CUI", "CUI-ul firmei")}</Label>
          <Input
            id="deep-cui"
            inputMode="numeric"
            autoComplete="off"
            placeholder="RO12345678"
            value={cui}
            onChange={(e) => setCui(e.target.value)}
            aria-describedby="deep-cui-help"
          />
        </div>
        <Button type="submit" disabled={!valid} className="h-10">
          {t("Continue", "Continuă")}
          <ArrowRight />
        </Button>
      </form>
      <p id="deep-cui-help" className="mt-3 text-sm text-muted-foreground">
        {t("Don't know the CUI?", "Nu știi CUI-ul?")}{" "}
        <Link
          to="/scan"
          className="inline-flex items-center gap-1 text-foreground underline underline-offset-4"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t("Search the company in Vortex Scan", "Caută firma în Vortex Scan")}
        </Link>
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        {access.credits && !access.admin
          ? `${t("Deep checks left:", "Verificări rămase:")} ${access.credits.left} (${access.credits.plan === "premium" ? "Premium" : t("Free", "Gratuit")}) · `
          : null}
        {t("Runs left today:", "Rulări rămase azi:")} {access.runsLeftToday}
        {access.admin ? ` · ${t("admin", "admin")}` : ""}
        {` · ${access.ai ? t("text drafted with AI", "text redactat cu AI") : t("rule-based, no AI", "pe reguli, fără AI")}`}
      </p>
    </section>
  );
}

function statusLabel(
  t: (en: string, ro: string) => string,
  status: RunStatus,
  lastActivityAt: string,
): { text: string; tone: "ok" | "wait" | "bad" } {
  switch (status) {
    case "succeeded":
      return { text: t("Ready", "Gata"), tone: "ok" };
    case "partial":
      return { text: t("Ready, with gaps", "Gata, cu goluri"), tone: "ok" };
    case "failed":
      return { text: t("Failed", "Eșuat"), tone: "bad" };
    case "canceled":
      return { text: t("Canceled", "Anulat"), tone: "bad" };
    default:
      return Date.now() - Date.parse(lastActivityAt) < ACTIVE_MS
        ? { text: t("Running", "Rulează"), tone: "wait" }
        : { text: t("Paused", "Oprită"), tone: "wait" };
  }
}

function ReportList({ runs, admin }: { runs: Runs; admin: boolean }) {
  const { t, lang } = useI18n();
  const day = (iso: string) =>
    new Date(iso).toLocaleString(lang === "ro" ? "ro-RO" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <section aria-labelledby="deep-reports">
      <h2 id="deep-reports" className="text-xl">
        {t("Your reports", "Rapoartele tale")}
      </h2>
      {runs.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          {t(
            "No reports yet. The ones you start appear here.",
            "Niciun raport încă. Cele pe care le pornești apar aici.",
          )}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {runs.map((run) => {
            const status = statusLabel(t, run.status, run.lastActivityAt);
            return (
              <li key={run.runId}>
                <Link
                  to="/scan/deep"
                  search={{ run: run.runId, cui: Number(run.cui) }}
                  className="flex min-h-14 flex-col gap-1 px-4 py-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {run.company ?? `CUI ${run.cui}`}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      CUI {run.cui} · {day(run.createdAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        status.tone === "ok"
                          ? "rounded-sm bg-brand-tint px-1.5 py-0.5 font-medium text-brand-fg"
                          : status.tone === "bad"
                            ? "rounded-sm bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive"
                            : "rounded-sm bg-muted px-1.5 py-0.5 font-medium text-foreground"
                      }
                    >
                      {status.text}
                    </span>
                    <span className="text-muted-foreground">
                      {run.aiMode === "ai"
                        ? t("AI text", "Text AI")
                        : t("Rules only", "Doar reguli")}
                    </span>
                    {admin && run.spentUsd !== undefined ? (
                      <span className="tabular-nums text-muted-foreground">
                        ${run.spentUsd.toFixed(2)}
                      </span>
                    ) : null}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

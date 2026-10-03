import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Telescope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/i18n";
import { deepStep, getDeepAccess, startDeepRun } from "@/lib/deep.functions";
import type {
  DeepAccess,
  DeepReport,
  Relationship,
  StepResult,
  SynthesisPart,
} from "@/lib/deep/contracts";

export const Route = createFileRoute("/dashboard/research")({
  head: () => ({
    meta: [
      { title: "Deep research | Vortex Hub" },
      { name: "description", content: "Run a deep company research report from your workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResearchPage,
});

const STEP_LABEL: Record<string, [string, string]> = {
  start: ["Company identity", "Identitatea firmei"],
  money: ["Financials", "Date financiare"],
  site: ["Website", "Site"],
  signals: ["Public signals", "Semnale publice"],
  peers: ["Peer comparison", "Comparație cu firme similare"],
  audit: ["Website audit", "Audit site"],
  crawl: ["Reading pages", "Citire pagini"],
  pagespeed: ["Page speed", "Viteză pagină"],
  synthesis: ["Writing the analysis", "Scrierea analizei"],
  finish: ["Building the report", "Construirea raportului"],
};

function ResearchPage() {
  const { t, lang } = useI18n();
  const fetchAccess = useServerFn(getDeepAccess);
  const start = useServerFn(startDeepRun);
  const step = useServerFn(deepStep);

  const [access, setAccess] = useState<DeepAccess | null>(null);
  const [cui, setCui] = useState("");
  const [site, setSite] = useState("");
  const [relationship, setRelationship] = useState<Relationship>("proprietar");
  const [agree, setAgree] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DeepReport | null>(null);

  useEffect(() => {
    fetchAccess({ data: {} })
      .then(setAccess)
      .catch(() => setError("ledger_unavailable"));
  }, [fetchAccess]);

  const L = (k: string) => {
    const v = STEP_LABEL[k];
    return v ? t(v[0], v[1]) : k;
  };

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    setReport(null);
    setProgress([L("start")]);
    try {
      const s = await start({
        data: {
          cui: cui.trim().toUpperCase(),
          site: site.trim() || undefined,
          relationship,
          lang,
          consent: { termsVersion: "2026-10", marketing: false },
        },
      });
      if (!s.ok) throw new Error(s.reason);
      const ticket = s.ticket;
      const results: StepResult[] = [s.identity];
      const call = async (input: Record<string, unknown>) => {
        setProgress((p) => [...p, L(String(input.step))]);
        const out = await step({ data: { ticket, ...input } as never });
        if (out.kind === "refused") return null;
        if (out.kind === "report") {
          setReport(out.report);
          return null;
        }
        results.push(out.result);
        return out.result;
      };
      const money = await call({ step: "money" });
      const siteRes = await call({ step: "site" });
      await call({ step: "signals" });
      if (money) await call({ step: "peers", money });
      if (siteRes) {
        await call({ step: "audit", site: siteRes });
        let cursor = siteRes.next?.crawlCursor;
        for (let i = 0; cursor && i < 3; i++) {
          const c = await call({ step: "crawl", site: siteRes, cursor });
          cursor = c?.next?.crawlCursor;
        }
        await call({ step: "pagespeed", site: siteRes });
      }
      if (s.aiMode === "ai") {
        for (const part of ["warm", "brief", "customer", "rivals"] as SynthesisPart[]) {
          await call({ step: "synthesis", part, results: [...results] });
        }
      }
      setProgress((p) => [...p, L("finish")]);
      const fin = await step({ data: { ticket, step: "finish", results } as never });
      if (fin.kind === "report") setReport(fin.report);
      else if (fin.kind === "refused") throw new Error(fin.reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setRunning(false);
      fetchAccess({ data: {} }).then(setAccess).catch(() => {});
    }
  }

  const reasonText = (r?: string) => {
    switch (r) {
      case "premium_required":
        return t(
          "Deep research is included in the Growth and Pro plans.",
          "Cercetarea aprofundată este inclusă în planurile Growth și Pro.",
        );
      case "daily_cap_user":
        return t("You've used today's research runs.", "Ai folosit rulările de azi.");
      case "same_company_today":
        return t("This company was already researched today.", "Firma a fost deja analizată azi.");
      case "already_running":
        return t("A research is already running.", "O cercetare rulează deja.");
      case "natural_person":
      case "not_found":
        return t("No company found for this CUI.", "Nu am găsit nicio firmă cu acest CUI.");
      case "mode_disabled":
        return t("Deep research is paused right now.", "Cercetarea este oprită momentan.");
      default:
        return t("The research could not run. Try again later.", "Cercetarea nu a putut rula. Încearcă mai târziu.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="type-title flex items-center gap-3 text-fg">
          <Telescope className="h-6 w-6 text-primary" />
          {t("Deep research", "Cercetare aprofundată")}
        </h1>
        <p className="type-body mt-2 text-fg-2">
          {t(
            "Enter a Romanian company's CUI. We read official registers, financials and the website, then build a report.",
            "Introdu CUI-ul unei firme din România. Citim registrele oficiale, datele financiare și site-ul, apoi construim raportul.",
          )}
        </p>
      </div>

      {!access ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : !access.allowed ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-fg">{reasonText(access.reason)}</p>
          {access.reason === "premium_required" && (
            <Button asChild className="mt-4">
              <Link to="/dashboard/billing">{t("See plans", "Vezi planurile")}</Link>
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={run} className="space-y-5 rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {t("Runs left today:", "Rulări rămase azi:")} {access.runsLeftToday}
            {access.admin && ` · ${t("admin", "admin")}`}
            {!access.ai && ` · ${t("rules only (no AI)", "doar reguli (fără AI)")}`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cui">CUI</Label>
              <Input
                id="cui"
                required
                pattern="(RO|ro)?\d{2,10}"
                placeholder="RO12345678"
                value={cui}
                onChange={(e) => setCui(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site">{t("Website (optional)", "Site (opțional)")}</Label>
              <Input id="site" placeholder="firma.ro" value={site} onChange={(e) => setSite(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rel">{t("Your relationship to the company", "Relația ta cu firma")}</Label>
            <select
              id="rel"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as Relationship)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="proprietar">{t("Owner", "Proprietar")}</option>
              <option value="angajat">{t("Employee", "Angajat")}</option>
              <option value="client_furnizor">{t("Client or supplier", "Client sau furnizor")}</option>
              <option value="concurent">{t("Competitor", "Concurent")}</option>
              <option value="altceva">{t("Other", "Altceva")}</option>
            </select>
          </div>
          <label className="flex items-start gap-3 text-sm text-fg-2">
            <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} />
            <span>
              {t("I agree to the ", "Sunt de acord cu ")}
              <Link to="/terms" className="text-primary underline">
                {t("terms", "termenii")}
              </Link>
              {t(" and the ", " și ")}
              <Link to="/privacy" className="text-primary underline">
                {t("privacy notice", "nota de confidențialitate")}
              </Link>
              .
            </span>
          </label>
          <Button type="submit" disabled={!agree || running || access.runsLeftToday < 1}>
            {running && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("Start research", "Pornește cercetarea")}
          </Button>
        </form>
      )}

      {progress.length > 0 && (
        <ol className="space-y-1 text-sm text-fg-2">
          {progress.map((p, i) => (
            <li key={i}>
              {i === progress.length - 1 && running ? "…" : "✓"} {p}
            </li>
          ))}
        </ol>
      )}

      {error && <p className="text-sm text-destructive">{reasonText(error)}</p>}

      {report && (
        <section className="space-y-6 rounded-xl border border-border bg-card p-6">
          <div>
            <h2 className="type-h3 text-fg">{report.company.displayName}</h2>
            <p className="text-sm text-muted-foreground">
              CUI {report.cui} · {report.company.activity[lang]}
              {report.company.city && ` · ${report.company.city}`}
            </p>
          </div>
          {report.lights.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {report.lights.map((l) => (
                <li key={l.area} className="rounded-lg border border-border p-3 text-sm">
                  <span className="font-medium text-fg">{l.label[lang]}</span>
                  <span className="ml-2 text-muted-foreground">({l.state})</span>
                  <p className="mt-1 text-fg-2">{l.reason[lang]}</p>
                </li>
              ))}
            </ul>
          )}
          {report.findings.length > 0 && (
            <div>
              <h3 className="mb-2 font-medium text-fg">{t("Key findings", "Constatări")}</h3>
              <ul className="space-y-2 text-sm">
                {report.findings.map((f) => (
                  <li key={f.id}>
                    <strong className="text-fg">{f.figure[lang]}</strong>{" "}
                    <span className="text-fg-2">{f.sentence[lang]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.actions.length > 0 && (
            <div>
              <h3 className="mb-2 font-medium text-fg">{t("Recommended actions", "Acțiuni recomandate")}</h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                {report.actions.map((a) => (
                  <li key={a.id}>
                    <span className="font-medium text-fg">{a.title[lang]}</span>
                    <p className="text-fg-2">{a.why[lang]}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {report.verifyCode && (
            <p className="text-xs text-muted-foreground">
              {t("Verification code:", "Cod de verificare:")} {report.verifyCode}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

import { Status } from "@/components/system";
import type { DeepAccess } from "@/lib/deep/contracts";
import { useI18n } from "@/i18n";

import { duration, usd } from "../format";
import type { RunTiming } from "../journal";
import { useReport } from "./context";
import { Disclosure } from "./shared";

/*
 * The admin panel (plan A10, handover): only for admins, as a collapsible strip above the
 * tabs so it is in reach on every screen. Cost so far, step timings, AI mode and why, storage
 * kind, the verifier's cut rates, today's total against the day cap (amber from 80%), the
 * runs left, the unknown-mode and unknown-model warnings. Tokens per call stay on the server.
 */

const SLOT_LABEL: Record<string, [string, string]> = {
  start: ["Registers", "Registre"],
  money: ["Money", "Bani"],
  site: ["Website", "Site"],
  site2: ["Website (answer)", "Site (răspuns)"],
  signals: ["Courts and tenders", "Instanțe și licitații"],
  peers: ["Similar firms", "Firme similare"],
  audit: ["Website audit", "Audit site"],
  crawl1: ["Pages, batch 1", "Pagini, lotul 1"],
  crawl2: ["Pages, batch 2", "Pagini, lotul 2"],
  crawl3: ["Pages, batch 3", "Pagini, lotul 3"],
  pagespeed: ["Speed test", "Test de viteză"],
  warm: ["AI warm-up", "AI, pregătire"],
  brief: ["AI, brief", "AI, pe scurt"],
  customer: ["AI, customer view", "AI, ce vede clientul"],
  rivals: ["AI, rivals", "AI, concurenți"],
  finish: ["Report", "Raport"],
};

function adminWarning(access: DeepAccess | null): boolean {
  if (!access?.admin) return false;
  return access.admin.todayUsd >= access.admin.dayCapUsd * 0.8;
}

export function AdminPanel({ forceAccess }: { forceAccess?: DeepAccess | null }) {
  const { t, lang } = useI18n();
  const ctx = useReport();
  const access = forceAccess ?? ctx.access;
  if (!access?.admin) return null;
  const { report, timings = [], activeMs } = ctx;
  const a = access.admin;
  const amber = adminWarning(access);
  const off: Record<NonNullable<typeof a.aiOff>, [string, string]> = {
    no_key: ["rules only: no Anthropic key", "doar reguli: fără cheie Anthropic"],
    day_budget: ["rules only: today's budget is used", "doar reguli: bugetul de azi e folosit"],
    breaker: [
      "rules only: paused after errors from the AI provider",
      "doar reguli: oprit după erori de la furnizorul AI",
    ],
    storage: [
      "rules only: no spend ledger on the server",
      "doar reguli: nu există registru de cost pe server",
    ],
  };
  const aiWhy =
    report.aiMode === "ai"
      ? t("AI on", "AI pornit")
      : a.aiOff
        ? t(off[a.aiOff][0], off[a.aiOff][1])
        : a.ledger === "memory_rules_only"
          ? t(
              "rules only: the test ledger is in memory",
              "doar reguli: registrul de test e în memorie",
            )
          : t("rules only", "doar reguli");
  const storage =
    access.persistence === "tables"
      ? t("on the server (tables)", "pe server (tabele)")
      : access.persistence === "stopgap"
        ? t("on the server (provisional rows)", "pe server (rânduri provizorii)")
        : t("unavailable: research cannot start", "indisponibilă: nu putem porni cercetări");
  const cut = report.brief.cut;
  const total = cut.kept + cut.byCode + cut.byEntailment;
  const rate = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");
  const rows: Array<[string, React.ReactNode]> = [
    [t("Mode", "Mod"), `${access.mode}${access.via ? ` · ${t("via", "prin")} ${access.via}` : ""}`],
    [t("AI", "AI"), aiWhy],
    [t("Storage", "Salvare"), storage],
    [t("Budget per report", "Buget pe raport"), usd(access.budgetUsd, lang)],
    [
      t("Today, all reports", "Azi, toate rapoartele"),
      <Status key="today" tone={amber ? "warn" : "ok"}>
        {usd(a.todayUsd, lang)} {t("of", "din")} {usd(a.dayCapUsd, lang)}
      </Status>,
    ],
    [t("Reports left today", "Rapoarte rămase azi"), String(access.runsLeftToday)],
    [
      t("This report", "Acest raport"),
      report.costUsd !== undefined ? usd(report.costUsd, lang, 3) : "—",
    ],
    [
      t("AI sentences", "Propoziții AI"),
      total
        ? t(
            `${cut.kept} kept · ${rate(cut.byCode)} cut by code · ${rate(cut.byEntailment)} cut by the check`,
            `${cut.kept} păstrate · ${rate(cut.byCode)} tăiate de cod · ${rate(cut.byEntailment)} tăiate la verificare`,
          )
        : t("none (rules only)", "niciuna (doar reguli)"),
    ],
  ];
  if (activeMs) rows.push([t("Running time", "Timp de lucru"), duration(activeMs, lang)]);
  return (
    <section aria-label={t("Admin", "Admin")} className="min-w-0 border-y border-line-1">
      <Disclosure
        summary={
          <span className="text-[0.9375rem] font-medium text-fg">
            {t("Admin", "Admin")}
            <span className="font-normal text-fg-3">
              {" · "}
              {report.costUsd !== undefined ? usd(report.costUsd, lang, 3) : "—"}
              {" · "}
              {report.aiMode === "ai" ? t("AI on", "AI pornit") : t("rules only", "doar reguli")}
            </span>
          </span>
        }
        meta={amber ? <Status tone="warn">{t("day cap near", "aproape de limită")}</Status> : null}
      >
        <div className="text-[0.875rem]">
          <p className="mb-2 text-[0.8125rem] text-fg-3">
            {t("Visible only to admins.", "Vizibil doar pentru admini.")}
          </p>
          {a.unknownMode ? (
            <p className="mb-2 text-warn">
              {t(
                `Unknown mode “${a.unknownMode}”, treated as admin.`,
                `Mod necunoscut: «${a.unknownMode}», tratat ca admin.`,
              )}
            </p>
          ) : null}
          {a.unknownExtractModel ? (
            <p className="mb-2 text-warn">
              {t(
                `Unknown extraction model “${a.unknownExtractModel}”, Haiku 4.5 used.`,
                `Model de extracție necunoscut: «${a.unknownExtractModel}», folosim Haiku 4.5.`,
              )}
            </p>
          ) : null}
          <dl className="sm:columns-2 sm:gap-8">
            {rows.map(([k, v]) => (
              <div
                key={k}
                className="grid break-inside-avoid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 border-t border-line-1 py-1.5"
              >
                <dt className="text-fg-3">{k}</dt>
                <dd className="min-w-0 text-fg">{v}</dd>
              </div>
            ))}
          </dl>
          {timings.length ? <Timings timings={timings} /> : null}
          <p className="mt-3 text-[0.8125rem] text-fg-3">
            {t(
              "Tokens per call are kept on the server; the browser does not receive them yet.",
              "Tokenii pe apel rămân pe server; browserul nu îi primește încă.",
            )}
          </p>
        </div>
      </Disclosure>
    </section>
  );
}

function Timings({ timings }: { timings: RunTiming[] }) {
  const { t, lang } = useI18n();
  return (
    <Disclosure
      className="mt-3 border-y border-line-1"
      summary={<span className="font-medium text-fg">{t("Step timings", "Timpi pe pași")}</span>}
    >
      <table className="mt-1 w-full text-[0.8125rem]">
        <thead>
          <tr className="border-b border-rule text-left text-fg-3">
            <th scope="col" className="py-1 font-medium">
              {t("Step", "Pas")}
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {t("Time", "Timp")}
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              ANAF
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {t("Req.", "Cereri")}
            </th>
          </tr>
        </thead>
        <tbody>
          {timings.map((x) => {
            const label =
              SLOT_LABEL[x.slot] ??
              (x.slot.startsWith("competitor:")
                ? [`Rival ${x.slot.slice(11)}`, `Concurent ${x.slot.slice(11)}`]
                : [x.slot, x.slot]);
            return (
              <tr key={x.slot} className="border-b border-line-1">
                <th scope="row" className="py-1 text-left font-normal text-fg-2">
                  {t(label[0], label[1])}
                  {x.status === "dropped" ? (
                    <span className="text-fg-3"> ({t("left out", "lăsat deoparte")})</span>
                  ) : null}
                  {x.status === "skipped" || x.status === "failed" ? (
                    <span className="text-fg-3"> ({x.status})</span>
                  ) : null}
                </th>
                <td className="type-num py-1 text-right text-fg">
                  {x.ms ? duration(x.ms, lang) : "—"}
                </td>
                <td className="type-num py-1 text-right text-fg">{x.anafCalls ?? "—"}</td>
                <td className="type-num py-1 text-right text-fg">{x.subrequests ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Disclosure>
  );
}

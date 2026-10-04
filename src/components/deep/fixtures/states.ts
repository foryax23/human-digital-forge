import type { AccessReason, DeepAccess, Fact, Lang, StepResult } from "@/lib/deep/contracts";
import { bi } from "@/lib/deep/parse/format";

import type { RunSnapshot } from "../journal";
import type { DemoSector, DemoState } from "./demo-keys";
import { demoReport, type DemoVariant } from "./demo-report";

/*
 * The ?demo= states of /scan/deep: the public sample ("exemplu", with a sector) and one state
 * per screen for the screenshot sweep (gates, form, running, the site question, every report
 * variant). Fictional data only; nothing here calls the server.
 */

export { DEMO_STATES, type DemoState } from "./demo-keys";

export const GATE_REASON: Partial<Record<DemoState, AccessReason>> = {
  "gate-oprit": "mode_disabled",
  "gate-cont": "login_required",
  "gate-email": "email_unconfirmed",
  "gate-test": "admin_only",
  "gate-cod": "code_required",
  "gate-premium": "premium_required",
  "gate-folosit": "premium_required",
  "gate-google": "premium_required",
  "gate-limita": "daily_cap_user",
  "gate-indisponibil": "ledger_unavailable",
};

/**
 * The account's deep checks behind a sample gate: "gate-folosit" is a free account whose free
 * report is used, "gate-google" an e-mail account whose free report waits for a Google
 * sign-in; the limit and storage gates keep a free report that was not spent.
 */
export const GATE_ACCESS: Partial<
  Record<DemoState, Pick<DeepAccess, "credits"> & { creditNeeds?: "google" }>
> = {
  "gate-folosit": { credits: { plan: "free", left: 0 } },
  "gate-google": { credits: { plan: "free", left: 1 }, creditNeeds: "google" },
  "gate-limita": { credits: { plan: "free", left: 1 } },
  "gate-indisponibil": { credits: { plan: "free", left: 1 } },
};

export const REPORT_VARIANT: Partial<Record<DemoState, DemoVariant>> = {
  exemplu: "ai",
  raport: "ai",
  "raport-reguli": "rules",
  "raport-partial": "partial",
  "raport-tert": "third",
  "raport-nou": "new",
};

/** A made-up account ID for the "in testing" gate (not a real account). */
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000000";

/** The access answer of a sample (the admin panel appears in the report states, not in "exemplu"). */
export function demoAccess(state: DemoState): DeepAccess {
  const admin =
    state.startsWith("raport") || state === "formular" || state === "ruleaza" || state === "site";
  const ai = state === "raport" || state === "raport-tert";
  return {
    mode: "admin",
    allowed: true,
    via: admin ? "admin" : undefined,
    ai,
    runsLeftToday: 18,
    // Today's live setup: the provisional server rows (no SQL tables yet), no Anthropic key.
    persistence: "stopgap",
    budgetUsd: 1.5,
    entryVisible: true,
    admin: admin
      ? { todayUsd: 2.1, dayCapUsd: 15, ...(ai ? {} : { aiOff: "no_key" as const }) }
      : undefined,
  };
}

const result = (
  step: StepResult["step"],
  facts: Fact[],
  ms: number,
  extra: Partial<StepResult> = {},
): StepResult => ({
  runId: "demo-run",
  step,
  status: "done",
  ms,
  facts,
  gaps: [],
  att: "demo",
  ...extra,
});

/** A run in progress for the timeline screenshots: registers, money and site done, pages being read. */
export function demoRunning(
  lang: Lang,
  which: "ruleaza" | "site" | "pauza",
  sector: DemoSector = "sanatate",
): RunSnapshot {
  const report = demoReport(sector, "ai", lang);
  const by = (test: (f: Fact) => boolean) => report.facts.filter(test);
  const identity = result(
    "start",
    by((f) => f.section === "identity"),
    1180,
  );
  const money = result(
    "money",
    by((f) => f.section === "money" || f.section === "people"),
    7940,
    {
      counters: { anafCalls: 7, yearsFiled: 7, yearsUnchecked: 0 },
    },
  );
  const siteFacts = by((f) => ["site.url", "site.status"].includes(f.id));
  const site =
    which === "site"
      ? result("site", [], 3120, {
          status: "partial",
          next: {
            askSite: {
              url: "https://clinica-dentara.example",
              reason: bi(
                "The name matches and the site is in Romanian, but we did not find the tax code on it.",
                "Numele se potrivește și site-ul e în română, dar nu am găsit CUI-ul pe el.",
              ),
            },
          },
        })
      : result("site", siteFacts, 2210);
  const peers = result(
    "peers",
    by((f) => f.section === "peers"),
    2480,
    { counters: { anafCalls: 1 } },
  );
  const audit = result(
    "audit",
    by((f) => f.id.startsWith("site.audit")),
    9120,
    {
      counters: { pagesRead: 6, sitemapUrls: 14 },
      next: { crawlCursor: "demo", cursorSha: "demo" },
    },
  );
  const now = Date.UTC(2026, 9, 3, 9, 42, 0);
  const base: RunSnapshot = {
    v: 1,
    runId: "demo-run",
    uid: DEMO_USER_ID,
    cui: report.cui,
    name: report.company.displayName,
    relationship: "proprietar",
    lang,
    aiMode: "rules",
    store: "stopgap",
    ticket: "demo",
    createdAt: now - 42_000,
    updatedAt: now,
    activeMs: 42_000,
    results: { start: identity, money, site },
    order: ["start", "money", "site"],
    slots: {
      start: { status: "done", ms: 1180, at: now },
      money: { status: "done", ms: 7940, at: now },
      site: { status: which === "site" ? "partial" : "done", ms: 2210, at: now },
      signals: { status: "running", at: now },
    },
    status: "running",
    corrections: [],
    rivalEdits: { removed: [], added: [] },
    timings: [],
  };
  if (which === "site") {
    return {
      ...base,
      results: { ...base.results, peers },
      order: [...base.order, "peers"],
      slots: { ...base.slots, peers: { status: "done", ms: 2480, at: now } },
      askSite: {
        url: "https://clinica-dentara.example",
        reason: site.next!.askSite!.reason,
      },
    };
  }
  return {
    ...base,
    results: {
      ...base.results,
      peers,
      audit,
      "competitor:22222220": result(
        "competitor",
        by((f) => f.id === "competitors.site.22222220"),
        3900,
      ),
    },
    order: [...base.order, "peers", "audit", "competitor:22222220"],
    slots: {
      ...base.slots,
      peers: { status: "done", ms: 2480, at: now },
      audit: { status: "done", ms: 9120, at: now },
      crawl1: { status: which === "pauza" ? "done" : "running", at: now },
      pagespeed: { status: "running", at: now },
      "competitor:22222220": { status: "done", ms: 3900, at: now },
      "competitor:33333330": { status: "running", at: now },
      "competitor:44444440": { status: "running", at: now },
    },
  };
}

export function demoReportFor(state: DemoState, sector: DemoSector, lang: Lang) {
  const variant = REPORT_VARIANT[state];
  return variant ? demoReport(sector, variant, lang) : null;
}

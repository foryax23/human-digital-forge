import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { resetAnafIsolateClock } from "../../../src/lib/deep/anaf-pacer.server";
import type { DeepReport } from "../../../src/lib/deep/contracts";
import { virtualClock } from "../steps/helpers";
import { engine, START, UID } from "./engine-fixture";

/*
 * The report view rendered on the server (renderToStaticMarkup): the sample variants and a
 * real report from the engine (rules-only, Expres Transport on a scripted network), so the UI
 * is proven against the engine's own output, not only against the fixtures. CSS modules are
 * stubbed by a loader hook (Vite handles them in the app).
 */

register(
  "data:text/javascript," +
    encodeURIComponent(
      `export async function load(url, context, next) {
        if (url.endsWith(".css")) return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
        return next(url, context);
      }`,
    ),
);

const { LanguageProvider } = await import("../../../src/i18n");
const { ReportContext } = await import("../../../src/components/deep/report/context");
const { DeepReportView } = await import("../../../src/components/deep/report/DeepReportView");
const { DeepTimeline } = await import("../../../src/components/deep/DeepTimeline");
const { demoReport } = await import("../../../src/components/deep/fixtures/demo-report");
const { demoRunning } = await import("../../../src/components/deep/fixtures/states");
const { continueRun, startRun } = await import("../../../src/components/deep/runner");

function render(
  report: DeepReport,
  access: unknown = null,
  tab: "pe-scurt" | "cifre" | "dovezi" = "pe-scurt",
) {
  const ctx = {
    report,
    official: report,
    sample: true,
    access,
    corrections: [],
    rivalEdits: { removed: [], added: [] },
    onCorrect: () => undefined,
    onOwnerInputs: () => undefined,
    onRemoveRival: () => undefined,
    onAddRival: () => undefined,
    onFeedback: async () => "sample" as const,
    onEvent: () => undefined,
    onCallRequest: async () => true,
    goTo: () => undefined,
  };
  return renderToStaticMarkup(
    h(
      LanguageProvider,
      null,
      h(
        ReportContext.Provider,
        { value: ctx as never },
        h(DeepReportView, { tab, onTab: () => undefined }),
      ),
    ),
  );
}

test("the owner's report: figures, five lines, the next step, actions and the call", () => {
  const html = render(demoReport("sanatate", "ai", "en"));
  for (const text of [
    "In short",
    "Turnover",
    "What to do now",
    "What to do in the next 30 days",
    "A free 30-minute call with Mihai Dandea",
    "Let&#x27;s talk",
  ])
    assert.ok(html.includes(text), text);
  assert.ok((html.match(/viewBox="0 0 12 12"/g) ?? []).length >= 5, "five line shapes");
  assert.ok(html.includes("aria-live") === false, "no live region in a finished report");
  assert.ok(!/\b\d{1,3}\/100\b/.test(html), "no scores");
});

test("the third-party report: due diligence instead of actions, no Vortex offer", () => {
  const html = render(demoReport("sanatate", "third", "en"));
  assert.ok(html.includes("What to check before working with them"));
  assert.equal(html.includes("What to do in the next 30 days"), false);
  assert.equal(html.includes("A free 30-minute call"), false);
  assert.equal(html.includes("Let&#x27;s talk"), false);
});

test("the new firm, the rules-only and the partial report render their own wording", () => {
  assert.ok(
    render(demoReport("sanatate", "new", "en")).includes("A typical firm in your activity"),
  );
  assert.ok(render(demoReport("sanatate", "partial", "en")).includes("Partial report"));
  assert.ok(render(demoReport("restaurant", "rules", "en")).includes("Rule-based analysis, no AI"));
});

test("the Figures and Evidence tabs render their tables, legend and sources", () => {
  const r = demoReport("sanatate", "ai", "en");
  const figures = render(r, null, "cifre");
  assert.ok(
    figures.includes("Money over the years") && figures.includes("Compared with similar firms"),
  );
  assert.ok(figures.includes("<table"), "a table on wide screens");
  const evidence = render(r, null, "dovezi");
  for (const text of [
    "How sure we are",
    "Confirmed",
    "Likely",
    "Calculated",
    "Estimate",
    "What we could not check",
    "Sources",
    "Export as CSV",
  ])
    assert.ok(evidence.includes(text), text);
});

test("the admin panel shows for admins only", () => {
  const r = demoReport("sanatate", "rules", "en");
  const admin = {
    mode: "admin",
    allowed: true,
    via: "admin",
    ai: false,
    runsLeftToday: 18,
    persistence: "unavailable",
    budgetUsd: 1.5,
    entryVisible: true,
    admin: { todayUsd: 12.5, dayCapUsd: 15, ledger: "memory_rules_only" },
  };
  // A collapsible strip above the tabs: the summary shows; the table opens on tap.
  const html = render(r, admin);
  assert.ok(html.includes('aria-label="Admin"'), "the admin strip");
  assert.ok(html.includes("day cap near"), "amber from 80%");
  assert.equal(
    render(r, { ...admin, admin: undefined, via: "open" }).includes('aria-label="Admin"'),
    false,
  );
});

test("the timeline renders real stages and the site question", () => {
  const timeline = renderToStaticMarkup(
    h(
      LanguageProvider,
      null,
      h(DeepTimeline, { snap: demoRunning("en", "ruleaza"), ask: null, onAnswer: () => undefined }),
    ),
  );
  for (const text of [
    "Official registers",
    "Money over 7 years",
    "of 9 steps",
    "Keep this page open",
    "aria-live",
  ])
    assert.ok(timeline.includes(text), text);
  const ask = demoRunning("en", "site");
  const asking = renderToStaticMarkup(
    h(
      LanguageProvider,
      null,
      h(DeepTimeline, { snap: ask, ask: ask.askSite!, onAnswer: () => undefined }),
    ),
  );
  assert.ok(asking.includes("Is this the company&#x27;s website?"));
});

test("a real engine report renders in every tab", async () => {
  resetAnafIsolateClock();
  const clock = virtualClock();
  const { transport } = engine(clock);
  const started = await startRun(transport, START, UID, clock.now);
  assert.equal(started.ok, true);
  if (!started.ok) return;
  const done = await continueRun(
    {
      transport,
      now: clock.now,
      sleep: clock.sleep,
      timer: () => new Promise<void>(() => undefined),
      askSite: async () => null,
      onChange: () => undefined,
    },
    started.snap,
  );
  assert.equal(done.status, "done");
  const report = done.report!;
  for (const tab of ["pe-scurt", "cifre", "dovezi"] as const) {
    const html = render(report, null, tab);
    assert.ok(html.length > 2000, tab);
  }
  const brief = render(report);
  assert.ok(
    brief.includes("Rule-based analysis, no AI") || brief.includes("Text drafted with AI"),
    "the AI or rules label",
  );
  assert.ok(brief.includes("13M"), "the official turnover in the figures strip");
});

test("the third-party report never addresses the reader as the owner, in any tab", () => {
  const r = demoReport("sanatate", "third", "en");
  for (const tab of ["pe-scurt", "cifre", "dovezi"] as const) {
    const html = render(r, null, tab);
    for (const owner of ["above yours", "You: ", "You collect", "If you do nothing", "(you: "])
      assert.equal(html.includes(owner), false, `${tab}: ${owner}`);
  }
  // The PDF says "Dacă tendința continuă" for everyone (no "Dacă nu faci nimic").
  const pdf = readFileSync(
    new URL("../../../src/components/deep/pdf/pages-brief.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(pdf.includes("Dacă nu faci nimic"), false);
});

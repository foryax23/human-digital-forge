import type {
  AccessVia,
  ConsentRecord,
  DeepReport,
  DeepStepInput,
  DeepStore,
  StartDeepRunInput,
  StepResult,
} from "../contracts";
import type { TicketPayload } from "../ticket.server";

import { engineStart, engineStep, type EngineDeps } from "./dispatch.server";

/*
 * An in-process run in the browser runner's order (plan A5), for the tests and
 * the golden script. It goes through the same engineStart/engineStep as the
 * server functions, so attestation, pacing and limits are exercised exactly as
 * in production. Eng 2's useDeepResearch.ts follows the same order:
 *   start → money ‖ site ‖ signals → peers (after money) → audit, crawl…
 *   and pagespeed (after site) → competitors ×3 (after peers) →
 *   synthesis warm → brief ‖ customer ‖ rivals (each given the warm result
 *   too) → finish.
 */

export type StepTiming = {
  step: string;
  part?: string;
  status: string;
  ms: number;
  anafCalls: number;
  subrequests: number;
  facts: number;
};

export type PipelineResult = {
  ok: boolean;
  refused?: string;
  runId?: string;
  results: StepResult[];
  timings: StepTiming[];
  report?: DeepReport;
  reportAtt?: string;
  wallMs: number;
};

export async function runPipeline(opts: {
  deps: EngineDeps;
  uid: string;
  via: AccessVia;
  store: DeepStore;
  storeKind: TicketPayload["store"];
  input: StartDeepRunInput;
  consent: ConsentRecord;
  /** Answer to "Acesta e site-ul firmei?" (null: no answer, the crawl is skipped). */
  answerSite?: (url: string) => boolean | null;
  maxCompetitors?: number;
  now?: () => number;
}): Promise<PipelineResult> {
  const now = opts.now ?? (() => Date.now());
  const t0 = now();
  const timings: StepTiming[] = [];
  const results: StepResult[] = [];
  const record = (r: StepResult) => {
    results.push(r);
    timings.push({
      step: r.step,
      part: r.part,
      status: r.status,
      ms: r.ms,
      anafCalls: r.counters?.anafCalls ?? 0,
      subrequests: r.counters?.subrequests ?? 0,
      facts: r.facts.length,
    });
    return r;
  };
  const started = await engineStart(opts.deps, {
    uid: opts.uid,
    via: opts.via,
    input: opts.input,
    store: opts.store,
    storeKind: opts.storeKind,
    consent: opts.consent,
    userCap: 20,
  });
  if (!started.ok)
    return { ok: false, refused: started.reason, results, timings, wallMs: now() - t0 };
  const ticket = started.ticket;
  record(started.identity);
  const step = async (input: DeepStepInput): Promise<StepResult | null> => {
    const out = await engineStep(opts.deps, { uid: opts.uid, input });
    if (out.kind !== "step") return null;
    return record(out.result);
  };

  const moneyP = step({ ticket, step: "money", anafNextAt: started.identity.next?.anafNextAt });
  const signalsP = step({ ticket, step: "signals" });
  const siteFlow = (async () => {
    let site = await step({ ticket, step: "site" });
    if (site?.next?.askSite && opts.answerSite) {
      const answer = opts.answerSite(site.next.askSite.url);
      if (answer !== null)
        site = await step({
          ticket,
          step: "site",
          answer: { url: site.next.askSite.url, yes: answer },
        });
    }
    if (!site) return;
    const pagespeedP = step({ ticket, step: "pagespeed", site });
    const audit = await step({ ticket, step: "audit", site });
    let cursor = audit?.next?.crawlCursor;
    for (let batch = 0; cursor && batch < 3; batch++) {
      const crawl = await step({ ticket, step: "crawl", site, cursor });
      cursor = crawl?.next?.crawlCursor;
    }
    await pagespeedP;
  })();
  const peersFlow = (async () => {
    const money = await moneyP;
    if (!money) return;
    const peers = await step({ ticket, step: "peers", money, anafNextAt: money.next?.anafNextAt });
    if (!peers) return;
    const rivals = peers.facts
      .filter((f) => f.predicate === "peers.rival")
      .map((f) => f.value as { cui: string; website?: string })
      .sort((a, b) => Number(Boolean(b.website)) - Number(Boolean(a.website)))
      .slice(0, opts.maxCompetitors ?? 3);
    await Promise.all(rivals.map((r) => step({ ticket, step: "competitor", peers, cui: r.cui })));
  })();
  await Promise.all([signalsP, siteFlow, peersFlow]);

  const collected = [...results];
  const warm = await step({ ticket, step: "synthesis", part: "warm", results: collected });
  // The sections get the warm-up result too: an attested cache write lets them reserve the
  // prefix at the cache-read price (without it they reserve the cache-write worst case).
  const sectionResults = warm ? [...collected, warm] : collected;
  await Promise.all(
    (["brief", "customer", "rivals"] as const).map((part) =>
      step({ ticket, step: "synthesis", part, results: sectionResults }),
    ),
  );
  const finishStarted = now();
  const done = await engineStep(opts.deps, {
    uid: opts.uid,
    input: {
      ticket,
      step: "finish",
      results: results.filter((r) => r.step !== "synthesis" || r.part !== "warm"),
    },
  });
  timings.push({
    step: "finish",
    status: done.kind === "report" ? "done" : "failed",
    ms: now() - finishStarted,
    anafCalls: 0,
    subrequests: 0,
    facts: done.kind === "report" ? done.report.facts.length : 0,
  });
  if (done.kind !== "report")
    return {
      ok: false,
      refused: done.kind === "refused" ? done.reason : "no_report",
      runId: started.runId,
      results,
      timings,
      wallMs: now() - t0,
    };
  return {
    ok: true,
    runId: started.runId,
    results,
    timings,
    report: done.report,
    reportAtt: done.reportAtt,
    wallMs: now() - t0,
  };
}

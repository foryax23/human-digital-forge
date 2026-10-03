import type {
  AccessReason,
  DeepAccess,
  DeepReport,
  DeepStepInput,
  DeepStepOutput,
  FeedbackKind,
  Lang,
  StartDeepRunInput,
  StartDeepRunOutput,
} from "@/lib/deep/contracts";
import {
  deepStep,
  getDeepAccess,
  listDeepRuns,
  loadDeepRun,
  logDeepEvent,
  reportDeepIssue,
  requestDeepCall,
  resumeDeepRun,
  startDeepRun,
  verifyDeepReport,
} from "@/lib/deep.functions";

import type { DeepTransport } from "./runner";

/*
 * The server functions of deep research (src/lib/deep.functions.ts, Eng 1) behind the
 * runner's transport and the page's small calls. The bearer token is attached by the global
 * function middleware (src/start.ts). Nothing here runs on the server render: every call
 * starts after hydration, so crawlers can never trigger ANAF calls.
 */

export const serverTransport: DeepTransport = {
  start: (input: StartDeepRunInput) => startDeepRun({ data: input }) as Promise<StartDeepRunOutput>,
  step: (input: DeepStepInput) => deepStep({ data: input }) as Promise<DeepStepOutput>,
  resume: (input) => resumeDeepRun({ data: input }),
};

export function fetchAccess(testCode?: string): Promise<DeepAccess> {
  return getDeepAccess({ data: testCode ? { testCode } : undefined });
}

type Result = { ok: true } | { ok: false; reason: AccessReason };

/** The account's research runs kept on the server (the dashboard's "Deep research" list). */
export type RunList = Awaited<ReturnType<typeof listDeepRuns>>;
export async function fetchRunList(): Promise<RunList> {
  try {
    return await listDeepRuns();
  } catch {
    return { ok: false, reason: "ledger_unavailable" };
  }
}

/** Feedback, corrections, rival edits, the price question: refused without server storage. */
export async function sendFeedback(row: {
  runId: string;
  kind: FeedbackKind;
  factId?: string;
  message?: string;
  value?: unknown;
}): Promise<Result> {
  try {
    return await reportDeepIssue({ data: row });
  } catch {
    return { ok: false, reason: "ledger_unavailable" };
  }
}

/** "Sună-mă": a call request the person asked for (refused, never dropped, without storage). */
export async function sendCallRequest(row: {
  runId: string;
  phone: string;
  when: "dimineata" | "dupa_amiaza";
  lang: Lang;
}): Promise<Result> {
  try {
    return await requestDeepCall({ data: row });
  } catch {
    return { ok: false, reason: "ledger_unavailable" };
  }
}

/** Client events, batched (≤ 50 per run): counters only, no third-party analytics. */
export async function sendEvents(runId: string, events: Array<{ name: string; at: string }>) {
  if (!events.length) return;
  try {
    await logDeepEvent({ data: { runId, events: events.slice(0, 50) } });
  } catch {
    /* counters only: a lost batch is fine */
  }
}

/** A report stored on the server (tables only); null when there is none or no storage. */
export async function fetchStoredRun(
  runId: string,
): Promise<{ report: DeepReport; reportAtt: string } | null> {
  try {
    const out = await loadDeepRun({ data: { runId } });
    return out.ok ? { report: out.report, reportAtt: out.reportAtt } : null;
  } catch {
    return null;
  }
}

/** /scan/deep?verify=<code>: company, date and time of a PDF's report (tables only). */
export async function verifyCode(
  code: string,
): Promise<
  | { ok: true; company: string; cui: string; generatedAt: string }
  | { ok: false; reason: "not_found" | "ledger_unavailable" }
> {
  try {
    return await verifyDeepReport({ data: { code } });
  } catch {
    return { ok: false, reason: "ledger_unavailable" };
  }
}

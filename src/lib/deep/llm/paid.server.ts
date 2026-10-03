import type { DeepStore, ReserveResult, StepName } from "../contracts";

import { ENTAIL_HEADROOM_USD, fitMaxTokens, reservationUsd, type CallPlan } from "./budget";
import { costOfUsage, usageTotals } from "./prices";
import { LlmError, type LlmMessage } from "./types";

/*
 * Every paid call goes through here (plan A4, A7, D15, D16):
 * reserve the worst case in the ledger first (run budget and day budget,
 * admins included), send only when the reservation is accepted, settle with
 * the real cost from usage.iterations, and replay a settled result under the
 * same idempotency key instead of paying twice. Any ledger error means the
 * call is not sent. Billing and spend-limit errors trip the breaker for all
 * runs (15 minutes); a 429/529 for load gets one manual retry with a fresh
 * reservation when the step has time left.
 */

export type PaidLedger = {
  reserve: DeepStore["reserve"];
  settle: DeepStore["settle"];
  tripBreaker: DeepStore["tripBreaker"];
  runSpend?: DeepStore["runSpend"];
  dayCapUsd: number;
};

export type PaidCall = {
  ledger: PaidLedger;
  runId: string;
  step: StepName;
  idemKey: string;
  plan: CallPlan;
  /** Smallest max_tokens worth sending (sections: 2,000). */
  floor: number;
  /** Leave room for the finish-time entailment check. */
  keepHeadroom?: boolean;
  exec: (maxTokens: number) => Promise<LlmMessage>;
  /** What to store with the settlement for replay (sections). */
  toReplay?: (message: LlmMessage) => unknown;
  deadline: number;
  now: () => number;
  log?: (event: Record<string, unknown>) => void;
};

export type PaidOutcome =
  | { kind: "ok"; message: LlmMessage; usd: number; maxTokens: number; reservedUsd: number }
  | { kind: "replay"; result: unknown }
  | { kind: "refused"; reason: Exclude<ReserveResult, { ok: true }>["reason"] | "too_small" }
  | { kind: "error"; error: LlmError };

const MIN_RETRY_MS = 15_000;

export async function paidCall(call: PaidCall): Promise<PaidOutcome> {
  let maxTokens = call.plan.maxTokens;
  if (call.ledger.runSpend) {
    try {
      const spend = await call.ledger.runSpend(call.runId);
      if (spend) {
        const available =
          spend.budgetUsd -
          spend.spentUsd -
          spend.reservedUsd -
          (call.keepHeadroom ? ENTAIL_HEADROOM_USD : 0);
        const fitted = fitMaxTokens(call.plan, available, call.floor);
        if (fitted === null) return { kind: "refused", reason: "too_small" };
        maxTokens = fitted;
      }
    } catch {
      return { kind: "refused", reason: "ledger_error" };
    }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    // Reserve, shrinking max_tokens when only the run budget is short.
    let reserved: ReserveResult | null = null;
    let usd = 0;
    for (let shrink = 0; shrink < 3; shrink++) {
      usd =
        reservationUsd({ ...call.plan, maxTokens }) + (call.keepHeadroom ? ENTAIL_HEADROOM_USD : 0);
      try {
        reserved = await call.ledger.reserve({
          runId: call.runId,
          idemKey: call.idemKey,
          kind: "llm",
          step: call.step,
          model: call.plan.model,
          usd: Math.round(usd * 1e6) / 1e6,
          dayCapUsd: call.ledger.dayCapUsd,
        });
      } catch {
        reserved = { ok: false, reason: "ledger_error" };
      }
      if (reserved.ok || reserved.reason !== "run_budget") break;
      const smaller = Math.floor(maxTokens / 2);
      if (smaller < call.floor) break;
      maxTokens = smaller;
    }
    if (!reserved) return { kind: "refused", reason: "ledger_error" };
    if (!reserved.ok) {
      if (reserved.reason === "replay") return { kind: "replay", result: reserved.result };
      call.log?.({ paid: call.idemKey, refused: reserved.reason });
      return { kind: "refused", reason: reserved.reason };
    }
    const callId = reserved.callId;
    const started = call.now();
    try {
      const message = await call.exec(maxTokens);
      const cost = costOfUsage(message.usage, call.plan.model);
      try {
        await call.ledger.settle({
          callId,
          usd: Math.round(cost * 1e6) / 1e6,
          usage: usageTotals(message.usage),
          result: call.toReplay?.(message),
        });
      } catch (error) {
        // The reservation stays and counts as spent at finish: never under-counted.
        call.log?.({ paid: call.idemKey, settleError: String(error) });
      }
      call.log?.({
        paid: call.idemKey,
        model: message.model,
        usd: Number(cost.toFixed(5)),
        reserved: Number(usd.toFixed(5)),
        ms: call.now() - started,
        stop: message.stop_reason,
      });
      return { kind: "ok", message, usd: cost, maxTokens, reservedUsd: usd };
    } catch (raw) {
      const error =
        raw instanceof LlmError
          ? raw
          : new LlmError("other", String((raw as Error)?.message ?? raw));
      call.log?.({
        paid: call.idemKey,
        error: error.kind,
        status: error.status,
        ms: call.now() - started,
      });
      if (error.tripsBreaker) {
        await call.ledger
          .tripBreaker(15, `${error.kind}: ${error.message}`.slice(0, 200))
          .catch(() => undefined);
      }
      if (error.billedNothing) {
        // Settled at 0 so a retry under the same key is not blocked as in flight.
        await call.ledger
          .settle({
            callId,
            usd: 0,
            usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
          })
          .catch(() => undefined);
        if (error.retryable && attempt === 0 && call.deadline - call.now() > MIN_RETRY_MS) continue;
      }
      // Timeouts and cut streams stay reserved: counted as spent at finish.
      return { kind: "error", error };
    }
  }
  return { kind: "refused", reason: "attempts" };
}

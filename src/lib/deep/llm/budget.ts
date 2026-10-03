import { FALLBACK_PRICE, costOfTokens, priceFor } from "./prices";

/*
 * Worst-case reservations (plan A4, A7, D15). Every paid call reserves, before
 * it is sent: the primary attempt at full max_tokens plus, when a server-side
 * fallback can run, a second attempt on the most expensive allowed fallback
 * model (no cache there: caches are per model). max_tokens shrinks to fit what
 * the run has left; under the floor the section uses its rules template
 * instead of a call that would be cut off.
 */

export type CallPlan = {
  model: string;
  /** Input tokens billed at the full input price. */
  inputTokens: number;
  /** Input tokens expected from the cache (sections after the warm-up). */
  cachedTokens?: number;
  /** Input tokens written to the cache (the warm-up). */
  cacheWriteTokens?: number;
  maxTokens: number;
  /** fallbacks: "default" is on: a declined attempt can re-run on a fallback model. */
  fallback: boolean;
};

export function reservationUsd(plan: CallPlan): number {
  const primary = costOfTokens(priceFor(plan.model), {
    input: plan.inputTokens,
    output: plan.maxTokens,
    cacheRead: plan.cachedTokens ?? 0,
    cacheWrite: plan.cacheWriteTokens ?? 0,
  });
  if (!plan.fallback) return primary;
  const allInput = plan.inputTokens + (plan.cachedTokens ?? 0) + (plan.cacheWriteTokens ?? 0);
  return primary + costOfTokens(FALLBACK_PRICE, { input: allInput, output: plan.maxTokens });
}

/** Characters ÷ 3 plus 15% (Haiku requests are not counted with countTokens). */
export function estimateTokens(chars: number): number {
  return Math.ceil((chars / 3) * 1.15);
}

/**
 * The largest max_tokens ≤ plan.maxTokens whose reservation fits `availableUsd`,
 * or null when even `floor` tokens do not fit.
 */
export function fitMaxTokens(plan: CallPlan, availableUsd: number, floor: number): number | null {
  if (reservationUsd(plan) <= availableUsd) return plan.maxTokens;
  const fixed = reservationUsd({ ...plan, maxTokens: 0 });
  const perToken = (reservationUsd({ ...plan, maxTokens: 1000 }) - fixed) / 1000;
  if (perToken <= 0) return null;
  const tokens = Math.floor((availableUsd - fixed) / perToken);
  return tokens >= floor ? Math.min(tokens, plan.maxTokens) : null;
}

/** Headroom every section leaves for the finish-time entailment check (≈ $0.02). */
export const ENTAIL_HEADROOM_USD = 0.03;
/** Below this, a section uses its rules template (a shorter call would be cut off). */
export const SECTION_MIN_TOKENS = 2000;
export const SECTION_MAX_TOKENS = 4000;
export const EXTRACT_MAX_TOKENS = 3000;
export const ENTAIL_MAX_TOKENS = 1500;
/** Page text sent to extraction in one run (plan A7). */
export const EXTRACT_RUN_TOKEN_CAP = 40_000;

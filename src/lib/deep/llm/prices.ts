import type { LlmUsage, LlmUsageIteration } from "./types";

/*
 * One price table (USD per million tokens), plan A7. Cache writes cost 1.25×
 * input (5-minute TTL). An unknown model in a usage entry is priced at the
 * highest rate in the table, so a surprise never under-counts spend.
 */

export type ModelPrice = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWriteFactor: number;
};

export const PRICES: Record<string, ModelPrice> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWriteFactor: 1.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWriteFactor: 1.25 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5, cacheRead: 0.1, cacheWriteFactor: 1.25 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWriteFactor: 1.25 },
  // Server-side fallback models (fallbacks: "default").
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWriteFactor: 1.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWriteFactor: 1.25 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWriteFactor: 1.25 },
};

/** The most expensive allowed fallback (Opus 5 / Opus 4.8). */
export const FALLBACK_PRICE: ModelPrice = PRICES["claude-opus-5"];

const HIGHEST: ModelPrice = Object.values(PRICES).reduce((max, p) =>
  p.input + p.output > max.input + max.output ? p : max,
);

/** Cache prefixes shorter than this are not cached (Opus/Sonnet 5.5: 512, Haiku 4.5: 4096). */
export const CACHE_MIN_TOKENS: Record<string, number> = {
  "claude-opus-5-5": 512,
  "claude-sonnet-5-5": 512,
  "claude-haiku-4-5-20251001": 4096,
};

export function priceFor(model: string | null | undefined): ModelPrice {
  if (!model) return HIGHEST;
  const exact = PRICES[model];
  if (exact) return exact;
  // Dated or aliased ids: the longest table key that prefixes the id.
  const key = Object.keys(PRICES)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? PRICES[key] : HIGHEST;
}

const PER = 1_000_000;

export function costOfTokens(
  price: ModelPrice,
  t: { input: number; output: number; cacheRead?: number; cacheWrite?: number },
): number {
  return (
    (t.input * price.input +
      t.output * price.output +
      (t.cacheRead ?? 0) * price.cacheRead +
      (t.cacheWrite ?? 0) * price.input * price.cacheWriteFactor) /
    PER
  );
}

function iterationCost(entry: LlmUsageIteration, fallbackModel: string): number {
  return costOfTokens(priceFor(entry.model ?? fallbackModel), {
    input: entry.input_tokens ?? 0,
    output: entry.output_tokens ?? 0,
    cacheRead: entry.cache_read_input_tokens ?? 0,
    cacheWrite: entry.cache_creation_input_tokens ?? 0,
  });
}

/**
 * Real cost of a response: the sum over usage.iterations (the top-level usage
 * covers only the final attempt), each priced by its own model.
 */
export function costOfUsage(usage: LlmUsage, requestModel: string): number {
  const iterations = usage.iterations ?? [];
  if (iterations.length)
    return iterations.reduce((sum, entry) => sum + iterationCost(entry, requestModel), 0);
  return costOfTokens(priceFor(requestModel), {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
  });
}

/** Token totals across iterations, for the ledger's usage columns. */
export function usageTotals(usage: LlmUsage) {
  const entries = usage.iterations?.length
    ? usage.iterations
    : [usage as unknown as LlmUsageIteration];
  return entries.reduce(
    (t, e) => ({
      inputTokens: t.inputTokens + (e.input_tokens ?? 0),
      outputTokens: t.outputTokens + (e.output_tokens ?? 0),
      cacheReadTokens: t.cacheReadTokens + (e.cache_read_input_tokens ?? 0),
      cacheWriteTokens: t.cacheWriteTokens + (e.cache_creation_input_tokens ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  );
}

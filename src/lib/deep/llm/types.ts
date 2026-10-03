/*
 * The LLM layer's own message shapes (a structural subset of the Anthropic SDK
 * types), so the pure parts (budget, documents, verifier) and the tests never
 * import the SDK. llm/anthropic.server.ts adapts the real client to
 * LlmTransport; tests pass a fake one.
 */

export type LlmCitation = {
  type: string;
  cited_text?: string;
  document_index?: number;
  document_title?: string | null;
  start_block_index?: number;
  end_block_index?: number;
};

export type LlmBlock =
  | { type: "text"; text: string; citations?: LlmCitation[] | null }
  | { type: "thinking"; thinking?: string }
  | { type: "redacted_thinking" }
  | { type: "fallback"; from?: { model: string }; to?: { model: string } }
  | { type: string; [key: string]: unknown };

export type LlmUsageIteration = {
  type: string;
  model?: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

export type LlmUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  iterations?: LlmUsageIteration[] | null;
};

export type LlmMessage = {
  id?: string;
  model: string;
  content: LlmBlock[];
  stop_reason: string | null;
  usage: LlmUsage;
  /** messages.parse only. */
  parsed_output?: unknown;
};

/** Request bodies are passed through unchanged; their shape follows the Messages API. */
export type LlmRequest = Record<string, unknown> & { model: string; max_tokens: number };

export type LlmCallOptions = { signal?: AbortSignal; timeoutMs?: number };

export interface LlmTransport {
  /** messages.parse with output_config.format (Haiku extraction and entailment). */
  parse(body: LlmRequest & { schema: unknown }, opts?: LlmCallOptions): Promise<LlmMessage>;
  /** beta.messages.create, not streamed (the max_tokens: 0 cache warm-up). */
  create(body: LlmRequest, opts?: LlmCallOptions): Promise<LlmMessage>;
  /** beta.messages.stream(...).finalMessage() (synthesis sections). */
  stream(body: LlmRequest, opts?: LlmCallOptions): Promise<LlmMessage>;
  /** beta.messages.countTokens (free). */
  countTokens(body: Omit<LlmRequest, "max_tokens">): Promise<number>;
}

/** Errors the transport raises, normalised from the SDK's typed errors. */
export class LlmError extends Error {
  constructor(
    readonly kind:
      | "billing"
      | "rate_limit"
      | "overloaded"
      | "invalid_request"
      | "authentication"
      | "timeout"
      | "network"
      | "server"
      | "other",
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
  /** Billing (402) and spend-limit errors trip the breaker for every run. */
  get tripsBreaker(): boolean {
    return this.kind === "billing";
  }
  /** One manual retry with a fresh reservation (429 or 529 for load). */
  get retryable(): boolean {
    return this.kind === "rate_limit" || this.kind === "overloaded";
  }
  /** A request rejected before running bills nothing; a cut stream may have. */
  get billedNothing(): boolean {
    return ["billing", "rate_limit", "overloaded", "invalid_request", "authentication"].includes(
      this.kind,
    );
  }
}

export type LlmModels = { synthesis: string; extraction: string; effort: "low" | "medium" };

/** What a step receives as env.llm (null = rules-only). */
export type LlmClient = {
  transport: LlmTransport;
  models: LlmModels;
  /** Rebuilds the transport on the step's counted fetch (every subrequest counts). */
  bindFetch?: (fetch: (input: string, init?: RequestInit) => Promise<Response>) => LlmTransport;
};

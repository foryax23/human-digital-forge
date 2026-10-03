import {
  LlmError,
  type LlmCallOptions,
  type LlmMessage,
  type LlmRequest,
  type LlmTransport,
} from "./types";

/*
 * The real transport (plan A7): @anthropic-ai/sdk loaded by dynamic import
 * inside server handlers only, maxRetries 0 (a retry is a new reservation,
 * decided by paid.server.ts), per-call timeouts from the step deadline, and
 * the SDK's typed errors normalised to LlmError. Requests pass through
 * unchanged: request shapes live in extract.server.ts, synthesis.server.ts and
 * entail.server.ts.
 */

type Sdk = typeof import("@anthropic-ai/sdk");
type ZodHelper = typeof import("@anthropic-ai/sdk/helpers/zod");

let sdkPromise: Promise<[Sdk, ZodHelper]> | undefined;
const loadSdk = () =>
  (sdkPromise ??= Promise.all([
    import("@anthropic-ai/sdk"),
    import("@anthropic-ai/sdk/helpers/zod"),
  ]));

export function normaliseError(error: unknown, sdk?: Sdk["default"]): LlmError {
  if (error instanceof LlmError) return error;
  const e = error as { status?: number; type?: string | null; message?: string; name?: string };
  const message = String(e?.message ?? error).slice(0, 300);
  if (sdk && error instanceof sdk.APIConnectionTimeoutError)
    return new LlmError("timeout", message);
  if (sdk && error instanceof sdk.APIUserAbortError) return new LlmError("timeout", message);
  if (sdk && error instanceof sdk.APIConnectionError) return new LlmError("network", message);
  if (e?.name === "TimeoutError" || e?.name === "AbortError")
    return new LlmError("timeout", message);
  const status = e?.status;
  const type = e?.type ?? "";
  if (
    type === "billing_error" ||
    status === 402 ||
    /credit balance|spend limit|usage limit/i.test(message)
  ) {
    return new LlmError("billing", message, status);
  }
  if (type === "overloaded_error" || status === 529)
    return new LlmError("overloaded", message, status);
  if (type === "rate_limit_error" || status === 429)
    return new LlmError("rate_limit", message, status);
  if (
    type === "authentication_error" ||
    type === "permission_error" ||
    status === 401 ||
    status === 403
  ) {
    return new LlmError("authentication", message, status);
  }
  if (
    type === "invalid_request_error" ||
    status === 400 ||
    status === 404 ||
    status === 413 ||
    status === 422
  ) {
    return new LlmError("invalid_request", message, status);
  }
  if (typeof status === "number" && status >= 500) return new LlmError("server", message, status);
  return new LlmError("other", message, status);
}

const requestOptions = (opts?: LlmCallOptions) => ({
  timeout: opts?.timeoutMs ?? 50_000,
  signal: opts?.signal,
  maxRetries: 0,
});

/**
 * `fetchImpl` is the step's counted fetch (env.server.ts binds it), so Anthropic
 * requests count towards the step's subrequest budget like every other request.
 */
export function createAnthropicTransport(
  apiKey: string,
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>,
): LlmTransport {
  let client: InstanceType<Sdk["default"]> | undefined;
  let Anthropic: Sdk["default"] | undefined;
  const ready = async () => {
    const [sdk, zod] = await loadSdk();
    Anthropic = sdk.default;
    client ??= new sdk.default({
      apiKey,
      maxRetries: 0,
      timeout: 50_000,
      ...(fetchImpl
        ? {
            fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
              fetchImpl(
                String(input instanceof Request ? input.url : input),
                init,
              )) as typeof fetch,
          }
        : {}),
    });
    return { client, zod };
  };
  return {
    async parse(body, opts) {
      const { client: c, zod } = await ready();
      const { schema, ...rest } = body;
      try {
        const message = await c.messages.parse(
          {
            ...(rest as Record<string, unknown>),
            output_config: { format: zod.zodOutputFormat(schema as never) },
          } as never,
          requestOptions(opts),
        );
        return message as unknown as LlmMessage;
      } catch (error) {
        throw normaliseError(error, Anthropic);
      }
    },
    async create(body: LlmRequest, opts) {
      const { client: c } = await ready();
      try {
        return (await c.beta.messages.create(
          body as never,
          requestOptions(opts),
        )) as unknown as LlmMessage;
      } catch (error) {
        throw normaliseError(error, Anthropic);
      }
    },
    async stream(body: LlmRequest, opts) {
      const { client: c } = await ready();
      try {
        return (await c.beta.messages
          .stream(body as never, requestOptions(opts))
          .finalMessage()) as unknown as LlmMessage;
      } catch (error) {
        throw normaliseError(error, Anthropic);
      }
    },
    async countTokens(body) {
      const { client: c } = await ready();
      // count_tokens takes the prompt only: drop sampling and fallback fields.
      const {
        max_tokens: _m,
        fallbacks: _f,
        stream: _s,
        ...prompt
      } = body as Record<string, unknown>;
      try {
        const result = await c.beta.messages.countTokens(prompt as never, {
          maxRetries: 0,
          timeout: 10_000,
        });
        return result.input_tokens;
      } catch (error) {
        throw normaliseError(error, Anthropic);
      }
    },
  };
}

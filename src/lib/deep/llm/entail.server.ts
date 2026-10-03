import * as z from "zod/v4";

import { sha256Hex } from "../attest.server";

import { ENTAIL_MAX_TOKENS, estimateTokens } from "./budget";
import { paidCall, type PaidLedger } from "./paid.server";
import { ENTAILMENT_SYSTEM, entailmentUserText } from "./prompts";
import type { LlmClient } from "./types";

/*
 * The entailment check in `finish` (plan A7 step 6): one Haiku call over every
 * kept AI sentence with the text of the facts it cites; only "supported"
 * sentences are shown. If the check cannot run (no key, breaker, budget,
 * error), the caller shows no AI sentence at all and uses the rules templates.
 */

export const EntailmentVerdicts = z.object({
  verdicts: z.array(
    z.object({ i: z.number().int(), verdict: z.enum(["supported", "partial", "unsupported"]) }),
  ),
});

export type EntailItem = { i: number; sentence: string; facts: string[] };

export async function checkEntailment(input: {
  llm: LlmClient;
  ledger: PaidLedger;
  runId: string;
  items: EntailItem[];
  deadline: number;
  now: () => number;
  log: (event: Record<string, unknown>) => void;
}): Promise<Map<number, "supported" | "partial" | "unsupported"> | null> {
  if (!input.items.length) return new Map();
  const user = entailmentUserText(input.items);
  const model = input.llm.models.extraction;
  const outcome = await paidCall({
    ledger: input.ledger,
    runId: input.runId,
    step: "finish",
    // The digest of the sentences and facts: a replay only ever answers the same question.
    idemKey: `${input.runId}|finish|entail|${(await sha256Hex(user)).slice(0, 16)}`,
    plan: {
      model,
      inputTokens: estimateTokens(ENTAILMENT_SYSTEM.length + user.length),
      maxTokens: Math.min(ENTAIL_MAX_TOKENS, 200 + input.items.length * 40),
      fallback: false,
    },
    floor: 200,
    exec: (maxTokens) =>
      input.llm.transport.parse(
        {
          model,
          max_tokens: maxTokens,
          system: ENTAILMENT_SYSTEM,
          messages: [{ role: "user", content: user }],
          schema: EntailmentVerdicts,
        },
        { timeoutMs: Math.max(4000, input.deadline - input.now() - 1500) },
      ),
    toReplay: (message) => ({ parsed: message.parsed_output ?? null }),
    deadline: input.deadline,
    now: input.now,
    log: input.log,
  });
  let parsed: unknown;
  if (outcome.kind === "ok") parsed = outcome.message.parsed_output;
  else if (outcome.kind === "replay") parsed = (outcome.result as { parsed?: unknown })?.parsed;
  else return null;
  const safe = EntailmentVerdicts.safeParse(parsed);
  if (!safe.success) return null;
  return new Map(safe.data.verdicts.map((v) => [v.i, v.verdict]));
}

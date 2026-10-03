import * as z from "zod/v4";

import { sha256Hex } from "../attest.server";
import type { Fact, StepName } from "../contracts";
import { bi, lei } from "../parse/format";
import {
  cleanRoleTitle,
  containsPersonalName,
  looksLikePersonalName,
  scrubPersonalContacts,
} from "../parse/people";
import { amountInQuote, verifyQuote } from "../parse/quotes";
import { clip, fold, normalizeForQuote } from "../parse/text";

import { EXTRACT_MAX_TOKENS, EXTRACT_RUN_TOKEN_CAP, estimateTokens } from "./budget";
import { paidCall, type PaidLedger } from "./paid.server";
import { EXTRACTION_SYSTEM, extractionUserText } from "./prompts";
import type { LlmClient, LlmMessage } from "./types";

/*
 * Haiku extraction for one audit or crawl batch (plan A7). Page text never
 * leaves the server: the step sends its own pages here and gets back facts
 * whose quotes were found verbatim on the page they cite, and whose shown
 * values (item, unit, hours, service names, offers, area, team size) are
 * inside that quote (prices also need the amount). Role strings that look like a personal name
 * are dropped. No prompt caching (D21: below Haiku's 4,096-token minimum).
 * Sites with a text-and-data-mining reservation never reach the model.
 */

const page = z.number().int();
const quote = z.string();
export const PageExtraction = z.object({
  hours: z.array(
    z.object({ page, days: z.string(), opens: z.string(), closes: z.string(), quote }),
  ),
  services: z.array(z.object({ page, name: z.string(), quote })),
  prices: z.array(
    z.object({
      page,
      item: z.string(),
      amount: z.number(),
      currency: z.enum(["lei", "eur"]),
      unit: z.string().nullable(),
      quote,
    }),
  ),
  offers: z.array(z.object({ page, text: z.string(), quote })),
  booking: z.array(
    z.object({
      page,
      method: z.enum(["online", "telefon", "formular", "email", "whatsapp"]),
      quote,
    }),
  ),
  jobs: z.array(z.object({ page, title: z.string(), quote })),
  roles: z.array(z.object({ page, title: z.string(), count: z.number().int().nullable(), quote })),
  departments: z.array(z.object({ page, name: z.string(), quote })),
  team_size: z.array(z.object({ page, count: z.number().int(), quote })),
  service_area: z.array(z.object({ page, text: z.string(), quote })),
});
export type PageExtractionT = z.infer<typeof PageExtraction>;

export type ExtractPage = { url: string; text: string };

export type ExtractOutcome =
  | { kind: "ok"; facts: Fact[]; usd: number; tokens: number; dropped: number }
  | { kind: "skipped"; reason: string };

const PER_PAGE_CHARS = 9000;

/** Times compare without leading zeros and with ":" ("09.00" = "9:00"). */
const normTimes = (x: string) =>
  normalizeForQuote(x)
    .replace(/(\d)[.h](\d\d)/g, "$1:$2")
    .replace(/(^|[^\d])0(\d:)/g, "$1$2");

/**
 * A value shown in the report must be in the verified quote (the model's own words never
 * are), as whole words: "8:00" is not inside "18:00", "Consult" not inside "Consultație".
 */
export function inQuote(value: string, quote: string): boolean {
  const v = normTimes(value);
  if (!v) return false;
  const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lead = /^[\p{L}\p{N}]/u.test(v) ? "(?<![\\p{L}\\p{N}])" : "";
  const trail = /[\p{L}\p{N}]$/u.test(v) ? "(?![\\p{L}\\p{N}])" : "";
  return new RegExp(`${lead}${escaped}${trail}`, "u").test(normTimes(quote));
}

const DAY_WORDS = new Set(
  (
    "luni marti miercuri joi vineri sambata duminica lu ma mi jo vi sa du l m j v s d zilnic " +
    "nonstop non-stop si pana la de mon tue wed thu fri sat sun monday tuesday wednesday thursday " +
    "friday saturday sunday daily to and"
  ).split(" "),
);
/** Day ranges as written ("Luni–Vineri", "L-V", "Sâmbătă"): day words only, nothing else. */
const dayWordsOnly = (days: string) =>
  fold(days)
    .split(/[^a-z-]+|-/)
    .filter(Boolean)
    .every((w) => DAY_WORDS.has(w));

/** Turns a model extraction into facts, keeping only items whose quotes are on their page. */
export function extractionToFacts(
  data: PageExtractionT,
  pages: ExtractPage[],
  opts: { batch: string; quoteLimit: number; asOf: string },
): { facts: Fact[]; dropped: number } {
  const facts: Fact[] = [];
  let dropped = 0;
  const check = (item: { page: number; quote: string }) => {
    const p = pages[item.page];
    if (!p) return null;
    const q = verifyQuote(item.quote, p.text, opts.quoteLimit);
    if (!q || looksLikePersonalName(q) || containsPersonalName(q)) return null;
    return { quote: q, url: p.url };
  };
  const base = (section: "offers" | "people", predicate: string, n: number) => ({
    id: `${predicate}.${opts.batch}.${n}`,
    section,
    predicate,
    source: "site" as const,
    asOf: opts.asOf,
    confidence: "probabil" as const,
    method: "llm" as const,
    score: 0.8,
    gdpr: section === "people" ? ("G1" as const) : ("G0" as const),
  });
  const push = (f: Fact | null) => (f ? facts.push(f) : dropped++);

  data.hours.slice(0, 4).forEach((h, i) => {
    const found = check(h);
    const ok =
      found &&
      inQuote(h.opens, found.quote) &&
      inQuote(h.closes, found.quote) &&
      (inQuote(h.days, found.quote) || dayWordsOnly(h.days)) &&
      !containsPersonalName(h.days)
        ? found
        : null;
    const text = `${clip(h.days, 40)} ${clip(h.opens, 8)}–${clip(h.closes, 8)}`;
    push(
      ok
        ? ({
            ...base("offers", "offers.hours", i),
            value: { days: h.days, opens: h.opens, closes: h.closes },
            display: bi(text, text),
            evidence: ok,
          } as Fact)
        : null,
    );
  });
  data.services.slice(0, 12).forEach((s, i) => {
    const found = check(s);
    const ok = found && inQuote(s.name, found.quote) ? found : null;
    const name = containsPersonalName(s.name) ? "" : clip(s.name, 80);
    push(
      ok && name
        ? ({
            ...base("offers", "offers.services", i),
            value: name,
            display: bi(name, name),
            evidence: ok,
          } as Fact)
        : null,
    );
  });
  data.prices.slice(0, 12).forEach((p, i) => {
    const ok = check(p);
    if (
      !ok ||
      !amountInQuote(p.amount, ok.quote) ||
      !inQuote(p.item, ok.quote) ||
      (p.unit && !inQuote(p.unit, ok.quote)) ||
      containsPersonalName(p.item) ||
      (p.unit && containsPersonalName(p.unit))
    )
      return push(null);
    const amount = p.currency === "lei" ? lei(p.amount) : bi(`${p.amount} EUR`, `${p.amount} EUR`);
    const item = clip(p.item, 60);
    const unit = p.unit ? ` / ${clip(p.unit, 20)}` : "";
    push({
      ...base("offers", "offers.price", i),
      value: { item, amount: p.amount, currency: p.currency, unit: p.unit },
      display: bi(`${item}: ${amount.en}${unit}`, `${item}: ${amount.ro}${unit}`),
      evidence: ok,
    } as Fact);
  });
  data.offers.slice(0, 4).forEach((o, i) => {
    const found = check(o);
    const ok = found && inQuote(o.text, found.quote) ? found : null;
    const text = containsPersonalName(o.text) ? "" : clip(o.text, 120);
    push(
      ok && text
        ? ({
            ...base("offers", "offers.promo", i),
            value: text,
            display: bi(text, text),
            evidence: ok,
          } as Fact)
        : null,
    );
  });
  data.booking.slice(0, 3).forEach((b, i) => {
    const ok = check(b);
    const label = {
      online: ["online", "online"],
      telefon: ["by phone", "telefonic"],
      formular: ["form", "formular"],
      email: ["e-mail", "e-mail"],
      whatsapp: ["WhatsApp", "WhatsApp"],
    }[b.method];
    push(
      ok
        ? ({
            ...base("offers", "offers.booking_method", i),
            value: b.method,
            display: bi(label[0], label[1]),
            evidence: ok,
          } as Fact)
        : null,
    );
  });
  // People facts: a title with a name in it is dropped, and the quote keeps no personal
  // e-mail or phone (the rules path applies the same checks, rules-extract.ts).
  const personQuote = (found: { quote: string; url: string } | null) =>
    found ? { ...found, quote: scrubPersonalContacts(found.quote) } : null;
  const roleTitle = (raw: string) => {
    const title = cleanRoleTitle(raw);
    return title && !containsPersonalName(title) ? title : null;
  };
  data.jobs.slice(0, 8).forEach((j, i) => {
    const ok = personQuote(check(j));
    const title = roleTitle(j.title);
    push(
      ok && title
        ? ({
            ...base("people", "people.job_titles", i),
            value: title,
            display: bi(title, title),
            evidence: ok,
          } as Fact)
        : null,
    );
  });
  data.roles.slice(0, 10).forEach((r, i) => {
    const ok = personQuote(check(r));
    const title = roleTitle(r.title);
    const shown = r.count && r.count > 1 ? `${title} (${r.count})` : title;
    push(
      ok && title
        ? ({
            ...base("people", "people.roles", i),
            value: { title, count: r.count },
            display: bi(shown!, shown!),
            evidence: ok,
          } as Fact)
        : null,
    );
  });
  data.departments.slice(0, 8).forEach((d, i) => {
    const ok = personQuote(check(d));
    const plain = scrubPersonalContacts(d.name);
    const name =
      roleTitle(d.name) ??
      (looksLikePersonalName(plain) || containsPersonalName(plain) || plain.includes("…")
        ? null
        : clip(plain, 60));
    push(
      ok && name
        ? ({
            ...base("people", "people.departments", i),
            value: name,
            display: bi(name, name),
            evidence: ok,
          } as Fact)
        : null,
    );
  });
  data.team_size.slice(0, 1).forEach((t, i) => {
    const found = check(t);
    const ok = found && amountInQuote(t.count, found.quote) ? found : null;
    push(
      ok && t.count > 0 && t.count < 100_000
        ? ({
            ...base("people", "people.team_size_published", i),
            value: t.count,
            display: bi(String(t.count), String(t.count)),
            evidence: ok,
          } as Fact)
        : null,
    );
  });
  data.service_area.slice(0, 2).forEach((s, i) => {
    const found = check(s);
    const ok =
      found && inQuote(s.text, found.quote) && !containsPersonalName(s.text) ? found : null;
    const text = clip(s.text, 100);
    push(
      ok
        ? ({
            ...base("offers", "offers.service_area", i),
            value: text,
            display: bi(text, text),
            evidence: ok,
          } as Fact)
        : null,
    );
  });
  return { facts, dropped };
}

export async function extractWithModel(input: {
  llm: LlmClient;
  ledger: PaidLedger;
  runId: string;
  step: StepName;
  batch: string;
  pages: ExtractPage[];
  quoteLimit: number;
  tdmReserved: boolean;
  /** Page-text tokens already sent in this run (cap 40k). */
  tokensUsed: number;
  deadline: number;
  now: () => number;
  log: (event: Record<string, unknown>) => void;
  asOf: string;
}): Promise<ExtractOutcome> {
  if (input.tdmReserved) return { kind: "skipped", reason: "tdm_reservation" };
  const room = EXTRACT_RUN_TOKEN_CAP - input.tokensUsed;
  if (room < 1500) return { kind: "skipped", reason: "run_token_cap" };
  let charsLeft = Math.floor((room / 1.15) * 3);
  const pages: ExtractPage[] = [];
  for (const p of input.pages) {
    if (charsLeft < 600) break;
    const text = p.text.slice(0, Math.min(PER_PAGE_CHARS, charsLeft));
    if (text.trim().length < 80) continue;
    pages.push({ url: p.url, text });
    charsLeft -= text.length;
  }
  if (!pages.length) return { kind: "skipped", reason: "no_text" };
  const user = extractionUserText(
    pages.map((p, index) => ({ index, url: p.url, text: p.text })),
    input.quoteLimit,
  );
  const inputTokens = estimateTokens(EXTRACTION_SYSTEM.length + user.length);
  const model = input.llm.models.extraction;
  const outcome = await paidCall({
    ledger: input.ledger,
    runId: input.runId,
    step: input.step,
    idemKey: `${input.runId}|${input.step}|${input.batch}|${(await sha256Hex(user)).slice(0, 16)}`,
    plan: { model, inputTokens, maxTokens: EXTRACT_MAX_TOKENS, fallback: false },
    floor: 1200,
    exec: (maxTokens) =>
      input.llm.transport.parse(
        {
          model,
          max_tokens: maxTokens,
          system: EXTRACTION_SYSTEM,
          messages: [{ role: "user", content: user }],
          schema: PageExtraction,
        },
        { timeoutMs: Math.max(5000, input.deadline - input.now() - 2000) },
      ),
    toReplay: (message: LlmMessage) => ({ parsed: message.parsed_output ?? null }),
    deadline: input.deadline,
    now: input.now,
    log: input.log,
  });
  let parsed: unknown;
  let usd = 0;
  if (outcome.kind === "ok") {
    parsed = outcome.message.parsed_output;
    usd = outcome.usd;
    if (outcome.message.stop_reason === "refusal") return { kind: "skipped", reason: "refusal" };
  } else if (outcome.kind === "replay") {
    parsed = (outcome.result as { parsed?: unknown })?.parsed;
  } else {
    return {
      kind: "skipped",
      reason: outcome.kind === "refused" ? outcome.reason : outcome.error.kind,
    };
  }
  const safe = PageExtraction.safeParse(parsed);
  if (!safe.success) return { kind: "skipped", reason: "invalid_output" };
  const { facts, dropped } = extractionToFacts(safe.data, pages, {
    batch: input.batch,
    quoteLimit: input.quoteLimit,
    asOf: input.asOf,
  });
  return {
    kind: "ok",
    facts,
    usd,
    tokens: estimateTokens(pages.reduce((n, p) => n + p.text.length, 0)),
    dropped,
  };
}

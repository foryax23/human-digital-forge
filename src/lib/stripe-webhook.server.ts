import type { Stripe } from "stripe";

/**
 * Stripe webhook processing, kept apart from the route so it can be tested with fakes.
 *
 * Contract with Stripe: a 2xx answer means "done, never send this event again"; any other
 * status makes Stripe retry with backoff for up to three days. So:
 *   - a failed database write (or a failed Stripe lookup) throws, and the route answers 500;
 *   - an event that was already processed answers 200 without writing again (idempotent by
 *     event id), using the optional ledger table public.stripe_events
 *     (drizzle/pending/stripe_events.sql);
 *   - an event older than one already written for the same subscription answers 200 without
 *     writing, so a late retry cannot roll a subscription back (e.g. "active" after "canceled").
 *
 * Without the ledger table everything still works: the write is an upsert keyed on the
 * e-mail, so processing the same event twice gives the same row; only the duplicate and
 * out-of-order guards are skipped, and a warning says so.
 */

export const LEDGER_MIGRATION = "drizzle/pending/stripe_events.sql";

/** The subscriber row fields the webhook writes. Absent fields are left untouched in the row. */
export interface SubscriberFields {
  email: string;
  status: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  tier?: string;
  user_id?: string;
  current_period_end?: string;
}

/** What processing did with an event; stored in stripe_events.outcome. */
export type EventOutcome = "written" | "skipped_no_email" | "stale";

export interface LedgerEntry {
  id: string;
  type: string;
  object_id: string | null;
  stripe_created: string;
  livemode: boolean;
  outcome: EventOutcome;
}

export interface WebhookDeps {
  /** Upserts on the e-mail. Must THROW when the database refuses the write. */
  upsertSubscriber(fields: SubscriberFields): Promise<void>;
  /** The Stripe customer's e-mail, or null for a deleted customer or one without e-mail. Throws on API errors. */
  customerEmail(customerId: string): Promise<string | null>;
  ledger: {
    /**
     * Whether this event was processed already, and whether a NEWER event for the same
     * object was processed with outcome "written" (a skipped event does not count).
     * "missing" when the ledger table does not exist. Throws on other errors.
     */
    check(
      eventId: string,
      objectId: string | null,
      createdIso: string,
    ): Promise<{ seen: boolean; newer: boolean } | "missing">;
    /** Records a processed event (ignoring a duplicate id). "missing" without the table. Throws on other errors. */
    record(entry: LedgerEntry): Promise<"ok" | "missing">;
  };
  log: Pick<Console, "info" | "warn" | "error">;
}

export interface WebhookResult {
  status: 200 | 500;
  body: Record<string, unknown>;
}

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const TAG = "[stripe-webhook]";

/** Drops undefined/null/empty values so an upsert never erases known data with a blank. */
function compact(fields: Record<string, string | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.trim() !== "") out[key] = value;
  }
  return out;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * The period end of a subscription. API versions before 2025-03-31 put it on the
 * subscription; newer ones (the endpoint's version decides the payload) on each item.
 */
export function periodEndIso(sub: Stripe.Subscription): string | undefined {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const seconds = typeof top === "number" ? top : item?.current_period_end;
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : undefined;
}

/** The subscription an event is about (the key of the out-of-order guard). */
export function eventObjectId(event: Stripe.Event): string | null {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    return idOf(session.subscription as string | { id: string } | null);
  }
  if (event.type.startsWith("customer.subscription.")) {
    return (event.data.object as Stripe.Subscription).id ?? null;
  }
  return null;
}

/** Builds the subscriber row for an event; null when the event carries no e-mail. */
async function subscriberFor(
  event: Stripe.Event,
  deps: WebhookDeps,
): Promise<SubscriberFields | null> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email ?? session.customer_email ?? null;
    if (!email) return null;
    return {
      email,
      status: "active",
      ...compact({
        stripe_customer_id: idOf(session.customer as string | { id: string } | null),
        stripe_subscription_id: idOf(session.subscription as string | { id: string } | null),
        tier: session.metadata?.plan,
        user_id: session.metadata?.user_id,
      }),
    };
  }

  const sub = event.data.object as Stripe.Subscription;
  const customerId = idOf(sub.customer as string | { id: string });
  if (!customerId) return null;
  const email = await deps.customerEmail(customerId);
  if (!email) return null;
  return {
    email,
    status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
    ...compact({
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      tier: sub.metadata?.plan,
      user_id: sub.metadata?.user_id,
      current_period_end: periodEndIso(sub),
    }),
  };
}

function describe(error: unknown): Record<string, unknown> {
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    return { message: e.message, code: e.code, details: e.details, hint: e.hint };
  }
  return { message: String(error) };
}

/**
 * Processes one verified Stripe event. Never throws: every failure becomes a 500 result
 * (Stripe retries), every success or deliberate skip a 200 result.
 */
export async function processStripeEvent(
  event: Stripe.Event,
  deps: WebhookDeps,
): Promise<WebhookResult> {
  const where = `${TAG} ${event.id} ${event.type}`;

  if (!HANDLED.has(event.type)) {
    deps.log.info(`${where}: not handled, acknowledged`);
    return { status: 200, body: { received: true, ignored: true } };
  }

  const objectId = eventObjectId(event);
  const createdIso = new Date(event.created * 1000).toISOString();

  // 1. Idempotency and ordering, from the optional ledger.
  let ledger = true;
  try {
    const state = await deps.ledger.check(event.id, objectId, createdIso);
    if (state === "missing") {
      ledger = false;
      deps.log.warn(
        `${where}: table public.stripe_events is missing, processing without the duplicate and order guards (apply ${LEDGER_MIGRATION})`,
      );
    } else if (state.seen) {
      deps.log.info(`${where}: already processed, acknowledged without writing`);
      return { status: 200, body: { received: true, duplicate: true } };
    } else if (state.newer) {
      deps.log.warn(
        `${where}: a newer event for ${objectId} was already written, this older one is not applied`,
      );
      await recordQuietly(deps, event, objectId, createdIso, "stale", where);
      return { status: 200, body: { received: true, stale: true } };
    }
  } catch (error) {
    deps.log.error(
      `${where}: could not read public.stripe_events, Stripe will retry`,
      describe(error),
    );
    return { status: 500, body: { error: "Database unavailable, retry later" } };
  }

  // 2. The write. Any failure here is answered with 500 so Stripe retries the event.
  let outcome: EventOutcome;
  try {
    const fields = await subscriberFor(event, deps);
    if (!fields) {
      outcome = "skipped_no_email";
      deps.log.warn(`${where}: no customer e-mail on the event, nothing to write`);
    } else {
      await deps.upsertSubscriber(fields);
      outcome = "written";
      deps.log.info(
        `${where}: subscriber saved (status ${fields.status}${fields.tier ? `, tier ${fields.tier}` : ""}${objectId ? `, ${objectId}` : ""})`,
      );
    }
  } catch (error) {
    deps.log.error(`${where}: processing failed, answering 500 so Stripe retries`, describe(error));
    return { status: 500, body: { error: "Processing failed, retry later" } };
  }

  // 3. Mark it processed. A failure here is not worth a retry: the write above is idempotent.
  if (ledger) await recordQuietly(deps, event, objectId, createdIso, outcome, where);
  return { status: 200, body: { received: true } };
}

async function recordQuietly(
  deps: WebhookDeps,
  event: Stripe.Event,
  objectId: string | null,
  createdIso: string,
  outcome: EventOutcome,
  where: string,
): Promise<void> {
  try {
    const result = await deps.ledger.record({
      id: event.id,
      type: event.type,
      object_id: objectId,
      stripe_created: createdIso,
      livemode: Boolean(event.livemode),
      outcome,
    });
    if (result === "missing") {
      deps.log.warn(`${where}: table public.stripe_events is missing, event not recorded`);
    }
  } catch (error) {
    deps.log.warn(`${where}: could not record the event in public.stripe_events`, describe(error));
  }
}

/** PostgREST / Postgres codes meaning "the ledger table (or one of its columns) is not there". */
export function isMissingLedger(error: { code?: string } | null | undefined): boolean {
  if (!error?.code) return false;
  return ["PGRST205", "42P01", "PGRST204", "42703"].includes(error.code);
}

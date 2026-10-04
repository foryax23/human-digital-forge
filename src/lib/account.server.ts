/*
 * Stripe checks for the client account, kept free of TanStack and Stripe imports so the tests
 * run them on plain objects (tests/portal/stripe-check.test.ts). The server functions in
 * src/lib/account.functions.ts fetch from Stripe and call these.
 *
 * Ownership: a Checkout Session belongs to the signed-in account when Stripe carries the
 * account's ID (client_reference_id, or metadata.user_id, which the server sets from the
 * verified token since plan B3), or when its Stripe customer is the one on the account's own
 * subscribers row (read with the account's session, so RLS decides). An e-mail match is never
 * enough: anyone can type someone else's address at checkout.
 *
 * A session that is missing and a session that belongs to someone else get the same answer
 * ("not_found"), so the page never confirms that a stranger's session ID exists.
 */

/** The Checkout Session fields these checks read (a subset of Stripe.Checkout.Session). */
export interface SessionLike {
  id: string;
  mode?: string | null;
  status?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  /** Unix seconds. */
  created?: number | null;
  client_reference_id?: string | null;
  customer?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
  line_items?: { data?: Array<{ description?: string | null }> | null } | null;
}

export interface Owner {
  userId: string;
  /** Stripe customer IDs linked to the account (its own subscribers row). */
  customerIds: string[];
}

/** What the success page shows. Nothing here says "paid" unless Stripe said so. */
export type CheckoutCheck =
  | { status: "invalid" }
  | { status: "unconfigured" }
  | { status: "not_found" }
  | { status: "pending" }
  | { status: "expired" }
  | { status: "error" }
  | {
      status: "paid";
      mode: "payment" | "subscription" | "setup" | "other";
      amountMinor: number | null;
      currency: string | null;
      description: string | null;
      /** ISO time the session was created. */
      createdAt: string | null;
    };

/** One paid one-off item on the billing page. */
export interface OneOffPayment {
  id: string;
  amountMinor: number;
  currency: string;
  description: string | null;
  createdAt: string;
}

/** A Stripe Checkout Session ID as Stripe issues them ("cs_test_…" or "cs_live_…"). */
export function isCheckoutSessionId(value: unknown): value is string {
  return typeof value === "string" && /^cs_(test|live)_[A-Za-z0-9]{8,250}$/.test(value);
}

function customerId(session: SessionLike): string | null {
  const c = session.customer;
  if (!c) return null;
  return typeof c === "string" ? c : (c.id ?? null);
}

export function sessionBelongsTo(session: SessionLike, owner: Owner): boolean {
  if (!owner.userId) return false;
  if (session.client_reference_id && session.client_reference_id === owner.userId) return true;
  if (session.metadata?.user_id && session.metadata.user_id === owner.userId) return true;
  const customer = customerId(session);
  return Boolean(customer && owner.customerIds.includes(customer));
}

function iso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function firstDescription(session: SessionLike): string | null {
  const text = session.line_items?.data?.[0]?.description;
  return typeof text === "string" && text.trim() ? text.trim().slice(0, 200) : null;
}

function modeOf(mode: string | null | undefined): "payment" | "subscription" | "setup" | "other" {
  return mode === "payment" || mode === "subscription" || mode === "setup" ? mode : "other";
}

/**
 * The page state for a session Stripe returned. Paid only when Stripe says so:
 * payment_status "paid", or "no_payment_required" on a completed session (a 100% discount).
 * A completed session still "unpaid" is a delayed method (bank debit): pending, not paid.
 */
export function checkoutOutcome(session: SessionLike, owner: Owner): CheckoutCheck {
  if (!sessionBelongsTo(session, owner)) return { status: "not_found" };
  if (session.status === "expired") return { status: "expired" };
  const paid =
    session.payment_status === "paid" ||
    (session.payment_status === "no_payment_required" && session.status === "complete");
  if (!paid) return { status: "pending" };
  return {
    status: "paid",
    mode: modeOf(session.mode),
    amountMinor: typeof session.amount_total === "number" ? session.amount_total : null,
    currency: session.currency ? session.currency.toUpperCase() : null,
    description: firstDescription(session),
    createdAt: iso(session.created),
  };
}

/** Paid one-off sessions of this account, newest first (subscriptions are left out). */
export function oneOffPayments(sessions: SessionLike[], owner: Owner): OneOffPayment[] {
  const out: OneOffPayment[] = [];
  for (const s of sessions) {
    if (s.mode !== "payment" || s.payment_status !== "paid") continue;
    if (!sessionBelongsTo(s, owner)) continue;
    if (typeof s.amount_total !== "number" || !s.currency) continue;
    const createdAt = iso(s.created);
    if (!createdAt) continue;
    out.push({
      id: s.id,
      amountMinor: s.amount_total,
      currency: s.currency.toUpperCase(),
      description: firstDescription(s),
      createdAt,
    });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** "missing" for an unknown ID (Stripe's resource_missing / 404), else "other". */
export function stripeErrorKind(error: unknown): "missing" | "other" {
  const e = error as { code?: unknown; statusCode?: unknown; type?: unknown } | null;
  if (!e || typeof e !== "object") return "other";
  if (e.code === "resource_missing" || e.statusCode === 404) return "missing";
  return "other";
}

/** Stripe customer IDs from the account's own subscribers rows ("cus_…" only). */
export function customerIdsFrom(rows: Array<{ stripe_customer_id?: string | null }> | null) {
  const ids = new Set<string>();
  for (const r of rows ?? []) {
    const id = r.stripe_customer_id;
    if (typeof id === "string" && /^cus_[A-Za-z0-9]{6,250}$/.test(id)) ids.add(id);
  }
  return [...ids];
}

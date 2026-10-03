import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import {
  PLAN_LABELS,
  PLAN_PRICING,
  isCurrency,
  isPlanId,
  type Currency,
  type PlanId,
} from "@/lib/plans";

interface CheckoutInput {
  plan: PlanId;
  currency: Currency;
  /** Ignored (plan B3): the account comes from the verified session token, never from the browser. */
  userId?: string | null;
  /** Ignored (plan B3): see userId. */
  email?: string | null;
}

/**
 * The signed-in account from the request's bearer token (attached to every server
 * function call by src/integrations/supabase/auth-attacher.ts), verified with
 * Supabase. Null for a visitor who is not signed in: checkout still works and
 * Stripe asks for the e-mail, but no account ID from the browser is ever trusted
 * (before, any user_id sent by a client went into the subscription metadata).
 */
async function verifiedAccount(): Promise<{ userId: string; email: string | null } | null> {
  const header = getRequest()?.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const supabase = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(header.slice(7));
    const claims = data?.claims as { sub?: string; email?: string } | undefined;
    if (error || !claims?.sub) return null;
    return { userId: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
  } catch {
    return null;
  }
}

function getOrigin(): string {
  const request = getRequest();
  const url = new URL(request.url);
  const fromHeader = request.headers.get("origin");
  return fromHeader ?? `${url.protocol}//${url.host}`;
}

/**
 * Creates a Stripe Checkout Session in subscription mode and returns the
 * hosted checkout URL. Prices come from the server-side PLAN_PRICING map so
 * the client cannot influence the charged amount.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: CheckoutInput) => {
    if (!isPlanId(data?.plan)) throw new Error("Invalid plan");
    if (!isCurrency(data?.currency)) throw new Error("Invalid currency");
    // userId and email from the browser are dropped here: only the verified session counts.
    return { plan: data.plan, currency: data.currency };
  })
  .handler(async ({ data }) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error("Stripe is not configured");
    const account = await verifiedAccount();

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const amount = PLAN_PRICING[data.plan][data.currency];
    const origin = getOrigin();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(account?.email ? { customer_email: account.email } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: data.currency,
            unit_amount: amount,
            recurring: { interval: "month" },
            product_data: {
              name: `Vortex Hub — ${PLAN_LABELS[data.plan]}`,
            },
          },
        },
      ],
      metadata: {
        plan: data.plan,
        ...(account ? { user_id: account.userId } : {}),
      },
      subscription_data: {
        metadata: {
          plan: data.plan,
          ...(account ? { user_id: account.userId } : {}),
        },
      },
      success_url: `${origin}/billing-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
    });

    if (!session.url) throw new Error("Could not create checkout session");
    return { url: session.url };
  });

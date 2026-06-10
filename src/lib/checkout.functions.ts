import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

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
  userId?: string | null;
  email?: string | null;
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
    return {
      plan: data.plan,
      currency: data.currency,
      userId: typeof data.userId === "string" ? data.userId : null,
      email: typeof data.email === "string" ? data.email : null,
    };
  })
  .handler(async ({ data }) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error("Stripe is not configured");

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const amount = PLAN_PRICING[data.plan][data.currency];
    const origin = getOrigin();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(data.email ? { customer_email: data.email } : {}),
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
        ...(data.userId ? { user_id: data.userId } : {}),
      },
      subscription_data: {
        metadata: {
          plan: data.plan,
          ...(data.userId ? { user_id: data.userId } : {}),
        },
      },
      success_url: `${origin}/billing-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
    });

    if (!session.url) throw new Error("Could not create checkout session");
    return { url: session.url };
  });

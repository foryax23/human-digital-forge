import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import { PLAN_LABELS, isPlanId, type Currency, type PlanId } from "@/lib/plans";

interface CheckoutInput {
  plan: PlanId;
  /** Ignored: the old self-serve checkout's currency. */
  currency?: Currency;
  /** Ignored (plan B3): the account comes from the verified session token, never from the browser. */
  userId?: string | null;
  /** Ignored (plan B3): see userId. */
  email?: string | null;
}

/**
 * The signed-in account from the request's bearer token (attached to every server
 * function call by src/integrations/supabase/auth-attacher.ts), verified with
 * Supabase. Null for a visitor who is not signed in. No account ID or e-mail from the
 * browser is ever trusted (before plan B3, any user_id a client sent went into the
 * subscription metadata).
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

/** Where a plan is asked for now: the contact form with the plan chosen ("Cere contractul"). */
function contractRequestPath(plan: PlanId): string {
  return `/contact?plan=${plan}`;
}

/**
 * The old self-serve plan checkout (a Stripe Checkout Session in subscription mode).
 *
 * Plans are sold by contract since 2026-10-04 (src/lib/pricing.ts, analysis §4.6) and
 * nothing in the app starts a plan checkout any more, so this refuses every plan purchase
 * and names the contract request instead. It stays exported so an old open tab or a stale
 * import gets a clear error rather than a missing function. The refusal is logged with the
 * verified account (never one sent by the browser), so the team can follow up.
 *
 * Existing Stripe subscribers are not affected: the webhook (src/routes/api/public/
 * stripe-webhook.ts, src/lib/stripe-webhook.server.ts) still records their renewals,
 * changes and cancellations.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: CheckoutInput) => {
    if (!isPlanId(data?.plan)) throw new Error("Invalid plan");
    // userId, email and currency from the browser are dropped here.
    return { plan: data.plan };
  })
  .handler(async ({ data }): Promise<{ url: string }> => {
    const account = await verifiedAccount();
    const path = contractRequestPath(data.plan);
    console.warn("[checkout] plan purchase refused: plans are sold by contract", {
      plan: data.plan,
      userId: account?.userId ?? null,
    });
    throw new Error(
      `Plans are sold by contract, not by card. Request the ${PLAN_LABELS[data.plan]} contract at ${path}.`,
    );
  });

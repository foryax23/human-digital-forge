import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { ExportDb, TeamHeld } from "@/components/dashboard/account-export";
import type { CheckoutCheck, OneOffPayment, Owner } from "@/lib/account.server";

/*
 * Server reads for the signed-in client.
 *
 * Stripe: the /billing-success check and the one-off payments on /dashboard/billing. Both use
 * the account's own session for the database (RLS decides which subscribers row it sees; never
 * the service role) and STRIPE_SECRET_KEY for Stripe. Without that key (Lovable -> Cloud ->
 * Secrets) they answer "unconfigured" and the pages say they cannot confirm a payment.
 *
 * Export: getMyTeamHeldData (below) reads, with the service role, the rows the account
 * cannot read itself, filtered on the account only.
 */

export type { CheckoutCheck, OneOffPayment } from "@/lib/account.server";
export type { TeamHeld } from "@/components/dashboard/account-export";

export type MyPayments =
  | { status: "unconfigured" }
  | { status: "error" }
  | { status: "ok"; payments: OneOffPayment[] };

type Ctx = { userId: string; supabase: SupabaseClient<Database> };

/** The account's Stripe customers, from its own subscribers row (RLS: only its own). */
async function ownerOf(context: Ctx): Promise<Owner> {
  const { customerIdsFrom } = await import("@/lib/account.server");
  const { data, error } = await context.supabase
    .from("subscribers")
    .select("stripe_customer_id")
    .eq("user_id", context.userId);
  // No row, or a read refused: only the ID checks remain (client_reference_id, metadata).
  return { userId: context.userId, customerIds: error ? [] : customerIdsFrom(data) };
}

async function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

/**
 * Verifies the session in /billing-success?session_id=… with Stripe: it must exist, belong to
 * the signed-in account and be paid. Anything else is not reported as a payment.
 */
export const checkCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().max(300) }).parse(d))
  .handler(async ({ data, context }): Promise<CheckoutCheck> => {
    const { checkoutOutcome, isCheckoutSessionId, stripeErrorKind } =
      await import("@/lib/account.server");
    if (!isCheckoutSessionId(data.sessionId)) return { status: "invalid" };
    const stripe = await stripeClient();
    if (!stripe) return { status: "unconfigured" };
    const owner = await ownerOf(context);
    try {
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["line_items"],
      });
      return checkoutOutcome(session, owner);
    } catch (error) {
      if (stripeErrorKind(error) === "missing") return { status: "not_found" };
      console.error("[account] checkout session check failed", {
        userId: context.userId,
        code: (error as { code?: string })?.code ?? null,
      });
      return { status: "error" };
    }
  });

/**
 * Paid one-off Checkout Sessions of the account's Stripe customer (newest 24). Plans are
 * invoiced by contract, so this is empty for most clients and the billing page hides it.
 */
export const getMyPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPayments> => {
    const stripe = await stripeClient();
    if (!stripe) return { status: "unconfigured" };
    const { oneOffPayments } = await import("@/lib/account.server");
    const owner = await ownerOf(context);
    if (!owner.customerIds.length) return { status: "ok", payments: [] };
    try {
      const sessions = [];
      for (const customer of owner.customerIds.slice(0, 3)) {
        const list = await stripe.checkout.sessions
          .list({ customer, limit: 24, expand: ["data.line_items"] })
          // An older API version that refuses the expansion: the amounts are enough.
          .catch(() => stripe.checkout.sessions.list({ customer, limit: 24 }));
        sessions.push(...list.data);
      }
      return { status: "ok", payments: oneOffPayments(sessions, owner).slice(0, 24) };
    } catch (error) {
      console.error("[account] payments list failed", {
        userId: context.userId,
        code: (error as { code?: string })?.code ?? null,
      });
      return { status: "error" };
    }
  });

/**
 * "Descarcă datele mele", the part the account cannot read itself: Deep Research runs, their
 * feedback and call requests (by the account ID) and the form enquiries and Vortex Scan
 * report requests sent from the account's confirmed e-mail address. Read with the service
 * role, filtered on those two values only (readTeamHeld). Without database access on this
 * server it answers "unavailable" and the file says we send these on request.
 */
export const getMyTeamHeldData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamHeld> => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { status: "unavailable" };
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { readTeamHeld } = await import("@/components/dashboard/account-export");
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const user = error ? null : data.user;
      // Forms need no account: only a confirmed address may match their rows.
      const email = user?.email && user.email_confirmed_at ? user.email.trim().toLowerCase() : null;
      return await readTeamHeld(supabaseAdmin as unknown as ExportDb, context.userId, email);
    } catch (error) {
      console.error("[account] team-held export failed", {
        userId: context.userId,
        code: (error as { code?: string })?.code ?? null,
      });
      return { status: "unavailable" };
    }
  });

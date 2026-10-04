import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook. The signature is verified first (as before); the processing itself lives
 * in src/lib/stripe-webhook.server.ts. A failed database write now answers 500, so Stripe
 * retries the event instead of losing it, and an event already processed is acknowledged
 * without writing again (ledger table public.stripe_events, optional).
 */
export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secretKey || !webhookSecret) {
          console.error("[stripe-webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set");
          return new Response("Stripe not configured", { status: 500 });
        }

        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(secretKey, {
          httpClient: Stripe.createFetchHttpClient(),
        });

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const body = await request.text();

        let event: import("stripe").Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret,
            undefined,
            Stripe.createSubtleCryptoProvider(),
          );
        } catch (err) {
          console.error("[stripe-webhook] signature verification failed", err);
          return new Response("Invalid signature", { status: 401 });
        }

        const json = (status: number, payload: Record<string, unknown>) =>
          new Response(JSON.stringify(payload), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        let supabaseAdmin: (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
        let webhook: typeof import("@/lib/stripe-webhook.server");
        try {
          ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
          webhook = await import("@/lib/stripe-webhook.server");
        } catch (err) {
          console.error(
            `[stripe-webhook] ${event.id}: server setup failed, Stripe will retry`,
            err,
          );
          return json(500, { error: "Server not ready, retry later" });
        }

        // The ledger table is not in the generated Supabase types until drizzle/pending/stripe_events.sql is applied
        // and the types are regenerated, so it is reached through an untyped view.
        const untyped = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
        const events = () => untyped.from("stripe_events");

        const result = await webhook.processStripeEvent(event, {
          async upsertSubscriber(fields) {
            const { error } = await supabaseAdmin
              .from("subscribers")
              .upsert(fields, { onConflict: "email" });
            if (error) throw error;
          },
          async customerEmail(customerId) {
            const customer = await stripe.customers.retrieve(customerId);
            if ("deleted" in customer && customer.deleted) return null;
            return customer.email ?? null;
          },
          ledger: {
            async check(eventId, objectId, createdIso) {
              const seen = await events().select("id").eq("id", eventId).limit(1);
              if (seen.error) {
                if (webhook.isMissingLedger(seen.error)) return "missing";
                throw seen.error;
              }
              if ((seen.data ?? []).length > 0) return { seen: true, newer: false };
              if (!objectId) return { seen: false, newer: false };
              // Only a newer event that actually wrote the row counts (not a skipped one).
              const newer = await events()
                .select("id")
                .eq("object_id", objectId)
                .eq("outcome", "written")
                .gt("stripe_created", createdIso)
                .limit(1);
              if (newer.error) {
                if (webhook.isMissingLedger(newer.error)) return "missing";
                throw newer.error;
              }
              return { seen: false, newer: (newer.data ?? []).length > 0 };
            },
            async record(entry) {
              const { error } = await events().upsert(entry, {
                onConflict: "id",
                ignoreDuplicates: true,
              });
              if (error) {
                if (webhook.isMissingLedger(error)) return "missing";
                throw error;
              }
              return "ok";
            },
          },
          log: console,
        });

        return json(result.status, result.body);
      },
    },
  },
});

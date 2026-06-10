import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secretKey || !webhookSecret) {
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

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        async function upsert(fields: Record<string, unknown> & { email: string }) {
          const { error } = await supabaseAdmin
            .from("subscribers")
            .upsert(fields, { onConflict: "email" });
          if (error) console.error("[stripe-webhook] upsert failed", error);
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as import("stripe").Stripe.Checkout.Session;
              const email =
                session.customer_details?.email ?? session.customer_email ?? null;
              if (email) {
                await upsert({
                  email,
                  stripe_customer_id:
                    typeof session.customer === "string" ? session.customer : null,
                  stripe_subscription_id:
                    typeof session.subscription === "string"
                      ? session.subscription
                      : null,
                  tier: session.metadata?.plan ?? null,
                  user_id: session.metadata?.user_id ?? null,
                  status: "active",
                });
              }
              break;
            }
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              const sub = event.data.object as import("stripe").Stripe.Subscription;
              const customerId =
                typeof sub.customer === "string" ? sub.customer : sub.customer.id;
              const customer = await stripe.customers.retrieve(customerId);
              const email =
                !("deleted" in customer) && customer.email ? customer.email : null;
              if (email) {
                const status =
                  event.type === "customer.subscription.deleted"
                    ? "canceled"
                    : sub.status;
                await upsert({
                  email,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: sub.id,
                  tier: sub.metadata?.plan ?? null,
                  user_id: sub.metadata?.user_id ?? null,
                  status,
                  current_period_end: new Date(
                    sub.current_period_end * 1000,
                  ).toISOString(),
                });
              }
              break;
            }
            default:
              break;
          }
        } catch (err) {
          console.error("[stripe-webhook] handler error", err);
          return new Response("Handler error", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

// The plan IDs shared by the pricing section, the contact form, the scan offer, the client
// plans an admin assigns and the Stripe webhook. Prices, hours and what each plan includes
// live in the public price list, src/lib/pricing.ts.
//
// Plans are sold by contract (owner decision, 2026-10-04): there is no self-serve plan
// checkout and so no plan amount here. src/lib/checkout.functions.ts refuses plan purchases
// and points to the contract request (/contact?plan=<id>).

export type PlanId = "starter" | "growth" | "pro";

/** The currencies the old self-serve checkout took; still accepted in its input. */
export type Currency = "eur" | "ron";

export const PLAN_LABELS: Record<PlanId, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
};

export function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "growth" || value === "pro";
}

export function isCurrency(value: unknown): value is Currency {
  return value === "eur" || value === "ron";
}

// Shared plan definitions used by both the pricing UI and the server-side
// checkout. Amounts are stored in minor units (cents / bani) and keyed by
// currency so the client can never tamper with the charged price.

export type PlanId = "starter" | "growth" | "pro";
export type Currency = "eur" | "ron";

export interface PlanPricing {
  /** Amount in minor units (e.g. 2000 = 20.00). */
  eur: number;
  ron: number;
}

export const PLAN_PRICING: Record<PlanId, PlanPricing> = {
  starter: { eur: 2000, ron: 10000 },
  growth: { eur: 5000, ron: 25000 },
  pro: { eur: 20000, ron: 100000 },
};

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

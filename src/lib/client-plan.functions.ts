import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ClientPlanId, ResearchAllowance } from "@/lib/client-plans";
import type { PlanDb } from "@/lib/client-plans.server";

/*
 * The signed-in client's plan for the dashboard (overview and billing). Read on the server with
 * the service role, because the deep research count comes from deep_runs, which clients cannot
 * read. Before drizzle/pending/client_plans.sql is applied (or when a read fails) the
 * answer is "unavailable" and the dashboard shows nothing about plans.
 */

export type MyPlan =
  | { status: "unavailable" }
  | { status: "none" }
  | {
      status: "active";
      plan: {
        id: ClientPlanId;
        /** "scheduled": the contract starts on a later day. */
        state: "current" | "scheduled";
        startsOn: string;
        endsOn: string | null;
        contractRef: string | null;
        hoursPerMonth: number;
        /**
         * Deep research comes with this plan now (DEEP_RESEARCH_MODE premium or code, and the
         * plan listed in DEEP_RESEARCH_PREMIUM_TIERS), so the gate can say when it starts.
         */
        researchIncluded: boolean;
      };
      /**
       * Deep research this period, only while clients can use it (DEEP_RESEARCH_MODE premium
       * or code) and the plan includes it (DEEP_RESEARCH_PREMIUM_TIERS); otherwise null, so
       * nothing is listed before it exists.
       */
      research: ResearchAllowance | null;
    };

/** The React Query key of getMyPlan, shared by the dashboard's plan card and the deep gate. */
export const myPlanQueryKey = (userId: string | undefined) => ["my-plan", userId] as const;

export const getMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPlan> => {
    const { deepDb } = await import("@/lib/deep/persist-db.server");
    const { readClientPlans } = await import("@/lib/client-plans.server");
    const { CLIENT_PLANS, isClientPlanId, planState, romanianDate } =
      await import("@/lib/client-plans");
    const db = deepDb();
    if (!db) return { status: "unavailable" };
    // The hand-written deep schema has no client_plans (it may not exist): read it untyped.
    const read = await readClientPlans(db as unknown as PlanDb, context.userId);
    if (!read.ok) return { status: "unavailable" };
    const today = romanianDate(Date.now());
    // The plan in force, else one that starts later (an assigned contract not begun yet).
    const pick = (state: "current" | "scheduled") =>
      read.value.find((r) => isClientPlanId(r.plan) && planState(r, today) === state);
    const row = pick("current") ?? pick("scheduled");
    if (!row || !isClientPlanId(row.plan)) return { status: "none" };
    const state = planState(row, today) as "current" | "scheduled";

    let researchIncluded = false;
    let research: ResearchAllowance | null = null;
    try {
      const { readDeepConfig } = await import("@/lib/deep/env.server");
      const config = readDeepConfig();
      researchIncluded =
        (config.mode === "premium" || config.mode === "code") &&
        config.premiumTiers.includes(row.plan);
      if (researchIncluded && state === "current") {
        const { researchAllowance } = await import("@/lib/deep/access.server");
        const { storeForNewRun } = await import("@/lib/deep/persist.server");
        const store = await storeForNewRun().catch(() => null);
        research = await researchAllowance(context.userId, row.plan, "contract", { store });
      }
    } catch {
      research = null;
    }

    return {
      status: "active",
      plan: {
        id: row.plan,
        state,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
        contractRef: row.contract_ref,
        hoursPerMonth: CLIENT_PLANS[row.plan].hoursPerMonth,
        researchIncluded,
      },
      research,
    };
  });

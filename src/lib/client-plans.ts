/*
 * Client plans (owner decision, 2026-10-04): Starter, Growth and Pro are sold by contract,
 * then an admin assigns the plan to the client's account (admin panel, "Plans"; table
 * public.client_plans, drizzle/pending/client_plans.sql). What a plan unlocks in the
 * app: the hours it includes each month (shown to the client) and its deep research reports
 * per period (src/lib/deep/access.server.ts, while DEEP_RESEARCH_MODE is premium).
 * Prices are not here: they live with the pricing section (src/lib/pricing.ts;
 * scripts/scan/check-display.ts checks that the hours and reports agree).
 *
 * Pure (no I/O, no environment): imported by the browser and the server.
 */

export const CLIENT_PLAN_IDS = ["starter", "growth", "pro"] as const;
export type ClientPlanId = (typeof CLIENT_PLAN_IDS)[number];
export type ResearchPeriod = "month" | "quarter";

export type ClientPlanSpec = {
  label: string;
  /** Staff hours included each month. */
  hoursPerMonth: number;
  /** Deep research reports included per calendar period (Romanian time). */
  research: { reports: number; period: ResearchPeriod };
};

export const CLIENT_PLANS: Record<ClientPlanId, ClientPlanSpec> = {
  starter: { label: "Starter", hoursPerMonth: 1, research: { reports: 1, period: "quarter" } },
  growth: { label: "Growth", hoursPerMonth: 4, research: { reports: 2, period: "month" } },
  pro: { label: "Pro", hoursPerMonth: 10, research: { reports: 5, period: "month" } },
};

export function isClientPlanId(value: unknown): value is ClientPlanId {
  return typeof value === "string" && (CLIENT_PLAN_IDS as readonly string[]).includes(value);
}

export type ClientPlanStatus = "active" | "ended";

/** A row of public.client_plans. starts_on / ends_on are calendar days in Romania, inclusive. */
export type ClientPlanRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  starts_on: string;
  ends_on: string | null;
  contract_ref: string | null;
  assigned_by: string | null;
  ended_at: string | null;
  ended_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Where a plan comes from: a contract assigned by an admin, or a (Stripe) subscription. */
export type PlanSource = "contract" | "subscription";

/** The deep research a plan includes this period, as the client and the admin see it. */
export type ResearchAllowance = {
  plan: string;
  source: PlanSource;
  /** Reports per period; null: no per-plan limit (a tier listed with no quota, daily caps only). */
  reports: number | null;
  period: ResearchPeriod | null;
  /** Reports started this period (failed and canceled runs do not count); null = unknown. */
  used: number | null;
  /** When the next period starts (ISO instant), or null without a period. */
  renewsAt: string | null;
};

/** An account found in the admin panel's plan search, with its active plan (if any). */
export type AccountMatch = {
  id: string;
  email: string | null;
  fullName: string | null;
  company: string | null;
  /** The account's active row and how it stands today; null without one or without the table. */
  plan: { id: string; plan: string; state: PlanState } | null;
};

/* ------------------------------------------------------------- Romanian time */

const TZ = "Europe/Bucharest";
let wallFormat: Intl.DateTimeFormat | undefined;

/** The wall-clock time in Romania at instant `t`, read as if it were UTC (ms). */
function wallClock(t: number): number {
  wallFormat ??= new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = wallFormat.formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
}

/** Midnight at the start of the given day in Romania (month 1–12; overflow rolls over). */
function romanianMidnight(year: number, month: number, day: number): number {
  const local = Date.UTC(year, month - 1, day);
  // Romania changes the clock at 03:00/04:00, never at midnight, so this settles in two steps.
  let t = local - (wallClock(local) - local);
  const again = local - (wallClock(t) - t);
  if (again !== t) t = again;
  return t;
}

/** Today's date in Romania, "YYYY-MM-DD". */
export function romanianDate(now: number): string {
  return new Date(wallClock(now)).toISOString().slice(0, 10);
}

/**
 * The calendar period (Romanian time) that contains `now`: a month, or a quarter
 * (January–March, April–June, July–September, October–December). Epoch ms, end exclusive.
 */
export function researchPeriod(
  period: ResearchPeriod,
  now: number,
): { start: number; end: number } {
  const wall = new Date(wallClock(now));
  const year = wall.getUTCFullYear();
  const month = wall.getUTCMonth() + 1;
  const first = period === "month" ? month : Math.floor((month - 1) / 3) * 3 + 1;
  const length = period === "month" ? 1 : 3;
  return {
    start: romanianMidnight(year, first, 1),
    end: romanianMidnight(year, first + length, 1),
  };
}

/* ------------------------------------------------------------------- state */

export type PlanState = "current" | "scheduled" | "expired" | "ended";

/** How a row stands on `today` ("YYYY-MM-DD", Romania). */
export function planState(
  row: Pick<ClientPlanRow, "status" | "starts_on" | "ends_on">,
  today: string,
): PlanState {
  if (row.status !== "active") return "ended";
  if (row.starts_on > today) return "scheduled";
  if (row.ends_on && row.ends_on < today) return "expired";
  return "current";
}

/** The plan in force on `today`, or null; with several (never, by the unique index), the newest. */
export function currentPlan<R extends ClientPlanRow>(rows: R[], today: string): R | null {
  return (
    rows
      .filter((r) => isClientPlanId(r.plan) && planState(r, today) === "current")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

/* -------------------------------------------------------------------- copy */

type Lang = "en" | "ro";

/** Romanian plural: 1 → "1 oră", 2–19 → "4 ore", 20 and up → "20 de ore" (by the last two digits). */
function roCount(n: number, one: string, few: string): string {
  if (n === 1) return `1 ${one}`;
  const rest = n % 100;
  return n === 0 || (rest >= 1 && rest <= 19) ? `${n} ${few}` : `${n} de ${few}`;
}

/** "4 ore pe lună" / "4 hours a month". */
export function hoursPerMonthLabel(hours: number, lang: Lang): string {
  return lang === "ro"
    ? `${roCount(hours, "oră", "ore")} pe lună`
    : `${hours} ${hours === 1 ? "hour" : "hours"} a month`;
}

/** "2 rapoarte pe lună" / "1 raport pe trimestru" / "2 reports a month". */
export function reportsLabel(reports: number, period: ResearchPeriod, lang: Lang): string {
  if (lang === "ro")
    return `${roCount(reports, "raport", "rapoarte")} pe ${period === "month" ? "lună" : "trimestru"}`;
  return `${reports} ${reports === 1 ? "report" : "reports"} a ${period}`;
}

/** "1 oct. 2026" from a calendar day ("YYYY-MM-DD"), never shifted by the viewer's time zone. */
export function formatPlanDay(day: string, lang: Lang): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(lang === "ro" ? "ro-RO" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "1 noiembrie" from an instant, in Romanian time (the day the next period starts); never split. */
export function formatRenewalDay(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString(lang === "ro" ? "ro-RO" : "en-GB", {
      day: "numeric",
      month: "long",
      timeZone: TZ,
    })
    .replace(/ /g, "\u00a0");
}

import type { RateRule } from "./rate-limit.server";

/*
 * The limits, in one place. Per hashed address (ip.server.ts) unless noted. A person filling a
 * form or running a few scans never comes close; a script does within minutes. Offices and
 * mobile networks share addresses, so the limits are generous rather than tight. Requests
 * without an address (local dev) share one key with 10 times the limits.
 *
 * One quick scan makes about 10 calls: up to 3 company lookups, 1 website search, 3 site
 * audits (the site and two competitors), 1 PageSpeed, 1 presence check and 1 blueprint
 * (again after each edit).
 */

const MIN = 60;
const HOUR = 3600;
const DAY = 86_400;

export const RULES = {
  /** The contact form (enquiries, "Cere contractul", "Programează"). */
  contact: {
    bucket: "contact",
    windows: [
      { limit: 5, seconds: 10 * MIN },
      { limit: 20, seconds: DAY },
    ],
  },
  /** The scan's lead gate (the PDF). */
  lead: {
    bucket: "lead",
    windows: [
      { limit: 8, seconds: 10 * MIN },
      { limit: 40, seconds: DAY },
    ],
  },
  /** A consultation alert, per signed-in account. */
  consultation: { bucket: "consultation", windows: [{ limit: 10, seconds: HOUR }] },
  "scan.company": { bucket: "scan.company", windows: [{ limit: 60, seconds: 10 * MIN }] },
  "scan.discover": {
    bucket: "scan.discover",
    windows: [
      { limit: 15, seconds: HOUR },
      { limit: 60, seconds: DAY },
    ],
  },
  "scan.website": {
    bucket: "scan.website",
    windows: [
      { limit: 45, seconds: HOUR },
      { limit: 180, seconds: DAY },
    ],
  },
  "scan.pagespeed": {
    bucket: "scan.pagespeed",
    windows: [
      { limit: 15, seconds: HOUR },
      { limit: 60, seconds: DAY },
    ],
  },
  "scan.presence": { bucket: "scan.presence", windows: [{ limit: 20, seconds: HOUR }] },
  "scan.blueprint": { bucket: "scan.blueprint", windows: [{ limit: 60, seconds: HOUR }] },
  /** Confirmation e-mails, per recipient (hashed e-mail): someone else's address cannot be flooded. */
  confirmation: { bucket: "confirmation", windows: [{ limit: 2, seconds: DAY }] },
} satisfies Record<string, RateRule>;

export type RuleName = keyof typeof RULES;

/** Limits multiplier for requests without an address (one shared key). */
export const NO_ADDRESS_SCALE = 10;

/**
 * Daily caps shared by every visitor, with the environment variable that overrides each
 * (a whole number; 0 turns that call off for the day). Defaults:
 * - brave: the quick scan's last-resort web search. Brave bills $5 per 1,000 calls with a $5
 *   monthly credit, so 30 a day stays inside the credit over a month.
 * - pagespeed: Google's PageSpeed Insights API (free, quota-bound). 300 a day is far above
 *   real traffic and keeps a flood from using up the quota the deep research also needs.
 * - email: e-mails sent through Resend (alerts and confirmations together); the free plan
 *   allows 100 a day.
 */
export const DAILY_CAPS = {
  brave: { env: "SCAN_DAILY_CAP_BRAVE", fallback: 30 },
  pagespeed: { env: "SCAN_DAILY_CAP_PAGESPEED", fallback: 300 },
  email: { env: "ALERT_EMAIL_DAILY_CAP", fallback: 90 },
} as const;

export type CapName = keyof typeof DAILY_CAPS;

/** The cap in force: the env value when it is a whole number from 0 to 100,000, else the default. */
export function dailyCap(name: CapName, env: Record<string, string | undefined>): number {
  const { env: variable, fallback } = DAILY_CAPS[name];
  const raw = env[variable]?.trim();
  if (!raw || !/^\d{1,6}$/.test(raw)) return fallback;
  const value = Number(raw);
  return value <= 100_000 ? value : fallback;
}

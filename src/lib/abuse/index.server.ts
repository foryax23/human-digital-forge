import process from "node:process";

import { getRequest } from "@tanstack/react-start/server";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { clientIp, hashKey, hashSalt, utcDay } from "./ip.server";
import { dailyCap, NO_ADDRESS_SCALE, RULES, type CapName, type RuleName } from "./limits.server";
import {
  checkRate,
  memoryCounter,
  postgresCounter,
  withinDailyCap,
  type RateVerdict,
  type RpcDb,
} from "./rate-limit.server";
import { turnstileKeys, verifyTurnstile } from "./turnstile.server";

/*
 * Abuse protection for the public server functions (contact form, lead gate, quick scan):
 * per-address rate limits, Turnstile when its keys are set, and the daily caps on Brave
 * Search and PageSpeed. Server only. Env is read per call (Workers bind it per request).
 */

/** The friendly refusals, as the forms show them. */
export const TOO_MANY = {
  ro: "Prea multe cereri, încearcă din nou peste câteva minute.",
  en: "Too many requests. Please try again in a few minutes.",
};

/**
 * What a scan step throws when its address is over the limit. The scan UI shows its usual
 * "failed" note; the message starts with "rate_limited" so it can tell the two apart.
 */
export class RateLimitedError extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`rate_limited: ${TOO_MANY.ro}`);
    this.name = "RateLimitedError";
  }
}

const env = () => process.env as Record<string, string | undefined>;

/** The service-role client, or null when this server has no database access (local dev). */
function adminDb(): RpcDb | null {
  const e = env();
  if (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) return null;
  return supabaseAdmin as unknown as RpcDb;
}

const memory = memoryCounter();
/** Postgres when drizzle/pending/rate_limits.sql is applied, this isolate's memory until then. */
export const intakeCounter = postgresCounter(adminDb, memory);

function currentRequest(): Request | null {
  try {
    return getRequest() ?? null;
  } catch {
    return null;
  }
}

/** The caller's address (cf-connecting-ip) or null. Never stored or logged. */
export function requestIp(): string | null {
  return clientIp(currentRequest()?.headers);
}

async function addressKey(ip: string | null, now: number): Promise<string> {
  if (!ip) return "no-address";
  return hashKey(ip, { salt: hashSalt(env()), day: utcDay(now), purpose: "ip" });
}

/** Counts this request against the rule for the caller's address. */
export async function limitByAddress(rule: RuleName, now = Date.now()): Promise<RateVerdict> {
  const ip = requestIp();
  const key = await addressKey(ip, now);
  return checkRate(intakeCounter, RULES[rule], key, {
    now,
    scale: ip ? 1 : NO_ADDRESS_SCALE,
  });
}

/** Counts against the rule for any other identifier (an account ID, an e-mail), hashed. */
export async function limitByKey(
  rule: RuleName,
  value: string,
  now = Date.now(),
): Promise<RateVerdict> {
  const key = await hashKey(value.trim().toLowerCase(), {
    salt: hashSalt(env()),
    day: utcDay(now),
    purpose: rule,
  });
  return checkRate(intakeCounter, RULES[rule], key, { now });
}

/** For a scan step: throws RateLimitedError when the caller is over the limit. */
export async function assertScanAllowed(rule: RuleName): Promise<void> {
  const verdict = await limitByAddress(rule);
  if (!verdict.ok) throw new RateLimitedError(verdict.retryAfterSec);
}

/** One call against a shared daily cap; logs once a day when the cap is reached. */
export async function dailyCapAllows(name: CapName, now = Date.now()): Promise<boolean> {
  const limit = dailyCap(name, env());
  return withinDailyCap(intakeCounter, name, limit, {
    now,
    onReached: () => console.warn(`[abuse] daily cap reached: ${name} (${limit} today, UTC)`),
  });
}

/** The public Turnstile site key, only when the server can verify its tokens too. */
export function turnstileSiteKey(): string | null {
  return turnstileKeys(env())?.siteKey ?? null;
}

export type IntakeRefusal =
  | { ok: false; reason: "rate_limited"; retryAfterSec: number }
  | { ok: false; reason: "verification"; detail: "missing" | "expired" | "invalid" };

/**
 * The gate of a public form: the address's rate limit first (cheap), then Turnstile when it
 * is on. Returns null when the request may go on.
 */
export async function guardForm(
  rule: "contact" | "lead",
  turnstileToken: string | undefined,
): Promise<IntakeRefusal | null> {
  const verdict = await limitByAddress(rule);
  if (!verdict.ok)
    return { ok: false, reason: "rate_limited", retryAfterSec: verdict.retryAfterSec };
  const keys = turnstileKeys(env());
  if (!keys) return null;
  const check = await verifyTurnstile(turnstileToken, {
    secret: keys.secret,
    ip: requestIp(),
    action: rule,
  });
  return check.ok ? null : { ok: false, reason: "verification", detail: check.reason };
}

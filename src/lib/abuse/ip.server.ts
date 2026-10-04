/*
 * The visitor's address, only ever as a hash. Cloudflare sets cf-connecting-ip on every
 * request it forwards (a client cannot spoof it there); x-forwarded-for is not trusted. The
 * hash mixes in a secret (RATE_LIMIT_SALT when the owner sets one, else a fixed salt) and the
 * UTC day, so a stored key cannot be linked to an address or to the same visitor tomorrow.
 */

/** cf-connecting-ip, or null (local dev, or a request that did not come through Cloudflare). */
export function clientIp(headers: Headers | undefined | null): string | null {
  const value = headers?.get("cf-connecting-ip")?.trim();
  if (!value || value.length > 64 || !/^[0-9a-f:.]+$/i.test(value)) return null;
  return value.toLowerCase();
}

/** "YYYY-MM-DD" in UTC. */
export function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

const FIXED_SALT = "vortex-intake-v1";

/** The salt for hashed keys: RATE_LIMIT_SALT when set (any string of 16+ characters), else the fixed one. */
export function hashSalt(env: Record<string, string | undefined>): string {
  const own = env.RATE_LIMIT_SALT?.trim();
  return own && own.length >= 16 ? own : FIXED_SALT;
}

/** SHA-256 of salt, day, purpose and value; the first 32 hex characters (128 bits). */
export async function hashKey(
  value: string,
  opts: { salt: string; day: string; purpose: string },
): Promise<string> {
  const input = new TextEncoder().encode(`${opts.salt}|${opts.day}|${opts.purpose}|${value}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/*
 * Cloudflare Turnstile, verified on the server. Off unless the owner sets both
 * TURNSTILE_SITE_KEY (public, sent to the browser) and TURNSTILE_SECRET_KEY (server only):
 * with one of them missing nothing renders and nothing is checked.
 *
 * A token Cloudflare rejects fails the request. Cloudflare being unreachable, or rejecting
 * our own secret (a pasting mistake), lets the request through with a log line: the rate
 * limits still apply, and a broken key must not turn every enquiry away.
 */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileKeys = { siteKey: string; secret: string } | null;

/** Both keys, or null (Turnstile off). */
export function turnstileKeys(env: Record<string, string | undefined>): TurnstileKeys {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim();
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  return siteKey && secret ? { siteKey, secret } : null;
}

export type TurnstileVerdict =
  | { ok: true; checked: boolean }
  | { ok: false; reason: "missing" | "expired" | "invalid" };

type SiteverifyBody = { success?: boolean; "error-codes"?: string[] };

const OWN_MISTAKES = new Set(["missing-input-secret", "invalid-input-secret"]);

export async function verifyTurnstile(
  token: string | undefined | null,
  opts: {
    secret: string;
    ip?: string | null;
    /** What the widget was rendered for ("contact", "lead"); checked when Cloudflare returns it. */
    action?: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
    log?: (message: string) => void;
  },
): Promise<TurnstileVerdict> {
  const log = opts.log ?? ((message: string) => console.warn(message));
  const value = token?.trim();
  if (!value) return { ok: false, reason: "missing" };
  if (value.length > 2048) return { ok: false, reason: "invalid" };

  const body = new FormData();
  body.set("secret", opts.secret);
  body.set("response", value);
  if (opts.ip) body.set("remoteip", opts.ip);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const response = await (opts.fetch ?? fetch)(SITEVERIFY, {
      method: "POST",
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      log(`[abuse] turnstile siteverify answered ${response.status}; request let through`);
      return { ok: true, checked: false };
    }
    const data = (await response.json()) as SiteverifyBody & { action?: string };
    if (data.success) {
      if (opts.action && data.action && data.action !== opts.action) {
        return { ok: false, reason: "invalid" };
      }
      return { ok: true, checked: true };
    }
    const codes = data["error-codes"] ?? [];
    if (codes.some((code) => OWN_MISTAKES.has(code))) {
      console.error("[abuse] TURNSTILE_SECRET_KEY was rejected by Cloudflare; request let through");
      return { ok: true, checked: false };
    }
    return {
      ok: false,
      reason: codes.includes("timeout-or-duplicate") ? "expired" : "invalid",
    };
  } catch {
    log("[abuse] turnstile siteverify unreachable; request let through");
    return { ok: true, checked: false };
  } finally {
    clearTimeout(timer);
  }
}

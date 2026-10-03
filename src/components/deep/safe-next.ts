/*
 * Where /login and /register may send a person after signing in (plan A10). `next` and
 * `redirect` come from the address bar, so they only ever name a path on this site: they
 * must start with "/", never with "//" or "/\" (both mean another host in a browser), and
 * contain no "@", no backslash and no control characters. Anything else is ignored.
 */

export function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  if (!next.startsWith("/") || next.startsWith("//")) return undefined;
  if (next.includes("@") || next.includes("\\")) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(next)) return undefined;
  if (next.length > 512) return undefined;
  return next;
}

/** The deep research route, where the login returns while a deep target is pending. */
export const DEEP_PATH = "/scan/deep";

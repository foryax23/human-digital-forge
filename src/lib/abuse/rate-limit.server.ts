/*
 * Fixed-window counters for the public intake (contact form, scan lead, quick scan) and the
 * daily caps on paid or quota-bound APIs. Pure: the store is injected, so the tests run it
 * against a fake database and the wiring (index.server.ts) picks Postgres or memory.
 *
 * - Postgres (drizzle/pending/rate_limits.sql, function public.intake_rate_hit): one counter
 *   shared by every Worker isolate. Until the owner applies that file the function is
 *   missing (PGRST202 / 42883); the store notices, says so once and counts in memory.
 * - Memory: per isolate, so a flood spread over many isolates is only slowed down. It is the
 *   fallback, never the plan.
 *
 * Keys are hashes (ip.server.ts), never raw addresses.
 */

export type RateWindow = { limit: number; seconds: number };
export type RateRule = { bucket: string; windows: RateWindow[] };

export type RateVerdict = { ok: true } | { ok: false; retryAfterSec: number };

/** Counts one hit for (bucket, key) in the fixed window of `seconds` that holds `now`; returns the window's count. */
export type CounterStore = {
  hit(bucket: string, key: string, seconds: number, now: number): Promise<number>;
};

/** Start of the fixed window (epoch seconds) holding `now`; days start at 00:00 UTC. */
export function windowStart(now: number, seconds: number): number {
  return Math.floor(now / 1000 / seconds) * seconds;
}

/** Seconds until the window holding `now` ends (at least 1). */
export function secondsLeft(now: number, seconds: number): number {
  return Math.max(1, windowStart(now, seconds) + seconds - Math.floor(now / 1000));
}

/**
 * Per-isolate counters, at most `maxKeys` windows (expired ones go first, then the oldest),
 * so a flood of distinct keys cannot grow memory without bound.
 */
export function memoryCounter(maxKeys = 10_000): CounterStore & { size(): number } {
  const windows = new Map<string, { ends: number; count: number }>();
  const prune = (nowSec: number) => {
    for (const [id, w] of windows) if (w.ends <= nowSec) windows.delete(id);
    while (windows.size >= maxKeys) windows.delete(windows.keys().next().value as string);
  };
  return {
    async hit(bucket, key, seconds, now) {
      const start = windowStart(now, seconds);
      const id = `${bucket}|${seconds}|${key}|${start}`;
      let w = windows.get(id);
      if (!w) {
        if (windows.size >= maxKeys) prune(Math.floor(now / 1000));
        w = { ends: start + seconds, count: 0 };
        windows.set(id, w);
      }
      w.count += 1;
      return w.count;
    },
    size: () => windows.size,
  };
}

type DbError = { code?: string; message?: string } | null | undefined;

/** The query surface used here (supabase-js, or the tests' fake). Untyped: the function is not in the generated types yet. */
export type RpcDb = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: DbError }>;
};

/** PostgREST "function/table not in the schema cache" or Postgres "undefined function/table". */
export function isMissingCounter(error: DbError): boolean {
  const code = error?.code;
  return code === "PGRST202" || code === "PGRST205" || code === "42883" || code === "42P01";
}

/**
 * The shared counter: public.intake_rate_hit(p_bucket, p_key, p_window_seconds) returns the
 * window's count after this hit. `db` returns null when the server has no database access
 * (local dev without the service key): memory then. A missing function switches to memory
 * for `retryMs` (then it looks again, so applying the SQL takes effect without a deploy);
 * any other failure uses memory for that one hit. Never throws.
 */
export function postgresCounter(
  db: () => RpcDb | null,
  fallback: CounterStore,
  opts: { retryMs?: number; log?: (message: string) => void } = {},
): CounterStore & { usingMemory(now?: number): boolean } {
  const retryMs = opts.retryMs ?? 10 * 60_000;
  const log = opts.log ?? ((message: string) => console.warn(message));
  let missingUntil = 0;
  let warned = false;
  return {
    async hit(bucket, key, seconds, now) {
      if (now < missingUntil) return fallback.hit(bucket, key, seconds, now);
      let client: RpcDb | null = null;
      try {
        client = db();
      } catch {
        client = null;
      }
      if (!client) return fallback.hit(bucket, key, seconds, now);
      try {
        const { data, error } = await client.rpc("intake_rate_hit", {
          p_bucket: bucket,
          p_key: key,
          p_window_seconds: seconds,
        });
        if (error) {
          if (isMissingCounter(error)) {
            missingUntil = now + retryMs;
            if (!warned) {
              warned = true;
              log(
                "[abuse] rate counter not installed (drizzle/pending/rate_limits.sql); counting per isolate",
              );
            }
          } else {
            log(`[abuse] rate counter error ${error.code ?? "unknown"}; counting per isolate`);
          }
          return fallback.hit(bucket, key, seconds, now);
        }
        const count = typeof data === "number" ? data : Number(data);
        return Number.isFinite(count) ? count : fallback.hit(bucket, key, seconds, now);
      } catch {
        return fallback.hit(bucket, key, seconds, now);
      }
    },
    usingMemory: (now = Date.now()) => now < missingUntil,
  };
}

/**
 * Counts one request against every window of the rule (in parallel) and refuses it when any
 * window is over its limit. `scale` multiplies the limits (a shared key, e.g. no address).
 * A store failure lets the request through: the limits slow abuse, they must not lock out
 * customers.
 */
export async function checkRate(
  store: CounterStore,
  rule: RateRule,
  key: string,
  opts: { now?: number; scale?: number } = {},
): Promise<RateVerdict> {
  const now = opts.now ?? Date.now();
  const scale = opts.scale ?? 1;
  const counts = await Promise.all(
    rule.windows.map((w) => store.hit(rule.bucket, key, w.seconds, now).catch(() => 0)),
  );
  let retryAfterSec = 0;
  rule.windows.forEach((w, i) => {
    if (counts[i] > w.limit * scale) {
      retryAfterSec = Math.max(retryAfterSec, secondsLeft(now, w.seconds));
    }
  });
  return retryAfterSec > 0 ? { ok: false, retryAfterSec } : { ok: true };
}

export const DAY_SECONDS = 86_400;

/**
 * One call against a daily cap shared by all visitors (key "all"), e.g. Brave Search. True
 * while the day's count is within `limit`; a limit of 0 means none today. The day turns at
 * 00:00 UTC. `onReached` runs once, on the first refused call of the day.
 */
export async function withinDailyCap(
  store: CounterStore,
  name: string,
  limit: number,
  opts: { now?: number; onReached?: (count: number) => void } = {},
): Promise<boolean> {
  if (limit <= 0) return false;
  const now = opts.now ?? Date.now();
  let count: number;
  try {
    count = await store.hit(`cap:${name}`, "all", DAY_SECONDS, now);
  } catch {
    // The store never throws; if it ever does, a paid API stays closed rather than open.
    return false;
  }
  if (count === limit + 1) opts.onReached?.(count);
  return count <= limit;
}

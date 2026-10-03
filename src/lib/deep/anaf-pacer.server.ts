/*
 * ANAF client with the run-wide pacer (plan A3, D6). ANAF's terms allow about
 * one request per second; a deep run makes at most 9 calls (start 1, money 7,
 * peers 1), at least 1.1 s apart across the whole run. Each step receives the
 * earliest start time from the previous ANAF step (attested `next.anafNextAt`,
 * and the ticket's `anafAt`), waits on the server until then, and spaces its own
 * calls. Within one isolate a module-level clock also spaces calls of
 * concurrent runs: each slot is booked synchronously before the wait, so
 * concurrent callers queue 1.1 s apart (isolates do not share it). A 429 gets one retry
 * after 2 s when the step still has quota and time, otherwise a gap.
 * Fetch is injected, so the same code runs on Workers, in Node and in tests.
 */

export const ANAF_GAP_MS = 1100;
/** Booked on top of the gap: the request leaves a few ms after its slot. */
const MARGIN_MS = 25;
export const ANAF_RUN_MAX = 9;
export const ANAF_STEP_QUOTA = { start: 1, money: 7, peers: 1 } as const;

const V9_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
const BILANT_URL = "https://webservicesp.anaf.ro/bilant";

export class AnafLimitError extends Error {
  constructor(
    readonly kind: "quota" | "deadline" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "AnafLimitError";
  }
}

let isolateLastStart = 0;

export type AnafDeps = {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Earliest start of the first call (from the previous ANAF step or the ticket). */
  startAt: number;
  /** Calls this step may make. */
  quota: number;
  /** Absolute deadline of the step (ms epoch). */
  deadline: number;
  userAgent: string;
  log?: (event: Record<string, unknown>) => void;
  /** Shares the isolate clock (default true; tests turn it off). */
  shareIsolateClock?: boolean;
};

export type AnafClient = {
  /** One batch call for up to 100 CUIs; returns the `found` records. */
  v9(cuis: string[]): Promise<unknown[]>;
  /** One annual-accounts call; the raw answer (`i: []` when nothing was filed). */
  bilant(cui: string, year: number): Promise<unknown>;
  /** Earliest start of the next ANAF call: hand it to the next ANAF step. */
  nextAt(): number;
  calls(): number;
  /** Calls left in this step's quota. */
  left(): number;
};

export function createAnafClient(deps: AnafDeps): AnafClient {
  const share = deps.shareIsolateClock !== false;
  let next = Math.max(deps.startAt, share ? isolateLastStart + ANAF_GAP_MS + MARGIN_MS : 0);
  let used = 0;

  async function slot(timeoutMs: number) {
    if (used >= deps.quota) throw new AnafLimitError("quota", "ANAF call quota for this step used");
    const startAt = Math.max(
      next,
      deps.now(),
      share ? isolateLastStart + ANAF_GAP_MS + MARGIN_MS : 0,
    );
    if (startAt + timeoutMs > deps.deadline) {
      throw new AnafLimitError("deadline", "Not enough time left in this step for an ANAF call");
    }
    // The slot is booked before sleeping (no await in between): concurrent callers in this
    // isolate, of this run or of another, queue 1.1 s apart instead of waking together.
    used++;
    // A small margin: the request leaves a few ms after the slot.
    next = startAt + ANAF_GAP_MS + MARGIN_MS;
    if (share) isolateLastStart = Math.max(isolateLastStart, startAt);
    const wait = startAt - deps.now();
    if (wait > 0) await deps.sleep(wait);
    return deps.now();
  }

  async function call(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    label: string,
  ): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const started = await slot(timeoutMs);
      let response: Response;
      try {
        const pending = deps.fetch(url, {
          ...init,
          headers: {
            accept: "application/json",
            "user-agent": deps.userAgent,
            ...(init.headers ?? {}),
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
        // Re-booked once the request has really left (a busy event loop must not shorten the gap).
        next = Math.max(next, deps.now() + ANAF_GAP_MS + MARGIN_MS);
        if (share) isolateLastStart = Math.max(isolateLastStart, deps.now());
        response = await pending;
      } catch (error) {
        deps.log?.({
          anaf: label,
          error: String((error as Error)?.message ?? error),
          ms: deps.now() - started,
        });
        throw new AnafLimitError("unavailable", `ANAF did not answer (${label})`);
      }
      deps.log?.({ anaf: label, status: response.status, ms: deps.now() - started, at: started });
      if (response.status === 429 && attempt === 0 && used < deps.quota) {
        await response.body?.cancel().catch(() => undefined);
        next = Math.max(next, deps.now() + 2000);
        continue;
      }
      return response;
    }
  }

  return {
    async v9(cuis) {
      const day = new Date(deps.now()).toISOString().slice(0, 10);
      const body = JSON.stringify(
        cuis.slice(0, 100).map((cui) => ({ cui: Number(cui), data: day })),
      );
      const response = await call(
        V9_URL,
        { method: "POST", body, headers: { "content-type": "application/json" } },
        8000,
        `v9 x${cuis.length}`,
      );
      // An unknown CUI comes back as 404 with {"found":[],"notFound":[cui]}.
      if (!response.ok && response.status !== 404) {
        throw new AnafLimitError("unavailable", `ANAF v9 answered ${response.status}`);
      }
      const data = (await response.json().catch(() => null)) as { found?: unknown[] } | null;
      if (!data) throw new AnafLimitError("unavailable", "ANAF v9 answer unreadable");
      return Array.isArray(data.found) ? data.found : [];
    },
    async bilant(cui, year) {
      const response = await call(
        `${BILANT_URL}?an=${year}&cui=${encodeURIComponent(cui)}`,
        {},
        4000,
        `bilant ${year}`,
      );
      if (!response.ok)
        throw new AnafLimitError("unavailable", `ANAF bilanț answered ${response.status}`);
      // A real answer is JSON with the year and an indicator list (empty when nothing was
      // filed). Anything else (a firewall page with HTTP 200, a truncated body) is "ANAF did
      // not answer", never "no filing".
      const data = (await response.json().catch(() => null)) as {
        an?: unknown;
        i?: unknown;
      } | null;
      if (!data || typeof data !== "object" || !Array.isArray(data.i) || data.an === undefined) {
        throw new AnafLimitError("unavailable", "ANAF bilanț answer unreadable");
      }
      return data;
    },
    nextAt: () => next,
    calls: () => used,
    left: () => deps.quota - used,
  };
}

/** Test hook: forget the isolate clock. */
export function resetAnafIsolateClock() {
  isolateLastStart = 0;
}

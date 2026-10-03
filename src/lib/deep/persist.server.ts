import type { DeepStore, StoreKind } from "./contracts";
import { createMemoryStore, type MemoryStore } from "./llm/ledger-memory.server";
import { deepDb, isMissingRelation, type DeepDb } from "./persist-db.server";
import { createStopgapStore, type StopgapStore } from "./persist-stopgap.server";
import { createTablesStore } from "./persist-tables.server";

/*
 * Store selection for "Cercetare aprofundată" (plan A6, D16).
 *
 * - Feature detection decides the store only for NEW runs: the server tables
 *   of docs/deep/2026-10-03-deep-research.sql when they exist, else the
 *   stopgap in audit_leads. "Tables missing" (PGRST205 / 42P01) is cached for
 *   5 minutes, "tables present" for 1 hour; any other error means the ledger
 *   is unavailable and startDeepRun refuses ("ledger_unavailable").
 * - The store kind is written into the run ticket and a run never switches
 *   store (storeFor). Any ledger error during a reservation means that paid
 *   call is not sent (fail closed, in the stores themselves).
 * - No Supabase credentials on the server: no store (refused), never a silent
 *   in-memory fallback. The in-memory ledger stays for tests and the golden
 *   script, and for tickets issued before this change ("memory").
 */

export type TablesStore = ReturnType<typeof createTablesStore>;
export type PersistentStore = TablesStore | StopgapStore;

type Detection = { kind: StoreKind; until: number };
let detected: Detection | undefined;

const MISSING_TTL_MS = 5 * 60_000;
const PRESENT_TTL_MS = 60 * 60_000;

/** Test hook: forget the cached detection. */
export function resetStoreDetection() {
  detected = undefined;
}

export type PersistDeps = {
  db?: DeepDb | null;
  now?: () => number;
};

/**
 * Which store the tables' presence selects: "tables", "stopgap", or null when
 * the ledger cannot be reached. The probe reads deep_steps, which only exists
 * once the whole 2026-10-03 file was applied (one transaction).
 */
export async function detectStoreKind(deps: PersistDeps = {}): Promise<StoreKind | null> {
  const now = deps.now ?? (() => Date.now());
  if (detected && detected.until > now()) return detected.kind;
  const db = deps.db === undefined ? deepDb() : deps.db;
  if (!db) return null;
  try {
    const { error } = await db.from("deep_steps").select("run_id", { head: true }).limit(1);
    if (!error) {
      detected = { kind: "tables", until: now() + PRESENT_TTL_MS };
      return "tables";
    }
    if (isMissingRelation(error)) {
      detected = { kind: "stopgap", until: now() + MISSING_TTL_MS };
      return "stopgap";
    }
    return null;
  } catch {
    return null;
  }
}

/** The store for a new run (feature-detected), or null → "ledger_unavailable". */
export async function storeForNewRun(deps: PersistDeps = {}): Promise<PersistentStore | null> {
  const db = deps.db === undefined ? deepDb() : deps.db;
  if (!db) return null;
  const kind = await detectStoreKind({ ...deps, db });
  if (!kind) return null;
  return kind === "tables"
    ? createTablesStore(db, { now: deps.now })
    : createStopgapStore(db, { now: deps.now });
}

let memory: MemoryStore | undefined;

/**
 * The store a run uses for its whole life (its ticket's kind). Without
 * Supabase credentials the persistent kinds get a store that refuses
 * everything, so a step fails closed instead of running unledgered.
 */
export function storeFor(kind: StoreKind | "memory", deps: PersistDeps = {}): DeepStore {
  if (kind === "memory") {
    memory ??= createMemoryStore();
    return memory;
  }
  const db = deps.db === undefined ? deepDb() : deps.db;
  if (!db) return unavailableStore(kind);
  return kind === "tables"
    ? createTablesStore(db, { now: deps.now })
    : createStopgapStore(db, { now: deps.now });
}

/**
 * The store holding an existing run, for the run-scoped functions that only
 * know a run ID (feedback, call requests, stored reports): the detected kind
 * first, then the other one.
 */
export async function storeHoldingRun(
  runId: string,
  userId: string,
  deps: PersistDeps = {},
): Promise<{
  store: DeepStore;
  run: NonNullable<Awaited<ReturnType<DeepStore["getRun"]>>>;
} | null> {
  const db = deps.db === undefined ? deepDb() : deps.db;
  if (!db) return null;
  const first = (await detectStoreKind({ ...deps, db })) ?? "stopgap";
  const order: StoreKind[] = first === "tables" ? ["tables", "stopgap"] : ["stopgap", "tables"];
  for (const kind of order) {
    const store = storeFor(kind, { ...deps, db });
    const run = await store.getRun(runId, userId).catch(() => null);
    if (run) return { store, run };
  }
  return null;
}

/** A store that refuses every operation (no credentials): paid calls and steps fail closed. */
function unavailableStore(kind: StoreKind): DeepStore {
  const no = async () => {
    throw new Error("ledger_unavailable");
  };
  return {
    kind,
    startRun: no,
    getRun: no,
    dayStats: no,
    reserve: async () => ({ ok: false, reason: "ledger_error" }),
    settle: no,
    finish: no,
    tripBreaker: no,
    feedback: no,
    callRequest: no,
    purgeIfDue: async () => undefined,
    claimStep: async () => ({ ok: false, reason: "ledger_error" }),
    settleStep: no,
  };
}

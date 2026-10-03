import type {
  AccessReason,
  Bilingual,
  CompetitorCard,
  Correction,
  DeepReport,
  Lang,
  OwnerInputs,
  Relationship,
  StepResult,
  StoreKind,
} from "@/lib/deep/contracts";

/*
 * The browser journal of deep runs (plan A5, "Resume without server tables"): one entry per
 * run and an index, keyed per account, in localStorage. It holds facts, gaps, step states and
 * the final report only: never page text (pages never leave the server; crawl cursors are
 * sealed and dropped once the run is done) and never `ephemeral` Google facts. At most about
 * 400 KB per run and 5 runs; on QuotaExceededError the oldest run goes first. Every access is
 * wrapped in try/catch, so a private window or blocked storage only loses the resume.
 */

export const JOURNAL_PREFIX = "vortex-deep:v1:";
export const MAX_RUNS = 5;
export const MAX_RUN_BYTES = 400 * 1024;
const PENDING_KEY = `${JOURNAL_PREFIX}pending`;
const PENDING_TTL_MS = 3600_000;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/** One place a step result sits in a run ("crawl2", "competitor:123"). */
export type SlotKey = string;

export type SlotState = {
  status: "running" | "done" | "partial" | "skipped" | "failed" | "refused";
  /** Server time of the step, or the browser's wait for it. */
  ms?: number;
  reason?: AccessReason | "time" | "no_answer";
  at: number;
};

export type AskSite = {
  url: string;
  reason: Bilingual;
  answer?: { url: string; yes: boolean } | "none";
};

export type RunTiming = {
  slot: SlotKey;
  status: string;
  ms: number;
  anafCalls?: number;
  subrequests?: number;
  pagesRead?: number;
  spentUsd?: number;
};

export type RunSnapshot = {
  v: 1;
  runId: string;
  uid: string;
  cui: string;
  name: string;
  relationship: Relationship;
  lang: Lang;
  aiMode: "ai" | "rules";
  store: StoreKind;
  ticket: string;
  createdAt: number;
  updatedAt: number;
  /** Time spent running (the 8-minute collection budget counts this, not the wall clock). */
  activeMs: number;
  results: Record<SlotKey, StepResult>;
  /** Arrival order of the results (later facts win in the server's merge). */
  order: SlotKey[];
  slots: Record<SlotKey, SlotState>;
  askSite?: AskSite;
  report?: DeepReport;
  reportAtt?: string;
  status: "running" | "done" | "failed";
  failure?: AccessReason;
  corrections: Correction[];
  owner?: OwnerInputs;
  rivalEdits: { removed: string[]; added: CompetitorCard[] };
  timings: RunTiming[];
};

export type RunIndexEntry = {
  runId: string;
  cui: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  status: RunSnapshot["status"];
};

export type PendingTarget = { cui?: string; site?: string; run?: string };

const runKey = (uid: string, runId: string) => `${JOURNAL_PREFIX}${uid}:run:${runId}`;
const indexKey = (uid: string) => `${JOURNAL_PREFIX}${uid}:index`;
const termsKey = (uid: string) => `${JOURNAL_PREFIX}${uid}:terms`;

/** localStorage when it exists and answers; null otherwise. */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function read<T>(storage: StorageLike | null, key: string): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function isQuota(error: unknown): boolean {
  const e = error as { name?: string; code?: number } | null;
  return Boolean(
    e &&
    (e.name === "QuotaExceededError" || e.code === 22 || e.name === "NS_ERROR_DOM_QUOTA_REACHED"),
  );
}

/** A report without display-only Google facts (never journaled, stored or printed). */
export function withoutEphemeral(report: DeepReport): DeepReport {
  if (!report.facts.some((f) => f.ephemeral)) return report;
  const gone = new Set(report.facts.filter((f) => f.ephemeral).map((f) => f.id));
  return {
    ...report,
    facts: report.facts.filter((f) => !f.ephemeral),
    lights: report.lights.map((l) => ({ ...l, factIds: l.factIds.filter((id) => !gone.has(id)) })),
  };
}

/** What goes to storage: no ephemeral facts, no sealed cursors once the run is over. */
export function sanitizeSnapshot(snap: RunSnapshot): RunSnapshot {
  const results: Record<SlotKey, StepResult> = {};
  for (const [slot, result] of Object.entries(snap.results)) {
    // A result is attested as a whole: one with an ephemeral fact is kept in memory only.
    if (result.facts.some((f) => f.ephemeral)) continue;
    if (snap.status !== "running") continue;
    results[slot] = result;
  }
  return {
    ...snap,
    results,
    order: snap.order.filter((slot) => slot in results),
    report: snap.report ? withoutEphemeral(snap.report) : undefined,
  };
}

export function readIndex(storage: StorageLike | null, uid: string): RunIndexEntry[] {
  const list = read<RunIndexEntry[]>(storage, indexKey(uid));
  return Array.isArray(list) ? list.filter((e) => e && typeof e.runId === "string") : [];
}

export function loadRun(
  storage: StorageLike | null,
  uid: string,
  runId: string,
): RunSnapshot | null {
  const snap = read<RunSnapshot>(storage, runKey(uid, runId));
  return snap && snap.v === 1 && snap.uid === uid && snap.runId === runId ? snap : null;
}

function writeIndex(storage: StorageLike, uid: string, list: RunIndexEntry[]) {
  storage.setItem(indexKey(uid), JSON.stringify(list.slice(0, MAX_RUNS)));
}

/**
 * Saves a run and its index line. Over 5 runs, or on a full storage, the oldest run is
 * removed (never the one being saved). Returns false when nothing could be written.
 */
export function saveRun(storage: StorageLike | null, snap: RunSnapshot): boolean {
  if (!storage) return false;
  const clean = sanitizeSnapshot(snap);
  let text = JSON.stringify(clean);
  if (text.length > MAX_RUN_BYTES) {
    // Too big: keep the report and the step states, drop the resumable results.
    text = JSON.stringify({ ...clean, results: {}, order: [] });
  }
  const entry: RunIndexEntry = {
    runId: snap.runId,
    cui: snap.cui,
    name: snap.name,
    createdAt: snap.createdAt,
    updatedAt: snap.updatedAt,
    status: snap.status,
  };
  for (let attempt = 0; attempt < MAX_RUNS + 1; attempt++) {
    try {
      const list = readIndex(storage, snap.uid).filter((e) => e.runId !== snap.runId);
      const next = [entry, ...list].sort((a, b) => b.createdAt - a.createdAt);
      for (const old of next.slice(MAX_RUNS)) storage.removeItem(runKey(snap.uid, old.runId));
      storage.setItem(runKey(snap.uid, snap.runId), text);
      writeIndex(storage, snap.uid, next);
      return true;
    } catch (error) {
      if (!isQuota(error)) return false;
      const list = readIndex(storage, snap.uid).filter((e) => e.runId !== snap.runId);
      const oldest = list.sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!oldest) return false;
      try {
        storage.removeItem(runKey(snap.uid, oldest.runId));
        writeIndex(
          storage,
          snap.uid,
          readIndex(storage, snap.uid).filter((e) => e.runId !== oldest.runId),
        );
      } catch {
        return false;
      }
    }
  }
  return false;
}

export function removeRun(storage: StorageLike | null, uid: string, runId: string) {
  if (!storage) return;
  try {
    storage.removeItem(runKey(uid, runId));
    writeIndex(
      storage,
      uid,
      readIndex(storage, uid).filter((e) => e.runId !== runId),
    );
  } catch {
    /* ignore */
  }
}

/** An unfinished run of this account under 24 hours old (offered as "Continuă"). */
export function unfinishedRun(
  storage: StorageLike | null,
  uid: string,
  now: number,
): RunIndexEntry | null {
  return (
    readIndex(storage, uid).find(
      (e) => e.status === "running" && now - e.createdAt < 24 * 3600_000,
    ) ?? null
  );
}

/** The latest finished report of the same company, for "Ce s-a schimbat". */
export function previousReport(
  storage: StorageLike | null,
  uid: string,
  cui: string,
  exceptRunId: string,
): { report: DeepReport; at: number } | null {
  for (const entry of readIndex(storage, uid)) {
    if (entry.cui !== cui || entry.runId === exceptRunId || entry.status !== "done") continue;
    const snap = loadRun(storage, uid, entry.runId);
    if (snap?.report) return { report: snap.report, at: snap.createdAt };
  }
  return null;
}

/** Every journal entry of every account in this browser (sign-out, "Șterge din acest browser"). */
export function clearJournal(storage: StorageLike | null, uid?: string) {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(JOURNAL_PREFIX)) continue;
      if (uid && !key.startsWith(`${JOURNAL_PREFIX}${uid}:`)) continue;
      keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** True when any account has journal entries here (a signed-out visitor clears them). */
export function hasAnyJournal(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(JOURNAL_PREFIX) && key !== PENDING_KEY) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/* ------------------------------------------------------------ terms */

export function termsAccepted(storage: StorageLike | null, uid: string, version: string): boolean {
  const list = read<Array<{ version: string }>>(storage, termsKey(uid));
  return Array.isArray(list) && list.some((x) => x?.version === version);
}

export function rememberTerms(
  storage: StorageLike | null,
  uid: string,
  version: string,
  now: number,
) {
  if (!storage) return;
  try {
    const list = (
      read<Array<{ version: string; at: number }>>(storage, termsKey(uid)) ?? []
    ).filter((x) => x?.version !== version);
    storage.setItem(termsKey(uid), JSON.stringify([{ version, at: now }, ...list].slice(0, 5)));
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------- pending */

const CUI_RE = /^\d{2,10}$/;
const RUN_RE = /^[0-9a-f-]{36}$/i;

/** The deep target kept across the login (1 hour), so the confirmation e-mail tab finds it. */
export function savePending(storage: StorageLike | null, target: PendingTarget, now: number) {
  if (!storage) return;
  const clean: PendingTarget = {};
  if (target.cui && CUI_RE.test(target.cui)) clean.cui = target.cui;
  if (target.site && /^https?:\/\/[^\s]{3,290}$/i.test(target.site)) clean.site = target.site;
  if (target.run && RUN_RE.test(target.run)) clean.run = target.run;
  if (!clean.cui && !clean.run) return;
  try {
    storage.setItem(PENDING_KEY, JSON.stringify({ ...clean, exp: now + PENDING_TTL_MS }));
  } catch {
    /* ignore */
  }
}

export function readPending(storage: StorageLike | null, now: number): PendingTarget | null {
  const value = read<PendingTarget & { exp?: number }>(storage, PENDING_KEY);
  if (!value || typeof value.exp !== "number" || value.exp < now) return null;
  const out: PendingTarget = {};
  if (value.cui && CUI_RE.test(value.cui)) out.cui = value.cui;
  if (value.site && /^https?:\/\//i.test(value.site)) out.site = value.site;
  if (value.run && RUN_RE.test(value.run)) out.run = value.run;
  return out.cui || out.run ? out : null;
}

export function clearPending(storage: StorageLike | null) {
  if (!storage) return;
  try {
    storage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

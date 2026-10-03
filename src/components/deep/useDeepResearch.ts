import { useCallback, useEffect, useRef, useState } from "react";

import type { AccessReason, StartDeepRunInput } from "@/lib/deep/contracts";

import { browserStorage, loadRun, saveRun, type AskSite, type RunSnapshot } from "./journal";
import {
  continueRun,
  startRun,
  type DeepTransport,
  type RunnerEnv,
  type SiteAnswer,
} from "./runner";

/*
 * The React side of the runner (plan A5, step 7): the per-account journal, one run at a time
 * per account in this browser (Web Locks), the screen kept awake while it runs (Wake Lock,
 * where supported), and a retry when the page comes back after a request was cut while it was
 * hidden. Closing the tab pauses the run; /scan/deep?run=<id> continues it from the journal.
 */

export type RunPhase =
  | "idle"
  | "starting"
  | "running"
  | "busy_elsewhere"
  | "paused"
  | "done"
  | "failed"
  | "refused";

type WakeLockSentinelLike = { release: () => Promise<void> };
type LockManagerLike = {
  request: (
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown) => Promise<unknown>,
  ) => Promise<unknown>;
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

function whenVisible(): Promise<void> {
  if (typeof document === "undefined" || !document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    const on = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", on);
      resolve();
    };
    document.addEventListener("visibilitychange", on);
  });
}

function locks(): LockManagerLike | null {
  try {
    const nav = navigator as Navigator & { locks?: LockManagerLike };
    return nav.locks ?? null;
  } catch {
    return null;
  }
}

/** Keeps the screen on while a run is going (best effort; nothing breaks without it). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let stopped = false;
    const acquire = async () => {
      try {
        if (document.hidden || stopped) return;
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        sentinel = null;
      }
    };
    void acquire();
    const onVisible = () => {
      if (!document.hidden) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}

export function useDeepResearch(opts: {
  uid: string | null;
  transport: DeepTransport;
  /** A run to show or continue (from ?run=). */
  runId?: string;
}) {
  const { uid, transport, runId } = opts;
  const [snap, setSnap] = useState<RunSnapshot | null>(null);
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [refusal, setRefusal] = useState<{ reason: AccessReason; replayRunId?: string } | null>(
    null,
  );
  const [ask, setAsk] = useState<AskSite | null>(null);
  const askResolve = useRef<((answer: SiteAnswer | null) => void) | null>(null);
  const abort = useRef<AbortController | null>(null);
  /** The run this tab drives (set before the lock is taken, so a re-render never doubles it). */
  const driving = useRef<string | null>(null);

  useWakeLock(phase === "running");

  // Stop issuing requests when the page goes away; the journal keeps the run resumable.
  useEffect(
    () => () => {
      abort.current?.abort();
      askResolve.current?.(null);
    },
    [],
  );

  const persist = useCallback((next: RunSnapshot) => {
    setSnap(next);
    saveRun(browserStorage(), next);
  }, []);

  const drive = useCallback(
    async (initial: RunSnapshot) => {
      if (!uid) return;
      abort.current?.abort();
      driving.current = initial.runId;
      const controller = new AbortController();
      abort.current = controller;
      const env: RunnerEnv = {
        transport,
        now: () => Date.now(),
        sleep,
        timer: sleep,
        whenVisible,
        hidden: () => typeof document !== "undefined" && document.hidden,
        signal: controller.signal,
        onChange: persist,
        askSite: (question, until) =>
          new Promise<SiteAnswer | null>((resolve) => {
            askResolve.current = (answer) => {
              askResolve.current = null;
              setAsk(null);
              resolve(answer);
            };
            setAsk(question);
            void until.then(() => askResolve.current?.(null));
          }),
      };
      const run = async () => {
        setPhase("running");
        const final = await continueRun(env, initial);
        persist(final);
        setPhase(
          final.status === "done" ? "done" : final.status === "failed" ? "failed" : "paused",
        );
        if (driving.current === initial.runId && final.status !== "running") driving.current = null;
      };
      const manager = locks();
      if (!manager) {
        await run();
        return;
      }
      // One run per account in this browser: a second tab shows "rulează în alt tab". A run
      // of this tab that is just pausing may still hold the lock, so ask twice.
      for (let attempt = 0; attempt < 2; attempt++) {
        let got = false;
        await manager.request(`vortex-deep:${uid}`, { ifAvailable: true }, async (lock) => {
          if (!lock) return;
          got = true;
          await run();
        });
        if (got || controller.signal.aborted) return;
        await sleep(400, controller.signal);
      }
      setPhase("busy_elsewhere");
    },
    [uid, transport, persist],
  );

  // A run from the journal (?run=): shown as is, or continued when unfinished.
  useEffect(() => {
    if (!uid || !runId || driving.current === runId) return;
    const saved = loadRun(browserStorage(), uid, runId);
    if (!saved) {
      setSnap(null);
      setPhase("idle");
      return;
    }
    setSnap(saved);
    if (saved.status === "running") void drive(saved);
    else setPhase(saved.status === "done" ? "done" : "failed");
  }, [uid, runId, drive]);

  const start = useCallback(
    async (input: StartDeepRunInput): Promise<RunSnapshot | null> => {
      if (!uid) return null;
      setRefusal(null);
      setPhase("starting");
      const out = await startRun(transport, input, uid, () => Date.now());
      if (!out.ok) {
        setRefusal({ reason: out.reason, replayRunId: out.replayRunId });
        setPhase("refused");
        return null;
      }
      persist(out.snap);
      void drive(out.snap);
      return out.snap;
    },
    [uid, transport, drive, persist],
  );

  const answerSite = useCallback((answer: SiteAnswer | null) => {
    askResolve.current?.(answer);
  }, []);

  const resume = useCallback(() => {
    if (snap && snap.status === "running") void drive(snap);
  }, [snap, drive]);

  /** Local edits after the report (corrections, rival edits, owner inputs), journaled. */
  const update = useCallback((change: (current: RunSnapshot) => RunSnapshot) => {
    setSnap((current) => {
      if (!current) return current;
      const next = { ...change(current), updatedAt: Date.now() };
      saveRun(browserStorage(), next);
      return next;
    });
  }, []);

  return { snap, phase, refusal, ask, start, answerSite, resume, update };
}

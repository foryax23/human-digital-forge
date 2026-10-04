import { createContext, useContext } from "react";

import type { RunTiming } from "../journal";
import type {
  CompetitorCard,
  Correction,
  DeepAccess,
  DeepReport,
  FeedbackKind,
  OwnerInputs,
} from "@/lib/deep/contracts";

/*
 * What the report's parts need from the page: the report as shown (corrections, owner numbers
 * and rival edits already applied), whether it is a sample, the access answer (admin panel,
 * storage), and the actions a reader can take. One context instead of props through six levels.
 */

export type ReportTab = "pe-scurt" | "cifre" | "atlas" | "dovezi";

export type DeepReportCtx = {
  report: DeepReport;
  /** The report as the server returned it (the official figures strip reads this one). */
  official: DeepReport;
  sample: boolean;
  access: DeepAccess | null;
  corrections: Correction[];
  owner?: OwnerInputs;
  rivalEdits: { removed: string[]; added: CompetitorCard[] };
  onCorrect: (correction: Correction) => void;
  onOwnerInputs: (owner: OwnerInputs | undefined) => void;
  onRemoveRival: (cui: string) => void;
  onAddRival: (card: { cui: string; name: string; city?: string; website?: string }) => void;
  onFeedback: (
    kind: FeedbackKind,
    extra?: { factId?: string; message?: string; value?: unknown },
  ) => Promise<"sent" | "kept" | "sample">;
  onEvent: (name: string) => void;
  /** "Sună-mă": true when the request was stored (a real lead the person asked for). */
  onCallRequest: (phone: string, when: "dimineata" | "dupa_amiaza") => Promise<boolean>;
  goTo: (tab: ReportTab, anchor?: string) => void;
  onForget?: () => void;
  /** Step timings of this run (admin panel). */
  timings?: RunTiming[];
  /** Running time of the run in ms (admin panel). */
  activeMs?: number;
  store?: string;
};

export const ReportContext = createContext<DeepReportCtx | null>(null);

export function useReport(): DeepReportCtx {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useReport must be used inside the deep report");
  return ctx;
}

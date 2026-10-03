import type {
  Blueprint,
  CompanyProfile,
  Competitor,
  OnlinePresence,
  PageSpeedResult,
  ScanStep,
  ScanTarget,
  WebsiteAudit,
  WebsiteDiscovery,
} from "@/lib/scan/types";

/**
 * Client-side state of one scan run, produced by useVortexScan and read by
 * every step screen. Results fill in as each analysis step finishes.
 */
export type ScanState = {
  target: ScanTarget;
  status: "idle" | "running" | "done" | "error";
  /** The analysis checklist, in display order. */
  steps: ScanStep[];
  company?: CompanyProfile | null;
  discovery?: WebsiteDiscovery | null;
  audit?: WebsiteAudit | null;
  pagespeed?: PageSpeedResult | null;
  presence?: OnlinePresence | null;
  competitors?: Competitor[];
  blueprint?: Blueprint;
  error?: string;
};

/** The four stages in the scan header (01 Find business … 04 Results). */
export type ScanStage = "find" | "analyse" | "strategy" | "results";

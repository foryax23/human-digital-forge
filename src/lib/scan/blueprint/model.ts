import type {
  Bilingual,
  DetectedTechnology,
  OnlinePresence,
  PhaseKey,
  Range,
  SiteSignals,
} from "@/lib/scan/types";

/*
 * Internal shapes of the blueprint engine (not part of the shared contract).
 * Every number the engine shows is derived from a VolumeModel, a wage figure
 * and the price book, so each one can be traced back to a stated assumption.
 */

export type { PhaseKey };
export type StrategyKey = "acquire" | "automate" | "assist";

/**
 * How an opportunity's monthly volume grows with the business:
 * - "business": stated for the type's typical team, scaled by team size;
 * - "employee": per person on the team;
 * - "fixed": the same whatever the team size (e.g. a weekly report).
 */
export type VolumeBasis = "business" | "employee" | "fixed";

export type VolumeModel = {
  basis: VolumeBasis;
  /** Occurrences a month (see basis). */
  perMonth: number;
  /** What is counted, plural, lower case ("appointments" / "programări"). */
  unit: Bilingual;
  /** Minutes of manual work each time. */
  minutes: Range;
  /** Share of that work the automation removes (0–1). */
  automatable: Range;
};

/** Volume knobs a business type sets for the universal opportunities. */
export type PlaybookParams = {
  /** Invoices issued a month (e-Factura). 0 = mostly fiscal receipts. */
  invoices: number;
  /** Supplier invoices and receipts handled a month. */
  documents: number;
  /** Incoming questions a month (phone, email, chat, social). */
  questions: number;
  /** Share of those questions that are routine and answerable from an FAQ. */
  routineShare: Range;
  /** New enquiries / leads a month. */
  enquiries: number;
  /** Post-visit follow-ups a month (review requests), 0 for B2B types. */
  followUps: number;
  /** Social posts a month. */
  posts: number;
};

export type TextOverride = Partial<{ title: Bilingual; problem: Bilingual; solution: Bilingual }>;

export type PlaybookEntry = {
  id: string;
  volume?: Partial<VolumeModel>;
  text?: TextOverride;
};

export type Playbook = {
  typeId: string;
  params: PlaybookParams;
  /** Type-specific opportunities (universal ones may appear with overrides). */
  entries: PlaybookEntry[];
  /** Strategy titles adapted to the type ("Win more patients"). */
  titles: Record<StrategyKey, Bilingual>;
};

/** What the audit and presence data tell us, flattened for the rules. */
export type SignalContext = {
  typeId: string;
  consumer: boolean;
  hasWebsite: boolean;
  /** Null when there is no reachable website to read signals from. */
  signals: SiteSignals | null;
  technologies: DetectedTechnology[];
  presence: OnlinePresence | null;
};

export type OpportunityTemplate = {
  id: string;
  title: Bilingual;
  problem: Bilingual;
  solution: Bilingual;
  process: string;
  impact: "high" | "medium" | "low";
  complexity: "low" | "medium" | "high";
  tools: string[];
  /**
   * Explicit roadmap override. By default the phase follows the strategy
   * (automate → automation, assist → assistant, acquire → growth), so each
   * strategy card, Gantt row and phase row describe the same work.
   */
  phase?: PhaseKey;
  strategy: StrategyKey;
  /** Default volume, optionally from the type's playbook params. */
  volume: VolumeModel | ((params: PlaybookParams) => VolumeModel);
  /** Extra monthly usage cost per occurrence (SMS, WhatsApp, AI tokens), RON. */
  usageCostRon?: Range;
  /** Overrides the price book's monthly tool cost for this opportunity. */
  monthlyToolsRon?: Range;
  /** Overrides the price book's setup cost for this opportunity. */
  setupRon?: Range;
  /** False when the audit shows it's already solved or irrelevant. */
  applies?: (ctx: SignalContext, params: PlaybookParams) => boolean;
  /** Extra plain-language assumption shown with the numbers. */
  note?: Bilingual;
  /**
   * Touches customers directly (bookings, reminders, orders), so it also earns
   * revenue we don't price; it only needs to cover its tools to be suggested.
   */
  customerFacing?: boolean;
};

export const bi = (en: string, ro: string): Bilingual => ({ en, ro });

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

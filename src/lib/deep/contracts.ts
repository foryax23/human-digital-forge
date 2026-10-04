/*
 * Shared contracts of Vortex Scan "Cercetare aprofundată" (deep research).
 *
 * Imported by the pure step modules, the server functions and the browser.
 * No imports: Lang and Bilingual are structurally identical to
 * src/lib/scan/types.ts. Frozen on day 1 of the build plan (D2); changes are
 * additive and reviewed. Everything below "Additions" is additive to the plan's
 * D2 text and marked as such.
 */

export type Lang = "en" | "ro";
export type Bilingual = { en: string; ro: string };

export type DeepMode = "disabled" | "admin" | "code" | "open" | "premium";
export type AccessVia = "admin" | "code" | "open" | "premium" | "free";
/**
 * How an admin was admitted: by user ID (DEEP_RESEARCH_ADMIN_USER_IDS, or Lovable's admin
 * role once configForUser has added it), by the role itself, or by admin e-mail.
 */
export type AdminBy = "id" | "role" | "email";
export type AccessReason =
  | "mode_disabled"
  | "admin_only"
  | "login_required"
  | "email_unconfirmed"
  | "code_required"
  | "premium_required"
  | "free_run_used"
  | "daily_cap_user"
  | "daily_cap_global"
  | "already_running"
  | "same_company_today"
  | "natural_person"
  | "not_found"
  | "ledger_unavailable"
  | "budget_exhausted"
  | "ticket_invalid"
  | "ticket_expired"
  | "user_mismatch"
  | "run_not_found"
  | "too_large"
  /** Additive: ANAF did not answer the identity call ("ANAF nu răspunde acum, încearcă în câteva minute"). */
  | "anaf_unavailable"
  /**
   * Additive (Eng 3, B1): the start form accepted an older version of the report terms
   * (DEEP_TERMS_VERSION in src/lib/scan/legal/lead-notice.ts); show the current text again.
   */
  | "terms_outdated";
export type StoreKind = "stopgap" | "tables";
export type DeepAccess = {
  mode: DeepMode;
  allowed: boolean;
  reason?: AccessReason;
  via?: AccessVia;
  /** Key present, breaker closed, day budget left. */
  ai: boolean;
  runsLeftToday: number;
  persistence: StoreKind | "unavailable";
  budgetUsd: number;
  /** DEEP_ENTRY_PUBLIC or allowed. */
  entryVisible: boolean;
  /** The account's deep-check plan and checks left (admin-managed; a new account is free with 1). */
  credits?: { plan: "free" | "premium"; left: number };
  admin?: {
    todayUsd: number;
    dayCapUsd: number;
    unknownMode?: string;
    /**
     * Additive: the in-memory ledger is in use (until the persistent stores land).
     * "memory_rules_only": runs are rules-only (no paid call relies on a per-isolate day cap);
     * "memory_ai_per_isolate": DEEP_MEMORY_LEDGER_AI=on, so the day cap and run caps hold per
     * Worker isolate only (keep the Anthropic workspace limit set).
     */
    ledger?: "memory_rules_only" | "memory_ai_per_isolate";
    /** Additive: an unknown DEEP_EXTRACT_MODEL value (ignored; Haiku 4.5 is used). */
    unknownExtractModel?: string;
    /**
     * Additive (fix wave): why AI is off, when it is: no Anthropic key, today's budget used,
     * the breaker open, or no persistent spend ledger.
     */
    aiOff?: "no_key" | "day_budget" | "breaker" | "storage";
  };
};
export type Relationship = "proprietar" | "angajat" | "client_furnizor" | "concurent" | "altceva";
/** proprietar, angajat → owner; the others → third_party. */
export type Audience = "owner" | "third_party";
export type OwnerInputs = {
  turnover2026?: number;
  clientsPerMonth?: number;
  avgTicket?: number;
  hourValue?: number;
};

export type SectionId =
  | "identity"
  | "money"
  | "peers"
  | "competitors"
  | "site"
  | "presence"
  | "risk"
  | "people"
  | "offers";
export type DocumentId = "registre" | "bani" | "comparatie" | "site" | "prezenta" | "echipa";
export const SECTION_DOCUMENT: Record<SectionId, DocumentId> = {
  identity: "registre",
  risk: "registre",
  money: "bani",
  peers: "comparatie",
  competitors: "comparatie",
  site: "site",
  offers: "site",
  presence: "prezenta",
  people: "echipa",
};
export type SourceId =
  | "anaf_v9"
  | "anaf_bilant"
  | "mf_bulk"
  | "onrc"
  | "courts"
  | "ted"
  | "site"
  | "audit"
  | "pagespeed"
  | "dns"
  | "google_places"
  | "competitor_site"
  | "news"
  | "web_search"
  | "calc"
  | "user";
export type Confidence = "confirmat" | "probabil" | "calculat" | "estimare" | "declarat";
export type FactMethod = "api" | "bulk" | "html" | "jsonld" | "llm" | "derived" | "user";
export const QUOTE_MAX = { tdm: 120, default: 200, column: 300 } as const;

export type SourceRef = {
  id: SourceId;
  label: Bilingual;
  url?: string;
  licence?: string;
  /** ISO date, or "FY2025". */
  asOf: string;
  /** ISO timestamp. */
  retrievedAt: string;
};
/**
 * JSON-safe value of a fact. (Changes D2's `Fact<T = unknown>`: server functions
 * may only return serializable data, and TanStack Start checks it in the types.)
 */
export type FactValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | FactValue[]
  | { [key: string]: FactValue };
export type Fact<T = FactValue> = {
  /** Stable in a run: "money.turnover.2025". */
  id: string;
  section: SectionId;
  /** "money.turnover" (see KNOWN_PREDICATES). */
  predicate: string;
  value: T;
  /** By code: "4.620.000 lei". */
  display: Bilingual;
  /** By code: "4,62 mil. lei". */
  short?: Bilingual;
  source: SourceId;
  asOf: string;
  confidence: Confidence;
  /** 0..1; adverse facts are shown only at >= 0.9. */
  score: number;
  method: FactMethod;
  /** quote verified, <= QUOTE_MAX */
  evidence?: { url?: string; quote?: string; note?: Bilingual };
  /** Absences: what we looked at. */
  observed?: { pagesRead: number };
  gdpr: "G0" | "G1";
  adverse?: true;
  /** Google display-only: never journaled, stored, sent to AI or printed. */
  ephemeral?: true;
};
export type Gap = {
  section: SectionId;
  what: Bilingual;
  where: Bilingual;
  at: string;
  link?: string;
};

export type StepName =
  | "start"
  | "money"
  | "site"
  | "signals"
  | "peers"
  | "audit"
  | "crawl"
  | "pagespeed"
  | "competitor"
  | "synthesis"
  | "finish";
export type SynthesisPart = "warm" | "brief" | "customer" | "rivals";
export type StepStatus = "done" | "partial" | "skipped" | "failed";
export type StepResult = {
  runId: string;
  step: StepName;
  part?: SynthesisPart;
  status: StepStatus;
  ms: number;
  facts: Fact[];
  gaps: Gap[];
  /** pagesRead, sourcesOk, anafCalls, subrequests… */
  counters?: Record<string, number>;
  next?: {
    /** Sealed (AES-GCM) and droppable: left out of the attestation, bound by `cursorSha`. */
    crawlCursor?: string;
    /**
     * Additive: the first 32 hex characters of sha256(crawlCursor), set by the server
     * and attested. A cursor sent back with this result must match it (no swapping).
     */
    cursorSha?: string;
    askSite?: { url: string; reason: Bilingual };
    anafNextAt?: number;
  };
  /** Synthesis parts only. */
  brief?: Partial<Brief>;
  spentUsd?: number;
  /** HMAC over runId | uid | sha256(canonical StepResult without att). */
  att: string;
};
/** Typed only, never free text. */
export type Correction = {
  predicate:
    | "site.booking.present"
    | "site.cui.present"
    | "site.contact.present"
    | "presence.social_only"
    | "site.url";
  url?: string;
  number?: number;
};

export type WebsiteStatus =
  | "verified"
  | "declared"
  | "ask_visitor"
  | "broken_certificate"
  | "parked"
  | "dead"
  | "unreachable"
  | "blocked"
  | "none";
export type LightState = "bine" | "atentie" | "de_rezolvat" | "neverificat";
export type AreaId = "bani" | "clienti" | "online" | "echipa" | "risc";
export type AreaLight = {
  area: AreaId;
  label: Bilingual;
  state: LightState;
  reason: Bilingual;
  factIds: string[];
  provisional?: true;
  /** Additive (fix wave): what the reason leaves out ("fără comparație cu firme similare încă"). */
  note?: Bilingual;
};
export type Estimate = {
  /** "time.booking.v1", "profit.margin_gap.v1" */
  formulaId: string;
  kind: "time_value_month" | "profit_year_pretax";
  value: number;
  low: number;
  high: number;
  hours?: number;
  /** What the Ajustează panel may change. */
  inputs: Record<string, number>;
  assumptions: Bilingual[];
  method: Bilingual;
  factIds: string[];
};
export type Action = {
  id: string;
  title: Bilingual;
  why: Bilingual;
  mandatory: boolean;
  effect?: Estimate;
  /** Text-only effects. */
  comparison?: Bilingual;
  cost: {
    diyLei?: number;
    diyHours?: number;
    /** Additive (fix wave): the do-it-yourself path in words, when it is not one number. */
    diyHow?: Bilingual;
    vortex?: { setupLei: number; monthlyLei: number };
  };
  who: "singur" | "contabil" | "cu_vortex";
  firstEffect: Bilingual;
  factIds: string[];
  rank: number;
};
/** Never summed. */
export type PlanTotals = { timeValueMonth?: Estimate; profitYearPretax?: Estimate };
export type Finding = {
  id: string;
  figure: Bilingual;
  sentence: Bilingual;
  factIds: string[];
  rank: number;
};
/** hiddenBy = corrected fact ID. */
export type CitedSentence = { text: string; factIds: string[]; hiddenBy?: string };
export type BriefSection = { source: "ai" | "rules"; sentences: CitedSentence[] };
export type Brief = {
  lang: Lang;
  audience: Audience;
  headline: BriefSection;
  meaning: BriefSection;
  findings: BriefSection[];
  customerView: BriefSection;
  rivals: BriefSection;
  ifNothing?: BriefSection;
  cut: { kept: number; byCode: number; byEntailment: number };
};
export type PeerBand = {
  p25: number;
  p50: number;
  p75: number;
  n: number;
  you?: number;
  /** Shown when n < 20. */
  rank?: { position: number; of: number };
  /** Shown only when n >= 20. */
  betterThanOf100?: number;
};
export type CompetitorCard = {
  cui: string;
  name: string;
  city?: string;
  turnover?: number;
  turnoverPrev?: number;
  profitPretax?: number;
  employees?: number;
  website?: string;
  siteVerified?: boolean;
  booking?: boolean;
  shop?: boolean;
  importantIssues?: number;
  betterAt?: Bilingual;
  whyChosen: Bilingual;
  origin: "official" | "owner_added";
  factIds: string[];
};
export type SectorVocabId =
  | "health"
  | "beauty"
  | "food"
  | "accommodation"
  | "retail"
  | "b2b_wholesale"
  | "manufacturing"
  | "auto"
  | "construction"
  | "transport"
  | "it"
  | "professional"
  | "generic";
export type FeedbackKind =
  | "useful_yes"
  | "useful_no"
  | "error_report"
  | "correction"
  | "monitoring_interest"
  | "price_signal"
  | "cta_click"
  | "competitor_edit";
/** = LeadConsentRecord in src/lib/scan/legal/lead-notice.ts */
export type ConsentRecord = {
  version: string;
  lang: Lang;
  channel: "vortex-scan/pdf-dialog" | "vortex-deep/start";
  recordedAt: string;
  notice: string;
  reportBasis: string;
  terms?: { version: string; text: string; accepted: true };
  marketing: { granted: boolean; text: string; basis: string };
};

export type DeepReport = {
  schema: 1;
  runId: string;
  cui: string;
  lang: Lang;
  relationship: Relationship;
  audience: Audience;
  firm: "established" | "new";
  generatedAt: string;
  aiMode: "ai" | "rules";
  models?: { synthesis: string; extraction: string };
  company: {
    name: string;
    displayName: string;
    cui: string;
    regNo?: string;
    caen3?: string;
    caen2?: string;
    activity: Bilingual;
    city?: string;
    county?: string;
    website?: { url: string; status: WebsiteStatus };
  };
  facts: Fact[];
  gaps: Gap[];
  sources: SourceRef[];
  registers: { checked: Bilingual[]; notChecked: { name: Bilingual; link: string }[] };
  lights: AreaLight[];
  findings: Finding[];
  actions: Action[];
  totals: PlanTotals;
  brief: Brief;
  peers?: {
    n: number;
    scope: "oras" | "judet" | "national";
    scopeLabel: Bilingual;
    year: number;
    sizeBand: [number, number];
    bands: Partial<
      Record<
        "turnover" | "marginPretax" | "employees" | "revPerEmp" | "growth3y" | "daysToCollect",
        PeerBand
      >
    >;
  };
  competitors: CompetitorCard[];
  counts: { officialSources: number; pagesRead: number; facts: number; estimates: number };
  vocab: SectorVocabId;
  ownerInputs?: OwnerInputs;
  verifyCode?: string;
  /** Admins only. */
  costUsd?: number;
};

/* ======================================================================
 * Additions (additive to D2, Engineer 1). Reviewed with Eng 2 and Eng 3.
 * ==================================================================== */

/** Ledger types, moved here from persist.server.ts so StepEnv and Eng 3 share them. */
export type RunStatus = "running" | "partial" | "succeeded" | "failed" | "canceled";
export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};
export type ReserveResult =
  | { ok: true; callId: string }
  | { ok: false; reason: "replay"; result: unknown }
  | {
      ok: false;
      reason:
        | "in_flight"
        | "attempts"
        | "breaker"
        | "run_budget"
        | "day_budget"
        | "run_closed"
        | "run_not_found"
        | "ledger_error";
    };

/**
 * Additive: the answer to a run-level claim (DeepStore.claimStep). Steps are
 * claimed before they run so a replayed or parallel request cannot multiply
 * ANAF calls, crawl traffic or competitor fetches.
 */
export type StepClaim =
  | { ok: true; claimId: string; granted: number }
  /** The key is used up and its last settled result is replayed (a retried step). */
  | { ok: false; reason: "replay"; result: unknown }
  | {
      ok: false;
      reason: "in_flight" | "exhausted" | "run_closed" | "run_not_found" | "ledger_error";
    };

/** Implemented by Eng 3 in src/lib/deep/persist*.server.ts (stopgap and tables). */
export interface DeepStore {
  kind: StoreKind;
  startRun(input: {
    userId: string;
    cui: string;
    companyName?: string;
    relationship: Relationship;
    lang: Lang;
    via: AccessVia;
    budgetUsd: number;
    aiMode: "ai" | "rules";
    consent: ConsentRecord;
    userCap: number;
    globalCap: number;
    allowSameCompany: boolean;
  }): Promise<{ runId: string } | { reason: AccessReason; replayRunId?: string }>;
  getRun(
    runId: string,
    userId: string,
  ): Promise<{
    status: RunStatus;
    createdAt: string;
    lastActivityAt: string;
    /** Additive (Eng 3): the researched company (call requests carry it). */
    cui?: string;
    /** Additive (fix wave): how the run was admitted, for the entitlement re-check. */
    via?: AccessVia;
  } | null>;
  dayStats(userId: string): Promise<{ userRuns: number; allRuns: number; allUsd: number }>;
  reserve(input: {
    runId: string;
    idemKey: string;
    kind: "llm" | "maps";
    step: StepName;
    model?: string;
    usd: number;
    dayCapUsd: number;
  }): Promise<ReserveResult>;
  settle(input: { callId: string; usd: number; usage: Usage; result?: unknown }): Promise<void>;
  finish(input: {
    runId: string;
    status: Exclude<RunStatus, "running">;
    report?: DeepReport;
    reportAtt?: string;
    verifyCode?: string;
    metrics?: Record<string, unknown>;
    error?: string;
  }): Promise<void>;
  tripBreaker(minutes: number, reason: string): Promise<void>;
  /** Tables only. */
  /** A finished run's report, with its run ID (the public check recomputes the attestation). */
  loadReport?(
    q: { runId: string; userId: string } | { verifyCode: string },
  ): Promise<{ runId: string; report: DeepReport; reportAtt: string } | null>;
  feedback(row: {
    runId: string;
    userId: string;
    kind: FeedbackKind;
    factId?: string;
    message?: string;
    value?: unknown;
  }): Promise<void>;
  callRequest(row: {
    runId: string;
    userId: string;
    email: string;
    phone: string;
    when: string;
    cui: string;
    lang: Lang;
  }): Promise<void>;
  purgeIfDue(): Promise<void>;
  /**
   * Additive (required): a run-level claim, atomic per run and key, with the same
   * fail-closed rules as reserve (unknown run, other user → run_not_found; closed run →
   * run_closed; any store error → ledger_error, never "ok").
   * - exclusive (default true, a step): one unsettled claim per key at a time (a younger
   *   one than 2 minutes answers in_flight); `units` (default 1) counted against `max`;
   *   when the key is used up, the last settled `result` is replayed, else exhausted.
   * - exclusive false (a counter, e.g. "anaf"): grants min(units, max − used), at least 1,
   *   else exhausted; never in_flight.
   * Keys used by the engine: money, signals, site (2), peers (4), audit, pagespeed,
   * crawl|<cursor sha>, crawl (counter 3), competitor|<cui>, competitors (counter 6),
   * anaf (counter 8: money 7 + peers 1; start's call precedes the run), finish (3).
   */
  claimStep(input: {
    runId: string;
    userId: string;
    key: string;
    max: number;
    units?: number;
    exclusive?: boolean;
  }): Promise<StepClaim>;
  /**
   * Additive (required): ends a claim. `used` (≤ granted) refunds the unused units of a
   * counter; `result` (a sealed StepResult) is kept for replay.
   */
  settleStep(input: {
    runId: string;
    claimId: string;
    used?: number;
    result?: unknown;
  }): Promise<void>;
  /**
   * Optional (additive): the run's budget state, so a section can shrink
   * max_tokens to fit instead of retrying smaller reservations.
   */
  runSpend?(
    runId: string,
  ): Promise<{ budgetUsd: number; spentUsd: number; reservedUsd: number } | null>;
  /** Optional (additive, Eng 3): runs this account started as its free Premium report (D24). */
  freeRunsUsed?(userId: string): Promise<number>;
  /** Optional (additive, Eng 3): the spend breaker is open (no paid call for now). */
  breakerOpen?(): Promise<boolean>;
}

/** Input of startDeepRun (src/lib/deep.functions.ts). */
export type StartDeepRunInput = {
  cui: string;
  site?: string;
  relationship: Relationship;
  lang: Lang;
  /** `lang`: the language the notice and boxes were shown in (the record is built in it). */
  consent: { termsVersion: string; marketing: boolean; lang?: Lang };
  testCode?: string;
  owner?: OwnerInputs;
  corrections?: Correction[];
  /** Honoured for admins only. */
  rerun?: boolean;
};
export type StartDeepRunOutput =
  | {
      ok: true;
      runId: string;
      ticket: string;
      store: StoreKind;
      identity: StepResult;
      plan: StepName[];
      /** Additive: whether AI is used for this run (false = rules-only, labelled). */
      aiMode: "ai" | "rules";
    }
  | { ok: false; reason: AccessReason; replayRunId?: string };

/** Input of deepStep: a discriminated union on `step` (validated with zod on the server). */
export type DeepStepInput =
  | { ticket: string; step: "money" | "signals"; anafNextAt?: number }
  | { ticket: string; step: "site"; candidates?: string[]; answer?: { url: string; yes: boolean } }
  | {
      ticket: string;
      step: "peers";
      money: StepResult;
      anafNextAt?: number;
      /** ≤ 3 edits per run. */
      edits?: { remove: string[]; add: string[] };
    }
  | { ticket: string; step: "audit" | "pagespeed"; site: StepResult }
  | { ticket: string; step: "crawl"; site: StepResult; cursor: string }
  | { ticket: string; step: "competitor"; peers: StepResult; cui: string }
  | {
      ticket: string;
      step: "synthesis";
      part: SynthesisPart;
      results: StepResult[];
      corrections?: Correction[];
    }
  | {
      ticket: string;
      step: "finish";
      results: StepResult[];
      corrections?: Correction[];
      /** Additive: owner inputs (also accepted at start). */
      owner?: OwnerInputs;
    };
export type DeepStepOutput =
  | { kind: "step"; result: StepResult }
  | { kind: "report"; report: DeepReport; reportAtt: string }
  | { kind: "refused"; reason: AccessReason };

/** The order the browser runner follows (A5); returned by startDeepRun as `plan`. */
export const DEEP_PLAN: StepName[] = [
  "start",
  "money",
  "site",
  "signals",
  "peers",
  "audit",
  "crawl",
  "pagespeed",
  "competitor",
  "synthesis",
  "finish",
];

/** Request and result limits (A4). */
export const DEEP_LIMITS = {
  requestBytes: 256 * 1024,
  stepResultBytes: 48 * 1024,
  stepResultFacts: 200,
  synthesisFactsBytes: 150 * 1024,
  crawlBatchesMax: 3,
  crawlPagesMax: 30,
  competitorsMax: 3,
  peerEditsMax: 3,
  anafCallsPerRun: 9,
} as const;

/**
 * Predicates the engine emits (fact.predicate). Eng 3's report logic and Eng 2's
 * "Dovezi" tab key on these; labels for each live in parse/labels.ts.
 * Per-year facts carry the year in the id: "money.turnover.2025".
 */
export const KNOWN_PREDICATES = [
  // identity (ANAF v9, ONRC index)
  "identity.name",
  "identity.cui",
  "identity.reg_no",
  "identity.legal_form",
  "identity.status",
  "identity.caen",
  "identity.seat",
  "identity.vat_payer",
  "identity.registered_at",
  "identity.website_registry",
  // money (ANAF bilanț, per year; derived)
  "money.filed",
  "money.turnover",
  "money.revenue_total",
  "money.expenses",
  "money.profit_pretax",
  "money.profit_net",
  "money.receivables",
  "money.debts",
  "money.equity",
  "money.cash",
  "money.caen_rev2",
  "money.margin_pretax",
  "money.growth_turnover",
  "money.growth_turnover_3y",
  "money.expenses_vs_revenue",
  "money.profit_change",
  "money.days_to_collect",
  // people (bilanț headcount; site roles without names)
  "people.employees",
  "people.employees_change",
  "people.revenue_per_employee",
  "people.hiring",
  "people.job_titles",
  "people.roles",
  "people.departments",
  "people.team_size_published",
  "people.admin_count",
  // site (discovery, audit, crawl)
  "site.url",
  "site.status",
  "site.proof",
  "site.https",
  "site.dns.mx",
  "site.dns.spf",
  "site.dns.dmarc",
  "site.pages_read",
  "site.cui.present",
  "site.reg_no.present",
  "site.contact.present",
  "site.phone.present",
  "site.email.generic",
  "site.email.personal_count",
  "site.contact_form.present",
  "site.booking.present",
  "site.booking.provider",
  "site.delivery.provider",
  "site.chat.provider",
  "site.shop.present",
  "site.analytics.present",
  "site.consent.before_analytics",
  "site.legal.privacy",
  "site.legal.terms",
  "site.legal.anpc",
  "site.audit.important",
  "site.audit.minor",
  "site.audit.ok",
  "site.audit.issue",
  "site.tech",
  "site.speed.mobile",
  "site.tdm_reserved",
  // offers (crawl: rules and Haiku, with verified quotes)
  "offers.services",
  "offers.price",
  "offers.hours",
  "offers.booking_method",
  "offers.promo",
  "offers.service_area",
  // presence
  "presence.social_linked",
  "presence.google_profile_linked",
  "presence.social_only",
  "presence.social_found",
  "presence.social_profile",
  "presence.news.count",
  "presence.news.item",
  // AI web-search profile (each item cites a returned search result)
  "profile.tradeNames",
  "profile.people",
  "profile.customers",
  "profile.reviews",
  "profile.ads",
  "profile.events",
  "profile.marketplaces",
  "profile.stores",
  "profile.phones",
  "profile.siteAlerts",
  "people.network",
  "profile.trademarks",
  "profile.publicContracts",
  "profile.euFunds",
  "profile.domains",
  "profile.apps",
  "profile.followers",
  "profile.jobs",
  // risk (courts, TED)
  "risk.courts.checked",
  "risk.courts.as_plaintiff",
  "risk.courts.as_defendant",
  "risk.courts.insolvency_debtor",
  "risk.courts.as_creditor",
  "risk.courts.by_category",
  "risk.ted.awards",
  // peers (MF shard)
  "peers.scope",
  "peers.n",
  "peers.size_band",
  "peers.band",
  "peers.rank",
  "peers.rival",
  // competitors (rivals' own sites)
  "competitors.site",
] as const;
export type KnownPredicate = (typeof KNOWN_PREDICATES)[number];

/**
 * Vortex Scan — shared contract between the company index, the website audit,
 * the blueprint engine, the scan UI and the PDF. Every user-facing string is
 * bilingual so switching language never re-runs a scan.
 */

export type Lang = "en" | "ro";
export type Bilingual = { en: string; ro: string };
export type Range = { low: number; high: number };

/* ------------------------------------------------------------------ search */

export type CompanyStatus = "active" | "inactive" | "dissolved" | "unknown";

/** One row of the Romanian company index (Trade Register open data). */
export type CompanySuggestion = {
  /** Fiscal code (CUI), digits only. */
  cui: string;
  /** Official name, e.g. "VORTEX HUB S.R.L.". */
  name: string;
  /** Readable name, e.g. "Vortex Hub SRL". */
  displayName: string;
  county?: string;
  city?: string;
  /** Trade Register number, e.g. "J2026033767000". */
  regNo?: string;
  /** Main CAEN code when known (4 digits). */
  caen?: string;
  status: CompanyStatus;
  /** Registration year. */
  founded?: number;
  /** Website listed in the Trade Register (WEB column), if any. */
  website?: string;
};

/** What the search box understood from the visitor's input. */
export type SearchIntent =
  | { kind: "empty" }
  | { kind: "cui"; cui: string }
  | { kind: "website"; url: string; host: string }
  | { kind: "name"; query: string };

/** Where a scan starts: a company (by CUI) and/or a website. */
export type ScanTarget = { cui?: string; url?: string; query?: string };

/* ----------------------------------------------------------------- company */

export type CompanyProfile = {
  cui: string;
  name: string;
  displayName: string;
  regNo?: string;
  legalForm?: string;
  address?: string;
  county?: string;
  city?: string;
  phone?: string;
  caen?: string;
  caenLabel?: Bilingual;
  registeredAt?: string;
  vatPayer?: boolean;
  eInvoice?: boolean;
  inactive?: boolean;
  /** Website we found or the visitor gave. */
  website?: string;
  sources: Array<"anaf" | "index">;
};

export type WebsiteDiscovery = {
  url: string;
  host: string;
  /** 0–1: how sure we are the site belongs to the company. */
  confidence: number;
  /** Why we believe it, e.g. "CUI 54747928 found in the footer". */
  evidence: string[];
};

/* ------------------------------------------------------------------- audit */

export type Severity = "critical" | "high" | "medium" | "low";
export type AuditCategory =
  | "performance"
  | "seo"
  | "accessibility"
  | "security"
  | "conversion"
  | "content"
  | "technology";
export type Effort = "quick" | "medium" | "project";

export type AuditFinding = {
  /** Stable check id, e.g. "seo.meta-description-missing". */
  id: string;
  category: AuditCategory;
  severity: Severity;
  title: Bilingual;
  detail: Bilingual;
  recommendation: Bilingual;
  /** Short proof from the page (selector, value, header…). */
  evidence?: string;
  effort: Effort;
};

export type DetectedTechnology = {
  name: string;
  category:
    | "cms"
    | "ecommerce"
    | "builder"
    | "framework"
    | "analytics"
    | "marketing"
    | "chat"
    | "booking"
    | "payments"
    | "consent"
    | "hosting"
    | "other";
  confidence: number;
};

export type SiteSignals = {
  hasContactForm: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasWhatsApp: boolean;
  hasLiveChat: boolean;
  hasOnlineBooking: boolean;
  hasEcommerce: boolean;
  hasCookieConsent: boolean;
  hasAnalytics: boolean;
  hasMarketingPixel: boolean;
  hasStructuredData: boolean;
  hasNewsletter: boolean;
  hasBlog: boolean;
  languages: string[];
  socialLinks: string[];
  /** CUI printed on the site, if any. */
  cuiOnSite?: string;
};

export type PageSpeedResult = {
  strategy: "mobile" | "desktop";
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  lcpMs?: number;
  cls?: number;
  tbtMs?: number;
  /** Real-user (CrUX) data when the site has enough traffic. */
  fieldLcpMs?: number;
  fieldInpMs?: number;
};

export type WebsiteAudit = {
  url: string;
  finalUrl: string;
  host: string;
  fetchedAt: string;
  reachable: boolean;
  https: boolean;
  statusCode?: number;
  responseMs?: number;
  pages: Array<{ url: string; status: number; title?: string }>;
  meta: {
    title?: string;
    description?: string;
    lang?: string;
    canonical?: string;
    ogImage?: string;
    favicon?: string;
  };
  technologies: DetectedTechnology[];
  signals: SiteSignals;
  /** 0–100 per area; `performance` comes from PageSpeed when available. */
  scores: {
    performance?: number;
    seo: number;
    accessibility: number;
    security: number;
    conversion: number;
    content?: number;
    overall: number;
  };
  pagespeed?: PageSpeedResult | null;
  /** First-screen screenshot (data URI) from Lighthouse, for the overview card. */
  screenshot?: string;
  /**
   * How much of the site we could read: "client-rendered" pages ship no text
   * in their HTML, so signals reading as false there mean "unknown".
   */
  coverage?: "full" | "client-rendered" | "unavailable";
  crawl?: { robotsTxt: boolean; sitemapUrls?: number; sitemapPartial?: boolean; checksRun: number };
  findings: AuditFinding[];
};

/* ---------------------------------------------------- presence/competitors */

export type PresencePlatform =
  | "website"
  | "google-business"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "x";

/** A channel we looked for. Metrics appear only when we actually measured them. */
export type PresenceProfile = {
  platform: PresencePlatform;
  status: "active" | "detected" | "missing";
  url?: string;
  /** e.g. { label: "Rating", value: "4.8 · 327 reviews" } — only real data. */
  metric?: { label: Bilingual; value: string };
};

export type OnlinePresence = {
  profiles: PresenceProfile[];
  /** From Google Places when a key is configured. */
  googleRating?: { rating: number; reviews: number; mapsUrl?: string };
};

/** A local business in the same activity, found in the company index. */
export type Competitor = {
  cui: string;
  name: string;
  city?: string;
  website?: string;
  /** Overall website score when we audited it (0–100). */
  websiteScore?: number;
};

/* --------------------------------------------------------------- blueprint */

export type BusinessType = {
  /** Playbook id, e.g. "dental-clinic", "restaurant", "ecommerce". */
  id: string;
  label: Bilingual;
  sector: Bilingual;
  confidence: number;
  /** What the classification rests on (CAEN, words on the site…). */
  basis: string[];
};

export type AutomationOpportunity = {
  id: string;
  title: Bilingual;
  problem: Bilingual;
  solution: Bilingual;
  /** Business process it touches, e.g. "appointments", "invoicing". */
  process: string;
  impact: "high" | "medium" | "low";
  complexity: "low" | "medium" | "high";
  hoursSavedPerMonth: Range;
  monthlySavingsRon: Range;
  setupCostRon: Range;
  monthlyToolCostRon: Range;
  paybackMonths: Range;
  tools: string[];
  /** The inputs behind the numbers, stated plainly. */
  assumptions: Bilingual[];
};

export type RoadmapPhase = {
  /** 1-based month range, e.g. 2–3. */
  startMonth: number;
  endMonth: number;
  /** Short stage name, e.g. "Foundation". */
  stage: Bilingual;
  title: Bilingual;
  items: Bilingual[];
  tag: "essential" | "high-impact" | "growth";
  /** Opportunities delivered in this phase. */
  opportunityIds: string[];
};

/** One of the three strategic directions offered after the analysis. */
export type StrategyOption = {
  id: "acquire" | "automate" | "assist" | string;
  title: Bilingual;
  summary: Bilingual;
  tactics: Bilingual[];
  /** Headline outcome, e.g. 60–80 % less manual work, with its basis. */
  outcome: { label: Bilingual; range: Range; unit: "%" | "hours" | "RON"; basis: Bilingual };
  implementation: "low" | "medium" | "high";
  timeToValueMonths: Range;
  /** 1–3 → €, €€, €€€ */
  investmentLevel: 1 | 2 | 3;
  investmentRon: Range;
  opportunityIds: string[];
  recommended: boolean;
};

/** Cumulative economics month by month (for the 6/12/24-month views). */
export type ProjectionPoint = {
  month: number;
  cumulativeSavingsRon: Range;
  cumulativeCostRon: Range;
};

/** Inputs the visitor can adjust in the strategy simulation. */
export type SimulationInputs = {
  teamSize: number;
  hourlyCostRon: number;
  /** Multiplier on the playbook's typical volumes (0.5–2). */
  volumeFactor: number;
};

export type VortexOffer = {
  planId: "starter" | "growth" | "pro" | "project";
  title: Bilingual;
  why: Bilingual;
  includes: Bilingual[];
  /** Human wording of the price, e.g. "From 50 EUR / month + setup". */
  priceNote: Bilingual;
};

export type Blueprint = {
  id: string;
  generatedAt: string;
  /** "rules" = deterministic playbooks; "ai" = enriched by Claude. */
  engine: "rules" | "ai";
  target: ScanTarget;
  company?: CompanyProfile;
  audit?: WebsiteAudit;
  businessType: BusinessType;
  presence?: OnlinePresence;
  competitors?: Competitor[];
  scores: { digitalMaturity: number; websiteHealth: number; automationPotential: number };
  headline: Bilingual;
  summary: Bilingual;
  opportunities: AutomationOpportunity[];
  /** The website findings worth doing first. */
  websiteActions: AuditFinding[];
  totals: {
    hoursSavedPerMonth: Range;
    monthlySavingsRon: Range;
    annualSavingsRon: Range;
    setupCostRon: Range;
    paybackMonths: Range;
  };
  strategies: StrategyOption[];
  roadmap: RoadmapPhase[];
  projection: ProjectionPoint[];
  offer: VortexOffer;
  assumptions: {
    hourlyCostRon: number;
    hourlyCostBasis: Bilingual;
    teamSize: Range;
    /** Defaults for the strategy simulation sliders. */
    simulation: SimulationInputs;
    notes: Bilingual[];
  };
  disclaimer: Bilingual;
};

/* ---------------------------------------------------------------- scan run */

/** The analysis checklist from the "Analysing your business…" screen. */
export type ScanStepId =
  | "identify"
  | "website"
  | "technology"
  | "presence"
  | "competitors"
  | "journey"
  | "opportunities"
  | "strategy";

export type ScanStepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export type ScanStep = {
  id: ScanStepId;
  status: ScanStepStatus;
  label: Bilingual;
  /** Live lines for the findings ticker. */
  notes: Bilingual[];
  startedAt?: number;
  finishedAt?: number;
  error?: string;
};

export type ScanLeadInput = {
  email: string;
  fullName?: string;
  company?: string;
  consent: true;
  lang: Lang;
  blueprintId: string;
  summary: {
    businessType: string;
    digitalMaturity: number;
    monthlySavingsRon: Range;
    recommendedPlan: VortexOffer["planId"];
    website?: string;
    cui?: string;
  };
};

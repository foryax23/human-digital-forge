import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ScanStage, ScanState } from "@/components/scan/scan-state";
import { deriveJourney } from "@/components/scan/report/journey";
import {
  createBlueprint,
  findCompanyWebsite,
  lookupCompany,
  scanPageSpeed,
  scanPresence,
  scanWebsite,
} from "@/lib/scan.functions";
import { applyPageSpeed } from "@/lib/scan/audit/merge";
import { displayPlan } from "@/lib/scan/blueprint/display";
import { hoursQty } from "@/lib/scan/blueprint/format";
import { classifyBusiness, competitorKeywords } from "@/lib/scan/blueprint/taxonomy";
import { findCompanyByCui, searchCompanies } from "@/lib/scan/company-search";
import { findCompetitors } from "@/lib/scan/competitors";
import { SAMPLE_BLUEPRINT } from "@/lib/scan/fixtures/sample-blueprint";
import type {
  Bilingual,
  Blueprint,
  CompanyProfile,
  CompanySuggestion,
  Competitor,
  OnlinePresence,
  PageSpeedResult,
  ScanStep,
  ScanStepId,
  ScanTarget,
  WebsiteAudit,
  WebsiteDiscovery,
} from "@/lib/scan/types";

/*
 * Runs a Vortex Scan in the browser as a chain of short server calls, so every
 * checklist item ticks when its own call returns:
 *
 *   identify ─┬─ website → technology → (identify from the site) → presence → journey ─┐
 *             └─ competitors (+ two competitor sites, in the background) ──────────────┴─ blueprint
 *   PageSpeed runs alongside from the moment a URL is known.
 *
 * Steps that can't run are "skipped" with a reason; failures are "failed" and
 * the scan carries on. Finished runs are cached per target for the session.
 */

const L = (en: string, ro: string): Bilingual => ({ en, ro });

/** The four stages of the scan header (01 Find business … 04 Results). */
export const SCAN_STAGES: Array<{ id: ScanStage; en: string; ro: string }> = [
  { id: "find", en: "Find business", ro: "Găsește afacerea" },
  { id: "analyse", en: "Analysis", ro: "Analiză" },
  { id: "strategy", en: "Strategy", ro: "Strategie" },
  { id: "results", en: "Results", ro: "Rezultate" },
];

export const SCAN_STEP_ORDER: ScanStepId[] = [
  "identify",
  "website",
  "technology",
  "presence",
  "competitors",
  "journey",
  "opportunities",
  "strategy",
];

export const SCAN_STEP_LABELS: Record<ScanStepId, Bilingual> = {
  identify: L("Identifying business", "Identificăm afacerea"),
  website: L("Scanning website", "Scanăm site-ul"),
  technology: L("Detecting technologies", "Detectăm tehnologiile"),
  presence: L("Analysing online presence", "Analizăm prezența online"),
  competitors: L("Researching competitors", "Căutăm concurenții"),
  journey: L("Mapping customer journey", "Analizăm parcursul clientului"),
  opportunities: L("Finding what can be automated", "Căutăm ce se poate automatiza"),
  strategy: L("Generating strategy options", "Pregătim variantele de strategie"),
};

/** How long the blueprint waits for PageSpeed / competitor audits once the rest is done. */
const LATE_DATA_GRACE_MS = 10_000;
/** Hard cap for the background audits of competitor websites. */
const COMPETITOR_AUDIT_TIMEOUT_MS = 30_000;
const CACHE_PREFIX = "vortex-scan:v1:";

export type ScanEdit = { businessTypeId?: string; city?: string; website?: string };

/* ------------------------------------------------------------------ target */

/** Adds https:// when missing; returns undefined for anything that isn't an http(s) URL. */
export function normaliseUrl(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

const CUI_PATTERN = /^(ro)?\s*(\d{2,10})$/i;
const DOMAIN_PATTERN = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

/** Reads /scan's search params (or free text) into a scan target. */
export function toScanTarget(input: { cui?: string; url?: string; q?: string }): ScanTarget | null {
  const cui = input.cui?.trim().match(CUI_PATTERN)?.[2];
  const url = normaliseUrl(input.url);
  if (cui) return url ? { cui, url } : { cui };
  if (url) return { url };
  const query = input.q?.trim().slice(0, 200);
  if (!query) return null;
  const queryCui = query.match(CUI_PATTERN)?.[2];
  if (queryCui) return { cui: queryCui };
  if (DOMAIN_PATTERN.test(query)) {
    const queryUrl = normaliseUrl(query);
    if (queryUrl) return { url: queryUrl };
  }
  return { query };
}

/** Stable cache key for a target. */
export function scanKey(target: ScanTarget) {
  if (target.cui) return `cui:${target.cui}${target.url ? `|${new URL(target.url).host}` : ""}`;
  if (target.url) {
    const url = new URL(target.url);
    return `url:${url.host.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
  }
  return `q:${(target.query ?? "").toLowerCase().replace(/\s+/g, " ")}`;
}

/* ------------------------------------------------------------------- state */

export function createSteps(): ScanStep[] {
  return SCAN_STEP_ORDER.map((id) => ({
    id,
    status: "pending",
    label: SCAN_STEP_LABELS[id],
    notes: [],
  }));
}

export function initialScanState(target: ScanTarget): ScanState {
  return { target, status: "idle", steps: createSteps() };
}

type Update = (state: ScanState) => ScanState;
type PageSpeedWithShot = PageSpeedResult & { screenshot?: string };

const patchStep =
  (id: ScanStepId, patch: Partial<ScanStep>): Update =>
  (state) => ({
    ...state,
    steps: state.steps.map((step) => (step.id === id ? { ...step, ...patch } : step)),
  });

const addNote =
  (id: ScanStepId, note: Bilingual): Update =>
  (state) => ({
    ...state,
    steps: state.steps.map((step) =>
      step.id === id ? { ...step, notes: [...step.notes, note] } : step,
    ),
  });

/* ------------------------------------------------------------------- notes */

const enNum = (n: number) => n.toLocaleString("en-GB");
const roNum = (n: number) => n.toLocaleString("ro-RO");
/** Romanian puts "de" between a number from 20 up and its noun. */
const roDe = (n: number) => (n >= 20 && (n % 100 === 0 || n % 100 >= 20) ? "de " : "");

const PLATFORM_NAMES: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
};

function joinNames(names: string[], and: string) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

function identifyNotes(company: CompanyProfile): Bilingual[] {
  const notes: Bilingual[] = [];
  const where = company.city ?? company.county;
  const name = where ? `${company.displayName} · ${where}` : company.displayName;
  notes.push(L(name, name));
  if (company.caen) {
    notes.push(
      L(
        `CAEN ${company.caen}${company.caenLabel ? ` · ${company.caenLabel.en}` : ""}`,
        `CAEN ${company.caen}${company.caenLabel ? ` · ${company.caenLabel.ro}` : ""}`,
      ),
    );
  }
  if (company.inactive) {
    notes.push(L("Listed as inactive by ANAF", "Figurează ca inactivă la ANAF"));
  }
  return notes;
}

function websiteNotes(audit: WebsiteAudit): Bilingual[] {
  const n = audit.pages.length;
  const notes = [
    L(
      `${enNum(n)} ${n === 1 ? "page" : "pages"} analysed on ${audit.host}${audit.https ? ", over HTTPS" : ""}`,
      `${roNum(n)} ${roDe(n)}${n === 1 ? "pagină analizată" : "pagini analizate"} pe ${audit.host}${audit.https ? ", cu HTTPS" : ""}`,
    ),
  ];
  if (audit.responseMs) {
    notes.push(
      L(
        `First response in ${enNum(audit.responseMs)} ms`,
        `Primul răspuns în ${roNum(audit.responseMs)} ms`,
      ),
    );
  }
  return notes;
}

function technologyNotes(audit: WebsiteAudit): Bilingual[] {
  const names = [...audit.technologies]
    .sort((a, b) => b.confidence - a.confidence)
    .map((tech) => tech.name);
  if (!names.length) {
    return [L("No common platforms detected", "Nu am detectat platforme cunoscute")];
  }
  const top = names.slice(0, 3);
  const more = names.length - top.length;
  return [
    L(
      `${joinNames(top, "and")}${more ? ` and ${more} more` : ""} detected`,
      `Am detectat ${joinNames(top, "și")}${more ? ` și încă ${more}` : ""}`,
    ),
  ];
}

function presenceNotes(presence: OnlinePresence): Bilingual[] {
  const notes: Bilingual[] = [];
  const social = presence.profiles
    .filter((profile) => PLATFORM_NAMES[profile.platform] && profile.status !== "missing")
    .map((profile) => PLATFORM_NAMES[profile.platform]);
  notes.push(
    social.length
      ? L(`${joinNames(social, "and")} found`, `Am găsit ${joinNames(social, "și")}`)
      : L("No social profiles linked from the site", "Site-ul nu are linkuri către rețele sociale"),
  );
  const rating = presence.googleRating;
  if (rating) {
    notes.push(
      L(
        `Google rating ${rating.rating.toLocaleString("en-GB", { minimumFractionDigits: 1 })} from ${enNum(rating.reviews)} reviews`,
        `Nota Google ${rating.rating.toLocaleString("ro-RO", { minimumFractionDigits: 1 })} din ${roNum(rating.reviews)} ${roDe(rating.reviews)}recenzii`,
      ),
    );
  } else if (
    presence.profiles.some((p) => p.platform === "google-business" && p.status !== "missing")
  ) {
    notes.push(L("Google Business profile detected", "Am găsit profilul Google Business"));
  }
  return notes;
}

function competitorNotes(list: Competitor[], city?: string): Bilingual[] {
  const n = list.length;
  if (!n) return [L("No similar businesses found nearby", "Nu am găsit afaceri similare în zonă")];
  const notes = [
    L(
      `${enNum(n)} local ${n === 1 ? "competitor" : "competitors"} found${city ? ` in ${city}` : ""}`,
      `Am găsit ${roNum(n)} ${roDe(n)}${n === 1 ? "concurent local" : "concurenți locali"}${city ? ` în ${city}` : ""}`,
    ),
  ];
  const withSite = list.filter((c) => c.website).length;
  if (withSite) {
    notes.push(
      L(
        `${enNum(withSite)} with a website`,
        `${roNum(withSite)} ${withSite === 1 ? "are" : "au"} site`,
      ),
    );
  }
  return notes;
}

function competitorScoreNote(scored: number): Bilingual {
  return L(
    `${scored === 1 ? "1 competitor website" : `${scored} competitor websites`} scored`,
    `${scored === 1 ? "Un site concurent evaluat" : `${scored} site-uri concurente evaluate`}`,
  );
}

function journeyNotes(state: ScanState): Bilingual[] {
  const stages = deriveJourney({
    audit: state.audit,
    presence: state.presence,
    company: state.company,
  });
  const strong = stages.filter((stage) => stage.status === "strong").length;
  const missing = stages.filter((stage) => stage.status === "missing");
  const notes = [
    L(
      `${strong} of ${stages.length} journey stages look strong`,
      `${strong} din ${stages.length} etape ale parcursului sunt solide`,
    ),
  ];
  if (missing.length) {
    notes.push(
      L(
        `Missing: ${missing.map((stage) => stage.label.en).join(", ")}`,
        `${missing.length === 1 ? "Lipsește" : "Lipsesc"}: ${missing.map((stage) => stage.label.ro).join(", ")}`,
      ),
    );
  }
  return notes;
}

function opportunityNotes(blueprint: Blueprint): Bilingual[] {
  const n = blueprint.opportunities.length;
  const hours = blueprint.totals.hoursSavedPerMonth;
  const notes = [
    L(
      `${enNum(n)} ${n === 1 ? "task" : "tasks"} that can be automated`,
      n === 1
        ? "Am găsit o activitate care se poate automatiza"
        : `Am găsit ${roNum(n)} ${roDe(n)}activități care se pot automatiza`,
    ),
  ];
  if (n && hours.high > 0) {
    // The same figure as the plan's headline and "Pe scurt" (displayPlan).
    const shown = hoursQty(displayPlan(blueprint).totals.hoursPerMonth);
    notes.push(
      L(
        `We estimate about ${shown.en} won back a month`,
        `Estimăm cam ${shown.ro} câștigate pe lună`,
      ),
    );
  }
  return notes;
}

function strategyNotes(blueprint: Blueprint): Bilingual[] {
  const n = blueprint.strategies.length;
  const notes = [
    L(
      `${enNum(n)} strategy ${n === 1 ? "option" : "options"} ready`,
      `${roNum(n)} ${n === 1 ? "variantă de strategie pregătită" : "variante de strategie pregătite"}`,
    ),
  ];
  const recommended = blueprint.strategies.find((strategy) => strategy.recommended);
  if (recommended) {
    notes.push(L(`Recommended: ${recommended.title.en}`, `Recomandată: ${recommended.title.ro}`));
  }
  if (blueprint.engine === "ai") notes.push(L("Refined with AI", "Revizuită cu AI"));
  return notes;
}

/* ------------------------------------------------------------------ helpers */

class StepStop extends Error {
  constructor(
    readonly status: "skipped" | "failed",
    readonly reason: Bilingual,
  ) {
    super(reason.en);
  }
}

const skip = (en: string, ro: string) => new StepStop("skipped", L(en, ro));
const fail = (en: string, ro: string) => new StepStop("failed", L(en, ro));

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** English diagnostic stored on a step that threw (ScanStep.error; not rendered in the UI). */
const FAILURE_MESSAGES: Record<ScanStepId, string> = {
  identify: "We couldn't reach the company registry just now.",
  website: "We couldn't scan the website this time. Please try again in a moment.",
  technology: "We couldn't read the website's technologies.",
  presence: "We couldn't check the online presence this time.",
  competitors: "We couldn't search for competitors this time.",
  journey: "We couldn't map the customer journey.",
  opportunities: "We couldn't calculate the automation opportunities.",
  strategy: "We couldn't generate the strategy options.",
};

const FAILURE_NOTE = L(
  "Couldn't finish this step, so we're carrying on without it",
  "Pasul nu s-a putut finaliza, așa că mergem mai departe fără el",
);

/** A step the server refused for too many requests (RateLimitedError in src/lib/abuse). */
const RATE_LIMITED_NOTE = L(
  "Too many requests. Please try again in a few minutes.",
  "Prea multe cereri, încearcă din nou peste câteva minute.",
);

const isRateLimited = (error: unknown) =>
  String((error as { message?: unknown } | null)?.message ?? "").startsWith("rate_limited");

/** A readable name for the site when there is no company record. */
function siteName(audit: WebsiteAudit | null | undefined) {
  const title = audit?.meta.title?.split(/\s[|–—·-]\s/)[0]?.trim();
  if (title && title.length >= 2 && title.length <= 80) return title;
  return audit?.host.replace(/^www\./, "");
}

function companyFromSuggestion(row: CompanySuggestion): CompanyProfile {
  return {
    cui: row.cui,
    name: row.name,
    displayName: row.displayName,
    regNo: row.regNo,
    county: row.county,
    city: row.city,
    caen: row.caen,
    registeredAt: row.founded ? String(row.founded) : undefined,
    inactive: row.status === "inactive" || row.status === "dissolved" ? true : undefined,
    website: row.website,
    sources: ["index"],
  };
}

/** ANAF's record, completed with the company index (website, CAEN, city). */
function mergeCompany(anaf: CompanyProfile | null, row: CompanySuggestion | undefined) {
  if (!anaf) return row ? companyFromSuggestion(row) : null;
  if (!row) return anaf;
  return {
    ...anaf,
    city: anaf.city ?? row.city,
    county: anaf.county ?? row.county,
    caen: anaf.caen ?? row.caen,
    regNo: anaf.regNo ?? row.regNo,
    website: anaf.website ?? row.website,
    sources: Array.from(new Set([...anaf.sources, "index" as const])),
  };
}

/** The company index row for a CUI, or the best match for a name. */
async function indexRow(query: string, cui?: string) {
  try {
    if (cui) return (await findCompanyByCui(cui)) ?? undefined;
    return (await searchCompanies(query, { limit: 1 }))[0];
  } catch (error) {
    console.warn("[scan] company index lookup failed", error);
    return undefined;
  }
}

/* ------------------------------------------------------------------- runner */

type IO = {
  get: () => ScanState;
  set: (update: Update) => void;
};

type Overrides = ScanEdit;

/**
 * One scan run (full or partial). Owns the authoritative copy of the state and
 * mirrors every change to React; a cancelled run stops writing.
 */
function createRunner(io: IO, overrides: Overrides) {
  let pagespeedTask: Promise<void> | null = null;
  let pagespeedSettled = false;
  /** PageSpeed's result (with the screenshot) once it lands. */
  let pagespeed: PageSpeedWithShot | null = null;
  let competitorAudits: Promise<void> = Promise.resolve();

  async function step<T>(
    id: ScanStepId,
    work: (note: (note: Bilingual) => void) => Promise<T>,
  ): Promise<T | undefined> {
    io.set(
      patchStep(id, {
        status: "running",
        startedAt: Date.now(),
        finishedAt: undefined,
        notes: [],
        error: undefined,
      }),
    );
    try {
      const value = await work((note) => io.set(addNote(id, note)));
      io.set(patchStep(id, { status: "done", finishedAt: Date.now() }));
      return value;
    } catch (error) {
      if (error instanceof StepStop) {
        io.set((state) =>
          addNote(
            id,
            error.reason,
          )(
            patchStep(id, {
              status: error.status,
              finishedAt: Date.now(),
              error: error.status === "failed" ? error.reason.en : undefined,
            })(state),
          ),
        );
      } else {
        const limited = isRateLimited(error);
        if (!limited) console.warn(`[scan] step "${id}" failed`, error);
        io.set((state) =>
          addNote(
            id,
            limited ? RATE_LIMITED_NOTE : FAILURE_NOTE,
          )(
            patchStep(id, {
              status: "failed",
              finishedAt: Date.now(),
              error: FAILURE_MESSAGES[id],
            })(state),
          ),
        );
      }
      return undefined;
    }
  }

  function startPageSpeed(url: string) {
    if (pagespeedTask) return;
    pagespeedTask = scanPageSpeed({ data: { url } })
      .then((value) => {
        if (!value) return;
        pagespeed = value;
        const { screenshot: _screenshot, ...result } = value;
        io.set((state) => ({
          ...state,
          pagespeed: result,
          audit: state.audit ? applyPageSpeed(state.audit, value) : state.audit,
          blueprint: state.blueprint?.audit
            ? { ...state.blueprint, audit: applyPageSpeed(state.blueprint.audit, value) }
            : state.blueprint,
        }));
      })
      .catch((error) => console.warn("[scan] PageSpeed unavailable", error))
      .finally(() => {
        pagespeedSettled = true;
      });
  }

  async function identifyByTarget(target: ScanTarget) {
    await step("identify", async (note) => {
      let company: CompanyProfile | null = null;
      if (target.cui) {
        const cui = target.cui;
        const [anaf, row] = await Promise.all([
          lookupCompany({ data: { cui } }).catch((error) => {
            console.warn("[scan] ANAF lookup failed", error);
            return null;
          }),
          indexRow(cui, cui),
        ]);
        company = mergeCompany(anaf, row);
        if (!company) {
          throw fail(
            `No registered company found for CUI ${cui}`,
            `Nu am găsit nicio firmă înregistrată cu CUI-ul ${cui}`,
          );
        }
      } else if (target.query) {
        const row = await indexRow(target.query);
        if (!row) {
          throw skip(
            `No registered company matched “${target.query}”`,
            `Nu am găsit o firmă înregistrată care să se potrivească cu „${target.query}”`,
          );
        }
        note(
          L(`Best match for “${target.query}”`, `Cea mai bună potrivire pentru „${target.query}”`),
        );
        const anaf = await lookupCompany({ data: { cui: row.cui } }).catch(() => null);
        company = mergeCompany(anaf, row);
      }
      if (!company) return;
      const found = company;
      io.set((state) => ({ ...state, company: found }));
      identifyNotes(found).forEach(note);
    });
  }

  /** Website-only scans: the CUI printed on the site identifies the company. */
  async function identifyFromSite() {
    await step("identify", async (note) => {
      const cui = io.get().audit?.signals.cuiOnSite?.replace(/\D/g, "");
      if (!cui) {
        throw skip(
          "No CUI on the website, so we're analysing the website only",
          "Nu am găsit CUI-ul pe site, așa că analizăm doar site-ul",
        );
      }
      note(L(`CUI ${cui} found on the website`, `Am găsit CUI-ul ${cui} pe site`));
      const [anaf, row] = await Promise.all([
        lookupCompany({ data: { cui } }).catch(() => null),
        indexRow(cui, cui),
      ]);
      const company = mergeCompany(anaf, row);
      if (!company) {
        throw skip(
          `CUI ${cui} isn't in the registry, so we're analysing the website only`,
          `CUI-ul ${cui} nu apare în registru, așa că analizăm doar site-ul`,
        );
      }
      const website = io.get().audit?.finalUrl;
      io.set((state) => ({
        ...state,
        company: { ...company, website: company.website ?? website },
      }));
      identifyNotes(company).forEach(note);
    });
  }

  async function websiteStep(givenUrl: string | undefined) {
    await step("website", async (note) => {
      const { company } = io.get();
      let url = givenUrl;
      if (!url) {
        if (!company) {
          throw skip(
            "No website or company to start from",
            "Nu avem un site sau o firmă de la care să pornim",
          );
        }
        note(L("Looking for the official website…", "Căutăm site-ul oficial…"));
        const discovery: WebsiteDiscovery | null = await findCompanyWebsite({
          data: {
            cui: company.cui,
            name: company.name,
            city: company.city,
            knownWebsite: company.website,
          },
        });
        io.set((state) => ({ ...state, discovery }));
        if (!discovery) {
          throw skip(
            "No website found for this company",
            "Nu am găsit un site pentru această firmă",
          );
        }
        url = discovery.url;
        note(L(`Found ${discovery.host}`, `Am găsit ${discovery.host}`));
      }

      startPageSpeed(url);
      const scanned = await scanWebsite({
        data: { url, cui: company?.cui, name: company?.name },
      });
      const audit = applyPageSpeed(scanned, pagespeed);
      io.set((state) => ({
        ...state,
        audit,
        company: state.company
          ? { ...state.company, website: state.company.website ?? audit.finalUrl }
          : state.company,
      }));
      if (!audit.reachable) {
        // robots.txt opt-out (audit/checks.ts scanOptOutFinding): say so, not "no answer".
        if (audit.findings.some((finding) => finding.id === "technology.scan-opt-out")) {
          throw fail(
            `${audit.host} asks not to be scanned (robots.txt), so we left it alone`,
            `${audit.host} cere să nu fie scanat (robots.txt), așa că nu l-am deschis`,
          );
        }
        throw fail(`${audit.host} didn't respond`, `${audit.host} nu a răspuns`);
      }
      websiteNotes(audit).forEach(note);
    });

    await step("technology", async (note) => {
      const { audit } = io.get();
      if (!audit?.reachable) {
        throw skip(
          "Needs a website we could open",
          "Avem nevoie de un site pe care să-l putem deschide",
        );
      }
      technologyNotes(audit).forEach(note);
    });
  }

  async function presenceStep() {
    await step("presence", async (note) => {
      const { company, audit } = io.get();
      const name = company?.displayName ?? siteName(audit);
      if (!name || name.length < 2) {
        throw skip("Needs a business name to look up", "Avem nevoie de numele afacerii");
      }
      const presence = await scanPresence({
        data: {
          name: name.slice(0, 200),
          city: overrides.city ?? company?.city,
          socialLinks: (audit?.signals.socialLinks ?? []).slice(0, 40),
          website: audit?.reachable ? audit.finalUrl : undefined,
        },
      });
      io.set((state) => ({ ...state, presence }));
      presenceNotes(presence).forEach(note);
    });
  }

  async function journeyStep() {
    await step("journey", async (note) => {
      const state = io.get();
      if (!state.audit?.reachable) {
        throw skip(
          "Needs a website to map the journey",
          "Avem nevoie de un site ca să analizăm parcursul clientului",
        );
      }
      journeyNotes(state).forEach(note);
    });
  }

  /** Scores the top two competitor websites in the background (timeboxed). */
  function auditCompetitors(list: Competitor[]) {
    const targets = list.filter((c) => normaliseUrl(c.website)).slice(0, 2);
    if (!targets.length) return;
    const work = Promise.allSettled(
      targets.map(async (competitor) => {
        const audit = await scanWebsite({ data: { url: normaliseUrl(competitor.website)! } });
        if (!audit.reachable) return;
        const score = audit.scores.overall;
        const apply = (items: Competitor[] | undefined) =>
          items?.map((item) =>
            item.cui === competitor.cui ? { ...item, websiteScore: score } : item,
          );
        io.set((state) => ({
          ...state,
          competitors: apply(state.competitors),
          blueprint: state.blueprint?.competitors
            ? { ...state.blueprint, competitors: apply(state.blueprint.competitors) }
            : state.blueprint,
        }));
      }),
    ).then((results) => {
      const scored = results.filter((r) => r.status === "fulfilled").length;
      const competitorStep = io.get().steps.find((s) => s.id === "competitors");
      if (scored && competitorStep?.status === "done") {
        const withScores = (io.get().competitors ?? []).filter(
          (c) => c.websiteScore != null,
        ).length;
        if (withScores) io.set(addNote("competitors", competitorScoreNote(withScores)));
      }
    });
    competitorAudits = Promise.race([work, sleep(COMPETITOR_AUDIT_TIMEOUT_MS)]);
  }

  async function competitorsStep() {
    await step("competitors", async (note) => {
      const { company, audit } = io.get();
      if (!company) {
        throw skip(
          "Needs a registered company to compare with",
          "Avem nevoie de o firmă înregistrată pentru comparație",
        );
      }
      const city = overrides.city ?? company.city;
      if (!city && !company.county) {
        throw skip(
          "No city on record to search nearby",
          "Registrul nu are orașul firmei, deci nu putem căuta în zonă",
        );
      }
      const typeId =
        overrides.businessTypeId ??
        classifyBusiness({
          caen: company.caen,
          caenLabel: company.caenLabel?.ro,
          name: company.name,
          title: audit?.meta.title,
          siteText: [audit?.meta.description, ...(audit?.pages.map((p) => p.title) ?? [])]
            .filter(Boolean)
            .join(" "),
          hints: { hasEcommerce: audit?.signals.hasEcommerce },
        }).id;
      const list = await findCompetitors({
        keywords: competitorKeywords(typeId),
        caen: company.caen,
        city,
        county: company.county,
        excludeCui: company.cui,
        limit: 6,
      });
      io.set((state) => ({ ...state, competitors: list }));
      competitorNotes(list, city).forEach(note);
      auditCompetitors(list);
    });
  }

  /** Opportunities + strategy: one blueprint call once the evidence is in. */
  async function blueprintSteps() {
    const blueprint = await step("opportunities", async (note) => {
      // With neither a company nor a website there is nothing real to plan from.
      const evidence = io.get();
      if (!evidence.company && !evidence.audit?.reachable) {
        throw skip(
          "Needs a company or a website we could analyse",
          "Avem nevoie de o firmă sau de un site pe care să-l putem analiza",
        );
      }
      if (pagespeedTask && !pagespeedSettled) {
        note(L("Waiting for the mobile speed test…", "Așteptăm testul de viteză pe mobil…"));
      }
      const deadline = sleep(LATE_DATA_GRACE_MS);
      await Promise.race([Promise.all([pagespeedTask, competitorAudits]), deadline]);

      io.set(patchStep("strategy", { status: "running", startedAt: Date.now(), notes: [] }));
      const state = io.get();
      const audit = state.audit ?? undefined;
      const result = await createBlueprint({
        data: {
          target: state.target,
          company: state.company
            ? { ...state.company, city: overrides.city ?? state.company.city }
            : undefined,
          // The screenshot only matters to the overview card; keep the payload small.
          audit: audit ? { ...audit, screenshot: undefined } : undefined,
          presence: state.presence ?? undefined,
          competitors: state.competitors?.slice(0, 10),
          businessTypeId: overrides.businessTypeId,
        },
      });
      const complete: Blueprint = {
        ...result,
        audit:
          result.audit && audit ? { ...result.audit, screenshot: audit.screenshot } : result.audit,
      };
      io.set((s) => ({ ...s, blueprint: complete }));
      opportunityNotes(complete).forEach(note);
      return complete;
    });

    if (blueprint) {
      io.set((state) =>
        strategyNotes(blueprint).reduce(
          (next, note) => addNote("strategy", note)(next),
          patchStep("strategy", { status: "done", finishedAt: Date.now() })(state),
        ),
      );
    } else {
      io.set((state) => {
        const skipped = state.steps.find((s) => s.id === "opportunities")?.status === "skipped";
        return addNote(
          "strategy",
          L(
            "Needs the list of what can be automated first",
            "Avem nevoie mai întâi de lista cu ce se poate automatiza",
          ),
        )(
          patchStep("strategy", {
            status: skipped ? "skipped" : "failed",
            finishedAt: Date.now(),
            error: skipped ? undefined : FAILURE_MESSAGES.strategy,
          })(state),
        );
      });
    }
    io.set((state) => ({
      ...state,
      status: state.blueprint ? "done" : "error",
      error: state.blueprint ? undefined : FAILURE_MESSAGES.strategy,
    }));
  }

  return {
    async full(target: ScanTarget) {
      io.set((state) => ({ ...state, status: "running", error: undefined }));
      const givenUrl = normaliseUrl(target.url);
      if (givenUrl) startPageSpeed(givenUrl);
      const hasCompanyTarget = Boolean(target.cui || target.query);

      if (hasCompanyTarget) await identifyByTarget(target);
      const competitorsTask = hasCompanyTarget ? competitorsStep() : null;
      await websiteStep(givenUrl);
      if (!hasCompanyTarget) await identifyFromSite();
      await presenceStep();
      await journeyStep();
      await (competitorsTask ?? competitorsStep());
      await blueprintSteps();
    },

    /**
     * A correction from the overview: a new website re-scans the site and what
     * depends on it; a new business type or city re-runs the competitors. The
     * strategy is rebuilt once at the end.
     */
    async update({ website, market }: { website?: string; market: boolean }) {
      io.set((state) => {
        let company = state.company;
        if (company && website) company = { ...company, website };
        if (company && market && overrides.city) company = { ...company, city: overrides.city };
        return {
          ...state,
          status: "running",
          error: undefined,
          company,
          ...(website ? { audit: null, pagespeed: null, presence: null, discovery: null } : {}),
        };
      });
      const marketTask = market ? competitorsStep() : null;
      if (website) {
        await websiteStep(website);
        await presenceStep();
        await journeyStep();
      }
      await marketTask;
      await blueprintSteps();
    },
  };
}

/* ------------------------------------------------------------------- cache */

type Cached = { savedAt: number; state: ScanState; overrides: Overrides };

function readCache(key: string): Cached | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Cached;
    return cached?.state?.status === "done" && cached.state.blueprint ? cached : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: Cached) {
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Over quota: the screenshot is the heavy part, so try again without it.
    try {
      const strip = (audit?: WebsiteAudit | null) =>
        audit ? { ...audit, screenshot: undefined } : audit;
      const state = {
        ...value.state,
        audit: strip(value.state.audit),
        blueprint: value.state.blueprint
          ? { ...value.state.blueprint, audit: strip(value.state.blueprint.audit) ?? undefined }
          : undefined,
      };
      window.sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ...value, state }));
    } catch {
      /* ignore */
    }
  }
}

function clearCache(key: string) {
  try {
    window.sessionStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------- demo */

/** A finished scan built from the sample blueprint (for /scan?demo=overview). */
export function demoScanState(): ScanState {
  const blueprint = SAMPLE_BLUEPRINT;
  const state: ScanState = {
    target: blueprint.target,
    status: "done",
    steps: createSteps(),
    company: blueprint.company ?? null,
    audit: blueprint.audit ?? null,
    pagespeed: blueprint.audit?.pagespeed ?? null,
    presence: blueprint.presence ?? null,
    competitors: blueprint.competitors ?? [],
    blueprint,
  };
  const notes: Record<ScanStepId, Bilingual[]> = {
    identify: state.company ? identifyNotes(state.company) : [],
    website: state.audit ? websiteNotes(state.audit) : [],
    technology: state.audit ? technologyNotes(state.audit) : [],
    presence: state.presence ? presenceNotes(state.presence) : [],
    competitors: competitorNotes(state.competitors ?? [], state.company?.city),
    journey: journeyNotes(state),
    opportunities: opportunityNotes(blueprint),
    strategy: strategyNotes(blueprint),
  };
  return {
    ...state,
    steps: state.steps.map((step) => ({ ...step, status: "done", notes: notes[step.id] })),
  };
}

/* -------------------------------------------------------------------- hook */

export type VortexScan = {
  state: ScanState;
  /** "cache": restored from this session; "demo": the sample blueprint. */
  origin: "live" | "cache" | "demo";
  /** False until the browser decided between the cache and a fresh run. */
  ready: boolean;
  /** True while an edit from the overview is being re-run. */
  updating: boolean;
  /** Stops the edit being re-run and puts back the analysis as it was before it. */
  cancelUpdate: () => void;
  /** Forgets the cached result and scans again from scratch. */
  rerun: () => void;
  /** Applies a correction and re-runs only the steps it affects. */
  edit: (patch: ScanEdit) => void;
};

/**
 * Orchestrates a scan for `target` (null = nothing to scan yet). With `demo`
 * it returns the sample blueprint as a finished scan, without any requests.
 */
export function useVortexScan(
  target: ScanTarget | null,
  options: { demo?: boolean } = {},
): VortexScan {
  const demo = Boolean(options.demo);
  const key = demo ? "demo" : target ? scanKey(target) : null;

  const [state, setState] = useState<ScanState>(() =>
    demo ? demoScanState() : initialScanState(target ?? {}),
  );
  const [origin, setOrigin] = useState<VortexScan["origin"]>(demo ? "demo" : "live");
  const [ready, setReady] = useState(demo);
  const [updating, setUpdating] = useState(false);
  const [nonce, setNonce] = useState(0);

  const stateRef = useRef(state);
  const runId = useRef(0);
  /** Invalidates the current run: its pending results are dropped. */
  const cancelRun = useCallback(() => {
    runId.current += 1;
  }, []);
  const overrides = useRef<Overrides>({});
  /** The analysis and overrides from before the edit being re-run, for cancelUpdate. */
  const beforeEdit = useRef<{ state: ScanState; overrides: Overrides } | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  /** Starts a runner from `from`; returns its IO-bound methods. */
  const begin = useCallback((from: ScanState) => {
    const id = ++runId.current;
    let current = from;
    const io: IO = {
      get: () => current,
      set: (update) => {
        if (id !== runId.current) return;
        current = update(current);
        stateRef.current = current;
        setState(current);
      },
    };
    return { runner: createRunner(io, overrides.current), isCurrent: () => id === runId.current };
  }, []);

  // Restore from the cache or start a fresh run whenever the target changes.
  useEffect(() => {
    if (demo) {
      const next = demoScanState();
      stateRef.current = next;
      setState(next);
      setOrigin("demo");
      setReady(true);
      return;
    }
    const current = targetRef.current;
    if (!key || !current) return;

    const cached = readCache(key);
    if (cached) {
      overrides.current = cached.overrides ?? {};
      stateRef.current = cached.state;
      setState(cached.state);
      setOrigin("cache");
      setReady(true);
      return cancelRun;
    }

    overrides.current = {};
    const fresh = initialScanState(current);
    stateRef.current = fresh;
    setState(fresh);
    setOrigin("live");
    setReady(true);

    // Deferred a tick so React's dev double-mount doesn't start two scans.
    const timer = window.setTimeout(() => {
      const { runner, isCurrent } = begin(fresh);
      runner.full(current).catch((error) => {
        console.error("[scan] run failed", error);
        if (!isCurrent()) return;
        const failed = {
          ...stateRef.current,
          status: "error" as const,
          error: FAILURE_MESSAGES.strategy,
        };
        stateRef.current = failed;
        setState(failed);
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      cancelRun();
    };
  }, [key, demo, nonce, begin, cancelRun]);

  // Keep finished live runs (and late PageSpeed/competitor merges) in the cache.
  useEffect(() => {
    if (!key || demo || state.status !== "done" || !state.blueprint) return;
    writeCache(key, { savedAt: Date.now(), state, overrides: overrides.current });
  }, [key, demo, state]);

  const rerun = useCallback(() => {
    if (demo) return;
    if (key) clearCache(key);
    setNonce((n) => n + 1);
  }, [demo, key]);

  const edit = useCallback(
    (patch: ScanEdit) => {
      if (demo) return;
      const website = patch.website !== undefined ? normaliseUrl(patch.website) : undefined;
      const marketChanged =
        (patch.businessTypeId && patch.businessTypeId !== overrides.current.businessTypeId) ||
        (patch.city?.trim() &&
          patch.city.trim() !== (overrides.current.city ?? stateRef.current.company?.city));
      if (!website && !marketChanged) return;

      beforeEdit.current ??= { state: stateRef.current, overrides: overrides.current };
      overrides.current = {
        ...overrides.current,
        ...(patch.businessTypeId ? { businessTypeId: patch.businessTypeId } : {}),
        ...(patch.city?.trim() ? { city: patch.city.trim() } : {}),
        ...(website ? { website } : {}),
      };

      // Only the affected steps go back to "pending".
      const affected: ScanStepId[] = website
        ? ["website", "technology", "presence", "journey", "opportunities", "strategy"]
        : ["competitors", "opportunities", "strategy"];
      if (website && marketChanged) affected.push("competitors");
      const from: ScanState = {
        ...stateRef.current,
        steps: stateRef.current.steps.map((step) =>
          affected.includes(step.id)
            ? {
                ...step,
                status: "pending",
                notes: [],
                error: undefined,
                startedAt: undefined,
                finishedAt: undefined,
              }
            : step,
        ),
      };

      setUpdating(true);
      const { runner, isCurrent } = begin(from);
      runner
        .update({ website, market: Boolean(marketChanged) })
        .catch((error) => console.error("[scan] update failed", error))
        .finally(() => {
          if (!isCurrent()) return;
          beforeEdit.current = null;
          setUpdating(false);
        });
    },
    [begin, demo],
  );

  const cancelUpdate = useCallback(() => {
    const before = beforeEdit.current;
    if (!before) return;
    beforeEdit.current = null;
    cancelRun();
    overrides.current = before.overrides;
    stateRef.current = before.state;
    setState(before.state);
    setUpdating(false);
  }, [cancelRun]);

  return useMemo(
    () => ({ state, origin, ready, updating, cancelUpdate, rerun, edit }),
    [state, origin, ready, updating, cancelUpdate, rerun, edit],
  );
}

import type {
  AuditFinding,
  AutomationOpportunity,
  Bilingual,
  OnlinePresence,
  Range,
  StrategyOption,
  WebsiteAudit,
} from "@/lib/scan/types";

import { PRICE_BOOK } from "./economics";
import { addRanges, formatRange, lcFirst, mapRange, midpoint, roundHours } from "./format";
import { bi, clamp, type Playbook, type StrategyKey } from "./model";
import { getTemplate } from "./playbooks";
import type { BusinessTypeDef } from "./taxonomy";

/*
 * The three directions offered after the analysis: win more customers,
 * automate operations, add an AI assistant. Outcomes come from stated
 * assumptions; investments come from the price book.
 */

export function strategyOf(opportunityId: string): StrategyKey {
  return getTemplate(opportunityId)?.strategy ?? "automate";
}

function investmentLevel(range: Range): 1 | 2 | 3 {
  if (range.high <= 5000) return 1;
  if (range.high <= 15000) return 2;
  return 3;
}

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/** Findings worth doing first: most severe, then quickest. */
export function pickWebsiteActions(audit: WebsiteAudit | undefined, max = 6): AuditFinding[] {
  if (!audit) return [];
  const effortRank = { quick: 0, medium: 1, project: 2 } as const;
  return [...audit.findings]
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        effortRank[a.effort] - effortRank[b.effort] ||
        a.id.localeCompare(b.id),
    )
    .filter((finding) => finding.severity !== "low" || audit.findings.length <= max)
    .slice(0, max);
}

export type GrowthGap = { label: Bilingual; uplift: Range };

/** Gaps between this business and a site that turns visits into enquiries. */
export function growthGaps(args: {
  type: BusinessTypeDef;
  audit?: WebsiteAudit;
  hasWebsite: boolean;
  presence?: OnlinePresence;
  opportunityIds: string[];
}): GrowthGap[] {
  const { audit, type, presence } = args;
  const gaps: GrowthGap[] = [];
  if (!args.hasWebsite || (audit && !audit.reachable)) {
    gaps.push({
      label: bi("no working website yet", "încă nu există un site funcțional"),
      uplift: { low: 10, high: 25 },
    });
    return gaps;
  }
  if (!audit) return gaps;
  const s = audit.signals;
  const performance = audit.pagespeed?.performance ?? audit.scores.performance;
  const lcp = audit.pagespeed?.lcpMs;
  if ((performance !== undefined && performance < 50) || (lcp !== undefined && lcp > 4000)) {
    gaps.push({
      label: bi("slow mobile pages", "pagini lente pe mobil"),
      uplift: { low: 3, high: 7 },
    });
  }
  if (type.bookings && !s.hasOnlineBooking) {
    gaps.push({
      label: bi("no online booking", "fără programare online"),
      uplift: { low: 4, high: 8 },
    });
  }
  if (!s.hasContactForm && !s.hasWhatsApp) {
    gaps.push({
      label: bi("no contact form or WhatsApp", "fără formular de contact sau WhatsApp"),
      uplift: { low: 3, high: 6 },
    });
  } else if (!s.hasWhatsApp && !s.hasLiveChat) {
    gaps.push({
      label: bi("no quick chat option", "fără chat rapid"),
      uplift: { low: 2, high: 4 },
    });
  }
  if (audit.scores.seo < 70 || !s.hasStructuredData) {
    gaps.push({ label: bi("weak local SEO", "SEO local slab"), uplift: { low: 2, high: 5 } });
  }
  const google = presence?.profiles.find((p) => p.platform === "google-business");
  if (google?.status === "missing") {
    gaps.push({
      label: bi("no Google Business Profile found", "fără profil Google Business"),
      uplift: { low: 3, high: 6 },
    });
  }
  if (type.consumer && args.opportunityIds.includes("review-requests")) {
    gaps.push({
      label: bi("no automatic review requests", "fără cereri automate de recenzii"),
      uplift: { low: 2, high: 5 },
    });
  }
  return gaps;
}

type BuildArgs = {
  type: BusinessTypeDef;
  playbook: Playbook;
  opportunities: AutomationOpportunity[];
  websiteActions: AuditFinding[];
  audit?: WebsiteAudit;
  presence?: OnlinePresence;
  hasWebsite: boolean;
  websiteHealth: number;
};

function websiteInvestment(args: BuildArgs): Range {
  const parts: Range[] = args.websiteActions.map(
    (finding) => PRICE_BOOK.websiteFix[finding.effort],
  );
  if (!args.hasWebsite || (args.audit && !args.audit.reachable)) parts.push(PRICE_BOOK.newWebsite);
  const google = args.presence?.profiles.find((p) => p.platform === "google-business");
  if (google?.status === "missing") parts.push(PRICE_BOOK.googleProfile);
  if (args.audit?.reachable && !args.audit.signals.hasAnalytics) parts.push(PRICE_BOOK.measurement);
  return addRanges(parts);
}

function group(opportunities: AutomationOpportunity[], key: StrategyKey) {
  return opportunities.filter((o) => strategyOf(o.id) === key);
}

const COMPLEXITY_RANK = { low: 0, medium: 1, high: 2 } as const;
const COMPLEXITY = ["low", "medium", "high"] as const;

export function buildStrategies(args: BuildArgs): StrategyOption[] {
  const { type, playbook, opportunities } = args;
  const customers = type.customers;
  const noSite = !args.hasWebsite || Boolean(args.audit && !args.audit.reachable);

  /* acquire */
  const acquireOpps = group(opportunities, "acquire");
  const gaps = growthGaps({
    type,
    audit: args.audit,
    hasWebsite: args.hasWebsite,
    presence: args.presence,
    opportunityIds: opportunities.map((o) => o.id),
  });
  const upliftSum = addRanges(gaps.map((g) => g.uplift));
  const uplift = gaps.length
    ? { low: clamp(upliftSum.low, 2, 15), high: clamp(upliftSum.high, 5, 30) }
    : { low: 2, high: 5 };
  const acquireTactics: Bilingual[] = [];
  if (noSite) acquireTactics.push(newSiteItem(type, Boolean(args.audit && !args.audit.reachable)));
  for (const gap of gaps) {
    if (gap.label.en === "slow mobile pages")
      acquireTactics.push(bi("Faster mobile pages", "Pagini mai rapide pe mobil"));
    if (gap.label.en === "no online booking")
      acquireTactics.push(bi("Online booking around the clock", "Programare online non-stop"));
    if (gap.label.en === "weak local SEO")
      acquireTactics.push(bi("Local SEO and Google profile", "SEO local și profil Google"));
    if (gap.label.en.startsWith("no contact") || gap.label.en === "no quick chat option")
      acquireTactics.push(bi("Click-to-chat on WhatsApp", "Chat rapid pe WhatsApp"));
  }
  for (const o of acquireOpps) acquireTactics.push(o.title);
  if (args.audit?.reachable && !args.audit.signals.hasAnalytics)
    acquireTactics.push(bi("Conversion tracking", "Măsurarea conversiilor"));
  if (!acquireTactics.length)
    acquireTactics.push(
      bi("Conversion-focused landing pages", "Pagini care transformă vizitele în solicitări"),
    );

  const acquireInvestment = addRanges([
    websiteInvestment(args),
    ...acquireOpps.map((o) => o.setupCostRon),
  ]);
  const quickOnly = args.websiteActions.every((f) => f.effort === "quick");
  const gapList = gaps.map((g) => g.label);
  const acquire: StrategyOption = {
    id: "acquire",
    title: playbook.titles.acquire,
    summary: noSite
      ? bi(
          `Get online with a fast website and Google profile that bring in ${customers.en}.`,
          `Lansează un site rapid și un profil Google care să-ți aducă ${customers.ro}.`,
        )
      : bi(
          `Get found by more ${customers.en} and turn more website visits into enquiries.`,
          `Fă-te mai ușor de găsit de ${customers.ro} și transformă mai multe vizite pe site în solicitări.`,
        ),
    tactics: dedupe(acquireTactics).slice(0, 5),
    outcome: {
      label: bi("more enquiries", "mai multe solicitări"),
      range: uplift,
      unit: "%",
      basis: gapList.length
        ? bi(
            `Planning assumption, not a measured result: each gap we found and you fix (${gapList.map((g) => g.en).join(", ")}) adds a few percent more enquiries; we add them up and cap the total at 30%.`,
            `Ipoteză de calcul, nu un rezultat măsurat: fiecare problemă găsită pe care o rezolvi (${gapList.map((g) => g.ro).join(", ")}) aduce câteva procente în plus la solicitări; le adunăm și plafonăm totalul la 30%.`,
          )
        : bi(
            "Planning assumption: the site already covers the basics, so the gain comes from steady optimisation.",
            "Ipoteză de calcul: site-ul acoperă deja elementele de bază, deci câștigul vine din îmbunătățiri constante.",
          ),
    },
    implementation: noSite ? "high" : quickOnly ? "low" : "medium",
    timeToValueMonths: noSite || !quickOnly ? { low: 2, high: 4 } : { low: 1, high: 3 },
    investmentLevel: investmentLevel(acquireInvestment),
    investmentRon: acquireInvestment,
    opportunityIds: acquireOpps.map((o) => o.id),
    recommended: false,
  };

  /* automate */
  const automateOpps = group(opportunities, "automate");
  const automateHours = mapRange(
    addRanges(automateOpps.map((o) => o.hoursSavedPerMonth)),
    roundHours,
  );
  const automateSetup = addRanges(automateOpps.map((o) => o.setupCostRon));
  const maxComplexity = automateOpps.reduce(
    (max, o) => Math.max(max, COMPLEXITY_RANK[o.complexity]),
    0,
  );
  const top = [...automateOpps].sort(
    (a, b) => b.hoursSavedPerMonth.high - a.hoursSavedPerMonth.high,
  )[0];
  const automate: StrategyOption = {
    id: "automate",
    title: playbook.titles.automate,
    summary: top
      ? bi(
          `Take routine work off the team, starting with ${lcFirst(top.title.en)}.`,
          `Scapă echipa de munca repetitivă, începând cu ${lcFirst(top.title.ro)}.`,
        )
      : bi("Take routine work off the team.", "Scapă echipa de munca repetitivă."),
    tactics: automateOpps
      .slice()
      .sort((a, b) => b.hoursSavedPerMonth.high - a.hoursSavedPerMonth.high)
      .slice(0, 4)
      .map((o) => o.title),
    outcome: automateOutcome(automateOpps.length, automateHours),
    implementation: COMPLEXITY[maxComplexity],
    timeToValueMonths: maxComplexity === 0 ? { low: 1, high: 2 } : { low: 2, high: 3 },
    investmentLevel: investmentLevel(automateSetup),
    investmentRon: automateSetup,
    opportunityIds: automateOpps.map((o) => o.id),
    recommended: false,
  };

  /* assist */
  const assistOpps = group(opportunities, "assist");
  const share = playbook.params.routineShare;
  // Without an assistant opportunity (B2B, few questions) the card still shows its price.
  const assistSetup = assistOpps.length
    ? addRanges(assistOpps.map((o) => o.setupCostRon))
    : { ...PRICE_BOOK.automationSetup.medium };
  const assist: StrategyOption = {
    id: "assist",
    title: playbook.titles.assist,
    summary: bi(
      "Answer routine questions instantly, 24/7, on the website and WhatsApp.",
      "Răspunde imediat, non-stop, la întrebările de rutină, pe site și pe WhatsApp.",
    ),
    tactics: [
      bi("24/7 answers on the website and WhatsApp", "Răspunsuri non-stop pe site și pe WhatsApp"),
      bi(
        "Answers from your own FAQ and price list",
        "Răspunsuri pe baza întrebărilor frecvente și a prețurilor tale",
      ),
      type.bookings
        ? bi("Booking straight from the chat", "Programare direct din chat")
        : bi("Enquiries captured from the chat", "Solicitări preluate direct din chat"),
      bi("Romanian and English", "În română și engleză"),
    ],
    outcome: {
      label: bi("of questions answered automatically", "din întrebări primesc răspuns automat"),
      range: { low: Math.round(share.low * 100), high: Math.round(share.high * 100) },
      unit: "%",
      basis: bi(
        `Planning assumption: the share of incoming questions that are routine for a ${type.label.en.toLowerCase()} (prices, hours, availability, location) and can be answered from your FAQ.`,
        `Ipoteză de calcul: ponderea întrebărilor de rutină (prețuri, program, disponibilitate, locație) pentru o afacere de tipul „${type.label.ro}”, la care se poate răspunde pe baza întrebărilor frecvente.`,
      ),
    },
    implementation: "medium",
    timeToValueMonths: { low: 1, high: 2 },
    investmentLevel: investmentLevel(assistSetup),
    investmentRon: assistSetup,
    opportunityIds: assistOpps.map((o) => o.id),
    recommended: false,
  };

  return recommend([acquire, automate, assist], opportunities, args.websiteHealth, !noSite);
}

export function automateOutcome(count: number, hours: Range): StrategyOption["outcome"] {
  return {
    label: bi("hours saved a month", "ore economisite pe lună"),
    range: hours,
    unit: "hours",
    basis: bi(
      `Sum of the automations in this plan (${count}), each from its stated volumes and minutes per task.`,
      `Suma automatizărilor din acest plan (${count}), fiecare calculată din volumele și minutele pe sarcină declarate.`,
    ),
  };
}

/**
 * Marks the recommended strategy: the website first when it holds everything
 * back, otherwise whichever of automation or the assistant pays back sooner.
 */
export function recommend(
  strategies: StrategyOption[],
  opportunities: AutomationOpportunity[],
  websiteHealth: number,
  hasWorkingWebsite: boolean,
): StrategyOption[] {
  const automate = typicalPayback(group(opportunities, "automate"));
  const assist = typicalPayback(group(opportunities, "assist"));
  const acquireUplift = strategies.find((s) => s.id === "acquire")?.outcome.range.high ?? 0;

  let pick: StrategyKey;
  if (!hasWorkingWebsite || websiteHealth < 45) pick = "acquire";
  else if (automate <= GOOD_PAYBACK_MONTHS && automate <= assist) pick = "automate";
  else if (assist <= GOOD_PAYBACK_MONTHS) pick = "assist";
  else if (acquireUplift >= 10) pick = "acquire";
  else pick = automate <= assist ? "automate" : "assist";

  return strategies.map((s) => ({ ...s, recommended: s.id === pick }));
}

/** A typical payback counts as good up to a year. */
const GOOD_PAYBACK_MONTHS = 12;

/** Months to pay back at mid setup, savings and tool costs (Infinity when it never does). */
function typicalPayback(items: AutomationOpportunity[]): number {
  if (!items.length) return Infinity;
  const setup = midpoint(addRanges(items.map((o) => o.setupCostRon)));
  const net =
    midpoint(addRanges(items.map((o) => o.monthlySavingsRon))) -
    midpoint(addRanges(items.map((o) => o.monthlyToolCostRon)));
  return net > 0 ? setup / net : Infinity;
}

/** Refreshes the input-dependent parts (automation hours, recommendation). */
export function refreshStrategies(
  strategies: StrategyOption[],
  opportunities: AutomationOpportunity[],
  websiteHealth: number,
  hasWorkingWebsite: boolean,
): StrategyOption[] {
  const updated = strategies.map((s) => {
    if (s.id !== "automate") return s;
    const items = opportunities.filter((o) => s.opportunityIds.includes(o.id));
    const hours = mapRange(addRanges(items.map((o) => o.hoursSavedPerMonth)), roundHours);
    return { ...s, outcome: { ...automateOutcome(items.length, hours), label: s.outcome.label } };
  });
  return recommend(updated, opportunities, websiteHealth, hasWorkingWebsite);
}

/** The first website step: rebuild an unreachable site, or a new one shaped by the type. */
export function newSiteItem(type: BusinessTypeDef, unreachable = false): Bilingual {
  if (unreachable) {
    return bi(
      "Get the website back online, fast and mobile-first",
      "Repune site-ul online, rapid și optimizat pentru mobil",
    );
  }
  if (type.bookings) {
    return bi(
      "A fast, mobile-first website with contact and booking",
      "Un site rapid, optimizat pentru mobil, cu contact și programare",
    );
  }
  return type.consumer
    ? bi(
        "A fast, mobile-first website with contact details and WhatsApp",
        "Un site rapid, optimizat pentru mobil, cu date de contact și WhatsApp",
      )
    : bi(
        "A fast, mobile-first website with contact and quote requests",
        "Un site rapid, optimizat pentru mobil, cu contact și cereri de ofertă",
      );
}

function dedupe(items: Bilingual[]): Bilingual[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.en)) return false;
    seen.add(item.en);
    return true;
  });
}

/** "4–8%" style label used in copy. */
export function outcomeText(outcome: StrategyOption["outcome"], lang: "en" | "ro"): string {
  const range = formatRange(outcome.range, lang);
  return outcome.unit === "%" ? `${range}%` : range;
}

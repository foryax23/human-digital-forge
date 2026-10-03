import type {
  AuditFinding,
  AutomationOpportunity,
  Bilingual,
  Estimate,
  OnlinePresence,
  Range,
  StartReason,
  StrategyOption,
  WebsiteAudit,
} from "@/lib/scan/types";

import { PRICE_BOOK } from "./economics";
import {
  addEstimates,
  addRanges,
  centred,
  formatRange,
  joinList,
  lcFirst,
  mapRange,
  midOf,
  midpoint,
  roDefinite,
  roundHours,
  shareWords,
  ucFirst,
} from "./format";
import { bi, clamp, type Playbook, type StrategyKey } from "./model";
import { getTemplate } from "./playbooks";
import { SHORT_NAMES } from "./short-names";
import type { BusinessTypeDef } from "./taxonomy";
import { newSiteItem, noWorkingSite, websiteWork } from "./website-work";

export { newSiteItem };

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

const EFFORT_RANK = { quick: 0, medium: 1, project: 2 } as const;

/**
 * The one order of the findings, on the scan, in the plan and in the PDF: most severe
 * first, then the quickest, then by id (stable).
 */
export function compareFindings(a: AuditFinding, b: AuditFinding): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort] ||
    a.id.localeCompare(b.id)
  );
}

/** Findings worth doing first: most severe, then quickest. */
export function pickWebsiteActions(audit: WebsiteAudit | undefined, max = 6): AuditFinding[] {
  if (!audit) return [];
  return [...audit.findings]
    .sort(compareFindings)
    .filter((finding) => finding.severity !== "low" || audit.findings.length <= max)
    .slice(0, max);
}

/**
 * A gap between this business and a site that turns visits into enquiries, with
 * the fix that closes it (one strategy-card line per measured gap). `measured` is
 * false for gaps the plan itself implies (no review requests), which never count in
 * "4 lucruri care te fac să pierzi pacienți".
 */
export type GrowthGap = {
  id:
    | "no-site"
    | "slow"
    | "booking"
    | "contact"
    | "chat"
    | "google-search"
    | "google-profile"
    | "reviews";
  label: Bilingual;
  fix: Bilingual;
  uplift: Range;
  measured: boolean;
};

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
      id: "no-site",
      label: bi("no working website yet", "încă nu există un site funcțional"),
      fix: bi("A working website", "Un site care funcționează"),
      uplift: { low: 10, high: 25 },
      measured: true,
    });
    return gaps;
  }
  if (!audit) return gaps;
  const s = audit.signals;
  const performance = audit.pagespeed?.performance ?? audit.scores.performance;
  const lcp = audit.pagespeed?.lcpMs;
  if ((performance !== undefined && performance < 50) || (lcp !== undefined && lcp > 4000)) {
    gaps.push({
      id: "slow",
      label: bi("slow mobile pages", "pagini lente pe mobil"),
      fix: bi("Faster mobile pages", "Pagini mai rapide pe mobil"),
      uplift: { low: 3, high: 7 },
      measured: true,
    });
  }
  if (type.bookings && !s.hasOnlineBooking) {
    gaps.push({
      id: "booking",
      label: bi("no online booking", "fără programare online"),
      fix: bi("Online booking around the clock", "Programare online non-stop"),
      uplift: { low: 4, high: 8 },
      measured: true,
    });
  }
  if (!s.hasContactForm && !s.hasWhatsApp) {
    gaps.push({
      id: "contact",
      label: bi("no contact form or WhatsApp", "fără formular de contact sau WhatsApp"),
      fix: bi("A short form and a WhatsApp button", "Un formular scurt și un buton de WhatsApp"),
      uplift: { low: 3, high: 6 },
      measured: true,
    });
  } else if (!s.hasWhatsApp && !s.hasLiveChat) {
    gaps.push({
      id: "chat",
      label: bi("no quick chat", "fără chat rapid"),
      fix: bi("Quick chat on WhatsApp", "Chat rapid pe WhatsApp"),
      uplift: { low: 2, high: 4 },
      measured: true,
    });
  }
  if (audit.scores.seo < 70 || !s.hasStructuredData) {
    gaps.push({
      id: "google-search",
      label: bi("hard to find on Google nearby", "greu de găsit în Google, în zona ta"),
      fix: bi("Easier to find on Google and Maps", "Mai ușor de găsit în Google și pe hartă"),
      uplift: { low: 2, high: 5 },
      measured: true,
    });
  }
  const google = presence?.profiles.find((p) => p.platform === "google-business");
  if (google?.status === "missing") {
    gaps.push({
      id: "google-profile",
      label: bi("no Google Business Profile found", "fără profil Google Business"),
      fix: bi("A complete Google Business Profile", "Un profil Google Business complet"),
      uplift: { low: 3, high: 6 },
      measured: true,
    });
  }
  if (type.consumer && args.opportunityIds.includes("review-requests")) {
    gaps.push({
      id: "reviews",
      label: bi("no automatic review requests", "fără cereri automate de recenzii"),
      fix: bi("Automatic review requests", "Cereri automate de recenzii"),
      uplift: { low: 2, high: 5 },
      measured: false,
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

/** The website work in the plan (same items and prices as the roadmap). */
function websiteInvestment(args: BuildArgs): Estimate {
  const work = websiteWork({
    type: args.type,
    websiteActions: args.websiteActions,
    audit: args.audit,
    presence: args.presence,
    hasWebsite: args.hasWebsite,
    opportunityIds: args.opportunities.map((o) => o.id),
  });
  return addEstimates(work.map((w) => centred(w.cost)));
}

function group(opportunities: AutomationOpportunity[], key: StrategyKey) {
  return opportunities.filter((o) => strategyOf(o.id) === key);
}

const COMPLEXITY_RANK = { low: 0, medium: 1, high: 2 } as const;
const COMPLEXITY = ["low", "medium", "high"] as const;

export function buildStrategies(args: BuildArgs): StrategyOption[] {
  const { type, playbook, opportunities } = args;
  const customers = type.customers;
  const noSite = noWorkingSite(args.hasWebsite, args.audit);

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
  // One line per measured gap, in the same order as the count on the card, so "4 lucruri"
  // sits over four lines; then what the strategy's automations add.
  const acquireTactics: Bilingual[] = [];
  if (noSite) acquireTactics.push(newSiteItem(type, Boolean(args.audit && !args.audit.reachable)));
  else for (const gap of gaps) if (gap.measured) acquireTactics.push(gap.fix);
  for (const o of acquireOpps) acquireTactics.push(o.title);
  if (args.audit?.reachable && !args.audit.signals.hasAnalytics)
    acquireTactics.push(
      bi("Counting the enquiries the site brings", "Evidența cererilor venite de pe site"),
    );
  if (!acquireTactics.length)
    acquireTactics.push(
      bi("Conversion-focused landing pages", "Pagini care transformă vizitele în solicitări"),
    );

  const acquireInvestment = addEstimates([
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
  const automateSetup = addEstimates(automateOpps.map((o) => o.setupCostRon));
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
    ? addEstimates(assistOpps.map((o) => o.setupCostRon))
    : centred(PRICE_BOOK.automationSetup.medium);
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
    label: bi("hours won back a month", "ore câștigate pe lună"),
    range: hours,
    unit: "hours",
    basis: bi(
      `Sum of the automations in this plan (${count}), each from its stated volumes and minutes per task.`,
      `Suma automatizărilor din acest plan (${count}), fiecare calculată din volumele și minutele pe sarcină declarate.`,
    ),
  };
}

/**
 * Picks the recommended strategy and why: the website first when it holds
 * everything back, otherwise whichever of automation or the assistant pays
 * back sooner, then the measured website gaps, then the best ratio.
 */
export function startChoice(
  strategies: StrategyOption[],
  opportunities: AutomationOpportunity[],
  websiteHealth: number,
  hasWorkingWebsite: boolean,
): { pick: StrategyKey; reason: StartReason } {
  const automate = typicalPayback(group(opportunities, "automate"));
  const assist = typicalPayback(group(opportunities, "assist"));
  const acquireUplift = strategies.find((s) => s.id === "acquire")?.outcome.range.high ?? 0;

  if (!hasWorkingWebsite) return { pick: "acquire", reason: "no-site" };
  if (websiteHealth < 45) return { pick: "acquire", reason: "weak-site" };
  if (automate <= GOOD_PAYBACK_MONTHS && automate <= assist)
    return { pick: "automate", reason: "automate-payback" };
  if (assist <= GOOD_PAYBACK_MONTHS) return { pick: "assist", reason: "assist-payback" };
  if (acquireUplift >= 10) return { pick: "acquire", reason: "acquire-gaps" };
  return { pick: automate <= assist ? "automate" : "assist", reason: "best-ratio" };
}

/** Marks the recommended strategy and stores why (`startReason`, on that one only). */
export function recommend(
  strategies: StrategyOption[],
  opportunities: AutomationOpportunity[],
  websiteHealth: number,
  hasWorkingWebsite: boolean,
): StrategyOption[] {
  const { pick, reason } = startChoice(strategies, opportunities, websiteHealth, hasWorkingWebsite);
  return strategies.map(({ startReason: _previous, ...s }) =>
    s.id === pick ? { ...s, recommended: true, startReason: reason } : { ...s, recommended: false },
  );
}

/** A typical payback counts as good up to a year. */
const GOOD_PAYBACK_MONTHS = 12;

/**
 * Months for a group of automations to pay back at central setup, value and
 * tool cost, ignoring the ramp (Infinity when it never does). Ranks the
 * strategies and fills "se plătește în cam {n} luni"; the chart's break-even
 * is the honest month for the whole plan.
 */
export function typicalPayback(items: AutomationOpportunity[]): number {
  if (!items.length) return Infinity;
  const setup = addEstimates(items.map((o) => o.setupCostRon)).mid;
  const net =
    addEstimates(items.map((o) => o.monthlySavingsRon)).mid -
    addEstimates(items.map((o) => o.monthlyToolCostRon)).mid;
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

function dedupe(items: Bilingual[]): Bilingual[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.en)) return false;
    seen.add(item.en);
    return true;
  });
}

/** "4–8%" style label used in copy. @deprecated Percentages are assumptions; use `strategyChange`. */
export function outcomeText(outcome: StrategyOption["outcome"], lang: "en" | "ro"): string {
  const range = formatRange(outcome.range, lang);
  return outcome.unit === "%" ? `${range}%` : range;
}

/* -------------------------------------------------- what each one changes */

/**
 * The plain statement for "Ce se schimbă" and the strategy cards. Uplift and
 * question shares are assumptions, so they read as sentences ("Cam jumătate
 * din întrebări"), never as percentages; the website gaps are measured, so
 * their count is stated. Automation's figure (hours) is filled by display.ts
 * from the rounded Gantt row.
 */
export type StrategyChange = {
  /** "Solicitări noi" / "Timp câștigat" / "Întrebări preluate". */
  label: Bilingual;
  /** The outcome as a statement; absent for automate (the hours row is the statement). */
  result?: Bilingual;
  /** One line on what it means for the business. */
  support: Bilingual;
  /** Marks an assumption we confirm at the call ("De confirmat", note 4). */
  assumption?: Bilingual;
};

export function strategyChange(args: {
  id: string;
  type: BusinessTypeDef;
  playbook: Playbook;
  audit?: WebsiteAudit;
  hasWebsite: boolean;
  presence?: OnlinePresence;
  opportunities: AutomationOpportunity[];
}): StrategyChange {
  const { type } = args;
  const customers = type.customers;
  if (args.id === "acquire") {
    const label = bi("New enquiries", "Solicitări noi");
    if (noWorkingSite(args.hasWebsite, args.audit)) {
      const the = { en: `new ${customers.en}`, ro: `${roDefinite(customers.ro)} noi` };
      if (args.audit && !args.audit.reachable) {
        return {
          label,
          result: bi("The website back online", "Site-ul repus online"),
          support: bi(
            `Today the website doesn't open, so ${the.en} can't reach you.`,
            `Azi site-ul nu se deschide, deci ${the.ro} nu ajung la tine.`,
          ),
        };
      }
      if (type.bookings) {
        return {
          label,
          result: bi("A website with online booking", "Un site cu programare online"),
          support: bi(
            `Today ${the.en} can't find you or book online.`,
            `Azi ${the.ro} nu te pot găsi sau programa online.`,
          ),
        };
      }
      return {
        label,
        result: type.consumer
          ? bi(
              "A website with contact details and WhatsApp",
              "Un site cu date de contact și WhatsApp",
            )
          : bi("A website that takes quote requests", "Un site care primește cereri de ofertă"),
        support: bi(
          `Today ${the.en} can't find you online.`,
          `Azi ${the.ro} nu te pot găsi online.`,
        ),
      };
    }
    const gaps = growthGaps({
      type,
      audit: args.audit,
      hasWebsite: args.hasWebsite,
      presence: args.presence,
      opportunityIds: args.opportunities.map((o) => o.id),
    }).filter((g) => g.measured);
    if (!gaps.length) {
      return {
        label,
        result: bi("The site already covers the basics", "Site-ul acoperă deja elementele de bază"),
        support: bi(
          "The gain comes from steady improvements, not from a rebuild.",
          "Câștigul vine din îmbunătățiri constante, nu dintr-un site nou.",
        ),
      };
    }
    const list = (lang: "en" | "ro") =>
      joinList(
        gaps.map((g) => g.label[lang]),
        lang,
      );
    const n = gaps.length;
    return {
      label,
      result:
        n === 1
          ? bi(
              `One thing that costs you ${customers.en}: ${list("en")}`,
              `Un lucru care te face să pierzi ${customers.ro}: ${list("ro")}`,
            )
          : bi(
              `${n} things that cost you ${customers.en}: ${list("en")}`,
              `${n} lucruri care te fac să pierzi ${customers.ro}: ${list("ro")}`,
            ),
      support: bi(
        "Each one fixed turns more of the same visits into enquiries.",
        "Fiecare problemă rezolvată transformă mai multe din aceleași vizite în solicitări.",
      ),
    };
  }

  if (args.id === "assist") {
    const words = shareWords(midpoint(args.playbook.params.routineShare));
    return {
      label: bi("Questions handled", "Întrebări preluate"),
      result: bi(`${ucFirst(words.en)} of the questions`, `${ucFirst(words.ro)} din întrebări`),
      support: bi(
        "Questions about prices, opening hours and location get an answer without anyone stepping in.",
        "Întrebările despre prețuri, program și locație primesc răspuns fără să intervină cineva.",
      ),
      assumption: bi("To be confirmed", "De confirmat"),
    };
  }

  const automations = args.opportunities
    .filter((o) => strategyOf(o.id) === "automate")
    .sort((a, b) => midOf(b.hoursSavedPerMonth) - midOf(a.hoursSavedPerMonth))
    .slice(0, 3)
    .map((o) => SHORT_NAMES[o.id] ?? bi(lcFirst(o.title.en), lcFirst(o.title.ro)));
  return {
    label: bi("Time won back", "Timp câștigat"),
    support: automations.length
      ? bi(
          `From routine work: ${joinList(
            automations.map((a) => a.en),
            "en",
          )}.`,
          `Din munca de rutină: ${joinList(
            automations.map((a) => a.ro),
            "ro",
          )}.`,
        )
      : bi("Routine work done automatically.", "Munca de rutină făcută automat."),
  };
}

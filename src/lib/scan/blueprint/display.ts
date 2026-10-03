import type {
  AutomationOpportunity,
  Bilingual,
  Blueprint,
  BreakEven,
  PhaseKey,
  RoadmapPhase,
  StartReason,
  StrategyOption,
} from "@/lib/scan/types";

import { toolName } from "../localize";
import {
  hoursLine,
  paybackLine,
  SHORT_DISCLAIMER,
  shownHours,
  shownMonthlyValue,
  siteFirstReason,
  startLine,
  startReasonText,
  topProcess,
  wholeMonths,
  type StartContext,
} from "./copy";
import { breakEvenMonth, crossingMonth, hourlyCostFor, PROJECTION_MONTHS } from "./economics";
import { hasWebsiteFor, hasWorkingWebsite } from "./engine";
import {
  addEstimates,
  approxLei,
  centred,
  formatNumber,
  hoursPerMonth,
  joinList,
  lcFirst,
  lei,
  leiPerMonth,
  midOf,
  monthLabel,
  monthSpan,
  NBSP,
  roDefinite,
  roNeedsDe,
  roundGroup,
  roundStep,
  shareWords,
  signedLei,
  STEP,
  ucFirst,
} from "./format";
import { bi, type StrategyKey } from "./model";
import { offerFeeRon } from "./offer";
import { getPlaybook, getTemplate } from "./playbooks";
import { PHASE_OF_STRATEGY, PHASE_ORDER, phaseMonths } from "./roadmap";
import { growthGaps, startChoice, strategyChange, strategyOf, typicalPayback } from "./strategies";
import { getBusinessType, type BusinessTypeDef } from "./taxonomy";
import { CAM_RATE, HOURS_PER_MONTH, WAGE_SOURCE } from "./wages";
import { websiteWork, type WebsiteWorkItem } from "./website-work";

/*
 * The only place that turns a blueprint into displayed figures (spec §3.1).
 * The scan steps, the strategy cards, the chart, the table, the KPI strip,
 * "Pe scurt" and the PDF all read `displayPlan(blueprint)`, so text and
 * numbers cannot drift: every group is rounded once (rows add up to their
 * total), net is always displayed value minus displayed cost, and one
 * break-even month is used everywhere. Works on stored blueprints from before
 * the central values existed (it falls back to range midpoints).
 */

export type DisplayPhase = {
  key: PhaseKey;
  months: [number, number];
  /** The one name: Gantt, phase row, strategy card, PDF. */
  title: Bilingual;
  /** Group-rounded to 5; null = the phase brings enquiries, not hours (website work). */
  hoursPerMonth: number | null;
  /** One-off cost, group-rounded to 500 (automations plus the website work in this phase). */
  setupLei: number;
  /** Tools a month, group-rounded to 100. */
  toolsLeiPerMonth: number;
  items: Bilingual[];
  /** Tool names in both languages, deduplicated and lower-cased for a running list ("calendar de programări"). */
  tools: Bilingual[];
  /** Only on the starting phase: the sentence after "Începem aici". */
  start?: { reason: Bilingual };
  /** "Luna 1" / "Lunile 2–3". */
  dateLabel: Bilingual;
  /** "cam 35 de ore pe lună" / "aduce solicitări, nu ore". */
  hoursText: Bilingual;
  /** "≈ 8.000 lei, apoi 600 lei pe lună" / "≈ 11.500 lei o singură dată". */
  costText: Bilingual;
  /** Website phases: what the work brings ("Ce aduce: …"). */
  brings?: Bilingual;
  /** The website goes live at the end of this phase (the Gantt diamond). */
  siteMilestone: boolean;
  /** The phase that wins the most hours ("Cel mai mult timp câștigat"), one at most. */
  mostTime: boolean;
  opportunityIds: string[];
};

/** Which row of a strategy card a fact is. */
export type StrategyFactKey = "build" | "firstResults" | "cost" | "result";

export type DisplayStrategy = {
  id: string;
  /** The direction ("Atrage mai mulți pacienți"). */
  title: Bilingual;
  /** The phases that deliver it, with their titles exactly as in the Gantt. */
  phases: { key: PhaseKey; title: Bilingual }[];
  /** "Solicitări noi" / "Timp câștigat" / "Întrebări preluate". */
  label: Bilingual;
  /** The statement: "cam 35 de ore pe lună", "Un site cu programare online", "Cam jumătate din întrebări". */
  result: Bilingual;
  support: Bilingual;
  /** "De confirmat" (note ⁴) when the result is an assumption. */
  assumption?: Bilingual;
  /** The Gantt row's figures (never re-rounded here). */
  hoursPerMonth: number | null;
  setupLei: number;
  toolsLeiPerMonth: number;
  /** Implementare, Primele rezultate, Investiție, Rezultat (in that order). */
  facts: { key: StrategyFactKey; label: Bilingual; value: Bilingual }[];
  start?: { reason: Bilingual };
  /** No phase of the plan delivers it (e.g. the assistant for a B2B firm): offered as an option. */
  optional: boolean;
};

export type DisplayAutomation = {
  id: string;
  phase: PhaseKey;
  title: Bilingual;
  /** Rounded within its phase, so a phase's automations add up to its row. */
  hoursPerMonth: number;
  setupLei: number;
  toolsLeiPerMonth: number;
  /** Simple central payback in whole months; null when over 24 (then never featured). */
  paybackMonths: number | null;
  /** Customer-facing automation that does not pay back on time alone. */
  justification?: Bilingual;
  tools: Bilingual[];
};

export type DisplayPlan = {
  phases: DisplayPhase[];
  totals: {
    hoursPerMonth: number;
    /** Everything one-off: automations plus the website work. */
    setupLei: number;
    /** The website work inside `setupLei` (null when the plan has none). */
    siteLei: number | null;
    /** The automations inside `setupLei`: the chart's one-off cost. */
    automationsSetupLei: number;
    toolsLeiPerMonth: number;
    /** Value of the hours a month once everything runs, steps of 100. */
    monthlyValueLei: number;
    hourlyLei: number;
  };
  /** Months 1–24, cumulative, rounded to 1.000; net = value − cost. */
  series: { month: number; value: number; cost: number; net: number }[];
  /** `x` is the interpolated crossing, for drawing the chart line only. */
  breakEven: BreakEven & { x: number | null };
  /** The smallest chart window that shows the break-even. */
  defaultHorizon: 12 | 24;
  strategies: DisplayStrategy[];
  automations: DisplayAutomation[];
  /** "Pe scurt": start, hours, payback (line 3 carries note ¹). */
  summary: [Bilingual, Bilingual, Bilingual];
  /** "Cum am calculat", fixed order ¹ ² ³ ⁴, then the disclaimer once. */
  notes: {
    payback: Bilingual;
    scope: Bilingual;
    hourValue: Bilingual;
    assumptions: Bilingual[];
    disclaimer: Bilingual;
  };
  /** Ready sentences, so the web and the PDF print the same words. */
  text: {
    headline: Bilingual;
    /** "Estimarea de bază pentru o echipă de 3–7 persoane (clinică stomatologică). …" */
    lead: Bilingual;
    /** "Pentru o echipă de 3–7 persoane." ("Ce se schimbă" sub-line). */
    team: Bilingual;
    /** "Patru etape în șase luni". */
    roadmapTitle: Bilingual;
    /** "Prima etapă e site-ul. Primele ore câștigate apar din luna 3." */
    roadmapLead: Bilingual;
    /** Gantt Total row: "Apoi cam 1.100 lei pe lună pentru instrumente." */
    totalNote: Bilingual;
    /** "Implementare ≈ 30.500 lei în total, din care site-ul ≈ 11.500 lei." */
    footer: Bilingual;
    /** Chart title: "Se recuperează în luna 14". */
    conclusion: Bilingual;
    /** "Valoarea orelor câștigate față de cost, cumulat." */
    chartLead: Bilingual;
    /** The hours as a share of one full-time job: "cam o treime dintr-o normă întreagă". */
    fte: Bilingual;
    /**
     * Under the offer: the payback month with the recommended plan's monthly fee added
     * to the cost ("Cu abonamentul Pro inclus, investiția se recuperează în luna 17.").
     * Null when the offer quotes no fee (a project, or a fee agreed on the call).
     */
    feePayback: Bilingual | null;
    /** The strategy step's closing line: where we start, and the website work before it. */
    startNote: Bilingual | null;
  };
};

export type Horizon = 6 | 12 | 24;

/* ------------------------------------------------------------------ main */

export function displayPlan(blueprint: Blueprint): DisplayPlan {
  const type = getBusinessType(blueprint.businessType.id);
  const playbook = getPlaybook(type.id);
  const opportunities = blueprint.opportunities;
  const byId = new Map(opportunities.map((o) => [o.id, o]));
  const hasWebsite = hasWebsiteFor(blueprint);
  const working = hasWorkingWebsite(blueprint.audit, hasWebsite);
  const work = websiteWork({
    type,
    websiteActions: blueprint.websiteActions,
    audit: blueprint.audit,
    presence: blueprint.presence,
    hasWebsite,
    opportunityIds: opportunities.map((o) => o.id),
  });

  /* phases: raw figures */
  const roadmap = blueprint.roadmap.map((phase, i) => ({
    phase,
    key: phase.key ?? keyOf(phase, i),
    opps: phase.opportunityIds.map((id) => byId.get(id)).filter(isOpportunity),
  }));
  const raw = roadmap.map(({ phase, key, opps }) => {
    const siteWork = phase.websiteCostRon
      ? midOf(phase.websiteCostRon)
      : // Stored before phases carried it: price the same website work again.
        addEstimates(work.filter((w) => w.phase === key).map((w) => centred(w.cost))).mid;
    return {
      hours: opps.length ? addEstimates(opps.map((o) => o.hoursSavedPerMonth)).mid : null,
      setupOpps: addEstimates(opps.map((o) => o.setupCostRon)).mid,
      siteWork: key === "foundation" || key === "growth" ? siteWork : 0,
      tools: addEstimates(opps.map((o) => o.monthlyToolCostRon)).mid,
    };
  });

  /* phases: one rounding per group, rows add up to the totals */
  const hoursTotal = shownHours(opportunities);
  const withHours = raw.map((r, i) => (r.hours === null ? -1 : i)).filter((i) => i >= 0);
  const hoursRows = roundGroup(
    withHours.map((i) => raw[i].hours ?? 0),
    STEP.hours,
    hoursTotal,
  ).rows;
  const hoursOf = (i: number) => {
    const at = withHours.indexOf(i);
    return at < 0 ? null : hoursRows[at];
  };
  const setup = roundGroup(
    raw.map((r) => r.setupOpps + r.siteWork),
    STEP.oneOff,
  );
  const tools = roundGroup(
    raw.map((r) => r.tools),
    STEP.monthly,
  );

  /* automations, rounded inside their phase; the website part is what's left of the row */
  const automations: DisplayAutomation[] = [];
  let siteLei = 0;
  roadmap.forEach(({ key, opps }, i) => {
    const h = roundGroup(
      opps.map((o) => midOf(o.hoursSavedPerMonth)),
      STEP.hours,
      hoursOf(i) ?? 0,
    ).rows;
    const s = roundGroup(
      [...opps.map((o) => midOf(o.setupCostRon)), raw[i].siteWork],
      STEP.oneOff,
      setup.rows[i],
    ).rows;
    const t = roundGroup(
      opps.map((o) => midOf(o.monthlyToolCostRon)),
      STEP.monthly,
      tools.rows[i],
    ).rows;
    siteLei += s[opps.length];
    opps.forEach((o, j) => automations.push(automationRow(o, key, h[j], s[j], t[j], type)));
  });

  /* series and break-even */
  const series = blueprint.projection
    .filter((p) => p.month >= 1 && p.month <= PROJECTION_MONTHS)
    .sort((a, b) => a.month - b.month)
    .map((p) => {
      const value = roundStep(midOf(p.cumulativeSavingsRon), STEP.cumulative);
      const cost = roundStep(midOf(p.cumulativeCostRon), STEP.cumulative);
      return { month: p.month, value, cost, net: value - cost };
    });
  const stored = blueprint.totals.breakEven;
  const breakEven = {
    month: stored ? stored.month : breakEvenMonth(blueprint.projection),
    higherVolume: stored?.higherVolume ?? null,
    lowerVolume: stored?.lowerVolume ?? null,
    x: crossingMonth(blueprint.projection),
  };

  /* where we start */
  const recommended = blueprint.strategies.find((s) => s.recommended);
  const pick = (recommended?.id ?? "automate") as StrategyKey;
  const reason: StartReason =
    recommended?.startReason ??
    startChoice(blueprint.strategies, opportunities, blueprint.scores.websiteHealth, working)
      .reason;
  const startOpps = opportunities.filter((o) => strategyOf(o.id) === pick);
  const gaps = growthGaps({
    type,
    audit: blueprint.audit,
    hasWebsite,
    presence: blueprint.presence,
    opportunityIds: opportunities.map((o) => o.id),
  }).filter((g) => g.measured).length;
  // Website work opens the plan although we start with automation or the assistant: the
  // site phase carries "Începem aici" and "Pe scurt" names both steps in order.
  const firstIndex = roadmap.findIndex((r) => r.key === "foundation");
  const siteWork = work.filter((w) => w.kind !== "kickoff");
  const siteFirst =
    pick !== "acquire" && firstIndex === 0 && siteWork.length > 0
      ? {
          lei: setup.rows[0],
          span: monthSpan(roadmap[0].phase.startMonth, roadmap[0].phase.endMonth),
          googleOnly: siteWork.every((w) => w.kind === "google-profile"),
        }
      : undefined;
  const startCtx: StartContext = {
    reason,
    pick,
    type,
    paybackMonths: wholeMonths(typicalPayback(startOpps)),
    process: topProcess(startOpps),
    gaps,
    unreachable: Boolean(blueprint.audit && !blueprint.audit.reachable),
    siteFirst,
  };
  const startReason = startReasonText(startCtx);
  const startKey = siteFirst ? "foundation" : startPhase(pick, roadmap, work);
  const phaseStartReason = siteFirst ? siteFirstReason(siteFirst) : startReason;

  /* phases: display */
  const maxHours = Math.max(0, ...withHours.map((i) => hoursOf(i) ?? 0));
  const mostTimeIndex = maxHours > 0 ? withHours.find((i) => hoursOf(i) === maxHours) : undefined;
  const phases: DisplayPhase[] = roadmap.map(({ phase, key, opps }, i) => {
    const hours = hoursOf(i);
    const phaseWork = work.filter((w) => w.phase === key);
    const display: DisplayPhase = {
      key,
      months: [phase.startMonth, phase.endMonth],
      title: { ...phase.title },
      hoursPerMonth: hours,
      setupLei: setup.rows[i],
      toolsLeiPerMonth: tools.rows[i],
      items: phase.items.map((item) => ({ ...item })),
      tools: uniqueTools(opps),
      dateLabel: capitalised(monthSpan(phase.startMonth, phase.endMonth)),
      hoursText:
        hours === null && phaseWork.every((w) => w.kind === "kickoff")
          ? bi("preparation, no hours yet", "pregătire, fără ore încă")
          : hoursText(hours, raw[i].hours),
      costText: costText(setup.rows[i], tools.rows[i]),
      siteMilestone: phaseWork.some((w) => w.kind === "new-site" || w.kind === "rebuild"),
      mostTime: i === mostTimeIndex,
      opportunityIds: [...phase.opportunityIds],
    };
    const brings = hours === null ? bringsText(phaseWork, type) : undefined;
    if (brings) display.brings = brings;
    if (key === startKey) display.start = { reason: phaseStartReason };
    return display;
  });

  /* totals */
  const totals = {
    hoursPerMonth: hoursTotal,
    setupLei: setup.total,
    siteLei: siteLei > 0 ? siteLei : null,
    automationsSetupLei: setup.total - siteLei,
    toolsLeiPerMonth: tools.total,
    monthlyValueLei: shownMonthlyValue(opportunities),
    hourlyLei: blueprint.assumptions.hourlyCostRon,
  };

  /* strategies */
  const strategies = blueprint.strategies.map((s) =>
    strategyRow(s, {
      phases,
      type,
      playbook,
      blueprint,
      hasWebsite,
      startReason: s.id === pick ? startReason : undefined,
    }),
  );

  const hasAutomations = opportunities.length > 0;
  return {
    phases,
    totals,
    series,
    breakEven,
    defaultHorizon: breakEven.month !== null && breakEven.month <= 12 ? 12 : 24,
    strategies,
    automations,
    summary: [
      startLine(startCtx),
      hoursLine(hoursTotal, topProcess(opportunities), type),
      paybackLine(breakEven.month, hasAutomations),
    ],
    notes: {
      payback: paybackNote(breakEven, hasAutomations),
      scope: scopeNote(work, totals.siteLei, type),
      hourValue: hourValueNote(blueprint, type),
      assumptions: assumptionNotes(blueprint, playbook),
      disclaimer: { ...SHORT_DISCLAIMER },
    },
    text: {
      headline: { ...blueprint.headline },
      lead: leadText(blueprint, type),
      team: teamText(blueprint),
      roadmapTitle: roadmapTitle(phases),
      roadmapLead: roadmapLead(phases, work, blueprint.projection),
      totalNote:
        totals.toolsLeiPerMonth > 0
          ? (() => {
              const t = leiPerMonth(totals.toolsLeiPerMonth);
              return bi(`Then ${t.en} for tools.`, `Apoi ${t.ro} pentru instrumente.`);
            })()
          : bi("No monthly tools to pay.", "Fără instrumente de plătit lunar."),
      footer: footerText(totals.setupLei, totals.siteLei, work),
      conclusion: conclusionText(breakEven.month, hasAutomations),
      chartLead: bi(
        "Value of the hours won back against cost, cumulative.",
        "Valoarea orelor câștigate față de cost, cumulat.",
      ),
      fte: fteText(hoursTotal),
      feePayback: feePaybackText(blueprint, hasAutomations),
      startNote: startNoteText(
        blueprint.strategies.find((s) => s.id === pick),
        siteFirst ? phases[0] : undefined,
      ),
    },
  };
}

/* ------------------------------------------------------------ KPI, table */

export type KpiCell = {
  key: "value" | "cost" | "net" | "payback";
  label: Bilingual;
  value: Bilingual;
  sub: Bilingual;
  /** The note the value points to (¹ or ²). */
  note?: 1 | 2;
};

/** The four KPI cells for a chart window (same figures as the table rows of that month). */
export function kpiCells(plan: DisplayPlan, horizon: Horizon): KpiCell[] {
  const at = (month: number) => plan.series.find((p) => p.month === month) ?? plan.series.at(-1);
  const end = at(horizon);
  const other = horizon === 12 ? at(24) : at(12);
  const n = plan.breakEven.month;
  const monthly = leiPerMonth(plan.totals.monthlyValueLei);
  const setup = lei(plan.totals.automationsSetupLei);
  const excluded = exclusions(plan);
  const otherNet = other ? signedLei(other.net) : bi("", "");
  const otherMonth = monthLabel(other?.month ?? 12);
  return [
    {
      key: "value",
      label: bi("Value of the hours", "Valoarea orelor"),
      value: lei(end?.value ?? 0),
      sub: bi(`${monthly.en}, once running`, `${monthly.ro}, după lansare`),
      note: 1,
    },
    {
      key: "cost",
      label: bi("Cost", "Cost"),
      value: lei(end?.cost ?? 0),
      sub: bi(
        `${setup.en} setup, then tools; ${excluded.en}`,
        `${setup.ro} implementare, apoi instrumente; ${excluded.ro}`,
      ),
      note: 2,
    },
    {
      key: "net",
      label: bi("Net gain", "Câștig net"),
      value: signedLei(end?.net ?? 0),
      sub: bi(`at ${otherMonth.en}: ${otherNet.en}`, `la ${otherMonth.ro}: ${otherNet.ro}`),
    },
    {
      key: "payback",
      label: bi("Pays back in", "Se recuperează"),
      value: n === null ? bi("–", "–") : monthLabel(n),
      sub:
        n === null
          ? bi("not within the first 24 months", "nu în primele 24 de luni")
          : bi("the month value overtakes cost", "luna în care valoarea depășește costul"),
      note: 1,
    },
  ];
}

export type TableRow = {
  month: number;
  label: Bilingual;
  value: number;
  cost: number;
  net: number;
  /** "Implementare" / "În funcțiune" / "Recuperat". */
  status: Bilingual;
  breakEven: boolean;
};

/** "Vezi cifrele într-un tabel": months 3, 6, 9, 12, N, 18, 24 within the window. */
export function tableRows(plan: DisplayPlan, horizon: Horizon): TableRow[] {
  const n = plan.breakEven.month;
  const built = Math.max(1, ...plan.phases.map((p) => p.months[1]));
  const months = [...new Set([3, 6, 9, 12, ...(n ? [n] : []), 18, 24])]
    .filter((m) => m <= horizon)
    .sort((a, b) => a - b);
  return months.flatMap((month) => {
    const point = plan.series.find((p) => p.month === month);
    if (!point) return [];
    const status =
      n !== null && month >= n
        ? bi("Paid back", "Recuperat")
        : month <= built
          ? bi("Being built", "Implementare")
          : bi("Running", "În funcțiune");
    return [
      {
        month,
        label: capitalised(monthLabel(month)),
        value: point.value,
        cost: point.cost,
        net: point.net,
        status,
        breakEven: month === n,
      },
    ];
  });
}

/** The plain note inside the plot when the break-even is outside the window, else null. */
export function outOfWindowNote(plan: DisplayPlan, horizon: Horizon): Bilingual | null {
  const n = plan.breakEven.month;
  if (n === null) {
    return bi(
      "Doesn't pay back within the first 24 months.",
      "Nu se recuperează în primele 24 de luni.",
    );
  }
  if (n <= horizon) return null;
  const m = monthLabel(n);
  return bi(
    `Pays back in ${m.en}, after the period shown.`,
    `Se recuperează în ${m.ro}, după perioada afișată.`,
  );
}

/* ------------------------------------------------------------- helpers */

const isOpportunity = (o: AutomationOpportunity | undefined): o is AutomationOpportunity =>
  Boolean(o);

const STAGE_KEYS: Record<string, PhaseKey> = {
  Foundation: "foundation",
  Automation: "automation",
  "AI assistant": "assistant",
  Growth: "growth",
};

/** The phase key of a blueprint stored before phases carried one. */
function keyOf(phase: RoadmapPhase, index: number): PhaseKey {
  return (
    STAGE_KEYS[phase.stage.en] ??
    PHASE_ORDER.find((key) => phaseMonths(key)[0] === phase.startMonth) ??
    PHASE_ORDER[Math.min(index, PHASE_ORDER.length - 1)]
  );
}

const capitalised = (text: Bilingual) => bi(ucFirst(text.en), ucFirst(text.ro));

/** Brand words that keep their capital inside a running list. */
const KEEP_CAPS =
  /^(Google|Meta|Microsoft|Stripe|Zoom|Trello|Asana|Toggl|Clockify|Freshdesk|Zendesk|Sameday|Cargus|Oblio|SmartBill|Pipedrive|HubSpot|Calendly|Shopify|WooCommerce|Facebook|Instagram|Claude|OpenAI|ANAF|SAGA|WinMentor|PMS|POS|ERP|TMS|SMS|CRM|GDPR|PDF|QR|AI|API)\b/;

/** "Calendar de programări" → "calendar de programări"; brands and acronyms stay as they are. */
function inList(name: string): string {
  if (KEEP_CAPS.test(name) || /^\S*[A-Z]\S*[A-Z]/.test(name.split(" ")[0])) return name;
  return lcFirst(name);
}

/**
 * The tools of a phase for "Instrumente: …": one entry per tool (the WhatsApp
 * variants merge into one), in list case ("calendar de programări, SMS, sincronizare
 * cu Google Calendar").
 */
function uniqueTools(opps: AutomationOpportunity[]): Bilingual[] {
  const all = [...new Set(opps.flatMap((o) => o.tools))];
  const whatsapp = all.filter((tool) => /whatsapp/i.test(tool));
  // A merged "WhatsApp Business și SMS" already names SMS.
  const mergedSms = whatsapp.length > 1 && whatsapp.some((w) => /sms/i.test(w));
  const tools = mergedSms ? all.filter((tool) => toolName(tool).ro !== "SMS") : all;
  const out: Bilingual[] = [];
  const seen = new Set<string>();
  for (const tool of tools) {
    let name = toolName(tool);
    if (whatsapp.length > 1 && whatsapp.includes(tool)) {
      if (seen.has("whatsapp")) continue;
      seen.add("whatsapp");
      const sms = whatsapp.some((w) => /sms/i.test(w));
      const mail = whatsapp.some((w) => /e-?mail/i.test(w));
      name = sms
        ? bi("WhatsApp Business and SMS", "WhatsApp Business și SMS")
        : mail
          ? bi("WhatsApp Business and email", "WhatsApp Business și e-mail")
          : bi("WhatsApp Business", "WhatsApp Business");
    }
    if (seen.has(name.ro)) continue;
    seen.add(name.ro);
    out.push(bi(inList(name.en), inList(name.ro)));
  }
  return out;
}

function hoursText(rounded: number | null, raw: number | null): Bilingual {
  if (rounded === null) return bi("brings enquiries, not hours", "aduce solicitări, nu ore");
  if (rounded === 0 && (raw ?? 0) > 0) {
    return bi(`under 5${NBSP}hours a month`, `sub 5${NBSP}ore pe lună`);
  }
  return hoursPerMonth(rounded);
}

function costText(setupLei: number, toolsLei: number): Bilingual {
  if (setupLei === 0 && toolsLei === 0) return bi("included", "inclus");
  const once = approxLei(setupLei);
  if (toolsLei === 0) return bi(`${once.en} one-off`, `${once.ro} o singură dată`);
  const monthly = leiPerMonth(toolsLei, false);
  return bi(`${once.en}, then ${monthly.en}`, `${once.ro}, apoi ${monthly.ro}`);
}

/** "Ce aduce: …" for a phase that is only website work. */
function bringsText(work: WebsiteWorkItem[], type: BusinessTypeDef): Bilingual | undefined {
  const has = (kind: WebsiteWorkItem["kind"]) => work.some((w) => w.kind === kind);
  const the = { en: `new ${type.customers.en}`, ro: `${roDefinite(type.customers.ro)} noi` };
  if (has("new-site") || has("rebuild")) {
    const where = has("google-profile") ? bi(" on Google", " pe Google") : bi("", "");
    const then = type.bookings
      ? bi("can book online", "pot programa online")
      : type.consumer
        ? bi("can message you on WhatsApp", "îți pot scrie pe WhatsApp")
        : bi("can ask for a quote", "îți pot cere o ofertă");
    return bi(
      `What it brings: ${the.en} find you${where.en} and ${then.en}.`,
      `Ce aduce: ${the.ro} te găsesc${where.ro} și ${then.ro}.`,
    );
  }
  if (has("fix") || has("measurement") || has("local-seo") || has("google-profile")) {
    return bi(
      "What it brings: a site that is faster and easier to find, so more of the same visits become enquiries.",
      "Ce aduce: un site mai rapid și mai ușor de găsit, deci mai multe solicitări din aceleași vizite.",
    );
  }
  return undefined;
}

/** The phase that carries "Începem aici" for the recommended strategy. */
function startPhase(
  pick: StrategyKey,
  roadmap: { key: PhaseKey }[],
  work: WebsiteWorkItem[],
): PhaseKey | undefined {
  const present = new Set(roadmap.map((r) => r.key));
  if (pick === "acquire") {
    const siteFirst = work.some((w) => w.phase === "foundation" && w.kind !== "kickoff");
    if (siteFirst && present.has("foundation")) return "foundation";
    return present.has("growth") ? "growth" : undefined;
  }
  const key = PHASE_OF_STRATEGY[pick];
  return present.has(key) ? key : undefined;
}

function automationRow(
  o: AutomationOpportunity,
  phase: PhaseKey,
  hours: number,
  setupLei: number,
  toolsLei: number,
  type: BusinessTypeDef,
): DisplayAutomation {
  const net = midOf(o.monthlySavingsRon) - midOf(o.monthlyToolCostRon);
  const payback = wholeMonths(net > 0 ? midOf(o.setupCostRon) / net : Infinity);
  const row: DisplayAutomation = {
    id: o.id,
    phase,
    title: { ...o.title },
    hoursPerMonth: hours,
    setupLei,
    toolsLeiPerMonth: toolsLei,
    paybackMonths: payback,
    tools: o.tools.map(toolName),
  };
  if (payback === null && getTemplate(o.id)?.customerFacing) {
    row.justification = bi(
      `Worth it for the ${type.customers.en} it brings, not for the time it saves.`,
      `Se justifică prin ${type.customers.ro} câștigați, nu prin timpul câștigat.`,
    );
  }
  return row;
}

function strategyRow(
  s: StrategyOption,
  ctx: {
    phases: DisplayPhase[];
    type: BusinessTypeDef;
    playbook: ReturnType<typeof getPlaybook>;
    blueprint: Blueprint;
    hasWebsite: boolean;
    startReason?: Bilingual;
  },
): DisplayStrategy {
  const id = s.id as StrategyKey;
  const keys: PhaseKey[] =
    id === "acquire" ? ["foundation", "growth"] : [PHASE_OF_STRATEGY[id] ?? "automation"];
  // Acquire owns month 1 only when month 1 is website work (not just the kick-off).
  const own = ctx.phases.filter(
    (p) =>
      keys.includes(p.key) &&
      !(id === "acquire" && p.key === "foundation" && p.setupLei === 0 && !p.brings),
  );
  const optional = own.length === 0;
  const hoursPhase = own.find((p) => p.hoursPerMonth !== null);
  const hours = hoursPhase ? hoursPhase.hoursPerMonth : null;
  const setupLei = optional
    ? roundStep(midOf(s.investmentRon), STEP.oneOff)
    : own.reduce((sum, p) => sum + p.setupLei, 0);
  const toolsLei = own.reduce((sum, p) => sum + p.toolsLeiPerMonth, 0);

  const change = strategyChange({
    id,
    type: ctx.type,
    playbook: ctx.playbook,
    audit: ctx.blueprint.audit,
    hasWebsite: ctx.hasWebsite,
    presence: ctx.blueprint.presence,
    opportunities: ctx.blueprint.opportunities,
  });
  const result =
    change.result ??
    (hours !== null && hours > 0
      ? hoursPerMonth(hours)
      : bi(`under 5${NBSP}hours a month`, `sub 5${NBSP}ore pe lună`));

  const spans = own.map((p) => monthSpan(p.months[0], p.months[1]));
  const firstLive = own.length ? Math.min(...own.map((p) => p.months[0])) + 1 : null;
  const facts = [
    {
      key: "build" as const,
      label: bi("Build", "Implementare"),
      value: optional
        ? bi("optional", "opțional")
        : bi(
            joinList(
              spans.map((x) => x.en),
              "en",
            ),
            joinList(
              spans.map((x) => x.ro),
              "ro",
            ),
          ),
    },
    {
      key: "firstResults" as const,
      label: bi("First results", "Primele rezultate"),
      value:
        firstLive === null
          ? bi("after the call", "după discuție")
          : (() => {
              const m = monthLabel(firstLive);
              return bi(`from ${m.en}`, `din ${m.ro}`);
            })(),
    },
    {
      key: "cost" as const,
      label: bi("Investment", "Investiție"),
      value: costText(setupLei, toolsLei),
    },
    { key: "result" as const, label: bi("Result", "Rezultat"), value: result },
  ];

  const row: DisplayStrategy = {
    id: s.id,
    title: { ...s.title },
    phases: own.map((p) => ({ key: p.key, title: { ...p.title } })),
    label: change.label,
    result,
    support: change.support,
    hoursPerMonth: hours,
    setupLei,
    toolsLeiPerMonth: toolsLei,
    facts,
    optional,
  };
  if (change.assumption) row.assumption = change.assumption;
  if (ctx.startReason) row.start = { reason: ctx.startReason };
  return row;
}

/** What the website work is called in the notes and the footer. */
function siteWorkName(work: WebsiteWorkItem[]): { name: Bilingual; plural: boolean } {
  const has = (kind: WebsiteWorkItem["kind"]) => work.some((w) => w.kind === kind);
  const google = has("google-profile");
  if (has("new-site")) {
    return google
      ? {
          name: bi("the new website and Google profile", "site-ul nou și profilul Google"),
          plural: true,
        }
      : { name: bi("the new website", "site-ul nou"), plural: false };
  }
  if (has("rebuild")) {
    return {
      name: bi("getting the website back online", "repunerea site-ului online"),
      plural: false,
    };
  }
  return { name: bi("the website work", "lucrările la site"), plural: true };
}

/**
 * What the chart's cost leaves out, for the Cost KPI sub-line: the website (when the
 * plan has any website work) and always the Vortex Hub plan fee (note ² says why).
 */
function exclusions(plan: DisplayPlan): Bilingual {
  const fee = bi("the Vortex Hub plan", "abonamentul Vortex Hub");
  if (!plan.totals.siteLei) return bi(`${fee.en} excluded`, `fără ${fee.ro}`);
  const newSite = plan.phases.some((p) => p.siteMilestone);
  const site = newSite ? bi("the website", "site") : bi("website work", "lucrările la site");
  return bi(`${site.en} and ${fee.en} excluded`, `fără ${site.ro} și fără ${fee.ro}`);
}

/**
 * The payback month with the offer's monthly fee added to the chart's cost from month 1
 * (the subscription starts with the work). One payback definition stays on the chart;
 * this line states the other figure an owner will ask about.
 */
function feePaybackText(blueprint: Blueprint, hasAutomations: boolean): Bilingual | null {
  const fee = offerFeeRon(blueprint.offer);
  if (fee === null || !hasAutomations) return null;
  const points = blueprint.projection
    .filter((p) => p.month >= 1 && p.month <= PROJECTION_MONTHS)
    .sort((a, b) => a.month - b.month)
    .map((p) => ({
      ...p,
      cumulativeCostRon: {
        ...p.cumulativeCostRon,
        low: p.cumulativeCostRon.low + fee * p.month,
        high: p.cumulativeCostRon.high + fee * p.month,
        ...(p.cumulativeCostRon.mid !== undefined
          ? { mid: p.cumulativeCostRon.mid + fee * p.month }
          : {}),
      },
    }));
  const month = breakEvenMonth(points);
  const name = blueprint.offer.title;
  if (month === null) {
    return bi(
      `With the ${name.en} plan fee included, the investment doesn't pay back within the first 24 months.`,
      `Cu abonamentul ${name.ro} inclus, investiția nu se recuperează în primele 24 de luni.`,
    );
  }
  const m = monthLabel(month);
  return bi(
    `With the ${name.en} plan fee included, the investment pays back in ${m.en}.`,
    `Cu abonamentul ${name.ro} inclus, investiția se recuperează în ${m.ro}.`,
  );
}

/** The strategy step's closing line (after the cards and the simulation). */
function startNoteText(
  start: StrategyOption | undefined,
  sitePhase: DisplayPhase | undefined,
): Bilingual | null {
  if (!start) return null;
  if (sitePhase) {
    const when = sitePhase.dateLabel;
    return bi(
      `${when.en}: the website work, then we start with “${start.title.en}”. The plan shows each stage with its hours and cost.`,
      `${when.ro}: lucrările la site, apoi începem cu „${start.title.ro}”. Planul arată fiecare etapă, cu orele și costul ei.`,
    );
  }
  return bi(
    `We'd start with “${start.title.en}”. The plan shows each stage with its hours and cost.`,
    `Începem cu „${start.title.ro}”. Planul arată fiecare etapă, cu orele și costul ei.`,
  );
}

function paybackNote(be: BreakEven, hasAutomations: boolean): Bilingual {
  if (!hasAutomations) {
    return bi(
      "The plan has no automations, so there is no payback month: the gain is new customers.",
      "Planul nu are automatizări, deci nu are o lună de recuperare: câștigul sunt clienții noi.",
    );
  }
  const higher = be.higherVolume;
  const lower = be.lowerVolume;
  if (be.month === null) {
    const base = bi(
      "On the base estimate, the investment doesn't pay back within the first 24 months.",
      "Cu estimarea de bază, investiția nu se recuperează în primele 24 de luni.",
    );
    if (higher === null) return base;
    const m = monthLabel(higher);
    return bi(
      `${base.en} With volumes 20% higher, it pays back in ${m.en}.`,
      `${base.ro} Cu volume cu 20% mai mari, se recuperează în ${m.ro}.`,
    );
  }
  const m = capitalised(monthLabel(be.month));
  const lead = bi(`${m.en} is the base estimate.`, `${m.ro} e estimarea de bază.`);
  if (higher === null || lower === null || lower / higher > 2) {
    return bi(
      `${lead.en} With volumes 20% higher or lower the range is wide, so we confirm it on the call.`,
      `${lead.ro} Cu volume cu 20% mai mari sau mai mici, intervalul e larg: de confirmat la discuție.`,
    );
  }
  const hi = monthLabel(higher);
  const lo = monthLabel(lower);
  return bi(
    `${lead.en} With volumes 20% higher, ${hi.en}; 20% lower, ${lo.en}.`,
    `${lead.ro} Cu volume cu 20% mai mari, ${hi.ro}; cu 20% mai mici, ${lo.ro}.`,
  );
}

function scopeNote(
  work: WebsiteWorkItem[],
  siteLei: number | null,
  type: BusinessTypeDef,
): Bilingual {
  const covers = bi(
    "The cost covers building the automations and their tools.",
    "Costul cuprinde implementarea automatizărilor și instrumentele.",
  );
  if (!siteLei) {
    return bi(
      `${covers.en} It leaves out the Vortex Hub plan fee.`,
      `${covers.ro} Nu cuprinde abonamentul Vortex Hub.`,
    );
  }
  const { name, plural } = siteWorkName(work);
  const amount = approxLei(siteLei);
  return bi(
    `${covers.en} It leaves out ${name.en} (${amount.en}), which ${plural ? "bring" : "brings"} ${type.customers.en}, not hours, and the Vortex Hub plan fee.`,
    `${covers.ro} Nu cuprinde ${name.ro} (${amount.ro}), care ${plural ? "aduc" : "aduce"} ${type.customers.ro}, nu ore, și nici abonamentul Vortex Hub.`,
  );
}

function hourValueNote(blueprint: Blueprint, type: BusinessTypeDef): Bilingual {
  const hourly = blueprint.assumptions.hourlyCostRon;
  const ins = hourlyCostFor(blueprint.company?.caen, type);
  const perHour = lei(hourly);
  if (ins.hourlyCostRon !== hourly) {
    return bi(
      `${perHour.en} an hour, the figure you set in the simulation.`,
      `${perHour.ro} pe oră, valoarea introdusă de tine în simulare.`,
    );
  }
  const gross = lei(ins.grossRon);
  const where = ins.sector ? bi(` in ${ins.sector.en}`, ` în ${ins.sector.ro}`) : bi("", "");
  const cam = {
    en: formatNumber(CAM_RATE * 100, "en", 2),
    ro: formatNumber(CAM_RATE * 100, "ro", 2),
  };
  const hours = `${HOURS_PER_MONTH}${NBSP}${roNeedsDe(HOURS_PER_MONTH) ? "de " : ""}ore`;
  return bi(
    `${gross.en} average gross monthly pay${where.en} (INS, ${WAGE_SOURCE.month.en}) + ${cam.en}% employer contribution, over ${HOURS_PER_MONTH} hours = ${perHour.en} an hour.`,
    `${gross.ro} salariul mediu brut${where.ro} (INS, ${WAGE_SOURCE.month.ro}) + ${cam.ro}% contribuție, împărțit la ${hours} = ${perHour.ro} pe oră.`,
  );
}

function assumptionNotes(
  blueprint: Blueprint,
  playbook: ReturnType<typeof getPlaybook>,
): Bilingual[] {
  const notes: Bilingual[] = [];
  const assistant = blueprint.opportunities.some((o) => strategyOf(o.id) === "assist");
  if (assistant) {
    const share = strategyChange({
      id: "assist",
      type: getBusinessType(blueprint.businessType.id),
      playbook,
      hasWebsite: true,
      opportunities: [],
    }).result;
    if (share) {
      notes.push(
        bi(
          `${share.en} is a working assumption; we check it in the first month.`,
          `${share.ro} e o ipoteză de lucru; o verificăm în prima lună.`,
        ),
      );
    }
  }
  for (const note of blueprint.assumptions.notes) notes.push({ ...note });
  return notes;
}

/** "o echipă de 3–7 persoane" (or the size set in the simulation). */
function teamPhrase(blueprint: Blueprint): Bilingual {
  const { low, high } = blueprint.assumptions.teamSize;
  const set = blueprint.assumptions.simulation.teamSize;
  const typical = Math.max(1, Math.round(Math.sqrt(low * high)));
  if (set !== typical) {
    return set === 1
      ? bi("a team of one", "o echipă de o persoană")
      : bi(`a team of ${set}`, `o echipă de ${set}${NBSP}${roNeedsDe(set) ? "de " : ""}persoane`);
  }
  return bi(
    `a team of ${low}–${high} people`,
    `o echipă de ${low}–${high}${NBSP}${roNeedsDe(high) ? "de " : ""}persoane`,
  );
}

function leadText(blueprint: Blueprint, type: BusinessTypeDef): Bilingual {
  const team = teamPhrase(blueprint);
  return bi(
    `The base estimate for ${team.en} (${type.label.en.toLowerCase()}). Ranges and assumptions are in the notes.`,
    `Estimarea de bază pentru ${team.ro} (${lcFirst(type.label.ro)}). Intervalele și ipotezele sunt în note.`,
  );
}

function teamText(blueprint: Blueprint): Bilingual {
  const team = teamPhrase(blueprint);
  return bi(`For ${team.en}.`, `Pentru ${team.ro}.`);
}

const COUNT_WORDS: Array<Bilingual> = [
  bi("No", "Nicio"),
  bi("One", "O"),
  bi("Two", "Două"),
  bi("Three", "Trei"),
  bi("Four", "Patru"),
];
const MONTH_WORDS: Record<number, Bilingual> = {
  1: bi("one month", "o lună"),
  2: bi("two months", "două luni"),
  3: bi("three months", "trei luni"),
  4: bi("four months", "patru luni"),
  5: bi("five months", "cinci luni"),
  6: bi("six months", "șase luni"),
};

function roadmapTitle(phases: DisplayPhase[]): Bilingual {
  const n = phases.length;
  const span = Math.max(1, ...phases.map((p) => p.months[1]));
  const count = COUNT_WORDS[n] ?? bi(String(n), String(n));
  const months = MONTH_WORDS[span] ?? bi(`${span} months`, `${span} luni`);
  return bi(
    `${count.en} ${n === 1 ? "stage" : "stages"} in ${months.en}`,
    `${count.ro} ${n === 1 ? "etapă" : "etape"} în ${months.ro}`,
  );
}

function roadmapLead(
  phases: DisplayPhase[],
  work: WebsiteWorkItem[],
  projection: Blueprint["projection"],
): Bilingual {
  const first = phases[0];
  const has = (kind: WebsiteWorkItem["kind"]) =>
    work.some((w) => w.phase === "foundation" && w.kind === kind);
  let opening: Bilingual;
  if (first?.key === "foundation") {
    opening = has("new-site")
      ? bi("We start with the website.", "Începem cu site-ul.")
      : has("rebuild")
        ? bi(
            "We start by getting the website back online.",
            "Începem prin a repune site-ul online.",
          )
        : has("fix") || has("measurement") || has("local-seo")
          ? bi("We start with the website fixes.", "Începem cu remedierile pe site.")
          : has("google-profile")
            ? bi("We start with the Google profile.", "Începem cu profilul Google.")
            : bi("We start with a kick-off call.", "Începem cu o ședință de start.");
  } else {
    opening = bi(
      `We start with ${lcFirst(first?.title.en ?? "the plan")}.`,
      `Începem cu ${lcFirst(first?.title.ro ?? "planul")}.`,
    );
  }
  const firstHours = projection.find((p) => midOf(p.cumulativeSavingsRon) > 0)?.month;
  if (!firstHours) return opening;
  const m = monthLabel(firstHours);
  return bi(
    `${opening.en} The first hours won back show from ${m.en}.`,
    `${opening.ro} Primele ore câștigate apar din ${m.ro}.`,
  );
}

function footerText(setupLei: number, siteLei: number | null, work: WebsiteWorkItem[]): Bilingual {
  const total = approxLei(setupLei);
  if (!siteLei) {
    return bi(`Setup ${total.en} in total.`, `Implementare ${total.ro} în total.`);
  }
  const site = approxLei(siteLei);
  const newSite = work.some((w) => w.kind === "new-site" || w.kind === "rebuild");
  const part = newSite ? bi("the website", "site-ul") : bi("the website work", "lucrările la site");
  return bi(
    `Setup ${total.en} in total, of which ${part.en} ${site.en}.`,
    `Implementare ${total.ro} în total, din care ${part.ro} ${site.ro}.`,
  );
}

/** The hours a month against one full-time job (168 hours). */
function fteText(hours: number): Bilingual {
  const share = hours / HOURS_PER_MONTH;
  if (share >= 0.9) {
    const jobs = Math.round(share * 2) / 2;
    if (jobs === 1) return bi("about one full-time job", "cam o normă întreagă");
    const n = {
      en: formatNumber(jobs, "en", jobs % 1 ? 1 : 0),
      ro: formatNumber(jobs, "ro", jobs % 1 ? 1 : 0),
    };
    return bi(`about ${n.en} full-time jobs`, `cam ${n.ro} norme întregi`);
  }
  if (share < 0.15) return bi("a few hours a week", "câteva ore pe săptămână");
  const words = shareWords(share);
  return bi(`${words.en} of a full-time job`, `${words.ro} dintr-o normă întreagă`);
}

function conclusionText(month: number | null, hasAutomations: boolean): Bilingual {
  if (!hasAutomations) return bi("The gain is new customers", "Câștigul sunt clienții noi");
  if (month === null) {
    return bi(
      "Doesn't pay back within the first 24 months",
      "Nu se recuperează în primele 24 de luni",
    );
  }
  const m = monthLabel(month);
  return bi(`Pays back in ${m.en}`, `Se recuperează în ${m.ro}`);
}

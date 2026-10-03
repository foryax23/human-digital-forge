import type {
  Action,
  AreaLight,
  Audience,
  Bilingual,
  Brief,
  BriefSection,
  CompetitorCard,
  Correction,
  DeepReport,
  Fact,
  Finding,
  Gap,
  Lang,
  OwnerInputs,
  PlanTotals,
  Relationship,
  SectorVocabId,
  SourceId,
} from "../contracts";
import { vocabFor as vocabForCaen, vocabId } from "../vocab";

import { chooseActions, planTotals } from "./actions";
import { correctionFacts } from "./corrections";
import { recomputeEstimateList, FORMULA } from "./estimates";
import { computeFindings } from "./findings";
import { computeHeadline } from "./headline";
import { computeLights } from "./lights";
import { changePct, keptOf100, readFacts, roCount } from "./read";
import { rulesBrief } from "./templates";

/*
 * Report logic of "Cercetare aprofundată" (plan A8, D2 "Report logic"): pure
 * and client-safe, shared by `finish` on the server (through the dispatcher's
 * ReportBuilder seam) and by the browser (provisional lines while a run is in
 * progress, corrections and the "Ajustează cifrele" panel), so the page, the
 * PDF and the summary text can never disagree.
 */

export type ReportPartsInput = {
  facts: Fact[];
  gaps: Gap[];
  company: DeepReport["company"];
  relationship: Relationship;
  lang: Lang;
  peers?: DeepReport["peers"];
  competitors: CompetitorCard[];
  owner?: OwnerInputs;
};

export type ReportParts = {
  lights: AreaLight[];
  findings: Finding[];
  actions: Action[];
  totals: PlanTotals;
  headlineKey: string;
  rulesBrief: Brief;
  firm: "established" | "new";
  audience: Audience;
  vocab: SectorVocabId;
  registers: DeepReport["registers"];
  counts: DeepReport["counts"];
};

const bi = (en: string, ro: string): Bilingual => ({ en, ro });

export function audienceOf(relationship: Relationship): Audience {
  return relationship === "proprietar" || relationship === "angajat" ? "owner" : "third_party";
}

const OFFICIAL_SOURCES = new Set<SourceId>([
  "anaf_v9",
  "anaf_bilant",
  "mf_bulk",
  "onrc",
  "courts",
  "ted",
]);

const NOT_CHECKED = {
  taxDebts: {
    name: bi(
      "Tax debts (ANAF list of overdue taxes)",
      "Datorii la stat (lista ANAF a datornicilor)",
    ),
    link: "https://www.anaf.ro/restante/",
  },
  bpi: {
    name: bi("Insolvency bulletin (BPI)", "Buletinul procedurilor de insolvență (BPI)"),
    link: "https://www.onrc.ro/index.php/ro/bpi",
  },
  rnpm: {
    name: bi("Movable assets register (RNPM)", "Arhiva electronică de garanții (RNPM)"),
    link: "https://www.rnpm.ro",
  },
  courts: {
    name: bi("Court cases (portal.just.ro)", "Dosare în instanță (portal.just.ro)"),
    link: "https://portal.just.ro",
  },
  administrators: {
    name: bi("Administrators (ONRC certificate)", "Administratori (certificat constatator ONRC)"),
    link: "https://portal.onrc.ro",
  },
};

/** Registers checked in this run and the ones not checked, with links (A1 "Dovezi"). */
export function registersFor(facts: Fact[]): DeepReport["registers"] {
  const r = readFacts(facts);
  const checked: Bilingual[] = [];
  if (r.has("identity.status")) checked.push(bi("ANAF (status, VAT)", "ANAF (stare, TVA)"));
  if (r.filed() !== undefined && r.filed() !== null)
    checked.push(bi("Annual accounts (Ministry of Finance)", "Bilanțuri (Ministerul Finanțelor)"));
  if (r.has("risk.courts.checked"))
    checked.push(bi("Court portal (portal.just.ro)", "Portalul instanțelor (portal.just.ro)"));
  if (r.has("risk.ted.awards")) checked.push(bi("EU tenders (TED)", "Licitații europene (TED)"));
  if (r.has("peers.n"))
    checked.push(
      bi(
        "Similar firms' annual accounts (Ministry of Finance)",
        "Bilanțurile firmelor similare (Ministerul Finanțelor)",
      ),
    );
  const notChecked = [NOT_CHECKED.taxDebts, NOT_CHECKED.bpi, NOT_CHECKED.rnpm];
  if (!r.has("risk.courts.checked")) notChecked.push(NOT_CHECKED.courts);
  if (!r.has("people.admin_count")) notChecked.push(NOT_CHECKED.administrators);
  return { checked, notChecked };
}

/**
 * Counts of the trust strip: each is the length of a list the reader can open
 * (official sources in "Surse", pages read, facts in "Dovezi", estimates =
 * action effects plus facts marked "Estimare").
 */
export function countsFor(facts: Fact[], actions: Action[]): DeepReport["counts"] {
  const kept = facts.filter((f) => !f.ephemeral);
  const pages =
    readFacts(kept).num("site.pages_read") ??
    kept
      .filter((f) => f.predicate === "site.pages_read")
      .reduce((n, f) => n + (typeof f.value === "number" ? f.value : 0), 0);
  return {
    officialSources: new Set(kept.map((f) => f.source).filter((s) => OFFICIAL_SOURCES.has(s))).size,
    pagesRead: pages,
    facts: kept.length,
    estimates:
      actions.filter((a) => a.effect && a.effect.value > 0).length +
      kept.filter((f) => f.confidence === "estimare").length,
  };
}

/** Plan D2: lines, findings, actions, totals, the rules brief and the counts, from facts. */
export function buildReportParts(input: ReportPartsInput): ReportParts {
  const audience = audienceOf(input.relationship);
  const facts = input.facts.filter((f) => !f.ephemeral || f.predicate === "presence.google_rating");
  const vocab = vocabId(input.company.caen2 ?? input.company.caen3);
  const r = readFacts(facts);
  const lights = computeLights(facts, { vocab, audience });
  const actions = chooseActions(facts, {
    vocab,
    audience,
    caen: input.company.caen2 ?? input.company.caen3,
    owner: input.owner,
    peers: input.peers,
  });
  const totals = planTotals(actions);
  const name = cleanCompanyName(input.company.displayName || input.company.name);
  const headline = computeHeadline(facts, lights, actions, { audience, name });
  // A finding that repeats the headline gives its place to another one.
  const findings = computeFindings(facts, {
    audience,
    lang: input.lang,
    headlineKey: headline.key,
  });
  const brief = rulesBrief({
    facts,
    gaps: input.gaps,
    lang: input.lang,
    audience,
    vocab,
    name,
    lights,
    findings,
    actions,
    headline,
  });
  return {
    lights,
    findings,
    actions,
    totals,
    headlineKey: headline.key,
    rulesBrief: brief,
    firm: r.filed() === false ? "new" : "established",
    audience,
    vocab,
    registers: registersFor(facts),
    counts: countsFor(facts, actions),
  };
}

/**
 * The "Ajustează cifrele" panel (D11): recomputes the effects from their typed
 * inputs merged with the panel's values, the time estimates again with the
 * overlap rule and the 20% cap, and the totals (one line per kind of money).
 */
export function recomputeEstimates(
  actions: Action[],
  inputs: Record<string, number>,
): { actions: Action[]; totals: PlanTotals } {
  const order: string[] = [FORMULA.booking, FORMULA.reminders];
  const withEffect = actions
    .map((a, i) => ({ a, i }))
    .filter((x) => x.a.effect)
    .sort((x, y) => {
      const ox = order.indexOf(x.a.effect!.formulaId);
      const oy = order.indexOf(y.a.effect!.formulaId);
      return (ox < 0 ? 99 : ox) - (oy < 0 ? 99 : oy) || x.i - y.i;
    });
  const rebuilt = recomputeEstimateList(
    withEffect.map((x) => x.a.effect!),
    inputs,
  );
  const next = actions.map((a) => ({ ...a }));
  withEffect.forEach((x, n) => {
    next[x.i] = { ...next[x.i], effect: rebuilt[n] };
  });
  return { actions: next, totals: planTotals(next) };
}

/**
 * A correction in the browser (D25): the declared fact replaces the observed
 * one, lines, findings, actions and totals are rebuilt at once, AI sentences
 * citing a corrected fact are hidden ("corectat de tine"), and rules sections
 * are rebuilt from the corrected facts.
 */
export function applyCorrections(
  report: DeepReport,
  corrections: Correction[],
  today: string = new Date().toISOString().slice(0, 10),
): DeepReport {
  const { facts, hidden } = correctionFacts(report.facts, corrections, today);
  const declaredUrl = facts.find((f) => f.id === "site.url" && f.confidence === "declarat");
  const company: DeepReport["company"] =
    declaredUrl && typeof declaredUrl.value === "string"
      ? { ...report.company, website: { url: declaredUrl.value, status: "declared" } }
      : report.company;
  const parts = buildReportParts({
    facts,
    gaps: report.gaps,
    company,
    relationship: report.relationship,
    lang: report.lang,
    peers: report.peers,
    competitors: report.competitors,
    owner: report.ownerInputs,
  });
  const fix = (
    current: BriefSection | undefined,
    rules: BriefSection | undefined,
  ): BriefSection | undefined => {
    if (!current) return rules;
    if (current.source === "rules") return rules ?? current;
    const sentences = current.sentences.map((s) => {
      const by = s.factIds.find((id) => hidden.has(id));
      return by ? { ...s, hiddenBy: hidden.get(by) } : s;
    });
    return sentences.every((s) => s.hiddenBy)
      ? (rules ?? { ...current, sentences })
      : { ...current, sentences };
  };
  const rb = parts.rulesBrief;
  const brief: Brief = {
    ...report.brief,
    headline: fix(report.brief.headline, rb.headline)!,
    meaning: fix(report.brief.meaning, rb.meaning)!,
    customerView: fix(report.brief.customerView, rb.customerView)!,
    rivals: fix(report.brief.rivals, rb.rivals)!,
    ifNothing: fix(report.brief.ifNothing, rb.ifNothing),
    findings: parts.findings.map((_, i) => fix(report.brief.findings[i], rb.findings[i])!),
  };
  return {
    ...report,
    company,
    facts,
    lights: parts.lights,
    findings: parts.findings,
    actions: parts.actions,
    totals: parts.totals,
    brief,
    registers: parts.registers,
    counts: parts.counts,
    vocab: parts.vocab,
    firm: parts.firm,
  };
}

/** Plan D2: the vocabulary group of a CAEN code and its words. */
export function vocabFor(caen2?: string): { id: SectorVocabId; words: Record<string, Bilingual> } {
  return vocabForCaen(caen2);
}

/** Provisional lines while a run is in progress (marked "provizoriu" until finish). */
export function previewLights(
  facts: Fact[],
  opts: { audience?: Audience; vocab?: SectorVocabId } = {},
): AreaLight[] {
  const r = readFacts(facts);
  const caen =
    (r.get("money.caen_rev2")?.value as { code?: string } | undefined)?.code ??
    (r.get("identity.caen")?.value as { code?: string } | undefined)?.code;
  return computeLights(facts, {
    vocab: opts.vocab ?? vocabId(caen),
    audience: opts.audience ?? "owner",
  }).map((l) => ({ ...l, provisional: true as const }));
}

export type DueDiligenceItem = {
  id: string;
  label: Bilingual;
  value: Bilingual;
  factIds: string[];
  link?: string;
};

/**
 * "Ce să verifici înainte să lucrezi cu ei" (A1 variants): the block third
 * parties get instead of the actions and the Vortex offer. Court counts by
 * role only, shown as adverse only at a match score ≥ 0.9; registers not
 * checked are listed with their links.
 */
export function dueDiligence(report: Pick<DeepReport, "facts" | "registers">): DueDiligenceItem[] {
  const r = readFacts(report.facts);
  const out: DueDiligenceItem[] = [];
  const status = r.get("identity.status");
  if (status)
    out.push({
      id: "status",
      label: bi("Status at ANAF", "Starea la ANAF"),
      value: status.display,
      factIds: [status.id],
    });
  const vat = r.get("identity.vat_payer");
  // The status already says "plătitoare de TVA": no second row for it.
  if (vat && !/TVA/.test(status?.display.ro ?? ""))
    out.push({
      id: "vat",
      label: bi("VAT registered", "Plătitor de TVA"),
      value: vat.display,
      factIds: [vat.id],
    });
  const filed = r.get("money.filed");
  if (filed)
    out.push({
      id: "accounts",
      label: bi("Annual accounts", "Bilanțuri"),
      value: filed.display,
      factIds: [filed.id],
    });
  const days = r.band("daysToCollect");
  if (days && days.you !== undefined) {
    const slower = days.you > days.p75;
    const faster = days.you < days.p25;
    out.push({
      id: "collect",
      // How fast it collects its invoices says nothing about how fast it pays its suppliers.
      label: bi(
        "How fast it collects its invoices (estimate; not how fast it pays suppliers)",
        "Cât de repede își încasează facturile (estimare; nu arată cât de repede își plătește furnizorii)",
      ),
      value: slower
        ? bi("more slowly than most similar firms", "mai încet decât majoritatea firmelor similare")
        : faster
          ? bi("faster than most similar firms", "mai repede decât majoritatea firmelor similare")
          : bi("like most similar firms", "ca majoritatea firmelor similare"),
      factIds: [days.fact.id],
    });
  }
  const courts = r.get("risk.courts.checked");
  if (courts) {
    const n = (id: string) => {
      const f = r.get(id);
      return f && typeof f.value === "number" && f.score >= 0.9 ? { f, v: f.value } : null;
    };
    const plaintiff = n("risk.courts.as_plaintiff");
    const defendant = n("risk.courts.as_defendant");
    const parts: Bilingual[] = [];
    if (plaintiff && plaintiff.v > 0)
      parts.push(
        plaintiff.v === 1
          ? bi("started 1 case", "a deschis un proces")
          : bi(`started ${plaintiff.v} cases`, `a deschis ${roCount(plaintiff.v, "procese")}`),
      );
    if (defendant && defendant.v > 0)
      parts.push(
        defendant.v === 1
          ? bi("taken to court once", "a fost dată în judecată o dată")
          : bi(
              `taken to court ${defendant.v} times`,
              `a fost dată în judecată de ${defendant.v} ori`,
            ),
      );
    // The fact a supplier wants most: whether anyone sued the firm.
    else if (defendant && plaintiff && plaintiff.v > 0)
      parts.push(bi("nobody took it to court", "nu a fost dată în judecată"));
    const uncertain = ["risk.courts.as_defendant", "risk.courts.insolvency_debtor"].some((id) => {
      const f = r.get(id);
      return f && f.score < 0.9;
    });
    out.push({
      id: "courts",
      label: bi("Court cases, last 3 years", "Procese, ultimii 3 ani"),
      value: parts.length
        ? bi(parts.map((p) => p.en).join("; "), parts.map((p) => p.ro).join("; "))
        : uncertain
          ? bi("uncertain match; check at the source", "potrivire nesigură; de verificat la sursă")
          : bi("no cases found as a party", "niciun dosar găsit ca parte"),
      factIds: [
        courts.id,
        ...(plaintiff ? [plaintiff.f.id] : []),
        ...(defendant ? [defendant.f.id] : []),
      ],
      link: "https://portal.just.ro",
    });
  }
  for (const reg of report.registers.notChecked) {
    out.push({
      id: `not_checked.${reg.link}`,
      label: reg.name,
      value: bi("not checked by us", "neverificat de noi"),
      factIds: [],
      link: reg.link,
    });
  }
  return out;
}

/**
 * What a rival does better than the company, each point checked against the company's own
 * fact ("programare online pe site", "păstrează 21 de lei din 100 (tu: 10)"); undefined when
 * it beats the company on nothing we checked, so "Unde te depășesc" never lists a rival that
 * grows more slowly or keeps less.
 */
export function rivalEdge(
  card: CompetitorCard,
  facts: Fact[],
  audience: Audience,
): Bilingual | undefined {
  const r = readFacts(facts);
  const owner = audience === "owner";
  const mine = (en: string, ro: string) =>
    owner ? bi(` (you: ${en})`, ` (tu: ${ro})`) : bi(` (the company: ${en})`, ` (firma: ${ro})`);
  const parts: Bilingual[] = [];
  const booking = r.get("site.booking.present");
  if (card.booking === true && booking?.value === false)
    parts.push(bi("online booking on the site", "programare online pe site"));
  const margin = r.latest("money.margin_pretax");
  if (card.turnover && card.turnover > 0 && card.profitPretax !== undefined && margin) {
    const theirs = keptOf100(card.profitPretax / card.turnover);
    const ours = keptOf100(margin.value);
    if (theirs > ours) {
      const m = mine(`${ours}`, `${ours}`);
      parts.push(
        bi(
          `keeps ${theirs} lei of every 100${m.en}`,
          `păstrează ${roCount(theirs, "lei")} din 100${m.ro}`,
        ),
      );
    }
  }
  const growth = r.get("money.growth_turnover");
  const g = (growth?.value as { ratio?: number } | undefined)?.ratio;
  if (card.turnover && card.turnoverPrev && card.turnoverPrev > 0 && typeof g === "number") {
    const theirs = card.turnover / card.turnoverPrev - 1;
    if (theirs > g + 0.01 && theirs > 0) {
      const sign = (x: number) => (x >= 0 ? "+" : "−");
      const a = changePct(theirs);
      const b = changePct(g);
      const m = mine(`${sign(g)}${b.en}`, `${sign(g)}${b.ro}`);
      parts.push(bi(`turnover +${a.en}${m.en}`, `cifra de afaceri +${a.ro}${m.ro}`));
    }
  }
  const important = r.num("site.audit.important");
  if (card.importantIssues === 0 && card.siteVerified && important && important > 0) {
    const m = mine(`${important}`, `${important}`);
    parts.push(
      bi(`no important issue on its website${m.en}`, `nicio problemă importantă pe site${m.ro}`),
    );
  }
  if (!parts.length) return undefined;
  return bi(parts.map((p) => p.en).join("; "), parts.map((p) => p.ro).join("; "));
}

/**
 * The company name as people write it: the registry form can carry doubled commas, quotes
 * and "srl" glued to the name ("…Fiscal,,Confiscalsrl" → "…Fiscal, Confiscal SRL").
 */
export function cleanCompanyName(name: string): string {
  return (
    name
      .replace(/[„“”"«»]/g, "")
      .replace(/\s*,{2,}\s*/g, ", ")
      .replace(/\s*,\s*/g, ", ")
      // Only "srl": "sa" ends too many real words ("Casa", "Mimosa") to split safely.
      .replace(/(\p{Ll})srl\b/giu, "$1 SRL")
      .replace(/\s{2,}/g, " ")
      .trim()
      .replace(/,$/, "")
  );
}

export { computeLights } from "./lights";
export { officeHourValue } from "./hourly";
export { summaryLines, RULES_LABEL } from "./templates";
export { correctionFacts } from "./corrections";

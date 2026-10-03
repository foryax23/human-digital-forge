import type {
  Bilingual,
  Brief,
  BriefSection,
  CompetitorCard,
  DeepReport,
  Fact,
  OwnerInputs,
} from "@/lib/deep/contracts";
import { bi } from "@/lib/deep/parse/format";
import { recomputeEstimates } from "@/lib/deep/report";
import { WORKING_DAYS_PER_MONTH } from "@/lib/deep/report/hourly";

/*
 * Browser-side changes to a finished report that the shared report logic
 * (src/lib/deep/report/**, Eng 3) does not cover itself:
 * - the "Ajustează" panel's owner inputs mapped onto the estimates' typed inputs;
 * - rival edits after the report ("Nu e concurentul meu", "Adaugă un concurent"): the server
 *   closes the run at finish, so peers and competitor steps are refused then (asked of Eng 1
 *   in the wave report); the edit is applied here and recorded as feedback;
 * - "Ce s-a schimbat față de raportul din <dată>", comparing facts by ID.
 * Corrections and provisional lines come straight from src/lib/deep/report.
 */

/** The owner's numbers as the estimates' input names (clients a month → bookings a day). */
export function estimateInputsFrom(owner: OwnerInputs | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!owner) return out;
  const ok = (v: number | undefined): v is number =>
    typeof v === "number" && Number.isFinite(v) && v > 0;
  if (ok(owner.hourValue)) out.hourValue = owner.hourValue;
  if (ok(owner.clientsPerMonth))
    out.bookingsPerDay = owner.clientsPerMonth / WORKING_DAYS_PER_MONTH;
  if (ok(owner.turnover2026)) {
    out.turnover = owner.turnover2026;
    out.ownerTurnover = 1;
  }
  if (ok(owner.avgTicket)) out.avgTicket = owner.avgTicket;
  return out;
}

/** The report with the owner's numbers in every estimate; official figures never change. */
export function withOwnerInputs(report: DeepReport, owner: OwnerInputs | undefined): DeepReport {
  const inputs = estimateInputsFrom(owner);
  if (!Object.keys(inputs).length) return report;
  const { actions, totals } = recomputeEstimates(report.actions, inputs);
  return { ...report, actions, totals, ownerInputs: owner };
}

/** Which owner inputs change at least one estimate of this report (the panel shows those). */
export function adjustableInputs(report: DeepReport): Set<keyof OwnerInputs> {
  const names = new Set(report.actions.flatMap((a) => Object.keys(a.effect?.inputs ?? {})));
  const out = new Set<keyof OwnerInputs>();
  if (names.has("hourValue")) out.add("hourValue");
  if (names.has("bookingsPerDay")) out.add("clientsPerMonth");
  if (names.has("turnover")) out.add("turnover2026");
  if (names.has("avgTicket")) out.add("avgTicket");
  return out;
}

/** The hour value an estimate assumes ("presupunem 30 lei/oră"), if any. */
export function assumedHourValue(report: DeepReport): number | undefined {
  for (const a of report.actions) {
    const v = a.effect?.inputs.hourValue;
    if (v) return v;
  }
  return undefined;
}

/** Clients a month an estimate assumes, from its bookings a day. */
export function assumedClients(report: DeepReport): number | undefined {
  for (const a of report.actions) {
    const v = a.effect?.inputs.bookingsPerDay;
    if (v) return Math.round(v * WORKING_DAYS_PER_MONTH);
  }
  return undefined;
}

/* ------------------------------------------------------------ rivals */

function hideIn(section: BriefSection | undefined, ids: Set<string>): BriefSection | undefined {
  if (!section) return section;
  return {
    ...section,
    sentences: section.sentences.map((s) => {
      const by = s.factIds.find((id) => ids.has(id));
      return by && !s.hiddenBy ? { ...s, hiddenBy: by } : s;
    }),
  };
}

/** Sentences citing any of `ids` are hidden ("corectat de tine"). */
export function hideSentences(brief: Brief, ids: Set<string>): Brief {
  return {
    ...brief,
    headline: hideIn(brief.headline, ids)!,
    meaning: hideIn(brief.meaning, ids)!,
    findings: brief.findings.map((s) => hideIn(s, ids)!),
    customerView: hideIn(brief.customerView, ids)!,
    rivals: hideIn(brief.rivals, ids)!,
    ifNothing: hideIn(brief.ifNothing, ids),
  };
}

/** Competitor cards from facts (the same mapping as the engine's report context). */
export function cardsFromFacts(facts: Fact[]): CompetitorCard[] {
  return facts
    .filter((f) => f.predicate === "peers.rival")
    .map((f) => {
      const v = f.value as Record<string, unknown>;
      const site = facts.find((x) => x.id === `competitors.site.${v.cui}`)?.value as
        | Record<string, unknown>
        | undefined;
      return {
        cui: String(v.cui),
        name: String(v.name),
        city: v.city as string | undefined,
        turnover: v.turnover as number | undefined,
        turnoverPrev: v.turnoverPrev as number | undefined,
        profitPretax: v.profitPretax as number | undefined,
        employees: v.employees as number | undefined,
        website: (site?.website as string | undefined) ?? (v.website as string | undefined),
        siteVerified: site?.siteVerified as boolean | undefined,
        booking: site?.booking as boolean | undefined,
        shop: site?.shop as boolean | undefined,
        importantIssues: site?.importantIssues as number | undefined,
        whyChosen: (v.whyChosen as Bilingual) ?? bi("", ""),
        origin: (v.origin as CompetitorCard["origin"]) ?? "official",
        factIds: [f.id, ...(site ? [`competitors.site.${v.cui}`] : [])],
      };
    });
}

/** "Nu e concurentul meu": the card goes, sentences citing it are hidden. */
export function removeRival(report: DeepReport, cui: string): DeepReport {
  const ids = new Set([`peers.rival.${cui}`, `competitors.site.${cui}`]);
  return {
    ...report,
    competitors: report.competitors.filter((c) => c.cui !== cui),
    brief: hideSentences(report.brief, ids),
  };
}

/** "Adaugă un concurent": a card from the public company index; figures at the next run. */
export function addRival(
  report: DeepReport,
  rival: { cui: string; name: string; city?: string; website?: string },
): DeepReport {
  if (rival.cui === report.cui || report.competitors.some((c) => c.cui === rival.cui))
    return report;
  const card: CompetitorCard = {
    cui: rival.cui,
    name: rival.name,
    city: rival.city,
    website: rival.website,
    whyChosen: bi("Added by you", "Adăugat de tine"),
    origin: "owner_added",
    factIds: [],
  };
  return { ...report, competitors: [...report.competitors, card] };
}

/** The journaled rival edits on a report (removed first, then added). */
export function applyRivalEdits(
  report: DeepReport,
  edits: { removed: string[]; added: CompetitorCard[] } | undefined,
): DeepReport {
  if (!edits) return report;
  let out = report;
  for (const cui of edits.removed) out = removeRival(out, cui);
  for (const card of edits.added) out = addRival(out, card);
  return out;
}

/* ------------------------------------------------------------ changes */

export type FactChange = { id: string; label: string; before?: string; after?: string };

/** "Ce s-a schimbat față de raportul din <dată>": facts compared by ID with the previous report. */
export function diffReports(
  prev: DeepReport,
  next: DeepReport,
  lang: "ro" | "en",
  labelOf: (f: Fact) => string,
  max = 8,
): FactChange[] {
  const before = new Map(prev.facts.map((f) => [f.id, f]));
  const changes: FactChange[] = [];
  const skip = /^site\.pages_read|^site\.audit\.issue|^site\.tech|^peers\.band/;
  for (const f of next.facts) {
    if (skip.test(f.id) || f.ephemeral) continue;
    const old = before.get(f.id);
    if (!old) {
      if (/^(money|people|identity|site\.status|risk)/.test(f.id))
        changes.push({ id: f.id, label: labelOf(f), after: f.display[lang] });
      continue;
    }
    if (old.display[lang] !== f.display[lang])
      changes.push({
        id: f.id,
        label: labelOf(f),
        before: old.display[lang],
        after: f.display[lang],
      });
  }
  return changes.slice(0, max);
}

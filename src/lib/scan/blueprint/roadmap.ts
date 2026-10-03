import type {
  AuditFinding,
  AutomationOpportunity,
  Bilingual,
  OnlinePresence,
  RoadmapPhase,
  WebsiteAudit,
} from "@/lib/scan/types";

import { addEstimates, centred, joinList, lcFirst, midOf, ucFirst } from "./format";
import { bi, type PhaseKey, type StrategyKey } from "./model";
import { getTemplate } from "./playbooks";
import { PAIR_TITLES, SHORT_NAMES } from "./short-names";
import type { BusinessTypeDef } from "./taxonomy";
import { websiteWork, type WebsiteWorkItem } from "./website-work";

/*
 * The month-by-month plan: website (m1, or m1–2 with bigger site work) →
 * automations (m2–3) → assistant (m3–4) → growth (m4–6). Each automation sits
 * in the phase of its strategy, so a strategy card, its Gantt row and its
 * phase row describe the same work; all the website work comes from
 * website-work.ts, with its price, in the first phase. Empty phases are left
 * out.
 */

const PHASES: Record<PhaseKey, Pick<RoadmapPhase, "startMonth" | "endMonth" | "stage" | "tag">> = {
  foundation: { startMonth: 1, endMonth: 1, stage: bi("Foundation", "Bazele"), tag: "essential" },
  automation: {
    startMonth: 2,
    endMonth: 3,
    stage: bi("Automation", "Automatizare"),
    tag: "high-impact",
  },
  assistant: {
    startMonth: 3,
    endMonth: 4,
    stage: bi("AI assistant", "Asistent AI"),
    tag: "high-impact",
  },
  growth: { startMonth: 4, endMonth: 6, stage: bi("Growth", "Creștere"), tag: "growth" },
};

export const PHASE_ORDER: PhaseKey[] = ["foundation", "automation", "assistant", "growth"];

/** The phase that delivers each strategy's automations. */
export const PHASE_OF_STRATEGY: Record<StrategyKey, PhaseKey> = {
  automate: "automation",
  assist: "assistant",
  acquire: "growth",
};

const MAX_ITEMS = 6;

export function phaseOf(opportunityId: string): PhaseKey {
  const template = getTemplate(opportunityId);
  return template?.phase ?? PHASE_OF_STRATEGY[template?.strategy ?? "automate"];
}

/** Default month span of a phase (used when the plan has no such phase). */
export function phaseMonths(key: PhaseKey): [number, number] {
  return [PHASES[key].startMonth, PHASES[key].endMonth];
}

export function buildRoadmap(args: {
  type: BusinessTypeDef;
  opportunities: AutomationOpportunity[];
  websiteActions: AuditFinding[];
  audit?: WebsiteAudit;
  presence?: OnlinePresence;
  hasWebsite: boolean;
}): RoadmapPhase[] {
  const work = websiteWork({
    type: args.type,
    websiteActions: args.websiteActions,
    audit: args.audit,
    presence: args.presence,
    hasWebsite: args.hasWebsite,
    opportunityIds: args.opportunities.map((o) => o.id),
  });
  const opps: Record<PhaseKey, AutomationOpportunity[]> = {
    foundation: [],
    automation: [],
    assistant: [],
    growth: [],
  };
  for (const o of args.opportunities) opps[phaseOf(o.id)].push(o);

  const items: Record<PhaseKey, Bilingual[]> = {
    foundation: [],
    automation: [],
    assistant: [],
    growth: [],
  };
  // The website work first (quick items, then the bigger ones), then what each phase builds.
  for (const w of work) items[w.phase].push(w.item);
  for (const key of PHASE_ORDER) items[key].push(...opps[key].map((o) => o.title));
  if (opps.assistant.length) {
    items.assistant.push(
      bi(
        "Your FAQ, prices and tone of voice prepared for the assistant",
        "Întrebările frecvente, prețurile și stilul de comunicare, pregătite pentru asistent",
      ),
      bi(
        "Handover to a person on WhatsApp or email",
        "Preluarea conversației de către un coleg, pe WhatsApp sau e-mail",
      ),
    );
  }

  return PHASE_ORDER.filter((key) => items[key].length > 0).map((key) => {
    const phaseWork = work.filter((w) => w.phase === key);
    const phase: RoadmapPhase = {
      key,
      ...PHASES[key],
      // Bigger website work runs on into month 2.
      ...(phaseWork.some((w) => w.later) ? { endMonth: 2 } : {}),
      stage: { ...PHASES[key].stage },
      title: phaseTitle(key, opps[key], phaseWork),
      items: dedupe(items[key]).slice(0, MAX_ITEMS),
      opportunityIds: opps[key].map((o) => o.id),
    };
    if (phaseWork.length)
      phase.websiteCostRon = addEstimates(phaseWork.map((w) => centred(w.cost)));
    return phase;
  });
}

/**
 * The phase's one name, built from its work: the two automations that win the
 * most hours ("Recenzii și evidența solicitărilor"), or what the website work
 * is ("Site nou și profil Google").
 */
export function phaseTitle(
  key: PhaseKey,
  opportunities: AutomationOpportunity[],
  work: WebsiteWorkItem[],
): Bilingual {
  if (opportunities.length) {
    const top = [...opportunities]
      .sort((a, b) => midOf(b.hoursSavedPerMonth) - midOf(a.hoursSavedPerMonth))
      .slice(0, 2);
    const pair =
      top.length === 2 &&
      PAIR_TITLES.find(({ ids }) => ids.includes(top[0].id) && ids.includes(top[1].id));
    if (pair) return { ...pair.title };
    const names = top.map((o) => SHORT_NAMES[o.id] ?? bi(lcFirst(o.title.en), lcFirst(o.title.ro)));
    return bi(
      ucFirst(
        joinList(
          names.map((n) => n.en),
          "en",
        ),
      ),
      ucFirst(
        joinList(
          names.map((n) => n.ro),
          "ro",
        ),
      ),
    );
  }

  const has = (kind: WebsiteWorkItem["kind"]) => work.some((w) => w.kind === kind);
  const google = has("google-profile");
  if (key === "foundation") {
    if (has("new-site"))
      return google
        ? bi("New website and Google profile", "Site nou și profil Google")
        : bi("New website", "Site nou");
    if (has("rebuild"))
      return google
        ? bi("Website back online and Google profile", "Site repus online și profil Google")
        : bi("Website back online", "Site repus online");
    if (has("local-seo"))
      return has("fix") || has("measurement")
        ? bi("Website fixes and Google visibility", "Remedieri pe site și vizibilitate în Google")
        : bi("Google visibility", "Vizibilitate în Google");
    if (has("fix") || has("measurement"))
      return google
        ? bi("Website fixes and Google profile", "Remedieri pe site și profil Google")
        : bi("Website fixes", "Remedieri pe site");
    if (google) return bi("Google profile", "Profil Google");
    return bi("Kick-off", "Ședința de start");
  }
  // Stored plans from before all website work moved to the first phase.
  if (has("local-seo")) return bi("Google visibility", "Vizibilitate în Google");
  return bi("Website improvements", "Îmbunătățiri pe site");
}

function dedupe(list: Bilingual[]): Bilingual[] {
  const seen = new Set<string>();
  return list.filter((item) => (seen.has(item.en) ? false : (seen.add(item.en), true)));
}

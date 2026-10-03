import type {
  AuditFinding,
  AutomationOpportunity,
  Bilingual,
  OnlinePresence,
  RoadmapPhase,
  WebsiteAudit,
} from "@/lib/scan/types";

import { lcFirst } from "./format";
import { bi, type PhaseKey } from "./model";
import { getTemplate } from "./playbooks";
import { newSiteItem } from "./strategies";
import type { BusinessTypeDef } from "./taxonomy";

/*
 * The month-by-month plan: Foundation (m1) → Automation (m2–3) → AI assistant
 * (m3–4) → Growth (m4–6). Items come from the website findings and the
 * opportunities; empty phases are left out.
 */

const PHASES: Record<
  PhaseKey,
  Pick<RoadmapPhase, "startMonth" | "endMonth" | "stage" | "title" | "tag">
> = {
  foundation: {
    startMonth: 1,
    endMonth: 1,
    stage: bi("Foundation", "Bazele"),
    title: bi("Set up the core systems", "Pune la punct sistemele de bază"),
    tag: "essential",
  },
  automation: {
    startMonth: 2,
    endMonth: 3,
    stage: bi("Automation", "Automatizare"),
    title: bi("Automate daily operations", "Automatizează activitatea zilnică"),
    tag: "high-impact",
  },
  assistant: {
    startMonth: 3,
    endMonth: 4,
    stage: bi("AI assistant", "Asistent AI"),
    title: bi("Launch your AI assistant", "Lansează asistentul AI"),
    tag: "high-impact",
  },
  growth: {
    startMonth: 4,
    endMonth: 6,
    stage: bi("Growth", "Creștere"),
    title: bi("Grow and optimise", "Dezvoltă și optimizează"),
    tag: "growth",
  },
};

const ORDER: PhaseKey[] = ["foundation", "automation", "assistant", "growth"];

/** Words in a finding id → the opportunity that fixes it. */
const SOLVED_BY: Record<string, string> = {
  booking: "online-booking",
  "live-chat": "ai-assistant",
  chat: "ai-assistant",
  review: "review-requests",
  cart: "abandoned-cart",
};
const MAX_ITEMS = 6;

export function phaseOf(opportunityId: string): PhaseKey {
  return getTemplate(opportunityId)?.phase ?? "automation";
}

export function buildRoadmap(args: {
  type: BusinessTypeDef;
  opportunities: AutomationOpportunity[];
  websiteActions: AuditFinding[];
  audit?: WebsiteAudit;
  presence?: OnlinePresence;
  hasWebsite: boolean;
}): RoadmapPhase[] {
  const { audit, presence } = args;
  const items: Record<PhaseKey, Bilingual[]> = {
    foundation: [],
    automation: [],
    assistant: [],
    growth: [],
  };
  const ids: Record<PhaseKey, string[]> = {
    foundation: [],
    automation: [],
    assistant: [],
    growth: [],
  };

  // Foundation: get the website and the basics right first.
  const noSite = !args.hasWebsite || Boolean(audit && !audit.reachable);
  if (noSite) items.foundation.push(newSiteItem(args.type, Boolean(audit && !audit.reachable)));
  // Findings an opportunity already solves (e.g. "no online booking") aren't repeated.
  const selected = new Set(args.opportunities.map((o) => o.id));
  const actions = args.websiteActions.filter(
    (f) => !Object.entries(SOLVED_BY).some(([word, id]) => f.id.includes(word) && selected.has(id)),
  );
  const quick = actions.filter((f) => f.effort === "quick");
  const bigger = actions.filter((f) => f.effort !== "quick");
  for (const finding of quick.slice(0, 3)) items.foundation.push(fixItem(finding));
  if (
    audit?.reachable &&
    !audit.signals.hasAnalytics &&
    !args.websiteActions.some((f) => /analytics|tracking/.test(f.id))
  ) {
    items.foundation.push(
      bi(
        "Analytics and conversion tracking, with cookie consent",
        "Statistici de trafic și măsurarea conversiilor, cu acord pentru cookie-uri",
      ),
    );
  }
  if (presence?.profiles.find((p) => p.platform === "google-business")?.status === "missing") {
    items.foundation.push(
      bi(
        "Claim and complete your Google Business Profile",
        "Revendică și completează profilul Google Business",
      ),
    );
  }

  for (const o of args.opportunities) {
    const phase = phaseOf(o.id);
    items[phase].push(o.title);
    ids[phase].push(o.id);
  }

  if (ids.assistant.length) {
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

  // Growth: the bigger website work and steady optimisation.
  for (const finding of bigger.slice(0, 2)) items.growth.push(fixItem(finding));
  if (audit?.reachable && audit.scores.seo < 70) {
    items.growth.push(
      bi(
        "Local SEO: Google profile, reviews and service pages",
        "SEO local: profil Google, recenzii și pagini de servicii",
      ),
    );
  }

  if (!items.foundation.length) {
    items.foundation.push(
      bi(
        "Kick-off: goals, access and data check",
        "Ședința de start: obiective, accese și verificarea datelor",
      ),
    );
  }

  return ORDER.filter((key) => items[key].length > 0).map((key) => ({
    ...PHASES[key],
    stage: { ...PHASES[key].stage },
    title: { ...PHASES[key].title },
    items: dedupe(items[key]).slice(0, MAX_ITEMS),
    opportunityIds: ids[key],
  }));
}

/** A finding as a to-do: "Fix: slow first screen on mobile". */
function fixItem(finding: AuditFinding): Bilingual {
  return bi(`Fix: ${lcFirst(finding.title.en)}`, `De rezolvat: ${lcFirst(finding.title.ro)}`);
}

function dedupe(list: Bilingual[]): Bilingual[] {
  const seen = new Set<string>();
  return list.filter((item) => (seen.has(item.en) ? false : (seen.add(item.en), true)));
}

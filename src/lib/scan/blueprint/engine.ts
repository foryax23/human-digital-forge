import type {
  AutomationOpportunity,
  Bilingual,
  Blueprint,
  CompanyProfile,
  OnlinePresence,
  ScanTarget,
  SimulationInputs,
  WebsiteAudit,
} from "@/lib/scan/types";

import {
  computeOpportunities,
  computeTotals,
  typicalTeam,
  type OpportunityInput,
} from "./economics";
import { formatNumber, midOf } from "./format";
import { bi, clamp, type SignalContext } from "./model";
import { resolveOpportunity } from "./playbooks";
import type { BusinessTypeDef } from "./taxonomy";
import { HOURS_PER_MONTH } from "./wages";

/* Pieces shared by the builder and the simulation. */

export function hasWebsiteFor(args: {
  audit?: WebsiteAudit;
  company?: CompanyProfile;
  target: ScanTarget;
}): boolean {
  return Boolean(args.audit || args.company?.website || args.target.url);
}

/** A website we could actually read. */
export function hasWorkingWebsite(audit: WebsiteAudit | undefined, hasWebsite: boolean): boolean {
  return hasWebsite && (!audit || audit.reachable);
}

export function signalContext(args: {
  type: BusinessTypeDef;
  audit?: WebsiteAudit;
  presence?: OnlinePresence;
  hasWebsite: boolean;
}): SignalContext {
  const readable = args.audit?.reachable ? args.audit : undefined;
  return {
    typeId: args.type.id,
    consumer: args.type.consumer,
    hasWebsite: args.hasWebsite,
    signals: readable?.signals ?? null,
    technologies: readable?.technologies ?? [],
    presence: args.presence ?? null,
  };
}

/* ---------------------------------------------- AI volume adjustments */

const AI_PREFIX = "AI review:";

/** The assumption line that records an AI volume adjustment (parsed back by the simulation). */
export function aiAdjustNote(factor: number, reason: Bilingual): Bilingual {
  return bi(
    `${AI_PREFIX} volume ×${formatNumber(factor, "en", 2)} (${reason.en})`,
    `Ajustare AI: volum ×${formatNumber(factor, "ro", 2)} (${reason.ro})`,
  );
}

export function readAiAdjust(
  opportunity: AutomationOpportunity,
): { factor: number; note: Bilingual } | null {
  const note = opportunity.assumptions.find((line) => line.en.startsWith(AI_PREFIX));
  const match = note?.en.match(/×(\d+(?:\.\d+)?)/);
  return note && match ? { factor: clamp(Number(match[1]), 0.5, 1.5), note } : null;
}

export type Adjustments = Map<string, { factor: number; note?: Bilingual }>;

/** Opportunities and totals for a set of catalogue ids at the given inputs. */
export function computeMoney(args: {
  type: BusinessTypeDef;
  ids: string[];
  inputs: SimulationInputs;
  hourlyIsIns: boolean;
  adjustments?: Adjustments;
}) {
  const items: OpportunityInput[] = [];
  for (const id of args.ids) {
    const resolved = resolveOpportunity(args.type.id, id);
    if (!resolved) continue;
    const adjust = args.adjustments?.get(id);
    items.push({ resolved, adjust: adjust?.factor ?? 1, adjustNote: adjust?.note });
  }
  const { opportunities, cappedBy } = computeOpportunities(items, {
    inputs: args.inputs,
    typical: typicalTeam(args.type),
    hourlyIsIns: args.hourlyIsIns,
  });
  return { opportunities, totals: computeTotals(opportunities), cappedBy };
}

/* ------------------------------------------------------------- scores */

export function websiteHealthOf(audit: WebsiteAudit | undefined): number {
  return audit?.reachable ? Math.round(audit.scores.overall) : 0;
}

const CHANNELS = ["google-business", "facebook", "instagram", "linkedin", "youtube", "tiktok"];

/** 0–100 blend of website health (45 %), channels (25 %) and digital tools (30 %). */
export function digitalMaturityOf(audit: WebsiteAudit | undefined, presence?: OnlinePresence) {
  const website = websiteHealthOf(audit);
  const s = audit?.reachable ? audit.signals : undefined;

  let channels = 0;
  if (presence) {
    for (const profile of presence.profiles) {
      if (!CHANNELS.includes(profile.platform)) continue;
      channels += profile.status === "active" ? 1 : profile.status === "detected" ? 0.6 : 0;
    }
    if (presence.googleRating) channels += 0.5;
  } else if (s) {
    channels = s.socialLinks.length * 0.6;
  }
  const channelScore = Math.min(1, channels / 3) * 100;

  const tools = s
    ? [
        s.hasAnalytics,
        s.hasOnlineBooking || s.hasEcommerce,
        s.hasLiveChat || s.hasWhatsApp,
        s.hasContactForm,
        s.hasNewsletter,
        s.hasStructuredData,
        s.hasCookieConsent,
      ].filter(Boolean).length / 7
    : 0;

  return Math.round(website * 0.45 + channelScore * 0.25 + tools * 100 * 0.3);
}

/** How much of the team's time the plan frees: 8 % of working hours or more = 100. */
export function automationPotentialOf(totals: Blueprint["totals"], teamSize: number) {
  const capacity = Math.max(1, teamSize) * HOURS_PER_MONTH * 0.08;
  const ratio = Math.min(1, midOf(totals.hoursSavedPerMonth) / capacity);
  return Math.round(clamp(25 + 75 * ratio, 0, 100));
}

import {
  displayPlan,
  kpiCells,
  type DisplayPlan,
  type Horizon,
} from "@/lib/scan/blueprint/display";
import { compareFindings } from "@/lib/scan/blueprint/strategies";
import type {
  AuditFinding,
  Blueprint,
  Lang,
  PresencePlatform,
  PresenceProfile,
  Severity,
  StrategyOption,
} from "@/lib/scan/types";

import type { PdfAssets } from "./assets";
import { displayHost, NBSP, pick, tr, withCommaBelow } from "./format";
import type { StatCell } from "./layout";
import { INK, type StatusTone } from "./theme";

/** Everything a page needs besides the blueprint itself. */
export type PdfContext = {
  blueprint: Blueprint;
  /**
   * Every displayed figure, from the same selector as the scan screens
   * (displayPlan), so the PDF prints exactly the numbers of the web results.
   */
  plan: DisplayPlan;
  /** The chart window the results screen opens on (the smallest that shows the break-even). */
  horizon: Horizon;
  lang: Lang;
  t: (en: string, ro: string) => string;
  /** Company or site name used in headers and the cover. */
  name: string;
  /** Link to the live, animated report. */
  reportUrl: string;
  /** Brand images (absolute URLs in the browser, file paths in Node). */
  assets: PdfAssets;
  /** The demo blueprint behind /scan?demo= (labelled "Date de exemplu"). */
  sample: boolean;
  /** Block heights from a first render (see measure.tsx); unused while no break is chosen by hand. */
  measured?: PdfMeasurements;
};

/** Heights in points of blocks whose page breaks we would choose ourselves. */
export type PdfMeasurements = Record<string, number | number[]>;

export function createContext(
  source: Blueprint,
  lang: Lang,
  reportUrl: string,
  assets: PdfAssets,
  measured?: PdfMeasurements,
): PdfContext {
  const blueprint = withCommaBelow(source);
  // The figures come from the blueprint as stored, exactly as the screen reads them.
  const plan = displayPlan(source);
  // The same choice as the results screen: the default window, if the projection reaches it.
  const covered = Math.max(0, ...plan.series.map((p) => p.month));
  const horizons = ([6, 12, 24] as const).filter((h) => h === 6 || covered >= h);
  const horizon: Horizon = horizons.includes(plan.defaultHorizon)
    ? plan.defaultHorizon
    : horizons[horizons.length - 1];
  return {
    blueprint,
    plan: withCommaBelow(plan),
    horizon,
    lang,
    t: tr(lang),
    name: subjectName(blueprint),
    reportUrl,
    assets,
    sample: blueprint.id.startsWith("demo-"),
    measured,
  };
}

/** Company display name, else the scanned host, else the search text. */
export function subjectName(blueprint: Blueprint): string {
  return (
    blueprint.company?.displayName ||
    displayHost(blueprint.audit?.finalUrl || blueprint.audit?.url || blueprint.target.url) ||
    blueprint.target.query ||
    "Your business"
  );
}

/** Months the plan spans (6 for the usual plan). */
export function planSpan(plan: DisplayPlan): number {
  return Math.max(6, ...plan.phases.map((p) => p.months[1]));
}

/** True when the plan has something to chart: automations and a projection. */
export function hasImpact(ctx: PdfContext): boolean {
  return ctx.blueprint.opportunities.length > 0 && ctx.plan.series.length >= 2;
}

/** The KPI cells of a chart window, value and unit split as on the screen. */
export function kpiStat(ctx: PdfContext): StatCell[] {
  const { plan, horizon, lang } = ctx;
  return kpiCells(plan, horizon).map((cell) => {
    const value = pick(cell.value, lang);
    const parts = value.split(NBSP);
    const unit = parts.length > 1 && /^(lei|RON)$/.test(parts[parts.length - 1]);
    return {
      label: pick(cell.label, lang),
      value: unit ? parts.slice(0, -1).join(NBSP) : value,
      unit: unit ? parts[parts.length - 1] : undefined,
      note: cell.note,
      sub: pick(cell.sub, lang),
      swatch:
        cell.key === "value"
          ? { color: INK.violet }
          : cell.key === "cost"
            ? { color: INK.strong, opacity: 0.45 }
            : undefined,
    };
  });
}

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

/** Website findings worth doing first, in the scan's order (compareFindings). */
export function priorityFindings(blueprint: Blueprint): AuditFinding[] {
  const source = blueprint.websiteActions.length
    ? blueprint.websiteActions
    : (blueprint.audit?.findings ?? []);
  return [...source].sort(compareFindings);
}

export type PriorityLevel = "high" | "medium" | "low";

/** Severity as the three-bar priority signal (critical reads "Urgent"). */
export const PRIORITY_OF: Record<Severity, PriorityLevel> = {
  critical: "high",
  high: "high",
  medium: "medium",
  low: "low",
};

/** "Prioritate mare / medie / mică", or "Urgent" for a critical finding. */
export function priorityLabel(severity: Severity, lang: Lang): string {
  const t = tr(lang);
  if (severity === "critical") return t("Urgent", "Urgent");
  return {
    high: t("High priority", "Prioritate mare"),
    medium: t("Medium priority", "Prioritate medie"),
    low: t("Low priority", "Prioritate mică"),
  }[PRIORITY_OF[severity]];
}

export function effortLabel(effort: AuditFinding["effort"], lang: Lang): string {
  const t = tr(lang);
  return {
    quick: t("little effort", "efort mic"),
    medium: t("medium effort", "efort mediu"),
    project: t("a lot of effort", "efort mare"),
  }[effort];
}

/** One word set for every 0–100 score, on the scan and in the PDF: Bun / Acceptabil / Slab. */
export function scoreTier(score: number, lang: Lang): { label: string; tone: StatusTone } {
  const t = tr(lang);
  if (score >= 75) return { label: t("Good", "Bun"), tone: "ok" };
  if (score >= 50) return { label: t("Fair", "Acceptabil"), tone: "warn" };
  return { label: t("Poor", "Slab"), tone: "bad" };
}

/** Channel names as a Romanian owner says them (brand names stay as they are). */
export function platformLabel(platform: PresencePlatform, lang: Lang): string {
  const t = tr(lang);
  return {
    website: t("Website", "Site"),
    "google-business": t("Google Business Profile", "Profil Google Business"),
    facebook: "Facebook",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    tiktok: "TikTok",
    x: "X",
  }[platform];
}

/** A channel as the report shows it; "unchecked" when we couldn't look. */
export type ChannelView = Omit<PresenceProfile, "status"> & {
  status: PresenceProfile["status"] | "unchecked";
};

/** Sectors that sell mostly to other businesses: LinkedIn matters there, Instagram less. */
const B2B_SECTORS = new Set([
  "Professional services",
  "Technology",
  "Industry",
  "Trade",
  "Construction",
  "Transport",
  "Real estate",
]);

const SOCIAL_HOSTS: Partial<Record<PresencePlatform, RegExp>> = {
  facebook: /facebook\.com|fb\.com/i,
  instagram: /instagram\.com/i,
  linkedin: /linkedin\.com/i,
  youtube: /youtube\.com|youtu\.be/i,
  tiktok: /tiktok\.com/i,
  x: /(^|\/\/|\.)(x|twitter)\.com/i,
};

/**
 * The channels worth a row, as on the overview screen: Google and Facebook
 * always, Instagram for businesses that sell to people, LinkedIn for those
 * that sell to firms; any other platform only when we found it.
 */
export function channelViews(blueprint: Blueprint): ChannelView[] {
  const { presence, audit } = blueprint;
  const relevant: PresencePlatform[] = [
    "google-business",
    "facebook",
    B2B_SECTORS.has(blueprint.businessType.sector.en) ? "linkedin" : "instagram",
  ];
  const links = audit?.signals.socialLinks ?? [];
  const views: ChannelView[] = relevant.map((platform) => {
    const found = presence?.profiles.find((p) => p.platform === platform);
    if (found) return found;
    if (platform === "google-business" && presence?.googleRating) {
      return { platform, status: "active" };
    }
    if (presence) return { platform, status: "missing" };
    // No profile search ran: fall back to the links on the site itself.
    const pattern = SOCIAL_HOSTS[platform];
    const link = pattern ? links.find((url) => pattern.test(url)) : undefined;
    if (link) return { platform, status: "detected", url: link };
    return { platform, status: platform === "google-business" || !audit ? "unchecked" : "missing" };
  });
  const shown = new Set<PresencePlatform>(relevant);
  for (const profile of presence?.profiles ?? []) {
    if (shown.has(profile.platform) || profile.platform === "website") continue;
    if (profile.status === "missing") continue;
    shown.add(profile.platform);
    views.push(profile);
  }
  if (!presence) {
    for (const [platform, pattern] of Object.entries(SOCIAL_HOSTS) as Array<
      [PresencePlatform, RegExp]
    >) {
      if (shown.has(platform)) continue;
      const link = links.find((url) => pattern.test(url));
      if (!link) continue;
      shown.add(platform);
      views.push({ platform, status: "detected", url: link });
    }
  }
  return views;
}

/** The category of a strategy: what kind of work it is ("Automatizare", "Site"). */
export function strategyCategory(id: string, hasSitePhase: boolean, lang: Lang): string {
  const t = tr(lang);
  if (id === "automate") return t("Automation", "Automatizare");
  if (id === "assist") return t("AI assistant", "Asistent AI");
  if (id === "acquire") return hasSitePhase ? t("Website", "Site") : t("Reviews", "Recenzii");
  return t("Direction", "Direcție");
}

export function strategyOption(blueprint: Blueprint, id: string): StrategyOption | undefined {
  return blueprint.strategies.find((s) => s.id === id);
}

export { pick };

/**
 * True when strategy and plan together fit one page comfortably (one
 * direction and a short plan without a projection), so they share a page.
 */
export function isLightPlan(ctx: PdfContext): boolean {
  return ctx.plan.strategies.length <= 1 && ctx.plan.phases.length <= 2 && !hasImpact(ctx);
}

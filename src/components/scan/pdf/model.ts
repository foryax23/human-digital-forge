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
import { displayHost, pick, tr, withCommaBelow } from "./format";
import type { IconName } from "./icons";

/** Everything a page needs besides the blueprint itself. */
export type PdfContext = {
  blueprint: Blueprint;
  lang: Lang;
  t: (en: string, ro: string) => string;
  /** Company or site name used in headers and the cover. */
  name: string;
  /** Link to the live, animated report. */
  reportUrl: string;
  /** Brand images (absolute URLs in the browser, file paths in Node). */
  assets: PdfAssets;
  /** Sections in print order, without the ones left out for lack of data. */
  sections: SectionKey[];
  /** Running number of a section (1, 2…), skipping sections left out. */
  section: (key: SectionKey) => number;
  /** Block heights from a first render (see measure.tsx); estimates stand in without them. */
  measured?: PdfMeasurements;
};

/** Heights in points of the blocks whose page breaks we choose ourselves. */
export type PdfMeasurements = {
  /** Section title and chart row above the first opportunity card. */
  opportunityHead: number;
  /** Each opportunity card, including its bottom margin. */
  opportunityCards: number[];
  /** The totals table, including its top margin. */
  opportunityTotals: number;
};

export type SectionKey =
  | "summary"
  | "snapshot"
  | "audit"
  | "opportunities"
  | "strategy"
  | "roadmap"
  | "offer"
  | "methodology";

/** Section names, used by the section eyebrows and the summary's contents strip. */
export function sectionName(key: SectionKey, lang: Lang): string {
  const t = tr(lang);
  return {
    summary: t("Executive summary", "Rezumat"),
    snapshot: t("Company snapshot", "Profilul companiei"),
    audit: t("Website audit", "Auditul site-ului"),
    opportunities: t("Automation opportunities", "Ce poți automatiza"),
    strategy: t("Strategy options", "Direcții strategice"),
    roadmap: t("Roadmap", "Plan de implementare"),
    offer: t("Your Vortex offer", "Oferta Vortex pentru tine"),
    methodology: t("Methodology", "Metodologie"),
  }[key];
}

export function createContext(
  source: Blueprint,
  lang: Lang,
  reportUrl: string,
  assets: PdfAssets,
  measured?: PdfMeasurements,
): PdfContext {
  const blueprint = withCommaBelow(source);
  const order: SectionKey[] = [
    "summary",
    "snapshot",
    ...(blueprint.audit ? (["audit"] as const) : []),
    ...(blueprint.opportunities.length ? (["opportunities"] as const) : []),
    "strategy",
    "roadmap",
    "offer",
    "methodology",
  ];
  return {
    blueprint,
    lang,
    t: tr(lang),
    name: subjectName(blueprint),
    reportUrl,
    assets,
    sections: order,
    section: (key) => order.indexOf(key) + 1,
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

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

/** Website findings worth doing first, most severe first. */
export function priorityFindings(blueprint: Blueprint): AuditFinding[] {
  const source = blueprint.websiteActions.length
    ? blueprint.websiteActions
    : (blueprint.audit?.findings ?? []);
  return [...source].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}

export function severityCounts(findings: AuditFinding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

export function severityLabel(severity: Severity, lang: Lang): string {
  const t = tr(lang);
  return {
    critical: t("Critical", "Critic"),
    high: t("High", "Ridicat"),
    medium: t("Medium", "Mediu"),
    low: t("Low", "Scăzut"),
  }[severity];
}

export function categoryLabel(category: AuditFinding["category"], lang: Lang): string {
  const t = tr(lang);
  return {
    performance: t("Performance", "Performanță"),
    seo: "SEO",
    accessibility: t("Accessibility", "Accesibilitate"),
    security: t("Security & privacy", "Securitate și date personale"),
    conversion: t("Conversion", "Conversie"),
    content: t("Content", "Conținut"),
    technology: t("Technology", "Tehnologie"),
  }[category];
}

export function effortLabel(effort: AuditFinding["effort"], lang: Lang): string {
  const t = tr(lang);
  return {
    quick: t("Quick fix", "Rezolvare rapidă"),
    medium: t("Medium effort", "Efort mediu"),
    project: t("Larger project", "Proiect separat"),
  }[effort];
}

/** Channel names are brand names, the same in both languages. */
export const PLATFORMS: Record<PresencePlatform, { label: string; icon: IconName }> = {
  website: { label: "Website", icon: "globe" },
  "google-business": { label: "Google Business", icon: "mapPinned" },
  facebook: { label: "Facebook", icon: "facebook" },
  instagram: { label: "Instagram", icon: "instagram" },
  linkedin: { label: "LinkedIn", icon: "linkedin" },
  youtube: { label: "YouTube", icon: "youtube" },
  tiktok: { label: "TikTok", icon: "music" },
  x: { label: "X (Twitter)", icon: "twitter" },
};

/** Channel name for labels: "Website" reads "Site" in Romanian, the rest are brand names. */
export function platformLabel(platform: PresencePlatform, lang: Lang): string {
  return platform === "website" ? tr(lang)("Website", "Site") : PLATFORMS[platform].label;
}

/** Presence channels in a stable order; missing core channels are listed so gaps show. */
export function presenceProfiles(blueprint: Blueprint): PresenceProfile[] {
  const order: PresencePlatform[] = [
    "website",
    "google-business",
    "facebook",
    "instagram",
    "linkedin",
    "youtube",
    "tiktok",
    "x",
  ];
  const found = blueprint.presence?.profiles ?? [];
  return [...found].sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform));
}

export function recommendedStrategy(blueprint: Blueprint): StrategyOption | undefined {
  return blueprint.strategies.find((s) => s.recommended) ?? blueprint.strategies[0];
}

export function strategyIcon(strategy: StrategyOption): IconName {
  if (strategy.id === "acquire") return "target";
  if (strategy.id === "automate") return "workflow";
  if (strategy.id === "assist") return "bot";
  return "compass";
}

/** Score band wording; automation potential reads "higher = more to gain". */
export function scoreBand(
  kind: "maturity" | "health" | "automation",
  value: number,
  lang: Lang,
): string {
  const t = tr(lang);
  if (kind === "automation") {
    if (value >= 70) return t("High potential", "Potențial ridicat");
    if (value >= 40) return t("Moderate potential", "Potențial moderat");
    return t("Limited potential", "Potențial limitat");
  }
  if (value >= 70) return t("Strong", "Bine");
  if (value >= 40) return t("Developing", "Mediu");
  return t("Needs attention", "Necesită atenție");
}

export function implementationLevel(level: "low" | "medium" | "high"): 1 | 2 | 3 {
  return level === "low" ? 1 : level === "medium" ? 2 : 3;
}

export function levelLabel(level: "low" | "medium" | "high", lang: Lang): string {
  const t = tr(lang);
  return { low: t("Low", "Scăzut"), medium: t("Medium", "Mediu"), high: t("High", "Ridicat") }[
    level
  ];
}

/** Complexity is feminine in Romanian: "complexitate scăzută / medie / ridicată". */
export function complexityLabel(level: "low" | "medium" | "high", lang: Lang): string {
  const t = tr(lang);
  return {
    low: t("Low", "Scăzută"),
    medium: t("Medium", "Medie"),
    high: t("High", "Ridicată"),
  }[level];
}

export function tagLabel(tag: "essential" | "high-impact" | "growth", lang: Lang): string {
  const t = tr(lang);
  return {
    essential: t("Essential", "Esențial"),
    "high-impact": t("High impact", "Impact mare"),
    growth: t("Growth", "Creștere"),
  }[tag];
}

/** Months label: "Month 1" / "Months 2–3". */
export function monthsLabel(start: number, end: number, lang: Lang): string {
  const t = tr(lang);
  return start === end
    ? `${t("Month", "Luna")} ${start}`
    : `${t("Months", "Lunile")} ${start}–${end}`;
}

export { pick };

/**
 * True when strategy and roadmap together fit one page comfortably (one
 * direction, or a short roadmap without a projection), so they share a page.
 */
export function isLightPlan(blueprint: Blueprint): boolean {
  const { strategies, roadmap, projection } = blueprint;
  return strategies.length <= 1 && roadmap.length <= 2 && projection.length < 2;
}

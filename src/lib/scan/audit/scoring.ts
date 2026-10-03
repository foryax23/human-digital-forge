import type { AuditCategory, AuditFinding, Severity, WebsiteAudit } from "@/lib/scan/types";

/**
 * Website scores, 0–100 per area.
 *
 *   area score = round(100 × Π (1 − w(severity)))   over the area's findings
 *   w: critical 0.40 · high 0.22 · medium 0.10 · low 0.04
 *
 * Multiplying keeps every extra issue meaningful without collapsing to 0
 * after a handful of minor ones. Areas: performance ← performance;
 * seo ← seo + content; security ← security + technology; accessibility and
 * conversion map 1:1. When PageSpeed is available its Lighthouse
 * performance score replaces ours. Without PageSpeed, performance is our
 * own estimate from the performance checks.
 *
 *   overall = weighted mean: conversion 0.25, seo 0.20, security 0.20,
 *             performance 0.20, accessibility 0.15
 *   (weights renormalised when an area has no score).
 */

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 0.4,
  high: 0.22,
  medium: 0.1,
  low: 0.04,
};

type ScoreArea = "performance" | "seo" | "accessibility" | "security" | "conversion";

const AREA_OF: Record<AuditCategory, ScoreArea> = {
  performance: "performance",
  seo: "seo",
  content: "seo",
  accessibility: "accessibility",
  security: "security",
  technology: "security",
  conversion: "conversion",
};

const OVERALL_WEIGHTS: Record<ScoreArea, number> = {
  conversion: 0.25,
  seo: 0.2,
  security: 0.2,
  performance: 0.2,
  accessibility: 0.15,
};

function areaScore(findings: AuditFinding[], area: ScoreArea): number {
  const factor = findings
    .filter((finding) => AREA_OF[finding.category] === area)
    .reduce((product, finding) => product * (1 - SEVERITY_WEIGHT[finding.severity]), 1);
  return Math.round(100 * factor);
}

export function overallScore(
  scores: Omit<WebsiteAudit["scores"], "overall">,
  exclude: ScoreArea[] = [],
): number {
  let total = 0;
  let weight = 0;
  for (const [area, w] of Object.entries(OVERALL_WEIGHTS) as Array<[ScoreArea, number]>) {
    const value = scores[area];
    if (typeof value !== "number" || exclude.includes(area)) continue;
    total += value * w;
    weight += w;
  }
  return weight ? Math.round(total / weight) : 0;
}

/**
 * Scores from findings, with Lighthouse numbers when PageSpeed ran. On a
 * client-rendered site our markup checks can't see conversion or
 * accessibility details, so those areas are left out of the overall score
 * (accessibility comes back in from Lighthouse, which renders the page).
 */
export function scoreAudit(
  findings: AuditFinding[],
  lighthouse?: { performance: number; accessibility: number },
): WebsiteAudit["scores"] {
  const clientRendered = findings.some((finding) => finding.id === "seo.client-rendered");
  const scores = {
    performance: lighthouse
      ? Math.round(lighthouse.performance)
      : areaScore(findings, "performance"),
    seo: areaScore(findings, "seo"),
    accessibility:
      clientRendered && lighthouse
        ? Math.round(lighthouse.accessibility)
        : areaScore(findings, "accessibility"),
    security: areaScore(findings, "security"),
    conversion: areaScore(findings, "conversion"),
  };
  const unmeasured: ScoreArea[] = clientRendered
    ? lighthouse
      ? ["conversion"]
      : ["conversion", "accessibility"]
    : [];
  return { ...scores, overall: overallScore(scores, unmeasured) };
}

/** All-zero scores for a site we couldn't load at all. */
export const UNREACHABLE_SCORES: WebsiteAudit["scores"] = {
  seo: 0,
  accessibility: 0,
  security: 0,
  conversion: 0,
  overall: 0,
};

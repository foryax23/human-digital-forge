import process from "node:process";

import { fetchRobots, normalizeInputUrl, urlBlockReason } from "@/lib/scan/net.server";
import type { PageSpeedResult } from "@/lib/scan/types";

/**
 * Lighthouse scores, lab Core Web Vitals, real-user (CrUX) data and the
 * final screenshot from the PageSpeed Insights API. Works without a key
 * (shared quota); PAGESPEED_API_KEY raises the quota. Null on any failure.
 * Lighthouse ignores robots.txt, so a site that tells VortexScan to stay away
 * is not sent to it either.
 */

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const TIMEOUT_MS = 50_000;

type LighthouseAudit = { numericValue?: number; details?: { data?: string } };
type PsiResponse = {
  lighthouseResult?: {
    categories?: Record<string, { score: number | null } | undefined>;
    audits?: Record<string, LighthouseAudit | undefined>;
  };
  loadingExperience?: {
    metrics?: Record<string, { percentile?: number } | undefined>;
  };
};

const score = (value: number | null | undefined) =>
  typeof value === "number" ? Math.round(value * 100) : 0;

export async function runPageSpeed(
  url: string,
  strategy: "mobile" | "desktop" = "mobile",
): Promise<(PageSpeedResult & { screenshot?: string }) | null> {
  if (urlBlockReason(url)) return null;
  const origin = normalizeInputUrl(url)?.origin;
  if (!origin || (await fetchRobots(origin)).optsOut) return null;

  const params = new URLSearchParams({ url, strategy });
  for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
    params.append("category", category);
  }
  const key = process.env.PAGESPEED_API_KEY;
  if (key) params.set("key", key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${ENDPOINT}?${params}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      console.warn(`[scan] PageSpeed ${response.status} for ${url}`);
      return null;
    }
    const data = (await response.json()) as PsiResponse;
    const lighthouse = data.lighthouseResult;
    if (!lighthouse?.categories?.performance) return null;

    const categories = lighthouse.categories;
    const audits = lighthouse.audits ?? {};
    const field = data.loadingExperience?.metrics ?? {};
    const screenshot = audits["final-screenshot"]?.details?.data;

    return {
      strategy,
      performance: score(categories.performance?.score),
      accessibility: score(categories.accessibility?.score),
      bestPractices: score(categories["best-practices"]?.score),
      seo: score(categories.seo?.score),
      lcpMs: audits["largest-contentful-paint"]?.numericValue,
      cls: audits["cumulative-layout-shift"]?.numericValue,
      tbtMs: audits["total-blocking-time"]?.numericValue,
      fieldLcpMs: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile,
      fieldInpMs: field.INTERACTION_TO_NEXT_PAINT?.percentile,
      screenshot: screenshot?.startsWith("data:image/") ? screenshot : undefined,
    };
  } catch (error) {
    console.warn(`[scan] PageSpeed failed for ${url}`, (error as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

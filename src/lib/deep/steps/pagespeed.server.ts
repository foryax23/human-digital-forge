import type { StepResult } from "../contracts";
import type { StepEnv } from "../env.server";
import { bi, formatDecimal } from "../parse/format";

import { CRAWLABLE, siteState } from "./audit.server";
import { fact, gap, isoDay, type StepDraft } from "./common.server";

/*
 * Step 7, "pagespeed" (plan A3; exempt budget ≤ 50 s): Google's speed test on
 * a phone for the verified site, as a consequence sentence ("se încarcă în
 * 4,2 s pe telefon"). Skipped when there is no verified site or when Google
 * does not answer.
 */

export async function runPageSpeed(env: StepEnv, input: { site: StepResult }): Promise<StepDraft> {
  const today = isoDay(env.now());
  const { status, url } = siteState(input.site);
  if (!url || !CRAWLABLE.includes(status) || !env.sources.pagespeed) {
    return { status: "skipped", facts: [], gaps: [] };
  }
  const result = await env.pagespeed(url);
  if (!result) {
    return {
      status: "skipped",
      facts: [],
      gaps: [
        gap(
          "site",
          bi("Speed on a phone", "Viteza pe telefon"),
          bi("Google's speed test did not answer", "Testul de viteză Google nu a răspuns"),
          today,
          "https://pagespeed.web.dev",
        ),
      ],
    };
  }
  const seconds = result.lcpMs ? result.lcpMs / 1000 : undefined;
  const shown = seconds !== undefined ? formatDecimal(seconds, "ro", 1) : undefined;
  const shownEn = seconds !== undefined ? formatDecimal(seconds, "en", 1) : undefined;
  return {
    status: "done",
    facts: [
      fact({
        id: "site.speed.mobile",
        section: "site",
        predicate: "site.speed.mobile",
        value: { performance: result.performance, lcpMs: result.lcpMs, cls: result.clsScore },
        display: shown
          ? bi(
              `The main content appears after ${shownEn} s on a phone (score ${result.performance} of 100)`,
              `Conținutul principal apare după ${shown} s pe telefon (scor ${result.performance} din 100)`,
            )
          : bi(
              `Score ${result.performance} of 100 on a phone`,
              `Scor ${result.performance} din 100 pe telefon`,
            ),
        source: "pagespeed",
        asOf: today,
        confidence: "confirmat",
        method: "api",
        evidence: { url: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}` },
      }),
    ],
    gaps: [],
  };
}

/**
 * Runs the Vortex Scan website audit from the command line (Node).
 *
 *   npx tsx scripts/scan/try-audit.ts <url> [<url> …] [--json] [--pagespeed] [--presence]
 *   npx tsx scripts/scan/try-audit.ts --discover "Company SRL" [--cui 123] [--city Cluj] [--known x.ro]
 *   npx tsx scripts/scan/try-audit.ts --ssrf
 *
 * Optional keys are read from the environment: PAGESPEED_API_KEY,
 * GOOGLE_PLACES_API_KEY, BRAVE_SEARCH_API_KEY.
 */
import { auditWebsite } from "../../src/lib/scan/audit/index.server";
import { CHECK_COUNT } from "../../src/lib/scan/audit/checks";
import { applyPageSpeed } from "../../src/lib/scan/audit/merge";
import { runPageSpeed } from "../../src/lib/scan/audit/pagespeed.server";
import { discoverWebsite } from "../../src/lib/scan/discover.server";
import { safeFetch, urlBlockReason } from "../../src/lib/scan/net.server";
import { detectPresence } from "../../src/lib/scan/presence.server";
import type { WebsiteAudit } from "../../src/lib/scan/types";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const valued = new Set(["discover", "cui", "city", "known"]);
const urls = args.filter(
  (arg, i) => !arg.startsWith("--") && !(i > 0 && valued.has(args[i - 1].replace(/^--/, ""))),
);

const pad = (value: string | number, width: number) => String(value).padEnd(width);

function printAudit(audit: WebsiteAudit, ms: number) {
  const { scores, signals } = audit;
  console.log(`\n=== ${audit.url} → ${audit.finalUrl}`);
  console.log(
    `reachable=${audit.reachable} status=${audit.statusCode ?? "-"} https=${audit.https} ttfb=${audit.responseMs ?? "-"}ms total=${ms}ms pages=${audit.pages.length}`,
  );
  for (const page of audit.pages)
    console.log(
      `  page ${page.status} ${page.url}${page.title ? ` — ${page.title.slice(0, 60)}` : ""}`,
    );
  console.log(
    `scores: overall ${scores.overall} · perf ${scores.performance ?? "-"} · seo ${scores.seo} · a11y ${scores.accessibility} · security ${scores.security} · conversion ${scores.conversion}`,
  );
  console.log(
    `tech: ${audit.technologies.map((t) => `${t.name} (${t.category} ${t.confidence})`).join(", ") || "—"}`,
  );
  const on = Object.entries(signals)
    .filter(([, value]) => value === true)
    .map(([key]) => key.replace(/^has/, ""));
  console.log(
    `signals: ${on.join(", ") || "—"} | langs ${signals.languages.join(",") || "—"} | cui ${signals.cuiOnSite ?? "—"}`,
  );
  console.log(`social: ${signals.socialLinks.join(" ") || "—"}`);
  console.log(`findings (${audit.findings.length}):`);
  for (const finding of audit.findings) {
    console.log(
      `  ${pad(finding.severity, 8)} ${pad(finding.id, 40)} ${finding.title.en}${finding.evidence ? `  [${finding.evidence.slice(0, 70)}]` : ""}`,
    );
  }
}

async function ssrf() {
  const targets = [
    "http://localhost",
    "http://localhost:5184",
    "http://127.0.0.1",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1",
    "http://192.168.1.1",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://2130706433/",
    "http://metadata.google.internal/",
    "http://localtest.me/",
  ];
  console.log("SSRF guard:");
  for (const target of targets) {
    const lexical = urlBlockReason(target);
    let fetched = "";
    try {
      const result = await safeFetch(target, { timeoutMs: 3000 });
      fetched = `FETCHED (status ${result.status}) ← NOT REFUSED`;
    } catch (error) {
      fetched = `refused: ${(error as { code?: string }).code} — ${(error as Error).message}`;
    }
    console.log(`  ${pad(target, 44)} lexical=${lexical ?? "ok"} | ${fetched}`);
  }
  const audit = await auditWebsite({ url: "http://169.254.169.254" });
  console.log(
    `  auditWebsite(169.254.169.254) → reachable=${audit.reachable}, finding=${audit.findings[0]?.id}`,
  );
}

async function main() {
  if (flag("ssrf")) return ssrf();
  const discoverName = option("discover");
  if (discoverName) {
    const started = Date.now();
    const result = await discoverWebsite({
      name: discoverName,
      cui: option("cui"),
      city: option("city"),
      knownWebsite: option("known"),
    });
    console.log(`discover (${Date.now() - started} ms):`, JSON.stringify(result, null, 2));
    return;
  }
  if (!urls.length) {
    console.error(
      "Usage: npx tsx scripts/scan/try-audit.ts <url> [--json] [--pagespeed] [--presence]",
    );
    process.exit(1);
  }
  console.log(`${CHECK_COUNT} deterministic checks loaded`);
  for (const url of urls) {
    const started = Date.now();
    const [audit, pagespeed] = await Promise.all([
      auditWebsite({ url, cui: option("cui") }),
      flag("pagespeed") ? runPageSpeed(url, "mobile") : Promise.resolve(null),
    ]);
    const merged = applyPageSpeed(audit, pagespeed);
    const elapsed = Date.now() - started;
    if (flag("json")) {
      console.log(
        JSON.stringify(
          { ...merged, screenshot: merged.screenshot ? "[data uri]" : undefined },
          null,
          2,
        ),
      );
    } else {
      printAudit(merged, elapsed);
      if (pagespeed) {
        const { screenshot, ...rest } = pagespeed;
        console.log(
          `pagespeed: ${JSON.stringify(rest)} screenshot=${screenshot ? `${Math.round(screenshot.length / 1024)} KB` : "none"}`,
        );
      } else if (flag("pagespeed")) console.log("pagespeed: unavailable (quota or error)");
    }
    if (flag("presence")) {
      const presenceStarted = Date.now();
      const presence = await detectPresence({
        name: merged.meta.title ?? merged.host,
        socialLinks: merged.signals.socialLinks,
        website: merged.finalUrl,
      });
      console.log(`presence (${Date.now() - presenceStarted} ms):`);
      for (const profile of presence.profiles) {
        console.log(
          `  ${pad(profile.platform, 16)} ${pad(profile.status, 9)} ${profile.url ?? ""}${profile.metric ? ` (${profile.metric.label.en}: ${profile.metric.value})` : ""}`,
        );
      }
      if (presence.googleRating)
        console.log(`  google rating: ${JSON.stringify(presence.googleRating)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

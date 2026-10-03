/**
 * Builds Vortex Scan blueprints for six hand-made businesses, runs the
 * simulation with changed inputs and checks that the numbers are plausible
 * for Romanian SMEs and trace back to stated assumptions.
 *
 *   npx tsx scripts/scan/try-blueprint.ts            # summary for all fixtures
 *   npx tsx scripts/scan/try-blueprint.ts --verbose  # every opportunity and assumption
 *   npx tsx scripts/scan/try-blueprint.ts --ai       # also run the AI review (needs ANTHROPIC_API_KEY)
 */
import { buildRulesBlueprint, simulateBlueprint } from "../../src/lib/scan/blueprint";
import { HOURS_PER_MONTH } from "../../src/lib/scan/blueprint/wages";
import { SAMPLE_BLUEPRINT } from "../../src/lib/scan/fixtures/sample-blueprint";
import type {
  Blueprint,
  CompanyProfile,
  OnlinePresence,
  Range,
  SiteSignals,
  WebsiteAudit,
} from "../../src/lib/scan/types";

const verbose = process.argv.includes("--verbose");
const withAi = process.argv.includes("--ai");
const NOW = "2026-10-03T09:00:00.000Z";

/* ---------------------------------------------------------------- fixtures */

const noSignals: SiteSignals = {
  hasContactForm: false,
  hasPhone: false,
  hasEmail: false,
  hasWhatsApp: false,
  hasLiveChat: false,
  hasOnlineBooking: false,
  hasEcommerce: false,
  hasCookieConsent: false,
  hasAnalytics: false,
  hasMarketingPixel: false,
  hasStructuredData: false,
  hasNewsletter: false,
  hasBlog: false,
  languages: ["ro"],
  socialLinks: [],
};

function company(
  partial: Partial<CompanyProfile> & Pick<CompanyProfile, "cui" | "name">,
): CompanyProfile {
  return { displayName: partial.name, sources: ["anaf", "index"], ...partial };
}

function audit(
  host: string,
  partial: Partial<Omit<WebsiteAudit, "signals" | "scores">> & {
    signals?: Partial<SiteSignals>;
    scores: WebsiteAudit["scores"];
  },
): WebsiteAudit {
  const url = `https://${host}/`;
  return {
    url,
    finalUrl: url,
    host,
    fetchedAt: NOW,
    reachable: true,
    https: true,
    statusCode: 200,
    responseMs: 900,
    pages: [{ url, status: 200, title: partial.meta?.title }],
    meta: {},
    technologies: [],
    findings: [],
    ...partial,
    signals: { ...noSignals, ...partial.signals },
  };
}

const finding = (
  id: string,
  category: WebsiteAudit["findings"][number]["category"],
  severity: WebsiteAudit["findings"][number]["severity"],
  effort: WebsiteAudit["findings"][number]["effort"],
  en: string,
  ro: string,
): WebsiteAudit["findings"][number] => ({
  id,
  category,
  severity,
  effort,
  title: { en, ro },
  detail: { en, ro },
  recommendation: { en, ro },
});

const presence = (
  profiles: OnlinePresence["profiles"],
  googleRating?: OnlinePresence["googleRating"],
): OnlinePresence => ({ profiles, googleRating });

type Fixture = {
  key: string;
  input: Parameters<typeof buildRulesBlueprint>[0];
  expectType: string;
};

const FIXTURES: Fixture[] = [
  {
    key: "dental clinic with a site",
    expectType: "dental-clinic",
    input: {
      target: { cui: "12345678" },
      company: SAMPLE_BLUEPRINT.company,
      audit: SAMPLE_BLUEPRINT.audit,
      presence: SAMPLE_BLUEPRINT.presence,
      competitors: SAMPLE_BLUEPRINT.competitors,
      now: NOW,
    },
  },
  {
    key: "restaurant, no booking",
    expectType: "restaurant",
    input: {
      target: { cui: "23456781" },
      company: company({
        cui: "23456781",
        name: "BISTRO DUMBRAVA S.R.L.",
        displayName: "Bistro Dumbrava SRL",
        city: "Cluj-Napoca",
        county: "Cluj",
        caen: "5611",
        caenLabel: { en: "Restaurant activities", ro: "Activități ale restaurantelor" },
        website: "https://bistrodumbrava-example.ro",
      }),
      audit: audit("bistrodumbrava-example.ro", {
        meta: {
          title: "Bistro Dumbrava – Restaurant & terasă în Cluj",
          description: "Meniu zilnic, brunch, terasă",
        },
        technologies: [{ name: "WordPress", category: "cms", confidence: 0.9 }],
        signals: {
          hasContactForm: true,
          hasPhone: true,
          hasAnalytics: true,
          socialLinks: ["https://facebook.com/x", "https://instagram.com/x"],
        },
        scores: {
          performance: 52,
          seo: 66,
          accessibility: 74,
          security: 60,
          conversion: 41,
          overall: 58,
        },
        findings: [
          finding(
            "conversion.no-online-booking",
            "conversion",
            "high",
            "medium",
            "No online reservations",
            "Fără rezervări online",
          ),
          finding(
            "performance.heavy-images",
            "performance",
            "high",
            "quick",
            "Heavy images slow the menu page",
            "Imaginile mari încetinesc pagina de meniu",
          ),
          finding(
            "seo.no-structured-data",
            "seo",
            "medium",
            "quick",
            "No restaurant details for Google",
            "Fără date structurate pentru Google",
          ),
        ],
      }),
      presence: presence(
        [
          { platform: "website", status: "active" },
          { platform: "google-business", status: "detected" },
          { platform: "facebook", status: "active" },
          { platform: "instagram", status: "active" },
        ],
        { rating: 4.6, reviews: 412 },
      ),
      now: NOW,
    },
  },
  {
    key: "e-commerce shop",
    expectType: "ecommerce",
    input: {
      target: { url: "https://casa-verde-example.ro" },
      company: company({
        cui: "34567812",
        name: "CASA VERDE SHOP S.R.L.",
        city: "București",
        caen: "4791",
        caenLabel: {
          en: "Retail sale via mail order houses or via Internet",
          ro: "Comerț cu amănuntul prin intermediul caselor de comenzi sau prin Internet",
        },
      }),
      audit: audit("casa-verde-example.ro", {
        meta: { title: "Casa Verde – plante și decor, livrare în toată țara" },
        technologies: [
          { name: "WooCommerce", category: "ecommerce", confidence: 0.95 },
          { name: "Google Analytics 4", category: "analytics", confidence: 0.9 },
          { name: "Meta Pixel", category: "marketing", confidence: 0.9 },
        ],
        signals: {
          hasEcommerce: true,
          hasAnalytics: true,
          hasMarketingPixel: true,
          hasCookieConsent: true,
          hasNewsletter: true,
          hasContactForm: true,
          hasEmail: true,
          socialLinks: ["https://instagram.com/casaverde"],
        },
        scores: {
          performance: 61,
          seo: 78,
          accessibility: 80,
          security: 75,
          conversion: 70,
          overall: 72,
        },
        findings: [
          finding(
            "performance.render-blocking",
            "performance",
            "medium",
            "quick",
            "Render-blocking scripts",
            "Scripturi care blochează afișarea",
          ),
        ],
      }),
      now: NOW,
    },
  },
  {
    key: "accounting firm",
    expectType: "accounting",
    input: {
      target: { cui: "45678123" },
      company: company({
        cui: "45678123",
        name: "CONTAEXPERT IAȘI S.R.L.",
        city: "Iași",
        caen: "6920",
        caenLabel: {
          en: "Accounting, bookkeeping and auditing activities; tax consultancy",
          ro: "Activități de contabilitate și audit financiar; consultanță în domeniul fiscal",
        },
        website: "https://contaexpert-example.ro",
      }),
      audit: audit("contaexpert-example.ro", {
        meta: { title: "ContaExpert – servicii de contabilitate și salarizare în Iași" },
        signals: { hasContactForm: true, hasPhone: true, hasEmail: true },
        scores: {
          performance: 70,
          seo: 58,
          accessibility: 69,
          security: 64,
          conversion: 50,
          overall: 61,
        },
        findings: [
          finding(
            "seo.meta-description-missing",
            "seo",
            "medium",
            "quick",
            "Missing meta description",
            "Lipsește meta descrierea",
          ),
          finding(
            "security.no-cookie-consent",
            "security",
            "high",
            "quick",
            "No cookie consent",
            "Fără consimțământ cookie",
          ),
        ],
      }),
      now: NOW,
    },
  },
  {
    key: "construction company, no website",
    expectType: "construction",
    input: {
      target: { cui: "56781234" },
      company: company({
        cui: "56781234",
        name: "CONSTRUCT MODERN BIHOR S.R.L.",
        city: "Oradea",
        caen: "4120",
        caenLabel: {
          en: "Construction of residential and non-residential buildings",
          ro: "Lucrări de construcții a clădirilor rezidențiale și nerezidențiale",
        },
      }),
      now: NOW,
    },
  },
  {
    key: "Vortex Hub itself",
    expectType: "consulting",
    input: {
      target: { cui: "54747928", url: "https://vortexhub.dev" },
      company: company({
        cui: "54747928",
        name: "VORTEX HUB S.R.L.",
        displayName: "Vortex Hub SRL",
        regNo: "J2026033767000",
        city: "București",
        caen: "7020",
        caenLabel: {
          en: "Business and other management consultancy activities",
          ro: "Activități de consultanță în management",
        },
        website: "https://vortexhub.dev",
      }),
      audit: audit("vortexhub.dev", {
        meta: {
          title: "Vortex Hub – digital studio: websites, automation and AI",
          description: "Consultanță, automatizare și AI pentru afaceri",
        },
        technologies: [{ name: "React", category: "framework", confidence: 0.9 }],
        signals: {
          hasContactForm: true,
          hasEmail: true,
          languages: ["en", "ro"],
          socialLinks: ["https://instagram.com/vortexhub"],
        },
        scores: {
          performance: 74,
          seo: 81,
          accessibility: 88,
          security: 80,
          conversion: 66,
          overall: 78,
        },
      }),
      now: NOW,
    },
  },
];

/* ------------------------------------------------------------------ checks */

const problems: string[] = [];
const fail = (key: string, message: string) => problems.push(`[${key}] ${message}`);

const fmt = (r: Range, unit = "") => `${r.low}–${r.high}${unit}`;

function walkNumbers(value: unknown, path: string, onBad: (path: string) => void) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) onBad(path);
  } else if (Array.isArray(value)) value.forEach((v, i) => walkNumbers(v, `${path}[${i}]`, onBad));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) walkNumbers(v, `${path}.${k}`, onBad);
}

function check(key: string, bp: Blueprint, expectType: string, simulated = false) {
  if (bp.businessType.id !== expectType)
    fail(key, `type ${bp.businessType.id}, expected ${expectType}`);
  walkNumbers(bp, "bp", (path) => fail(key, `non-finite number at ${path}`));
  if (JSON.stringify(JSON.parse(JSON.stringify(bp))) !== JSON.stringify(bp))
    fail(key, "not JSON-stable");

  const team = bp.assumptions.simulation.teamSize;
  const capacity = team * HOURS_PER_MONTH;
  // 20 % cap, plus rounding of each opportunity.
  if (bp.totals.hoursSavedPerMonth.high > capacity * 0.2 * 1.03 + 1)
    fail(key, `hours ${bp.totals.hoursSavedPerMonth.high} > 20% of ${capacity}`);
  if (bp.opportunities.length < 3 || bp.opportunities.length > 10)
    fail(key, `${bp.opportunities.length} opportunities`);
  if (bp.strategies.length !== 3 || bp.strategies.filter((s) => s.recommended).length !== 1)
    fail(key, "need 3 strategies with exactly one recommended");
  // Phases follow the strategies, so a plan without an assistant or growth work has two.
  if (bp.roadmap.length < 2 || bp.roadmap.length > 4)
    fail(key, `${bp.roadmap.length} roadmap phases`);
  if (bp.projection.length !== 24) fail(key, "projection must have 24 months");
  if (!simulated && (bp.assumptions.hourlyCostRon < 25 || bp.assumptions.hourlyCostRon > 70))
    fail(key, `hourly cost ${bp.assumptions.hourlyCostRon} outside 25–70 RON`);
  if (bp.totals.monthlySavingsRon.high > 60000) fail(key, "monthly savings look absurd");

  for (const o of bp.opportunities) {
    const lines = o.assumptions.map((a) => a.en).join(" | ");
    if (!/a month/.test(lines)) fail(key, `${o.id}: no volume assumption`);
    if (!/RON\/hour/.test(lines)) fail(key, `${o.id}: no hourly cost assumption`);
    if (!o.assumptions.every((a) => a.en && a.ro))
      fail(key, `${o.id}: assumption missing a language`);
    // Savings must equal hours × hourly cost (within rounding).
    const expected = o.hoursSavedPerMonth.high * bp.assumptions.hourlyCostRon;
    if (Math.abs(o.monthlySavingsRon.high - expected) > Math.max(20, expected * 0.06))
      fail(
        key,
        `${o.id}: savings ${o.monthlySavingsRon.high} ≠ hours × cost ${Math.round(expected)}`,
      );
    if (o.hoursSavedPerMonth.low > o.hoursSavedPerMonth.high)
      fail(key, `${o.id}: inverted hours range`);
    if (o.paybackMonths.low > o.paybackMonths.high) fail(key, `${o.id}: inverted payback range`);
  }
  const roadmapIds = bp.roadmap.flatMap((p) => p.opportunityIds).sort();
  const oppIds = bp.opportunities.map((o) => o.id).sort();
  if (JSON.stringify(roadmapIds) !== JSON.stringify(oppIds))
    fail(key, "roadmap does not cover every opportunity");
  for (const text of [bp.headline, bp.summary, bp.disclaimer]) {
    if (!text.en || !text.ro) fail(key, "copy missing a language");
  }

  // Simulating with the defaults must give back the same blueprint.
  const same = simulateBlueprint(bp, bp.assumptions.simulation);
  if (JSON.stringify(same) !== JSON.stringify(bp)) {
    const diff = Object.keys(bp).filter(
      (k) =>
        JSON.stringify(same[k as keyof Blueprint]) !== JSON.stringify(bp[k as keyof Blueprint]),
    );
    fail(key, `simulate(defaults) changed: ${diff.join(", ")}`);
  }
}

/* -------------------------------------------------------------------- run */

function print(bp: Blueprint) {
  const a = bp.assumptions;
  console.log(
    `  type        ${bp.businessType.id} (${bp.businessType.confidence}) — ${bp.businessType.basis.join("; ")}`,
  );
  console.log(`  headline    ${bp.headline.en}`);
  console.log(`              ${bp.headline.ro}`);
  console.log(
    `  scores      maturity ${bp.scores.digitalMaturity} · website ${bp.scores.websiteHealth} · automation ${bp.scores.automationPotential}`,
  );
  console.log(
    `  cost        ${a.hourlyCostRon} RON/h · team ${fmt(a.teamSize)} (sim ${a.simulation.teamSize})`,
  );
  if (verbose) console.log(`              ${a.hourlyCostBasis.en}`);
  console.log(
    `  totals      ${fmt(bp.totals.hoursSavedPerMonth, " h/mo")} · ${fmt(bp.totals.monthlySavingsRon, " RON/mo")} · setup ${fmt(bp.totals.setupCostRon, " RON")} · payback ${fmt(bp.totals.paybackMonths, " mo")}`,
  );
  for (const o of bp.opportunities) {
    console.log(
      `    · ${o.id.padEnd(24)} ${fmt(o.hoursSavedPerMonth, "h").padEnd(11)} ${fmt(o.monthlySavingsRon, " RON").padEnd(16)} setup ${fmt(o.setupCostRon).padEnd(11)} tools ${fmt(o.monthlyToolCostRon).padEnd(9)} payback ${fmt(o.paybackMonths, " mo")}`,
    );
    if (verbose)
      for (const line of o.assumptions) console.log(`        - ${line.en}\n          ${line.ro}`);
  }
  for (const s of bp.strategies) {
    console.log(
      `  ${s.recommended ? "★" : " "} ${s.id.padEnd(9)} ${s.title.en.padEnd(36)} ${fmt(s.outcome.range, s.outcome.unit === "%" ? "%" : "")} ${s.outcome.label.en} · ${"€".repeat(s.investmentLevel)} ${fmt(s.investmentRon, " RON")} · ${fmt(s.timeToValueMonths, " mo")}`,
    );
    if (verbose) console.log(`      basis: ${s.outcome.basis.en}`);
  }
  for (const p of bp.roadmap) {
    console.log(
      `  m${p.startMonth}–${p.endMonth} ${p.title.ro.padEnd(36)} ${p.items.map((i) => i.en).join(" / ")}`,
    );
  }
  const at = (m: number) => bp.projection[m - 1];
  console.log(
    `  projection  m6 ${fmt(at(6).cumulativeSavingsRon)} vs ${fmt(at(6).cumulativeCostRon)} · m12 ${fmt(at(12).cumulativeSavingsRon)} vs ${fmt(at(12).cumulativeCostRon)} · m24 ${fmt(at(24).cumulativeSavingsRon)} vs ${fmt(at(24).cumulativeCostRon)}`,
  );
  const be = bp.totals.breakEven;
  console.log(
    `  break-even  month ${be?.month ?? "–"} (volume +20%: ${be?.higherVolume ?? "–"}, −20%: ${be?.lowerVolume ?? "–"})`,
  );
  console.log(`  offer       ${bp.offer.planId} — ${bp.offer.title.en} — ${bp.offer.priceNote.en}`);
  if (verbose) console.log(`  summary     ${bp.summary.en}\n              ${bp.summary.ro}`);
}

async function main() {
  for (const fixture of FIXTURES) {
    const started = performance.now();
    const bp = buildRulesBlueprint(fixture.input);
    const ms = (performance.now() - started).toFixed(1);
    console.log(`\n■ ${fixture.key} — ${bp.id} (${ms} ms)`);
    print(bp);
    check(fixture.key, bp, fixture.expectType);

    const sim = {
      teamSize: bp.assumptions.simulation.teamSize * 2,
      hourlyCostRon: 80,
      volumeFactor: 1.5,
    };
    const t0 = performance.now();
    const simulated = simulateBlueprint(bp, sim);
    const simMs = (performance.now() - t0).toFixed(2);
    console.log(
      `  simulate    team ${sim.teamSize}, 80 RON/h, ×1.5 → ${fmt(simulated.totals.hoursSavedPerMonth, " h/mo")} · ${fmt(simulated.totals.monthlySavingsRon, " RON/mo")} · payback ${fmt(simulated.totals.paybackMonths, " mo")} · recommended ${simulated.strategies.find((s) => s.recommended)?.id} (${simMs} ms)`,
    );
    check(`${fixture.key} (simulated)`, simulated, fixture.expectType, true);
    if (simulated.totals.hoursSavedPerMonth.high <= bp.totals.hoursSavedPerMonth.high)
      fail(fixture.key, "simulation with more team and volume did not raise the hours");

    if (withAi) {
      const { enrichBlueprintWithAi } = await import("../../src/lib/scan/blueprint/ai.server");
      const t1 = performance.now();
      const enriched = await enrichBlueprintWithAi(bp);
      console.log(
        `  AI          ${enriched ? "enriched" : "skipped (null)"} in ${((performance.now() - t1) / 1000).toFixed(1)} s`,
      );
      if (enriched) {
        print(enriched);
        check(`${fixture.key} (ai)`, enriched, enriched.businessType.id);
      }
    }
  }

  console.log(
    problems.length
      ? `\n✗ ${problems.length} problem(s):\n${problems.join("\n")}`
      : "\n✓ all checks passed",
  );
  process.exitCode = problems.length ? 1 : 0;
}

void main();

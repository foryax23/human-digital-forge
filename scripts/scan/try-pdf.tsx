/** @jsxRuntime automatic */
/**
 * Renders the blueprint PDF in Node for design checks without a browser:
 *
 *   npx tsx scripts/scan/try-pdf.tsx [outDir] [--variants] [--only=name,name]
 *
 * Writes sample-en.pdf and sample-ro.pdf from SAMPLE_BLUEPRINT. With
 * --variants it also renders edge cases (website-only scan, no website, a
 * stress case with long copy and many items, an empty plan) and blueprints
 * built by the rules engine from the sample's inputs (engine-*), whose copy,
 * opportunity count and roadmap length match what real scans produce. Each
 * page count is reported, so layout regressions show up as extra pages.
 * --only renders just the named blueprints (e.g. --only=sample,engine-dental).
 * Fonts and brand images load from the local public/ folder. Set
 * PDF_ASSET_FALLBACK_DIR to a folder of same-named files to stand in for
 * brand images that haven't been exported yet.
 */
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderToFile } from "@react-pdf/renderer";

import { resolvePdfAssets } from "../../src/components/scan/pdf/assets";
import { BlueprintDocument } from "../../src/components/scan/pdf/BlueprintDocument";
import { registerPdfFonts } from "../../src/components/scan/pdf/fonts";
import { withMeasurements } from "../../src/components/scan/pdf/measure";
import { buildRulesBlueprint } from "../../src/lib/scan/blueprint";
import { SAMPLE_BLUEPRINT as S } from "../../src/lib/scan/fixtures/sample-blueprint";
import type { Blueprint, Lang } from "../../src/lib/scan/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const outDir = path.resolve(
  args.find((a) => !a.startsWith("--")) ?? path.join(tmpdir(), "vortex-blueprint-pdf"),
);
const withVariants = args.includes("--variants");
const only = args
  .find((a) => a.startsWith("--only="))
  ?.slice("--only=".length)
  .split(",")
  .filter(Boolean);

registerPdfFonts(path.join(root, "public/fonts"));
mkdirSync(outDir, { recursive: true });

const fallbackDir = process.env.PDF_ASSET_FALLBACK_DIR;
const assets = resolvePdfAssets((publicPath) => {
  const file = path.join(root, "public", publicPath);
  if (existsSync(file)) return file;
  const standIn = fallbackDir ? path.join(fallbackDir, path.basename(publicPath)) : null;
  if (standIn && existsSync(standIn)) {
    console.warn(`missing ${publicPath}, using ${standIn}`);
    return standIn;
  }
  console.warn(`missing ${publicPath}: the PDF renders without it`);
  return file;
});

const audit = S.audit!;

/** Edge cases built from the sample; nothing here is shown to visitors. */
const VARIANTS: Record<string, Blueprint> = {
  "website-only": {
    ...S,
    id: "variant-website-only",
    target: { url: "https://dentalsmile-example.ro" },
    company: undefined,
    competitors: [],
    presence: undefined,
    audit: {
      ...audit,
      pagespeed: null,
      scores: { ...audit.scores, performance: undefined },
      signals: { ...audit.signals, cuiOnSite: undefined },
    },
  },
  "no-website": {
    ...S,
    id: "variant-no-website",
    audit: undefined,
    websiteActions: [],
    scores: { digitalMaturity: 18, websiteHealth: 0, automationPotential: 64 },
    presence: {
      profiles: [
        { platform: "website", status: "missing" },
        { platform: "google-business", status: "missing" },
        { platform: "facebook", status: "missing" },
      ],
    },
  },
  stress: {
    ...S,
    id: "variant-stress",
    engine: "ai",
    company: {
      ...S.company!,
      displayName: "Societatea Cooperativă Meșteșugărească Știința și Arta Tâmplăriei SCM",
      name: "SOCIETATEA COOPERATIVĂ MEȘTEȘUGĂREASCĂ DE GRADUL I ȘTIINȚA ȘI ARTA TÂMPLĂRIEI S.C.M.",
    },
    presence: {
      ...S.presence!,
      googleRating: { rating: 4.7, reviews: 213 },
    },
    competitors: [
      ...(S.competitors ?? []),
      { cui: "56789012", name: "Dentis Premium Clinic Timișoara SRL", city: "Timișoara" },
      { cui: "67890123", name: "Smile Factory SRL", city: "Timișoara", websiteScore: 48 },
    ],
    websiteActions: [
      {
        ...audit.findings[0],
        id: "security.mixed-content",
        severity: "critical",
        title: {
          en: "Insecure content on secure pages",
          ro: "Conținut nesecurizat pe pagini securizate",
        },
      },
      ...audit.findings,
    ],
    opportunities: [
      ...S.opportunities,
      ...S.opportunities.slice(0, 2).map((o, i) => ({
        ...o,
        id: `${o.id}-copy-${i}`,
        title: {
          en: `${o.title.en} for the second location and the partner laboratory`,
          ro: `${o.title.ro} pentru a doua locație și laboratorul partener`,
        },
      })),
    ],
    roadmap: [
      ...S.roadmap.slice(0, 2),
      {
        startMonth: 3,
        endMonth: 4,
        stage: { en: "AI assistant", ro: "Asistent AI" },
        title: { en: "Answer patients around the clock", ro: "Răspunde pacienților non-stop" },
        items: [
          { en: "Chat assistant on the website", ro: "Asistent de chat pe site" },
          {
            en: "Answers to prices and availability",
            ro: "Răspunsuri despre prețuri și disponibilitate",
          },
          { en: "Booking from the chat", ro: "Programare direct din chat" },
        ],
        tag: "high-impact",
        opportunityIds: [],
      },
      { ...S.roadmap[2], startMonth: 4, endMonth: 6 },
    ],
  },
  empty: {
    ...S,
    id: "variant-empty",
    opportunities: [],
    strategies: S.strategies.filter((s) => s.recommended),
    roadmap: S.roadmap.slice(0, 1),
    projection: [],
    totals: {
      hoursSavedPerMonth: { low: 0, high: 0 },
      monthlySavingsRon: { low: 0, high: 0 },
      annualSavingsRon: { low: 0, high: 0 },
      setupCostRon: { low: 0, high: 0 },
      paybackMonths: { low: 0, high: 0 },
    },
  },
};

/** Real engine output for the sample's inputs and two other activities. */
const ENGINE: Record<string, Blueprint> = {
  "engine-dental": buildRulesBlueprint({
    target: S.target,
    company: S.company,
    audit: S.audit,
    presence: S.presence,
    competitors: S.competitors,
    now: S.generatedAt,
  }),
  "engine-restaurant": buildRulesBlueprint({
    target: { cui: "34567890" },
    company: {
      ...S.company!,
      cui: "34567890",
      name: "BISTRO DUMBRAVA S.R.L.",
      displayName: "Bistro Dumbrava SRL",
      caen: "5610",
      caenLabel: { en: "Restaurants", ro: "Restaurante" },
      website: undefined,
    },
    presence: {
      profiles: [
        { platform: "website", status: "missing" },
        { platform: "google-business", status: "detected" },
        { platform: "facebook", status: "active" },
        { platform: "instagram", status: "active" },
      ],
      googleRating: { rating: 4.4, reviews: 318 },
    },
    competitors: [],
    now: S.generatedAt,
  }),
  "engine-shop": buildRulesBlueprint({
    target: { url: "https://casaverde-example.ro" },
    company: {
      ...S.company!,
      cui: "45678901",
      name: "CASA VERDE SHOP S.R.L.",
      displayName: "Casa Verde Shop SRL",
      caen: "4791",
      caenLabel: {
        en: "Retail sale via mail order houses or via Internet",
        ro: "Comerț cu amănuntul prin intermediul caselor de comenzi sau prin internet",
      },
      website: "https://casaverde-example.ro",
    },
    audit: {
      ...audit,
      url: "https://casaverde-example.ro",
      finalUrl: "https://casaverde-example.ro/",
      host: "casaverde-example.ro",
      meta: { ...audit.meta, title: "Casa Verde · Plante și decorațiuni" },
      signals: { ...audit.signals, hasEcommerce: true, hasOnlineBooking: false },
    },
    competitors: S.competitors,
    now: S.generatedAt,
  }),
};

/** Page objects in the file (react-pdf doesn't report the count). */
function countPages(file: string): number {
  return readFileSync(file, "latin1").match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
}

async function render(name: string, blueprint: Blueprint, lang: Lang) {
  const file = path.join(outDir, `${name}-${lang}.pdf`);
  const started = Date.now();
  // The same two passes as the browser: measure, then render.
  const props = await withMeasurements({
    blueprint,
    lang,
    reportUrl: "https://vortexhub.dev/scan?demo=1",
    assets,
  });
  await renderToFile(<BlueprintDocument {...props} />, file);
  const kb = (statSync(file).size / 1024).toFixed(1);
  console.log(`${file} · ${countPages(file)} pages · ${kb} KB · ${Date.now() - started} ms`);
}

const ALL: Record<string, Blueprint> = {
  sample: S,
  ...(withVariants || only ? { ...VARIANTS, ...ENGINE } : {}),
};
for (const lang of ["en", "ro"] as Lang[]) {
  for (const [name, blueprint] of Object.entries(ALL)) {
    if (only && !only.includes(name)) continue;
    await render(name, blueprint, lang);
  }
}

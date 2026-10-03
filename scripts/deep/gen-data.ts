/**
 * Generates the data files deep research reads at run time, so no step imports
 * src/lib/scan/** (portability, plan A5):
 *
 *   src/lib/deep/data/wages.json          gross pay by CAEN division + the minimum wage
 *   src/lib/deep/data/caen-labels.json    CAEN labels (divisions bilingual, classes in Romanian)
 *   src/lib/deep/data/caen-rev3-rev2.json CAEN Rev.3 → Rev.2 classes
 *
 *   npx tsx scripts/deep/gen-data.ts [--out <dir>] [--eurostat <correspondence.csv>] [--check]
 *
 * Sources: src/lib/scan/blueprint/wages.ts (INS, July 2026), src/lib/scan/caen.ts
 * and caen-classes.json (ONRC N_CAEN.csv). The Rev.3 → Rev.2 map is built from
 * the Eurostat NACE Rev.2.1 ↔ Rev.2 correspondence table when its CSV is given
 * with --eurostat (download not yet approved by the owner). Without it, a
 * SAMPLE map is derived from the ONRC labels plus the trial's known changes and
 * marked `"sample": true`; the peers step then prefers the CAEN Rev.2 class the
 * company filed its accounts under.
 *
 * --check regenerates in memory and fails when a committed file differs.
 * Node built-ins only (run through the repo's tsx).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { caenLabel } from "../../src/lib/scan/caen";
import {
  CAM_RATE,
  DIVISION_GROSS_RON,
  HOURS_PER_MONTH,
  NATIONAL_GROSS_RON,
  WAGE_SOURCE,
} from "../../src/lib/scan/blueprint/wages";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLASSES_JSON = path.join(ROOT, "src/lib/scan/caen-classes.json");
const CAEN_TS = path.join(ROOT, "src/lib/scan/caen.ts");

/**
 * Gross minimum wage in force (HG nr. 146/2026, Monitorul Oficial 13.03.2026):
 * 4,325 lei from 1 July 2026, 4,050 lei before. Confirmed on build day
 * (2026-10-03); update when a new government decision is published.
 */
export const MIN_GROSS = {
  value: 4325,
  from: "2026-07-01",
  previous: 4050,
  decision: "HG nr. 146/2026 (Monitorul Oficial, 13.03.2026)",
  confirmedOn: "2026-10-03",
};

export function buildWages() {
  const divisions: Record<string, number> = {};
  for (const [code, entry] of Object.entries(DIVISION_GROSS_RON)) divisions[code] = entry.gross;
  return {
    _meta: {
      generatedBy: "scripts/deep/gen-data.ts",
      source: WAGE_SOURCE.release.en,
      month: WAGE_SOURCE.month.en,
      url: WAGE_SOURCE.url,
    },
    nationalGross: NATIONAL_GROSS_RON,
    camRate: CAM_RATE,
    hoursPerMonth: HOURS_PER_MONTH,
    workingDaysPerMonth: 21,
    minGross: MIN_GROSS,
    divisions,
  };
}

type ClassTable = { source: string; rev3: Record<string, string>; rev2: Record<string, string> };
const loadClasses = (): ClassTable => JSON.parse(readFileSync(CLASSES_JSON, "utf8"));

export function buildLabels() {
  const classes = loadClasses();
  const divisions: Record<string, { en: string; ro: string }> = {};
  for (let i = 1; i <= 99; i++) {
    const code = String(i).padStart(2, "0");
    const label = caenLabel(code);
    if (label) divisions[code] = label;
  }
  const clean = (table: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(table)
        .filter(([code]) => /^\d{4}$/.test(code))
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  // Classes in Romanian (official ONRC names, CAEN Rev.3, the codes ANAF returns); English
  // readers get the division name, which is correct, only broader. The Rev.2 class name of
  // a filing comes with the bilanț itself (den_caen).
  return {
    _meta: { generatedBy: "scripts/deep/gen-data.ts", source: classes.source },
    divisions,
    rev3: clean(classes.rev3),
  };
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/,?\s*[îi]n magazine specializate/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const tokens = (s: string) =>
  new Set(
    fold(s)
      .split(" ")
      .filter((t) => t.length > 2),
  );
function jaccard(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const t of x) if (y.has(t)) inter++;
  return inter / (x.size + y.size - inter);
}

/** Changes seen in the engine trial or certain from the class definitions. */
const KNOWN_CHANGES: Record<string, string[]> = {
  "5611": ["5610"],
  "5612": ["5610"],
  "4763": ["4764"],
  "6210": ["6201"],
  "7020": ["7022"],
  "9610": ["9601"],
  "9621": ["9602"],
  "9622": ["9602"],
};

function newInRev3(): Set<string> {
  const source = readFileSync(CAEN_TS, "utf8");
  const block = /const NEW_IN_REV3 = new Set\(\[([\s\S]*?)\]\)/.exec(source)?.[1] ?? "";
  return new Set([...block.matchAll(/"(\d{4})"/g)].map((m) => m[1]));
}

/** Eurostat correspondence CSV: two columns of codes "dd.dd", the Rev.2.1 one named with "2.1". */
function fromEurostat(file: string): Record<string, string[]> {
  const lines = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(sep).map((h) => h.replace(/"/g, "").trim());
  const sourceCol = header.findIndex((h) => /2\.1|21/.test(h) && /code|cod/i.test(h));
  const targetCol = header.findIndex(
    (h, i) => i !== sourceCol && /rev\.?\s*2(?!\.1)|_2_/i.test(h) && /code|cod/i.test(h),
  );
  if (sourceCol < 0 || targetCol < 0) {
    throw new Error(
      `Eurostat CSV: cannot find the Rev.2.1 and Rev.2 code columns in: ${header.join(" | ")}`,
    );
  }
  const map: Record<string, string[]> = {};
  for (const line of lines.slice(1)) {
    const cells = line.split(sep).map((c) => c.replace(/"/g, "").trim());
    const from = cells[sourceCol]?.replace(/\D/g, "");
    const to = cells[targetCol]?.replace(/\D/g, "");
    if (from?.length !== 4 || to?.length !== 4) continue;
    const list = (map[from] ??= []);
    if (!list.includes(to)) list.push(to);
  }
  if (Object.keys(map).length < 500) throw new Error("Eurostat CSV: fewer than 500 classes mapped");
  return map;
}

export function buildCaenMap(eurostatCsv?: string) {
  if (eurostatCsv) {
    return {
      _meta: {
        generatedBy: "scripts/deep/gen-data.ts",
        source: `Eurostat NACE Rev.2.1 ↔ Rev.2 correspondence (${path.basename(eurostatCsv)})`,
        sample: false,
      },
      map: fromEurostat(eurostatCsv),
    };
  }
  const classes = loadClasses();
  const fresh = newInRev3();
  const rev3 = Object.fromEntries(Object.entries(classes.rev3).filter(([c]) => /^\d{4}$/.test(c)));
  const rev2 = Object.fromEntries(Object.entries(classes.rev2).filter(([c]) => /^\d{4}$/.test(c)));
  // Rev.2 class names: the classes listed in rev2 (they differ) plus unchanged Rev.3 ones.
  const byLabel = new Map<string, string[]>();
  const addLabel = (code: string, label: string) => {
    const key = fold(label);
    byLabel.set(key, [...(byLabel.get(key) ?? []), code]);
  };
  for (const [code, label] of Object.entries(rev2)) addLabel(code, label);
  for (const [code, label] of Object.entries(rev3))
    if (!fresh.has(code) && !rev2[code]) addLabel(code, label);
  const map: Record<string, string[]> = {};
  const stats = { known: 0, sameCode: 0, labelMatch: 0, unmapped: 0 };
  for (const [code, label] of Object.entries(rev3).sort(([a], [b]) => a.localeCompare(b))) {
    if (KNOWN_CHANGES[code]) {
      map[code] = KNOWN_CHANGES[code];
      stats.known++;
    } else if (!fresh.has(code) && (!rev2[code] || jaccard(label, rev2[code]) >= 0.6)) {
      map[code] = [code];
      stats.sameCode++;
    } else if (byLabel.has(fold(label))) {
      map[code] = byLabel.get(fold(label))!;
      stats.labelMatch++;
    } else stats.unmapped++;
  }
  return {
    _meta: {
      generatedBy: "scripts/deep/gen-data.ts",
      source:
        "SAMPLE derived from ONRC N_CAEN.csv labels (same code with an unchanged label, or an identical Rev.2 label) plus changes seen in the engine trial. Replace with the Eurostat correspondence table (--eurostat) once its download is approved.",
      sample: true,
      stats,
    },
    map,
  };
}

/** One key per line, arrays of strings inline (stable, diff-friendly, small). */
const json = (value: unknown) =>
  `${JSON.stringify(value, null, 1).replace(
    /\[\n\s*("[^"\n]*"(?:,\n\s*"[^"\n]*")*)\n\s*\]/g,
    (_, items: string) => `[${items.replace(/,\n\s*/g, ", ")}]`,
  )}\n`;

function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const out = path.resolve(option("out") ?? path.join(ROOT, "src/lib/deep/data"));
  const eurostat = option("eurostat");
  if (eurostat && !existsSync(eurostat)) throw new Error(`--eurostat file not found: ${eurostat}`);
  const files: Record<string, string> = {
    "wages.json": json(buildWages()),
    "caen-labels.json": json(buildLabels()),
    "caen-rev3-rev2.json": json(buildCaenMap(eurostat)),
  };
  if (args.includes("--check")) {
    let stale = 0;
    // Compared as data (key order included), so formatting is free.
    const same = (a: string, b: string) => {
      try {
        return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
      } catch {
        return false;
      }
    };
    for (const [name, content] of Object.entries(files)) {
      const target = path.join(out, name);
      const current = existsSync(target) ? readFileSync(target, "utf8") : "";
      if (!same(current, content)) {
        console.error(`stale: ${target}`);
        stale++;
      }
    }
    if (stale) process.exit(1);
    console.log("deep data files are up to date");
    return;
  }
  mkdirSync(out, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(out, name), content);
    console.log(`wrote ${path.join(out, name)} (${content.length} bytes)`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

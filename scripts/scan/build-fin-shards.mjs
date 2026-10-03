#!/usr/bin/env node
/**
 * Builds the Ministry of Finance peer shards for Vortex Scan "Cercetare
 * aprofundată" (plan D2, D5): same activity, similar size, near you, only from
 * the official annual accounts. Node built-ins only, like the company index
 * builder (scripts/scan/build-company-index.mjs), whose output it joins for the
 * location and the legal-entity filter.
 *
 * THE REAL DOWNLOAD IS NOT APPROVED YET. Until the owner approves it, this
 * script is built and tested only on the synthetic sample made by
 * tests/deep/shard/synthetic.mjs (run with --sample). After the approval:
 *
 *   1. From data.gov.ro, dataset "Situații financiare 2025" (Ministerul
 *      Finanțelor; CC BY 4.0, the 2025 licence field is empty, attributed
 *      anyway) and "Situații financiare 2024", download into one folder:
 *        web_bl_bs_sl_an2025.txt  web_uu_an2025.txt   (the data, ~90 MB)
 *        web_bl_bs_sl_an2025.csv  web_uu_an2025.csv   (the column descriptions)
 *        web_bl_bs_sl_an2024.txt  web_uu_an2024.txt   (+ their .csv)
 *   2. node --max-old-space-size=4096 scripts/scan/build-fin-shards.mjs \
 *        --src ~/Downloads/mf --date 2026-06-11 --date-prev <YYYY-MM-DD>
 *      (--date / --date-prev: the publication dates shown on data.gov.ro for
 *      the 2025 and 2024 datasets, for the sources appendix; 2026-06-11 is the
 *      2025 one; the year is read from the file names.)
 *   3. Check the summary it prints (rows read, kept, size of the largest file),
 *      run the deep tests (the shard ones: npx tsx --test tests/deep/shard/build-fin-shards.test.ts),
 *      commit public/scan-index/v1/fin/ and src/lib/deep/data/fin-bench-national.json, and Publish.
 *
 * Input:
 *   --src <dir>      the MF files above. The two layouts kept, BL/BS/SL (the
 *                    "web_bl_bs_sl" or "web_bl" file) and UU ("web_uu"), share
 *                    one header: CUI,CAEN,I1..I20 (comma separated). Any other
 *                    header fails loudly; so does a column description (.csv)
 *                    whose I4, I13, I15–I20 no longer mean what this script
 *                    reads. IFRS, NGO, bank and insurer files are not used.
 *   --index <dir>    the company index (default public/scan-index/v1): county,
 *                    locality and the legal-entity filter (no PFA, II, IF; no
 *                    radiated or dissolved firms).
 *   --caen-map <f>   Rev.3 → Rev.2 map (default src/lib/deep/data/caen-rev3-rev2.json).
 *   --caen-latest auto|rev2|rev3
 *                    how to read the latest year's CAEN codes (default auto: a
 *                    firm's previous-year code, filed under Rev.2, wins; a firm
 *                    without one has its code mapped through the Rev.3 map).
 *
 * Output (plan D2), under --out (default public/scan-index/v1/fin):
 *   <caen4>.txt               one line per firm, sorted by turnover (largest first):
 *                             cui36 \t countyCode \t locality \t turnover25 \t turnover24 \t
 *                             profitPretax25 \t profitNet25 \t staff25 \t receivables25 \t expenses25
 *   <caen4>/<county>.txt      instead, when a class has more than --split-rows rows (5,000)
 *   <caen4>/bench.json        P25/P50/P75 and N per county and nationally (hidden under 5 firms)
 *   caen-map.json             the Rev.3 → Rev.2 map used
 *   meta.json                 dataset dates, licences, counts, file hashes, sizes, build date
 * and src/lib/deep/data/fin-bench-national.json (national bands per class, read
 * on the server). Lines starting with "#" are comments (parseFinShard skips them).
 *
 * Rows kept: legal entities found in the index with a turnover of at least
 * 50,000 lei or at least one employee (dormant firms are left out of lists and
 * bands). Profit before tax = I16 − I17, net profit = I18 − I19.
 *
 * Budget: at most 25 MB in all (reported) and no file above 3 MB (fails).
 * Refresh: once a year after the filing season (September), and when the
 * activity-code lists change.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";

export const FORMAT_VERSION = 1;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** The one header both kept layouts have (MF "BL/BS/SL" and "UU", 2019–2025). */
export const EXPECTED_HEADER = [
  "CUI",
  "CAEN",
  ...Array.from({ length: 20 }, (_, i) => `I${i + 1}`),
];

/**
 * What each indicator this script reads must mean, checked against the MF
 * column description (.csv, "label;code" lines) when it is in --src.
 */
export const INDICATOR_MEANING = {
  i4: /creante/,
  i13: /cifra de afaceri/,
  i15: /cheltuieli totale/,
  i16: /profit\w* brut/,
  i17: /pierdere\w* brut/,
  i18: /profit\w* net/,
  i19: /pierdere\w* net/,
  i20: /numar mediu de salariati/,
};

/** ANAF's car codes (scod_JudetAuto), the county key of the shard. */
export const COUNTY_CODES = {
  alba: "AB",
  arad: "AR",
  arges: "AG",
  bacau: "BC",
  bihor: "BH",
  "bistrita-nasaud": "BN",
  botosani: "BT",
  braila: "BR",
  brasov: "BV",
  bucuresti: "B",
  "municipiul bucuresti": "B",
  buzau: "BZ",
  calarasi: "CL",
  "caras-severin": "CS",
  cluj: "CJ",
  constanta: "CT",
  covasna: "CV",
  dambovita: "DB",
  dolj: "DJ",
  galati: "GL",
  giurgiu: "GR",
  gorj: "GJ",
  harghita: "HR",
  hunedoara: "HD",
  ialomita: "IL",
  iasi: "IS",
  ilfov: "IF",
  maramures: "MM",
  mehedinti: "MH",
  mures: "MS",
  neamt: "NT",
  olt: "OT",
  prahova: "PH",
  salaj: "SJ",
  "satu mare": "SM",
  sibiu: "SB",
  suceava: "SV",
  teleorman: "TR",
  timis: "TM",
  tulcea: "TL",
  valcea: "VL",
  vaslui: "VS",
  vrancea: "VN",
};

export const DEFAULTS = {
  splitRows: 5000,
  minTurnover: 50_000,
  /** Bands with fewer firms are hidden (= MIN_PEERS_SHOWN in src/lib/deep/parse/fin-shard.ts). */
  minBand: 5,
  maxFileBytes: 3 * 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
  /** Rows whose field count or numbers do not parse, as a share of all rows, before failing. */
  maxBadShare: 0.005,
};

const SAMPLE_MARKER = "SYNTHETIC-SAMPLE.txt";
const LICENCE = "CC BY 4.0";

export class FinFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "FinFormatError";
  }
}

/* ------------------------------------------------------------- helpers */

export const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export function countyCode(name) {
  return COUNTY_CODES[fold(name)] ?? "";
}

/** Same interpolation as quantile() in src/lib/deep/parse/format.ts (tested equal). */
export function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** A 4-digit CAEN class: digits only, the leading zero MF drops restored ("111" → "0111"). */
export function normCaen(raw) {
  const digits = String(raw ?? "")
    .replace(/["']/g, "")
    .trim()
    .replace(/\.0+$/, "")
    .replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 4) return "";
  const code = digits.padStart(4, "0");
  return /^0+$/.test(code) ? "" : code;
}

/** Windows-1250 bytes of the Romanian letters (MF descriptions are not always UTF-8). */
const CP1250 = { 0xaa: "Ş", 0xba: "ş", 0xde: "Ţ", 0xfe: "ţ", 0xc3: "Ă", 0xe3: "ă" };

/** UTF-8 when the bytes are valid UTF-8, else Windows-1250 for the Romanian letters. */
export function decodeText(buf) {
  const utf8 = buf.toString("utf8");
  if (!utf8.includes("\ufffd")) return utf8;
  let out = "";
  for (const byte of buf) out += CP1250[byte] ?? String.fromCharCode(byte);
  return out;
}

const unquote = (s) => s.trim().replace(/^"(.*)"$/, "$1");

/** A number from an MF cell; "" or "-" is missing; anything else that is not a number is bad. */
export function toNum(cell) {
  const s = unquote(String(cell ?? ""));
  if (s === "" || s === "-") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const clean = (s) =>
  String(s ?? "")
    .replace(/[\t\r\n]+/g, " ")
    .trim();

/* -------------------------------------------------------------- header */

/**
 * Reads and checks the header line of an MF file. Fails loudly (FinFormatError)
 * on anything but CUI,CAEN,I1..I20, naming what is missing or new.
 */
export function parseHeader(line, file = "file") {
  const raw = String(line ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r$/, "");
  const candidates = [",", ";", "^", "\t"];
  let best = null;
  for (const delimiter of candidates) {
    const columns = raw.split(delimiter).map((c) => unquote(c).toUpperCase());
    if (!best || columns.length > best.columns.length) best = { delimiter, columns };
  }
  const { delimiter, columns } = best;
  const missing = EXPECTED_HEADER.filter((c) => !columns.includes(c));
  const extra = columns.filter((c) => !EXPECTED_HEADER.includes(c));
  const sameOrder =
    columns.length === EXPECTED_HEADER.length && columns.every((c, i) => c === EXPECTED_HEADER[i]);
  if (missing.length || extra.length || !sameOrder) {
    throw new FinFormatError(
      [
        `${path.basename(file)}: the MF file format changed; nothing was written.`,
        `  expected: ${EXPECTED_HEADER.join(",")}`,
        `  found:    ${raw.slice(0, 240)}`,
        missing.length ? `  missing:  ${missing.join(", ")}` : "",
        extra.length ? `  new:      ${extra.join(", ")}` : "",
        !missing.length && !extra.length ? "  the columns are in a different order" : "",
        "  Check the column description (.csv) on data.gov.ro and update EXPECTED_HEADER",
        "  and INDICATOR_MEANING in scripts/scan/build-fin-shards.mjs.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return { delimiter, columns, index: Object.fromEntries(columns.map((c, i) => [c, i])) };
}

/**
 * Checks the MF column description ("label;code" per line) against what this
 * script reads: I13 must still be the turnover, I20 the average staff, etc.
 */
export function checkDescription(text, file = "description") {
  const labels = {};
  for (const line of String(text)
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)) {
    const cut = line.lastIndexOf(";");
    if (cut < 0) continue;
    const code = line
      .slice(cut + 1)
      .trim()
      .toLowerCase();
    if (/^i\d+$/.test(code)) labels[code] = fold(line.slice(0, cut));
  }
  const problems = [];
  for (const [code, meaning] of Object.entries(INDICATOR_MEANING)) {
    if (!labels[code]) problems.push(`${code.toUpperCase()} is not described`);
    else if (!meaning.test(labels[code]))
      problems.push(`${code.toUpperCase()} is now "${labels[code]}" (expected ${meaning})`);
  }
  if (problems.length) {
    throw new FinFormatError(
      `${path.basename(file)}: the MF indicators changed meaning; nothing was written.\n  ${problems.join("\n  ")}`,
    );
  }
  return Object.keys(INDICATOR_MEANING).map((c) => c.toUpperCase());
}

/* --------------------------------------------------------------- input */

const DATA_FILE = /^web_(bl_bs_sl|bl|uu)_an(\d{4})\.txt$/i;

/** The kept MF data files in a folder, by year, with their column descriptions when present. */
export function discoverInputs(dir) {
  if (!fs.existsSync(dir)) throw new FinFormatError(`--src ${dir} does not exist`);
  const names = fs.readdirSync(dir);
  const byYear = new Map();
  for (const name of names) {
    const m = DATA_FILE.exec(name);
    if (!m) continue;
    const kind = m[1].toLowerCase() === "uu" ? "uu" : "bl_bs_sl";
    const year = Number(m[2]);
    const stem = name.replace(/\.txt$/i, "");
    const lower = new Map(names.map((n) => [n.toLowerCase(), n]));
    const description =
      lower.get(`${stem.toLowerCase()}.csv`) ??
      lower.get(`web_${kind === "uu" ? "uu" : "bl"}_${year}.csv`) ??
      lower.get(`web_${m[1].toLowerCase()}_${year}.csv`);
    const list = byYear.get(year) ?? [];
    list.push({
      file: path.join(dir, name),
      kind,
      year,
      description: description ? path.join(dir, description) : undefined,
    });
    byYear.set(year, list);
  }
  return byYear;
}

/**
 * Streams one MF file into `onRow`. Rows whose field count or numbers do not
 * parse are counted; above DEFAULTS.maxBadShare of the file it fails loudly.
 */
export async function readMfFile(file, onRow, { maxBadShare = DEFAULTS.maxBadShare } = {}) {
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let header = null;
  const stats = { rows: 0, bad: 0, badExamples: [] };
  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    if (!header) {
      header = parseHeader(line, file);
      continue;
    }
    if (!line.trim()) continue;
    stats.rows++;
    const f = line.split(header.delimiter);
    const I = header.index;
    const nums = {
      i4: toNum(f[I.I4]),
      i13: toNum(f[I.I13]),
      i15: toNum(f[I.I15]),
      i16: toNum(f[I.I16]),
      i17: toNum(f[I.I17]),
      i18: toNum(f[I.I18]),
      i19: toNum(f[I.I19]),
      i20: toNum(f[I.I20]),
    };
    const cui = unquote(f[I.CUI] ?? "")
      .replace(/^RO/i, "")
      .replace(/\D/g, "")
      .replace(/^0+/, "");
    if (
      f.length !== header.columns.length ||
      !cui ||
      cui.length > 10 ||
      Object.values(nums).some((n) => Number.isNaN(n))
    ) {
      stats.bad++;
      if (stats.badExamples.length < 3) stats.badExamples.push(lineNo);
      continue;
    }
    const pre = (nums.i16 ?? 0) - (nums.i17 ?? 0);
    const net = (nums.i18 ?? 0) - (nums.i19 ?? 0);
    const anyPre = nums.i16 !== undefined || nums.i17 !== undefined;
    const anyNet = nums.i18 !== undefined || nums.i19 !== undefined;
    onRow({
      cui: Number(cui),
      caen: normCaen(f[I.CAEN]),
      turnover: nums.i13,
      receivables: nums.i4,
      expenses: nums.i15,
      profitPretax: anyPre ? pre : undefined,
      profitNet: anyNet ? net : undefined,
      staff: nums.i20,
    });
  }
  if (!header) throw new FinFormatError(`${path.basename(file)} is empty`);
  if (stats.rows === 0) throw new FinFormatError(`${path.basename(file)} has a header and no rows`);
  if (stats.bad > Math.max(10, stats.rows * maxBadShare)) {
    throw new FinFormatError(
      `${path.basename(file)}: ${stats.bad} of ${stats.rows} rows do not parse (lines ${stats.badExamples.join(", ")}…); nothing was written.`,
    );
  }
  return stats;
}

/**
 * The company index as CUI → { county, city }: legal entities only, without
 * radiated or dissolved firms (the index builder already leaves those out).
 */
export function loadIndex(dir) {
  const recordsDir = path.join(dir, "r");
  if (!fs.existsSync(recordsDir)) {
    throw new FinFormatError(
      `--index ${dir} has no r/ folder (run scripts/scan/build-company-index.mjs)`,
    );
  }
  let datasetDate;
  try {
    datasetDate = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")).source
      ?.datasetDate;
  } catch {
    datasetDate = undefined;
  }
  const places = new Map();
  const byCui = new Map();
  for (const name of fs.readdirSync(recordsDir)) {
    if (!/^\d+\.txt$/.test(name)) continue;
    let place = null;
    for (const line of fs.readFileSync(path.join(recordsDir, name), "utf8").split("\n")) {
      if (!line) continue;
      if (line.startsWith("@")) {
        const [county = "", city = ""] = line.slice(1).split("\t");
        const key = `${county}\t${city}`;
        place = places.get(key);
        if (!place) {
          place = { county: countyCode(county), countyName: county, city: clean(city) };
          places.set(key, place);
        }
        continue;
      }
      const tab = line.indexOf("\t");
      const cui = parseInt(tab < 0 ? line : line.slice(0, tab), 36);
      if (Number.isFinite(cui) && place) byCui.set(cui, place);
    }
  }
  if (!byCui.size) throw new FinFormatError(`--index ${dir} holds no records`);
  return { byCui, datasetDate };
}

/** The Rev.3 → Rev.2 map ({ _meta, map }) as written by scripts/deep/gen-data.ts. */
export function loadCaenMap(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!data || typeof data.map !== "object") {
    throw new FinFormatError(`${file} is not a { map: { rev3: [rev2…] } } file`);
  }
  return data;
}

/* --------------------------------------------------------------- bands */

const round = (v, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

const METRICS = {
  turnover: { pick: (r) => r.turnover, digits: 0 },
  marginPretax: {
    pick: (r) =>
      r.profitPretax !== undefined && r.turnover > 0 ? r.profitPretax / r.turnover : undefined,
    digits: 4,
  },
  employees: { pick: (r) => r.staff, digits: 1 },
  revPerEmp: { pick: (r) => (r.staff > 0 ? r.turnover / r.staff : undefined), digits: 0 },
  /** One year: the shard carries two years. */
  growth: {
    pick: (r) => (r.turnoverPrev > 0 ? r.turnover / r.turnoverPrev - 1 : undefined),
    digits: 4,
  },
};
export const METRIC_NAMES = Object.keys(METRICS);

/** P25/P50/P75 and N of each metric over `rows`; a metric with fewer than minBand values is left out. */
export function bandsOf(rows, minBand = DEFAULTS.minBand) {
  const out = {};
  for (const [name, { pick, digits }] of Object.entries(METRICS)) {
    const values = rows
      .map(pick)
      .filter((v) => v !== undefined && Number.isFinite(v))
      .sort((a, b) => a - b);
    if (values.length < minBand) continue;
    out[name] = {
      p25: round(quantile(values, 0.25), digits),
      p50: round(quantile(values, 0.5), digits),
      p75: round(quantile(values, 0.75), digits),
      n: values.length,
    };
  }
  return out;
}

/* --------------------------------------------------------------- build */

/**
 * JSON as Prettier prints it (2 spaces; an array of numbers or strings on one
 * line when it fits in 100 columns), so `prettier --check .` stays clean on the
 * committed files and a rebuild of the same data diffs to nothing.
 */
export function prettyJson(value) {
  const text = JSON.stringify(value, null, 2).replace(
    /^( *)("(?:[^"\\]|\\.)*": )?\[\n([^[\]{}]*?)\n\1\]/gm,
    (all, indent, key = "", body) => {
      const items = body.split(",\n").map((item) => item.trim());
      const line = `${indent}${key}[${items.join(", ")}]`;
      return line.length + 1 <= 100 ? line : all;
    },
  );
  return `${text}\n`;
}

const cell = (v) =>
  v === undefined || v === null || !Number.isFinite(v) ? "" : String(Math.round(v));

export function shardLine(r) {
  return [
    r.cui.toString(36),
    r.county,
    r.locality,
    cell(r.turnover),
    cell(r.turnoverPrev),
    cell(r.profitPretax),
    cell(r.profitNet),
    cell(r.staff),
    cell(r.receivables),
    cell(r.expenses),
  ].join("\t");
}

const insidePublic = (dir) => {
  const rel = path.relative(path.join(ROOT, "public"), path.resolve(dir));
  return !rel.startsWith("..") && !path.isAbsolute(rel);
};

/**
 * Builds every output. Throws FinFormatError (nothing written) on a format
 * change, a missing input or a file over the size budget.
 */
export async function buildFinShards(options) {
  const opts = { ...DEFAULTS, ...options };
  const t0 = Date.now();
  const log = opts.quiet
    ? () => undefined
    : (...m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...m);
  const src = path.resolve(opts.src);
  const out = path.resolve(opts.out ?? path.join(ROOT, "public/scan-index/v1/fin"));
  const sampleInput = fs.existsSync(path.join(src, SAMPLE_MARKER));
  if (sampleInput && !opts.sample) {
    throw new FinFormatError(
      `${src} is the synthetic sample (${SAMPLE_MARKER}); pass --sample, and never write it under public/.`,
    );
  }
  if (opts.sample && insidePublic(out)) {
    throw new FinFormatError(
      `--sample output must not go under public/ (${out}): the app would serve synthetic peers as real ones.`,
    );
  }
  const benchOut = path.resolve(
    opts.benchOut ??
      (opts.sample
        ? path.join(out, "fin-bench-national.json")
        : path.join(ROOT, "src/lib/deep/data/fin-bench-national.json")),
  );

  const inputs = discoverInputs(src);
  if (!inputs.size) {
    throw new FinFormatError(
      `${src} holds no MF data file (web_bl_bs_sl_anYYYY.txt or web_uu_anYYYY.txt)`,
    );
  }
  const year = opts.year ? Number(opts.year) : Math.max(...inputs.keys());
  const latestFiles = inputs.get(year) ?? [];
  const prevFiles = inputs.get(year - 1) ?? [];
  if (!latestFiles.length) throw new FinFormatError(`${src} has no MF file for ${year}`);
  if (!prevFiles.length) {
    throw new FinFormatError(
      `${src} has no MF file for ${year - 1}: the shard needs both years (turnover24 and the Rev.2 class)`,
    );
  }

  // Indicator meanings, from the column descriptions next to the data.
  const described = [];
  const notDescribed = [];
  for (const input of [...latestFiles, ...prevFiles]) {
    if (!input.description) {
      notDescribed.push(path.basename(input.file));
      continue;
    }
    checkDescription(decodeText(fs.readFileSync(input.description)), input.description);
    described.push(path.basename(input.description));
  }
  if (notDescribed.length) {
    if (opts.requireDescription) {
      throw new FinFormatError(`no column description (.csv) for ${notDescribed.join(", ")}`);
    }
    log(
      `warning: no column description for ${notDescribed.join(", ")}; indicator meanings not checked`,
    );
  }

  const index = loadIndex(path.resolve(opts.index ?? path.join(ROOT, "public/scan-index/v1")));
  log(`index: ${index.byCui.size} legal entities`);
  const caenMapFile = path.resolve(
    opts.caenMap ?? path.join(ROOT, "src/lib/deep/data/caen-rev3-rev2.json"),
  );
  const caenMap = loadCaenMap(caenMapFile);

  // Previous year: turnover and the class filed under Rev.2.
  const prev = new Map();
  const fileStats = [];
  for (const input of prevFiles) {
    const stats = await readMfFile(
      input.file,
      (r) => {
        const seen = prev.get(r.cui);
        if (!seen || Math.abs(r.turnover ?? 0) > Math.abs(seen.turnover ?? 0)) {
          prev.set(r.cui, { turnover: r.turnover, caen: r.caen });
        }
      },
      opts,
    );
    fileStats.push({ file: path.basename(input.file), year: year - 1, kind: input.kind, ...stats });
    log(`${path.basename(input.file)}: ${stats.rows} rows, ${stats.bad} not parsed`);
  }

  const counts = {
    rowsLatest: 0,
    duplicates: 0,
    notInIndex: 0,
    dormant: 0,
    noClass: 0,
    unknownCounty: 0,
    mappedRev3: 0,
    kept: 0,
  };
  const latest = new Map();
  for (const input of latestFiles) {
    const stats = await readMfFile(
      input.file,
      (r) => {
        counts.rowsLatest++;
        const seen = latest.get(r.cui);
        if (seen) {
          counts.duplicates++;
          if (Math.abs(r.turnover ?? 0) <= Math.abs(seen.turnover ?? 0)) return;
        }
        latest.set(r.cui, r);
      },
      opts,
    );
    fileStats.push({ file: path.basename(input.file), year, kind: input.kind, ...stats });
    log(`${path.basename(input.file)}: ${stats.rows} rows, ${stats.bad} not parsed`);
  }

  const classes = new Map();
  for (const r of latest.values()) {
    const place = index.byCui.get(r.cui);
    if (!place) {
      counts.notInIndex++;
      continue;
    }
    const turnover = r.turnover ?? 0;
    if (!(turnover >= opts.minTurnover || (r.staff ?? 0) >= 1)) {
      counts.dormant++;
      continue;
    }
    const before = prev.get(r.cui);
    let caen = "";
    if (opts.caenLatest === "rev2") caen = r.caen;
    else if (opts.caenLatest === "rev3") {
      caen = caenMap.map[r.caen]?.[0] ?? r.caen;
      if (caen !== r.caen) counts.mappedRev3++;
    } else if (before?.caen) caen = before.caen;
    else if (r.caen && caenMap.map[r.caen]?.length) {
      caen = caenMap.map[r.caen][0];
      if (caen !== r.caen) counts.mappedRev3++;
    } else caen = r.caen;
    if (!caen) {
      counts.noClass++;
      continue;
    }
    if (!place.county) counts.unknownCounty++;
    const row = {
      cui: r.cui,
      county: place.county,
      locality: place.city,
      turnover,
      turnoverPrev: before?.turnover,
      profitPretax: r.profitPretax,
      profitNet: r.profitNet,
      staff: r.staff,
      receivables: r.receivables,
      expenses: r.expenses,
    };
    const list = classes.get(caen) ?? [];
    list.push(row);
    classes.set(caen, list);
    counts.kept++;
  }
  log(`kept ${counts.kept} firms in ${classes.size} classes`);

  // Write into a fresh folder; it replaces --out only when everything passed.
  const tmp = `${out}.tmp-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const written = new Map();
  const write = (rel, content) => {
    const file = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const buf = Buffer.from(content);
    fs.writeFileSync(file, buf);
    written.set(rel, buf);
  };
  const sampleNote = opts.sample ? "SAMPLE (synthetic, not real companies) · " : "";
  const source = `Ministerul Finanțelor · situații financiare ${year} · data.gov.ro · ${LICENCE}`;
  const national = {};
  const splitClasses = [];
  try {
    for (const caen of [...classes.keys()].sort()) {
      const rows = classes.get(caen).sort((a, b) => b.turnover - a.turnover || a.cui - b.cui);
      const head = `# ${sampleNote}${source} · CAEN ${caen}`;
      if (rows.length > opts.splitRows) {
        splitClasses.push(caen);
        const byCounty = new Map();
        for (const r of rows) {
          const key = r.county || "XX";
          const list = byCounty.get(key) ?? [];
          list.push(r);
          byCounty.set(key, list);
        }
        for (const [county, list] of [...byCounty].sort()) {
          write(
            `${caen}/${county}.txt`,
            `${head} · județul ${county} (clasă împărțită pe județe)\n${list.map(shardLine).join("\n")}\n`,
          );
        }
      } else {
        write(`${caen}.txt`, `${head}\n${rows.map(shardLine).join("\n")}\n`);
      }
      const counties = {};
      const byCounty = new Map();
      for (const r of rows) {
        if (!r.county) continue;
        const list = byCounty.get(r.county) ?? [];
        list.push(r);
        byCounty.set(r.county, list);
      }
      for (const [county, list] of [...byCounty].sort()) {
        counties[county] =
          list.length < opts.minBand
            ? { n: list.length }
            : { n: list.length, ...bandsOf(list, opts.minBand) };
      }
      const all = bandsOf(rows, opts.minBand);
      write(
        `${caen}/bench.json`,
        prettyJson({
          caen,
          year,
          sample: opts.sample || undefined,
          n: rows.length,
          national: rows.length < opts.minBand ? {} : all,
          counties,
        }),
      );
      if (rows.length >= opts.minBand) {
        const compact = { n: rows.length };
        for (const [name, b] of Object.entries(all)) compact[name] = [b.p25, b.p50, b.p75, b.n];
        national[opts.sample ? `SAMPLE-${caen}` : caen] = compact;
      }
    }
    write(
      "caen-map.json",
      prettyJson({
        _meta: { ...(caenMap._meta ?? {}), copiedFrom: path.relative(ROOT, caenMapFile) },
        map: caenMap.map,
      }),
    );

    // Size budget.
    let bytes = 0;
    let gzipBytes = 0;
    let largest = { file: "", bytes: 0 };
    for (const [rel, buf] of written) {
      bytes += buf.length;
      gzipBytes += zlib.gzipSync(buf, { level: 9 }).length;
      if (buf.length > largest.bytes) largest = { file: rel, bytes: buf.length };
    }
    if (largest.bytes > opts.maxFileBytes) {
      throw new FinFormatError(
        `${largest.file} is ${(largest.bytes / 1e6).toFixed(2)} MB, above the ${(opts.maxFileBytes / 1e6).toFixed(2)} MB limit per file; lower --split-rows.`,
      );
    }
    if (bytes > opts.maxTotalBytes) {
      log(
        `warning: ${(bytes / 1e6).toFixed(1)} MB in all, above the ${(opts.maxTotalBytes / 1e6).toFixed(0)} MB target`,
      );
    }

    const builtAt = opts.builtAt ?? new Date().toISOString();
    const hashes = Object.fromEntries(
      [...written]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([rel, buf]) => [
          rel,
          crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32),
        ]),
    );
    const attribution = (y) =>
      `Sursa: Ministerul Finanțelor, situații financiare ${y}, data.gov.ro, ${LICENCE}`;
    const meta = {
      format: "vortex-scan-fin-shard",
      version: FORMAT_VERSION,
      sample: opts.sample
        ? "SYNTHETIC SAMPLE: not real companies. Never publish under public/."
        : false,
      builtAt,
      year,
      line: "cui36 \\t countyCode \\t locality \\t turnover25 \\t turnover24 \\t profitPretax25 \\t profitNet25 \\t staff25 \\t receivables25 \\t expenses25",
      files: {
        flat: "<caen4>.txt",
        split: `<caen4>/<countyCode>.txt when a class has more than ${opts.splitRows} rows (scope: that county only)`,
        bench: "<caen4>/bench.json",
      },
      rules: {
        kept: `legal entities in the company index with turnover >= ${opts.minTurnover} lei or at least 1 employee`,
        profitPretax: "I16 - I17",
        profitNet: "I18 - I19",
        class: `CAEN Rev.2; latest-year codes read as ${opts.caenLatest ?? "auto"} (auto: previous-year code first, else the Rev.3 map)`,
        bandsHiddenUnder: opts.minBand,
      },
      sources: [
        ...[year, year - 1].map((y) => ({
          name: `Ministerul Finanțelor, situații financiare ${y}`,
          url: "https://data.gov.ro/organization/ministerul-finantelor",
          datasetDate: y === year ? opts.date : opts.datePrev,
          licence: LICENCE,
          licenceNote:
            y >= 2025
              ? "The dataset's licence field is empty on data.gov.ro; attributed as CC BY 4.0 anyway."
              : undefined,
          attribution: attribution(y),
          files: fileStats.filter((f) => f.year === y).map((f) => f.file),
        })),
        {
          name: "ONRC, firme înregistrate (company index: county, locality, legal entities only)",
          datasetDate: index.datasetDate,
          licence: LICENCE,
        },
      ],
      schema: { header: EXPECTED_HEADER.join(","), describedBy: described, notDescribed },
      inputs: fileStats.map(({ badExamples: _e, ...f }) => f),
      counts: {
        ...counts,
        classes: classes.size,
        splitClasses: splitClasses.length,
        nationalBands: Object.keys(national).length,
      },
      splitClasses,
      size: {
        files: written.size,
        bytes,
        gzipBytes,
        largestFile: largest,
        budget: { maxFileBytes: opts.maxFileBytes, maxTotalBytes: opts.maxTotalBytes },
      },
      hashes,
    };
    write("meta.json", prettyJson(meta));

    const bench = {
      _meta: {
        generatedBy: "scripts/scan/build-fin-shards.mjs",
        sample: Boolean(opts.sample),
        note: opts.sample
          ? "SYNTHETIC SAMPLE built from tests/deep/shard/synthetic.mjs: not real companies. Class keys carry a SAMPLE- prefix so no real CAEN lookup can match. Replaced by the real build once the Ministry of Finance download is approved."
          : undefined,
        year,
        builtAt,
        source: attribution(year),
        datasetDate: opts.date,
        metrics: METRIC_NAMES,
        fields: ["p25", "p50", "p75", "n"],
        hiddenUnder: opts.minBand,
      },
      classes: national,
    };

    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.renameSync(tmp, out);
    fs.mkdirSync(path.dirname(benchOut), { recursive: true });
    fs.writeFileSync(benchOut, prettyJson(bench));
    log(
      `done: ${counts.kept} firms, ${classes.size} classes (${splitClasses.length} split), ${written.size} files, ${(bytes / 1e6).toFixed(2)} MB (${(gzipBytes / 1e6).toFixed(2)} MB gzip), largest ${largest.file} ${(largest.bytes / 1e3).toFixed(0)} KB`,
    );
    return { out, benchOut, meta, bench };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* ----------------------------------------------------------------- CLI */

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) opts[key] = true;
    else {
      opts[key] = next;
      i++;
    }
  }
  for (const k of ["splitRows", "minTurnover", "minBand", "maxFileBytes", "maxTotalBytes"]) {
    if (opts[k] !== undefined) opts[k] = Number(opts[k]);
  }
  return opts;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.src || opts.help) {
    console.error(
      "Usage: node --max-old-space-size=4096 scripts/scan/build-fin-shards.mjs --src <dir with web_*_anYYYY.txt>\n" +
        "  [--index public/scan-index/v1] [--out public/scan-index/v1/fin] [--bench-out <json>]\n" +
        "  [--date YYYY-MM-DD] [--date-prev YYYY-MM-DD] [--year 2025] [--caen-latest auto|rev2|rev3]\n" +
        "  [--split-rows 5000] [--require-description] [--sample]",
    );
    process.exit(2);
  }
  buildFinShards(opts).catch((error) => {
    console.error(error instanceof FinFormatError ? `\n${error.message}\n` : error);
    process.exit(1);
  });
}

#!/usr/bin/env node
/**
 * Builds the Vortex Scan company index from the Trade Register (ONRC) open
 * data into a sharded static index under public/scan-index/v1/, queried in the
 * browser by src/lib/scan/company-search.ts. Node built-ins only.
 *
 *   node --max-old-space-size=8192 scripts/scan/build-company-index.mjs --src <dir>
 *     [--out <dir>] [--date YYYY-MM-DD]
 *
 * <dir> holds od_firme.csv and od_stare_firma.csv ('^'-delimited UTF-8, from
 * https://data.gov.ro/dataset/firme-02-09-2026 — ONRC publishes a new one monthly).
 *
 * Output (format v1):
 *   meta.json       counts, source, shard manifest, name-suffix table
 *   places.json     counties and localities (>= MIN_PLACE companies) with id ranges
 *   t/<n>.txt       term shards: "term \t postings [\t df]" sorted by term; each posting
 *                   is 4 base-64 chars = id * 8 + static score (0-7), best first;
 *                   "pre*" lines hold the top postings of every term starting with "pre"
 *   r/<n>.txt       record shards of RECORDS_PER_SHARD ids: "@county \t city" headers,
 *                   then "cui36 \t name \t yy[i|u] [\t host]" (names front-coded)
 *   c/<n>.txt       CUI → record shard, for lookups by fiscal code
 *
 * Record ids are assigned in (county, locality, name) order, so a place is a
 * contiguous id range: location filters are range checks and the companies
 * of one city sit in the same few record shards.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";

const FORMAT_VERSION = 1;
const RECORDS_PER_SHARD = 2000;
/** Raw bytes per term shard; ~60 % of it after gzip keeps shards well under 150 KB. */
const TERM_SHARD_BYTES = 170_000;
/** Longest posting list kept per term (best-ranked first); df is stored when cut. */
const MAX_POSTINGS = 3000;
/** Postings kept for a "prefix*" line. */
const PREFIX_TOP = 40;
/** Localities with fewer companies are reachable through their county only. */
const MIN_PLACE = 25;
const B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const SUFFIX_CODES = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CUI_BUCKET_BITS = 18;
const VARINT_LAST = "0123456789abcdefghijklmnopqrstuv";
const VARINT_MORE = "ABCDEFGHIJKLMNOPQRSTUVWXYZwxyz-_";

/* -------------------------------------------------------------- arguments */

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, i, all) => (arg.startsWith("--") ? [arg.slice(2), all[i + 1]] : null))
    .filter(Boolean),
);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const SRC = args.src ? path.resolve(args.src) : process.env.ONRC_DIR;
const OUT = path.resolve(args.out ?? path.join(ROOT, "public/scan-index/v1"));
const DATASET_DATE = args.date ?? "2026-09-02";
if (!SRC || !fs.existsSync(path.join(SRC, "od_firme.csv"))) {
  console.error("Usage: node scripts/scan/build-company-index.mjs --src <dir with od_firme.csv>");
  process.exit(1);
}

/* ---------------------------------------------------- status nomenclature */

// Codes from N_STARE_FIRMA.csv (ONRC). A company carries several; the worst wins.
const RADIATED = new Set(["1084", "1101"]);
const DISSOLVED = new Set(
  "1049 1052 1055 1070 1075 1076 1078 1086 1094 1098 1100 1109 1111 1113 1120 1133 1145".split(" "),
);
const INACTIVE = new Set(
  "1057 1073 1074 1083 1105 1106 1107 1117 1119 1121 1123 1134 1139 1151 2083 2120".split(" "),
);
const ACTIVE = new Set(["1048", "1112"]);
const ST_RADIATED = 1;
const ST_DISSOLVED = 2;
const ST_INACTIVE = 4;
const ST_ACTIVE = 8;

/** Sole traders, individual and family businesses: natural persons, left out (GDPR). */
const NATURAL_PERSON_FORMS = new Set(["PF", "PFA", "II", "IF", "AF"]);
const NATURAL_PERSON_NAME =
  /(PERSOAN[AĂ] FIZIC[AĂ]|[IÎ]NTREPRINDERE (INDIVIDUAL|FAMILIAL)|ASOCIA[TȚŢ]IE FAMILIAL|\s(PFA|PF|II|IF|AF)$)/i;

/* ------------------------------------------------------------- normalising */

const fixCedilla = (s) =>
  s.replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț");

const fold = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const LEGAL_TAILS = [
  ["societate", "cu", "raspundere", "limitata"],
  ["s", "r", "l", "d"],
  ["srl", "d"],
  ["s", "r", "l"],
  ["s", "n", "c"],
  ["s", "c", "s"],
  ["s", "c", "a"],
  ["g", "e", "i", "e"],
  ["g", "i", "e"],
  ["s", "a"],
  ["r", "a"],
  ["s", "e"],
  ["srl"],
  ["sa"],
  ["snc"],
  ["scs"],
  ["sca"],
  ["ra"],
  ["gie"],
  ["geie"],
  ["se"],
];

/**
 * Search tokens of a name: diacritics folded, legal-form tail and "S.C."
 * prefix dropped, runs of initials joined ("M.D." → "md"). Kept identical to
 * tokenizeName() in src/lib/scan/company-search.ts.
 */
function tokenizeName(name) {
  let tokens = fold(name)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((t) => t !== "srl");
  let changed = true;
  while (changed && tokens.length > 1) {
    changed = false;
    for (const tail of LEGAL_TAILS) {
      if (tokens.length <= tail.length) continue;
      if (tail.every((t, i) => tokens[tokens.length - tail.length + i] === t)) {
        tokens = tokens.slice(0, tokens.length - tail.length);
        changed = true;
        break;
      }
    }
  }
  if (tokens.length > 1 && tokens[0] === "sc") tokens = tokens.slice(1);
  else if (tokens.length > 2 && tokens[0] === "s" && tokens[1] === "c") tokens = tokens.slice(2);
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].length === 1 && tokens[i + 1]?.length === 1) {
      let run = tokens[i];
      while (tokens[i + 1]?.length === 1) run += tokens[++i];
      out.push(run);
    } else out.push(tokens[i]);
  }
  return out;
}

/** Index terms: tokens of 2+ chars, plus "e"+"mag" joins so "E-MAG" answers "emag". */
function indexTerms(tokens) {
  const terms = new Set();
  tokens.forEach((t, i) => {
    if (t.length >= 2) terms.add(t.slice(0, 30));
    if (t.length === 1 && tokens[i + 1]?.length > 1) terms.add((t + tokens[i + 1]).slice(0, 30));
  });
  return [...terms];
}

function cleanName(raw) {
  return fixCedilla(raw)
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/["“”„«»`´]/g, " ")
    .replace(/(^|\s)'+|'+(?=\s|$)/g, "$1")
    .replace(/[~\t]/g, "-")
    .replace(/\s+([,)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+/g, " ")
    .trim();
}

const titleCase = (s) =>
  s
    .toLocaleLowerCase("ro")
    .replace(/(^|[\s\-(.])(\p{L})/gu, (_, p, c) => p + c.toLocaleUpperCase("ro"));

const isUpper = (s) => s === s.toLocaleUpperCase("ro");

function cleanCounty(raw) {
  const s = fixCedilla(raw).replace(/\s+/g, " ").trim();
  if (!s || /^[-.\d\s]*$/.test(s)) return "";
  return isUpper(s) ? titleCase(s) : s;
}

function cleanLocality(raw) {
  let s = fixCedilla(raw).replace(/\s+/g, " ").trim();
  if (!s || /negasit/i.test(s)) return "";
  if (/^bucure[șs]ti\b/i.test(s)) return "București";
  s = s.split(",")[0].trim();
  s = s.replace(
    /^(municipiul|mun\.|ora[șs]ul|ora[șs]|comuna|com\.|satul|sat|loc\.|localitatea)\s+/i,
    "",
  );
  return isUpper(s) ? titleCase(s) : s;
}

const SOCIAL_HOSTS =
  /(^|\.)(facebook|fb|instagram|linkedin|youtube|tiktok|twitter|x|google|olx|wordpress|blogspot|yahoo|gmail)\.[a-z]+$/;

function cleanWebsite(raw) {
  for (const part of raw.toLowerCase().split(/[\s,;]+/)) {
    if (!part || part.includes("@")) continue;
    const host = part
      .replace(/^[a-z]+:\/*/, "")
      .split(/[/?#]/)[0]
      .replace(/:\d+$/, "")
      .replace(/\.+$/, "");
    if (!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host)) continue;
    if (host.startsWith("www.") && host.split(".").length < 3) continue;
    if (SOCIAL_HOSTS.test(host)) continue;
    return host;
  }
  return "";
}

/* ------------------------------------------------------------------ input */

async function* readRows(file) {
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let header = null;
  for await (const line of rl) {
    if (!header) {
      header = line.replace(/^\ufeff/, "").split("^");
      continue;
    }
    if (line) yield line.split("^");
  }
}

async function columns(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: "utf8" }) });
  for await (const line of rl) {
    rl.close();
    return Object.fromEntries(
      line
        .replace(/^\ufeff/, "")
        .split("^")
        .map((name, i) => [name.trim(), i]),
    );
  }
  return {};
}

const t0 = Date.now();
const log = (...m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...m);

const firmeFile = path.join(SRC, "od_firme.csv");
const C = await columns(firmeFile);
for (const col of [
  "DENUMIRE",
  "CUI",
  "COD_INMATRICULARE",
  "DATA_INMATRICULARE",
  "FORMA_JURIDICA",
]) {
  if (C[col] === undefined) throw new Error(`od_firme.csv is missing column ${col}`);
}

const excluded = {
  naturalPersons: 0,
  noCui: 0,
  radiated: 0,
  dissolved: 0,
  duplicates: 0,
};
let sourceRows = 0;
const rows = [];
const byRegNo = new Map();

for await (const c of readRows(firmeFile)) {
  sourceRows++;
  const regNo = (c[C.COD_INMATRICULARE] ?? "").trim();
  const form = (c[C.FORMA_JURIDICA] ?? "").trim().toUpperCase();
  const rawName = c[C.DENUMIRE] ?? "";
  if (
    NATURAL_PERSON_FORMS.has(form) ||
    regNo.startsWith("F") ||
    (!form && NATURAL_PERSON_NAME.test(rawName.trim()))
  ) {
    excluded.naturalPersons++;
    continue;
  }
  const cui = (c[C.CUI] ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!cui || cui.length > 10) {
    excluded.noCui++;
    continue;
  }
  const year = Number((c[C.DATA_INMATRICULARE] ?? "").match(/\b(19|20)\d\d\b/)?.[0]);
  byRegNo.set(regNo, rows.length);
  rows.push({
    cui,
    rawName,
    county: c[C.ADR_JUDET] ?? "",
    city: c[C.ADR_LOCALITATE] ?? "",
    web: c[C.WEB] ?? "",
    year: year >= 1900 && year <= 2100 ? year : 0,
    st: 0,
  });
}
log(`read ${sourceRows} rows, ${rows.length} legal entities with a CUI`);

for await (const [regNo, code] of readRows(path.join(SRC, "od_stare_firma.csv"))) {
  const i = byRegNo.get(regNo);
  if (i === undefined) continue;
  const code_ = (code ?? "").trim();
  if (RADIATED.has(code_)) rows[i].st |= ST_RADIATED;
  else if (DISSOLVED.has(code_)) rows[i].st |= ST_DISSOLVED;
  else if (INACTIVE.has(code_)) rows[i].st |= ST_INACTIVE;
  else if (ACTIVE.has(code_)) rows[i].st |= ST_ACTIVE;
}
byRegNo.clear();
log("statuses applied");

const STATUS_RANK = { active: 3, unknown: 2, inactive: 1 };
const byCui = new Map();
let kept = [];
for (const row of rows) {
  if (row.st & ST_RADIATED) {
    excluded.radiated++;
    continue;
  }
  if (row.st & ST_DISSOLVED) {
    excluded.dissolved++;
    continue;
  }
  const status = row.st & ST_INACTIVE ? "inactive" : row.st & ST_ACTIVE ? "active" : "unknown";
  const name = cleanName(row.rawName);
  const tokens = tokenizeName(name);
  const rec = {
    cui: row.cui,
    name,
    county: cleanCounty(row.county),
    city: cleanLocality(row.city),
    web: cleanWebsite(row.web),
    year: row.year,
    status,
    terms: indexTerms(tokens),
  };
  const prev = byCui.get(rec.cui);
  if (prev !== undefined) {
    excluded.duplicates++;
    const old = kept[prev];
    const better =
      STATUS_RANK[rec.status] > STATUS_RANK[old.status] ||
      (STATUS_RANK[rec.status] === STATUS_RANK[old.status] && rec.year > old.year);
    if (better) kept[prev] = rec;
    continue;
  }
  byCui.set(rec.cui, kept.length);
  kept.push(rec);
}
rows.length = 0;
byCui.clear();
log(`kept ${kept.length} companies`);
if (kept.length >= 2 ** 21) throw new Error("Too many records for 21-bit ids");

/* ------------------------------------------------------------- ordering */

for (const r of kept) {
  r.kCounty = fold(r.county);
  r.kCity = fold(r.city);
  r.kName = fold(r.name);
}
kept.sort((a, b) =>
  a.kCounty !== b.kCounty
    ? a.kCounty < b.kCounty
      ? -1
      : 1
    : a.kCity !== b.kCity
      ? a.kCity < b.kCity
        ? -1
        : 1
      : a.kName < b.kName
        ? -1
        : a.kName > b.kName
          ? 1
          : 0,
);
const N = kept.length;

/* ----------------------------------------------------------- name suffixes */

// The legal-form tail (" S.R.L.", " SRL" …) is stored as "~<code>" — exact and ~10 % smaller.
const LEGAL_WORD =
  /^(S\.?R\.?L\.?(-?D\.?)?|S\.?A\.?|S\.?N\.?C\.?|S\.?C\.?S\.?|S\.?C\.?A\.?|R\.?A\.?|G\.?I\.?E\.?|G\.?E\.?I\.?E\.?|S\.?E\.?|S\.?C\.?M\.?)$/i;
const suffixCount = new Map();
for (const r of kept) {
  const cut = r.name.lastIndexOf(" ");
  if (cut > 0 && LEGAL_WORD.test(r.name.slice(cut + 1))) {
    const suffix = r.name.slice(cut);
    suffixCount.set(suffix, (suffixCount.get(suffix) ?? 0) + 1);
  }
}
const suffixes = [...suffixCount]
  .filter(([, n]) => n >= 20)
  .sort((a, b) => b[1] - a[1])
  .slice(0, SUFFIX_CODES.length)
  .map(([s]) => s);
const suffixIndex = new Map(suffixes.map((s, i) => [s, SUFFIX_CODES[i]]));
const storedName = (name) => {
  const cut = name.lastIndexOf(" ");
  const code = cut > 0 ? suffixIndex.get(name.slice(cut)) : undefined;
  return code ? `${name.slice(0, cut)}~${code}` : name;
};

/* --------------------------------------------------------------- postings */

const active = new Uint8Array(N);
const hasWeb = new Uint8Array(N);
const termCount = new Uint8Array(N);
const nameLen = new Uint16Array(N);
const firstTerm = new Array(N);
const postings = new Map();
kept.forEach((r, id) => {
  active[id] = r.status === "active" ? 1 : 0;
  hasWeb[id] = r.web ? 1 : 0;
  termCount[id] = Math.min(r.terms.length, 255);
  nameLen[id] = Math.min(r.name.length, 65535);
  firstTerm[id] = r.terms[0];
  for (const term of r.terms) {
    let list = postings.get(term);
    if (!list) postings.set(term, (list = []));
    list.push(id);
  }
});

/** 0-7: first word of the name (4), active (2), short name of 1-2 words (1). */
const staticScore = (term, id) =>
  (firstTerm[id] === term ? 4 : 0) + (active[id] ? 2 : 0) + (termCount[id] <= 2 ? 1 : 0);

const ranked = (a, b) =>
  b.s - a.s ||
  hasWeb[b.id] - hasWeb[a.id] ||
  termCount[a.id] - termCount[b.id] ||
  nameLen[a.id] - nameLen[b.id] ||
  a.id - b.id;

const encode = (id, score) => {
  const v = id * 8 + score;
  return B64[(v >> 18) & 63] + B64[(v >> 12) & 63] + B64[(v >> 6) & 63] + B64[v & 63];
};

const terms = [...postings.keys()].sort();
const termLists = new Map();
let postingCount = 0;
for (const term of terms) {
  const list = postings
    .get(term)
    .map((id) => ({ id, s: staticScore(term, id) }))
    .sort(ranked);
  postingCount += list.length;
  termLists.set(term, list);
}
postings.clear();
log(`${terms.length} terms, ${postingCount} postings`);

const termLine = (term) => {
  const list = termLists.get(term);
  const top = list.length > MAX_POSTINGS ? list.slice(0, MAX_POSTINGS) : list;
  const body = top.map((p) => encode(p.id, p.s)).join("");
  return list.length > MAX_POSTINGS ? `${term}\t${body}\t${list.length}` : `${term}\t${body}`;
};

function lowerBound(sorted, key) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const prefixLine = (prefix) => {
  const best = new Map();
  for (let i = lowerBound(terms, prefix); i < terms.length && terms[i].startsWith(prefix); i++) {
    for (const p of termLists.get(terms[i]).slice(0, PREFIX_TOP)) {
      const seen = best.get(p.id);
      if (!seen || seen.s < p.s) best.set(p.id, p);
    }
  }
  const top = [...best.values()].sort(ranked).slice(0, PREFIX_TOP);
  return `${prefix}*\t${top.map((p) => encode(p.id, p.s)).join("")}`;
};

/* ------------------------------------------------------------ term shards */

const lines = new Map(terms.map((t) => [t, termLine(t)]));
const truncatedTerms = [...termLists.values()].filter((l) => l.length > MAX_POSTINGS).length;

const shards = [];
{
  let current = [];
  let bytes = 0;
  for (const term of terms) {
    const size = Buffer.byteLength(lines.get(term)) + 1;
    if (current.length && bytes + size > TERM_SHARD_BYTES) {
      shards.push(current);
      current = [];
      bytes = 0;
    }
    current.push(term);
    bytes += size;
  }
  if (current.length) shards.push(current);
}

const lcp = (a, b) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

// Every prefix whose terms straddle a shard boundary gets a "prefix*" line with
// its best postings, so a short, popular prefix is answered from one shard.
// "prefix*" sorts right after "prefix", so it joins the shard that range holds.
const prefixes = new Set();
for (let i = 1; i < shards.length; i++) {
  const a = shards[i - 1][shards[i - 1].length - 1];
  const b = shards[i][0];
  for (let len = 2; len <= Math.min(lcp(a, b), 12); len++) prefixes.add(a.slice(0, len));
}
const firstKeys = shards.map((s) => s[0]);
for (const prefix of prefixes) {
  const key = `${prefix}*`;
  lines.set(key, prefixLine(prefix));
  const shard = shards[Math.max(0, lowerBound(firstKeys, key + "\0") - 1)];
  shard.splice(lowerBound(shard, key), 0, key);
}
log(`${shards.length} term shards, ${prefixes.size} prefix lines`);
termLists.clear();

/* ------------------------------------------------------------------ write */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "t"), { recursive: true });
fs.mkdirSync(path.join(OUT, "r"), { recursive: true });

const sizes = { files: 0, bytes: 0, gzip: 0, maxTermGzip: 0, maxRecordGzip: 0 };
function write(rel, content) {
  const buf = Buffer.from(content);
  fs.writeFileSync(path.join(OUT, rel), buf);
  const gz = zlib.gzipSync(buf, { level: 9 }).length;
  sizes.files++;
  sizes.bytes += buf.length;
  sizes.gzip += gz;
  return gz;
}

shards.forEach((shard, i) => {
  const gz = write(`t/${i}.txt`, shard.map((k) => lines.get(k)).join("\n") + "\n");
  sizes.maxTermGzip = Math.max(sizes.maxTermGzip, gz);
});
const termShards = shards.map((s) => s[0]);
log(`wrote ${shards.length} term shards`);

const counties = [];
const cities = [];
let place = null;
const recordShards = Math.ceil(N / RECORDS_PER_SHARD);
const cuiShard = [];
for (let n = 0; n < recordShards; n++) {
  const out = [];
  let header = null;
  let previous = "";
  for (let id = n * RECORDS_PER_SHARD; id < Math.min(N, (n + 1) * RECORDS_PER_SHARD); id++) {
    const r = kept[id];
    const key = `${r.county}\t${r.city}`;
    if (key !== header) {
      out.push(`@${key}`);
      header = key;
      previous = "";
    }
    const yy = r.year ? String(r.year % 100).padStart(2, "0") : "";
    const st = r.status === "inactive" ? "i" : r.status === "unknown" ? "u" : "";
    const stored = storedName(r.name);
    const shared = Math.min(lcp(previous, stored), B64.length - 1);
    // Front coding: "^<n>rest" reuses n chars of the previous name ('^' never occurs in a name).
    const name = shared >= 3 ? `^${B64[shared]}${stored.slice(shared)}` : stored;
    previous = stored;
    out.push(`${Number(r.cui).toString(36)}\t${name}\t${yy}${st}${r.web ? `\t${r.web}` : ""}`);
    cuiShard.push([Number(r.cui), n]);

    if (!place || place.county !== r.county || place.city !== r.city) {
      if (!counties.length || counties[counties.length - 1][0] !== r.county) {
        counties.push([r.county, id, id + 1]);
      }
      place = { county: r.county, city: r.city, start: id };
      cities.push([r.city, counties.length - 1, id, id + 1]);
    }
    counties[counties.length - 1][2] = id + 1;
    cities[cities.length - 1][3] = id + 1;
  }
  const gz = write(`r/${n}.txt`, out.join("\n") + "\n");
  sizes.maxRecordGzip = Math.max(sizes.maxRecordGzip, gz);
}
log(`wrote ${recordShards} record shards`);

// CUI → record shard, bucketed by CUI >> CUI_BUCKET_BITS. Each entry is the gap to the
// previous CUI (base-32 digits, all but the last from VARINT_MORE) + 2 base-64 chars
// for the record shard, whose lines are then scanned for the CUI.
cuiShard.sort((a, b) => a[0] - b[0]);
const cuiBuckets = new Map();
for (const [cui, shard] of cuiShard) {
  const bucket = cui >> CUI_BUCKET_BITS;
  let entry = cuiBuckets.get(bucket);
  if (!entry) cuiBuckets.set(bucket, (entry = { last: bucket << CUI_BUCKET_BITS, parts: [] }));
  let gap = cui - entry.last;
  entry.last = cui;
  let digits = VARINT_LAST[gap & 31];
  for (gap >>= 5; gap > 0; gap >>= 5) digits = VARINT_MORE[gap & 31] + digits;
  entry.parts.push(digits + B64[shard >> 6] + B64[shard & 63]);
}
fs.mkdirSync(path.join(OUT, "c"), { recursive: true });
for (const [bucket, entry] of cuiBuckets) write(`c/${bucket}.txt`, entry.parts.join("") + "\n");
log(`wrote ${cuiBuckets.size} CUI buckets`);

// places.json: counties [name, start, end) and cities [name, county index, start, end).
const countyIndex = new Map();
const places = { counties: [], cities: [] };
counties.forEach(([name, start, end], i) => {
  if (!name) return;
  countyIndex.set(i, places.counties.length);
  places.counties.push([name, start, end]);
});
for (const [name, county, start, end] of cities) {
  if (name && countyIndex.has(county) && end - start >= MIN_PLACE) {
    places.cities.push([name, countyIndex.get(county), start, end]);
  }
}
write("places.json", JSON.stringify(places));

const counts = {
  sourceRows,
  kept: N,
  active: active.reduce((n, a) => n + a, 0),
  inactive: kept.filter((r) => r.status === "inactive").length,
  unknown: kept.filter((r) => r.status === "unknown").length,
  withWebsite: hasWeb.reduce((n, a) => n + a, 0),
  excluded,
  terms: terms.length,
  postings: postingCount,
  truncatedTerms,
  places: places.cities.length,
};

const meta = {
  format: "vortex-scan-company-index",
  version: FORMAT_VERSION,
  generatedAt: new Date().toISOString(),
  source: {
    name: "ONRC — Firme înregistrate la Registrul Comerțului (data.gov.ro open data)",
    url: `https://data.gov.ro/dataset/firme-${DATASET_DATE.split("-").reverse().join("-")}`,
    files: ["od_firme.csv", "od_stare_firma.csv", "n_stare_firma.csv"],
    datasetDate: DATASET_DATE,
    license: "CC-BY-4.0",
  },
  scope:
    "Legal entities only (no PF, PFA, II, IF, AF: natural persons are excluded). Radiated, dissolved, in liquidation and bankrupt companies are excluded; temporarily inactive and insolvent ones are kept and flagged.",
  counts,
  encoding: {
    base64: B64,
    posting:
      "4 base64 chars = id * 8 + score; score bits: 4 first word, 2 active, 1 one-or-two-word name",
    record:
      "cui (base 36) \\t name \\t yy + (i inactive | u unknown) [\\t host]; name '^<n>rest' = n chars of the previous name + rest, '~<code>' = nameSuffixes",
    recordHeader: "@county \\t locality",
    cuiBucket: `c/<cui >> ${CUI_BUCKET_BITS}>.txt: per entry the CUI gap in base-32 digits (leading digits from VARINT_MORE, last from VARINT_LAST), then the record shard in 2 base64 chars`,
    varintMore: VARINT_MORE,
    varintLast: VARINT_LAST,
  },
  cuiBucketBits: CUI_BUCKET_BITS,
  recordsPerShard: RECORDS_PER_SHARD,
  recordShards,
  maxPostings: MAX_POSTINGS,
  prefixTop: PREFIX_TOP,
  minPlace: MIN_PLACE,
  nameSuffixes: suffixes,
  termShards,
  tradeOffs: [
    "Registration number, street address, postal code and sector are not stored (ANAF returns them for the selected company).",
    `Posting lists keep the ${MAX_POSTINGS} best-ranked companies per word; the true count is stored, and other words or the city narrow a search.`,
    `Localities with fewer than ${MIN_PLACE} companies are matched through their county.`,
    "No CAEN codes: the open data lists authorised activities, not the main one (ANAF supplies it).",
  ],
};
// meta.json counts itself in the totals below.
const metaBytes = Buffer.byteLength(JSON.stringify(meta, null, 2)) + 400;
meta.size = {
  files: sizes.files + 1,
  bytes: sizes.bytes + metaBytes,
  gzipBytes: sizes.gzip + Math.round(metaBytes / 3),
  maxTermShardGzip: sizes.maxTermGzip,
  maxRecordShardGzip: sizes.maxRecordGzip,
};
fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2) + "\n");

log("done", {
  ...counts,
  files: meta.size.files,
  mb: (meta.size.bytes / 1e6).toFixed(1),
  gzipMb: (meta.size.gzipBytes / 1e6).toFixed(1),
  maxTermShardGzipKb: (sizes.maxTermGzip / 1024).toFixed(0),
  maxRecordShardGzipKb: (sizes.maxRecordGzip / 1024).toFixed(0),
});

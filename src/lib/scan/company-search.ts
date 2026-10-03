import type { CompanySuggestion, SearchIntent } from "@/lib/scan/types";

/*
 * Company search over the static Trade Register index in public/scan-index/v1
 * (built by scripts/scan/build-company-index.mjs, format described in its
 * header and in meta.json). Browser-safe and importable on the server: shards
 * are fetched on demand and kept in memory, so typing a longer query reuses
 * what the shorter one loaded.
 */

export const SCAN_INDEX_BASE: string =
  (import.meta.env?.VITE_SCAN_INDEX_BASE as string | undefined) ?? "/scan-index/v1";

let indexBase = SCAN_INDEX_BASE;
let fetchImpl: typeof fetch | undefined;

/** Points the search at another index location or fetch (scripts, server use). */
export function configureScanIndex(options: { base?: string; fetch?: typeof fetch }) {
  if (options.base) indexBase = options.base.replace(/\/+$/, "");
  if (options.fetch) fetchImpl = options.fetch;
  cache.clear();
}

/* ------------------------------------------------------------ normalising */

const fixCedilla = (s: string) =>
  s.replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț");

/** Lower-case ASCII folding: "Timișoara" → "timisoara". */
export const foldText = (s: string) =>
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
 * Search tokens of a company name: diacritics folded, legal-form tail and
 * "S.C." prefix dropped, runs of initials joined ("M.D." → "md"). Must stay
 * identical to tokenizeName() in the build script.
 */
export function tokenizeName(name: string): string[] {
  let tokens = foldText(name)
    .split(/[^a-z0-9]+/)
    .filter((t) => t && t !== "srl");
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
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].length === 1 && tokens[i + 1]?.length === 1) {
      let run = tokens[i];
      while (tokens[i + 1]?.length === 1) run += tokens[++i];
      out.push(run);
    } else out.push(tokens[i]);
  }
  return out;
}

const QUERY_STOPWORDS = new Set([
  "de",
  "si",
  "la",
  "din",
  "cu",
  "pe",
  "in",
  "pentru",
  "the",
  "and",
  "of",
  "firma",
]);

/** Query words: a lone initial joins the next word ("e mag" → "emag"), stop words go. */
function queryWords(query: string): string[] {
  const tokens = tokenizeName(query);
  const words: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].length === 1 && i + 1 < tokens.length) words.push(tokens[i] + tokens[++i]);
    else words.push(tokens[i].slice(0, 30));
  }
  const useful = words.filter((w) => !QUERY_STOPWORDS.has(w));
  return [...new Set(useful.length ? useful : words)].slice(0, 6);
}

/* ---------------------------------------------------------------- intent */

const KNOWN_TLDS = new Set(
  (
    "ro md eu com net org info biz io co ai app dev shop store online site tech digital agency " +
    "studio design media cloud solutions services consulting health clinic dental care " +
    "law finance travel restaurant cafe bar hotel fitness beauty salon auto realestate " +
    "de at ch fr it es nl be uk pl hu bg cz sk gr se no dk fi pt ie us ca me tv"
  ).split(" "),
);
const FREE_MAIL = /^(gmail|yahoo|hotmail|outlook|icloud|live|mail|ymail|protonmail)\./;

/**
 * What the visitor typed: a CUI (optionally "RO"-prefixed), a website or
 * e-mail domain, or a company name.
 */
export function parseSearchIntent(input: string): SearchIntent {
  const raw = input.trim().replace(/\s+/g, " ");
  if (!raw) return { kind: "empty" };

  const cui = raw.replace(/[\s.\-/]/g, "").match(/^(?:ro)?(\d{2,10})$/i);
  if (cui) return { kind: "cui", cui: cui[1].replace(/^0+(?=\d)/, "") };

  const email = raw.match(/^[^\s@]+@([a-z0-9.-]+\.[a-z]{2,24})$/i);
  if (email && !FREE_MAIL.test(email[1].toLowerCase())) {
    return {
      kind: "website",
      url: `https://${email[1].toLowerCase()}`,
      host: email[1].toLowerCase(),
    };
  }

  if (!raw.includes(" ")) {
    const explicit = /^(https?:\/\/|www\.)/i.test(raw);
    const candidate = raw.replace(/^[a-z]+:\/\//i, "");
    const host = candidate.split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
    const valid =
      /^([a-z0-9\u00a1-\uffff](?:[a-z0-9\u00a1-\uffff-]{0,61}[a-z0-9\u00a1-\uffff])?\.)+[a-z\u00a1-\uffff]{2,24}$/i;
    const tld = host.slice(host.lastIndexOf(".") + 1);
    if (valid.test(host) && (explicit || KNOWN_TLDS.has(tld))) {
      try {
        const url = new URL(`https://${candidate}`);
        const path = url.pathname.replace(/\/+$/, "");
        return { kind: "website", url: `https://${url.host}${path}`, host: url.hostname };
      } catch {
        // Not a URL after all — search it as a name.
      }
    }
  }
  return { kind: "name", query: raw };
}

/** True when the CUI's last digit matches its control key (catches most typos). */
export function isValidCui(cui: string): boolean {
  const digits = cui.replace(/^ro/i, "").replace(/\D/g, "");
  if (digits.length < 2 || digits.length > 10) return false;
  const body = digits.slice(0, -1).padStart(9, "0");
  const key = "753217532";
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * Number(key[i]);
  const control = ((sum * 10) % 11) % 10;
  return control === Number(digits[digits.length - 1]);
}

/* -------------------------------------------------------- display names */

const LEGAL_FORMS: Record<string, string> = {
  srl: "SRL",
  "s.r.l.": "SRL",
  "s.r.l": "SRL",
  "srl-d": "SRL-D",
  "s.r.l.-d": "SRL-D",
  "s.r.l.-d.": "SRL-D",
  "s.r.l-d": "SRL-D",
  sa: "SA",
  "s.a.": "SA",
  "s.a": "SA",
  snc: "SNC",
  "s.n.c.": "SNC",
  scs: "SCS",
  "s.c.s.": "SCS",
  sca: "SCA",
  "s.c.a.": "SCA",
  ra: "RA",
  "r.a.": "RA",
  gie: "GIE",
  "g.i.e.": "GIE",
  geie: "GEIE",
  "s.e.": "SE",
  scm: "SCM",
  ifn: "IFN",
  "i.f.n.": "IFN",
};
const MINOR_WORDS = new Set([
  "de",
  "si",
  "și",
  "din",
  "la",
  "pe",
  "cu",
  "in",
  "în",
  "al",
  "ale",
  "a",
  "pentru",
  "sau",
  "of",
  "and",
  "the",
  "for",
  "du",
  "des",
  "et",
  "und",
]);
const ABBREVIATIONS: Record<string, string> = {
  dr: "Dr",
  ing: "Ing",
  sf: "Sf",
  prof: "Prof",
  mc: "Mc",
};
const ROMAN = /^(ii|iii|iv|vi|vii|viii|ix|xi|xii|xiii|xiv|xv|xx)$/;

function titleWord(word: string): string {
  return word
    .toLocaleLowerCase("ro")
    .replace(
      /(^|[-/(.&+])(\p{L})/gu,
      (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("ro"),
    )
    .replace(/'(\p{L}{2,})/gu, (_, rest: string) =>
      rest === "s" ? `'${rest}` : `'${rest[0].toLocaleUpperCase("ro")}${rest.slice(1)}`,
    );
}

/**
 * Readable company name: "VORTEX HUB S.R.L." → "Vortex Hub SRL". Acronyms,
 * Roman numerals and words with digits stay upper-case; names already in
 * mixed case keep their casing.
 */
export function prettifyCompanyName(name: string): string {
  let words = fixCedilla(name)
    .replace(/["“”„«»`´]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words.length > 1 && /^s\.?c\.?$/i.test(words[0])) words = words.slice(1);
  const shouting = !/\p{Ll}/u.test(words.join(" "));

  return words
    .map((word, i) => {
      const lower = word.toLocaleLowerCase("ro");
      const bare = lower.replace(/[,;:]+$/, "");
      const trail = lower.slice(bare.length);
      if (LEGAL_FORMS[bare] && (i > 0 || words.length === 1)) return LEGAL_FORMS[bare] + trail;
      if (!shouting) return word;
      const letters = bare.replace(/[^\p{L}]/gu, "");
      if (ABBREVIATIONS[letters] && /^\p{L}+\.?$/u.test(bare))
        return word[0] + bare.slice(1) + trail;
      if (i > 0 && MINOR_WORDS.has(bare)) return lower;
      if (/\d/.test(word) || ROMAN.test(bare)) return word.toLocaleUpperCase("ro");
      if (/^(\p{L}\.){2,}$/u.test(bare) || /^\p{L}\.$/u.test(bare))
        return word.toLocaleUpperCase("ro");
      if (letters.length <= 5 && letters && !/[aeiouăâîy]/.test(letters)) {
        return word.toLocaleUpperCase("ro");
      }
      if (letters.length === 2 && letters === bare && !MINOR_WORDS.has(bare)) {
        return word.toLocaleUpperCase("ro");
      }
      return titleWord(word);
    })
    .join(" ");
}

/* ------------------------------------------------------------- loading */

const B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const SUFFIX_CODES = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const VARINT_LAST = "0123456789abcdefghijklmnopqrstuv";
const VARINT_MORE = "ABCDEFGHIJKLMNOPQRSTUVWXYZwxyz-_";
const B64_INDEX = new Int8Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64_INDEX[B64.charCodeAt(i)] = i;

type IndexMeta = {
  version: number;
  recordsPerShard: number;
  recordShards: number;
  termShards: string[];
  nameSuffixes: string[];
  cuiBucketBits: number;
  source: { datasetDate: string };
};

type TermShard = { keys: string[]; postings: string[]; cut: boolean[] };

/** A county or locality of the index: a contiguous range of record ids. */
export type IndexPlace = {
  name: string;
  county: string;
  kind: "city" | "county";
  key: string;
  tokens: string[];
  start: number;
  end: number;
};

/** One company of the index, by record id (displayName is added by toSuggestion). */
export type IndexRecord = Omit<CompanySuggestion, "displayName"> & { id: number };

type RecordShard = { start: number; records: IndexRecord[] };

const cache = new Map<string, Promise<unknown>>();
/** Shards kept in memory (~150 KB each at most); the oldest go first. */
const MAX_CACHED = 120;
const PINNED = new Set(["meta.json", "places.json"]);

function load<T>(file: string, parse: (text: string) => T): Promise<T> {
  const hit = cache.get(file);
  if (hit) {
    // Re-insert so the Map's order doubles as least-recently-used.
    cache.delete(file);
    cache.set(file, hit);
    return hit as Promise<T>;
  }
  for (const key of cache.keys()) {
    if (cache.size < MAX_CACHED) break;
    if (!PINNED.has(key)) cache.delete(key);
  }
  const promise = (async () => {
    const res = await (fetchImpl ?? fetch)(`${indexBase}/${file}`);
    if (!res.ok) throw new Error(`Company index ${file}: HTTP ${res.status}`);
    const text = await res.text();
    // A dev server may answer a missing file with the app's HTML page.
    if (text.startsWith("<")) throw new Error(`Company index ${file}: not found`);
    return parse(text);
  })();
  cache.set(file, promise);
  promise.catch(() => cache.delete(file));
  return promise;
}

export const loadIndexMeta = () => load("meta.json", (text) => JSON.parse(text) as IndexMeta);

const ALIASES: Record<string, string[]> = { bucuresti: ["bucharest"] };

export const loadIndexPlaces = () =>
  load("places.json", (text) => {
    const raw = JSON.parse(text) as {
      counties: Array<[string, number, number]>;
      cities: Array<[string, number, number, number]>;
    };
    const place = (
      name: string,
      county: string,
      kind: IndexPlace["kind"],
      start: number,
      end: number,
    ): IndexPlace => {
      const key = foldText(name);
      const tokens = key.split(/[^a-z0-9]+/).filter(Boolean);
      return { name, county, kind, key, tokens: [...tokens, ...(ALIASES[key] ?? [])], start, end };
    };
    return {
      counties: raw.counties.map(([name, start, end]) => place(name, name, "county", start, end)),
      cities: raw.cities.map(([name, county, start, end]) =>
        place(name, raw.counties[county]?.[0] ?? "", "city", start, end),
      ),
    };
  });

const loadTermShard = (n: number) =>
  load(`t/${n}.txt`, (text): TermShard => {
    const shard: TermShard = { keys: [], postings: [], cut: [] };
    for (const line of text.split("\n")) {
      if (!line) continue;
      const [key, postings = "", df] = line.split("\t");
      shard.keys.push(key);
      shard.postings.push(postings);
      shard.cut.push(Boolean(df));
    }
    return shard;
  });

function loadRecordShard(meta: IndexMeta, n: number) {
  return load(`r/${n}.txt`, (text): RecordShard => {
    const start = n * meta.recordsPerShard;
    const records: IndexRecord[] = [];
    let county = "";
    let city = "";
    let previous = "";
    for (const line of text.split("\n")) {
      if (!line) continue;
      if (line[0] === "@") {
        [county = "", city = ""] = line.slice(1).split("\t");
        previous = "";
        continue;
      }
      const [cui36, field = "", info = "", host] = line.split("\t");
      const stored =
        field[0] === "^"
          ? previous.slice(0, B64_INDEX[field.charCodeAt(1)]) + field.slice(2)
          : field;
      previous = stored;
      const code = stored.length > 2 && stored[stored.length - 2] === "~" ? stored.slice(-1) : "";
      const suffix = code ? meta.nameSuffixes[SUFFIX_CODES.indexOf(code)] : undefined;
      const name = suffix !== undefined ? stored.slice(0, -2) + suffix : stored;
      const [, yy, flag] = info.match(/^(\d\d)?([iu])?$/) ?? [];
      const year = yy ? Number(yy) : undefined;
      records.push({
        id: start + records.length,
        cui: String(parseInt(cui36, 36)),
        name,
        county: county || undefined,
        city: city || undefined,
        status: flag === "i" ? "inactive" : flag === "u" ? "unknown" : "active",
        founded: year === undefined ? undefined : year >= 50 ? 1900 + year : 2000 + year,
        website: host ? `https://${host}` : undefined,
      });
    }
    return { start, records };
  });
}

/** Records by id, loading the shards they live in (in parallel). */
export async function loadIndexRecords(ids: number[]): Promise<Map<number, IndexRecord>> {
  const meta = await loadIndexMeta();
  const shardIds = [...new Set(ids.map((id) => Math.floor(id / meta.recordsPerShard)))];
  const shards = await Promise.all(shardIds.map((n) => loadRecordShard(meta, n)));
  const out = new Map<number, IndexRecord>();
  const byShard = new Map(shardIds.map((n, i) => [n, shards[i]]));
  for (const id of ids) {
    const shard = byShard.get(Math.floor(id / meta.recordsPerShard));
    const record = shard?.records[id - shard.start];
    if (record) out.set(id, record);
  }
  return out;
}

/** The company with this CUI, via the CUI buckets (null when the index has none). */
export async function findCompanyByCui(cui: string): Promise<CompanySuggestion | null> {
  const value = Number(cui.replace(/\D/g, ""));
  if (!value) return null;
  const meta = await loadIndexMeta();
  const bucket = Math.floor(value / 2 ** meta.cuiBucketBits);
  let text: string;
  try {
    text = await load(`c/${bucket}.txt`, (t) => t.trim());
  } catch {
    return null;
  }
  let current = bucket * 2 ** meta.cuiBucketBits;
  let i = 0;
  while (i < text.length) {
    let gap = 0;
    let more = VARINT_MORE.indexOf(text[i]);
    while (more >= 0) {
      gap = gap * 32 + more;
      more = VARINT_MORE.indexOf(text[++i]);
    }
    const last = VARINT_LAST.indexOf(text[i]);
    if (last < 0) return null;
    current += gap * 32 + last;
    const shard = B64_INDEX[text.charCodeAt(i + 1)] * 64 + B64_INDEX[text.charCodeAt(i + 2)];
    i += 3;
    if (current > value) return null;
    if (current === value) {
      const { records } = await loadRecordShard(meta, shard);
      const record = records.find((r) => r.cui === String(value));
      return record ? toSuggestion(record) : null;
    }
  }
  return null;
}

export function toSuggestion({ id: _id, ...record }: IndexRecord): CompanySuggestion {
  return { ...record, displayName: prettifyCompanyName(record.name) };
}

/* --------------------------------------------------------------- matching */

function lowerBound(sorted: string[], key: string) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Index of the last shard whose first key is <= key. */
const shardOf = (firstKeys: string[], key: string) =>
  Math.max(0, lowerBound(firstKeys, key + "\0") - 1);

function addPostings(names: Map<number, number>, postings: string, base: number) {
  for (let i = 0; i + 4 <= postings.length; i += 4) {
    const v =
      (B64_INDEX[postings.charCodeAt(i)] << 18) |
      (B64_INDEX[postings.charCodeAt(i + 1)] << 12) |
      (B64_INDEX[postings.charCodeAt(i + 2)] << 6) |
      B64_INDEX[postings.charCodeAt(i + 3)];
    const id = v >> 3;
    const score = base + (v & 7);
    if ((names.get(id) ?? -1) < score) names.set(id, score);
  }
}

/** Optimal string alignment distance, giving up above `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

export type NameMatch = {
  word: string;
  /** Record id → match score (exact > prefix > typo, plus the static rank). */
  names: Map<number, number>;
  /** False when a posting list was cut, so a missing id isn't proof of no match. */
  complete: boolean;
  fuzzy: boolean;
};

/**
 * Companies whose name has a word starting with `word`. Prefixes spread over
 * more than `maxShards` shards fall back to the "word*" line (best matches only).
 */
export async function matchNameWord(word: string, maxShards = 2): Promise<NameMatch> {
  const names = new Map<number, number>();
  const result: NameMatch = { word, names, complete: true, fuzzy: false };
  if (word.length < 2) return { ...result, complete: false };
  const { termShards } = await loadIndexMeta();
  const lo = shardOf(termShards, word);
  const hi = shardOf(termShards, word + "{");

  if (hi - lo + 1 > maxShards) {
    const [own, top] = await Promise.all([
      loadTermShard(lo),
      loadTermShard(shardOf(termShards, `${word}*`)),
    ]);
    const exact = lowerBound(own.keys, word);
    if (own.keys[exact] === word) addPostings(names, own.postings[exact], 40);
    const star = lowerBound(top.keys, `${word}*`);
    if (top.keys[star] === `${word}*`) addPostings(names, top.postings[star], 26);
    return { ...result, complete: false };
  }

  const shards = await Promise.all(
    Array.from({ length: hi - lo + 1 }, (_, i) => loadTermShard(lo + i)),
  );
  let found = 0;
  for (const shard of shards) {
    for (let i = lowerBound(shard.keys, word); i < shard.keys.length; i++) {
      const key = shard.keys[i];
      if (!key.startsWith(word)) break;
      if (key.endsWith("*")) continue;
      found++;
      if (shard.cut[i]) result.complete = false;
      const base = key === word ? 40 : 28 - Math.min(4, (key.length - word.length) / 2);
      addPostings(names, shard.postings[i], base);
    }
  }

  // Typo tolerance: nothing starts with the word, so try close terms in its shard.
  if (!found && word.length >= 4) {
    const max = word.length >= 8 ? 2 : 1;
    const shard = shards[0];
    const close: Array<{ i: number; d: number }> = [];
    shard.keys.forEach((key, i) => {
      if (key.endsWith("*") || key[0] !== word[0]) return;
      const d = Math.min(
        editDistance(word, key, max),
        key.length > word.length
          ? editDistance(word, key.slice(0, word.length), max) + 0.5
          : max + 1,
      );
      if (d <= max) close.push({ i, d });
    });
    close
      .sort((a, b) => a.d - b.d || shard.postings[b.i].length - shard.postings[a.i].length)
      .slice(0, 5)
      .forEach(({ i, d }) => addPostings(names, shard.postings[i], 18 - d * 2));
    result.fuzzy = close.length > 0;
  }
  return result;
}

type PlaceHit = { start: number; end: number; score: number };

/** Counties and localities whose name has a word starting with `word` (3+ chars). */
function matchPlaces(places: { counties: IndexPlace[]; cities: IndexPlace[] }, word: string) {
  const hits: PlaceHit[] = [];
  if (word.length < 3) return hits;
  for (const place of [...places.cities, ...places.counties]) {
    const city = place.kind === "city";
    let score = 0;
    for (const token of place.tokens) {
      if (token === word) score = Math.max(score, city ? 30 : 24);
      else if (token.startsWith(word)) score = Math.max(score, city ? 24 : 20);
    }
    if (score) hits.push({ start: place.start, end: place.end, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 80);
}

/** Places named exactly `city` (and in `county` when given). */
export async function findIndexPlaces(city?: string, county?: string) {
  const places = await loadIndexPlaces();
  const countyKey = county ? foldText(county).replace(/^(municipiul|judetul)\s+/, "") : "";
  const cityKey = city
    ? foldText(city).replace(/^(municipiul|mun\.|orasul|oras|comuna)\s+/, "")
    : "";
  const counties = countyKey ? places.counties.filter((p) => p.key === countyKey) : [];
  const cities = cityKey
    ? places.cities.filter(
        (p) => p.key === cityKey && (!countyKey || foldText(p.county) === countyKey),
      )
    : [];
  return { cities, counties };
}

const inPlaces = (hits: PlaceHit[], id: number) => {
  let best = 0;
  for (const hit of hits) if (id >= hit.start && id < hit.end && hit.score > best) best = hit.score;
  return best;
};

/* ----------------------------------------------------------------- search */

type WordMatch = NameMatch & { places: PlaceHit[] };
type Candidate = { id: number; score: number; verify: string[] };

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
}

/** Tokens with a lone initial joined to the next word, as queries are ("E.ON" → "eon"). */
function joinedTokens(name: string) {
  const tokens = tokenizeName(name);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    out.push(tokens[i].length === 1 && i + 1 < tokens.length ? tokens[i] + tokens[++i] : tokens[i]);
  }
  return out;
}

/**
 * Live suggestions for the search box. Words match name-word prefixes
 * anywhere in the name; a word that names a county or locality may match the
 * company's seat instead ("dental tim" → dental companies in Timiș), and two
 * words may match one ("smart bill" → SmartBill). CUIs are looked up directly;
 * websites return no suggestions (the UI offers a website scan instead).
 */
export async function searchCompanies(
  query: string,
  opts: { limit?: number; signal?: AbortSignal; city?: string } = {},
): Promise<CompanySuggestion[]> {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 25);
  const intent = parseSearchIntent(query);
  if (intent.kind === "cui") {
    const company = await findCompanyByCui(intent.cui);
    abortIfNeeded(opts.signal);
    return company ? [company] : [];
  }
  if (intent.kind !== "name") return [];
  const all = queryWords(intent.query);
  // A one-letter word being typed ("vortex h") is checked on the names found.
  const initials = all.filter((w) => w.length === 1);
  const words = all.filter((w) => w.length > 1);
  if (!words.length) return [];

  const [places, boost] = await Promise.all([
    loadIndexPlaces(),
    opts.city ? findIndexPlaces(opts.city) : Promise.resolve(null),
  ]);
  const [matches, compounds] = await Promise.all([
    Promise.all(
      words.map(async (word): Promise<WordMatch> => {
        const match = await matchNameWord(word);
        // A lone word is a name; places only qualify another word ("dental tim").
        return { ...match, places: words.length > 1 ? matchPlaces(places, word) : [] };
      }),
    ),
    Promise.all(
      words.slice(1).map((word, i) => matchNameWord(words[i] + word, 1).catch(() => null)),
    ),
  ]);
  abortIfNeeded(opts.signal);
  const boostHits = (boost?.cities ?? []).map((p) => ({ start: p.start, end: p.end, score: 12 }));

  const pool = new Set<number>();
  for (const m of [...matches, ...compounds]) if (m) for (const id of m.names.keys()) pool.add(id);

  for (const relaxed of [false, true]) {
    if (relaxed && words.length < 2) break;
    const candidates: Candidate[] = [];
    for (const id of pool) {
      let score = 0;
      let missing = 0;
      const verify = [...initials];
      const covered = new Set<number>();
      compounds.forEach((c, i) => {
        const s = c?.names.get(id);
        if (s === undefined || covered.has(i) || covered.has(i + 1)) return;
        score += s * 2;
        covered.add(i).add(i + 1);
      });
      matches.forEach((m, i) => {
        if (covered.has(i)) return;
        const place = inPlaces(m.places, id);
        const name = m.names.get(id);
        if (name !== undefined) {
          // Short words that also name a place lean towards the place.
          const exact = name >= 40;
          score += (m.places.length && !exact ? name - 6 : name) + place / 2;
        } else if (place) score += place;
        else if (!m.complete) {
          verify.push(m.word);
          score += 6;
        } else missing++;
      });
      if (missing > (relaxed ? 1 : 0)) continue;
      score += inPlaces(boostHits, id) - missing * 25;
      candidates.push({ id, score, verify });
    }
    // Stable sort: ties keep posting order (website, fewer words, shorter name first).
    candidates.sort((a, b) => b.score - a.score);

    const results = await resolve(candidates, all, limit, opts.signal);
    if (results.length || relaxed) return results;
  }
  return [];
}

/** Loads the best candidates' records, checks unverified words, applies the final ranking. */
async function resolve(
  candidates: Candidate[],
  words: string[],
  limit: number,
  signal?: AbortSignal,
): Promise<CompanySuggestion[]> {
  const kept: Array<{ record: IndexRecord; score: number }> = [];
  const batch = limit + 6;
  const phrase = words.join(" ");
  const compact = words.join("");
  for (let round = 0; round < 3 && round * batch < candidates.length; round++) {
    // Later rounds only when the first left the list mostly empty (each costs shard fetches).
    if (round > 0 && kept.length >= Math.ceil(limit / 2)) break;
    const slice = candidates.slice(round * batch, (round + 1) * batch);
    const records = await loadIndexRecords(slice.map((c) => c.id));
    abortIfNeeded(signal);
    for (const c of slice) {
      const record = records.get(c.id);
      if (!record) continue;
      const tokens = joinedTokens(record.name);
      const has = (w: string) => tokens.some((t) => t.startsWith(w));
      if (!c.verify.every(has)) continue;
      const name = tokens.join(" ");
      const solid = tokens.join("");
      let score = c.score;
      if (name === phrase || solid === compact) score += 40;
      else if (name.startsWith(phrase) || solid.startsWith(compact)) score += 15;
      score += record.status === "active" ? 6 : record.status === "unknown" ? 2 : -6;
      if (record.website) score += 3;
      score -= Math.min(9, Math.max(0, tokens.length - words.length) * 1.5);
      kept.push({ record, score });
    }
  }
  return kept
    .sort((a, b) => b.score - a.score || a.record.name.length - b.record.name.length)
    .slice(0, limit)
    .map(({ record }) => toSuggestion(record));
}

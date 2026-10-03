import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { parseFinShard, selectPeers } from "../../../src/lib/deep/parse/fin-shard";
import { quantile as engineQuantile } from "../../../src/lib/deep/parse/format";
import {
  buildFinShards,
  checkDescription,
  FinFormatError,
  normCaen,
  parseHeader,
  quantile,
} from "../../../scripts/scan/build-fin-shards.mjs";
import { DESCRIPTION, HEADER, syntheticFirms, writeSyntheticSample } from "./synthetic.mjs";

/*
 * The Ministry of Finance shard builder, on the synthetic sample only (the real
 * download is not approved). The output is read back with the engine's own
 * parser (src/lib/deep/parse/fin-shard.ts), so builder and reader cannot drift.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SCRIPT = path.join(ROOT, "scripts/scan/build-fin-shards.mjs");
/** The byte-order mark some MF files start with. */
const BOM = String.fromCharCode(0xfeff);
const BUILT_AT = "2026-10-03T00:00:00.000Z";
const DATES = { date: "2026-06-11", datePrev: "2025-06-12" };

let work: string;
let sample: string;
const firms = syntheticFirms();

type Built = Awaited<ReturnType<typeof buildFinShards>>;
const build = (name: string, extra: Record<string, unknown> = {}): Promise<Built> =>
  buildFinShards({
    src: sample,
    index: path.join(sample, "index"),
    out: path.join(work, name),
    sample: true,
    quiet: true,
    builtAt: BUILT_AT,
    ...DATES,
    ...extra,
  });

before(() => {
  work = mkdtempSync(path.join(os.tmpdir(), "vortex-fin-"));
  sample = path.join(work, "sample");
  writeSyntheticSample(sample);
});
after(() => rmSync(work, { recursive: true, force: true }));

test("the header check accepts the MF layout and fails loudly on any change", () => {
  const ok = parseHeader(`${BOM}${HEADER.join(",")}\r`);
  assert.equal(ok.delimiter, ",");
  assert.equal(ok.index.I13, 14);
  assert.equal(parseHeader(HEADER.join(";")).delimiter, ";");

  const missing = HEADER.filter((c) => c !== "I20").join(",");
  assert.throws(
    () => parseHeader(missing, "web_uu_an2026.txt"),
    (e: Error) => {
      assert.ok(e instanceof FinFormatError);
      assert.match(e.message, /web_uu_an2026\.txt: the MF file format changed/);
      assert.match(e.message, /missing:\s+I20/);
      return true;
    },
  );
  assert.throws(() => parseHeader(`${HEADER.join(",")},I21`), /new:\s+I21/);
  const swapped = [...HEADER];
  [swapped[14], swapped[15]] = [swapped[15], swapped[14]];
  assert.throws(() => parseHeader(swapped.join(",")), /different order/);
  assert.throws(() => parseHeader("cod_fiscal,caen_rev3,cifra_afaceri"), FinFormatError);
});

test("the column description must still mean what the builder reads", () => {
  const text = DESCRIPTION.map(([l, c]) => `${l};${c}`).join("\r\n");
  assert.deepEqual(checkDescription(text), ["I4", "I13", "I15", "I16", "I17", "I18", "I19", "I20"]);
  const moved = text.replace("Cifra de afaceri neta;i13", "Venituri din exploatare;i13");
  assert.throws(
    () => checkDescription(moved, "web_bl_2026.csv"),
    (e: Error) => {
      assert.match(e.message, /web_bl_2026\.csv: the MF indicators changed meaning/);
      assert.match(e.message, /I13 is now "venituri din exploatare"/);
      return true;
    },
  );
  assert.throws(
    () => checkDescription(text.replace(/\r\nNumar mediu de salariati;i20/, "")),
    /I20 is not described/,
  );
});

test("CAEN classes keep four digits and the leading zero MF drops", () => {
  assert.equal(normCaen("111"), "0111");
  assert.equal(normCaen(" 8623 "), "8623");
  assert.equal(normCaen('"4941"'), "4941");
  assert.equal(normCaen("8623.0"), "8623");
  assert.equal(normCaen("0"), "");
  assert.equal(normCaen("86"), "");
  assert.equal(normCaen("86231"), "");
});

test("the builder's quantile is the engine's", () => {
  const values = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5].sort((a, b) => a - b);
  for (const q of [0, 0.25, 0.5, 0.75, 1])
    assert.equal(quantile(values, q), engineQuantile(values, q));
});

test("shards hold exactly the kept firms, in the engine's line format, largest first", async () => {
  const { out, meta } = await build("flat");
  const rows = new Map<string, ReturnType<typeof parseFinShard>[number] & { caen: string }>();
  for (const name of readdirSync(out).filter((n) => /^\d{4}\.txt$/.test(n))) {
    const text = readFileSync(path.join(out, name), "utf8");
    assert.match(
      text.split("\n")[0],
      /^# SAMPLE \(synthetic, not real companies\) · Ministerul Finanțelor/,
    );
    const parsed = parseFinShard(text);
    const turnovers = parsed.map((r) => r.turnover);
    assert.deepEqual(
      turnovers,
      [...turnovers].sort((a, b) => b - a),
      `${name} sorted by turnover`,
    );
    for (const r of parsed) rows.set(r.cui, { ...r, caen: name.slice(0, 4) });
  }
  const kept = firms.filter((f) => f.expect === "kept");
  assert.equal(rows.size, kept.length);
  assert.equal(meta.counts.kept, kept.length);
  for (const f of firms) {
    const r = rows.get(String(f.cui));
    if (f.expect !== "kept") {
      assert.equal(r, undefined, `${f.cui} (${f.expect}) left out`);
      continue;
    }
    assert.ok(r, `${f.cui} kept`);
    const a = f.y2025;
    assert.equal(r.turnover, a.turnover);
    assert.equal(r.turnoverPrev, f.y2024?.turnover);
    assert.equal(r.profitPretax, a.profitBrut - a.pierdereBruta);
    assert.equal(r.profitNet, a.profitNet - a.pierdereNeta);
    assert.equal(r.employees, a.staff);
    assert.equal(r.receivables, a.receivables);
    assert.equal(r.expenses, a.expenses);
    assert.equal(r.county, f.countyCode);
    assert.equal(r.locality, f.city);
    const expected = f.caen2025 === "111" ? "0111" : f.caen2025 === "6210" ? "6201" : f.caen2025;
    assert.equal(r.caen, expected, `${f.cui} class`);
  }
  assert.deepEqual(
    {
      notInIndex: meta.counts.notInIndex,
      dormant: meta.counts.dormant,
      duplicates: meta.counts.duplicates,
      unknownCounty: meta.counts.unknownCounty,
      mappedRev3: meta.counts.mappedRev3,
    },
    { notInIndex: 4, dormant: 5, duplicates: 1, unknownCounty: 2, mappedRev3: 6 },
  );
  assert.equal(meta.inputs.find((i: { file: string }) => i.file === "web_uu_an2025.txt").bad, 1);
  assert.equal(meta.sample, "SYNTHETIC SAMPLE: not real companies. Never publish under public/.");
  assert.deepEqual(meta.schema.notDescribed, []);
  assert.equal(
    meta.sources[0].attribution,
    "Sursa: Ministerul Finanțelor, situații financiare 2025, data.gov.ro, CC BY 4.0",
  );
  assert.equal(meta.sources[0].datasetDate, "2026-06-11");
});

test("a class over --split-rows is cut into county files the engine can read", async () => {
  const { out, meta } = await build("split", { splitRows: 20 });
  assert.deepEqual(meta.splitClasses, ["4941", "8623"]);
  assert.equal(existsSync(path.join(out, "4941.txt")), false);
  const tm = readFileSync(path.join(out, "4941", "TM.txt"), "utf8");
  assert.match(tm.split("\n")[0], /județul TM \(clasă împărțită pe județe\)/);
  const tmRows = parseFinShard(tm);
  assert.ok(tmRows.length > 0 && tmRows.every((r) => r.county === "TM"));
  // The env reader's order: flat file first, then <caen>/<county>.txt.
  const read = (rel: string) =>
    existsSync(path.join(out, rel)) ? readFileSync(path.join(out, rel), "utf8") : null;
  const fin = (caen: string, county?: string) =>
    read(`${caen}.txt`) ?? (county ? read(`${caen}/${county}.txt`) : null);
  assert.ok(fin("4941", "TM"));
  assert.equal(fin("4941"), null);
  assert.ok(fin("0111"), "small classes stay flat");
  // Firms without a county land in XX (never requested by the engine) and stay in the counts.
  assert.ok(existsSync(path.join(out, "8623", "XX.txt")));
});

test("bands use the engine's quantile and hide counties under 5 firms", async () => {
  const { out, bench } = await build("bench");
  const rows = parseFinShard(readFileSync(path.join(out, "8623.txt"), "utf8"));
  const turnovers = rows.map((r) => r.turnover).sort((a, b) => a - b);
  const classBench = JSON.parse(readFileSync(path.join(out, "8623", "bench.json"), "utf8"));
  assert.equal(classBench.national.turnover.p50, Math.round(engineQuantile(turnovers, 0.5)));
  assert.equal(classBench.national.turnover.n, rows.length);
  const tm = rows.filter((r) => r.county === "TM");
  const margins = tm.map((r) => (r.profitPretax ?? 0) / r.turnover).sort((a, b) => a - b);
  assert.equal(
    classBench.counties.TM.marginPretax.p25,
    Math.round(engineQuantile(margins, 0.25) * 1e4) / 1e4,
  );
  // 6201 has three firms in each of two counties: counts only, no bands.
  const it = JSON.parse(readFileSync(path.join(out, "6201", "bench.json"), "utf8"));
  for (const c of Object.values(it.counties) as Array<Record<string, unknown>>) {
    assert.ok((c.n as number) < 5);
    assert.deepEqual(Object.keys(c), ["n"]);
  }
  assert.deepEqual(bench.classes["SAMPLE-8623"].turnover, [
    classBench.national.turnover.p25,
    classBench.national.turnover.p50,
    classBench.national.turnover.p75,
    classBench.national.turnover.n,
  ]);
});

test("the national bench is a marked sample whose keys can never match a real class", async () => {
  const { bench } = await build("marked");
  assert.equal(bench._meta.sample, true);
  assert.match(bench._meta.note, /SYNTHETIC SAMPLE/);
  assert.ok(Object.keys(bench.classes).length > 0);
  for (const key of Object.keys(bench.classes)) assert.match(key, /^SAMPLE-\d{4}$/);
});

test("the committed fin-bench-national.json is this sample, rebuilt", async () => {
  const { benchOut, bench } = await build("committed");
  const committed = JSON.parse(
    readFileSync(path.join(ROOT, "src/lib/deep/data/fin-bench-national.json"), "utf8"),
  );
  assert.deepEqual(JSON.parse(readFileSync(benchOut, "utf8")), committed);
  assert.deepEqual(committed, bench);
  assert.equal(committed._meta.sample, true);
});

test("meta.json hashes and sizes match the files written", async () => {
  const { out, meta } = await build("hashes");
  let bytes = 0;
  for (const [rel, hash] of Object.entries(meta.hashes as Record<string, string>)) {
    const buf = readFileSync(path.join(out, rel));
    bytes += buf.length;
    assert.equal(createHash("sha256").update(buf).digest("hex").slice(0, 32), hash, rel);
  }
  assert.equal(meta.size.bytes, bytes);
  assert.equal(meta.size.files, Object.keys(meta.hashes).length);
  assert.ok(meta.size.largestFile.bytes <= 3 * 1024 * 1024);
});

test("synthetic data never reaches public/ and real output never comes from the sample", async () => {
  await assert.rejects(
    build("x", { out: path.join(ROOT, "public/scan-index/v1/fin") }),
    /must not go under public/,
  );
  assert.equal(existsSync(path.join(ROOT, "public/scan-index/v1/fin")), false);
  await assert.rejects(build("y", { sample: false }), /is the synthetic sample/);
});

test("a file over the size limit fails and leaves the previous output untouched", async () => {
  const { out } = await build("size");
  const before = readFileSync(path.join(out, "meta.json"), "utf8");
  await assert.rejects(
    build("size", { maxFileBytes: 1000 }),
    /above the 0\.00 MB limit per file|limit per file/,
  );
  assert.equal(readFileSync(path.join(out, "meta.json"), "utf8"), before);
  assert.equal(
    readdirSync(work).some((n) => n.includes(".tmp-")),
    false,
  );
});

test("rows that do not parse above 0.5% of a file fail loudly", async () => {
  const dir = mkdtempSync(path.join(work, "bad-"));
  writeSyntheticSample(dir);
  const file = path.join(dir, "web_uu_an2025.txt");
  const broken = Array.from({ length: 30 }, (_, i) => `${90_100_000 + i},8623,x`).join("\r\n");
  writeFileSync(file, `${readFileSync(file, "utf8")}${broken}\r\n`);
  await assert.rejects(
    buildFinShards({
      src: dir,
      index: path.join(dir, "index"),
      out: path.join(dir, "out"),
      sample: true,
      quiet: true,
    }),
    /31 of \d+ rows do not parse/,
  );
});

test("the engine finds same-county, similar-size peers in the built shard", async () => {
  const { out } = await build("peers");
  const rows = parseFinShard(readFileSync(path.join(out, "8623.txt"), "utf8"));
  const subject = rows.find((r) => r.county === "TM" && r.turnover > 500_000)!;
  const selection = selectPeers(rows, {
    cui: subject.cui,
    countyCode: "TM",
    city: subject.locality,
    turnover: subject.turnover,
  });
  assert.ok(selection);
  assert.ok(selection.peers.length >= 5);
  assert.ok(selection.peers.every((p) => p.cui !== subject.cui));
  if (selection.scope !== "national") assert.ok(selection.peers.every((p) => p.county === "TM"));
});

test("the command line prints the format error and exits 1", () => {
  const dir = mkdtempSync(path.join(work, "cli-"));
  writeSyntheticSample(dir);
  const file = path.join(dir, "web_bl_bs_sl_an2025.txt");
  writeFileSync(file, readFileSync(file, "utf8").replace("I13,", "I13_NOU,"));
  const run = spawnSync(
    process.execPath,
    [
      SCRIPT,
      "--src",
      dir,
      "--index",
      path.join(dir, "index"),
      "--out",
      path.join(dir, "out"),
      "--sample",
    ],
    { encoding: "utf8", timeout: 60_000 },
  );
  assert.equal(run.status, 1);
  assert.match(
    run.stderr,
    /web_bl_bs_sl_an2025\.txt: the MF file format changed; nothing was written/,
  );
  assert.match(run.stderr, /missing:\s+I13/);
  assert.equal(existsSync(path.join(dir, "out")), false);
});

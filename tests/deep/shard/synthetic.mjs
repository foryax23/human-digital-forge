#!/usr/bin/env node
/**
 * A small, clearly SYNTHETIC sample of the Ministry of Finance annual accounts
 * (the "BL/BS/SL" and "UU" layouts, 2024 and 2025) plus a matching slice of the
 * company index, for building and testing scripts/scan/build-fin-shards.mjs
 * while the real download is not approved. Not real companies: every CUI is in
 * the unassigned 90,000,000+ range and every name is "FIRMA SINTETICA nnnn".
 *
 *   node tests/deep/shard/synthetic.mjs <dir>
 *
 * writes <dir>/web_{bl_bs_sl,uu}_an{2024,2025}.txt (+ .csv column
 * descriptions), <dir>/index/{meta.json,r/0.txt} and the SYNTHETIC-SAMPLE.txt
 * marker the builder checks (it refuses to build a non-sample from it).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HEADER = ["CUI", "CAEN", ...Array.from({ length: 20 }, (_, i) => `I${i + 1}`)];

/** The MF column description as published (labels without diacritics, "label;code"). */
export const DESCRIPTION = [
  ["CUI", "CUI"],
  ["CAEN", "CAEN"],
  ["ACTIVE IMOBILIZATE - TOTAL", "i1"],
  ["ACTIVE CIRCULANTE - TOTAL din care:", "i2"],
  ["Stocuri", "i3"],
  ["Creante", "i4"],
  ["Casa si conturi la banci", "i5"],
  ["CHELTUIELI IN AVANS", "i6"],
  ["DATORII", "i7"],
  ["VENITURI IN AVANS", "i8"],
  ["PROVIZIOANE", "i9"],
  ["CAPITALURI - TOTAL din care:", "i10"],
  ["Capital subscris varsat", "i11"],
  ["Patrimoniul regiei", "i12"],
  ["Cifra de afaceri neta", "i13"],
  ["VENITURI TOTALE", "i14"],
  ["CHELTUIELI TOTALE", "i15"],
  ["Profitul brut", "i16"],
  ["Pierdere bruta", "i17"],
  ["Profitul net", "i18"],
  ["Pierdere neta", "i19"],
  ["Numar mediu de salariati", "i20"],
];

export const FIRST_CUI = 90_000_001;

/** Deterministic PRNG (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLACES = {
  TM: ["Timiș", ["Timișoara", "Timișoara", "Timișoara", "Lugoj"]],
  AR: ["Arad", ["Arad", "Arad", "Pecica"]],
  BH: ["Bihor", ["Oradea"]],
  B: ["București", ["București"]],
  CJ: ["Cluj", ["Cluj-Napoca"]],
};

/**
 * The synthetic firms with their ground truth. `y2025` / `y2024` hold the
 * indicators written to the files (undefined = no row that year).
 */
export function syntheticFirms() {
  const rand = rng(20261003);
  const firms = [];
  let cui = FIRST_CUI;
  const pickCounty = (weights) => {
    const total = weights.reduce((s, [, w]) => s + w, 0);
    let x = rand() * total;
    for (const [code, w] of weights) {
      x -= w;
      if (x <= 0) return code;
    }
    return weights[0][0];
  };
  const add = (spec) => {
    const county = spec.county ?? pickCounty(spec.weights);
    const [countyName, towns] = county === "" ? ["", [""]] : PLACES[county];
    const city = spec.city ?? towns[Math.floor(rand() * towns.length)];
    const firm = {
      cui: cui++,
      countyCode: county,
      countyName,
      city,
      inIndex: spec.inIndex ?? true,
      kind: spec.kind ?? (rand() < 0.3 ? "bl_bs_sl" : "uu"),
      caen2025: spec.caen2025,
      caen2024: spec.caen2024,
      y2025: spec.y2025,
      y2024: spec.y2024,
      expect: spec.expect,
    };
    firms.push(firm);
    return firm;
  };
  const accounts = (turnover, staff, marginPretax) => {
    const pretax = Math.round(turnover * marginPretax);
    const net = Math.round(pretax > 0 ? pretax * 0.84 : pretax);
    return {
      turnover: Math.round(turnover),
      receivables: Math.round(turnover * (0.05 + rand() * 0.2)),
      expenses: Math.round(turnover - pretax),
      profitBrut: pretax > 0 ? pretax : 0,
      pierdereBruta: pretax < 0 ? -pretax : 0,
      profitNet: net > 0 ? net : 0,
      pierdereNeta: net < 0 ? -net : 0,
      staff,
    };
  };
  const established = (caen, n, base, weights, staffMax) => {
    for (let i = 0; i < n; i++) {
      const t25 = base * Math.exp((rand() - 0.5) * 3);
      const t24 = t25 / (0.85 + rand() * 0.4);
      const margin = -0.08 + rand() * 0.35;
      const staff = 1 + Math.floor(rand() * staffMax);
      add({
        caen2025: caen,
        caen2024: caen,
        weights,
        y2025: accounts(t25, staff, margin),
        y2024: accounts(t24, Math.max(1, staff - 1), margin * 0.9),
        expect: "kept",
      });
    }
  };
  // Dental clinics: enough per county for county bands.
  established(
    "8623",
    60,
    1_200_000,
    [
      ["TM", 22],
      ["AR", 10],
      ["BH", 8],
      ["B", 12],
      ["CJ", 8],
    ],
    18,
  );
  // Road freight: the class the split test cuts into county files.
  established(
    "4941",
    30,
    3_000_000,
    [
      ["TM", 12],
      ["AR", 8],
      ["B", 10],
    ],
    30,
  );
  // Farming: MF drops the leading zero ("111" for 0111).
  for (let i = 0; i < 8; i++) {
    const t = 400_000 * Math.exp((rand() - 0.5) * 2);
    add({
      caen2025: "111",
      caen2024: "111",
      weights: [
        ["TM", 1],
        ["AR", 1],
      ],
      y2025: accounts(t, 2 + Math.floor(rand() * 6), 0.12),
      y2024: accounts(t * 0.9, 2, 0.1),
      expect: "kept",
    });
  }
  // New IT firms: no 2024 row, Rev.3 code 6210 (→ Rev.2 6201 through the map).
  for (let i = 0; i < 6; i++) {
    add({
      caen2025: "6210",
      weights: [
        ["CJ", 1],
        ["TM", 1],
      ],
      y2025: accounts(150_000 + rand() * 600_000, 1 + Math.floor(rand() * 4), 0.2),
      expect: "kept",
    });
  }
  // Dormant: under 50,000 lei and no employee → left out.
  for (let i = 0; i < 5; i++) {
    add({
      caen2025: "8623",
      caen2024: "8623",
      county: "TM",
      y2025: accounts(10_000, 0, 0.1),
      y2024: accounts(12_000, 0, 0.1),
      expect: "dormant",
    });
  }
  // Small turnover but one employee → kept.
  add({
    caen2025: "8623",
    caen2024: "8623",
    county: "TM",
    city: "Timișoara",
    y2025: accounts(20_000, 1, 0.05),
    y2024: accounts(18_000, 1, 0.05),
    expect: "kept",
  });
  // Not in the company index (natural persons, radiated firms) → left out.
  for (let i = 0; i < 4; i++) {
    add({
      caen2025: "8623",
      caen2024: "8623",
      county: "AR",
      inIndex: false,
      y2025: accounts(900_000, 4, 0.1),
      y2024: accounts(800_000, 4, 0.1),
      expect: "not_in_index",
    });
  }
  // In the index without a county (the index's "@\t" header) → kept, county "".
  for (let i = 0; i < 2; i++) {
    add({
      caen2025: "8623",
      caen2024: "8623",
      county: "",
      city: "",
      y2025: accounts(700_000, 3, 0.1),
      y2024: accounts(650_000, 3, 0.1),
      expect: "kept",
    });
  }
  return firms;
}

const row = (cui, caen, a) => {
  const i = Array(20).fill("0");
  i[3] = String(a.receivables);
  i[12] = String(a.turnover);
  i[13] = String(a.turnover);
  i[14] = String(a.expenses);
  i[15] = String(a.profitBrut);
  i[16] = String(a.pierdereBruta);
  i[17] = String(a.profitNet);
  i[18] = String(a.pierdereNeta);
  i[19] = String(a.staff);
  return [String(cui), caen, ...i].join(",");
};

/** Writes the sample (MF files with CRLF line ends, as published) and returns the firms. */
export function writeSyntheticSample(dir) {
  const firms = syntheticFirms();
  fs.mkdirSync(path.join(dir, "index", "r"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "SYNTHETIC-SAMPLE.txt"),
    "SYNTHETIC SAMPLE: not real companies (CUIs from 90000001, names FIRMA SINTETICA).\n" +
      "Made by tests/deep/shard/synthetic.mjs for scripts/scan/build-fin-shards.mjs.\n",
  );
  for (const year of [2024, 2025]) {
    for (const kind of ["bl_bs_sl", "uu"]) {
      const lines = [HEADER.join(",")];
      for (const f of firms) {
        const a = year === 2025 ? f.y2025 : f.y2024;
        const caen = year === 2025 ? f.caen2025 : f.caen2024;
        if (!a || f.kind !== kind) continue;
        lines.push(row(f.cui, caen, a));
      }
      if (year === 2025 && kind === "uu") {
        // One duplicate (also in bl_bs_sl, smaller turnover: ignored) and one broken row.
        const dup = firms.find((f) => f.kind === "bl_bs_sl" && f.expect === "kept" && f.y2024);
        lines.push(row(dup.cui, dup.caen2025, { ...dup.y2025, turnover: 1 }));
        lines.push(`${FIRST_CUI + 9000},8623,1,2,3`);
      }
      fs.writeFileSync(path.join(dir, `web_${kind}_an${year}.txt`), `${lines.join("\r\n")}\r\n`);
      const description = DESCRIPTION.map(([label, code]) => `${label};${code}`).join("\r\n");
      if (kind === "uu") {
        // Windows-1250, as some MF descriptions are: "Creanţe" with ţ = 0xFE.
        const bytes = Buffer.from(description.replace("Creante;", "Crean\u0000e;"), "latin1");
        bytes[bytes.indexOf(0)] = 0xfe;
        fs.writeFileSync(path.join(dir, `web_${kind}_an${year}.csv`), bytes);
      } else {
        fs.writeFileSync(path.join(dir, `web_${kind}_an${year}.csv`), description);
      }
    }
  }
  // Index slice: "@county \t city" headers, then "cui36 \t name \t yy".
  const byPlace = new Map();
  for (const f of firms.filter((x) => x.inIndex)) {
    const key = `${f.countyName}\t${f.city}`;
    const list = byPlace.get(key) ?? [];
    list.push(f);
    byPlace.set(key, list);
  }
  const out = [];
  for (const [key, list] of [...byPlace].sort()) {
    out.push(`@${key}`);
    for (const f of list) {
      out.push(
        `${f.cui.toString(36)}\tFIRMA SINTETICA ${String(f.cui - FIRST_CUI + 1).padStart(4, "0")}~1\t15`,
      );
    }
  }
  fs.writeFileSync(path.join(dir, "index", "r", "0.txt"), `${out.join("\n")}\n`);
  fs.writeFileSync(
    path.join(dir, "index", "meta.json"),
    JSON.stringify({ source: { datasetDate: "2026-09-02 (synthetic)" }, sample: true }, null, 2),
  );
  return firms;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Usage: node tests/deep/shard/synthetic.mjs <dir>");
    process.exit(2);
  }
  const firms = writeSyntheticSample(path.resolve(dir));
  console.log(`wrote ${firms.length} synthetic firms to ${path.resolve(dir)}`);
}

export const SYNTHETIC_DIR = path.dirname(fileURLToPath(import.meta.url));

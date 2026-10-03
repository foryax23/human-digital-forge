import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildCaenMap, buildLabels, buildWages } from "../../../scripts/deep/gen-data";

const committed = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../src/lib/deep/data/${name}`, import.meta.url), "utf8"));

test("generated data files equal their sources", () => {
  assert.deepEqual(committed("wages.json"), buildWages());
  assert.deepEqual(committed("caen-labels.json"), buildLabels());
  assert.deepEqual(committed("caen-rev3-rev2.json"), buildCaenMap());
});

test("the Rev.3 → Rev.2 sample map holds the trial's known changes and is marked as a sample", () => {
  const data = committed("caen-rev3-rev2.json");
  assert.equal(data._meta.sample, true);
  assert.deepEqual(data.map["5611"], ["5610"]);
  assert.deepEqual(data.map["4763"], ["4764"]);
  assert.deepEqual(data.map["7020"], ["7022"]);
  assert.deepEqual(data.map["7112"], ["7112"]);
  assert.deepEqual(data.map["4752"], ["4752"]);
});

test("hour of office work: minimum wage × 1.2 × (1 + CAM) ÷ 168 is about 30 lei", () => {
  const w = buildWages();
  const hour = (w.minGross.value * 1.2 * (1 + w.camRate)) / w.hoursPerMonth;
  assert.ok(hour >= 28 && hour <= 40, String(hour));
  assert.equal(w.hoursPerMonth, 168);
  assert.equal(w.workingDaysPerMonth, 21);
});

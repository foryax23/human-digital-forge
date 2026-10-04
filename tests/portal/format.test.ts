import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  STEP_LABELS,
  consultationStatus,
  formatDay,
  formatMoney,
  invoiceStatus,
  projectStatusLabel,
  serviceLabel,
  stepLabel,
} from "../../src/components/dashboard/format";

// The shared hook's steps, read from its source (importing it would start a Supabase client).
const hook = readFileSync(
  new URL("../../src/hooks/use-dashboard-data.ts", import.meta.url),
  "utf8",
);
const TIMELINE_STEPS = [
  ...(hook.match(/TIMELINE_STEPS = \[([\s\S]*?)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g),
].map((m) => m[1]);

test("steps: one Romanian label per shared timeline step", () => {
  assert.equal(TIMELINE_STEPS.length, 6);
  assert.equal(STEP_LABELS.length, TIMELINE_STEPS.length);
  STEP_LABELS.forEach(([en], i) =>
    assert.ok(en === TIMELINE_STEPS[i] || i === 4, `step ${i}: ${en} / ${TIMELINE_STEPS[i]}`),
  );
  assert.equal(stepLabel(0, "ro"), "Cerere trimisă");
  assert.equal(stepLabel(5, "ro"), "Finalizat");
  assert.equal(stepLabel(99, "ro"), "Finalizat");
  assert.equal(stepLabel(-3, "en"), "Request submitted");
});

test("project status: the team's known words are translated, others shown as written", () => {
  for (const step of TIMELINE_STEPS) assert.notEqual(projectStatusLabel(step, "ro"), step);
  assert.equal(projectStatusLabel("Request submitted", "ro"), "Cerere trimisă");
  assert.equal(projectStatusLabel("work in progress", "ro"), "În lucru");
  assert.equal(projectStatusLabel("Așteptăm logo-ul", "ro"), "Așteptăm logo-ul");
  assert.equal(projectStatusLabel("", "ro"), "Cerere trimisă");
  assert.equal(projectStatusLabel(null, "en"), "Request submitted");
});

test("services and statuses read in Romanian", () => {
  assert.equal(serviceLabel("ai-automation", "ro"), "Automatizare AI");
  assert.equal(serviceLabel("custom-thing", "ro"), "custom thing");
  assert.equal(serviceLabel(null, "ro"), null);
  assert.deepEqual(consultationStatus("requested", "ro"), { label: "Cerută", tone: "unverified" });
  assert.equal(consultationStatus("CONFIRMED", "ro").label, "Confirmată");
  assert.equal(invoiceStatus("overdue", "ro").tone, "bad");
});

test("money and dates in Romanian", () => {
  assert.equal(formatMoney(125000, "ron", "ro"), "1.250,00 lei");
  assert.equal(formatMoney(125000, "RON", "en"), "1,250.00 RON");
  assert.match(formatMoney(4900, "EUR", "ro"), /^49,00\s(€|EUR)$/);
  assert.equal(formatMoney(100, "NOT-A-CODE", "ro"), "1.00 NOT-A-CODE");
  assert.equal(formatDay("2026-10-04T21:30:00Z", "ro"), "5 octombrie 2026");
  assert.equal(formatDay(null, "ro"), "");
  assert.equal(formatDay("not a date", "ro"), "");
});

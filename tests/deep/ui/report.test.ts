import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  DEMO_SECTORS,
  demoReport,
  type DemoVariant,
} from "../../../src/components/deep/fixtures/demo-report";
import { demoRunning } from "../../../src/components/deep/fixtures/states";
import {
  addRival,
  adjustableInputs,
  applyRivalEdits,
  diffReports,
  estimateInputsFrom,
  removeRival,
  withOwnerInputs,
} from "../../../src/components/deep/report-adapter";
import {
  stageProgress,
  stagesOf,
  timeLeftMs,
  timeLeftText,
} from "../../../src/components/deep/stages";
import { csvCell, factsCsv, summaryText } from "../../../src/components/deep/summary";
import { roCount, usd } from "../../../src/components/deep/format";
import { applyCorrections } from "../../../src/lib/deep/report";
import { BANNED_INFERENCES, BANNED_PHRASES, TU_FORMS } from "../../../src/lib/deep/report/words";

/*
 * The report as the page shows it: corrections, the "Ajustează" panel, rival edits, "Ce s-a
 * schimbat", the summary and CSV, the honest timeline, the banned-word grep over the deep UI
 * and the sample reports, and the light theme tokens against src/styles.css.
 */

const VARIANTS: DemoVariant[] = ["ai", "rules", "partial", "third", "new"];

test("the samples are fictional, consistent and complete", () => {
  for (const sector of DEMO_SECTORS) {
    for (const variant of VARIANTS) {
      const r = demoReport(sector, variant, "ro");
      assert.equal(r.lights.length, 5, `${sector}/${variant} lines`);
      assert.match(r.company.website!.url, /\.example$/, "reserved domain");
      // Every count is the length of a list the reader can open.
      assert.equal(r.counts.facts, r.facts.filter((f) => !f.ephemeral).length);
      // Every cited fact exists.
      const ids = new Set(r.facts.map((f) => f.id));
      for (const s of [r.brief.headline, r.brief.meaning, r.brief.customerView, r.brief.rivals])
        for (const sentence of s.sentences)
          for (const id of sentence.factIds) assert.ok(ids.has(id), `${sector}/${variant}: ${id}`);
      if (variant === "third") {
        assert.equal(r.actions.length, 0, "no actions for third parties");
        assert.equal(r.audience, "third_party");
      }
      if (variant === "new") assert.equal(r.firm, "new");
    }
  }
});

test("a correction recomputes lines, actions and totals and hides the sentences citing it", () => {
  const r = demoReport("sanatate", "ai", "ro");
  const before = r.lights.find((l) => l.area === "clienti")!;
  assert.equal(before.state, "atentie");
  assert.ok(r.actions.some((a) => a.factIds.includes("site.booking.present")));
  const fixed = applyCorrections(r, [
    { predicate: "site.booking.present", url: "https://clinica-dentara.example/programari" },
  ]);
  const after = fixed.lights.find((l) => l.area === "clienti")!;
  assert.notEqual(after.state, "atentie", "the line changes at once");
  assert.equal(fixed.facts.find((f) => f.id === "site.booking.present")?.confidence, "declarat");
  assert.equal(
    fixed.actions.some((a) => a.id.includes("booking")),
    false,
    "the booking action is answered",
  );
  const hidden = [fixed.brief.meaning, fixed.brief.customerView]
    .flatMap((s) => s.sentences)
    .filter((s) => s.factIds.includes("site.booking.present"));
  assert.ok(hidden.length && hidden.every((s) => s.hiddenBy), "sentences citing it are hidden");
  // Totals are one line per kind of money and follow the actions left.
  const time = fixed.actions.filter(
    (a) => a.effect?.kind === "time_value_month" && a.effect.value > 0,
  );
  if (!time.length) assert.equal(fixed.totals.timeValueMonth, undefined);
});

test("the Ajustează panel changes estimates, never official figures", () => {
  const r = demoReport("sanatate", "ai", "ro");
  assert.ok(adjustableInputs(r).has("hourValue"));
  assert.deepEqual(
    estimateInputsFrom({ clientsPerMonth: 420, hourValue: 40, turnover2026: 5_000_000 }),
    {
      hourValue: 40,
      bookingsPerDay: 20,
      turnover: 5_000_000,
      ownerTurnover: 1,
    },
  );
  const time = r.totals.timeValueMonth!;
  const adjusted = withOwnerInputs(r, {
    hourValue: time.inputs.hourValue ? time.inputs.hourValue * 2 : 60,
  });
  assert.ok(adjusted.totals.timeValueMonth!.value > time.value, "a dearer hour, more value");
  assert.deepEqual(adjusted.facts, r.facts, "official facts unchanged");
  assert.deepEqual(adjusted.ownerInputs, { hourValue: (time.inputs.hourValue ?? 30) * 2 });
  assert.equal(withOwnerInputs(r, undefined), r);
  // Kinds of money are never added together.
  assert.notEqual(adjusted.totals.timeValueMonth?.kind, adjusted.totals.profitYearPretax?.kind);
});

test("rival edits: removed cards go with their sentences; added cards say where they came from", () => {
  const r = demoReport("sanatate", "ai", "ro");
  const top = r.competitors[0];
  const removed = removeRival(r, top.cui);
  assert.equal(
    removed.competitors.some((c) => c.cui === top.cui),
    false,
  );
  assert.ok(
    removed.brief.rivals.sentences.every((s) => s.hiddenBy),
    "sentence about the rival hidden",
  );
  const added = addRival(removed, { cui: "55555550", name: "Alt Exemplu SRL", city: "Timișoara" });
  const card = added.competitors.at(-1)!;
  assert.equal(card.origin, "owner_added");
  assert.equal(card.whyChosen.ro, "Adăugat de tine");
  assert.equal(
    addRival(added, { cui: r.cui, name: "self" }),
    added,
    "the firm itself is not its rival",
  );
  const edited = applyRivalEdits(r, { removed: [top.cui], added: [card] });
  assert.equal(edited.competitors.length, r.competitors.length);
});

test("'Ce s-a schimbat' lists changed facts by ID", () => {
  const before = demoReport("sanatate", "rules", "ro");
  const after = {
    ...before,
    facts: before.facts.map((f) =>
      f.id === "people.employees.2025" ? { ...f, display: { en: "18", ro: "18" } } : f,
    ),
  };
  const changes = diffReports(before, after, "ro", (f) => f.id);
  assert.deepEqual(changes, [
    { id: "people.employees.2025", label: "people.employees.2025", before: "16", after: "18" },
  ]);
});

test("summary for WhatsApp: headline and the five lines; CSV cells cannot start a formula", () => {
  const r = demoReport("sanatate", "ai", "ro");
  const text = summaryText(r, "ro");
  const lines = text.split("\n");
  assert.ok(lines.length >= 7);
  assert.equal(lines.filter((l) => /^[■◆●□] /.test(l)).length, 5);
  assert.equal(text.includes("http"), false);
  for (const bad of ["=SUM(A1)", "+40722", "-1", "@cmd", "\tx", "\rx"])
    assert.ok(csvCell(bad).startsWith(`"'`), bad);
  assert.equal(csvCell('a "b"'), '"a ""b"""');
  const csv = factsCsv(r, "ro").split("\r\n");
  assert.equal(csv.length, r.facts.length + 1);
});

test("the timeline shows real stages with counts and an honest time left", () => {
  const snap = demoRunning("ro", "ruleaza");
  const stages = stagesOf(snap, "ro");
  assert.equal(stages.length, 9);
  const by = Object.fromEntries(stages.map((s) => [s.id, s]));
  assert.equal(by.identity.status, "done");
  assert.match(by.money.detail!.ro, /^7 din 7 ani cu bilanț/);
  assert.equal(by.signals.status, "running");
  assert.match(by.pages.detail!.ro, /^pagina 6 din aproximativ \d+$/);
  assert.equal(by.analysis.status, "pending");
  const p = stageProgress(stages);
  assert.ok(p.done >= 4 && p.done < 9);
  assert.match(timeLeftText(timeLeftMs(snap)).ro, /^mai durează /);
  assert.equal(timeLeftText(0).ro, "aproape gata");
  const ask = stagesOf(demoRunning("ro", "site"), "ro").find((s) => s.id === "site")!;
  assert.equal(ask.status, "waiting");
});

test("Romanian counts and admin money read naturally", () => {
  assert.equal(roCount(1, "pagină citită", "pagini citite"), "1 pagină citită");
  assert.equal(roCount(14, "pagină citită", "pagini citite"), "14 pagini citite");
  assert.equal(roCount(20, "pagină citită", "pagini citite"), "20 de pagini citite");
  assert.equal(roCount(101, "pagină citită", "pagini citite"), "101 pagini citite");
  assert.equal(usd(1.5, "ro"), "1,50 $");
  assert.equal(usd(0.384, "en", 3), "0.384 $");
});

/* -------------------------------------------------------- banned words */

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "pdf" ? [] : files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const ROOT = new URL("../../../", import.meta.url).pathname;

/** The string literals of a source file (comments left out). */
function literals(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  return [...code.matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map(
    (m) => m[1] ?? m[2] ?? "",
  );
}

test("the deep UI copy has none of the banned words (plan A8)", () => {
  const offenders: string[] = [];
  for (const file of files(join(ROOT, "src/components/deep"))) {
    for (const text of literals(readFileSync(file, "utf8"))) {
      const lower = text.toLowerCase();
      for (const word of [...BANNED_PHRASES, ...BANNED_INFERENCES])
        if (lower.includes(word))
          offenders.push(`${file.replace(ROOT, "")}: "${word}" in "${text.slice(0, 60)}"`);
      // Romanian writes "e-mail"; scores never appear.
      if (/\bemail\b/.test(text) && /[ăâîșț]/i.test(text)) offenders.push(`${file}: email`);
      if (/\b\d{1,3}\s?\/\s?100\b/.test(text))
        offenders.push(`${file}: a score "${text.slice(0, 40)}"`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("the sample reports have no banned words, and third-party prose has no 'tu' forms", () => {
  for (const sector of DEMO_SECTORS) {
    for (const variant of VARIANTS) {
      const r = demoReport(sector, variant, "ro");
      const prose = [
        r.brief.headline,
        r.brief.meaning,
        r.brief.customerView,
        r.brief.rivals,
        r.brief.ifNothing,
        ...r.brief.findings,
      ]
        .flatMap((s) => s?.sentences ?? [])
        .map((s) => s.text);
      const top = [
        ...prose,
        ...r.lights.map((l) => l.reason.ro),
        ...r.actions.map((a) => `${a.title.ro} ${a.why.ro}`),
      ]
        .join(" ")
        .toLowerCase();
      for (const word of [...BANNED_PHRASES, ...BANNED_INFERENCES])
        assert.equal(top.includes(word), false, `${sector}/${variant}: ${word}`);
      if (variant === "third")
        for (const s of prose) assert.equal(TU_FORMS.test(s), false, `third person: ${s}`);
    }
  }
});

/* -------------------------------------------------------- theme tokens */

function block(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, selector);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out = new Map<string, string>();
  for (const m of body.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
    out.set(m[1], m[2].replace(/\s+/g, " ").trim());
  return out;
}

test("the light report re-declares exactly the :root light values of styles.css", () => {
  const styles = readFileSync(join(ROOT, "src/styles.css"), "utf8");
  const deep = readFileSync(join(ROOT, "src/components/deep/deep.module.css"), "utf8");
  const root = block(styles, ":root");
  for (const selector of [".light", ".system"]) {
    const scope = block(deep, selector);
    assert.ok(scope.size >= 40, `${selector}: ${scope.size} tokens`);
    for (const [name, value] of scope) assert.equal(value, root.get(name), `${selector} ${name}`);
    for (const name of root.keys())
      if (name.startsWith("--vx-") && !/shadow|overlay/.test(name))
        assert.ok(scope.has(name), `${selector} misses ${name}`);
  }
});

#!/usr/bin/env node
/**
 * Screenshot sweep and layout checks for "Cercetare aprofundată" (plan D4, D5)
 * and the pages it touches. One headless Chrome at a time, closed in `finally`
 * and killed after --max-seconds (default 110), so a hung page never leaves a
 * browser behind.
 *
 *   node scripts/deep/shots.mjs [--base http://localhost:5184] [--out <dir>]
 *     [--states raport,exemplu:restaurant | all] [--pages home,home#band,home#groups,home#footer,scan,privacy#footer]
 *     [--viewports 390x844,768x1024,1280x720,1440x900,1920x1080 | all]
 *     [--langs ro,en] [--themes dark,light] [--motion on,reduced] [--full]
 *     [--skip-existing] [--max-seconds 110] [--no-fail] [--chrome <path>] [--pdf]
 *
 * puppeteer-core is not a dependency of the app: the script imports it from
 * the project if it is there, else from PUPPETEER_CORE (a node_modules folder
 * that holds it). Chrome comes from --chrome, CHROME_PATH or the macOS default.
 *
 * Every shot runs with sessionStorage "vortex-intro-seen" = "1", the cookie
 * banner answered "reject non-essential", the interface language and the deep
 * report theme set in storage, and prefers-color-scheme / prefers-reduced-motion
 * emulated. Deep states are /scan/deep?demo=<state> (the list is read from
 * src/components/deep/fixtures/demo-keys.ts; "exemplu:restaurant" adds &sector=).
 *
 * Checks per shot (failures make the exit code 1 unless --no-fail):
 *   - no horizontal scroll (document wider than the viewport), with the widest elements;
 *   - no heading or label cut with an ellipsis (text-overflow or clipped overflow);
 *   - on phones (< 768 px): every control at least 44 × 44 px (links inside running text
 *     are listed apart, as WCAG allows), all text at least 13 px, running text (paragraphs
 *     of 60+ characters) at least 16 px (plan A10, report minimums);
 *   - at 390 × 844 in report states: the five lines and "Ce faci acum" / "Ce să verifici"
 *     fit the first screen above the sticky bar;
 *   - page errors and console errors.
 * --pdf also downloads the report's PDF in each report state (built in the browser) and,
 * with pdftoppm installed, renders its pages to PNG beside it.
 * The results go to <out>/report.json; the shots to <out>/<target>__<lang>-<theme>-<w>x<h>[-rm].png.
 * A full sweep is long: run it in batches (--skip-existing continues where the last run stopped).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ALL_VIEWPORTS = ["1920x1080", "1440x900", "1280x720", "768x1024", "390x844"];
const FALLBACK_STATES = [
  "exemplu",
  "formular",
  "ruleaza",
  "site",
  "raport",
  "raport-reguli",
  "raport-tert",
  "raport-nou",
];
const PAGES = {
  home: { path: "/" },
  "home#band": { path: "/", scrollTo: ["Tehnologii cu care lucrăm", "Technologies we work with"] },
  "home#groups": { path: "/", scrollTo: ["Ce folosim și pentru ce", "What we use, and what for"] },
  "home#footer": { path: "/", scrollTo: "bottom" },
  scan: { path: "/scan" },
  "privacy#footer": { path: "/privacy", scrollTo: "bottom" },
};

/* -------------------------------------------------------------- options */

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) opts[key] = true;
    else {
      opts[key] = next;
      i++;
    }
  }
  return opts;
}

const list = (v, fallback) =>
  (typeof v === "string" ? v : fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** The ?demo= states from Eng 2's fixtures, so the sweep follows the page. */
export function demoStates() {
  try {
    const text = fs.readFileSync(
      path.join(ROOT, "src/components/deep/fixtures/demo-keys.ts"),
      "utf8",
    );
    const block = /DEMO_STATES\s*=\s*\[([\s\S]*?)\]/.exec(text)?.[1] ?? "";
    const states = [...block.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
    return states.length ? states : FALLBACK_STATES;
  } catch {
    return FALLBACK_STATES;
  }
}

/** A shot target: a deep demo state ("raport", "exemplu:restaurant") or a page ("home#band"). */
export function targetUrl(base, target) {
  if (PAGES[target]) return `${base}${PAGES[target].path}`;
  const [state, sector] = target.split(":");
  return `${base}/scan/deep?demo=${encodeURIComponent(state)}${sector ? `&sector=${encodeURIComponent(sector)}` : ""}`;
}

export function shotName(target, { lang, theme, w, h, reduced }) {
  const safe = target.replace(/[^a-z0-9-]+/gi, "_");
  return `${safe}__${lang}-${theme}-${w}x${h}${reduced ? "-rm" : ""}.png`;
}

/* ---------------------------------------------------------------- tools */

async function loadPuppeteer() {
  try {
    const mod = await import("puppeteer-core");
    return mod.default ?? mod;
  } catch {
    const dir = process.env.PUPPETEER_CORE;
    if (!dir) {
      throw new Error(
        "puppeteer-core is not installed in this project (it is not an app dependency). " +
          "Point PUPPETEER_CORE at a node_modules folder that has it, e.g. PUPPETEER_CORE=/path/to/node_modules node scripts/deep/shots.mjs",
      );
    }
    const resolved = createRequire(path.join(path.resolve(dir), "noop.js")).resolve(
      "puppeteer-core",
    );
    const mod = await import(pathToFileURL(resolved).href);
    return mod.default ?? mod;
  }
}

const LOCK = path.join(os.tmpdir(), "vortex-shots.lock");
function takeLock() {
  try {
    const pid = Number(fs.readFileSync(LOCK, "utf8"));
    if (pid && pid !== process.pid) {
      try {
        process.kill(pid, 0);
        throw new Error(`another shots run (pid ${pid}) holds ${LOCK}: one Chrome at a time`);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  fs.writeFileSync(LOCK, String(process.pid));
}
function dropLock() {
  try {
    if (Number(fs.readFileSync(LOCK, "utf8")) === process.pid) fs.unlinkSync(LOCK);
  } catch {
    /* gone already */
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------------------------------------- checks */

/** Runs in the page: the layout checks of one shot. */
function pageChecks({ phone, firstScreen, lang }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
    // Visually hidden text for screen readers (.sr-only: 1 px, clipped) is not on screen.
    if (el.closest(".sr-only") || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(s.clip))
      return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
        : "";
    const text = (el.getAttribute("aria-label") || el.textContent || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ""}`;
  };
  const out = {
    horizontalScroll: null,
    ellipsis: [],
    smallTargets: [],
    labelledSmall: [],
    inlineLinks: 0,
    smallText: [],
    smallBody: [],
    firstScreen: null,
  };

  const docWidth = document.documentElement.scrollWidth;
  if (docWidth > vw + 1) {
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1)
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)
      .slice(0, 5)
      .map((el) => `${describe(el)} → ${Math.round(el.getBoundingClientRect().right)}px`);
    out.horizontalScroll = { docWidth, viewport: vw, widest: wide };
  }

  const headings = document.querySelectorAll(
    "h1,h2,h3,h4,h5,h6,[role=heading],label,legend,th,[class*='type-label'],[class*='type-h'],[class*='type-title']",
  );
  for (const el of headings) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const clipped =
      s.overflow !== "visible" && el.scrollWidth > el.clientWidth + 1 && s.whiteSpace === "nowrap";
    if (
      s.textOverflow === "ellipsis" &&
      (el.scrollWidth > el.clientWidth + 1 || s.whiteSpace === "nowrap")
    )
      out.ellipsis.push(describe(el));
    else if (clipped) out.ellipsis.push(`${describe(el)} (clipped)`);
  }

  if (phone) {
    const controls = document.querySelectorAll(
      "a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[role=checkbox],[role=radio],[role=switch]",
    );
    for (const el of controls) {
      if (!visible(el) || el.closest("[aria-hidden=true]")) continue;
      let target = el;
      if ((el.type === "checkbox" || el.type === "radio") && el.closest("label"))
        target = el.closest("label");
      const r = target.getBoundingClientRect();
      if (r.width >= 44 && r.height >= 44) continue;
      const parent = el.parentElement;
      const inline =
        el.tagName === "A" &&
        parent &&
        /^(P|LI|SPAN|SMALL|DD|TD)$/.test(parent.tagName) &&
        (parent.textContent || "").trim().length > (el.textContent || "").trim().length + 10;
      if (inline) {
        out.inlineLinks++;
        continue;
      }
      // A small checkbox or switch whose label (label[for]) takes the tap counts as labelled.
      const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
      if (label && visible(label) && label.getBoundingClientRect().height >= 24) {
        out.labelledSmall.push(`${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
        continue;
      }
      out.smallTargets.push(`${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    const root = document.querySelector("main") || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent.trim();
      const el = node.parentElement;
      if (
        !text ||
        !el ||
        seen.has(el) ||
        !visible(el) ||
        el.closest("[aria-hidden=true],svg,.sr-only")
      )
        continue;
      seen.add(el);
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 13) out.smallText.push(`${describe(el)} ${size}px`);
    }
    for (const p of root.querySelectorAll("p")) {
      if (!visible(p)) continue;
      const text = (p.textContent || "").trim();
      const size = parseFloat(getComputedStyle(p).fontSize);
      if (text.length >= 60 && size < 16) out.smallBody.push(`${describe(p)} ${size}px`);
    }
    out.smallText = out.smallText.slice(0, 20);
    out.smallBody = out.smallBody.slice(0, 20);
  }

  if (firstScreen) {
    const bars = [...document.querySelectorAll("body *")].filter((el) => {
      const s = getComputedStyle(el);
      if (!(s.position === "fixed" || s.position === "sticky") || !visible(el)) return false;
      const r = el.getBoundingClientRect();
      return r.bottom >= vh - 2 && r.top > vh / 2;
    });
    const barTop = bars.length ? Math.min(...bars.map((b) => b.getBoundingClientRect().top)) : vh;
    // The deepest visible element whose text starts with one of the words (an icon may sit beside it).
    const find = (words) => {
      const hits = [
        ...document.querySelectorAll("a,button,h1,h2,h3,h4,p,span,div,li,dt,dd"),
      ].filter((el) => {
        const text = (el.textContent || "").trim();
        return visible(el) && text.length < 48 && words.some((w) => text.startsWith(w));
      });
      return (
        hits.find((el) => !hits.some((other) => other !== el && el.contains(other))) ?? hits[0]
      );
    };
    const cta = find(
      lang === "ro" ? ["Ce faci acum", "Ce să verifici"] : ["What to do now", "What to check"],
    );
    const risk = find(lang === "ro" ? ["Risc"] : ["Risk"]);
    const money = find(lang === "ro" ? ["Bani"] : ["Money"]);
    const bottom = (el) =>
      el ? Math.round(el.getBoundingClientRect().bottom + window.scrollY) : null;
    out.firstScreen = {
      limit: Math.round(barTop),
      cta: bottom(cta),
      lines: bottom(risk),
      money: bottom(money),
      ok: Boolean(cta && risk && money) && bottom(cta) <= barTop && bottom(risk) <= barTop,
    };
  }
  return out;
}

/**
 * --pdf: clicks the report's PDF button (the browser builds the PDF through
 * its fenced dynamic import), waits for the download and, when pdftoppm is
 * installed, renders every page to PNG next to it so the pages can be looked at.
 */
async function downloadPdf(page, dir, target) {
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
  const clicked = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button,a")];
    const pick =
      buttons.find((b) => /Descarcă PDF|Download the PDF/i.test(b.textContent || "")) ??
      buttons.find((b) => /^\s*PDF\s*$/.test(b.textContent || ""));
    pick?.click();
    return Boolean(pick);
  });
  if (!clicked) return { error: "no PDF button" };
  const until = Date.now() + 40_000;
  while (Date.now() < until) {
    const done = fs.readdirSync(dir).find((f) => f.endsWith(".pdf"));
    if (done) {
      await sleep(300);
      fs.renameSync(path.join(dir, done), target);
      const buf = fs.readFileSync(target, "latin1");
      const pages = (buf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      const tool = spawnSync("pdftoppm", ["-v"], { encoding: "utf8" });
      if (!tool.error) {
        spawnSync("pdftoppm", ["-r", "60", "-png", target, target.replace(/\.pdf$/, "-p")], {
          timeout: 60_000,
        });
      }
      return { file: target, pages };
    }
    await sleep(250);
  }
  return { error: "no download within 40 s" };
}

/* ------------------------------------------------------------------ run */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const base = String(opts.base ?? "http://localhost:5184").replace(/\/+$/, "");
  const out = path.resolve(String(opts.out ?? path.join(os.tmpdir(), "vortex-deep-shots")));
  const states =
    opts.states === "all" ? demoStates() : list(opts.states, opts.pages ? "" : "raport");
  const pages = list(opts.pages, "");
  const targets = [...states, ...pages];
  const viewports = (
    opts.viewports === "all" ? ALL_VIEWPORTS : list(opts.viewports, "390x844,1440x900")
  ).map((v) => {
    const [w, h] = v.split("x").map(Number);
    if (!w || !h) throw new Error(`bad viewport ${v}`);
    return { w, h };
  });
  const langs = list(opts.langs, "ro");
  const themes = list(opts.themes, "dark,light");
  const motions = list(opts.motion, "on");
  const maxSeconds = Number(opts["max-seconds"] ?? 110);
  const chrome = String(
    opts.chrome ??
      process.env.CHROME_PATH ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  );
  fs.mkdirSync(out, { recursive: true });

  takeLock();
  const puppeteer = await loadPuppeteer();
  const results = [];
  let browser;
  // With --skip-existing, a batch adds to the report of the batches before it.
  let earlier = [];
  if (opts["skip-existing"]) {
    try {
      earlier = JSON.parse(fs.readFileSync(path.join(out, "report.json"), "utf8")).results ?? [];
    } catch {
      earlier = [];
    }
  }
  const writeReport = (status) => {
    const files = new Set(results.map((r) => r.file));
    const all = [...earlier.filter((r) => !files.has(r.file)), ...results];
    const failures = all.filter((r) => r.fail.length);
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(
        {
          base,
          status,
          at: new Date().toISOString(),
          shots: all.length,
          failed: failures.length,
          results: all,
        },
        null,
        1,
      ),
    );
    return failures;
  };
  const killer = setTimeout(() => {
    console.error(
      `SELF-KILL after ${maxSeconds} s; partial report in ${out}/report.json (use --skip-existing to continue)`,
    );
    writeReport("timeout");
    try {
      browser?.process()?.kill("SIGKILL");
    } catch {
      /* already gone */
    }
    dropLock();
    process.exit(3);
  }, maxSeconds * 1000);

  try {
    browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      args: ["--no-first-run", "--no-default-browser-check"],
    });
    const downloads = path.join(out, ".downloads");
    if (opts.pdf) {
      fs.mkdirSync(downloads, { recursive: true });
      const session = await browser.target().createCDPSession();
      await session.send("Browser.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: downloads,
      });
    }
    for (const { w, h } of viewports) {
      for (const lang of langs) {
        for (const theme of themes) {
          for (const motion of motions) {
            const reduced = motion === "reduced";
            const todo = targets.filter(
              (t) =>
                !(
                  opts["skip-existing"] &&
                  fs.existsSync(path.join(out, shotName(t, { lang, theme, w, h, reduced })))
                ),
            );
            if (!todo.length) continue;
            const page = await browser.newPage();
            const phone = w < 768;
            await page.setViewport({
              width: w,
              height: h,
              deviceScaleFactor: phone ? 2 : 1,
              isMobile: w < 500,
              hasTouch: w < 500,
            });
            await page.emulateMediaFeatures([
              { name: "prefers-color-scheme", value: theme === "light" ? "light" : "dark" },
              { name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" },
            ]);
            await page.evaluateOnNewDocument(
              (lang, theme) => {
                try {
                  sessionStorage.setItem("vortex-intro-seen", "1");
                  localStorage.setItem("vortex-language", lang);
                  localStorage.setItem("vortex-deep:theme", theme);
                  localStorage.setItem(
                    "vortex-cookie-consent",
                    JSON.stringify({
                      necessary: true,
                      analytics: false,
                      marketing: false,
                      timestamp: Date.now(),
                    }),
                  );
                } catch {
                  /* storage blocked: the banner fallback below answers it */
                }
              },
              lang,
              theme,
            );
            const errors = [];
            page.on("pageerror", (e) =>
              errors.push(`pageerror: ${String(e.message).slice(0, 200)}`),
            );
            page.on("console", (m) => {
              if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`);
            });
            for (const target of todo) {
              errors.length = 0;
              const name = shotName(target, { lang, theme, w, h, reduced });
              const url = targetUrl(base, target);
              const fail = [];
              const t0 = Date.now();
              const checksPdf = [];
              try {
                const response = await page.goto(url, {
                  waitUntil: "domcontentloaded",
                  timeout: 45_000,
                });
                if (!response || response.status() >= 400)
                  fail.push(`HTTP ${response?.status() ?? "no response"}`);
                await page
                  .waitForNetworkIdle({ idleTime: 500, timeout: 10_000 })
                  .catch(() => undefined);
                await page.evaluate(() => {
                  document.querySelectorAll("vite-error-overlay").forEach((e) => e.remove());
                  const reject = [...document.querySelectorAll("button")].find((b) =>
                    /Reject non-essential|Respinge (cele )?neesen/i.test(b.textContent || ""),
                  );
                  reject?.click();
                });
                const scroll = PAGES[target]?.scrollTo;
                if (scroll === "bottom")
                  await page.evaluate(() =>
                    window.scrollTo(0, document.documentElement.scrollHeight),
                  );
                else if (Array.isArray(scroll)) {
                  const found = await page.evaluate((words) => {
                    const el = [...document.querySelectorAll("h1,h2,h3,h4,p,span,div")].find(
                      (e) =>
                        e.children.length === 0 &&
                        words.some((w) => (e.textContent || "").trim().startsWith(w)),
                    );
                    if (el)
                      window.scrollTo(
                        0,
                        Math.max(0, el.getBoundingClientRect().top + window.scrollY - 160),
                      );
                    return Boolean(el);
                  }, scroll);
                  if (!found) fail.push(`section not found: ${scroll.join(" / ")}`);
                }
                await sleep(reduced ? 300 : 900);
                const firstScreen =
                  w === 390 && h === 844 && (/^raport/.test(target) || /^exemplu/.test(target));
                const checks = await page.evaluate(pageChecks, {
                  phone: w < 768,
                  firstScreen,
                  lang,
                });
                if (checks.horizontalScroll)
                  fail.push(
                    `horizontal scroll: ${checks.horizontalScroll.docWidth}px > ${checks.horizontalScroll.viewport}px`,
                  );
                // Deep states are held to the report rules (A10); other pages list them for review.
                // Running text under 16 px is always for review: notes and source lines may be 13 px.
                const warn = checks.smallBody.length
                  ? [`running text under 16 px: ${checks.smallBody.length}`]
                  : [];
                const rules = PAGES[target] ? warn : fail;
                if (checks.ellipsis.length)
                  rules.push(`cut headings or labels: ${checks.ellipsis.length}`);
                if (checks.smallTargets.length)
                  rules.push(`targets under 44 px: ${checks.smallTargets.length}`);
                if (checks.smallText.length)
                  rules.push(`text under 13 px: ${checks.smallText.length}`);
                if (checks.firstScreen && !checks.firstScreen.ok)
                  fail.push("first phone screen: lines or the next-step link below the fold");
                const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
                if (pageErrors.length) fail.push(`page errors: ${pageErrors.length}`);
                await page.screenshot({
                  path: path.join(out, name),
                  fullPage: Boolean(opts.full),
                  captureBeyondViewport: Boolean(opts.full),
                });
                if (opts.pdf && (/^raport/.test(target) || /^exemplu/.test(target))) {
                  const pdf = await downloadPdf(
                    page,
                    downloads,
                    path.join(out, name.replace(/\.png$/, ".pdf")),
                  );
                  if (pdf.error) fail.push(`pdf: ${pdf.error}`);
                  else checksPdf.push({ file: path.basename(pdf.file), pages: pdf.pages });
                }
                results.push({
                  target,
                  url,
                  lang,
                  theme,
                  viewport: `${w}x${h}`,
                  reduced,
                  file: name,
                  ms: Date.now() - t0,
                  fail,
                  warn,
                  checks,
                  pdf: checksPdf,
                  errors: [...errors],
                });
              } catch (error) {
                fail.push(`error: ${String(error.message ?? error).slice(0, 200)}`);
                results.push({
                  target,
                  url,
                  lang,
                  theme,
                  viewport: `${w}x${h}`,
                  reduced,
                  file: null,
                  ms: Date.now() - t0,
                  fail,
                  errors: [...errors],
                });
              }
              const notes = results[results.length - 1]?.warn ?? [];
              console.log(
                `${fail.length ? "FAIL" : "ok  "} ${name}${fail.length ? `  ${fail.join("; ")}` : ""}${notes.length ? `  (review: ${notes.join("; ")})` : ""}`,
              );
            }
            await page.close();
          }
        }
      }
    }
  } finally {
    clearTimeout(killer);
    try {
      await browser?.close();
    } catch {
      /* closed already */
    }
    try {
      browser?.process()?.kill("SIGKILL");
    } catch {
      /* gone */
    }
    dropLock();
  }
  const failures = writeReport("done");
  console.log(
    `${results.length} shots this run; report: ${failures.length} with failures · ${out}/report.json`,
  );
  if (failures.length && !opts["no-fail"]) process.exitCode = 1;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error.message ?? error);
    dropLock();
    process.exit(2);
  });
}

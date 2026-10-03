#!/usr/bin/env node
// Renders the four 3D service icons used by src/components/landing/ServicesSection.tsx.
//
//   node scripts/brand/render-service-icons.mjs                 # all four, into public/media/services
//   node scripts/brand/render-service-icons.mjs websites        # one or more slugs
//   OUT_DIR=/tmp/icons MASTER_DIR=/tmp/icons/master node scripts/brand/render-service-icons.mjs
//
// Slugs: websites, digital-products, ai-automation, consultancy (the service page slugs).
//
// How it works: headless Chrome loads scripts/brand/service-icons/index.html, which builds a
// three.js studio scene (scene.js: one camera, light rig, studio reflections, material set and
// contact shadow for the whole family) and renders each model at 2048 px with WebGL. The page
// composites a transparent 1024 px master and a downscaled copy; this script writes
//   <OUT_DIR>/<slug>.png    320 px PNG (fallback)
//   <OUT_DIR>/<slug>.webp   320 px WebP (what the site loads; the icons show at 48 to 80 px)
//   <MASTER_DIR>/<slug>-1024.png   the master (only when MASTER_DIR is set; not committed)
// The pages are served from disk through request interception, so no server is needed.
//
// Needs: puppeteer-core (not a project dependency: `npm i --no-save puppeteer-core`, or point
// PUPPETEER_CORE at an installed copy's folder), Google Chrome (CHROME_PATH overrides the macOS
// default) and cwebp (Homebrew `webp`). The GPU is used through ANGLE/Metal on macOS (about
// 10 s for all four); GL=swiftshader renders on the CPU instead (about 70 s, visually the same,
// a few levels apart). On the same machine and three.js version (0.184 when these were made)
// the output is byte-identical from run to run.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCENE_DIR = path.join(ROOT, "scripts/brand/service-icons");
const THREE_DIR = path.join(ROOT, "node_modules/three");
const OUT_DIR = path.resolve(process.env.OUT_DIR || path.join(ROOT, "public/media/services"));
const MASTER_DIR = process.env.MASTER_DIR ? path.resolve(process.env.MASTER_DIR) : null;
const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SLUGS = ["websites", "digital-products", "ai-automation", "consultancy"];
const SIZE = 320;
const WEBP_ARGS = ["-q", "92", "-alpha_q", "95", "-m", "6", "-sharp_yuv", "-mt"];

async function loadPuppeteer() {
  if (process.env.PUPPETEER_CORE) {
    const entry = path.join(
      path.resolve(process.env.PUPPETEER_CORE),
      "lib/esm/puppeteer/puppeteer-core.js",
    );
    return (await import(pathToFileURL(entry).href)).default;
  }
  try {
    return (await import("puppeteer-core")).default;
  } catch {
    console.error(
      "puppeteer-core not found: run `npm i --no-save puppeteer-core` or set PUPPETEER_CORE.",
    );
    process.exit(1);
  }
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };

/** Serve http://icons.local/* from disk: /three/* from node_modules/three, the rest from SCENE_DIR. */
function serve(page) {
  return page.setRequestInterception(true).then(() =>
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.hostname !== "icons.local") return req.abort();
      const rel = decodeURIComponent(url.pathname);
      const file = rel.startsWith("/three/")
        ? path.join(THREE_DIR, rel.slice("/three/".length))
        : path.join(SCENE_DIR, rel);
      const inside = file.startsWith(THREE_DIR + path.sep) || file.startsWith(SCENE_DIR + path.sep);
      if (!inside || !fs.existsSync(file)) return req.respond({ status: 404, body: "not found" });
      req.respond({
        status: 200,
        contentType: TYPES[path.extname(file)] || "application/octet-stream",
        body: fs.readFileSync(file),
      });
    }),
  );
}

const dataUrlToBuffer = (u) => Buffer.from(u.slice(u.indexOf(",") + 1), "base64");

async function main() {
  const wanted = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const slugs = wanted.length ? wanted : SLUGS;
  for (const s of slugs) if (!SLUGS.includes(s)) throw new Error(`Unknown slug "${s}"`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (MASTER_DIR) fs.mkdirSync(MASTER_DIR, { recursive: true });

  const puppeteer = await loadPuppeteer();
  const gl =
    process.env.GL === "swiftshader"
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : ["--use-angle=metal"];
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-first-run", "--disable-extensions", ...gl],
  });
  // never leave a Chrome behind, even if a render hangs
  const killer = setTimeout(() => {
    browser.process()?.kill("SIGKILL");
    console.error("Timed out; Chrome killed.");
    process.exit(2);
  }, 110_000);
  try {
    for (const slug of slugs) {
      const page = await browser.newPage();
      page.on("pageerror", (e) => console.error(`[${slug}] ${e.message}`));
      page.on("console", (m) => m.type() === "error" && console.error(`[${slug}] ${m.text()}`));
      await serve(page);
      await page.goto("http://icons.local/index.html", { waitUntil: "load" });
      await page.waitForFunction(() => window.iconsReady === true, { timeout: 30_000 });
      const out = await page.evaluate(
        (s, size) => window.renderIcon(s, { sizes: [size] }),
        slug,
        SIZE,
      );
      const png = path.join(OUT_DIR, `${slug}.png`);
      const webp = path.join(OUT_DIR, `${slug}.webp`);
      fs.writeFileSync(png, dataUrlToBuffer(out[SIZE]));
      if (MASTER_DIR)
        fs.writeFileSync(path.join(MASTER_DIR, `${slug}-1024.png`), dataUrlToBuffer(out.master));
      execFileSync("cwebp", [...WEBP_ARGS, png, "-o", webp], { stdio: "ignore" });
      const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1);
      console.log(`${slug}: ${kb(webp)} KB webp, ${kb(png)} KB png`);
      await page.close();
    }
  } finally {
    clearTimeout(killer);
    await browser.close().catch(() => {});
    browser.process()?.kill("SIGKILL");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

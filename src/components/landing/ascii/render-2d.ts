import {
  BLUE,
  buildAtlas,
  CYAN,
  GLOW_LEVELS,
  GLYPHS,
  ICE,
  INDIGO,
  PALETTE,
  PERI,
  type Atlas,
} from "./atlas";
import {
  brightness,
  bucketFor,
  clamp01,
  COLDER,
  edgeFor,
  grainAt,
  hash,
  MOTIF_COUNT,
  MOTIFS,
  ORGANISED,
  POINTER_RADIUS,
  POINTER_SHIFT,
  ringMask,
  SECTORS,
  smooth,
  tone,
  TUNE,
} from "./look";
import type { Grid, Renderer, View } from "./renderer";
import { createSampler } from "./sampler";
import { SECTOR_ANGLES } from "./types";

/*
 * The 2D-canvas fallback: each frame is drawn into a small sampling canvas
 * (area-averaged to one pixel per cell, already mapped onto the ring's
 * position, size and 1.32x stretch; see sampler.ts), and every lit cell is
 * blitted from the glyph atlas. Its cost grows with the cell count, so the
 * engine gives it a coarser grid than WebGL. Per-cell data lives in typed
 * arrays sized once per layout.
 */

const MAX_GLOWS = 1600;

export function create2dRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let grid: Grid | null = null;
  let atlas: Atlas | null = null;
  let atlasKey = "";
  let pixels: Uint8Array | null = null;
  let pixelsCols = 0;
  let pixelsRows = 0;
  let fresh = false;
  let destroyed = false;
  const workerTimes = new Float32Array(60);
  let workerN = 0;
  const matrix = new Float64Array(6);

  const sampler = createSampler((px, c, r, ms) => {
    if (destroyed || !grid || c !== grid.cols || r !== grid.rows) return; // the layout changed meanwhile
    pixels = px;
    pixelsCols = c;
    pixelsRows = r;
    fresh = true;
    workerTimes[workerN++ % workerTimes.length] = ms;
  });
  if (!sampler) return null;

  // Per-cell buffers, grown (never shrunk) with the grid.
  let cap = 0;
  let mask = new Float32Array(0);
  let rad = new Float32Array(0);
  let sweep = new Float32Array(0); // 0..1 clockwise from the top
  let quad = new Uint8Array(0); // quadrant, index into SECTORS
  let feather = new Float32Array(0); // 1 inside a quadrant, 0 at its edges
  let dither = new Float32Array(0);
  let grain = new Float32Array(0); // ordered dither on the glyph level, against banding
  let motif = new Uint8Array(0); // analysis motif per cell
  let lums = new Float32Array(0); // averaged brightness, 0..1 (edge detection)
  const glowX = new Int32Array(MAX_GLOWS);
  const glowY = new Int32Array(MAX_GLOWS);
  const glowT = new Uint16Array(MAX_GLOWS);
  const glowA = new Float32Array(MAX_GLOWS);
  const toneLut = new Float32Array(512); // brightness -> tone 0..1 (-1 = empty)
  const alphaLut = new Float32Array(512);
  let lutKey = "";

  function grow(n: number) {
    if (n <= cap) return;
    cap = n;
    mask = new Float32Array(n);
    rad = new Float32Array(n);
    sweep = new Float32Array(n);
    quad = new Uint8Array(n);
    feather = new Float32Array(n);
    dither = new Float32Array(n);
    grain = new Float32Array(n);
    motif = new Uint8Array(n);
    lums = new Float32Array(n);
  }

  /** The sampler transform for a square source of `size` px, with the current pull and spin. */
  function updateMatrix(g: Grid, size: number, view: View) {
    const k = view.look.pull * size;
    const ax = (g.ringW * g.stretch) / g.cw / k;
    const ay = g.ringW / g.ch / k;
    const cos = Math.cos(view.theta);
    const sin = Math.sin(view.theta);
    // Rotate in the square video space, then stretch: the ring turns without shearing.
    matrix[0] = ax * cos;
    matrix[1] = ay * sin;
    matrix[2] = -ax * sin;
    matrix[3] = ay * cos;
    matrix[4] = g.ringCx / g.cw - ((matrix[0] + matrix[2]) * size) / 2;
    matrix[5] = g.ringCy / g.ch - ((matrix[1] + matrix[3]) * size) / 2;
    return matrix;
  }

  function buildLuts(contrast: number) {
    for (let l = 0; l < 512; l++) {
      const n = tone(l, contrast);
      toneLut[l] = n;
      alphaLut[l] = n < 0 ? 0 : TUNE.alpha0 + (1 - TUNE.alpha0) * n;
    }
  }

  return {
    kind: "2d",
    canvas,
    get fresh() {
      return fresh;
    },

    layout(g) {
      grid = g;
      if (canvas.width !== g.width) canvas.width = g.width;
      if (canvas.height !== g.height) canvas.height = g.height;
      const key = `${g.cwD.toFixed(2)}:${g.chD.toFixed(2)}:${g.fontD.toFixed(2)}:${g.heavier}:${g.fontEpoch}`;
      if (key !== atlasKey || !atlas) {
        atlas = buildAtlas(atlas, g.cwD, g.chD, g.fontD, g.heavier);
        atlasKey = key;
      }
      const { cols, rows, cw, ch, ringCx, ringCy, ringW, stretch } = g;
      grow(cols * rows);
      for (let row = 0; row < rows; row++) {
        const y = (row + 0.5) * ch - ringCy;
        for (let col = 0; col < cols; col++) {
          const i = row * cols + col;
          const x = (col + 0.5) * cw - ringCx;
          // Ring-local and unstretched: +-0.5 at the box edge, so r = 1 at the closest side.
          const u = x / (ringW * stretch);
          const v = y / ringW;
          const r = Math.sqrt(u * u + v * v) * 2;
          rad[i] = r;
          mask[i] = ringMask(r);
          let deg = (Math.atan2(y, x) * 180) / Math.PI;
          if (deg < 0) deg += 360;
          sweep[i] = ((deg + 90) % 360) / 360;
          const q = Math.min(3, Math.floor(deg / 90));
          const { from, to } = SECTOR_ANGLES[SECTORS[q]];
          quad[i] = q;
          feather[i] = smooth(clamp01(Math.min(deg - from, to - deg) / 14));
          dither[i] = hash(col, row);
          grain[i] = (grainAt(col, row) - 0.5) * TUNE.dither;
          // Motif blocks 8 cells wide and 2 rows tall, like a table of values.
          motif[i] = Math.floor(hash(col >> 3, row >> 1) * MOTIF_COUNT) * 4 + (col & 3);
        }
      }
      pixels = null;
    },

    source(src, size, view, now, still) {
      const g = grid;
      if (!g) return "busy";
      const m = updateMatrix(g, size, view);
      if (!still && src instanceof HTMLVideoElement) {
        const sent = sampler.request(src, m, g.cols, g.rows, now);
        if (sent !== "unavailable") return sent === "sent" ? "ok" : "busy";
      }
      pixels = sampler.sampleNow(src, size, m, g.cols, g.rows);
      pixelsCols = g.cols;
      pixelsRows = g.rows;
      fresh = true;
      return "ok";
    },

    draw(view) {
      const g = grid;
      const px = pixels;
      const at = atlas;
      if (!g || !px || !at || pixelsCols !== g.cols || pixelsRows !== g.rows) return false;
      const { look } = view;
      const key = `${look.contrast}:${TUNE.floor}:${TUNE.ceil}:${TUNE.gamma}:${TUNE.scurve}:${TUNE.alpha0}`;
      if (key !== lutKey) {
        buildLuts(look.contrast);
        lutKey = key;
      }
      const { cols, rows, cw, ch, cwD, chD, scale } = g;
      const c = ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      c.clearRect(0, 0, canvas.width, canvas.height);

      const { tileW, tileH, pad, glyphs, glowW, glowH, glowPad, glow } = at;
      const techRow = PALETTE.length;
      const gain = look.gain;
      const centre = look.centre;
      const cyanBase = look.cyan;
      const glowAmt = look.glow;
      const glowFloor = TUNE.glowFloor + (1 - Math.min(glowAmt, 1)) * 50;
      const share = view.progress;
      const analysisW = view.analysisW;
      const dataOn = analysisW > 0.002;
      const sectorW = view.sectorW;
      const sectorOn = sectorW[0] + sectorW[1] + sectorW[2] + sectorW[3] > 0.002;
      const ptrOn = view.ptrW > 0.002;
      const { ptrX, ptrY, ptrW, flip, flipGlyph } = view;
      const pr2 = POINTER_RADIUS * POINTER_RADIUS;
      const edgesOn = TUNE.edges > 0;
      const edgeThr = TUNE.edgeThr;
      const edgeMax = TUNE.edgeMax;
      const aspect = cw / ch;
      const inner = (col: number, row: number) =>
        col > 0 && row > 0 && col < cols - 1 && row < rows - 1;
      let glowN = 0;
      let alphaSet = 1;

      if (edgesOn) {
        for (let i = 0, n = cols * rows; i < n; i++) {
          const p = i << 2;
          lums[i] = brightness(px[p], px[p + 1], px[p + 2]) / 255;
        }
      }

      for (let row = 0; row < rows; row++) {
        const yc = (row + 0.5) * ch;
        const y0 = row * chD;
        for (let col = 0; col < cols; col++) {
          const i = row * cols + col;
          const m = mask[i];
          if (m < 0.01) continue;
          const p = i << 2;
          const R = px[p];
          const B = px[p + 2];
          const G = px[p + 1];
          const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
          const r = rad[i];
          let gn = gain;
          let cyan = cyanBase;
          let ox = 0;
          let oy = 0;

          if (centre !== 0 && r < 0.62) gn *= 1 + centre * (1 - smooth(r / 0.62));

          // Hovered orbit label: its quadrant organises and its orbit band brightens a touch.
          let organised = false;
          if (sectorOn) {
            const sw = sectorW[quad[i]] * feather[i];
            if (sw > 0.002) {
              const orbit = clamp01(1 - Math.abs(r - 0.72) / 0.26);
              gn *= 1 + 0.2 * sw * orbit;
              organised = sw * (0.55 + 0.45 * orbit) > dither[i];
            }
          }

          if (ptrOn) {
            const dx = (col + 0.5) * cw - ptrX;
            const dy = yc - ptrY;
            const d2 = dx * dx + dy * dy;
            if (d2 < pr2) {
              const d = Math.sqrt(d2) || 1;
              const f = smooth(1 - d / POINTER_RADIUS) * ptrW;
              gn *= 1 + 0.3 * f;
              cyan += 0.6 * f;
              // Away from the cursor and a little around it.
              const s = (f * POINTER_SHIFT * scale) / d;
              ox = (dx * 0.85 - dy * 0.45) * s;
              oy = (dy * 0.85 + dx * 0.45) * s;
            }
          }

          const eff = brightness(R, G, B) * gn * (0.55 + 0.45 * m);
          const li = eff > 511 ? 511 : eff | 0;
          const x = ((col * cwD + ox + 0.5) | 0) - pad;
          const y = ((y0 + oy + 0.5) | 0) - pad;

          // Typing flip: a technical glyph that fades back into the swirl.
          const fl = flip[i];
          if (fl > 0) {
            c.globalAlpha = alphaSet = Math.max(alphaLut[li] * m, 0.9 * fl);
            const ty = (techRow + (fl > 0.5 ? CYAN : ICE)) * tileH;
            c.drawImage(glyphs, flipGlyph[i] * tileW, ty, tileW, tileH, x, y, tileW, tileH);
            continue;
          }

          // Analysis: the covered share of the ring shows denser data-structure glyphs.
          if (dataOn && r > 0.36 && r < 0.95 && eff > 9) {
            const covered = analysisW * clamp01((share - sweep[i]) * 30);
            if (covered > dither[i]) {
              const n = clamp01((eff - 9) / (TUNE.ceil - 9));
              const a = m * (0.35 + 0.55 * n);
              if (a !== alphaSet) c.globalAlpha = alphaSet = a;
              const ty =
                (techRow + (n > 0.7 ? ICE : n > 0.35 ? PERI : n > 0.15 ? BLUE : INDIGO)) * tileH;
              c.drawImage(glyphs, MOTIFS[motif[i]] * tileW, ty, tileW, tileH, x, y, tileW, tileH);
              continue;
            }
          }

          const n = toneLut[li];
          if (n < 0) continue;
          let level = Math.floor(n * GLYPHS.length + grain[i]);
          level = level < 0 ? 0 : level >= GLYPHS.length ? GLYPHS.length - 1 : level;
          let bucket = bucketFor(R, B, lum);
          let tile = level;
          if (organised) {
            level = ORGANISED[level];
            tile = level;
            bucket = eff > 140 ? ICE : eff > 60 ? PERI : INDIGO;
          } else if (edgesOn && level <= edgeMax && inner(col, row)) {
            // Sobel on the averaged brightness: on a strong edge, a stroke along it traces the arm.
            const up = i - cols;
            const dn = i + cols;
            const left = lums[up - 1] + 2 * lums[i - 1] + lums[dn - 1];
            const right = lums[up + 1] + 2 * lums[i + 1] + lums[dn + 1];
            const above = lums[up - 1] + 2 * lums[up] + lums[up + 1];
            const below = lums[dn - 1] + 2 * lums[dn] + lums[dn + 1];
            const gx = right - left;
            const gy = (below - above) * aspect;
            if (gx * gx + gy * gy > edgeThr * edgeThr * 16) {
              let deg = (Math.atan2(gx, -gy) * 180) / Math.PI;
              if (deg < 0) deg += 180;
              tile = GLYPHS.length + edgeFor(deg % 180);
            }
          }
          if (cyan > 0.01) bucket = COLDER[bucket][Math.min(3, (cyan * 3 + dither[i] * 0.999) | 0)];
          const a = alphaLut[li] * m;
          if (a !== alphaSet) c.globalAlpha = alphaSet = a;
          c.drawImage(glyphs, tile * tileW, bucket * tileH, tileW, tileH, x, y, tileW, tileH);

          const top = level - (GLYPHS.length - GLOW_LEVELS);
          if (top >= 0 && tile < GLYPHS.length && eff > glowFloor && glowN < MAX_GLOWS) {
            glowX[glowN] = x + pad - glowPad;
            glowY[glowN] = y + pad - glowPad;
            glowT[glowN] = bucket * GLOW_LEVELS + top;
            glowA[glowN] = clamp01((eff - glowFloor) / (255 - glowFloor)) * 0.5 * glowAmt * m;
            glowN++;
          }
        }
      }

      // Controlled glow: a soft halo, added on top, for the brightest cells only.
      if (glowN) {
        c.globalCompositeOperation = "lighter";
        for (let j = 0; j < glowN; j++) {
          const t = glowT[j];
          const sx = (t % GLOW_LEVELS) * glowW;
          const sy = ((t / GLOW_LEVELS) | 0) * glowH;
          c.globalAlpha = Math.min(glowA[j], 1);
          c.drawImage(glow, sx, sy, glowW, glowH, glowX[j], glowY[j], glowW, glowH);
        }
        c.globalCompositeOperation = "source-over";
      }
      c.globalAlpha = 1;
      fresh = false;
      return true;
    },

    workerMs() {
      const n = Math.min(workerN, workerTimes.length);
      if (!n) return 0;
      const sorted = Array.from(workerTimes.subarray(0, n)).sort((a, b) => a - b);
      return sorted[Math.floor(n / 2)];
    },

    destroy() {
      destroyed = true;
      sampler.destroy();
      pixels = null;
      canvas.width = canvas.height = 0;
    },
  };
}

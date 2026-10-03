/*
 * Glyphs, colours and glyph atlases for the ASCII vortex. Every glyph the
 * renderers can draw is rendered once per cell size: for the 2D canvas in each
 * colour bucket (a frame is a few thousand drawImage blits instead of fillText
 * calls), plus a soft-glow copy of the brightest glyphs; for WebGL as white
 * coverage, coloured in the shader.
 */

/** JetBrains Mono (loaded by __root.tsx), then the platform's own monospace. */
export const FONT_FAMILY = '"JetBrains Mono"';
export const FONT_STACK = `${FONT_FAMILY}, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

/** Brightness ramp, dark to light; the two leading spaces are the empty cells. */
export const RAMP = "  .·:;+=xX#%@";
/** The drawable levels of RAMP (index 0 = dimmest). */
export const GLYPHS = RAMP.slice(2);
/** Edge glyphs: horizontal, rising, vertical, falling (see look.ts edgeFor). */
export const EDGES = "-/|\\";
/** Technical glyphs: typing flips and the data structures of the analysis state. */
export const TECH = "01/\\[]{}<>+-";
/** How many of the top GLYPHS get a glow copy. */
export const GLOW_LEVELS = 3;

/**
 * Colour buckets: the video's own violets, pushed a little toward indigo, cold
 * blue and white, plus a cyan used sparingly (pointer, focus, technical glyphs).
 */
export const PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [104, 64, 246], // 0 deep violet
  [96, 100, 255], // 1 indigo
  [90, 150, 255], // 2 cold blue
  [152, 96, 255], // 3 electric violet
  [140, 160, 255], // 4 periwinkle
  [186, 140, 255], // 5 lavender
  [205, 222, 255], // 6 ice
  [240, 232, 255], // 7 white
  [112, 208, 255], // 8 cyan, on the blue side (never Matrix green)
];
export const DEEP = 0;
export const INDIGO = 1;
export const BLUE = 2;
export const VIOLET = 3;
export const PERI = 4;
export const LAV = 5;
export const ICE = 6;
export const WHITE = 7;
export const CYAN = 8;

/** Glyph metrics per 1px of font size. */
export type GlyphMetrics = { advance: number; line: number };

const font = (weight: number, px: number) => `${weight} ${px}px ${FONT_STACK}`;

/**
 * Waits (up to `timeoutMs`) for the JetBrains Mono weights the atlas uses;
 * false means the fallback monospace stands in.
 */
export async function loadGlyphFont(timeoutMs = 2500): Promise<boolean> {
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fonts?.load) return false;
  const text = GLYPHS + EDGES + TECH;
  const loads = Promise.all(
    [400, 500, 600].map((w) => fonts.load(`${w} 10px ${FONT_FAMILY}`, text)),
  );
  let timer = 0;
  const timeout = new Promise<null>((resolve) => {
    timer = window.setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const faces = await Promise.race([loads, timeout]);
    return !!faces && faces.every((f) => f.length > 0);
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Bright levels are drawn heavier, so density and weight both follow
 * brightness; the cells are small, so even the dim levels start at 500, and 1x
 * screens get one step more, or thin strokes vanish.
 */
const weightFor = (level: number, heavier: boolean) =>
  Math.min(600, (level < 6 ? 500 : 600) + (heavier ? 100 : 0));

/** Advance width and line height of the glyph font. Call after loadGlyphFont. */
export function measureGlyphs(): GlyphMetrics {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return { advance: 0.6, line: 1.2 };
  ctx.font = font(500, 100);
  const m = ctx.measureText("M@");
  const advance = m.width / 200 || 0.6;
  const box = (m.fontBoundingBoxAscent ?? 0) + (m.fontBoundingBoxDescent ?? 0);
  // A little tighter than the font's line box: rows read as a grid, glyphs never touch.
  const line = box > 0 ? Math.min(Math.max((box / 100) * 0.9, 1.15), 1.25) : 1.2;
  return { advance, line };
}

function sizeCanvas(canvas: HTMLCanvasElement, w: number, h: number) {
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  return ctx;
}

export type Atlas = {
  /** GLYPHS then EDGES (columns) x PALETTE (rows), then TECH x PALETTE below. */
  glyphs: HTMLCanvasElement;
  /** Top GLOW_LEVELS glyphs x PALETTE, with a soft halo. */
  glow: HTMLCanvasElement;
  /** Tile size and the padding around the cell, in device pixels. */
  tileW: number;
  tileH: number;
  pad: number;
  glowW: number;
  glowH: number;
  glowPad: number;
};

/**
 * (Re)draws the 2D atlas for a cell of `cellW` x `cellH` device pixels at
 * `fontPx` device pixels, reusing `prev`'s canvases when given.
 */
export function buildAtlas(
  prev: Atlas | null,
  cellW: number,
  cellH: number,
  fontPx: number,
  heavier: boolean,
): Atlas | null {
  const pad = 2;
  const tileW = Math.ceil(cellW) + pad * 2;
  const tileH = Math.ceil(cellH) + pad * 2;
  const glowPad = Math.ceil(fontPx * 0.55);
  const glowW = Math.ceil(cellW) + glowPad * 2;
  const glowH = Math.ceil(cellH) + glowPad * 2;
  const glyphs = prev?.glyphs ?? document.createElement("canvas");
  const glow = prev?.glow ?? document.createElement("canvas");
  const cols = Math.max(GLYPHS.length + EDGES.length, TECH.length);
  const g = sizeCanvas(glyphs, cols * tileW, PALETTE.length * 2 * tileH);
  const h = sizeCanvas(glow, GLOW_LEVELS * glowW, PALETTE.length * glowH);
  if (!g || !h) return null;

  const edgeWeight = heavier ? 600 : 500;
  PALETTE.forEach(([r, gr, b], row) => {
    const colour = `rgb(${r} ${gr} ${b})`;
    g.fillStyle = colour;
    for (let level = 0; level < GLYPHS.length; level++) {
      g.font = font(weightFor(level, heavier), fontPx);
      g.fillText(GLYPHS[level], level * tileW + tileW / 2, row * tileH + tileH / 2);
    }
    g.font = font(edgeWeight, fontPx);
    for (let i = 0; i < EDGES.length; i++) {
      const x = (GLYPHS.length + i) * tileW + tileW / 2;
      g.fillText(EDGES[i], x, row * tileH + tileH / 2);
    }
    g.font = font(heavier ? 600 : 500, fontPx);
    const techRow = PALETTE.length + row;
    for (let i = 0; i < TECH.length; i++) {
      g.fillText(TECH[i], i * tileW + tileW / 2, techRow * tileH + tileH / 2);
    }

    // Glow: the glyph with a soft halo of its own colour (drawn with "lighter" over the base glyph).
    h.fillStyle = colour;
    h.shadowColor = `rgb(${r} ${gr} ${b} / 0.9)`;
    h.shadowBlur = fontPx * 0.45;
    for (let i = 0; i < GLOW_LEVELS; i++) {
      const level = GLYPHS.length - GLOW_LEVELS + i;
      h.font = font(weightFor(level, heavier), fontPx);
      h.fillText(GLYPHS[level], i * glowW + glowW / 2, row * glowH + glowH / 2);
    }
  });

  return { glyphs, glow, tileW, tileH, pad, glowW, glowH, glowPad };
}

/** Index of each glyph set in the WebGL coverage atlas (0 = empty cell). */
export const GL_GLYPH0 = 1;
export const GL_EDGE0 = GL_GLYPH0 + GLYPHS.length;
export const GL_TECH0 = GL_EDGE0 + EDGES.length;
const GL_COUNT = GLYPHS.length + EDGES.length + TECH.length;

export type MaskAtlas = {
  /** One row of tiles, GLYPHS then EDGES then TECH, white on transparent. */
  canvas: HTMLCanvasElement;
  tileW: number;
  tileH: number;
  pad: number;
};

/** The WebGL coverage atlas: tile k holds glyph k + 1, centred in a `cellW` x `cellH` box. */
export function buildMaskAtlas(
  prev: MaskAtlas | null,
  cellW: number,
  cellH: number,
  fontPx: number,
  heavier: boolean,
): MaskAtlas | null {
  const pad = 2;
  const tileW = Math.ceil(cellW) + pad * 2;
  const tileH = Math.ceil(cellH) + pad * 2;
  const canvas = prev?.canvas ?? document.createElement("canvas");
  const g = sizeCanvas(canvas, GL_COUNT * tileW, tileH);
  if (!g) return null;
  g.fillStyle = "#fff";
  const at = (k: number, glyph: string, weight: number) => {
    g.font = font(weight, fontPx);
    g.fillText(glyph, k * tileW + pad + cellW / 2, pad + cellH / 2);
  };
  for (let level = 0; level < GLYPHS.length; level++) {
    at(GL_GLYPH0 - 1 + level, GLYPHS[level], weightFor(level, heavier));
  }
  for (let i = 0; i < EDGES.length; i++) at(GL_EDGE0 - 1 + i, EDGES[i], heavier ? 600 : 500);
  for (let i = 0; i < TECH.length; i++) at(GL_TECH0 - 1 + i, TECH[i], heavier ? 600 : 500);
  return { canvas, tileW, tileH, pad };
}

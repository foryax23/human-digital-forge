import { BLUE, CYAN, DEEP, ICE, INDIGO, LAV, PERI, VIOLET, WHITE } from "./atlas";
import { SECTOR_ANGLES, type AsciiVortexState, type OrbitSector } from "./types";

/*
 * What both renderers (render-gl.ts, render-2d.ts) agree on: the state looks,
 * the tone curve that turns a cell's averaged video brightness into a glyph,
 * the colour buckets, the ring's mask and the per-cell dither. The WebGL
 * shaders are generated from these same tables.
 */

export type Look = {
  /** Overall brightness. */
  gain: number;
  /** Brightness change toward the eye: > 0 brighter, < 0 darker. */
  centre: number;
  /** Lean toward cold blue and cyan, 0..1. */
  cyan: number;
  /** Exponent on brightness: > 1 sparser mid-tones (sharper). */
  contrast: number;
  /** Glow on the brightest cells. */
  glow: number;
  /** > 1 draws the swirl in toward the eye. */
  pull: number;
  /** Extra clockwise rotation, rad/s (the video itself turns clockwise). */
  spin: number;
};

export const LOOKS: Record<AsciiVortexState, Look> = {
  idle: { gain: 1, centre: 0, cyan: 0, contrast: 1, glow: 1, pull: 1, spin: 0 },
  focus: { gain: 1.06, centre: 0.2, cyan: 0.24, contrast: 1.12, glow: 1.1, pull: 1, spin: 0 },
  typing: { gain: 1.06, centre: 0.2, cyan: 0.28, contrast: 1.12, glow: 1.1, pull: 1, spin: 0 },
  scanning: { gain: 1, centre: -0.75, cyan: 0.14, contrast: 1.2, glow: 0.4, pull: 1.16, spin: 1.2 },
  analysis: { gain: 0.95, centre: -0.25, cyan: 0.12, contrast: 1.05, glow: 0.8, pull: 1, spin: 0 },
  result: { gain: 0.74, centre: -0.5, cyan: 0.05, contrast: 1, glow: 0.5, pull: 1, spin: 0 },
};
export const LOOK_KEYS = Object.keys(LOOKS.idle) as Array<keyof Look>;

/** The orbit sectors in quadrant order (0 = the 0-90 degree quadrant), as the renderers index them. */
export const SECTORS = (Object.keys(SECTOR_ANGLES) as OrbitSector[]).sort(
  (a, b) => SECTOR_ANGLES[a].from - SECTOR_ANGLES[b].from,
);

/**
 * Tone curve and edge glyphs. A cell's brightness (0..255, see brightness(),
 * after the look's gain) below `floor` stays empty; up to `ceil` it is lifted
 * by `gamma` and given an S-curve (`scurve`) so the arms separate from the
 * gaps; `alpha0` is the opacity of the dimmest glyph. Cells on a strong edge of the swirl
 * (Sobel on the averaged brightness, above `edgeThr`) are drawn as / \ | -
 * along the edge, up to ramp level `edgeMax`. Mutable only through the
 * development tuning hook.
 */
export const TUNE = {
  floor: 26,
  ceil: 220,
  gamma: 0.8,
  scurve: 0.45,
  alpha0: 0.68,
  /** Share of the brightest channel in a cell's brightness (luminance alone undersells violet). */
  maxMix: 0.6,
  /** Ordered dither on the glyph level (in levels), so the ramp doesn't band. */
  dither: 0.7,
  /** Brightness above which the top glyphs get a glow (about the brightest 4% of lit cells). */
  glowFloor: 195,
  edges: 1,
  edgeThr: 0.2,
  edgeMax: 7,
};

export const smooth = (n: number) => n * n * (3 - 2 * n);
export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * A cell's brightness, 0..255: Rec. 709 luminance mixed with the brightest
 * channel, so the violet arm bodies register, not only the white highlights.
 */
export function brightness(r: number, g: number, b: number) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const max = r > g ? (r > b ? r : b) : g > b ? g : b;
  return lum + (max - lum) * TUNE.maxMix;
}

/** 0..1 tone of a cell's brightness, or -1 for an empty cell. */
export function tone(eff: number, contrast: number) {
  const x = (eff - TUNE.floor) / (TUNE.ceil - TUNE.floor);
  if (x <= 0) return -1;
  const n = Math.pow(x > 1 ? 1 : x, TUNE.gamma * contrast);
  return n + (smooth(n) - n) * TUNE.scurve;
}

/** The old video ring's mask: radial-gradient(closest-side, black 45%, 0.55 at 68%, transparent 92%). */
export function ringMask(r: number) {
  if (r <= 0.45) return 1;
  if (r <= 0.68) return 1 - ((r - 0.45) / 0.23) * 0.45;
  if (r <= 0.92) return 0.55 * (1 - (r - 0.68) / 0.24);
  return 0;
}

/** Static per-cell dither (0..1): looks dissolve in and out without flicker. */
export function hash(x: number, y: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Second static per-cell noise (0..1), for the level dither. */
export const grainAt = (x: number, y: number) => hash(x + 4099, y * 3 + 17);

/** Colour bucket from the averaged pixel; thresholds from the swirl video's own colours. */
export function bucketFor(r: number, b: number, lum: number) {
  const q = r / (b + 1); // redness: the arms run from blue-violet edges to pink-white highlights
  if (lum > 200) return q < 0.93 ? ICE : WHITE;
  if (lum > 130) return q < 0.8 ? PERI : LAV;
  if (lum > 105) return q < 0.7 ? INDIGO : VIOLET;
  if (lum > 45) return q < 0.44 ? BLUE : q < 0.52 ? INDIGO : VIOLET;
  return q < 0.3 ? INDIGO : DEEP;
}

/** Each bucket's path toward cyan, one step per third of "cyan lean" (rows in PALETTE order). */
export const COLDER: ReadonlyArray<readonly number[]> = [
  [DEEP, INDIGO, BLUE, CYAN],
  [INDIGO, BLUE, BLUE, CYAN],
  [BLUE, BLUE, CYAN, CYAN],
  [VIOLET, INDIGO, BLUE, CYAN],
  [PERI, PERI, ICE, CYAN],
  [LAV, PERI, ICE, CYAN],
  [ICE, ICE, CYAN, CYAN],
  [WHITE, ICE, ICE, CYAN],
  [CYAN, CYAN, CYAN, CYAN],
];
/** "Organised" sector glyphs: the ramp quantised to every other level. */
export const ORGANISED = [0, 0, 2, 2, 4, 4, 6, 6, 8, 8, 10];
/** Data-structure motifs for the analysis state, as TECH indices: [01] {<>} 0110 /\/\ +--+ <01>. */
export const MOTIFS = [4, 0, 1, 5, 6, 8, 9, 7, 0, 1, 1, 0, 2, 3, 2, 3, 10, 11, 11, 10, 8, 0, 1, 9];
export const MOTIF_COUNT = MOTIFS.length / 4;

/** Edge glyph (index into EDGES) for an edge running at `deg` (0..180, screen y down). */
export function edgeFor(deg: number) {
  // EDGES = "-/|\": the font's / and \ lean about 61 degrees, not 45.
  if (deg < 30 || deg >= 150) return 0;
  if (deg < 75.5) return 3;
  if (deg < 104.5) return 2;
  return 1;
}

/** Glyphs a single keystroke flips, how long a flip lasts (s) and how many can be live. */
export const FLIPS_PER_PULSE = 6;
export const FLIP_LIFE = 0.75;
export const MAX_FLIPS = 48;
/** Pointer reach and the largest glyph shift, CSS px. */
export const POINTER_RADIUS = 150;
export const POINTER_SHIFT = 4.5;

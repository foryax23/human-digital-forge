import {
  BLUE,
  buildMaskAtlas,
  CYAN,
  DEEP,
  GL_EDGE0,
  GL_GLYPH0,
  GL_TECH0,
  GLOW_LEVELS,
  GLYPHS,
  ICE,
  INDIGO,
  LAV,
  PALETTE,
  PERI,
  VIOLET,
  WHITE,
  type MaskAtlas,
} from "./atlas";
import {
  COLDER,
  MAX_FLIPS,
  MOTIF_COUNT,
  MOTIFS,
  ORGANISED,
  POINTER_RADIUS,
  POINTER_SHIFT,
  TUNE,
} from "./look";
import type { Grid, Renderer, View } from "./renderer";

/*
 * The WebGL2 renderer: the whole grid is three full-screen passes, so its cost
 * barely depends on the cell count.
 *   1. sample: one fragment per cell averages the video texture over the
 *      cell's footprint on the ring (a grid of bilinear taps: a box filter);
 *   2. cells: one fragment per cell applies the look (tone curve, colour
 *      bucket, edge glyphs from a Sobel over the neighbouring cells, sector,
 *      pointer, typing flips, analysis motifs) and writes the glyph, its colour
 *      and opacity, plus the glow;
 *   3. compose: one fragment per screen pixel finds its cell (shifted around
 *      the pointer), reads the glyph's coverage from the atlas and adds the
 *      glow, blurred between cells.
 * The shaders use the same tables as the 2D path (look.ts, atlas.ts).
 */

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const SAMPLE = `#version 300 es
precision highp float;
uniform sampler2D uVideo;
uniform vec2 uCell;
uniform vec2 uRingC;
uniform vec2 uRingSize;
uniform float uPull;
uniform vec2 uRot;
uniform ivec2 uTaps;
uniform float uMaxMix;
out vec4 o;

// Layer CSS px -> video uv: ring-local, unstretched, pulled in, turned back by theta.
vec2 toVideo(vec2 css) {
  vec2 q = (css - uRingC) / uRingSize * uPull;
  q = vec2(uRot.x * q.x + uRot.y * q.y, -uRot.y * q.x + uRot.x * q.y);
  return q + 0.5;
}

void main() {
  vec2 origin = floor(gl_FragCoord.xy) * uCell;
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 8; j++) {
    if (j >= uTaps.y) break;
    for (int i = 0; i < 4; i++) {
      if (i >= uTaps.x) break;
      vec2 uv = toVideo(origin + (vec2(float(i), float(j)) + 0.5) / vec2(uTaps) * uCell);
      vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
      acc += texture(uVideo, uv).rgb * inside.x * inside.y;
    }
  }
  acc /= float(uTaps.x * uTaps.y);
  // Brightness: luminance mixed with the brightest channel (look.ts brightness()).
  float lum = dot(acc, vec3(0.2126, 0.7152, 0.0722));
  o = vec4(acc, mix(lum, max(acc.r, max(acc.g, acc.b)), uMaxMix));
}`;

const glslInts = (a: readonly number[]) => a.join(", ");
const glslColours = PALETTE.map(
  ([r, g, b]) => `vec3(${(r / 255).toFixed(4)}, ${(g / 255).toFixed(4)}, ${(b / 255).toFixed(4)})`,
).join(", ");

const CELLS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uA;
uniform ivec2 uGrid;
uniform vec2 uCell;
uniform vec2 uRingC;
uniform vec2 uRingSize;
uniform vec4 uLook;       // gain, centre, cyan, contrast
uniform float uGlowAmt;
uniform vec4 uSectorW;
uniform vec2 uAnalysis;   // weight, progress
uniform vec3 uPtr;        // x, y (CSS px), strength
uniform int uFlipsN;
uniform vec4 uFlips[${MAX_FLIPS}]; // col, row, life, TECH glyph
uniform vec4 uTone;       // floor, ceil, gamma, s-curve
uniform vec4 uTone2;      // alpha0, glow floor, edge threshold, edges on
uniform float uEdgeMax;
uniform float uDither;
layout(location = 0) out vec4 oCell;
layout(location = 1) out vec4 oGlow;

const int DEEP = ${DEEP}, INDIGO = ${INDIGO}, BLUE = ${BLUE}, VIOLET = ${VIOLET}, PERI = ${PERI};
const int LAV = ${LAV}, ICE = ${ICE}, WHITE = ${WHITE}, CYAN = ${CYAN};
const int LEVELS = ${GLYPHS.length};
const int GLOW_LEVELS = ${GLOW_LEVELS};
const int GLYPH0 = ${GL_GLYPH0}, EDGE0 = ${GL_EDGE0}, TECH0 = ${GL_TECH0};
const vec3 PAL[${PALETTE.length}] = vec3[${PALETTE.length}](${glslColours});
const int COLDER[${COLDER.length * 4}] = int[${COLDER.length * 4}](${glslInts(COLDER.flat())});
const int ORGANISED[${ORGANISED.length}] = int[${ORGANISED.length}](${glslInts(ORGANISED)});
const int MOTIFS[${MOTIFS.length}] = int[${MOTIFS.length}](${glslInts(MOTIFS)});
const float MOTIF_COUNT = ${MOTIF_COUNT.toFixed(1)};
const float POINTER_RADIUS = ${POINTER_RADIUS.toFixed(1)};

float smooth01(float n) { return n * n * (3.0 - 2.0 * n); }

float hash(uint x, uint y) {
  uint h = (x * 374761393u) ^ (y * 668265263u);
  h = (h ^ (h >> 13u)) * 1274126177u;
  return float(h ^ (h >> 16u)) / 4294967296.0;
}

float ringMask(float r) {
  if (r <= 0.45) return 1.0;
  if (r <= 0.68) return 1.0 - (r - 0.45) / 0.23 * 0.45;
  if (r <= 0.92) return 0.55 * (1.0 - (r - 0.68) / 0.24);
  return 0.0;
}

float tone(float eff, float contrast) {
  float x = (eff - uTone.x) / (uTone.y - uTone.x);
  if (x <= 0.0) return -1.0;
  float n = pow(min(x, 1.0), uTone.z * contrast);
  return n + (smooth01(n) - n) * uTone.w;
}

int bucketFor(float r, float b, float lum) {
  float q = r / (b + 1.0);
  if (lum > 200.0) return q < 0.93 ? ICE : WHITE;
  if (lum > 130.0) return q < 0.8 ? PERI : LAV;
  if (lum > 105.0) return q < 0.7 ? INDIGO : VIOLET;
  if (lum > 45.0) return q < 0.44 ? BLUE : q < 0.52 ? INDIGO : VIOLET;
  return q < 0.3 ? INDIGO : DEEP;
}

float lumAt(ivec2 c) {
  return texelFetch(uA, clamp(c, ivec2(0), uGrid - 1), 0).a;
}

void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  oCell = vec4(0.0);
  oGlow = vec4(0.0);
  vec2 centre = (vec2(cell) + 0.5) * uCell;
  vec2 c = centre - uRingC;
  float r = length(c / uRingSize) * 2.0;
  float m = ringMask(r);
  if (m < 0.01) return;

  vec4 px = texelFetch(uA, cell, 0);
  float R = px.r * 255.0;
  float B = px.b * 255.0;
  float lum = dot(px.rgb, vec3(0.2126, 0.7152, 0.0722)) * 255.0;
  float g = uLook.x;
  float cyan = uLook.z;
  if (uLook.y != 0.0 && r < 0.62) g *= 1.0 + uLook.y * (1.0 - smooth01(r / 0.62));
  float deg = degrees(atan(c.y, c.x));
  if (deg < 0.0) deg += 360.0;
  float dither = hash(uint(cell.x), uint(cell.y));

  // Hovered orbit label: its quadrant organises and its orbit band brightens a touch.
  bool organised = false;
  if (uSectorW.x + uSectorW.y + uSectorW.z + uSectorW.w > 0.002) {
    int q = min(int(deg / 90.0), 3);
    float from = float(q) * 90.0;
    float feather = smooth01(clamp(min(deg - from, from + 90.0 - deg) / 14.0, 0.0, 1.0));
    float sw = uSectorW[q] * feather;
    if (sw > 0.002) {
      float orbit = clamp(1.0 - abs(r - 0.72) / 0.26, 0.0, 1.0);
      g *= 1.0 + 0.2 * sw * orbit;
      organised = sw * (0.55 + 0.45 * orbit) > dither;
    }
  }

  // The pointer brightens and cools the glyphs around it (the shift happens in compose).
  if (uPtr.z > 0.002) {
    float d = length(centre - uPtr.xy);
    if (d < POINTER_RADIUS) {
      float f = smooth01(1.0 - d / POINTER_RADIUS) * uPtr.z;
      g *= 1.0 + 0.3 * f;
      cyan += 0.6 * f;
    }
  }

  float eff = px.a * 255.0 * g * (0.55 + 0.45 * m);
  float n = tone(eff, uLook.w);
  float alpha = n < 0.0 ? 0.0 : (uTone2.x + (1.0 - uTone2.x) * n) * m;

  // Typing flip: a technical glyph that fades back into the swirl.
  for (int j = 0; j < ${MAX_FLIPS}; j++) {
    if (j >= uFlipsN) break;
    vec4 f = uFlips[j];
    if (int(f.x) == cell.x && int(f.y) == cell.y) {
      oCell = vec4(PAL[f.z > 0.5 ? CYAN : ICE], float(TECH0 + int(f.w)) / 255.0);
      oGlow = vec4(0.0, 0.0, 0.0, max(alpha, 0.9 * f.z));
      return;
    }
  }

  // Analysis: the covered share of the ring shows denser data-structure glyphs.
  if (uAnalysis.x > 0.002 && r > 0.36 && r < 0.95 && eff > 9.0) {
    float sweep = mod(deg + 90.0, 360.0) / 360.0;
    float covered = uAnalysis.x * clamp((uAnalysis.y - sweep) * 30.0, 0.0, 1.0);
    if (covered > dither) {
      float nn = clamp((eff - 9.0) / (uTone.y - 9.0), 0.0, 1.0);
      int b = nn > 0.7 ? ICE : nn > 0.35 ? PERI : nn > 0.15 ? BLUE : INDIGO;
      int mi = int(floor(hash(uint(cell.x >> 3), uint(cell.y >> 1)) * MOTIF_COUNT)) * 4 + (cell.x & 3);
      oCell = vec4(PAL[b], float(TECH0 + MOTIFS[mi]) / 255.0);
      oGlow = vec4(0.0, 0.0, 0.0, m * (0.35 + 0.55 * nn));
      return;
    }
  }

  if (n < 0.0) return;
  float grain = hash(uint(cell.x + 4099), uint(cell.y * 3 + 17)) - 0.5;
  int level = clamp(int(floor(n * float(LEVELS) + grain * uDither)), 0, LEVELS - 1);
  int bucket = bucketFor(R, B, lum);
  int glyph = GLYPH0 + level;
  if (organised) {
    level = ORGANISED[level];
    glyph = GLYPH0 + level;
    bucket = eff > 140.0 ? ICE : eff > 60.0 ? PERI : INDIGO;
  } else if (uTone2.w > 0.5 && float(level) <= uEdgeMax) {
    // Sobel on the averaged brightness: on a strong edge, a stroke along it traces the arm.
    float tl = lumAt(cell + ivec2(-1, -1)), tc = lumAt(cell + ivec2(0, -1)), tr = lumAt(cell + ivec2(1, -1));
    float ml = lumAt(cell + ivec2(-1, 0)), mr = lumAt(cell + ivec2(1, 0));
    float bl = lumAt(cell + ivec2(-1, 1)), bc = lumAt(cell + ivec2(0, 1)), br = lumAt(cell + ivec2(1, 1));
    float gx = tr + 2.0 * mr + br - tl - 2.0 * ml - bl;
    float gy = (bl + 2.0 * bc + br - tl - 2.0 * tc - tr) * (uCell.x / uCell.y);
    if (gx * gx + gy * gy > uTone2.z * uTone2.z * 16.0) {
      float a = degrees(atan(gx, -gy));
      if (a < 0.0) a += 180.0;
      a = mod(a, 180.0);
      int e = (a < 30.0 || a >= 150.0) ? 0 : a < 75.5 ? 3 : a < 104.5 ? 2 : 1;
      glyph = EDGE0 + e;
    }
  }
  if (cyan > 0.01) bucket = COLDER[bucket * 4 + min(3, int(cyan * 3.0 + dither * 0.999))];
  vec3 col = PAL[bucket];
  oCell = vec4(col, float(glyph) / 255.0);
  float glowFloor = uTone2.y + (1.0 - min(uGlowAmt, 1.0)) * 50.0;
  float glow = 0.0;
  if (glyph < EDGE0 && level >= LEVELS - GLOW_LEVELS && eff > glowFloor) {
    glow = clamp((eff - glowFloor) / (255.0 - glowFloor), 0.0, 1.0) * 0.5 * uGlowAmt * m;
  }
  oGlow = vec4(col * glow, alpha);
}`;

const COMPOSE = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uB;
uniform sampler2D uG;
uniform sampler2D uAtlas;
uniform ivec2 uGrid;
uniform vec2 uCellD;
uniform float uHeight;
uniform vec2 uTile;
uniform float uPad;
uniform vec2 uAtlasSize;
uniform vec3 uPtr;        // x, y (device px), strength
uniform vec2 uPtrK;       // radius, largest shift (device px)
out vec4 o;

float smooth01(float n) { return n * n * (3.0 - 2.0 * n); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y);
  // Glyphs move away from the cursor and a little around it: look up where this pixel came from.
  if (uPtr.z > 0.002) {
    vec2 d = p - uPtr.xy;
    float dist = length(d);
    if (dist < uPtrK.x && dist > 0.5) {
      float s = smooth01(1.0 - dist / uPtrK.x) * uPtr.z * uPtrK.y / dist;
      p -= vec2(d.x * 0.85 - d.y * 0.45, d.y * 0.85 + d.x * 0.45) * s;
    }
  }
  vec2 cf = p / uCellD;
  ivec2 cell = ivec2(floor(cf));
  vec3 rgb = vec3(0.0);
  float a = 0.0;
  if (cell.x >= 0 && cell.y >= 0 && cell.x < uGrid.x && cell.y < uGrid.y) {
    vec4 c = texelFetch(uB, cell, 0);
    int glyph = int(c.a * 255.0 + 0.5);
    if (glyph > 0) {
      vec2 local = p - vec2(cell) * uCellD;
      vec2 at = vec2(float(glyph - 1) * uTile.x + uPad, uPad) + local;
      float cover = texture(uAtlas, at / uAtlasSize).a;
      a = texelFetch(uG, cell, 0).a * cover;
      rgb = c.rgb * a;
    }
  }
  // Glow: the bright cells' halo, blurred over about a cell.
  vec2 uv = cf / vec2(uGrid);
  vec2 k = vec2(0.75) / vec2(uGrid);
  vec3 glow = texture(uG, uv).rgb * 0.4
    + (texture(uG, uv + vec2(k.x, k.y)).rgb + texture(uG, uv + vec2(-k.x, k.y)).rgb
      + texture(uG, uv + vec2(k.x, -k.y)).rgb + texture(uG, uv + vec2(-k.x, -k.y)).rgb) * 0.15;
  rgb += glow;
  o = vec4(rgb, max(a, max(glow.r, max(glow.g, glow.b))));
}`;

type Program = {
  program: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("no shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader: ${log}`);
  }
  return shader;
}

function link(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
  frag: string,
  names: string[],
): Program {
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  const program = gl.createProgram();
  if (!program) throw new Error("no program");
  gl.attachShader(program, vert);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`link: ${gl.getProgramInfoLog(program)}`);
  }
  const u: Program["u"] = {};
  for (const name of names) u[name] = gl.getUniformLocation(program, name);
  return { program, u };
}

function texture(gl: WebGL2RenderingContext, filter: number) {
  const tex = gl.createTexture();
  if (!tex) throw new Error("no texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/**
 * Creates the WebGL2 renderer on `canvas`, or returns null (no WebGL2, or the
 * shaders do not build); `onLost` runs if the context is lost later.
 */
export function createGlRenderer(canvas: HTMLCanvasElement, onLost: () => void): Renderer | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;

  let sample: Program;
  let cells: Program;
  let compose: Program;
  let video: WebGLTexture;
  let texA: WebGLTexture;
  let texB: WebGLTexture;
  let texG: WebGLTexture;
  let atlasTex: WebGLTexture;
  let fboA: WebGLFramebuffer | null;
  let fboB: WebGLFramebuffer | null;
  try {
    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    sample = link(gl, vert, SAMPLE, [
      "uVideo",
      "uCell",
      "uRingC",
      "uRingSize",
      "uPull",
      "uRot",
      "uTaps",
      "uMaxMix",
    ]);
    cells = link(gl, vert, CELLS, [
      "uA",
      "uGrid",
      "uCell",
      "uRingC",
      "uRingSize",
      "uLook",
      "uGlowAmt",
      "uSectorW",
      "uAnalysis",
      "uPtr",
      "uFlipsN",
      "uFlips",
      "uTone",
      "uTone2",
      "uEdgeMax",
      "uDither",
    ]);
    compose = link(gl, vert, COMPOSE, [
      "uB",
      "uG",
      "uAtlas",
      "uGrid",
      "uCellD",
      "uHeight",
      "uTile",
      "uPad",
      "uAtlasSize",
      "uPtr",
      "uPtrK",
    ]);
    gl.deleteShader(vert);
    video = texture(gl, gl.LINEAR);
    texA = texture(gl, gl.NEAREST);
    texB = texture(gl, gl.NEAREST);
    texG = texture(gl, gl.LINEAR);
    atlasTex = texture(gl, gl.LINEAR);
    fboA = gl.createFramebuffer();
    fboB = gl.createFramebuffer();
    if (gl.isContextLost()) return null;
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[ascii] WebGL2 renderer unavailable:", err);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  const vao = gl.createVertexArray();
  const flipData = new Float32Array(MAX_FLIPS * 4);

  let grid: Grid | null = null;
  let atlas: MaskAtlas | null = null;
  let atlasKey = "";
  let hasSource = false;
  let srcSize = 540;
  let fresh = false;
  let lost = false;

  const onContextLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    onLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  const allocCells = (tex: WebGLTexture, cols: number, rows: number) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  };

  return {
    kind: "webgl2",
    canvas,
    get fresh() {
      return fresh;
    },

    layout(g) {
      grid = g;
      if (lost) return;
      if (canvas.width !== g.width) canvas.width = g.width;
      if (canvas.height !== g.height) canvas.height = g.height;
      allocCells(texA, g.cols, g.rows);
      allocCells(texB, g.cols, g.rows);
      allocCells(texG, g.cols, g.rows);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texA, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texB, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, texG, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      const key = `${g.cwD.toFixed(2)}:${g.chD.toFixed(2)}:${g.fontD.toFixed(2)}:${g.heavier}:${g.fontEpoch}`;
      if (key !== atlasKey || !atlas) {
        atlas = buildMaskAtlas(atlas, g.cwD, g.chD, g.fontD, g.heavier);
        atlasKey = key;
        if (atlas) {
          gl.bindTexture(gl.TEXTURE_2D, atlasTex);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
        }
      }
    },

    source(src, size) {
      if (lost) return "busy";
      gl.bindTexture(gl.TEXTURE_2D, video);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      srcSize = size;
      hasSource = true;
      fresh = true;
      return "ok";
    },

    draw(view) {
      const g = grid;
      const at = atlas;
      if (lost || !g || !at || !hasSource) return false;
      const { look } = view;
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);

      // 1. Sample: the cell's footprint on the video, with enough taps to cover it.
      const vw = (g.ringW * g.stretch) / look.pull; // CSS px per video width
      const vh = g.ringW / look.pull;
      // Source px under a cell: 540 for the sampling clip, twice that for the poster still.
      const tapsX = Math.min(4, Math.max(1, Math.ceil(((g.cw / vw) * srcSize) / 1.25)));
      const tapsY = Math.min(8, Math.max(1, Math.ceil(((g.ch / vh) * srcSize) / 1.25)));
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
      gl.viewport(0, 0, g.cols, g.rows);
      gl.useProgram(sample.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, video);
      gl.uniform1i(sample.u.uVideo, 0);
      gl.uniform2f(sample.u.uCell, g.cw, g.ch);
      gl.uniform2f(sample.u.uRingC, g.ringCx, g.ringCy);
      gl.uniform2f(sample.u.uRingSize, g.ringW * g.stretch, g.ringW);
      gl.uniform1f(sample.u.uPull, look.pull);
      gl.uniform2f(sample.u.uRot, Math.cos(view.theta), Math.sin(view.theta));
      gl.uniform2i(sample.u.uTaps, tapsX, tapsY);
      gl.uniform1f(sample.u.uMaxMix, TUNE.maxMix);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 2. Cells: glyph, colour, opacity and glow per cell.
      let flipsN = 0;
      for (let j = 0; j < view.flipsN && flipsN < MAX_FLIPS; j++) {
        const i = view.flips[j];
        const life = view.flip[i];
        if (life <= 0) continue;
        flipData[flipsN * 4] = i % g.cols;
        flipData[flipsN * 4 + 1] = Math.floor(i / g.cols);
        flipData[flipsN * 4 + 2] = life;
        flipData[flipsN * 4 + 3] = view.flipGlyph[i];
        flipsN++;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
      gl.useProgram(cells.program);
      gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.uniform1i(cells.u.uA, 0);
      gl.uniform2i(cells.u.uGrid, g.cols, g.rows);
      gl.uniform2f(cells.u.uCell, g.cw, g.ch);
      gl.uniform2f(cells.u.uRingC, g.ringCx, g.ringCy);
      gl.uniform2f(cells.u.uRingSize, g.ringW * g.stretch, g.ringW);
      gl.uniform4f(cells.u.uLook, look.gain, look.centre, look.cyan, look.contrast);
      gl.uniform1f(cells.u.uGlowAmt, look.glow);
      gl.uniform4fv(cells.u.uSectorW, view.sectorW);
      gl.uniform2f(cells.u.uAnalysis, view.analysisW, view.progress);
      gl.uniform3f(cells.u.uPtr, view.ptrX, view.ptrY, view.ptrW);
      gl.uniform1i(cells.u.uFlipsN, flipsN);
      if (flipsN) gl.uniform4fv(cells.u.uFlips, flipData, 0, flipsN * 4);
      gl.uniform4f(cells.u.uTone, TUNE.floor, TUNE.ceil, TUNE.gamma, TUNE.scurve);
      gl.uniform4f(cells.u.uTone2, TUNE.alpha0, TUNE.glowFloor, TUNE.edgeThr, TUNE.edges);
      gl.uniform1f(cells.u.uEdgeMax, TUNE.edgeMax);
      gl.uniform1f(cells.u.uDither, TUNE.dither);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 3. Compose onto the canvas.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, g.width, g.height);
      gl.useProgram(compose.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texB);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texG);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      gl.uniform1i(compose.u.uB, 0);
      gl.uniform1i(compose.u.uG, 1);
      gl.uniform1i(compose.u.uAtlas, 2);
      gl.uniform2i(compose.u.uGrid, g.cols, g.rows);
      gl.uniform2f(compose.u.uCellD, g.cwD, g.chD);
      gl.uniform1f(compose.u.uHeight, g.height);
      gl.uniform2f(compose.u.uTile, at.tileW, at.tileH);
      gl.uniform1f(compose.u.uPad, at.pad);
      gl.uniform2f(compose.u.uAtlasSize, at.canvas.width, at.canvas.height);
      gl.uniform3f(compose.u.uPtr, view.ptrX * g.scale, view.ptrY * g.scale, view.ptrW);
      gl.uniform2f(compose.u.uPtrK, POINTER_RADIUS * g.scale, POINTER_SHIFT * g.scale);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.activeTexture(gl.TEXTURE0);
      fresh = false;
      return true;
    },

    workerMs: () => 0,

    destroy() {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      if (!gl.isContextLost()) {
        for (const p of [sample, cells, compose]) gl.deleteProgram(p.program);
        for (const t of [video, texA, texB, texG, atlasTex]) gl.deleteTexture(t);
        gl.deleteFramebuffer(fboA);
        gl.deleteFramebuffer(fboB);
        gl.deleteVertexArray(vao);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      canvas.width = canvas.height = 0;
    },
  };
}

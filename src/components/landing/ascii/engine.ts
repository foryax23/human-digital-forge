import {
  FONT_FAMILY,
  GLYPHS,
  loadGlyphFont,
  measureGlyphs,
  TECH,
  type GlyphMetrics,
} from "./atlas";
import {
  clamp01,
  FLIP_LIFE,
  FLIPS_PER_PULSE,
  LOOK_KEYS,
  LOOKS,
  MAX_FLIPS,
  ringMask,
  SECTORS,
  TUNE,
  type Look,
} from "./look";
import { create2dRenderer } from "./render-2d";
import { createGlRenderer } from "./render-gl";
import type { Grid, Renderer, View } from "./renderer";
import type { AsciiVortexState, OrbitSector } from "./types";

/*
 * The ASCII vortex engine. The looping swirl video plays in a hidden <video>;
 * every new frame goes to a renderer (WebGL2 when available, else a 2D canvas
 * with a coarser grid) that redraws it as coloured glyphs on a fine character
 * grid over the hero: averaged brightness picks the glyph, the video's colour
 * picks the colour bucket, the ring's radial mask fades the edges. The state
 * looks (focus, scanning, ...) are a handful of numbers eased toward their
 * targets. Drawing stops whenever nothing can be seen: hidden tab, hero off
 * screen, the page-wide pause switch; reduced motion gets one static frame.
 */

export type AsciiEngine = {
  setState(state: AsciiVortexState): void;
  setSector(sector: OrbitSector | null): void;
  setProgress(progress: number): void;
  /** A keystroke in the search: a few cells near it flip to technical glyphs. */
  pulse(): void;
  setPaused(paused: boolean): void;
  destroy(): void;
};

export type AsciiEngineOptions = {
  /** Full-bleed layer the canvas covers. */
  layer: HTMLElement;
  /** Invisible box with the old video ring's classes: its transformed rect is the ring. */
  ring: HTMLElement;
  /** Empty full-bleed element the engine puts its canvas in. */
  host: HTMLElement;
  video: HTMLVideoElement;
  /** The poster ring under the canvas: the source of the static frame. */
  poster: HTMLImageElement;
  src: string;
  variant: "hero" | "backdrop";
  reducedMotion: boolean;
  /** The first ASCII frame is on the canvas. */
  onReady: () => void;
  /** No usable canvas, the video failed or frames are far too slow: show the video ring. */
  onFail: () => void;
};

/** Frame rate of SWIRL_VIDEO.ascii (the master at half speed). */
const SOURCE_FPS = 30;
/** Draw rate cap: the video's own rate; pointer and state easing stay smooth at it. */
const FRAME_MS = 1000 / 30;
/**
 * Target cell width (CSS px) and column bounds per layout width: desktop, tablet, phone.
 * The 2D fallback draws every cell itself, so it gets cells 1.4x as wide.
 */
const CELLS: ReadonlyArray<readonly [minWidth: number, lo: number, hi: number, cell: number]> = [
  [1024, 200, 330, 5.5],
  [768, 130, 210, 5],
  [0, 70, 110, 4.5],
];
const CELL_2D = 1.4;
/** 2D path: median main-thread ms per frame above which the grid gets coarser (twice at most)... */
const SLOW_2D_MS = 20;
/** ...and above which, still, the video ring takes over. */
const SLOW_FRAME_MS = 34;
/** WebGL: median ms between drawn video frames above which it renders at 1x, then coarser at 24 fps. */
const SLOW_GL_INTERVAL = 52;

type DevStats = {
  renderer: "webgl2" | "2d" | "none";
  /** Main-thread ms per drawn frame (sampling or upload, plus drawing). */
  median: number;
  p95: number;
  /** Worker ms per sampled frame (2D path with a worker, else 0). */
  workerMedian: number;
  fps: number;
  frames: number;
  cols: number;
  rows: number;
  cells: number;
  /** Device px per CSS px of the canvas. */
  scale: number;
  /** Degrade steps taken on this device. */
  degrade: number;
};

export function createAsciiEngine(opts: AsciiEngineOptions): AsciiEngine | null {
  const { layer, ring, host, video, poster, variant, reducedMotion } = opts;
  if (typeof document.createElement("canvas").getContext !== "function") return null;

  const pointerOn =
    variant === "hero" && !reducedMotion && window.matchMedia("(pointer: fine)").matches;
  // Fewer columns on low-core devices from the start.
  const weak = (navigator.hardwareConcurrency || 8) <= 4;

  // --- state -------------------------------------------------------------------------------
  let renderer: Renderer | null = null;
  let force2d = false;
  let destroyed = false;
  let failed = false;
  let started = false; // fonts loaded, renderer created
  let readySent = false;
  let paused = false;
  let visible = true;
  let blocked = false; // autoplay refused: static frame until a gesture
  let raf = 0;
  let lastDraw = 0;
  let lastSample = 0;
  let lastStep = 0;
  let lastFrame = -1;
  let dirty = true;
  let frameMs = FRAME_MS;
  let coarse = weak ? 1.15 : 1;
  let lowRes = false;
  let degrade = 0;
  let videoFrames = 0; // requestVideoFrameCallback count (0 = not supported or not fired yet)
  let vfcId = 0;

  const look: Look = { ...LOOKS.idle };
  const target: Look = { ...LOOKS.idle };
  const sectorW = new Float32Array(SECTORS.length);
  let sector: OrbitSector | null = null;
  let progress = 0;
  let state: AsciiVortexState = "idle";

  // Pointer target in layer CSS px (the eased position lives in `view`).
  let ptrTargetX = 0;
  let ptrTargetY = 0;
  let ptrClientX = 0;
  let ptrClientY = 0;
  let ptrIn = false;
  let ptrMoved = false;

  // --- geometry ----------------------------------------------------------------------------
  let metrics: GlyphMetrics = { advance: 0.6, line: 1.2 };
  let fontEpoch = 0;
  let grid: Grid | null = null;
  let docLeft = 0; // the layer's document offset, for pointer mapping
  let docTop = 0;

  // Typing flips: per-cell life and glyph, grown (never shrunk) with the grid.
  let cap = 0;
  let flip = new Float32Array(0);
  let flipGlyph = new Uint8Array(0);
  let band = new Int32Array(0); // flip candidates
  let bandN = 0;
  const flips = new Int32Array(MAX_FLIPS);
  let seed = 2026;

  const view: View = {
    look,
    theta: 0,
    sectorW,
    analysisW: 0,
    progress: 0,
    ptrX: 0,
    ptrY: 0,
    ptrW: 0,
    flips,
    flipsN: 0,
    flip,
    flipGlyph,
  };

  // Frame timing: the slow-device guards, and stats in development.
  const times = new Float32Array(240);
  const stamps = new Float64Array(240);
  let timesN = 0;
  let videoDraws = 0;

  function grow(n: number) {
    if (n <= cap) return;
    cap = n;
    flip = view.flip = new Float32Array(n);
    flipGlyph = view.flipGlyph = new Uint8Array(n);
    band = new Int32Array(n);
  }

  function newCanvas() {
    const canvas = document.createElement("canvas");
    canvas.className = "absolute inset-0 h-full w-full";
    host.appendChild(canvas);
    return canvas;
  }

  /** WebGL2 unless it is missing or was lost; a canvas that tried WebGL can't go 2D, so each try gets its own. */
  function createRenderer(): Renderer | null {
    if (!force2d) {
      const canvas = newCanvas();
      const gl = createGlRenderer(canvas, onGlLost);
      if (gl) return gl;
      canvas.remove();
    }
    const canvas = newCanvas();
    const r = create2dRenderer(canvas);
    if (!r) canvas.remove();
    return r;
  }

  function dropRenderer() {
    if (!renderer) return;
    renderer.destroy();
    renderer.canvas.remove();
    renderer = null;
  }

  function onGlLost() {
    // Rather than wait for a restore, carry on with the 2D path.
    queueMicrotask(() => {
      if (destroyed || failed) return;
      dropRenderer();
      force2d = true;
      renderer = createRenderer();
      if (!renderer) return fail();
      resetTimes();
      if (measure()) drawStill();
      sync();
    });
  }

  function measure() {
    const r = renderer;
    if (!r) return false;
    const lr = layer.getBoundingClientRect();
    const rr = ring.getBoundingClientRect();
    if (lr.width < 2 || lr.height < 2 || rr.height < 2) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = lowRes ? 1 : dpr;
    docLeft = lr.left + window.scrollX;
    docTop = lr.top + window.scrollY;

    const [, lo, hi, cell] = CELLS.find(([min]) => lr.width >= min) ?? CELLS[CELLS.length - 1];
    const k = (r.kind === "2d" ? CELL_2D : 1) * coarse;
    const cols = Math.max(24, Math.round(Math.min(hi, Math.max(lo, lr.width / cell)) / k));
    const cw = lr.width / cols;
    const font = cw / metrics.advance;
    const ch = font * metrics.line;
    const rows = Math.ceil(lr.height / ch);
    const width = Math.round(lr.width * scale);
    const height = Math.round(lr.height * scale);
    const g: Grid = {
      cols,
      rows,
      cw,
      ch,
      cwD: width / cols,
      chD: ch * (height / lr.height),
      width,
      height,
      scale: width / lr.width,
      fontD: font * (width / lr.width),
      ringCx: rr.left + rr.width / 2 - lr.left,
      ringCy: rr.top + rr.height / 2 - lr.top,
      ringW: rr.height,
      stretch: rr.width / rr.height,
      heavier: scale < 1.5,
      fontEpoch,
    };
    grid = g;
    r.layout(g);

    grow(cols * rows);
    flip.fill(0);
    view.flipsN = 0;
    bandN = 0;
    // Typing band: just outside the eye, at the search's height (a little below the centre).
    for (let row = 0; row < rows; row++) {
      const v = ((row + 0.5) * ch - g.ringCy) / g.ringW;
      if (v <= 0.05 || v >= 0.24) continue;
      for (let col = 0; col < cols; col++) {
        const u = ((col + 0.5) * cw - g.ringCx) / (g.ringW * g.stretch);
        const rad = Math.sqrt(u * u + v * v) * 2;
        if (rad > 0.26 && rad < 0.56 && ringMask(rad) > 0.1) {
          band[bandN++] = row * cols + col;
        }
      }
    }
    dirty = true;
    return true;
  }

  // --- easing ------------------------------------------------------------------------------
  /** Eases every look value toward its target; true while anything still moves. */
  function step(dt: number) {
    const k = 1 - Math.exp(-dt / 0.16);
    let moving = false;
    for (const key of LOOK_KEYS) {
      const d = target[key] - look[key];
      if (Math.abs(d) > 0.002) {
        look[key] += d * k;
        moving = true;
      } else look[key] = target[key];
    }
    if (look.spin > 0) {
      view.theta = (view.theta + look.spin * dt) % (Math.PI * 2);
      moving = true;
    }
    for (let s = 0; s < SECTORS.length; s++) {
      const d = (SECTORS[s] === sector ? 1 : 0) - sectorW[s];
      if (Math.abs(d) > 0.002) {
        sectorW[s] += d * k;
        moving = true;
      } else sectorW[s] += d;
    }
    const a = (state === "analysis" ? 1 : 0) - view.analysisW;
    if (Math.abs(a) > 0.002) {
      view.analysisW += a * k;
      moving = true;
    } else view.analysisW += a;
    const p = progress - view.progress;
    if (Math.abs(p) > 0.001) {
      view.progress += p * (1 - Math.exp(-dt / 0.35));
      moving = true;
    } else view.progress = progress;

    if (pointerOn) {
      if (ptrMoved) {
        ptrTargetX = ptrClientX + window.scrollX - docLeft;
        ptrTargetY = ptrClientY + window.scrollY - docTop;
        if (view.ptrW < 0.01) {
          view.ptrX = ptrTargetX;
          view.ptrY = ptrTargetY;
        }
        ptrMoved = false;
      }
      const goal = ptrIn ? 1 : 0;
      const dx = ptrTargetX - view.ptrX;
      const dy = ptrTargetY - view.ptrY;
      if (
        Math.abs(goal - view.ptrW) > 0.002 ||
        (view.ptrW > 0.002 && Math.abs(dx) + Math.abs(dy) > 0.3)
      ) {
        view.ptrW += (goal - view.ptrW) * (1 - Math.exp(-dt / 0.14));
        const kp = 1 - Math.exp(-dt / 0.07);
        view.ptrX += dx * kp;
        view.ptrY += dy * kp;
        moving = true;
      } else view.ptrW = goal;
    }

    if (view.flipsN) {
      moving = true;
      let kept = 0;
      for (let j = 0; j < view.flipsN; j++) {
        const i = flips[j];
        flip[i] -= dt / FLIP_LIFE;
        if (flip[i] > 0) flips[kept++] = i;
        else flip[i] = 0;
      }
      view.flipsN = kept;
    }
    return moving;
  }

  function snapLook() {
    Object.assign(look, target);
    for (let s = 0; s < SECTORS.length; s++) sectorW[s] = SECTORS[s] === sector ? 1 : 0;
    view.analysisW = state === "analysis" ? 1 : 0;
    view.progress = progress;
  }

  // --- drawing -----------------------------------------------------------------------------
  /** The best still source right now: the current video frame, else the poster. */
  function stillSource(): [HTMLVideoElement | HTMLImageElement, number] | null {
    if (video.readyState >= 2 && video.videoWidth) return [video, video.videoWidth];
    if (poster.complete && poster.naturalWidth) return [poster, poster.naturalWidth];
    return null;
  }

  function draw() {
    if (!renderer?.draw(view)) return false;
    dirty = false;
    if (!readySent) {
      readySent = true;
      opts.onReady();
    }
    return true;
  }

  /** One frame outside the loop: reduced motion, autoplay refused, paused, or a new layout. */
  function drawStill() {
    if (!started || failed || destroyed || !renderer || !grid) return;
    const src = stillSource();
    if (!src) return;
    try {
      renderer.source(src[0], src[1], view, performance.now(), true);
    } catch {
      return fail();
    }
    draw();
  }

  // --- loop --------------------------------------------------------------------------------
  const shouldRun = () =>
    started &&
    !failed &&
    !destroyed &&
    !reducedMotion &&
    !paused &&
    visible &&
    !blocked &&
    !document.hidden;

  function tick(now: number) {
    raf = 0;
    if (!shouldRun() || !renderer || !grid) return;
    raf = requestAnimationFrame(tick);
    const dt = lastStep ? Math.min((now - lastStep) / 1000, 0.1) : 1 / 60;
    lastStep = now;
    const moving = step(dt);
    const due = now - lastDraw >= frameMs - 4;
    const t0 = performance.now();
    const ready = video.readyState >= 2 && video.videoWidth > 0;
    let newFrame = false;

    if (ready && now - lastSample >= frameMs - 4) {
      // currentTime runs continuously; a new picture only arrives every 1/30 s.
      const frame = videoFrames || Math.floor(video.currentTime * SOURCE_FPS + 0.01);
      // The 2D path bakes pull and spin into its samples; WebGL applies them while drawing.
      const turning = renderer.kind === "2d" && moving && (look.pull !== 1 || look.spin > 0);
      if (frame !== lastFrame || dirty || turning) {
        try {
          if (renderer.source(video, video.videoWidth, view, now, false) === "ok") {
            newFrame = frame !== lastFrame;
            lastFrame = frame;
            lastSample = now;
          }
        } catch {
          return fail();
        }
      }
    }

    if (renderer.fresh || (due && (moving || dirty))) {
      if (draw()) {
        lastDraw = now;
        if (ready && (newFrame || renderer.kind === "2d")) record(performance.now() - t0, now);
      }
    }
  }

  function resetTimes() {
    timesN = 0;
    videoDraws = 0;
  }

  function record(ms: number, now: number) {
    videoDraws++;
    if (videoDraws <= 30) return; // warm-up (about 1 s): atlas upload, first decodes, hydration
    times[timesN % times.length] = ms;
    stamps[timesN % stamps.length] = now;
    timesN++;
    if (timesN !== 60 || !renderer) return;
    // One check after the first 60 frames; any change restarts the window.
    if (renderer.kind === "2d") {
      const median = percentile(times, timesN, 0.5);
      if (median <= SLOW_2D_MS) return;
      if (degrade < 2) {
        degrade++;
        coarse *= 1.25;
        resetTimes();
        remeasure();
      } else if (median > SLOW_FRAME_MS) fail();
    } else if (degrade < 2) {
      const gaps = new Float32Array(59);
      for (let j = 1; j < 60; j++) gaps[j - 1] = stamps[j] - stamps[j - 1];
      if (percentile(gaps, 59, 0.5) <= SLOW_GL_INTERVAL) return;
      degrade++;
      if (degrade === 1 && Math.min(window.devicePixelRatio || 1, 2) > 1.2) lowRes = true;
      else {
        coarse *= 1.2;
        frameMs = 1000 / 24;
      }
      resetTimes();
      remeasure();
    }
  }

  function sync() {
    if (destroyed || failed || !started) return;
    if (shouldRun()) {
      if (video.paused && video.getAttribute("src")) {
        video.play().catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "NotAllowedError") {
            blocked = true;
            drawStill();
            window.addEventListener("pointerdown", retry, { once: true });
            window.addEventListener("keydown", retry, { once: true });
          }
        });
      }
      if (!raf) {
        lastStep = 0;
        raf = requestAnimationFrame(tick);
      }
    } else {
      if (!video.paused) video.pause();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function retry() {
    window.removeEventListener("pointerdown", retry);
    window.removeEventListener("keydown", retry);
    blocked = false;
    sync();
  }

  function fail() {
    if (failed || destroyed) return;
    failed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    video.pause();
    opts.onFail();
  }

  // --- observers and listeners -------------------------------------------------------------
  let measureRaf = 0;
  const remeasure = () => {
    if (measureRaf || destroyed) return;
    measureRaf = requestAnimationFrame(() => {
      measureRaf = 0;
      // Redraw at once (resizing the canvas cleared it).
      if (started && measure()) drawStill();
    });
  };
  const resizeObserver = new ResizeObserver(remeasure);
  resizeObserver.observe(layer);
  resizeObserver.observe(ring);

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  intersection.observe(layer);

  const onVisibility = () => sync();
  document.addEventListener("visibilitychange", onVisibility);

  const onVideoError = () => fail();
  // The first decoded frame replaces the poster frame, even while the loop is stopped.
  const onVideoData = () => {
    if (!raf) drawStill();
  };
  video.addEventListener("error", onVideoError);
  video.addEventListener("loadeddata", onVideoData);
  // Exact new-frame signal where supported (else the loop reads currentTime).
  const onVideoFrame = () => {
    videoFrames++;
    vfcId = video.requestVideoFrameCallback(onVideoFrame);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    ptrClientX = e.clientX;
    ptrClientY = e.clientY;
    ptrIn = true;
    ptrMoved = true;
  };
  const onPointerOut = (e: PointerEvent) => {
    if (!e.relatedTarget) ptrIn = false;
  };
  const onBlur = () => {
    ptrIn = false;
  };
  if (pointerOn) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("blur", onBlur);
  }

  // --- start -------------------------------------------------------------------------------
  void loadGlyphFont().then((fontReady) => {
    if (destroyed) return;
    metrics = measureGlyphs();
    renderer = createRenderer();
    if (!renderer) return fail();
    started = true;
    measure(); // a zero-size (hidden) layer measures later, from the ResizeObserver
    if (!fontReady) {
      // Slow font: start with the fallback monospace, redraw once JetBrains Mono arrives.
      void document.fonts
        ?.load(`500 10px ${FONT_FAMILY}`, GLYPHS + TECH)
        .then((faces) => {
          if (destroyed || !faces.length) return;
          metrics = measureGlyphs();
          fontEpoch++;
          remeasure();
        })
        .catch(() => {});
    }
    if (!reducedMotion) {
      video.muted = true;
      video.src = opts.src;
      video.load();
      if ("requestVideoFrameCallback" in video) {
        vfcId = video.requestVideoFrameCallback(onVideoFrame);
      }
    }
    const first = () => {
      if (destroyed) return;
      drawStill();
      sync();
    };
    if (poster.complete) first();
    else poster.decode().then(first, first);
  });

  /** Outside the loop, changes apply at once (no motion to ease). */
  const settle = () => {
    if (reducedMotion || !raf) {
      snapLook();
      drawStill();
    }
  };

  const api: AsciiEngine = {
    setState(next) {
      state = next;
      Object.assign(target, LOOKS[next]);
      settle();
    },
    setSector(next) {
      sector = next;
      settle();
    },
    setProgress(next) {
      progress = clamp01(next);
      settle();
    },
    pulse() {
      if (reducedMotion || !bandN || !raf) return;
      for (let j = 0; j < FLIPS_PER_PULSE && view.flipsN < MAX_FLIPS; j++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        const i = band[(seed >>> 8) % bandN];
        if (flip[i] <= 0) flips[view.flipsN++] = i;
        flip[i] = 1;
        flipGlyph[i] = (seed >>> 4) % TECH.length;
      }
    },
    setPaused(next) {
      paused = next;
      sync();
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      if (measureRaf) cancelAnimationFrame(measureRaf);
      raf = 0;
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      video.removeEventListener("error", onVideoError);
      video.removeEventListener("loadeddata", onVideoData);
      if (vfcId) video.cancelVideoFrameCallback(vfcId);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      video.pause();
      video.removeAttribute("src");
      video.load();
      dropRenderer();
      if (import.meta.env.DEV) delete (window as { __asciiVortex?: unknown }).__asciiVortex;
    },
  };

  if (import.meta.env.DEV) {
    const stats = (): DevStats => {
      const n = Math.min(timesN, stamps.length);
      const last = stamps[(timesN - 1) % stamps.length];
      const first = stamps[(timesN - n) % stamps.length];
      return {
        renderer: renderer?.kind ?? "none",
        median: percentile(times, timesN, 0.5),
        p95: percentile(times, timesN, 0.95),
        workerMedian: renderer?.workerMs() ?? 0,
        fps: n > 1 ? ((n - 1) * 1000) / (last - first || 1) : 0,
        frames: timesN,
        cols: grid?.cols ?? 0,
        rows: grid?.rows ?? 0,
        cells: grid ? grid.cols * grid.rows : 0,
        scale: grid?.scale ?? 0,
        degrade,
      };
    };
    Object.assign(window, {
      __asciiVortex: {
        stats,
        get running() {
          return raf !== 0;
        },
        /** State changes without the hero (checks from the browser console or puppeteer). */
        engine: api,
        /** Tone and edge settings (look.ts TUNE), plus `coarse` (cell size factor) and `force2d`. */
        tune(patch: Partial<typeof TUNE> & { coarse?: number; force2d?: boolean }) {
          const { coarse: c, force2d: f, ...rest } = patch;
          Object.assign(TUNE, rest);
          if (c) coarse = c;
          if (f !== undefined && f !== force2d) {
            force2d = f;
            dropRenderer();
            renderer = createRenderer();
          }
          resetTimes();
          if (measure()) drawStill();
          return { ...TUNE, coarse, renderer: renderer?.kind };
        },
      },
    });
  }

  return api;
}

/** The p-quantile of the last `count` entries written round-robin into `ring`. */
function percentile(ring: Float32Array, count: number, p: number) {
  const n = Math.min(count, ring.length);
  if (!n) return 0;
  const sorted = Array.from(ring.subarray(0, n)).sort((a, b) => a - b);
  return sorted[Math.min(n - 1, Math.floor(p * n))];
}

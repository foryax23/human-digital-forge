import type { Look } from "./look";

/*
 * The contract between the engine (state, timing, layout, input) and the two
 * renderers: render-gl.ts (WebGL2, the primary path) and render-2d.ts (the
 * 2D-canvas fallback with a coarser grid).
 */

/** The character grid over the layer, and the ring it shows. */
export type Grid = {
  cols: number;
  rows: number;
  /** Cell size, CSS px and device px (the canvas may render below the screen's DPR). */
  cw: number;
  ch: number;
  cwD: number;
  chD: number;
  /** Canvas size, device px, and device px per CSS px. */
  width: number;
  height: number;
  scale: number;
  /** Glyph size, device px. */
  fontD: number;
  /** Ring centre (layer CSS px), unstretched diameter (CSS px) and horizontal stretch. */
  ringCx: number;
  ringCy: number;
  ringW: number;
  stretch: number;
  /** Thin strokes fade on 1x screens: draw a weight heavier there. */
  heavier: boolean;
  /** Bumped when the glyph font changes (JetBrains Mono arriving late): redraw the atlas. */
  fontEpoch: number;
};

/** Everything that changes from frame to frame. */
export type View = {
  look: Look;
  /** Extra rotation of the swirl, rad. */
  theta: number;
  /** Hover weight of each orbit sector, in quadrant order (look.ts SECTORS). */
  sectorW: Float32Array;
  /** Weight of the analysis look and the real scan progress shown, 0..1. */
  analysisW: number;
  progress: number;
  /** Pointer in layer CSS px and its strength (0 = off). */
  ptrX: number;
  ptrY: number;
  ptrW: number;
  /** Live typing flips: cell indices, and per cell the remaining life (0..1) and TECH glyph. */
  flips: Int32Array;
  flipsN: number;
  flip: Float32Array;
  flipGlyph: Uint8Array;
};

export type SourceResult = "ok" | "busy";

export interface Renderer {
  readonly kind: "webgl2" | "2d";
  readonly canvas: HTMLCanvasElement;
  /** New grid (also after a resize). */
  layout(grid: Grid): void;
  /**
   * Takes the source's current picture: live video frames may go to a worker
   * ("busy" while one is in flight); stills are read at once. Throws when the
   * picture cannot be read.
   */
  source(
    src: HTMLVideoElement | HTMLImageElement,
    size: number,
    view: View,
    now: number,
    still: boolean,
  ): SourceResult;
  /** New pixels arrived since the last draw. */
  readonly fresh: boolean;
  /** Draws the latest picture with `view`; false while there is nothing to draw yet. */
  draw(view: View): boolean;
  /** Worker ms per sampled frame (2D path), for the development stats. */
  workerMs(): number;
  destroy(): void;
}

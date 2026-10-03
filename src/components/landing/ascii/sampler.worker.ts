import { boxDown, SUB_X, SUB_Y } from "./box";

/*
 * Off-main-thread sampler for the 2D ASCII path (see sampler.ts): draws one
 * transferred VideoFrame onto a (cols x SUB_X) x (rows x SUB_Y) canvas with
 * the ring transform, averages each cell's block and sends the cell pixels
 * back in the buffer it was given. Reading a hardware-decoded frame back to
 * the CPU waits on the GPU process; here that wait blocks this worker instead
 * of the page.
 */

export type SampleRequest = {
  id: number;
  frame: VideoFrame;
  buf: ArrayBuffer;
  cols: number;
  rows: number;
  /** Canvas transform (a, b, c, d, e, f) from frame pixels to cell pixels. */
  m: number[];
  size: number;
};

export type SampleResponse = {
  id: number;
  buf: ArrayBuffer;
  cols: number;
  rows: number;
  ms: number;
  error?: boolean;
};

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<SampleRequest>) => void) | null;
  postMessage(message: SampleResponse | "ready", transfer?: Transferable[]): void;
};

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

scope.onmessage = ({ data }) => {
  const { id, frame, cols, rows, m, size } = data;
  let buf = data.buf;
  const t0 = performance.now();
  try {
    const w = cols * SUB_X;
    const h = rows * SUB_Y;
    canvas ??= new OffscreenCanvas(w, h);
    ctx ??= canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("no 2d context");
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(
      m[0] * SUB_X,
      m[1] * SUB_Y,
      m[2] * SUB_X,
      m[3] * SUB_Y,
      m[4] * SUB_X,
      m[5] * SUB_Y,
    );
    ctx.drawImage(frame, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, w, h).data;
    if (buf.byteLength < cols * rows * 4) buf = new ArrayBuffer(cols * rows * 4);
    boxDown(px, cols, rows, new Uint8Array(buf));
    scope.postMessage({ id, buf, cols, rows, ms: performance.now() - t0 }, [buf]);
  } catch {
    scope.postMessage({ id, buf, cols, rows, ms: 0, error: true }, [buf]);
  } finally {
    frame.close();
  }
};

scope.postMessage("ready");

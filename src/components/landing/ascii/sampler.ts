import { boxDown, SUB_X, SUB_Y } from "./box";
import type { SampleRequest, SampleResponse } from "./sampler.worker";

/*
 * For the 2D path: turns a video frame (or the poster) into one pixel per
 * character cell, each the average of its cell's area (see box.ts). On
 * the main thread, drawing a hardware-decoded frame into a readable canvas
 * waits on the GPU process (5-15 ms on the busy homepage), so live frames go to
 * a worker as transferred VideoFrames where the browser can; the main-thread
 * canvas is the fallback and draws the one-off stills. Two pixel buffers
 * travel back and forth, so nothing large is allocated per frame.
 */

/** Canvas transform (a, b, c, d, e, f) from source pixels to cell pixels. */
export type Matrix = Float64Array;

export type Sampler = {
  /** Samples on the main thread, right now. */
  sampleNow(
    src: CanvasImageSource,
    size: number,
    m: Matrix,
    cols: number,
    rows: number,
  ): Uint8Array;
  /**
   * Sends the video's current frame to the worker: "sent", "busy" (a frame is
   * still in flight) or "unavailable" (no worker: use sampleNow).
   */
  request(
    video: HTMLVideoElement,
    m: Matrix,
    cols: number,
    rows: number,
    now: number,
  ): "sent" | "busy" | "unavailable";
  destroy(): void;
};

/** A frame the (started) worker hasn't sent back after this long means it's stuck: give up on it. */
const WORKER_TIMEOUT = 3000;

export function createSampler(
  onPixels: (px: Uint8Array, cols: number, rows: number, workerMs: number) => void,
): Sampler | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  let worker: Worker | null = null;
  let workerReady = false; // the module loaded (frames go to the main thread until then)
  let sentAt = 0; // 0 = nothing in flight
  let seq = 0;
  let spare: ArrayBuffer | null = null;
  let current: ArrayBuffer | null = null;
  let still = new Uint8Array(0);

  const dropWorker = () => {
    worker?.terminate();
    worker = null;
    sentAt = 0;
  };

  if (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof VideoFrame !== "undefined"
  ) {
    try {
      worker = new Worker(new URL("./sampler.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }: MessageEvent<SampleResponse | "ready">) => {
        if (data === "ready") {
          workerReady = true;
          return;
        }
        sentAt = 0;
        if (data.error) {
          spare = data.buf;
          dropWorker();
          return;
        }
        spare = current;
        current = data.buf;
        if (data.id === seq) {
          onPixels(
            new Uint8Array(data.buf, 0, data.cols * data.rows * 4),
            data.cols,
            data.rows,
            data.ms,
          );
        }
      };
      worker.onerror = dropWorker;
      worker.onmessageerror = dropWorker;
    } catch {
      worker = null;
    }
  }

  return {
    sampleNow(src, size, m, cols, rows) {
      const w = cols * SUB_X;
      const h = rows * SUB_Y;
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
      ctx.drawImage(src, 0, 0, size, size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (still.length !== cols * rows * 4) still = new Uint8Array(cols * rows * 4);
      boxDown(ctx.getImageData(0, 0, w, h).data, cols, rows, still);
      return still;
    },
    request(video, m, cols, rows, now) {
      if (!worker || !workerReady) return "unavailable";
      if (sentAt) {
        if (now - sentAt < WORKER_TIMEOUT) return "busy";
        dropWorker();
        return "unavailable";
      }
      let frame: VideoFrame;
      try {
        frame = new VideoFrame(video);
      } catch {
        return "unavailable";
      }
      const bytes = cols * rows * 4;
      const buf = spare && spare.byteLength >= bytes ? spare : new ArrayBuffer(bytes);
      spare = null;
      const message: SampleRequest = {
        id: ++seq,
        frame,
        buf,
        cols,
        rows,
        m: Array.from(m),
        size: video.videoWidth,
      };
      try {
        worker.postMessage(message, [frame, buf]);
      } catch {
        frame.close();
        dropWorker();
        return "unavailable";
      }
      sentAt = now;
      return "sent";
    },
    destroy() {
      dropWorker();
      canvas.width = canvas.height = 0;
      spare = current = null;
      still = new Uint8Array(0);
    },
  };
}

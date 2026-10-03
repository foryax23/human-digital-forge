/**
 * Sub-samples per cell, across and down, for the 2D path's area-averaged
 * sampling: the frame is drawn at (cols x SUB_X) x (rows x SUB_Y) and each
 * block is averaged (a cell covers about 1.5 x 4 video pixels on desktop, so
 * plain bilinear sampling would skip most of each cell).
 */
export const SUB_X = 2;
export const SUB_Y = 3;

/** Averages `src` ((cols x SUB_X) x (rows x SUB_Y) RGBA) into one RGBA pixel per cell in `out`. */
export function boxDown(src: Uint8ClampedArray, cols: number, rows: number, out: Uint8Array) {
  const stride = cols * SUB_X * 4;
  const n = SUB_X * SUB_Y;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let p = row * SUB_Y * stride + col * SUB_X * 4;
      for (let y = 0; y < SUB_Y; y++, p += stride) {
        for (let x = 0, q = p; x < SUB_X; x++, q += 4) {
          r += src[q];
          g += src[q + 1];
          b += src[q + 2];
        }
      }
      const o = (row * cols + col) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
}

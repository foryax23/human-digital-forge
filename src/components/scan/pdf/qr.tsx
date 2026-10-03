import { Path, Svg } from "@react-pdf/renderer";
import QRCode from "qrcode";

/**
 * QR code drawn as one vector path (crisp at any print size) from the
 * qrcode library's module matrix. Runs of dark modules merge into one rect.
 */
function qrPath(text: string): { size: number; d: string } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = modules.size;
  const parts: string[] = [];
  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (!modules.get(row, col)) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < size && modules.get(row, col)) col += 1;
      parts.push(`M${start} ${row}h${col - start}v1h${start - col}z`);
    }
  }
  return { size, d: parts.join("") };
}

export function QrCode({ value, size, color }: { value: string; size: number; color: string }) {
  const { size: modules, d } = qrPath(value);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${modules} ${modules}`}>
      <Path d={d} fill={color} />
    </Svg>
  );
}

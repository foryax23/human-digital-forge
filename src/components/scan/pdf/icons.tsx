import { Path, Svg } from "@react-pdf/renderer";

/*
 * Lucide icon geometry (ISC licence, https://lucide.dev) on a 24×24 grid,
 * redrawn as react-pdf vectors so they stay sharp in print. An icon appears
 * only where it does something: the external-link arrow on clickable links.
 * No platform or vendor marks (they are trademarks): channels are named.
 */

const ICONS = {
  arrowUpRight: ["M7 7h10v10", "M7 17 17 7"],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICONS;

/** A stroked Lucide icon at `size` points. */
export function PdfIcon({
  name,
  size = 12,
  color,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {ICONS[name].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

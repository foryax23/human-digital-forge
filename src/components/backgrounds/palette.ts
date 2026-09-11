/**
 * Canvas-safe copies of the `.cinematic` design tokens from src/styles.css.
 * Canvas 2D cannot read CSS custom properties, so the brand values live here
 * once and every backdrop pulls from this single source.
 */
export const palette = {
  /** --primary: electric indigo */
  indigo: [79, 70, 229] as const,
  /** --teal: periwinkle */
  periwinkle: [122, 162, 247] as const,
  /** deep violet used in the aurora/flow gradients */
  violet: [30, 30, 90] as const,
};

export function rgba(color: readonly [number, number, number], alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

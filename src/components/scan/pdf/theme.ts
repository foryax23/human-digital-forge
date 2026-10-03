/**
 * Visual tokens for the blueprint PDF. The cover, offer and back pages use the
 * Vortex night palette; the working pages are white with night ink because
 * they are read closely and often printed: dark full-bleed pages waste toner
 * and lose contrast on office printers, so dark is kept for the moments that
 * should feel like the website.
 */

import type { Styles } from "@react-pdf/renderer";

export type Style = Styles[string];

/** A4 in PostScript points. */
export const PAGE = { width: 595.28, height: 841.89 } as const;

/**
 * Side gutter and the bands reserved for the slim running header (wordmark,
 * company, section) and the footer (swirl mark, contact, page number).
 */
export const SPACE = {
  gutter: 40,
  headerTop: 20,
  /** Hairline under the running header. */
  headerRule: 46,
  contentTop: 64,
  contentBottom: 54,
  footerBottom: 20,
} as const;

export const CONTENT_WIDTH = PAGE.width - SPACE.gutter * 2;

/** One gap for every grid: columns, cards and tiles. */
export const GAP = 10;
/** Column widths on the 2- and 3-column grids. */
export const COL2 = (CONTENT_WIDTH - GAP) / 2;
export const COL3 = (CONTENT_WIDTH - GAP * 2) / 3;

export const BRAND = {
  night: "#00020f",
  glass: "#04061a",
  glass2: "#070a1f",
  violet: "#6c63ff",
  blue: "#5b8cf0",
  sky: "#89cbf6",
  mint: "#5fe3d0",
  /** Deep violet used as the darkest step of single-hue ramps. */
  indigo: "#2b2d7a",
} as const;

/** Neutrals derived from the night palette for the light pages. */
export const INK = {
  strong: "#0a0c24",
  body: "#2c3050",
  muted: "#5f6485",
  faint: "#8d91ad",
  hairline: "#e4e5f1",
  track: "#ecedf6",
  panel: "#f5f5fc",
  violetTint: "#efeeff",
  blueTint: "#eaf1fe",
  mintTint: "#e3f9f5",
  /** Mint is too light for text on white; this shade carries the same hue. */
  mintText: "#0c8a79",
  violetText: "#5a51e6",
  blueText: "#2f62c9",
  white: "#ffffff",
} as const;

/** Text and line colours on the dark pages. */
export const NIGHT_INK = {
  strong: "#f4f4ff",
  body: "#c9cbe6",
  muted: "#8a8fb8",
  faint: "#5d6290",
  hairline: "#1d2148",
  panel: "#0a0e2a",
} as const;

/** Fixed categorical order for multi-series marks (never cycled). */
export const SERIES = [BRAND.violet, BRAND.sky, BRAND.indigo, BRAND.mint, BRAND.blue] as const;
export const SERIES_OTHER = "#c9cbe0";

export const FONT = {
  display: "Space Grotesk",
  body: "DM Sans",
} as const;

export const RADIUS = { sm: 5, md: 8, lg: 12, xl: 16, pill: 999 } as const;

/** Vortex Hub contact details printed on every page. */
export const CONTACT = {
  site: "vortexhub.dev",
  siteUrl: "https://vortexhub.dev",
  email: "hello@vortexhub.ro",
  consultUrl: "https://vortexhub.dev/consultancy",
} as const;

/** Type scale for the PDF. */
export const text = {
  eyebrow: {
    fontFamily: FONT.display,
    fontWeight: 500,
    fontSize: 6.6,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  h1: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 21,
    lineHeight: 1.12,
    color: INK.strong,
  },
  h2: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 12.5,
    lineHeight: 1.2,
    color: INK.strong,
  },
  h3: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 10,
    lineHeight: 1.25,
    color: INK.strong,
  },
  body: { fontFamily: FONT.body, fontSize: 8.5, lineHeight: 1.45, color: INK.body },
  small: { fontFamily: FONT.body, fontSize: 7.3, lineHeight: 1.42, color: INK.muted },
  tiny: { fontFamily: FONT.body, fontSize: 6.5, lineHeight: 1.38, color: INK.faint },
  number: { fontFamily: FONT.display, fontWeight: 700, color: INK.strong },
} satisfies Record<string, Style>;

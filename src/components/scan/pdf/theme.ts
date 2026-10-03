/**
 * Visual tokens for the blueprint PDF (UI refresh spec §6). The cover, offer
 * and back pages use the Vortex night palette; the working pages are white
 * with night ink because they are read closely and often printed: dark
 * full-bleed pages waste toner and lose contrast on office printers.
 *
 * One language with the site: one accent (violet) for the value of the hours,
 * the starting stage and links; green, amber and red only as small status
 * squares; hairlines instead of boxed cards; sentence case at zero tracking;
 * Space Grotesk for figures, DM Sans for text, no mono.
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
  headerRule: 44,
  contentTop: 62,
  contentBottom: 50,
  footerBottom: 20,
} as const;

export const CONTENT_WIDTH = PAGE.width - SPACE.gutter * 2;

/** One gap for every grid: columns and blocks. */
export const GAP = 16;
/** Column widths on the 2- and 3-column grids. */
export const COL2 = (CONTENT_WIDTH - GAP) / 2;
export const COL3 = (CONTENT_WIDTH - GAP * 2) / 3;

/** Brand colours. Violet is the only accent; the night is the dark pages' ground. */
export const BRAND = {
  night: "#00020f",
  violet: "#5b52f0",
  /** Violet as a line or text on the dark pages (the site's brand-line / brand-fg). */
  violetLine: "#8079ff",
  violetText: "#aaa5ff",
} as const;

/** Ink for the white working pages (fg levels as on the site, tuned for print). */
export const INK = {
  /** Titles and values. */
  strong: "#0b0d1f",
  /** Body text and bullets. */
  body: "#3a3d52",
  /** Labels, notes, ticks (6:1 on white). */
  muted: "#5f6276",
  /** Marker glyphs and disabled marks only, never text a person must read. */
  faint: "#a3a6b6",
  /** Hairlines inside blocks and between rows. */
  hairline: "#e3e4ec",
  /** Control edges and outline tags. */
  line: "#c9cbd6",
  /** Section rules, table heads and total rows. */
  rule: "#9a9dae",
  /** Bar tracks and month gridlines. */
  track: "#eef0f4",
  /** Implementation bars (30% ink, opaque). */
  bar: "#b8bac6",
  white: "#ffffff",
  /** Violet as text and lines on white (5.4:1). */
  violet: "#5b52f0",
  /** "Începem aici", the break-even table row. */
  violetTint: "#ebeafd",
  /** The net-gain area of the chart. */
  violetWash: "#f1f0fe",
} as const;

/** Text and line colours on the dark pages. */
export const NIGHT_INK = {
  strong: "#ececf1",
  body: "#c4c6d4",
  muted: "#9a9db0",
  faint: "#5d6072",
  hairline: "#22243a",
  panel: "#0f111c",
} as const;

/** Status squares only: never fills behind text, never tag backgrounds. */
export const STATUS = {
  ok: "#2f9e6e",
  warn: "#c98a1e",
  bad: "#d4554c",
  neutral: "#8a8da0",
} as const;

export type StatusTone = keyof typeof STATUS;

export const FONT = {
  display: "Space Grotesk",
  body: "DM Sans",
} as const;

/** 4 for tags and bars, 8 at most for anything larger. */
export const RADIUS = { sm: 2, md: 4, lg: 8 } as const;

/** Vortex Hub contact details printed on the pages. */
export const CONTACT = {
  site: "vortexhub.dev",
  siteUrl: "https://vortexhub.dev",
  email: "hello@vortexhub.ro",
  // The QR and its caption: /contact reads the same in both languages (no English slug).
  consultUrl: "https://vortexhub.dev/contact",
} as const;

/**
 * Vortex Hub's own identity (Legea 365/2002 art. 5) and the person who signs
 * the recommendations: the one record in src/lib/scan/legal/company.ts.
 */
export { COMPANY } from "@/lib/scan/legal/company";

/** Type scale for the PDF: sentence case everywhere, zero tracking. */
export const text = {
  /** Small label above a value or a column ("Valoarea orelor", "Etapă"). */
  label: {
    fontFamily: FONT.body,
    fontWeight: 500,
    fontSize: 7.2,
    lineHeight: 1.35,
    color: INK.muted,
  },
  /** Page title: the conclusion of the page. */
  title: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 19,
    lineHeight: 1.15,
    color: INK.strong,
  },
  h2: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 12,
    lineHeight: 1.25,
    color: INK.strong,
  },
  h3: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 9.6,
    lineHeight: 1.3,
    color: INK.strong,
  },
  /** Row titles: stages, automations, findings. */
  h4: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 8.8,
    lineHeight: 1.3,
    color: INK.strong,
  },
  lead: { fontFamily: FONT.body, fontSize: 9, lineHeight: 1.45, color: INK.body },
  body: { fontFamily: FONT.body, fontSize: 8.2, lineHeight: 1.45, color: INK.body },
  small: { fontFamily: FONT.body, fontSize: 7.4, lineHeight: 1.42, color: INK.muted },
  tiny: { fontFamily: FONT.body, fontSize: 6.6, lineHeight: 1.38, color: INK.muted },
  /** KPI and stat values. */
  figure: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.1,
    color: INK.strong,
  },
  /** Figures in table columns (right-aligned: react-pdf ignores tabular figures). */
  num: { fontFamily: FONT.display, fontWeight: 500, fontSize: 7.8, color: INK.strong },
} satisfies Record<string, Style>;

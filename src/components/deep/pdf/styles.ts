import { FONT, INK, PAGE, type Style } from "@/components/scan/pdf/theme";

/*
 * Type and spacing of the deep report PDF. Colours, fonts and the A4 page come
 * from the blueprint PDF's theme (src/components/scan/pdf/theme.ts, read-only),
 * so both reports look like one family: white working pages, night ink,
 * hairlines instead of boxes, status colours only in the small line shapes,
 * one violet accent (the call). The text is a step larger than the blueprint's
 * because this report is read closely, often printed, by owners over 50.
 */

export const DEEP_SPACE = {
  gutter: 42,
  headerTop: 20,
  headerRule: 44,
  contentTop: 64,
  /** Two footer lines (dates, code, disclaimer) sit below the content. */
  contentBottom: 66,
  footerBottom: 18,
} as const;

export const WIDTH = PAGE.width - DEEP_SPACE.gutter * 2;
export const GAP = 16;
export const COL2 = (WIDTH - GAP) / 2;
export const COL3 = (WIDTH - GAP * 2) / 3;

export const T = {
  label: {
    fontFamily: FONT.body,
    fontWeight: 500,
    fontSize: 7.6,
    lineHeight: 1.35,
    color: INK.muted,
  },
  title: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 20,
    lineHeight: 1.18,
    color: INK.strong,
  },
  headline: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 17,
    lineHeight: 1.25,
    color: INK.strong,
  },
  h2: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 12.5,
    lineHeight: 1.25,
    color: INK.strong,
  },
  h3: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 10.4,
    lineHeight: 1.3,
    color: INK.strong,
  },
  h4: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 9.4,
    lineHeight: 1.3,
    color: INK.strong,
  },
  lead: { fontFamily: FONT.body, fontSize: 9.8, lineHeight: 1.5, color: INK.body },
  body: { fontFamily: FONT.body, fontSize: 8.8, lineHeight: 1.48, color: INK.body },
  strong: {
    fontFamily: FONT.body,
    fontWeight: 500,
    fontSize: 8.8,
    lineHeight: 1.45,
    color: INK.strong,
  },
  small: { fontFamily: FONT.body, fontSize: 7.8, lineHeight: 1.42, color: INK.muted },
  tiny: { fontFamily: FONT.body, fontSize: 7, lineHeight: 1.38, color: INK.muted },
  figure: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 15,
    lineHeight: 1.1,
    color: INK.strong,
  },
  num: { fontFamily: FONT.display, fontWeight: 500, fontSize: 8, color: INK.strong },
} satisfies Record<string, Style>;

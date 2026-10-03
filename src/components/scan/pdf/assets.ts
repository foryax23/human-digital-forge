import {
  LOGO_CHROME,
  LOGO_LAVENDER,
  LOGO_NAV,
  LOGO_WORDMARK,
  PDF_COVER_ART,
  SWIRL_ICON,
} from "@/components/landing/media";

/**
 * The brand images the blueprint PDF draws, as sources React-PDF can load: an
 * absolute URL in the browser, a file path in Node scripts. React-PDF reads
 * PNG and JPEG only, so these are the `.png` / `.jpg` exports.
 */
export type PdfAssets = {
  /** Purple metallic wordmark, 1200 px wide: the cover. */
  wordmark: string;
  /** The same wordmark at 96 px tall: running headers. */
  wordmarkSmall: string;
  /** Chrome wordmark: the back cover. */
  chrome: string;
  /** Lavender wordmark: faint watermark on dark pages. */
  lavender: string;
  /** Transparent swirl mark: footers and small marks. */
  swirl: string;
  /** Dark, wordmark-free A4 art behind the cover. */
  coverArt: string;
};

/** Public paths (under /public) of every PDF asset. */
export const PDF_ASSET_PATHS: PdfAssets = {
  wordmark: LOGO_WORDMARK.png,
  wordmarkSmall: LOGO_NAV.png,
  chrome: LOGO_CHROME.png,
  lavender: LOGO_LAVENDER.png,
  swirl: SWIRL_ICON.png,
  coverArt: PDF_COVER_ART,
};

/** Width ÷ height of each logo, from the exported files. */
export const LOGO_RATIO = {
  wordmark: LOGO_WORDMARK.width / LOGO_WORDMARK.height,
  wordmarkSmall: LOGO_NAV.width / LOGO_NAV.height,
  chrome: LOGO_CHROME.width / LOGO_CHROME.height,
  lavender: LOGO_LAVENDER.width / LOGO_LAVENDER.height,
  swirl: SWIRL_ICON.width / SWIRL_ICON.height,
} as const;

/** Maps every public path through `resolve` (origin + path, or a local file path). */
export function resolvePdfAssets(resolve: (publicPath: string) => string): PdfAssets {
  return Object.fromEntries(
    Object.entries(PDF_ASSET_PATHS).map(([key, value]) => [key, resolve(value)]),
  ) as PdfAssets;
}

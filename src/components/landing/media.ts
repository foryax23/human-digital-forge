/**
 * Vortex brand media. Every file below lives in /public and is rebuilt from the
 * owner's asset folder by scripts/brand/build-media.sh.
 *
 * React-PDF only reads PNG/JPEG, so PDF code should use the `.png` / `.jpg`
 * entries; the site prefers `.webp` with the PNG as fallback.
 */

/**
 * The Vortex swirl loop (the owner's 5 s seamless swirl_spin loop), encoded as
 * an adaptive HLS ladder (540p / 1080p, 30 fps, 4 s segments) in
 * public/media/swirl-loop. The 720p MP4 is the fallback for browsers with
 * neither MSE nor native HLS. Black stays true black, so `mix-blend-mode:
 * screen` drops the background.
 */
export const SWIRL_VIDEO = {
  hls: "/media/swirl-loop/master.m3u8",
  poster: "/media/swirl-loop/poster.jpg",
  mp4: "/media/swirl-loop/swirl-720.mp4",
  /**
   * Progressive copy the ASCII renderer samples (no hls.js needed): 540 px, a 10 s loop at half
   * the master's speed that keeps all 300 frames (30 unique frames a second).
   */
  ascii: "/media/swirl-loop/swirl-ascii-540.mp4",
} as const;

/** 96px brand icon for small placements (legacy; prefer BRAND.SWIRL_ICON). */
export const BRAND_ICON_SMALL = "/media/brand/vortex-icon-96.png";

export const CONTACT_EMAIL = "hello@vortexhub.ro";

/** A raster logo exported as WebP (site) and PNG (fallback, React-PDF). */
export type BrandLogo = {
  readonly webp: string;
  readonly png: string;
  /** Intrinsic pixel size of the exported files. */
  readonly width: number;
  readonly height: number;
};

/** Purple metallic wordmark, trimmed, 1200 px wide: footer, PDF cover, OG. */
export const LOGO_WORDMARK: BrandLogo = {
  webp: "/media/brand/logo-wordmark.webp",
  png: "/media/brand/logo-wordmark.png",
  width: 1200,
  height: 405,
};

/** Same wordmark at 96 px tall: sharp in the 32 / 40 px nav up to 3x / 2.4x screens. */
export const LOGO_NAV: BrandLogo = {
  webp: "/media/brand/logo-wordmark-nav.webp",
  png: "/media/brand/logo-wordmark-nav.png",
  width: 280,
  height: 96,
};

/** Chrome / silver wordmark for print and monochrome contexts (PDF back cover). */
export const LOGO_CHROME: BrandLogo = {
  webp: "/media/brand/logo-wordmark-chrome.webp",
  png: "/media/brand/logo-wordmark-chrome.png",
  width: 1200,
  height: 400,
};

/** Lavender wordmark, a subtle watermark on dark surfaces (PDF section dividers). */
export const LOGO_LAVENDER: BrandLogo = {
  webp: "/media/brand/logo-wordmark-lavender.webp",
  png: "/media/brand/logo-wordmark-lavender.png",
  width: 1200,
  height: 373,
};

/** Transparent swirl mark, 512 px square: small marks, PDF footer, scan loaders. */
export const SWIRL_ICON = {
  webp: "/media/brand/swirl-icon.webp",
  png: "/media/brand/swirl-icon.png",
  width: 512,
  height: 512,
} as const;

/** Favicons and app icons (also linked from __root.tsx). */
export const APP_ICONS = {
  favicon: "/favicon.png",
  favicon32: "/media/brand/favicon-32.png",
  appleTouch: "/apple-touch-icon.png",
  app512: "/media/brand/app-icon-512.png",
} as const;

/**
 * First-visit intro: swirl, particles, then the wordmark, which holds.
 * Poster is the final (hold) frame, which is also the reduced-motion still.
 */
export const INTRO_VIDEO = {
  mp4_1080: "/media/brand/intro/assemble-1080.mp4",
  mp4_720: "/media/brand/intro/assemble-720.mp4",
  webm: "/media/brand/intro/assemble.webm",
  poster: "/media/brand/intro/assemble-poster.jpg",
  durationSec: 6,
} as const;

/** Ribbon variant of the assemble animation, shown while the PDF is generated. */
export const PDF_GENERATING_VIDEO = {
  mp4: "/media/brand/intro/assemble-alt-720.mp4",
  webm: "/media/brand/intro/assemble-alt-720.webm",
  poster: "/media/brand/intro/assemble-alt-poster.jpg",
  durationSec: 5,
} as const;

/**
 * Brand sign-off above the footer: the wordmark with a light sweep. Plays once
 * when scrolled into view, then holds on the poster (final frame). The footer's
 * WebM, 720p MP4 and poster are 720p with the sweep's glow crushed to pure black
 * (ffmpeg curves 0/0 0.34/0 0.55/0.5 1/1), so `screen` blending drops the whole
 * background and no rectangle shows; the 1080p MP4 and the portrait clip (intro)
 * are the untouched exports.
 */
export const SIGNOFF_VIDEO = {
  mp4_1080: "/media/brand/signoff/logo-reveal-1080.mp4",
  mp4_720: "/media/brand/signoff/logo-reveal-720.mp4",
  webm: "/media/brand/signoff/logo-reveal.webm",
  poster: "/media/brand/signoff/logo-reveal-poster.jpg",
  durationSec: 5,
  portrait: {
    mp4: "/media/brand/signoff/logo-reveal-portrait-720.mp4",
    webm: "/media/brand/signoff/logo-reveal-portrait-720.webm",
    poster: "/media/brand/signoff/logo-reveal-portrait-poster.jpg",
  },
} as const;

/**
 * A homepage promo film (FilmsSection), encoded by scripts/brand/build-media.sh (group "films")
 * from the renders in ~/Desktop/VortexHub-videos or, failing that, the byte-identical copies the
 * owner delivered in ~/Desktop/Assigments/Dandea Mihai/VortexHub/Vids (VortexPromo1.mp4 = scan,
 * VortexPromo2.mp4 = deep; the poster is then decoded from frame 0). Both films are
 * 20.0 s, 9:16, 30 fps H.264 with Romanian text on screen and the sample data labelled in the
 * frame, and one AAC track (128 kb/s, 48 kHz stereo): music and sound effects, mixed to -18 LUFS
 * by ~/Desktop/VortexHub-videos/audio-src/mix.sh (no voice-over yet). FilmsSection plays them
 * muted; a visitor turns the sound on per film. The licences allow the music and the sound
 * effects only inside the film's audio track: never add the raw tracks or SFX to /public. The
 * poster is frame 0 (the opening hook line), the film's own first frame: AVIF, with WebP as the
 * fallback.
 */
export type PromoFilm = {
  readonly mp4: string;
  readonly poster: { readonly avif: string; readonly webp: string };
  /** Intrinsic pixel size of the MP4 and the posters. */
  readonly width: number;
  readonly height: number;
  readonly durationSec: number;
};

/**
 * Film 1, "Clientul așteaptă. Tu nu vezi.": the free Vortex Scan, ending on "Vezi ce vede
 * clientul tău. Gratuit, fără cont." Source vortexhub_scan_ro_20s_9x16_v01.mp4 (1080x1920).
 */
export const SCAN_FILM: PromoFilm = {
  mp4: "/media/promo/scan-film-720.mp4",
  poster: {
    avif: "/media/promo/scan-film-poster.avif",
    webp: "/media/promo/scan-film-poster.webp",
  },
  width: 720,
  height: 1280,
  durationSec: 20,
};

/**
 * Film 2, "Din 100 de lei, cât îți rămâne?": Deep Research, ending on "Primul raport e gratuit."
 * Source vortexhub_deep_ro_20s_9x16_v01.mp4 (1080x1920).
 */
export const DEEP_FILM: PromoFilm = {
  mp4: "/media/promo/deep-film-720.mp4",
  poster: {
    avif: "/media/promo/deep-film-poster.avif",
    webp: "/media/promo/deep-film-poster.webp",
  },
  width: 720,
  height: 1280,
  durationSec: 20,
};

/** 1200x630 social card (absolute URL in __root.tsx). */
export const OG_IMAGE = "/og-image.jpg";

/** Dark, wordmark-free brand art for the PDF cover background (JPEG for React-PDF). */
export const PDF_COVER_ART = "/media/brand/cover-art.jpg";

/** Pixel size of PDF_COVER_ART (A4 portrait at 150 dpi). */
export const PDF_COVER_ART_SIZE = { width: 1240, height: 1754 } as const;

/** Everything above under one name (not `BRAND`, which the PDF theme uses for colours). */
export const BRAND_MEDIA = {
  LOGO_WORDMARK,
  LOGO_NAV,
  LOGO_CHROME,
  LOGO_LAVENDER,
  SWIRL_ICON,
  APP_ICONS,
  INTRO_VIDEO,
  PDF_GENERATING_VIDEO,
  SIGNOFF_VIDEO,
  SCAN_FILM,
  DEEP_FILM,
  OG_IMAGE,
  PDF_COVER_ART,
  PDF_COVER_ART_SIZE,
} as const;

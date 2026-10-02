import swirlLoop from "@/assets/brand/vortex-swirl-loop.mp4.asset.json";

/**
 * The Vortex swirl loop, re-encoded as an adaptive HLS ladder (540p / 1080p,
 * 30 fps) in public/media/vortex-swirl. The original MP4 in Lovable's asset
 * storage is the fallback for browsers with neither MSE nor native HLS.
 */
export const SWIRL_VIDEO = {
  hls: "/media/vortex-swirl/master.m3u8",
  poster: "/media/vortex-swirl/poster.jpg",
  mp4: swirlLoop.url,
} as const;

/** 96px brand icon for small placements such as the nav logo. */
export const BRAND_ICON_SMALL = "/media/brand/vortex-icon-96.png";

export const CONTACT_EMAIL = "hello@vortexhub.ro";

/** Unsplash photo as panel content plus responsive sources (800–1600px). */
export const unsplash = (id: string) => ({
  content: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=75`,
  srcSet: [800, 1200, 1600]
    .map((w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75 ${w}w`)
    .join(", "),
});

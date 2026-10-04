/**
 * VortexPoint, Vortex Hub's own Mac app for the notch: the facts the /vortexpoint page, the
 * Projects page and the Digital products page share. Free, Apple Silicon, macOS 26 or later.
 *
 * The download link always points at the newest release on GitHub; it answers 404 until the
 * first release of foryax23/vortexpoint-releases is published.
 */

export const VORTEXPOINT_DMG_URL =
  "https://github.com/foryax23/vortexpoint-releases/releases/latest/download/VortexPoint.dmg";

/** Where the agent's Claude API key is created (the app's own "Get a key" link). */
export const ANTHROPIC_KEYS_URL = "https://console.anthropic.com/settings/keys";

/**
 * The app icon, copied from VortexPoint's docs/assets/icon-1024.png. icon-256.png is the copy
 * the pages show (`sips -Z 256 icon-1024.png --out icon-256.png`); regenerate it with the 1024.
 */
export const VORTEXPOINT_ICON = {
  full: "/vortexpoint/icon-1024.png",
  web: "/vortexpoint/icon-256.png",
} as const;

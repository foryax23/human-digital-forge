/*
 * The crawler's public identity. Kept outside net.server.ts so the privacy
 * page can print the exact User-Agent the server sends.
 */

/** Where site owners read what VortexScan does and how to block it. */
export const SCAN_BOT_INFO_URL = "https://vortexhub.dev/privacy#vortex-scan-bot";

export const SCAN_USER_AGENT = `Mozilla/5.0 (compatible; VortexScan/1.0; +${SCAN_BOT_INFO_URL})`;

import type { PresencePlatform } from "@/lib/scan/types";

/**
 * Recognises social profile and Google Business links. Share buttons, embeds
 * and tracking endpoints are ignored so they never count as a presence.
 */

type SocialMatch = {
  platform: Exclude<PresencePlatform, "website">;
  /** A profile/page link (vs. a post or video that only proves activity). */
  profile: boolean;
};

const FACEBOOK_IGNORED =
  /^\/(sharer|share|dialog|plugins|tr|l\.php|login|watch|groups\/?$|hashtag|help|policies|privacy|business\/help)/i;
const INSTAGRAM_POSTS = /^\/(p|reel|reels|tv|stories|explore)\//i;
const INSTAGRAM_IGNORED = /^\/(accounts|about|developer|legal|direct)(\/|$)/i;
const X_IGNORED = /^\/(intent|share|home|search|hashtag|i|login|privacy|tos)(\/|$)/i;

export function classifySocialUrl(raw: string): SocialMatch | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile|web|business)\./, "");
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (host === "facebook.com" || host === "fb.com" || host === "fb.me") {
    if (path === "/" || FACEBOOK_IGNORED.test(path)) return null;
    const post = /\/(posts|videos|photos|events)\//i.test(path);
    return { platform: "facebook", profile: !post };
  }
  if (host === "instagram.com" || host === "instagr.am") {
    if (path === "/" || INSTAGRAM_IGNORED.test(path)) return null;
    return { platform: "instagram", profile: !INSTAGRAM_POSTS.test(`${path}/`) };
  }
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    if (/^\/(company|in|school|showcase)\/[^/]+/i.test(path)) {
      return { platform: "linkedin", profile: true };
    }
    if (/^\/(posts|feed\/update|pulse)\//i.test(path))
      return { platform: "linkedin", profile: false };
    return null;
  }
  if (host === "youtube.com" || host === "youtu.be") {
    if (host === "youtu.be" || /^\/(watch|shorts|embed|live)/i.test(path)) {
      return path === "/" ? null : { platform: "youtube", profile: false };
    }
    if (/^\/(@[^/]+|channel\/|c\/|user\/)/i.test(path))
      return { platform: "youtube", profile: true };
    return null;
  }
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    if (/^\/@[^/]+$/i.test(path)) return { platform: "tiktok", profile: true };
    if (/^\/@[^/]+\/video\//i.test(path)) return { platform: "tiktok", profile: false };
    return null;
  }
  if (host === "x.com" || host === "twitter.com") {
    if (path === "/" || X_IGNORED.test(path)) return null;
    return { platform: "x", profile: !/\/status\//i.test(path) };
  }
  if (isGoogleBusinessUrl(url)) return { platform: "google-business", profile: true };
  return null;
}

/** Google Maps place / Business Profile / review links (not map embeds). */
export function isGoogleBusinessUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname;
  if (host === "g.page" || host === "maps.app.goo.gl" || host === "business.google.com") {
    return true;
  }
  if (host === "goo.gl" && path.startsWith("/maps")) return true;
  if (host === "g.co" && path.startsWith("/kgs")) return true;
  if (host === "search.google.com" && path.startsWith("/local/")) return true;
  if (/^(maps\.)?google\.[a-z.]+$/.test(host)) {
    if (path.startsWith("/maps/embed")) return false;
    return (
      path.startsWith("/maps/place") ||
      (path.startsWith("/maps") && /[?&](cid|q|query_place_id)=/.test(url.search)) ||
      (host.startsWith("maps.") && /[?&](cid|q)=/.test(url.search))
    );
  }
  return false;
}

/** Canonical form for de-duplication: https, lower-case host, no query/hash/trailing slash. */
export function normalizeSocialUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const keepQuery = isGoogleBusinessUrl(url);
    const host = url.hostname.toLowerCase().replace(/^(m|mobile)\./, "www.");
    const path = url.pathname.replace(/\/+$/, "");
    return `https://${host}${path}${keepQuery ? url.search : ""}`;
  } catch {
    return raw;
  }
}

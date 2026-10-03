import { classifySocialUrl, normalizeSocialUrl } from "@/lib/scan/audit/social";
import { normalizeInputUrl, safeFetch } from "@/lib/scan/net.server";
import type { OnlinePresence, PresencePlatform, PresenceProfile } from "@/lib/scan/types";

/**
 * Online presence from what the website links to. "detected" = linked from
 * the site; "active" = the company's own website answered when we opened it;
 * "missing" = no link found. Follower counts are never scraped.
 *
 * Social networks are never fetched. Facebook, Instagram, LinkedIn and X
 * disallow bots in robots.txt and forbid scraping in their terms; YouTube and
 * TikTok wait for their official APIs (deep-engine plan F3). The link on the
 * company's own site is the evidence, so a linked profile stays "detected".
 *
 * Google Places is off in the public scan: the EEA Maps terms forbid saving
 * names, ratings or reviews (the PDF would save them), and the rating and
 * website fields bill at the Text Search Enterprise tier. A Google Business
 * profile counts when the site links to it.
 */

export type PresenceInput = {
  name: string;
  city?: string;
  socialLinks: string[];
  website?: string;
};

/** Always listed (as missing when absent); TikTok and X only when linked. */
const CORE: PresencePlatform[] = [
  "website",
  "google-business",
  "facebook",
  "instagram",
  "linkedin",
  "youtube",
];
const OPTIONAL: PresencePlatform[] = ["tiktok", "x"];

const LOGIN_WALL = /\/(login|accounts\/login|authwall|checkpoint|signup|i\/flow\/login)/i;
const LINK_CHECK = { en: "Link check", ro: "Verificarea linkului" };

type Check = { status: PresenceProfile["status"]; metric?: PresenceProfile["metric"] };

/** Opens the company's own website (one GET, body not read). */
async function verifyWebsite(url: string): Promise<Check> {
  try {
    const result = await safeFetch(url, { timeoutMs: 5000, readBody: false });
    if (result.status === 404 || result.status === 410) {
      return { status: "detected", metric: { label: LINK_CHECK, value: String(result.status) } };
    }
    if (result.status !== 200) return { status: "detected" };
    if (LOGIN_WALL.test(new URL(result.finalUrl).pathname)) return { status: "detected" };
    return { status: "active" };
  } catch {
    return { status: "detected" };
  }
}

export async function detectPresence(input: PresenceInput): Promise<OnlinePresence> {
  // Best link per platform: profile pages beat posts, shorter beats longer.
  const linked = new Map<PresencePlatform, { url: string; profile: boolean }>();
  for (const raw of input.socialLinks) {
    const match = classifySocialUrl(raw);
    if (!match) continue;
    const url = normalizeSocialUrl(raw);
    const current = linked.get(match.platform);
    if (
      !current ||
      (match.profile && !current.profile) ||
      (match.profile === current.profile && url.length < current.url.length)
    ) {
      linked.set(match.platform, { url, profile: match.profile });
    }
  }
  const website = input.website ? normalizeInputUrl(input.website)?.href : undefined;
  const websiteCheck = website ? await verifyWebsite(website) : null;

  const profiles: PresenceProfile[] = [];
  for (const platform of [...CORE, ...OPTIONAL]) {
    if (platform === "website") {
      profiles.push(
        website
          ? { platform, url: website, ...(websiteCheck ?? { status: "detected" }) }
          : { platform, status: "missing" },
      );
      continue;
    }
    const link = linked.get(platform);
    if (link) profiles.push({ platform, status: "detected", url: link.url });
    else if (CORE.includes(platform)) profiles.push({ platform, status: "missing" });
  }

  return { profiles };
}

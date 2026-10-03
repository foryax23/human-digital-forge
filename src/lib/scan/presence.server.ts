import process from "node:process";

import { classifySocialUrl, normalizeSocialUrl } from "@/lib/scan/audit/social";
import { companyNameTokens, foldText } from "@/lib/scan/discover.server";
import { normalizeInputUrl, safeFetch } from "@/lib/scan/net.server";
import type { OnlinePresence, PresencePlatform, PresenceProfile } from "@/lib/scan/types";

/**
 * Online presence from what the website links to. "detected" = linked from
 * the site; "active" = we opened the link and it resolved to a real page;
 * "missing" = no link found. Follower counts are never scraped. The Google
 * rating comes from the Places API (New) only when GOOGLE_PLACES_API_KEY is
 * set; it is shown to the visitor, not stored.
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
const GONE =
  /this content isn't available|this page isn't available|page not found|sorry, this page|pagina nu este disponibil|acest con[țt]inut nu este disponibil|couldn't find this account|channel does not exist/i;

const LINK_CHECK = { en: "Link check", ro: "Verificarea linkului" };
/** Networks that answer 200 with a generic shell even for profiles that don't exist. */
const SHELL_PLATFORMS: PresencePlatform[] = ["facebook", "instagram", "tiktok"];
const GENERIC_TITLE =
  /^(facebook|instagram|tiktok|tiktok - make your day|x|linkedin|youtube|log ?in.*|sign ?up.*|conecta.*|autentific.*)$/i;

function pageTitle(html: string): string | undefined {
  const title =
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i.exec(html)?.[1] ??
    /<title[^>]*>([^<]*)/i.exec(html)?.[1];
  return title?.replace(/\s+/g, " ").trim() || undefined;
}

type Check = { status: PresenceProfile["status"]; metric?: PresenceProfile["metric"] };

async function verifyProfile(url: string, platform: PresencePlatform): Promise<Check> {
  try {
    const result = await safeFetch(url, { timeoutMs: 5000, maxBytes: 256 * 1024 });
    if (result.status === 404 || result.status === 410) {
      return { status: "detected", metric: { label: LINK_CHECK, value: String(result.status) } };
    }
    if (result.status !== 200) return { status: "detected" };
    const final = new URL(result.finalUrl);
    if (LOGIN_WALL.test(final.pathname)) return { status: "detected" };
    if (platform !== "website" && GONE.test(result.body.slice(0, 120_000))) {
      return { status: "detected" };
    }
    if (SHELL_PLATFORMS.includes(platform)) {
      const title = pageTitle(result.body);
      if (!title || GENERIC_TITLE.test(title)) return { status: "detected" };
    }
    // Landing on the network's home page means the profile didn't resolve.
    if (platform !== "website" && (final.pathname === "/" || final.pathname === "")) {
      return { status: "detected" };
    }
    return { status: "active" };
  } catch {
    return { status: "detected" };
  }
}

type PlacesResponse = {
  places?: Array<{
    displayName?: { text?: string };
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    websiteUri?: string;
  }>;
};

function nameMatches(candidate: string, name: string): boolean {
  const wanted = companyNameTokens(name).core.filter((token) => token.length >= 3);
  if (!wanted.length) return false;
  const text = foldText(candidate);
  const hits = wanted.filter((token) => text.includes(token)).length;
  return hits / wanted.length >= 0.6;
}

async function googlePlace(input: PresenceInput) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const query = [
      input.name.replace(/\bS\.?\s?R\.?\s?L\.?\b|\bS\.?A\.?\b$/gi, "").trim(),
      input.city,
    ]
      .filter(Boolean)
      .join(" ");
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
        "x-goog-fieldmask":
          "places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "ro", regionCode: "ro", pageSize: 5 }),
    });
    if (!response.ok) {
      console.warn(`[scan] Places ${response.status}`);
      return null;
    }
    const data = (await response.json()) as PlacesResponse;
    const websiteHost = input.website
      ? normalizeInputUrl(input.website)?.hostname.replace(/^www\./, "")
      : undefined;
    const places = data.places ?? [];
    return (
      places.find((place) => {
        if (!websiteHost || !place.websiteUri) return false;
        return normalizeInputUrl(place.websiteUri)?.hostname.replace(/^www\./, "") === websiteHost;
      }) ??
      places.find((place) => nameMatches(place.displayName?.text ?? "", input.name)) ??
      null
    );
  } catch (error) {
    console.warn("[scan] Places lookup failed", (error as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
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

  const [place, ...checks] = await Promise.all([
    googlePlace(input),
    website ? verifyProfile(website, "website") : Promise.resolve(null),
    ...[...linked.entries()]
      .filter(([platform]) => platform !== "google-business")
      .map(async ([platform, { url }]) => ({
        platform,
        check: await verifyProfile(url, platform),
      })),
  ]);
  const websiteCheck = checks[0] as Check | null;
  const socialChecks = new Map(
    (checks.slice(1) as Array<{ platform: PresencePlatform; check: Check }>).map((entry) => [
      entry.platform,
      entry.check,
    ]),
  );

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
    if (platform === "google-business") {
      if (place?.googleMapsUri) {
        const reviews = place.userRatingCount ?? 0;
        profiles.push({
          platform,
          status: "active",
          url: place.googleMapsUri,
          metric:
            typeof place.rating === "number" && reviews > 0
              ? {
                  label: { en: "Google rating", ro: "Nota Google" },
                  value: `${place.rating.toFixed(1)} ★ · ${reviews}`,
                }
              : undefined,
        });
      } else if (linked.has(platform)) {
        profiles.push({ platform, status: "detected", url: linked.get(platform)!.url });
      } else {
        profiles.push({ platform, status: "missing" });
      }
      continue;
    }
    const link = linked.get(platform);
    if (!link) {
      if (CORE.includes(platform)) profiles.push({ platform, status: "missing" });
      continue;
    }
    profiles.push({
      platform,
      url: link.url,
      ...(socialChecks.get(platform) ?? { status: "detected" }),
    });
  }

  const googleRating =
    place && typeof place.rating === "number" && (place.userRatingCount ?? 0) > 0
      ? { rating: place.rating, reviews: place.userRatingCount!, mapsUrl: place.googleMapsUri }
      : undefined;

  return googleRating ? { profiles, googleRating } : { profiles };
}

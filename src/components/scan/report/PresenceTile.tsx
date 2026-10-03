import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { FOCUS_RING, Status } from "@/components/system";
import { useI18n } from "@/i18n";
import type { PresencePlatform, PresenceProfile } from "@/lib/scan/types";
import { cn } from "@/lib/utils";

/** A channel as the overview shows it; "unchecked" when we couldn't look. */
export type PresenceView = Omit<PresenceProfile, "status"> & {
  status: PresenceProfile["status"] | "unchecked";
};

/** Platform names as a Romanian owner says them. */
function usePlatformName() {
  const { t } = useI18n();
  return (platform: PresencePlatform) =>
    ({
      website: t("Website", "Site"),
      "google-business": t("Google Business Profile", "Profil Google Business"),
      facebook: "Facebook",
      instagram: "Instagram",
      linkedin: "LinkedIn",
      youtube: "YouTube",
      tiktok: "TikTok",
      x: "X",
    })[platform];
}

/** "facebook.com/dentalsmile" from a profile URL, for the value column. */
function shortUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.host.replace(/^www\./, "")}${path.length > 1 ? path : ""}`;
  } catch {
    return url;
  }
}

/**
 * One channel as a list row: name, a status square with Există / Lipsește / Neverificat,
 * then the measured value, the profile link or one action line. 40 px rows split by
 * hairlines (the list supplies them); two lines on phones.
 */
export function PresenceRow({
  profile,
  detail,
}: {
  profile: PresenceView;
  /** The measured value or the action line; falls back to the profile link. */
  detail?: ReactNode;
}) {
  const { t } = useI18n();
  const name = usePlatformName()(profile.platform);
  const present = profile.status === "active" || profile.status === "detected";
  const status = present
    ? { tone: "ok" as const, label: t("Exists", "Există") }
    : profile.status === "missing"
      ? { tone: "warn" as const, label: t("Missing", "Lipsește") }
      : { tone: "unverified" as const, label: t("Not checked", "Neverificat") };

  // The value: what we measured, else the profile address; linked when we have the URL.
  const text = detail ?? (profile.url ? shortUrl(profile.url) : null);
  const value =
    profile.url && text ? (
      <a
        href={profile.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-sm text-fg-2 underline decoration-fg/25 underline-offset-4 transition-colors hover:text-fg hover:decoration-fg",
          detail ? null : "type-code",
          FOCUS_RING,
        )}
      >
        <span className="truncate">{text}</span>
        <ArrowUpRight aria-hidden className="size-3 shrink-0" />
        <span className="sr-only">
          {t(" (opens in a new tab)", " (se deschide într-o filă nouă)")}
        </span>
      </a>
    ) : (
      text
    );

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[minmax(0,10.5rem)_6.5rem_minmax(0,1fr)] sm:py-0 sm:min-h-10">
      <span className="min-w-0 truncate text-sm font-medium text-fg">{name}</span>
      <Status tone={status.tone} className="justify-self-end sm:justify-self-start">
        {status.label}
      </Status>
      <span className="col-span-2 min-w-0 text-[0.8125rem] leading-[1.45] text-fg-3 sm:col-span-1">
        {value}
      </span>
    </li>
  );
}

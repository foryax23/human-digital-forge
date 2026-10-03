import type { ComponentType, SVGProps } from "react";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  AtSign,
  CircleCheck,
  CircleDashed,
  Eye,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  MapPin,
  Music2,
  Plus,
  Youtube,
} from "lucide-react";

import { useI18n } from "@/i18n";
import type { PresencePlatform, PresenceProfile } from "@/lib/scan/types";
import { cn } from "@/lib/utils";
import { pick } from "./format";
import { riseIn } from "./motion";

/** A channel as the overview shows it; "unchecked" when we couldn't look. */
export type PresenceView = Omit<PresenceProfile, "status"> & {
  status: PresenceProfile["status"] | "unchecked";
};

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const PLATFORMS: Record<PresencePlatform, { name: string; icon: Icon }> = {
  website: { name: "Website", icon: Globe },
  "google-business": { name: "Google Business", icon: MapPin },
  facebook: { name: "Facebook", icon: Facebook },
  instagram: { name: "Instagram", icon: Instagram },
  linkedin: { name: "LinkedIn", icon: Linkedin },
  youtube: { name: "YouTube", icon: Youtube },
  tiktok: { name: "TikTok", icon: Music2 },
  x: { name: "X", icon: AtSign },
};

/**
 * One online channel: Active (we saw it in use), Detected (it exists),
 * Opportunity (we didn't find it). Metrics appear only when measured.
 */
export function PresenceTile({ profile }: { profile: PresenceView }) {
  const { t, lang } = useI18n();
  const platform = PLATFORMS[profile.platform];
  const Icon = platform.icon;

  const status = {
    active: {
      label: t("Active", "Activ"),
      icon: CircleCheck,
      tone: "text-[#5fe3d0]",
      note: t("Linked and in use", "Legat de site și activ"),
    },
    detected: {
      label: t("Detected", "Detectat"),
      icon: Eye,
      tone: "text-[#89cbf6]",
      note: t("Profile found", "Profil găsit"),
    },
    missing: {
      label: t("Opportunity", "Oportunitate"),
      icon: Plus,
      tone: "text-[#b3acff]",
      note: t("Not found, worth adding", "Lipsește, merită adăugat"),
    },
    unchecked: {
      label: t("Not checked", "Neverificat"),
      icon: CircleDashed,
      tone: "text-white/50",
      note: t("We couldn't check this one", "Nu am putut verifica"),
    },
  }[profile.status];
  const StatusIcon = status.icon;
  const missing = profile.status === "missing" || profile.status === "unchecked";

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-xl border",
            missing
              ? "border-dashed border-white/15 text-white/45"
              : "border-white/10 bg-gradient-to-br from-[#6c63ff]/30 to-[#5b8cf0]/10 text-white",
          )}
        >
          <Icon aria-hidden className="h-[1.1rem] w-[1.1rem]" />
        </span>
        {profile.url && (
          <ArrowUpRight
            aria-hidden
            className="h-4 w-4 text-white/35 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white motion-reduce:transform-none"
          />
        )}
      </div>
      <p className="type-body-sm mt-3 truncate font-medium text-white">{platform.name}</p>
      <p
        className={cn("type-micro mt-1 inline-flex items-center gap-1.5 font-medium", status.tone)}
      >
        <StatusIcon aria-hidden className="h-3.5 w-3.5" />
        {status.label}
      </p>
      {profile.metric ? (
        <p className="type-micro mt-2 text-white/55">
          {pick(profile.metric.label, lang)}:{" "}
          <span className="font-medium text-white/85">{profile.metric.value}</span>
        </p>
      ) : (
        <p className="type-micro mt-2 text-white/40">{status.note}</p>
      )}
    </>
  );

  const tileClass = cn(
    "group relative block h-full rounded-2xl border p-3.5 transition-colors",
    missing
      ? "border-dashed border-white/12 bg-transparent"
      : "border-white/[0.09] bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]",
  );

  return (
    <motion.li variants={riseIn} className="min-w-0">
      {profile.url ? (
        <a
          href={profile.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            tileClass,
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89cbf6]/80",
          )}
        >
          {body}
          <span className="sr-only">
            {t(" (opens in a new tab)", " (se deschide într-o filă nouă)")}
          </span>
        </a>
      ) : (
        <div className={tileClass}>{body}</div>
      )}
    </motion.li>
  );
}

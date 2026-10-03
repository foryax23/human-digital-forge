import type { Tone } from "@/components/system";
import { useI18n } from "@/i18n";

export type ScoreTier = "good" | "fair" | "poor";

export function scoreTier(score: number): ScoreTier {
  if (score >= 75) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/** Tone of the status square for a tier: green, amber, red. */
export const TIER_TONE: Record<ScoreTier, Tone> = { good: "ok", fair: "warn", poor: "bad" };

/**
 * One word set for every 0–100 score on the scan and in the PDF: Bun / Acceptabil / Slab,
 * shown with a status square (the word carries the meaning, never the colour alone).
 */
export function useTierLabel() {
  const { t } = useI18n();
  return (tier: ScoreTier) => ({
    label:
      tier === "good"
        ? t("Good", "Bun")
        : tier === "fair"
          ? t("Fair", "Acceptabil")
          : t("Poor", "Slab"),
    tone: TIER_TONE[tier],
  });
}

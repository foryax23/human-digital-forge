import { CircleAlert, CircleCheck, CircleDot } from "lucide-react";

import { useI18n } from "@/i18n";

export type ScoreTier = "good" | "fair" | "poor";

export function scoreTier(score: number): ScoreTier {
  if (score >= 75) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/** Text + icon + colour for a 0–100 score tier; never colour alone. */
export function useTierLabel() {
  const { t } = useI18n();
  return (tier: ScoreTier) =>
    tier === "good"
      ? { label: t("Good", "Bun"), icon: CircleCheck, text: "text-[#5fe3d0]" }
      : tier === "fair"
        ? { label: t("Fair", "Acceptabil"), icon: CircleDot, text: "text-[#89cbf6]" }
        : { label: t("Needs work", "De îmbunătățit"), icon: CircleAlert, text: "text-[#b3acff]" };
}

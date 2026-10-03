import type { ScanState } from "@/components/scan/scan-state";
import type { Lang, PresencePlatform, ScanStepId } from "@/lib/scan/types";

/** The floating data-source cards around the globe, in their orbit order. */
export type DataCardId =
  | "website"
  | "social"
  | "business"
  | "technology"
  | "reviews"
  | "competitors";

export type DataCard = {
  id: DataCardId;
  label: string;
  value: string;
  detail?: string;
  chips?: string[];
  /** Nothing found (e.g. no website): shown dimmer. */
  muted?: boolean;
};

type T = (en: string, ro: string) => string;

const SOCIAL: Partial<Record<PresencePlatform, string>> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
};

function finished(state: ScanState, id: ScanStepId) {
  const status = state.steps.find((step) => step.id === id)?.status;
  return status === "done" || status === "skipped" || status === "failed";
}

/** "1 page analysed" / "38 de pagini analizate" (Romanian adds "de" from 20). */
export function count(n: number, lang: Lang, one: [string, string], many: [string, string]) {
  const [en, ro] = n === 1 ? one : many;
  const number = n.toLocaleString(lang === "ro" ? "ro-RO" : "en-GB");
  if (lang !== "ro") return `${number} ${en}`;
  const de = n >= 20 && (n % 100 === 0 || n % 100 >= 20);
  return `${number} ${de ? "de " : ""}${ro}`;
}

/**
 * Builds the cards from what the scan has actually found so far. A card only
 * appears once its step has finished, and only with measured values.
 */
export function buildDataCards(state: ScanState, t: T, lang: Lang): DataCard[] {
  const cards: DataCard[] = [];
  const { audit, company, presence, competitors } = state;

  if (finished(state, "website")) {
    if (audit?.reachable) {
      const pages = count(
        audit.pages.length,
        lang,
        ["page analysed", "pagină analizată"],
        ["pages analysed", "pagini analizate"],
      );
      cards.push({
        id: "website",
        label: t("Website", "Site"),
        value: audit.host,
        detail: audit.https ? `${pages} · HTTPS` : pages,
      });
    } else {
      cards.push({
        id: "website",
        label: t("Website", "Site"),
        value: audit
          ? t("Site didn't respond", "Site-ul nu a răspuns")
          : t("No website found", "Nu am găsit un site"),
        detail: audit?.host,
        muted: true,
      });
    }
  }

  if (finished(state, "presence") && presence) {
    const social = presence.profiles.filter(
      (profile) => SOCIAL[profile.platform] && profile.status !== "missing",
    );
    cards.push({
      id: "social",
      label: t("Social media", "Rețele sociale"),
      value: social.length
        ? count(
            social.length,
            lang,
            ["profile found", "profil găsit"],
            ["profiles found", "profiluri găsite"],
          )
        : t("No profiles linked", "Niciun profil pe site"),
      chips: social.map((profile) => SOCIAL[profile.platform] as string),
      muted: social.length === 0,
    });
  }

  if (company) {
    const activity = company.caenLabel?.[lang] ?? (company.caen ? `CAEN ${company.caen}` : "");
    const place = company.city ?? company.county;
    cards.push({
      id: "business",
      label: t("Business info", "Date despre firmă"),
      value: place ?? company.displayName,
      detail: activity || (place ? company.displayName : undefined),
    });
  }

  if (finished(state, "technology") && audit?.technologies.length) {
    const names = [...audit.technologies]
      .sort((a, b) => b.confidence - a.confidence)
      .map((tech) => tech.name);
    cards.push({
      id: "technology",
      label: t("Tech stack", "Tehnologii"),
      value: names[0],
      detail: count(
        names.length,
        lang,
        ["technology detected", "tehnologie detectată"],
        ["technologies detected", "tehnologii detectate"],
      ),
      chips: names.slice(1, 3),
    });
  }

  if (finished(state, "presence") && presence) {
    const rating = presence.googleRating;
    const google = presence.profiles.find((p) => p.platform === "google-business");
    if (rating) {
      cards.push({
        id: "reviews",
        label: t("Reviews", "Recenzii"),
        value: `${rating.rating.toLocaleString(lang === "ro" ? "ro-RO" : "en-GB", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} ★`,
        detail: count(
          rating.reviews,
          lang,
          ["Google review", "recenzie Google"],
          ["Google reviews", "recenzii Google"],
        ),
      });
    } else if (google && google.status !== "missing") {
      cards.push({
        id: "reviews",
        label: t("Reviews", "Recenzii"),
        value: t("Google profile detected", "Profil Google găsit"),
      });
    }
  }

  if (finished(state, "competitors") && competitors?.length) {
    cards.push({
      id: "competitors",
      label: t("Competitors", "Concurență"),
      value: competitors.length.toLocaleString(lang === "ro" ? "ro-RO" : "en-GB"),
      detail: t("similar businesses nearby", "afaceri similare în zonă"),
    });
  }

  return cards;
}

import { Stat, StatStrip, Status } from "@/components/system";
import { useI18n } from "@/i18n";
import { formatNumber, roNeedsDe } from "@/lib/scan/blueprint/format";
import type {
  Blueprint,
  OnlinePresence,
  PageSpeedResult,
  PresencePlatform,
  WebsiteAudit,
} from "@/lib/scan/types";
import { MetricBar } from "../../report/MetricBar";
import { PresenceRow, type PresenceView } from "../../report/PresenceTile";
import { ScoreFigure } from "../../report/ScoreRing";
import { useTierLabel, type ScoreTier } from "../../report/tiers";
import { FindingsList } from "./FindingsList";
import { EmptyState, SubHeading } from "./shared";

/** Sectors that sell mostly to other businesses: LinkedIn matters there, Instagram less. */
const B2B_SECTORS = new Set([
  "Professional services",
  "Technology",
  "Industry",
  "Trade",
  "Construction",
  "Transport",
  "Real estate",
]);

const SOCIAL_HOSTS: Partial<Record<PresencePlatform, RegExp>> = {
  facebook: /facebook\.com|fb\.com/i,
  instagram: /instagram\.com/i,
  linkedin: /linkedin\.com/i,
  youtube: /youtube\.com|youtu\.be/i,
  tiktok: /tiktok\.com/i,
  x: /(^|\/\/|\.)(x|twitter)\.com/i,
};

/**
 * The channels worth a row for this business: Google and Facebook always, Instagram for
 * businesses that sell to people, LinkedIn for those that sell to firms; any other
 * platform only when we found it (no "YouTube: missing" for a dental clinic).
 */
function channelViews(
  sector: string,
  presence: OnlinePresence | undefined,
  audit: WebsiteAudit | undefined,
): PresenceView[] {
  const relevant: PresencePlatform[] = [
    "google-business",
    "facebook",
    B2B_SECTORS.has(sector) ? "linkedin" : "instagram",
  ];
  const rating = presence?.googleRating;
  const views: PresenceView[] = relevant.map((platform) => {
    const found = presence?.profiles.find((p) => p.platform === platform);
    if (found)
      return platform === "google-business" && !found.url
        ? { ...found, url: rating?.mapsUrl }
        : found;
    if (platform === "google-business" && rating) {
      return { platform, status: "active", url: rating.mapsUrl };
    }
    if (presence) return { platform, status: "missing" };
    // No profile search ran: fall back to the links on the site itself.
    const pattern = SOCIAL_HOSTS[platform];
    const link = pattern ? audit?.signals.socialLinks.find((url) => pattern.test(url)) : undefined;
    if (link) return { platform, status: "detected", url: link };
    return { platform, status: platform === "google-business" || !audit ? "unchecked" : "missing" };
  });

  const extra = new Set<PresencePlatform>(relevant);
  for (const profile of presence?.profiles ?? []) {
    if (extra.has(profile.platform) || profile.platform === "website") continue;
    if (profile.status === "missing") continue;
    extra.add(profile.platform);
    views.push(profile);
  }
  if (!presence) {
    for (const [platform, pattern] of Object.entries(SOCIAL_HOSTS) as Array<
      [PresencePlatform, RegExp]
    >) {
      if (extra.has(platform)) continue;
      const link = audit?.signals.socialLinks.find((url) => pattern.test(url));
      if (link) views.push({ platform, status: "detected", url: link });
    }
  }
  return views;
}

const VITAL_TONE: Record<ScoreTier, "ok" | "warn" | "bad"> = {
  good: "ok",
  fair: "warn",
  poor: "bad",
};

/**
 * The "Prezență online" tab in one panel body: on the left the website score with its
 * area rows and the two overall scores; on the right the speed on a phone and the
 * channels; the findings table across the full width under both.
 */
export function PresencePanel({
  blueprint,
  audit,
  pagespeed,
  presence,
  websiteFailed,
}: {
  blueprint: Blueprint;
  audit?: WebsiteAudit;
  pagespeed?: PageSpeedResult;
  presence?: OnlinePresence;
  websiteFailed?: boolean;
}) {
  const { t, lang } = useI18n();
  const tierLabel = useTierLabel();
  const site = audit?.reachable ? audit : undefined;
  const channels = channelViews(blueprint.businessType.sector.en, presence, audit);

  const bars = site
    ? [
        {
          key: "performance",
          label: t("Speed", "Viteză"),
          value: site.scores.performance ?? pagespeed?.performance,
        },
        {
          key: "seo",
          label: t("Google visibility (SEO)", "Vizibilitate în Google"),
          value: site.scores.seo,
        },
        {
          key: "conversion",
          label: t("Contact and trust", "Contact și încredere"),
          value: site.scores.conversion,
        },
        {
          key: "security",
          label: t("Security and GDPR", "Securitate și GDPR"),
          value: site.scores.security,
        },
        {
          key: "accessibility",
          label: t("Accessibility", "Accesibilitate"),
          value: site.scores.accessibility,
        },
        { key: "content", label: t("Content", "Conținut"), value: site.scores.content },
      ].filter((bar): bar is typeof bar & { value: number } => typeof bar.value === "number")
    : [];

  const pages = site?.pages.length ?? 0;
  const pagesLine = site
    ? t(
        `${pages} ${pages === 1 ? "page" : "pages"} checked`,
        `${pages} ${pages === 1 ? "pagină verificată" : `${roNeedsDe(pages) ? "de " : ""}pagini verificate`}`,
      )
    : undefined;

  // Speed on a phone: three measurements in plain words, seconds only (no ms, no CLS score).
  const vitals = pagespeed
    ? ([
        pagespeed.lcpMs !== undefined && {
          key: "lcp",
          label: t("First screen shows in", "Primul ecran apare în"),
          value: `${formatNumber(pagespeed.lcpMs / 1000, lang, 1)} s`,
          tier: (pagespeed.lcpMs <= 2500
            ? "good"
            : pagespeed.lcpMs <= 4000
              ? "fair"
              : "poor") as ScoreTier,
          target: t("target: under 2.5\u00a0s", "ținta: sub 2,5\u00a0s"),
        },
        pagespeed.tbtMs !== undefined && {
          key: "tbt",
          label: t("Doesn't respond for", "Nu răspunde la atingere"),
          value: `${formatNumber(Math.max(0.1, Math.round(pagespeed.tbtMs / 100) / 10), lang, 1)} s`,
          tier: (pagespeed.tbtMs <= 200
            ? "good"
            : pagespeed.tbtMs <= 600
              ? "fair"
              : "poor") as ScoreTier,
          target: t(
            "while loading; target: under 0.2\u00a0s",
            "la încărcare; ținta: sub 0,2\u00a0s",
          ),
        },
        pagespeed.cls !== undefined && {
          key: "cls",
          label: t("The page jumps while loading", "Pagina sare cât se încarcă"),
          value:
            pagespeed.cls <= 0.1
              ? t("hardly", "aproape deloc")
              : pagespeed.cls <= 0.25
                ? t("a little", "puțin")
                : t("a lot", "mult"),
          tier: (pagespeed.cls <= 0.1
            ? "good"
            : pagespeed.cls <= 0.25
              ? "fair"
              : "poor") as ScoreTier,
          target: t("target: hardly at all", "ținta: aproape deloc"),
        },
      ].filter(Boolean) as Array<{
        key: string;
        label: string;
        value: string;
        tier: ScoreTier;
        target: string;
      }>)
    : [];

  // "Maturitate digitală" (a score of scores) stays in the PDF's method page only.
  const automation = blueprint.scores.automationPotential;
  const automationLine =
    automation >= 70
      ? t(
          "Many repetitive tasks: worth automating.",
          "Multe sarcini repetitive: merită automatizate.",
        )
      : automation >= 40
        ? t(
            "Some repetitive tasks can be automated.",
            "Câteva sarcini repetitive se pot automatiza.",
          )
        : t(
            "Few tasks to automate; the website matters more.",
            "Puține sarcini de automatizat; contează mai mult site-ul.",
          );

  const rating = presence?.googleRating;
  const ratingText = rating
    ? t(
        `Rating ${formatNumber(rating.rating, "en", 1)} from ${formatNumber(rating.reviews, "en")} reviews`,
        `Nota ${formatNumber(rating.rating, "ro", 1)} din ${formatNumber(rating.reviews, "ro")} ${roNeedsDe(rating.reviews) ? "de " : ""}recenzii`,
      )
    : undefined;
  const missingLine: Partial<Record<PresencePlatform, string>> = {
    "google-business": t(
      "Without it the business doesn't show on Google Maps.",
      "Fără el, firma nu apare în Google Maps.",
    ),
    facebook: t(
      "A page with hours and contact details is enough to start.",
      "O pagină cu programul și datele de contact e de ajuns la început.",
    ),
    instagram: t("Useful for showing your work.", "Util ca să-ți arăți munca."),
    linkedin: t(
      "Useful with business clients and hiring.",
      "Util pentru clienți firme și angajări.",
    ),
  };

  return (
    <div>
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          {site ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <ScoreFigure
                value={site.scores.overall}
                label={t("Website score", "Scorul site-ului")}
                sub={pagesLine}
                className="sm:w-36 sm:shrink-0"
              />
              <div className="min-w-0 flex-1 sm:pt-0.5">
                {bars.map((bar) => (
                  <MetricBar key={bar.key} label={bar.label} value={bar.value} />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title={
                (audit && !audit.reachable) || websiteFailed
                  ? t("We couldn't open the website", "Nu am putut deschide site-ul")
                  : t("No website analysed", "Niciun site analizat")
              }
              body={
                audit && !audit.reachable
                  ? t(
                      `${audit.host} didn't respond${audit.statusCode ? ` (status ${audit.statusCode})` : ""}, so there's no website score. Use “Edit” to try another address.`,
                      `${audit.host} nu a răspuns${audit.statusCode ? ` (cod ${audit.statusCode})` : ""}, deci nu avem un scor al site-ului. Folosește „Editează” pentru altă adresă.`,
                    )
                  : websiteFailed
                    ? t(
                        "The website didn't respond. Use “Edit” to try another address.",
                        "Site-ul nu a răspuns. Folosește „Editează” pentru altă adresă.",
                      )
                    : t(
                        "We didn't find a website for this business. Add one with “Edit” to get a website score.",
                        "Nu am găsit un site pentru această firmă. Adaugă-l din „Editează” ca să primești un scor al site-ului.",
                      )
              }
            />
          )}

          {/* Automation potential as a sentence; the score is secondary. */}
          <div className="border-t border-line-1 pt-3">
            <p className="text-[0.8125rem] leading-[1.35] text-fg-3">
              {t("Automation potential", "Potențial de automatizare")}
            </p>
            <p className="mt-1 text-[0.9375rem] leading-[1.45] text-fg">
              {automationLine}{" "}
              <span className="type-pnum whitespace-nowrap text-[0.8125rem] text-fg-3">
                {t(`(${automation} of 100)`, `(${automation} din 100)`)}
              </span>
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          {vitals.length ? (
            <section>
              <SubHeading
                meta={
                  pagespeed?.strategy === "desktop"
                    ? "Lighthouse, desktop"
                    : t("Lighthouse, mobile", "Lighthouse, mobil")
                }
              >
                {pagespeed?.strategy === "desktop"
                  ? t("Speed on a computer", "Viteza pe calculator")
                  : t("Speed on a phone", "Viteza pe mobil")}
              </SubHeading>
              <StatStrip bleed columns={3} label={t("Speed measurements", "Măsurători de viteză")}>
                {vitals.map((vital) => {
                  const tier = tierLabel(vital.tier);
                  return (
                    <Stat
                      key={vital.key}
                      label={vital.label}
                      value={vital.value}
                      note={
                        <Status tone={VITAL_TONE[vital.tier]} className="ml-2 align-[0.1em]">
                          {tier.label}
                        </Status>
                      }
                      sub={vital.target}
                    />
                  );
                })}
              </StatStrip>
            </section>
          ) : null}

          <section>
            <SubHeading
              meta={
                presence
                  ? t("profile search", "căutare de profiluri")
                  : site
                    ? t("from the website's links", "din linkurile de pe site")
                    : undefined
              }
            >
              {t("Where customers find you", "Unde te găsesc clienții")}
            </SubHeading>
            <ul className="divide-y divide-line-1 border-y border-line-1">
              {channels.map((profile) => (
                <PresenceRow
                  key={profile.platform}
                  profile={profile}
                  detail={
                    profile.platform === "google-business" && ratingText
                      ? ratingText
                      : profile.status === "missing"
                        ? missingLine[profile.platform]
                        : profile.status === "unchecked"
                          ? t(
                              "We couldn't check it this time.",
                              "Nu l-am putut verifica de data aceasta.",
                            )
                          : undefined
                  }
                />
              ))}
            </ul>
          </section>
        </div>
      </div>

      {site && site.findings.length > 0 ? (
        <div className="mt-8">
          <FindingsList findings={site.findings} />
        </div>
      ) : null}
    </div>
  );
}

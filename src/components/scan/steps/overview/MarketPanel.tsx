import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { FOCUS_RING, Stat, StatStrip } from "@/components/system";
import { useI18n } from "@/i18n";
import { roNeedsDe } from "@/lib/scan/blueprint/format";
import { withCommaBelow } from "@/lib/scan/localize";
import type { CompanyProfile, Competitor, WebsiteAudit } from "@/lib/scan/types";
import { cn } from "@/lib/utils";
import { displayHost, softenCaps } from "../../report/format";
import { EmptyState, SubHeading } from "./shared";

/** One business in the comparison: name and place on the left, a 2 px neutral bar, the score. */
function CompareRow({
  name,
  meta,
  score,
  missing,
  you = false,
}: {
  name: ReactNode;
  meta?: ReactNode;
  score?: number;
  /** Text in the value column when there is no score ("fără date"). */
  missing: string;
  you?: boolean;
}) {
  const value = typeof score === "number" ? Math.max(0, Math.min(100, Math.round(score))) : null;
  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-4 gap-y-1 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_4.5rem]",
        you && "-mx-2 rounded-sm bg-brand-tint px-2",
      )}
    >
      <div className="min-w-0">
        <p
          className={cn("truncate text-sm leading-[1.4]", you ? "font-medium text-fg" : "text-fg")}
        >
          {name}
        </p>
        {meta ? <p className="truncate text-xs leading-[1.45] text-fg-3">{meta}</p> : null}
      </div>
      <span
        aria-hidden
        className="relative order-last col-span-2 h-0.5 bg-line-1 sm:order-none sm:col-span-1"
      >
        {value !== null ? (
          <span
            className={cn("absolute inset-y-0 left-0", you ? "bg-fg" : "bg-fg-2")}
            style={{ width: `${value}%` }}
          />
        ) : null}
      </span>
      <span
        className={cn(
          "text-right text-[0.8125rem]",
          value !== null ? "type-num text-fg" : "text-fg-3",
        )}
      >
        {value ?? missing}
      </span>
    </li>
  );
}

/**
 * The "Piață" tab: three numbers on top (how many similar local firms, your website score,
 * theirs on average), then every firm's website score side by side with yours marked
 * "Tu", and where the list comes from.
 */
export function MarketPanel({
  competitors,
  audit,
  company,
  typeLabel,
}: {
  competitors: Competitor[];
  audit?: WebsiteAudit;
  company?: CompanyProfile;
  typeLabel: string;
}) {
  const { t } = useI18n();
  const yourScore = audit?.reachable ? audit.scores.overall : undefined;
  const sorted = [...competitors].sort((a, b) => (b.websiteScore ?? -1) - (a.websiteScore ?? -1));
  const scored = competitors.filter((c) => typeof c.websiteScore === "number");
  const average = scored.length
    ? Math.round(scored.reduce((sum, c) => sum + (c.websiteScore ?? 0), 0) / scored.length)
    : undefined;
  const city = company?.city ? withCommaBelow(softenCaps(company.city)) : undefined;
  const noData = t("no data", "fără date");

  if (!competitors.length) {
    return (
      <EmptyState
        title={t("No similar local businesses found", "Nu am găsit firme asemănătoare în zonă")}
        body={t(
          `We look for businesses with a similar name and activity${city ? ` in ${city}` : ""} in the Trade Register. None matched this time, which can also mean a less crowded market.`,
          `Căutăm în Registrul Comerțului firme cu nume și activitate asemănătoare${city ? ` din ${city}` : ""}. Nu a apărut niciuna de data aceasta, ceea ce poate însemna și o piață mai puțin aglomerată.`,
        )}
      />
    );
  }

  return (
    <div className="space-y-6">
      <StatStrip
        bleed
        columns={3}
        label={t("Market in numbers", "Piața în cifre")}
        // Three short figures: they stay side by side even on a phone.
        className="grid-cols-3"
      >
        <Stat
          label={t("Similar local businesses", "Firme asemănătoare din zonă")}
          value={competitors.length}
          sub={city ? t(`in ${city}`, `în ${city}`) : undefined}
        />
        <Stat
          label={t("Your website score", "Scorul site-ului tău")}
          value={yourScore ?? noData}
          unit={yourScore !== undefined ? t("of 100", "din 100") : undefined}
        />
        <Stat
          label={t("Their average", "Media lor")}
          value={average ?? noData}
          unit={average !== undefined ? t("of 100", "din 100") : undefined}
          sub={
            average !== undefined
              ? t(
                  `from ${scored.length} sites checked`,
                  `din ${scored.length} ${roNeedsDe(scored.length) ? "de " : ""}site-uri verificate`,
                )
              : t("no site checked", "niciun site verificat")
          }
        />
      </StatStrip>

      <section>
        <SubHeading
          meta={t("0–100, same checks for everyone", "0–100, aceleași verificări pentru toți")}
        >
          {t("Website score, side by side", "Scorul site-ului, față în față")}
        </SubHeading>
        <ol className="divide-y divide-line-1 border-y border-line-1">
          <CompareRow
            you
            name={
              <>
                {t("You", "Tu")}
                <span className="font-normal text-fg-2">
                  {", "}
                  {withCommaBelow(
                    company?.displayName ?? audit?.host ?? t("your business", "afacerea ta"),
                  )}
                </span>
              </>
            }
            score={yourScore}
            missing={noData}
          />
          {sorted.map((competitor) => {
            const host = displayHost(competitor.website);
            const place = competitor.city ? withCommaBelow(softenCaps(competitor.city)) : undefined;
            return (
              <CompareRow
                key={competitor.cui}
                name={withCommaBelow(competitor.name)}
                meta={
                  host && competitor.website ? (
                    <>
                      {place ? `${place}, ` : null}
                      <a
                        href={
                          /^https?:\/\//i.test(competitor.website)
                            ? competitor.website
                            : `https://${competitor.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className={cn(
                          "type-code inline-flex items-center gap-0.5 rounded-sm text-xs text-fg-3 underline decoration-fg/20 underline-offset-2 hover:text-fg-2",
                          FOCUS_RING,
                        )}
                      >
                        {host}
                        <ArrowUpRight aria-hidden className="size-3" />
                        <span className="sr-only">
                          {t(" (opens in a new tab)", " (se deschide într-o filă nouă)")}
                        </span>
                      </a>
                    </>
                  ) : (
                    [place, t("no website found", "fără site găsit")].filter(Boolean).join(", ")
                  )
                }
                score={competitor.websiteScore}
                missing={noData}
              />
            );
          })}
        </ol>
      </section>

      <p className="max-w-[72ch] text-xs leading-[1.5] text-fg-3">
        {t(
          `Found by name and city in the Trade Register (businesses like a ${typeLabel.toLowerCase()}${city ? ` in ${city}` : ""}). Scores come from the same checks we ran on your site; they are not a ranking of the businesses themselves.`,
          `Găsite după nume și oraș în Registrul Comerțului (afaceri de tipul „${typeLabel.toLowerCase()}”${city ? ` din ${city}` : ""}). Scorurile vin din aceleași verificări pe care le-am făcut pe site-ul tău și nu sunt un clasament al afacerilor.`,
        )}
      </p>
    </div>
  );
}

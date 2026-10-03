import { useMemo } from "react";

import { Status, type Tone } from "@/components/system";
import { useI18n } from "@/i18n";
import type { CompanyProfile, OnlinePresence, WebsiteAudit } from "@/lib/scan/types";
import { pick } from "../../report/format";
import { deriveJourney, type JourneyStatus } from "../../report/journey";

/**
 * The "Parcursul clientului" tab: the five stages from finding the business to coming
 * back, as table rows from 1024 px (the question with its status, what we saw as en-dash
 * lines, the fix in one sentence) and stacked on phones. No icon circles, no rail.
 */
export function JourneyPanel({
  audit,
  presence,
  company,
  bookings,
}: {
  audit?: WebsiteAudit;
  presence?: OnlinePresence;
  company?: CompanyProfile;
  /** The business takes appointments (a clinic, a salon): the booking stage says "programare" only. */
  bookings?: boolean;
}) {
  const { t, lang } = useI18n();
  const stages = useMemo(
    () => deriveJourney({ audit, presence, company, bookings }),
    [audit, presence, company, bookings],
  );
  const strong = stages.filter((stage) => stage.status === "strong").length;
  // A marker only says something when the stages differ: five "De îmbunătățit" in a row
  // is noise, so then the intro line says it once and the rows go without.
  const same = stages.every((stage) => stage.status === stages[0]?.status);
  const status: Record<JourneyStatus, { tone: Tone; label: string }> = {
    strong: { tone: "ok", label: t("Good", "Bine") },
    weak: { tone: "warn", label: t("Needs work", "De îmbunătățit") },
    missing: { tone: "bad", label: t("Missing", "Lipsește") },
  };
  const columns = "lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,1fr)]";

  return (
    <div>
      <p className="max-w-[72ch] text-sm leading-[1.5] text-fg-2">
        {same && stages[0]?.status === "weak"
          ? t(
              "How a new customer moves from finding you to coming back: every stage works, but each one has something to improve.",
              "Drumul unui client nou, de la prima căutare până revine: fiecare etapă funcționează, dar toate au ceva de îmbunătățit.",
            )
          : t(
              `How a new customer moves from finding you to coming back: ${strong} of 5 stages work well today.`,
              `Drumul unui client nou, de la prima căutare până revine: ${strong} din 5 etape merg bine azi.`,
            )}
      </p>

      <div
        aria-hidden
        className={`mt-4 hidden gap-x-6 border-b border-rule pb-2 text-xs font-medium text-fg-3 lg:grid ${columns}`}
      >
        <span>{t("Stage", "Etapa")}</span>
        <span>{t("What we saw", "Ce am văzut")}</span>
        <span>{t("What we do", "Ce facem")}</span>
      </div>
      <ol className="mt-3 divide-y divide-line-1 border-y border-line-1 lg:mt-0 lg:border-t-0">
        {stages.map((stage) => (
          <li key={stage.id} className={`grid gap-x-6 gap-y-2 py-3 ${columns}`}>
            <div className="min-w-0">
              <h3 className="type-h4 text-fg">{pick(stage.question, lang)}</h3>
              {same ? null : (
                <Status tone={status[stage.status].tone} className="mt-1">
                  {status[stage.status].label}
                </Status>
              )}
            </div>
            {stage.found.length ? (
              <ul className="min-w-0 space-y-0.5 text-sm leading-[1.5] text-fg-2">
                {stage.found.map((line) => (
                  <li key={line.en} className="flex gap-2">
                    <span aria-hidden className="shrink-0 text-fg-3">
                      –
                    </span>
                    <span className="min-w-0">{pick(line, lang)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="hidden lg:block" />
            )}
            {stage.fix ? (
              <p className="min-w-0 text-sm leading-[1.5] text-fg-2">
                <span className="font-medium text-fg lg:sr-only">
                  {t("What we do: ", "Ce facem: ")}
                </span>
                {pick(stage.fix, lang)}
              </p>
            ) : (
              <p className="min-w-0 text-sm leading-[1.5] text-fg-3">
                {t("Nothing to change here.", "Nimic de schimbat aici.")}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

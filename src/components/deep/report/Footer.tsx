import { useState } from "react";

import { Button, CheckboxField } from "@/components/system";
import { useI18n } from "@/i18n";

import {
  AI_LABEL,
  NO_PROFILES,
  OPT_OUT,
  PRIVACY_LINE,
  RULES_LABEL,
  RULES_NOTE,
  WHO_ELSE,
} from "../copy";
import { dayLabel } from "../format";
import { useReport } from "./context";
import { Disclosure } from "./shared";

/*
 * The end of the report (plan A1 items 14, A12): "A fost util?", the price question,
 * "Anunță-mă lunar", then the footer lines (AI or rules label, privacy, who else can see,
 * no profiles, the opt-out link, the verification code, "Șterge din acest browser").
 */

type Sent = "sent" | "kept" | "sample" | null;

function SentNote({ sent }: { sent: Sent }) {
  const { t } = useI18n();
  if (!sent) return null;
  return (
    <p className="mt-2 text-[0.875rem] text-fg-2" role="status">
      {sent === "sent"
        ? t("Thank you, it reached us.", "Mulțumim, a ajuns la noi.")
        : sent === "sample"
          ? t(
              "Thank you. In the sample nothing is sent.",
              "Mulțumim. În exemplu nu se trimite nimic.",
            )
          : t(
              "Thank you. We can't store answers yet (server storage is not on); nothing was sent.",
              "Mulțumim. Nu putem păstra încă răspunsurile (salvarea pe server nu e pornită); nu s-a trimis nimic.",
            )}
    </p>
  );
}

export function Feedback() {
  const { t } = useI18n();
  const { onFeedback } = useReport();
  const [useful, setUseful] = useState<Sent>(null);
  const [price, setPrice] = useState<Sent>(null);
  const [monthly, setMonthly] = useState(false);
  const [monthlySent, setMonthlySent] = useState<Sent>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <section aria-labelledby="feedback" className="min-w-0 border-t border-line-1 pt-5">
      <h2 id="feedback" className="type-h4 text-fg">
        {t("Was this useful?", "A fost util?")}
      </h2>
      {useful ? (
        <SentNote sent={useful} />
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="h-11 min-w-20"
            onClick={async () => setUseful(await onFeedback("useful_yes"))}
          >
            {t("Yes", "Da")}
          </Button>
          <Button
            variant="secondary"
            className="h-11 min-w-20"
            onClick={async () => setUseful(await onFeedback("useful_no"))}
          >
            {t("No", "Nu")}
          </Button>
        </div>
      )}

      <h3 className="type-h4 mt-6 text-fg">
        {t(
          "What would you pay for a report like this?",
          "Cât ai plăti pentru un raport ca acesta?",
        )}
      </h3>
      {price ? (
        <SentNote sent={price} />
      ) : (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t("Price", "Preț")}>
          {["0", "100", "250", "500+"].map((v) => (
            <Button
              key={v}
              variant="secondary"
              className="h-11 min-w-16"
              aria-pressed={chosen === v}
              onClick={async () => {
                setChosen(v);
                setPrice(await onFeedback("price_signal", { value: { lei: v } }));
              }}
            >
              {v} lei
            </Button>
          ))}
        </div>
      )}

      <div className="mt-6">
        <CheckboxField
          checked={monthly}
          onCheckedChange={async (value) => {
            const on = value === true;
            setMonthly(on);
            if (on) setMonthlySent(await onFeedback("monitoring_interest"));
          }}
          label={t(
            "Tell me monthly what changes at my company and my competitors",
            "Anunță-mă lunar ce se schimbă la firma mea și la concurenți",
          )}
        />
        <SentNote sent={monthlySent} />
      </div>
    </section>
  );
}

export function ReportFooter() {
  const { t, lang } = useI18n();
  const { report, onForget, sample } = useReport();
  const [confirm, setConfirm] = useState(false);
  return (
    <footer
      id="cum-am-lucrat"
      className="min-w-0 scroll-mt-28 space-y-2 border-t border-line-1 pt-5 text-[0.875rem] leading-[1.55] text-fg-3"
    >
      <p>
        {report.aiMode === "ai" ? (
          AI_LABEL[lang]
        ) : (
          <>
            <span className="font-medium text-fg-2">{RULES_LABEL[lang]}.</span> {RULES_NOTE[lang]}
          </>
        )}
      </p>
      {report.aiMode === "ai" && report.models ? (
        <Disclosure
          className="border-y border-line-1"
          summary={<span className="text-fg-2">{t("How we worked", "Cum am lucrat")}</span>}
        >
          <p>
            {t(
              `Text: ${report.models.synthesis}; page reading: ${report.models.extraction}. Every AI sentence cites a fact, is checked by code and by a second model, or is left out. Every number comes from code.`,
              `Text: ${report.models.synthesis}; citirea paginilor: ${report.models.extraction}. Fiecare propoziție scrisă de AI citează un fapt, e verificată de cod și de un al doilea model, altfel nu apare. Fiecare cifră vine din cod.`,
            )}
          </p>
        </Disclosure>
      ) : null}
      <p>{PRIVACY_LINE[lang]}</p>
      <Disclosure
        className="border-y border-line-1"
        summary={
          <span className="text-fg-2">{t("Who else can see this?", "Cine mai poate vedea?")}</span>
        }
      >
        <p>{WHO_ELSE[lang]}</p>
      </Disclosure>
      <p>{NO_PROFILES[lang]}</p>
      <p>
        <a
          href="/privacy#vortex-scan-bot"
          className="-my-3 inline-flex min-h-11 items-center rounded-sm text-fg-2 underline underline-offset-2 hover:text-fg"
        >
          {OPT_OUT[lang]}
        </a>
      </p>
      <p className="type-pnum">
        {t("Generated", "Generat")} {dayLabel(report.generatedAt, lang)}
        {report.verifyCode ? (
          <>
            {" · "}
            {t("Verification code", "Cod de verificare")}:{" "}
            <span className="type-code text-fg-2">{report.verifyCode}</span>
          </>
        ) : null}
        {" · "}
        {t("Not legal or financial advice", "Nu este consultanță juridică sau financiară")}
      </p>
      {onForget && !sample ? (
        confirm ? (
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-fg-2">
              {t("Delete this report from this browser?", "Ștergi raportul din acest browser?")}
            </span>
            <Button variant="secondary" size="sm" className="h-9" onClick={onForget}>
              {t("Delete", "Șterge")}
            </Button>
            <Button variant="ghost" size="sm" className="h-9" onClick={() => setConfirm(false)}>
              {t("Keep it", "Păstrează")}
            </Button>
          </p>
        ) : (
          <Button
            variant="link"
            size="sm"
            className="min-h-11 sm:min-h-0"
            onClick={() => setConfirm(true)}
          >
            {t("Delete from this browser", "Șterge din acest browser")}
          </Button>
        )
      ) : null}
    </footer>
  );
}

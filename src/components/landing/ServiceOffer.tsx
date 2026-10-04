import type { ReactNode } from "react";

import { SectionHeader } from "@/components/system";
import { useI18n } from "@/i18n";
import { groupedNumber, NBSP, type FixedProject } from "@/lib/pricing";

/**
 * What a service page sells, in the site's hairline language (no cards, no badges): "Ce
 * primești" as an en-dash list beside the facts that decide a purchase (price, time frame,
 * what happens after), then what is not included. Prices come from src/lib/pricing.ts only.
 * Copy rules: nothing promised that the price list or the existing copy does not state.
 */

export type OfferFact = { label: string; value: ReactNode };

const DASH_ROW = "flex gap-2.5 border-b border-line-1 py-3";

export function ServiceOffer({
  headingId,
  title,
  lead,
  included,
  facts,
  excluded,
}: {
  headingId: string;
  title: string;
  lead?: string;
  /** "Ce primești": one line per thing the client gets. */
  included: string[];
  /** Label / value rows: price first. */
  facts: OfferFact[];
  /** "Nu sunt incluse". */
  excluded: string[];
}) {
  const { t } = useI18n();

  return (
    <section aria-labelledby={headingId} className="section-y">
      <div className="container-vx">
        <SectionHeader headingId={headingId} title={title} lead={lead} />
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <ul className="border-t border-rule lg:col-span-7">
            {included.map((item) => (
              <li key={item} className={DASH_ROW}>
                <span aria-hidden className="text-fg-3">
                  –
                </span>
                <span className="type-body min-w-0 text-pretty text-fg">{item}</span>
              </li>
            ))}
          </ul>
          <dl className="border-t border-rule lg:col-span-5">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="type-body-sm grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-4 border-b border-line-1 py-3"
              >
                <dt className="text-fg-3">{fact.label}</dt>
                <dd className="min-w-0 text-pretty text-fg">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-10 max-w-3xl">
          <h3 className="type-h4 text-fg">{t("Not included", "Nu sunt incluse")}</h3>
          <ul className="mt-2 space-y-1.5">
            {excluded.map((item) => (
              <li key={item} className="type-body-sm flex gap-2.5 text-pretty text-fg-2">
                <span aria-hidden className="text-fg-3">
                  –
                </span>
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * A fixed-price project's price as the pricing section sets it: the amount large, the words
 * around it small ("de la 4.500 lei", "1.500–3.500 lei", "300 lei pe oră").
 */
export function ProjectPriceValue({ project }: { project: FixedProject }) {
  const { t, lang } = useI18n();
  const { low, high, perHour } = project.priceLei;
  const unit = lang === "ro" ? "lei" : "RON";
  const n = (value: number) => groupedNumber(value, lang);
  const amount = (value: string) => <span className="type-price text-fg">{value}</span>;

  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5">
      {high ? (
        amount(`${n(low)}–${n(high)}${NBSP}${unit}`)
      ) : perHour ? (
        <>
          {amount(`${n(low)}${NBSP}${unit}`)}
          <span className="text-fg-3">{t("an hour", "pe oră")}</span>
        </>
      ) : (
        <>
          <span className="text-fg-3">{t("from", "de la")}</span>
          {amount(`${n(low)}${NBSP}${unit}`)}
        </>
      )}
    </span>
  );
}

export type FaqItem = { question: string; answer: ReactNode };

/**
 * "Întrebări frecvente": the questions on hairline rows, answers always visible (nothing to
 * open, and every answer is in the server-rendered page).
 */
export function ServiceFaq({ headingId, items }: { headingId: string; items: FaqItem[] }) {
  const { t } = useI18n();

  return (
    <section aria-labelledby={headingId} className="section-y">
      <div className="container-vx">
        <SectionHeader
          layout="split"
          headingId={headingId}
          title={t("Frequently asked questions", "Întrebări frecvente")}
        >
          <ul className="border-t border-rule">
            {items.map((item) => (
              <li key={item.question} className="border-b border-line-1 py-4">
                <h3 className="type-h4 text-pretty text-fg">{item.question}</h3>
                <p className="type-body-sm mt-1 max-w-[62ch] text-pretty text-fg-2">
                  {item.answer}
                </p>
              </li>
            ))}
          </ul>
        </SectionHeader>
      </div>
    </section>
  );
}

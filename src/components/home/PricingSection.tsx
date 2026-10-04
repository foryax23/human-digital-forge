import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import { ButtonLink, RECOMMENDED_RULE, SectionHeader } from "@/components/system";
import { useI18n } from "@/i18n";
import type { PlanId } from "@/lib/plans";
import {
  deepReportsText,
  EXTRA_HOUR_LEI,
  FIXED_PROJECTS,
  groupedNumber,
  includedHoursText,
  leiText,
  PLAN_CATALOG,
  PLAN_ORDER,
  termText,
  type FixedProject,
  type PlanCatalogEntry,
  type PriceText,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

/** The recommended column: a 2 px violet top rule and the primary button, nothing else. */
const RECOMMENDED: PlanId = "growth";

/**
 * Plans & pricing (#pricing), from the price list in src/lib/pricing.ts: the free first
 * step, the three plans for after launch as one sheet of columns on hairline dividers,
 * the terms in plain words and the fixed-price projects. Plans are sold by contract:
 * "Cere contractul" opens /contact with the plan chosen (no card checkout here).
 */
export function PricingSection() {
  const { t, lang } = useI18n();
  const extra = leiText(EXTRA_HOUR_LEI)[lang];

  const terms: { label: string; value: string }[] = [
    {
      label: t("Extra hours", "Ore în plus"),
      value: t(
        `${extra} an hour, on any plan. Unused hours carry over for one month.`,
        `${extra} pe oră, în orice abonament. Orele nefolosite se reportează o lună.`,
      ),
    },
    {
      label: t("Term", "Durata"),
      value: t(
        "Starter runs month to month. Growth and Pro: at least 3 months, then monthly. Write to us and we stop the plan from the next month.",
        "Starter e lunar, fără perioadă minimă. Growth și Pro: minimum 3 luni, apoi lunar. Ne scrii și oprim abonamentul de la luna următoare.",
      ),
    },
    {
      label: t("Contract", "Contract"),
      value: t(
        "Plans are agreed by contract. Once it is signed, we also switch the plan on in your Vortex Hub account.",
        "Abonamentele se încheie prin contract. După semnare, activăm abonamentul și în contul tău Vortex Hub.",
      ),
    },
    {
      label: t("Not included", "Nu sunt incluse"),
      value: t(
        "New features beyond the plan's hours, other providers' fees (domain, n8n or Make, SMS, WhatsApp messages, AI usage above the Pro limit) and ad spend.",
        "Funcții noi peste orele din abonament, taxele altor furnizori (domeniu, n8n sau Make, SMS, mesaje WhatsApp, utilizarea AI peste limita din Pro) și bugetul de reclame.",
      ),
    },
  ];

  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="section-y scroll-mt-20">
      <div className="container-vx">
        <SectionHeader
          headingId="pricing-heading"
          kicker={t("Pricing", "Prețuri")}
          // A plain title: the two-tone device stays on Work only.
          title={t("Plans for after launch.", "Abonamente pentru după lansare.")}
          lead={t(
            "Projects have a fixed price, agreed before we start. After launch, a plan keeps your website and automations running, with hours of work included every month.",
            "Proiectele au preț fix, stabilit înainte să începem. După lansare, un abonament ține site-ul și automatizările în funcțiune, cu ore de lucru incluse în fiecare lună.",
          )}
        />

        {/* The free first step: a band above the plans, not a plan column. */}
        <div className="mb-10 flex flex-col gap-4 border-y border-line-1 py-5 md:mb-12 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="min-w-0">
            <h3 className="type-h4 text-fg">
              {t("The first step is free", "Primul pas e gratuit")}
            </h3>
            <p className="type-body-sm mt-1 max-w-[62ch] text-pretty text-fg-2">
              {t(
                "Scan your company with Vortex Scan, get the plan as a PDF and talk it through with us, with no commitment.",
                "Îți scanezi firma cu Vortex Scan, primești planul în PDF și îl discutăm împreună, fără obligații.",
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ButtonLink to="/scan" variant="secondary">
              {t("Scan your company", "Scanează-ți firma")}
            </ButtonLink>
            <ButtonLink to="/contact" variant="ghost">
              {t("Talk to us", "Vorbește cu noi")}
            </ButtonLink>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-y-8 lg:-mx-6 lg:grid-cols-3">
          {PLAN_ORDER.map((id, index) => (
            <PlanColumn
              key={id}
              entry={PLAN_CATALOG[id]}
              recommended={id === RECOMMENDED}
              className={index > 0 ? "lg:border-l" : undefined}
            />
          ))}
        </div>

        <dl className="mt-10 grid gap-x-10 gap-y-4 border-t border-line-1 pt-6 md:grid-cols-2">
          {terms.map((term) => (
            <div key={term.label} className="min-w-0">
              <dt className="text-[0.8125rem] font-medium text-fg">{term.label}</dt>
              <dd className="type-body-sm mt-1 text-pretty text-fg-2">{term.value}</dd>
            </div>
          ))}
        </dl>

        <FixedProjects />
      </div>
    </section>
  );
}

/**
 * One plan: name and role, the price on one baseline with "pe lună", the hours included,
 * the line on who it is for, "Cere contractul" and the en-dash list (behind "Ce include"
 * on phones).
 */
function PlanColumn({
  entry,
  recommended,
  className,
}: {
  entry: PlanCatalogEntry;
  recommended: boolean;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const pick = (text: PriceText) => text[lang];
  const features = [...entry.features, deepReportsText(entry.id), termText(entry.id)].map(pick);
  const price =
    lang === "ro" ? `${groupedNumber(entry.priceLei, "ro")} lei` : leiText(entry.priceLei).en;

  return (
    <div className={cn("min-w-0 border-line-1 lg:px-6", className)}>
      <div
        className={recommended ? `${RECOMMENDED_RULE} pt-[19px]` : "border-t border-line-2 pt-5"}
      >
        <div className="flex items-baseline justify-between gap-4 lg:block">
          <h3 className="type-h4 text-[1.0625rem] text-fg">
            {entry.name}
            <span className="ml-2 text-sm font-normal text-fg-3">{pick(entry.role)}</span>
          </h3>
          <p className="flex items-baseline gap-1.5 lg:mt-3">
            <span className="type-pnum text-[1.625rem] font-semibold leading-none text-fg lg:text-[2rem]">
              {price}
            </span>
            <span className="text-sm text-fg-3">{t("a month", "pe lună")}</span>
          </p>
        </div>
        <p className="mt-2 text-sm font-medium text-fg">
          {pick(includedHoursText(entry.hoursPerMonth))}
        </p>
        <p className="type-body-sm mt-1 text-pretty text-fg-2 lg:min-h-[2.625rem]">
          {pick(entry.descriptor)}
        </p>

        {/* Phones: the button and "Ce include" share one row. */}
        <div className="mt-4 flex items-center justify-between gap-4 lg:block">
          <ButtonLink
            to="/contact"
            search={{ plan: entry.id }}
            variant={recommended ? "primary" : "secondary"}
          >
            {t("Request the contract", "Cere contractul")}
            <span className="sr-only">: {entry.name}</span>
          </ButtonLink>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            // 44 px tap target on phones; the negative margin keeps the row at 28 px.
            className="-my-2 inline-flex min-h-11 items-center gap-1 rounded-md text-[0.8125rem] font-medium text-fg-2 outline-none hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line/55 lg:hidden"
          >
            {t("What's included", "Ce include")}
            <ChevronDown
              aria-hidden
              className={cn(
                "size-3.5 text-fg-3 transition-transform duration-150 motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </button>
        </div>
        <ul
          id={listId}
          aria-label={t(`${entry.name}: what's included`, `${entry.name}: ce include`)}
          className={cn("mt-3 space-y-1.5 lg:mt-5 lg:block", open ? "block" : "hidden")}
        >
          {features.map((feature) => (
            <li key={feature} className="flex gap-2 text-sm leading-[1.45] text-fg-2">
              <span aria-hidden className="text-fg-3">
                –
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** "Proiecte cu preț fix": the one-off prices next to the plans, on one ruled row. */
function FixedProjects() {
  const { t, lang } = useI18n();
  const headingId = useId();

  return (
    <div className="mt-12 md:mt-16" role="group" aria-labelledby={headingId}>
      <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-8">
        <h3 id={headingId} className="type-h3 text-fg">
          {t("Fixed-price projects", "Proiecte cu preț fix")}
        </h3>
        <p className="type-body-sm text-fg-2">
          {t(
            "The exact price is agreed together, before we start.",
            "Prețul exact îl stabilim împreună, înainte să începem.",
          )}
        </p>
      </div>
      <ul className="mt-4 grid border-t border-line-1 sm:grid-cols-2 lg:grid-cols-4">
        {FIXED_PROJECTS.map((project, index) => (
          <li
            key={project.id}
            className={cn(
              "min-w-0 border-b border-line-1 py-4 sm:px-5 lg:border-b-0",
              index % 2 === 1 && "sm:border-l",
              index > 0 && "lg:border-l",
              index % 2 === 0 && "sm:pl-0",
              // Four columns on desktop: only the first sits on the left edge.
              index === 2 && "lg:pl-5",
            )}
          >
            <p className="text-sm font-medium text-fg">{project.name[lang]}</p>
            <ProjectPrice project={project} />
            <p className="mt-1.5 text-[0.8125rem] leading-[1.45] text-pretty text-fg-3">
              {project.detail[lang]}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.8125rem] leading-[1.45] text-pretty text-fg-3">
        {t(
          "Web apps (Digital products) are priced once we know what they must do.",
          "Aplicațiile web (Produse digitale) primesc preț după ce stabilim ce trebuie să facă.",
        )}
      </p>
    </div>
  );
}

/** "de la 4.500 lei" with the amount set large, the words around it small. */
function ProjectPrice({ project }: { project: FixedProject }) {
  const { t, lang } = useI18n();
  const { low, high, perHour } = project.priceLei;
  const amount = (value: string) => (
    <span className="type-pnum text-[1.25rem] font-semibold leading-none text-fg">{value}</span>
  );
  const unit = lang === "ro" ? "lei" : "RON";
  const n = (value: number) => groupedNumber(value, lang);

  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
      {high ? (
        amount(`${n(low)}–${n(high)} ${unit}`)
      ) : perHour ? (
        <>
          {amount(`${n(low)} ${unit}`)}
          <span className="text-sm text-fg-3">{t("an hour", "pe oră")}</span>
        </>
      ) : (
        <>
          <span className="text-sm text-fg-3">{t("from", "de la")}</span>
          {amount(`${n(low)} ${unit}`)}
        </>
      )}
    </p>
  );
}

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button, ButtonLink, SectionHeader } from "@/components/system";
import { useI18n } from "@/i18n";
import { createCheckoutSession } from "@/lib/checkout.functions";
import { PLAN_PRICING, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

type Plan = {
  id: PlanId | "free";
  name: string;
  /** One plain line on who the plan is for. */
  descriptor: string;
  features: string[];
  /** The recommended column: a 2 px violet top rule and the primary button, nothing else. */
  recommended?: boolean;
};

/** "1.000" in Romanian, "1,000" in English: grouped by hand so server and browser agree. */
function grouped(value: number, lang: "en" | "ro") {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, lang === "ro" ? "." : ",");
}

/*
 * Column dividers per position: md shows two columns (dividers on the 2nd and 4th
 * plan), xl four (dividers on all but the first).
 */
const DIVIDERS = ["", "md:border-l", "xl:border-l", "md:border-l"];

/**
 * Plans & pricing (#pricing): the free conversation plus the three monthly plans as
 * one sheet of columns on hairline dividers, no card fills. Each paid plan starts a
 * Stripe checkout in the active currency (lei in Romanian, euro in English).
 */
export function PricingSection() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency = lang === "ro" ? "ron" : "eur";

  async function handleSubscribe(plan: PlanId) {
    setError(null);
    setLoadingPlan(plan);
    try {
      const { url } = await createCheckoutSession({
        data: {
          plan,
          currency,
          userId: user?.id ?? null,
          email: user?.email ?? null,
        },
      });
      window.location.href = url;
    } catch (err) {
      console.error("[pricing] checkout failed", err);
      setError(
        t(
          "Something went wrong starting checkout. Please try again.",
          "A apărut o problemă la inițierea plății. Te rugăm să încerci din nou.",
        ),
      );
      setLoadingPlan(null);
    }
  }

  // The scan's offer (src/lib/scan/blueprint/offer.ts) restates these features for the report's plan.
  const plans: Plan[] = [
    {
      id: "free",
      name: t("Free", "Gratuit"),
      descriptor: t("A first conversation, no commitment.", "O primă discuție, fără obligații."),
      features: [
        t("A conversation with our team", "O conversație cu echipa noastră"),
        t("A plan for your business", "Un plan pentru afacerea ta"),
        t("Clear, practical advice", "Sfaturi clare și practice"),
      ],
    },
    {
      id: "starter",
      name: "Starter",
      descriptor: t(
        "For one focused goal, with support every month.",
        "Pentru un singur obiectiv, cu sprijin în fiecare lună.",
      ),
      features: [
        t(
          "30 minutes of live Zoom consultation each month",
          "30 de minute de consultanță live pe Zoom în fiecare lună",
        ),
        t("1 month access to our AI tools", "1 lună de acces la instrumentele noastre AI"),
        t(
          "Personalised next-step recommendations",
          "Recomandări personalizate pentru pașii următori",
        ),
        t("Email support during your subscription", "Suport pe e-mail pe durata abonamentului"),
      ],
    },
    {
      id: "growth",
      name: "Growth",
      recommended: true,
      descriptor: t(
        "For businesses setting up their digital workflow.",
        "Pentru afacerile care își pun la punct procesele digitale.",
      ),
      features: [
        t("2 hours of live Zoom consultation", "2 ore de consultanță live pe Zoom"),
        t(
          "Guided setup of your digital workflow",
          "Configurare ghidată a proceselor tale digitale",
        ),
        t(
          "Expanded access to our AIs and programs",
          "Acces extins la instrumentele și programele noastre AI",
        ),
        t("Priority scheduling and email support", "Programări cu prioritate și suport pe e-mail"),
      ],
    },
    {
      id: "pro",
      name: "Pro",
      descriptor: t(
        "For a full partnership, with hands-on help on projects.",
        "Pentru un parteneriat complet, cu ajutor practic la proiecte.",
      ),
      features: [
        t("Hands-on help with your projects", "Ajutor practic pentru proiectele tale"),
        t(
          "Unlimited live support from our team",
          "Suport live nelimitat din partea echipei noastre",
        ),
        t("Unlimited access to all AI tools", "Acces nelimitat la toate instrumentele AI"),
        t("Direct priority line to us", "Legătură directă, cu prioritate, cu echipa noastră"),
      ],
    },
  ];

  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="section-y scroll-mt-20">
      <div className="container-vx">
        <SectionHeader
          headingId="pricing-heading"
          kicker={t("Pricing", "Prețuri")}
          // A plain title: the two-tone device stays on Work only.
          title={t("Pick a plan.", "Alege planul potrivit.")}
          lead={t(
            "All plans are monthly and you can cancel anytime. Start with a free call and move to a subscription when you need one.",
            "Toate planurile sunt lunare și poți anula oricând. Începi cu o discuție gratuită și treci la un abonament când ai nevoie.",
          )}
        />

        {error && (
          <p role="alert" className="type-body-sm mb-6 text-bad">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-y-8 md:-mx-6 md:grid-cols-2 md:gap-y-12 xl:grid-cols-4">
          {plans.map((plan, index) => {
            const amount = plan.id === "free" ? 0 : PLAN_PRICING[plan.id][currency] / 100;
            return (
              <PlanColumn
                key={plan.id}
                plan={plan}
                className={DIVIDERS[index]}
                price={lang === "ro" ? `${grouped(amount, "ro")} lei` : `€${grouped(amount, "en")}`}
                period={plan.id === "free" ? null : t("a month", "pe lună")}
                action={
                  plan.id === "free" ? (
                    <ButtonLink to="/contact" variant="secondary">
                      {t("Talk to us", "Vorbește cu noi")}
                    </ButtonLink>
                  ) : (
                    <Button
                      variant={plan.recommended ? "primary" : "secondary"}
                      disabled={loadingPlan !== null && loadingPlan !== plan.id}
                      loading={loadingPlan === plan.id}
                      onClick={() => handleSubscribe(plan.id as PlanId)}
                    >
                      {t(`Choose ${plan.name}`, `Alege ${plan.name}`)}
                    </Button>
                  )
                }
              />
            );
          })}
        </div>

        <p className="type-body-sm mt-10 text-fg-3">
          {t("Payments are handled securely by Stripe.", "Plata se face securizat prin Stripe.")}
        </p>
      </div>
    </section>
  );
}

/**
 * One plan: name, price on one baseline with its period, the line on who it is for,
 * the button and the en-dash feature list (behind "Ce include" on phones).
 */
function PlanColumn({
  plan,
  price,
  period,
  action,
  className,
}: {
  plan: Plan;
  price: string;
  period: string | null;
  action: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <div className={cn("min-w-0 border-line-1 md:px-6", className)}>
      <div
        className={cn(
          plan.recommended
            ? "border-t-2 border-brand-line pt-[19px]"
            : "border-t border-line-2 pt-5",
        )}
      >
        <div className="flex items-baseline justify-between gap-4 md:block">
          <h3 className="type-h4 text-[1.0625rem] text-fg">{plan.name}</h3>
          <p className="flex items-baseline gap-1.5 md:mt-3">
            <span className="type-pnum text-[1.625rem] font-semibold leading-none text-fg md:text-[2rem]">
              {price}
            </span>
            {period && <span className="text-sm text-fg-3">{period}</span>}
          </p>
        </div>
        <p className="type-body-sm mt-2 text-pretty text-fg-2 md:mt-3 md:min-h-[2.625rem]">
          {plan.descriptor}
        </p>

        {/* Phones: the button and "Ce include" share one row. */}
        <div className="mt-4 flex items-center justify-between gap-4 md:block">
          {action}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-7 items-center gap-1 rounded-md text-[0.8125rem] font-medium text-fg-2 outline-none hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line/55 md:hidden"
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
          aria-label={t(`${plan.name}: what's included`, `${plan.name}: ce include`)}
          className={cn("mt-3 space-y-1.5 md:mt-5 md:block", open ? "block" : "hidden")}
        >
          {plan.features.map((feature) => (
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

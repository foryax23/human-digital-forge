import { useState, type ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Em, SectionHeader } from "@/components/landing/SectionHeader";
import { RingButton } from "@/components/landing/RingButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/i18n";
import { createCheckoutSession } from "@/lib/checkout.functions";
import { PLAN_PRICING, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

const EASE = [0.25, 0.1, 0.25, 1] as const;

/** Same entrance as SectionHeader: fade up 30px once, 1 s. */
function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 1, delay, ease: EASE },
  } as const;
}

/** The amount as a big figure with its currency (and period) as a quiet line under it. */
function Price({ minor, lang, period }: { minor: number; lang: "en" | "ro"; period?: string }) {
  return (
    <p className="mt-3 flex flex-col gap-1">
      <span className="type-h2 tabular-nums text-foreground">{minor / 100}</span>
      <span className="type-body-sm text-muted-foreground">
        {lang === "ro" ? "lei" : "EUR"}
        {period && ` ${period}`}
      </span>
    </p>
  );
}

function FeatureItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-foreground"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="type-body-sm text-muted-foreground">{children}</span>
    </li>
  );
}

// Checkout buttons stay real <Button>s (disabled + spinner) but wear the
// RingButton faces so they match the link CTAs around them.
const checkoutFace = {
  solid: "bg-[#5b52f0] text-white group-hover:bg-[#6a62f6] group-focus-visible:bg-[#6a62f6]",
  outline:
    "border-2 border-border bg-background text-foreground group-hover:border-transparent group-focus-visible:border-transparent",
};

/**
 * Plans & pricing (#pricing): the free conversation plus the three monthly
 * plans, each paid plan starting a Stripe checkout in the active currency.
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

  const paidPlans: {
    id: PlanId;
    name: string;
    tagline: string;
    features: string[];
    highlight?: boolean;
  }[] = [
    {
      id: "starter",
      name: t("Starter", "Starter"),
      tagline: t("For up to 1 focused goal", "Pentru până la 1 obiectiv concentrat"),
      features: [
        t(
          "30 minutes of live Zoom consultation each month",
          "30 de minute de consultanță live pe Zoom în fiecare lună",
        ),
        t("1 month access to our AI tools", "1 lună de acces la instrumentele noastre AI"),
        t(
          "Personalised next-step recommendations",
          "Recomandări personalizate pentru următorul pas",
        ),
        t("Email support during your subscription", "Suport prin email pe durata abonamentului"),
      ],
    },
    {
      id: "growth",
      name: t("Growth", "Growth"),
      tagline: t("For people building momentum", "Pentru cei care construiesc avânt"),
      highlight: true,
      features: [
        t("2 hours of live Zoom consultation", "2 ore de consultanță live pe Zoom"),
        t(
          "Expanded access to our AIs and programs",
          "Acces extins la AI-urile și programele noastre",
        ),
        t("Priority scheduling for sessions", "Programare prioritară a sesiunilor"),
        t("Guided setup of your digital workflow", "Configurare ghidată a fluxului tău digital"),
        t("Priority email support", "Suport prin email prioritar"),
      ],
    },
    {
      id: "pro",
      name: t("Pro", "Pro"),
      tagline: t("For full, hands-on partnership", "Pentru un parteneriat complet, implicat"),
      features: [
        t("Full access to our complete program", "Acces complet la întregul nostru program"),
        t(
          "Unlimited live support from our team",
          "Suport live nelimitat din partea echipei noastre",
        ),
        t("Unlimited access to all AI tools", "Acces nelimitat la toate instrumentele AI"),
        t("Hands-on help with your projects", "Ajutor practic pentru proiectele tale"),
        t("Direct priority line to us", "Linie directă prioritară către noi"),
      ],
    },
  ];

  const planLabel = "type-label text-muted-foreground";
  const featuresLabel = "type-label text-foreground/80";

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="scroll-mt-24 bg-background py-16 md:py-24"
    >
      {/* Reduced motion: entrances keep the fade but skip the slide. */}
      <MotionConfig reducedMotion="user">
        <div className="mx-auto max-w-[1200px] px-6 md:px-10 lg:px-16">
          <SectionHeader
            align="center"
            headingId="pricing-heading"
            eyebrow={t("Plans & pricing", "Planuri și prețuri")}
            title={
              lang === "ro" ? (
                <>
                  Alege-ți <Em>planul</Em>
                </>
              ) : (
                <>
                  Choose your <Em>plan</Em>
                </>
              )
            }
            description={t(
              "Our plans are designed to be affordable, flexible and tailored to your goals. Start free, or subscribe monthly and cancel anytime.",
              "Planurile noastre sunt accesibile, flexibile și adaptate obiectivelor tale. Începe gratuit sau abonează-te lunar și anulează oricând.",
            )}
          />

          {error && (
            <p
              role="alert"
              className="type-body-sm mx-auto mb-10 max-w-xl rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-center text-destructive"
            >
              {error}
            </p>
          )}

          {/* Four columns only from xl, where each card is wide enough for the RON prices. */}
          <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-4 xl:gap-5">
            {/* Free plan */}
            <motion.div {...fadeUp()}>
              <div className="flex h-full flex-col rounded-3xl border border-border bg-card/60 p-6 transition-colors duration-300 hover:bg-card md:p-8 xl:p-6">
                {/* Same height as the paid plans' badge row, so the names line up. */}
                <div aria-hidden className="h-4" />
                <h3 className={cn("mt-3", planLabel)}>{t("Free", "Gratuit")}</h3>
                <Price minor={0} lang={lang} />
                <p className="type-body-sm mt-3 text-muted-foreground">
                  {t("Talk to us, no commitment", "Vorbește cu noi, fără obligații")}
                </p>

                <div aria-hidden className="mt-6 h-px bg-border" />
                <p className={cn("mt-6", featuresLabel)}>{t("Features", "Beneficii")}</p>
                <ul className="mt-4 flex-1 space-y-3.5">
                  <FeatureItem>
                    {t("A conversation with our team", "O conversație cu echipa noastră")}
                  </FeatureItem>
                  <FeatureItem>
                    {t(
                      "Build a plan for your future business",
                      "Construiește un plan pentru viitoarea ta afacere",
                    )}
                  </FeatureItem>
                  <FeatureItem>
                    {t("Clear, practical advice", "Sfaturi clare și practice")}
                  </FeatureItem>
                </ul>

                <RingButton
                  to="/contact"
                  variant="outline"
                  className="mt-7 w-full hover:scale-100"
                  innerClassName="h-12 w-full py-0"
                >
                  {t("Talk to us", "Vorbește cu noi")}
                </RingButton>
              </div>
            </motion.div>

            {/* Paid plans */}
            {paidPlans.map((plan, i) => (
              <motion.div
                key={plan.id}
                {...fadeUp((i + 1) * 0.1)}
                className={cn(plan.highlight && "xl:-my-4")}
              >
                {/* The highlighted plan: a plain violet 1px border, no glow. */}
                <div className="h-full">
                  <div
                    className={cn(
                      "flex h-full flex-col rounded-3xl border p-6 transition-colors duration-300 md:p-8 xl:p-6",
                      plan.highlight
                        ? "border-[rgb(139_124_246/0.6)] bg-card xl:py-10"
                        : "border-border bg-card/60 hover:bg-card",
                    )}
                  >
                    {plan.highlight ? (
                      <p className="type-label h-4 text-[#c4b5fd]">
                        {t("Most popular", "Cel mai popular")}
                      </p>
                    ) : (
                      <div aria-hidden className="h-4" />
                    )}
                    <h3 className={cn("mt-3", planLabel)}>{plan.name}</h3>
                    <Price
                      minor={PLAN_PRICING[plan.id][currency]}
                      lang={lang}
                      period={t("/ month", "/ lună")}
                    />
                    <p className="type-body-sm mt-3 text-muted-foreground">{plan.tagline}</p>

                    <div aria-hidden className="mt-6 h-px bg-border" />
                    <p className={cn("mt-6", featuresLabel)}>{t("Features", "Beneficii")}</p>
                    <ul className="mt-4 flex-1 space-y-3.5">
                      {plan.features.map((f) => (
                        <FeatureItem key={f}>{f}</FeatureItem>
                      ))}
                    </ul>

                    <Button
                      variant="ghost"
                      className="group relative mt-7 h-12 w-full rounded-full p-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 active:translate-y-0"
                      disabled={loadingPlan !== null}
                      aria-busy={loadingPlan === plan.id}
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      <span
                        aria-hidden
                        className="accent-gradient-animated pointer-events-none absolute -inset-[2px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                      />
                      <span
                        className={cn(
                          "type-button relative z-10 inline-flex h-full w-full items-center justify-center rounded-full transition-colors duration-300",
                          plan.highlight ? checkoutFace.solid : checkoutFace.outline,
                        )}
                      >
                        {loadingPlan === plan.id ? (
                          <>
                            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                            {/* Keeps the button's accessible name while the spinner shows. */}
                            <span className="sr-only">{t("Get started", "Începe acum")}</span>
                          </>
                        ) : (
                          t("Get started", "Începe acum")
                        )}
                      </span>
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="type-micro mt-12 text-center text-muted-foreground">
            {t(
              "Secure payment handled by Stripe. You can cancel your subscription at any time.",
              "Plată securizată prin Stripe. Poți anula abonamentul în orice moment.",
            )}
          </p>
        </div>
      </MotionConfig>
    </section>
  );
}

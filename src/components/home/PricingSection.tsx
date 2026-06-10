import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, MessageCircle, Sparkles, Rocket, Crown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { GlowCard } from "@/components/cinematic/GlowCard";
import { Reveal } from "@/components/cinematic/Reveal";
import { Magnetic } from "@/components/cinematic/Magnetic";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/i18n";
import { createCheckoutSession } from "@/lib/checkout.functions";
import { PLAN_PRICING, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

function formatPrice(minor: number, lang: "en" | "ro") {
  const major = minor / 100;
  return lang === "ro" ? `${major} LEI` : `${major} EUR`;
}

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
    icon: typeof Sparkles;
    name: string;
    tagline: string;
    features: string[];
    highlight?: boolean;
  }[] = [
    {
      id: "starter",
      icon: Sparkles,
      name: t("Starter", "Starter"),
      tagline: t(
        "A focused first step into working with us.",
        "Un prim pas concentrat în colaborarea cu noi.",
      ),
      features: [
        t("30 minutes of live Zoom consultation each month", "30 de minute de consultanță live pe Zoom în fiecare lună"),
        t("1 month access to our AI tools", "1 lună de acces la instrumentele noastre AI"),
        t("Personalised next-step recommendations", "Recomandări personalizate pentru următorul pas"),
        t("Email support during your subscription", "Suport prin email pe durata abonamentului"),
      ],
    },
    {
      id: "growth",
      icon: Rocket,
      name: t("Growth", "Growth"),
      tagline: t(
        "For people actively building momentum.",
        "Pentru cei care construiesc activ avânt.",
      ),
      highlight: true,
      features: [
        t("2 hours of live Zoom consultation", "2 ore de consultanță live pe Zoom"),
        t("Expanded access to our AIs and programs", "Acces extins la AI-urile și programele noastre"),
        t("Priority scheduling for sessions", "Programare prioritară a sesiunilor"),
        t("Guided setup of your digital workflow", "Configurare ghidată a fluxului tău digital"),
        t("Priority email support", "Suport prin email prioritar"),
      ],
    },
    {
      id: "pro",
      icon: Crown,
      name: t("Pro", "Pro"),
      tagline: t(
        "Everything we offer, with us beside you.",
        "Tot ce oferim, cu noi alături de tine.",
      ),
      features: [
        t("Full access to our complete program", "Acces complet la întregul nostru program"),
        t("Unlimited live support from our team", "Suport live nelimitat din partea echipei noastre"),
        t("Unlimited access to all AI tools", "Acces nelimitat la toate instrumentele AI"),
        t("Hands-on help with your projects", "Ajutor practic pentru proiectele tale"),
        t("Direct priority line to us", "Linie directă prioritară către noi"),
      ],
    },
  ];

  return (
    <section id="pricing" className="relative overflow-hidden scroll-mt-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-aurora opacity-20" />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow={t("Plans & pricing", "Planuri și prețuri")}
            title={t("Choose the level of support that fits you.", "Alege nivelul de sprijin potrivit pentru tine.")}
            description={t(
              "Start a conversation for free, or subscribe monthly for consultations, AI access and hands-on help. Prices renew monthly and you can cancel anytime.",
              "Începe o conversație gratuit sau abonează-te lunar pentru consultanță, acces la AI și ajutor practic. Prețurile se reînnoiesc lunar și poți renunța oricând.",
            )}
          />
        </Reveal>

        {error && (
          <p className="mx-auto mt-6 max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-14 grid gap-6 lg:grid-cols-4">
          {/* Free plan */}
          <Reveal>
            <GlowCard className="h-full">
              <div className="flex h-full flex-col p-7">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl">{t("Free", "Gratuit")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("Talk to us and shape your direction.", "Vorbește cu noi și conturează-ți direcția.")}
                </p>
                <div className="mt-5">
                  <span className="text-3xl font-semibold">{formatPrice(0, lang)}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {[
                    t("A conversation with our team", "O conversație cu echipa noastră"),
                    t("Build a plan for your future business", "Construiește un plan pentru viitoarea ta afacere"),
                    t("Clear, practical advice — no commitment", "Sfaturi clare și practice — fără obligații"),
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="mt-7 w-full border-border glass-panel">
                  <Link to="/contact">{t("Talk to us", "Vorbește cu noi")}</Link>
                </Button>
              </div>
            </GlowCard>
          </Reveal>

          {/* Paid plans */}
          {paidPlans.map((plan, i) => (
            <Reveal key={plan.id} delay={(i + 1) * 0.08}>
              <GlowCard
                className={cn(
                  "h-full",
                  plan.highlight && "border-primary/50 glow-soft",
                )}
              >
                <div className="flex h-full flex-col p-7">
                  {plan.highlight && (
                    <span className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      {t("Most popular", "Cel mai popular")}
                    </span>
                  )}
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary">
                    <plan.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-xl">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold">
                      {formatPrice(PLAN_PRICING[plan.id][currency], lang)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t("/ month", "/ lună")}
                    </span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Magnetic className="mt-7 w-full">
                    <Button
                      className={cn("w-full", plan.highlight && "glow-soft")}
                      variant={plan.highlight ? "default" : "outline"}
                      disabled={loadingPlan !== null}
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      {loadingPlan === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t("Subscribe", "Abonează-te")
                      )}
                    </Button>
                  </Magnetic>
                </div>
              </GlowCard>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {t(
            "Secure payment handled by Stripe. You can cancel your subscription at any time.",
            "Plată securizată prin Stripe. Poți anula abonamentul în orice moment.",
          )}
        </p>
      </div>
    </section>
  );
}

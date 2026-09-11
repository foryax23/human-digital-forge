import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, MessageCircle, Sparkles, Rocket, Crown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/cinematic/Reveal";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/i18n";
import { createCheckoutSession } from "@/lib/checkout.functions";
import { PLAN_PRICING, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

function formatPrice(minor: number, lang: "en" | "ro") {
  const major = minor / 100;
  return lang === "ro" ? `${major} LEI` : `${major} EUR`;
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal/20 text-teal">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="text-sm text-muted-foreground">{children}</span>
    </li>
  );
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
      tagline: t("For up to 1 focused goal", "Pentru până la 1 obiectiv concentrat"),
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
      tagline: t("For people building momentum", "Pentru cei care construiesc avânt"),
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
      tagline: t("For full, hands-on partnership", "Pentru un parteneriat complet, implicat"),
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
            title={t("Choose your plan", "Alege-ți planul")}
            description={t(
              "Our plans are designed to be affordable, flexible and tailored to your goals. Start free, or subscribe monthly and cancel anytime.",
              "Planurile noastre sunt accesibile, flexibile și adaptate obiectivelor tale. Începe gratuit sau abonează-te lunar și anulează oricând.",
            )}
          />
        </Reveal>

        {error && (
          <p className="mx-auto mt-6 max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-16 grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Free plan */}
          <Reveal>
            <div className="flex h-full flex-col rounded-sm border border-border bg-card/60 p-7 backdrop-blur-sm">
              <span className="grid h-11 w-11 place-items-center rounded-sm bg-muted text-muted-foreground">
                <MessageCircle className="h-5 w-5" />
              </span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("Free", "Gratuit")}
              </p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight">{formatPrice(0, lang)}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {t("Talk to us, no commitment", "Vorbește cu noi, fără obligații")}
              </p>

              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/80">
                {t("Features", "Beneficii")}
              </p>
              <ul className="mt-4 flex-1 space-y-3.5">
                <FeatureItem>{t("A conversation with our team", "O conversație cu echipa noastră")}</FeatureItem>
                <FeatureItem>{t("Build a plan for your future business", "Construiește un plan pentru viitoarea ta afacere")}</FeatureItem>
                <FeatureItem>{t("Clear, practical advice", "Sfaturi clare și practice")}</FeatureItem>
              </ul>

              <Button asChild variant="outline" className="mt-7 h-12 w-full rounded-sm border-border">
                <Link to="/contact">{t("Talk to us", "Vorbește cu noi")}</Link>
              </Button>
            </div>
          </Reveal>

          {/* Paid plans */}
          {paidPlans.map((plan, i) => (
            <Reveal key={plan.id} delay={(i + 1) * 0.08}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-sm border p-7 backdrop-blur-sm",
                  plan.highlight
                    ? "border-primary/60 bg-card glow-soft lg:-my-6 lg:py-12"
                    : "border-border bg-card/60",
                )}
              >
                {plan.highlight && (
                  <span className="absolute right-6 top-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    {t("Most popular", "Cel mai popular")}
                  </span>
                )}
                <span
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-sm",
                    plan.highlight
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/15 text-primary",
                  )}
                >
                  <plan.icon className="h-5 w-5" />
                </span>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {plan.name}
                </p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight sm:text-5xl">
                    {formatPrice(PLAN_PRICING[plan.id][currency], lang)}
                  </span>
                  <span className="pb-1 text-xs text-muted-foreground">
                    {t("/ month", "/ lună")}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{plan.tagline}</p>

                <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/80">
                  {t("Features", "Beneficii")}
                </p>
                <ul className="mt-4 flex-1 space-y-3.5">
                  {plan.features.map((f) => (
                    <FeatureItem key={f}>{f}</FeatureItem>
                  ))}
                </ul>

                <Button
                  className={cn(
                    "mt-7 h-12 w-full rounded-sm",
                    plan.highlight
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "",
                  )}
                  variant={plan.highlight ? "default" : "outline"}
                  disabled={loadingPlan !== null}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("Get started", "Începe acum")
                  )}
                </Button>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          {t(
            "Secure payment handled by Stripe. You can cancel your subscription at any time.",
            "Plată securizată prin Stripe. Poți anula abonamentul în orice moment.",
          )}
        </p>
      </div>
    </section>
  );
}

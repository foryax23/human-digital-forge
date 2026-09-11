import { Bot, Check, Globe, Zap, BarChart3, CheckCircle2 } from "lucide-react";

import { useI18n } from "@/i18n";

/**
 * The layered product showcase sitting on the right of the hero: a browser
 * mockup with two floating cards in front of it. Pure markup — no screenshots.
 */
export function HeroShowcase() {
  const { t } = useI18n();

  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      {/* soft brand glow behind the stack */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-primary/25 blur-[90px]"
      />

      {/* Browser window */}
      <div className="relative rounded-md border border-[oklch(1_0_0/12%)] bg-[oklch(0.16_0.02_268)] shadow-[0_30px_80px_-30px_oklch(0.2_0.15_277/60%)]">
        <div className="flex items-center gap-2 border-b border-[oklch(1_0_0/10%)] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.7_0.16_25)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.82_0.14_90)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.75_0.16_150)]" />
          <div className="ml-auto flex items-center gap-4 text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
            <span>{t("Solutions", "Soluții")}</span>
            <span className="hidden sm:inline">{t("About", "Despre noi")}</span>
            <span className="hidden sm:inline">{t("Portfolio", "Portofoliu")}</span>
            <span className="rounded-sm border border-primary/60 px-2 py-1 text-primary">
              {t("Let's talk", "Hai să discutăm")}
            </span>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[1.05fr_1fr] sm:p-6">
          <div>
            <div className="font-sans text-xl font-bold leading-tight tracking-tight sm:text-2xl">
              {t("Stronger brands", "Branduri")}
              <br />
              {t("through ", "mai puternice prin ")}
              <span className="text-primary">{t("technology.", "tehnologie.")}</span>
            </div>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-muted-foreground">
              {t(
                "Websites. AI automation. Real results.",
                "Site-uri web. Automatizări AI. Rezultate reale.",
              )}
            </p>
            <span className="mt-4 inline-flex items-center rounded-sm bg-primary px-3 py-1.5 text-[0.65rem] font-semibold text-primary-foreground">
              {t("Learn more", "Află mai multe")}
            </span>
          </div>
          <div className="relative min-h-28 overflow-hidden rounded-sm border border-[oklch(1_0_0/10%)] bg-[oklch(0.22_0.06_285)]">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(120%_100%_at_20%_100%,oklch(0.45_0.2_290/70%),transparent_70%)]"
            />
            <div className="absolute bottom-3 right-3 space-y-1 text-right text-[0.55rem] uppercase tracking-[0.2em] text-[oklch(0.9_0.02_280)]">
              <div>{t("Ideas", "Idei")}</div>
              <div>{t("Systems", "Sisteme")}</div>
              <div>{t("Results", "Rezultate")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating card — website */}
      <div className="absolute -bottom-16 -left-4 hidden w-56 rounded-md border border-[oklch(1_0_0/12%)] bg-[oklch(0.19_0.02_268)] p-4 shadow-[0_20px_50px_-20px_oklch(0.1_0.05_277/80%)] sm:block">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="font-sans text-xs font-semibold">
            {t("Modern website", "Website modern")}
          </span>
        </div>
        <ul className="mt-3 space-y-2 text-[0.65rem] text-muted-foreground">
          {[
            t("Custom design", "Design personalizat"),
            t("Performance tuned", "Optimizat pentru performanță"),
            t("Ready to grow", "Pregătit pentru creștere"),
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="h-3 w-3 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Floating card — automation flow (light) */}
      <div className="absolute -bottom-24 left-1/2 w-60 -translate-x-1/2 rounded-md border border-black/5 bg-[oklch(0.98_0.005_280)] p-4 text-[oklch(0.2_0.02_268)] shadow-[0_30px_60px_-20px_oklch(0.1_0.05_277/85%)]">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="font-sans text-xs font-semibold">
            {t("AI automation", "Automatizare AI")}
          </span>
        </div>
        <ol className="mt-3 space-y-3">
          {[
            {
              icon: <Zap className="h-3.5 w-3.5" />,
              title: t("Trigger", "Trigger"),
              sub: t("New form submitted", "Formular nou completat"),
              tone: "bg-primary",
            },
            {
              icon: <Bot className="h-3.5 w-3.5" />,
              title: t("AI processes", "AI Procesează"),
              sub: t("Analysis and routing", "Analiză și clasificare"),
              tone: "bg-[oklch(0.55_0.15_255)]",
            },
            {
              icon: <Check className="h-3.5 w-3.5" />,
              title: t("Action", "Acțiune"),
              sub: t("Auto reply + alert", "Răspuns automat + notificare"),
              tone: "bg-[oklch(0.62_0.16_150)]",
            },
          ].map((step) => (
            <li key={step.title} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-sm text-white ${step.tone}`}
              >
                {step.icon}
              </span>
              <span>
                <span className="block text-[0.68rem] font-semibold">{step.title}</span>
                <span className="block text-[0.58rem] text-[oklch(0.45_0.02_268)]">{step.sub}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Floating card — results */}
      <div className="absolute -bottom-14 -right-2 hidden w-52 rounded-md border border-[oklch(1_0_0/12%)] bg-[oklch(0.19_0.02_268)] p-4 shadow-[0_20px_50px_-20px_oklch(0.1_0.05_277/80%)] lg:block">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-teal" />
          <span className="font-sans text-xs font-semibold">
            {t("Real results", "Rezultate reale")}
          </span>
        </div>
        <ul className="mt-3 space-y-2 text-[0.65rem] text-muted-foreground">
          {[
            t("More time for what matters", "Mai mult timp pentru ce contează"),
            t("Simpler processes", "Procese mai simple"),
            t("Happier clients", "Clienți mai mulțumiți"),
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-teal" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { Link } from "@tanstack/react-router";

import { LanguageToggle } from "./LanguageToggle";
import { useI18n } from "@/i18n";

const footerNav = [
  { en: "Services", ro: "Servicii", to: "/services" },
  { en: "Websites", ro: "Site-uri web", to: "/websites" },
  { en: "AI Automation", ro: "Automatizare AI", to: "/ai-automation" },
  { en: "Consultancy", ro: "Consultanță", to: "/consultancy" },
  { en: "Portfolio", ro: "Portofoliu", to: "/portfolio" },
  { en: "Contact", ro: "Contact", to: "/contact" },
  { en: "Login", ro: "Autentificare", to: "/login" },
] as const;

const legalNav = [
  { en: "Privacy Policy", ro: "Politica de confidențialitate", to: "/privacy" },
  { en: "Terms and Conditions", ro: "Termeni și condiții", to: "/terms" },
] as const;

export function SiteFooter() {
  const { t, lang } = useI18n();

  return (
    <footer className="bg-ink text-ink-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2 max-w-sm">
            <span className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-gradient-brand text-sm font-semibold text-primary-foreground">
                V
              </span>
              <span className="font-serif text-xl">Vortex Hub</span>
            </span>
            <p className="mt-4 text-sm text-ink-foreground/70">
              {t(
                "Digital products, websites and AI consultancy for individuals and businesses.",
                "Produse digitale, site-uri web și consultanță AI pentru persoane și companii.",
              )}
            </p>
            <a
              href="mailto:hello@vortexhub.ro"
              className="mt-4 inline-block text-sm text-ink-foreground/90 underline-offset-4 hover:underline"
            >
              hello@vortexhub.ro
            </a>
          </div>

          <div>
            <h2 className="font-serif text-base text-ink-foreground">{t("Explore", "Explorează")}</h2>
            <ul className="mt-4 space-y-2">
              {footerNav.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-ink-foreground/70 transition-colors hover:text-ink-foreground"
                  >
                    {lang === "ro" ? item.ro : item.en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-base text-ink-foreground">{t("Legal", "Legal")}</h2>
            <ul className="mt-4 space-y-2">
              {legalNav.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-ink-foreground/70 transition-colors hover:text-ink-foreground"
                  >
                    {lang === "ro" ? item.ro : item.en}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/cookies"
                  className="text-sm text-ink-foreground/70 transition-colors hover:text-ink-foreground"
                >
                  {t("Cookie Policy", "Politica de cookie-uri")}
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={openCookieSettings}
                  className="text-left text-sm text-ink-foreground/70 transition-colors hover:text-ink-foreground"
                >
                  {t("Cookie settings", "Setări cookie-uri")}
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-ink-foreground/15 pt-6 sm:flex-row sm:items-center">
          <p className="text-sm text-ink-foreground/60">{t("© Vortex Hub. All rights reserved.", "© Vortex Hub. Toate drepturile rezervate.")}</p>
          <LanguageToggle className="border-ink-foreground/25" />
        </div>
      </div>
    </footer>
  );
}

import { Link } from "@tanstack/react-router";

import { LanguageToggle } from "./LanguageToggle";

const footerNav = [
  { label: "Services", to: "/services" },
  { label: "Websites", to: "/websites" },
  { label: "AI Automation", to: "/ai-automation" },
  { label: "Consultancy", to: "/consultancy" },
  { label: "Portfolio", to: "/portfolio" },
  { label: "Contact", to: "/contact" },
  { label: "Login", to: "/login" },
] as const;

const legalNav = [
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms and Conditions", to: "/terms" },
] as const;

export function SiteFooter() {
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
              Digital products, websites and AI consultancy for individuals and businesses.
            </p>
            <a
              href="mailto:hello@vortexhub.ro"
              className="mt-4 inline-block text-sm text-ink-foreground/90 underline-offset-4 hover:underline"
            >
              hello@vortexhub.ro
            </a>
          </div>

          <div>
            <h2 className="font-serif text-base text-ink-foreground">Explore</h2>
            <ul className="mt-4 space-y-2">
              {footerNav.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-ink-foreground/70 transition-colors hover:text-ink-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-base text-ink-foreground">Legal</h2>
            <ul className="mt-4 space-y-2">
              {legalNav.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-ink-foreground/70 transition-colors hover:text-ink-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <span className="text-sm text-ink-foreground/70">Cookie Policy</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-ink-foreground/15 pt-6 sm:flex-row sm:items-center">
          <p className="text-sm text-ink-foreground/60">© Vortex Hub. All rights reserved.</p>
          <LanguageToggle className="border-ink-foreground/25" />
        </div>
      </div>
    </footer>
  );
}

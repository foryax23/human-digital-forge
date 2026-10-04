import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { LOGO_NAV } from "@/components/landing/media";
import { FOCUS_RING } from "@/components/system/tone";
import { MAIN_ID } from "@/components/system/skip-link";
import { useI18n } from "@/i18n";
import { COMPANY_LINE } from "@/lib/scan/legal/company";
import { cn } from "@/lib/utils";
import { LanguageSwitch } from "./LanguageToggle";

/** The wordmark as a link home (the same file as the nav's, no hover effect). */
function HomeMark({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Link to="/" className={cn("inline-flex self-start rounded-md", FOCUS_RING, className)}>
      <picture className="contents">
        <source type="image/webp" srcSet={LOGO_NAV.webp} />
        <img
          src={LOGO_NAV.png}
          alt="Vortex Hub"
          width={LOGO_NAV.width}
          height={LOGO_NAV.height}
          decoding="async"
          className="block h-8 w-auto"
        />
      </picture>
      <span className="sr-only">{t(", home page", ", pagina principală")}</span>
    </Link>
  );
}

/**
 * Login, sign-up and password pages: the night brand panel on the left from lg up, the
 * form on the light working surface (the same one the client area uses).
 */
export function AuthLayout({
  heading,
  intro,
  children,
  footer,
}: {
  heading: string;
  intro: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* The brand panel (from lg up): a quiet aside, so the page's only heading is the h1. */}
      <aside
        aria-label="Vortex Hub"
        className="cinematic hidden flex-col justify-between border-r border-line-1 p-12 lg:flex"
      >
        <HomeMark />
        <div>
          <p className="type-h2 max-w-md text-balance text-fg">
            {t("Your projects in one place.", "Proiectele tale, într-un singur loc.")}
          </p>
          <p className="type-lead mt-3 max-w-md text-pretty text-fg-2">
            {t(
              "Send requests, follow the progress and receive the finished work securely.",
              "Trimite cereri, urmărește progresul și primește lucrările finalizate în siguranță.",
            )}
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs text-fg-3">
          <p>{COMPANY_LINE}</p>
          <LanguageSwitch />
        </div>
      </aside>

      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <header className="mb-8 flex items-center justify-between gap-4 lg:hidden">
            <HomeMark />
            <LanguageSwitch />
          </header>
          <main id={MAIN_ID} tabIndex={-1}>
            <h1 className="type-title text-fg">{heading}</h1>
            <p className="type-body mt-2 text-fg-2">{intro}</p>
            <div className="mt-8">{children}</div>
            <div className="type-body-sm mt-6 text-fg-2">{footer}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

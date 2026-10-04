import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/components/auth/AuthProvider";
import {
  DEFAULT_LANGUAGE,
  LOCALE,
  LanguageProvider,
  SITE_SEO,
  languageFromMatches,
  pick,
  seoMeta,
} from "@/i18n";
import { getRequestLanguage } from "@/i18n/request-language";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/cookies/CookieConsent";

/** The language the root loader chose, readable outside LanguageProvider (error and 404 views). */
function useRootLanguage() {
  return useRouterState({ select: (state) => languageFromMatches(state.matches) });
}

function NotFoundComponent() {
  const lang = useRootLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {pick(lang, "Page not found", "Pagina nu a fost găsită")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {pick(
            lang,
            "The page you're looking for doesn't exist or has been moved.",
            "Pagina pe care o cauți nu există sau a fost mutată.",
          )}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {pick(lang, "Go home", "Pagina principală")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const lang = useRootLanguage();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {pick(lang, "This page didn't load", "Pagina nu s-a încărcat")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {pick(
            lang,
            "Something went wrong on our end. You can try refreshing or head back home.",
            "Ceva nu a mers bine la noi. Poți reîncerca sau te poți întoarce la pagina principală.",
          )}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {pick(lang, "Try again", "Încearcă din nou")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {pick(lang, "Go home", "Pagina principală")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Romanian first: the visitor's saved choice (cookie), else Romanian. The server renders in
  // that language and the value reaches the browser with the SSR payload, so hydration matches.
  loader: () => ({ lang: getRequestLanguage() }),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Title, description, og:title/description/locale. A page's own head (src/i18n/seo.ts)
      // overrides these; X/Twitter falls back to the og: tags.
      ...seoMeta(loaderData?.lang ?? DEFAULT_LANGUAGE, SITE_SEO),
      { name: "author", content: "Vortex Hub" },
      { property: "og:site_name", content: "Vortex Hub" },
      { property: "og:type", content: "website" },
      // The 1200x630 social card below needs the large card (`summary` crops it to a square).
      { name: "twitter:card", content: "summary_large_image" },
      // Social card: the wordmark on the brand glow (scripts/brand/build-media.sh). Crawlers
      // need an absolute URL.
      { property: "og:image", content: "https://vortexhub.dev/og-image.jpg" },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Vortex Hub" },
      { name: "twitter:image", content: "https://vortexhub.dev/og-image.jpg" },
      { name: "twitter:image:alt", content: "Vortex Hub" },
    ],
    links: [
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },

      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const lang = useRootLanguage();
  return (
    <html lang={LOCALE[lang].html}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { lang } = Route.useLoaderData();

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider initialLang={lang}>
        <AuthProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <CookieConsent />
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import { IntroProvider } from "@/components/landing/intro";
import { INTRO_HEAD_SCRIPT } from "@/components/landing/intro-script";
import { LoadingScreen } from "@/components/landing/LoadingScreen";
import { MotionPauseProvider } from "@/components/landing/motion-pause";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { TechBand } from "@/components/landing/TechStack";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { FilmsSection } from "@/components/landing/FilmsSection";
import { ProcessSection } from "@/components/landing/ProcessSection";
import { ConsultationSection } from "@/components/home/ConsultationSection";
import { PricingSection } from "@/components/home/PricingSection";
import { ContactFooter } from "@/components/landing/ContactFooter";
import { MAIN_ID } from "@/components/system/skip-link";
import { languageFromMatches, pageMeta } from "@/i18n";
import { canonicalLink, jsonLdScript, organizationJsonLd } from "@/i18n/seo";

export const Route = createFileRoute("/")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/"),
    links: [
      canonicalLink("/"),
      { rel: "preload", as: "image", href: "/media/swirl-loop/poster.jpg" },
    ],
    scripts: [
      // Decides before first paint whether the intro loader plays (see intro.tsx).
      { children: INTRO_HEAD_SCRIPT },
      // The company, its service in Timișoara and the website (src/i18n/seo.ts).
      jsonLdScript(organizationJsonLd(languageFromMatches(matches))),
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="cinematic min-h-screen bg-background text-foreground">
      <MotionPauseProvider>
        <IntroProvider renderLoader={(props) => <LoadingScreen key="intro-loader" {...props} />}>
          <LandingNav />
          <main id={MAIN_ID} tabIndex={-1}>
            <HeroSection />
            <TechBand />
            <ServicesSection />
            {/* The two silent Romanian promo films (Vortex Scan, Deep Research). */}
            <FilmsSection />
            {/* No projects section: the work lives on /portfolio (hero proof, nav, footer). */}
            <ProcessSection />
            <ConsultationSection />
            <PricingSection />
          </main>
          <ContactFooter />
        </IntroProvider>
      </MotionPauseProvider>
    </div>
  );
}

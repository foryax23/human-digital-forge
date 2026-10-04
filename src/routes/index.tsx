import { createFileRoute } from "@tanstack/react-router";

import { IntroProvider } from "@/components/landing/intro";
import { INTRO_HEAD_SCRIPT } from "@/components/landing/intro-script";
import { LoadingScreen } from "@/components/landing/LoadingScreen";
import { MotionPauseProvider } from "@/components/landing/motion-pause";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { TechBand } from "@/components/landing/TechStack";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { ProcessSection } from "@/components/landing/ProcessSection";
import { ConsultationSection } from "@/components/home/ConsultationSection";
import { PricingSection } from "@/components/home/PricingSection";
import { ContactFooter } from "@/components/landing/ContactFooter";
import { SITE_SEO, languageFromMatches, pageMeta } from "@/i18n";

export const Route = createFileRoute("/")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/"),
    links: [
      { rel: "canonical", href: "/" },
      { rel: "preload", as: "image", href: "/media/swirl-loop/poster.jpg" },
    ],
    scripts: [
      // Decides before first paint whether the intro loader plays (see intro.tsx).
      { children: INTRO_HEAD_SCRIPT },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Vortex Hub",
          description: SITE_SEO.description[languageFromMatches(matches)],
          email: "hello@vortexhub.ro",
        }),
      },
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
          <main>
            <HeroSection />
            <TechBand />
            <ServicesSection />
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

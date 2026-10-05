import { createFileRoute } from "@tanstack/react-router";

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
      { rel: "preload", as: "image", href: "/media/swirl-loop/poster.webp", imageSrcSet: "/media/swirl-loop/poster-720.webp 720w, /media/swirl-loop/poster.webp 1280w", imageSizes: "100vw", fetchPriority: "high" } as never,
    ],
    scripts: [
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
        <LandingNav />
        <main id={MAIN_ID} tabIndex={-1}>
          <HeroSection />
          <TechBand />
          <ServicesSection />
          {/* The three Romanian promo films (Vortex Scan, Deep Research, AI assistant), with music, muted by default. */}
          <FilmsSection />
          {/* No projects section: the work lives on /portfolio (hero proof, nav, footer). */}
          <ProcessSection />
          <ConsultationSection />
          <PricingSection />
        </main>
        <ContactFooter />
      </MotionPauseProvider>
    </div>
  );
}

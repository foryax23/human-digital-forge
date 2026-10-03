import { createFileRoute } from "@tanstack/react-router";

import { IntroProvider } from "@/components/landing/intro";
import { INTRO_HEAD_SCRIPT } from "@/components/landing/intro-script";
import { LoadingScreen } from "@/components/landing/LoadingScreen";
import { MotionPauseProvider } from "@/components/landing/motion-pause";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { WorkSection } from "@/components/landing/WorkSection";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { ProcessSection } from "@/components/landing/ProcessSection";
import { ExplorationsSection } from "@/components/landing/ExplorationsSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { ConsultationSection } from "@/components/home/ConsultationSection";
import { PricingSection } from "@/components/home/PricingSection";
import { ContactFooter } from "@/components/landing/ContactFooter";

const title = "Vortex Hub | Digital Products, Websites and AI Consultancy";
const description =
  "Vortex Hub provides digital design, websites, AI automation and practical consultancy for individuals and businesses.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      { rel: "preload", as: "image", href: "/media/swirl-loop/poster.jpg" },
      { rel: "preconnect", href: "https://images.unsplash.com" },
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
          description,
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
            <WorkSection />
            <ServicesSection />
            <ProcessSection />
            <ExplorationsSection />
            <StatsSection />
            <ConsultationSection />
            <PricingSection />
          </main>
          <ContactFooter />
        </IntroProvider>
      </MotionPauseProvider>
    </div>
  );
}

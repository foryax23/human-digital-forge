import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { HeroStage } from "@/components/home/HeroStage";

import { ServicesIntro } from "@/components/home/ServicesIntro";
import { AudienceSection } from "@/components/home/AudienceSection";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { AISpotlight } from "@/components/home/AISpotlight";
import { PortfolioPreview } from "@/components/home/PortfolioPreview";
import { PricingSection } from "@/components/home/PricingSection";
import { ConsultationSection } from "@/components/home/ConsultationSection";
import { TrustSection } from "@/components/home/TrustSection";
import { FinalCTA } from "@/components/home/FinalCTA";
import { CustomCursor } from "@/components/cinematic/CustomCursor";
import { SectionTransition } from "@/components/cinematic/SectionTransition";

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
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
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
    <div className="cinematic cinematic-flow">
      <CustomCursor />
      <SiteLayout>
        <HeroStage />
        <SectionTransition tone="indigo" />
        <ServicesIntro />
        <SectionTransition tone="teal" />
        <AudienceSection />
        <SectionTransition tone="indigo" />
        <ProcessSteps />
        <AISpotlight />
        <SectionTransition tone="teal" />
        <PortfolioPreview />
        <SectionTransition tone="indigo" />
        <ConsultationSection />
        <SectionTransition tone="indigo" />
        <PricingSection />
        <SectionTransition tone="teal" />

        <TrustSection />
        <FinalCTA />
      </SiteLayout>
    </div>
  );
}

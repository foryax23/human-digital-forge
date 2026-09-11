import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { HeroStage } from "@/components/home/HeroStage";
import { TrustMarquee } from "@/components/home/TrustMarquee";
import { ServicesIntro } from "@/components/home/ServicesIntro";
import { AudienceSection } from "@/components/home/AudienceSection";
import { AISpotlight } from "@/components/home/AISpotlight";
import { PortfolioPreview } from "@/components/home/PortfolioPreview";
import { PricingSection } from "@/components/home/PricingSection";
import { ConsultationSection } from "@/components/home/ConsultationSection";
import { TrustSection } from "@/components/home/TrustSection";
import { FinalCTA } from "@/components/home/FinalCTA";
import { AuditTeaser } from "@/components/home/AuditTeaser";
import { HomeFaq } from "@/components/home/HomeFaq";
import { Band } from "@/components/site/Band";
import { BeforeAfter } from "@/components/site/BeforeAfter";
import { StageRail } from "@/components/site/StageRail";
import { ProofWall } from "@/components/site/ProofWall";
import { StickyCta } from "@/components/site/StickyCta";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/cinematic/Reveal";
import { CustomCursor } from "@/components/cinematic/CustomCursor";
import { SectionTransition } from "@/components/cinematic/SectionTransition";
import { useI18n } from "@/i18n";

const title = "Vortex Hub | Business Infrastructure, Websites and AI Automation";
const description =
  "Vortex Hub designs, builds and operates the digital infrastructure businesses run on: websites, internal systems, connected data and supervised AI automation.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const { t } = useI18n();

  return (
    <div>
      <CustomCursor />
      <SiteLayout>
        <HeroStage />
        <TrustMarquee />

        <SectionTransition tone="indigo" />

        {/* The problem, stated plainly */}
        <Band tone="light">
          <Reveal>
            <SectionHeading
              
              eyebrow={t("The real problem", "Problema reală")}
              title={t(
                "Most businesses don't have a growth problem. They have an infrastructure problem.",
                "Majoritatea afacerilor nu au o problemă de creștere. Au o problemă de infrastructură.",
              )}
              description={t(
                "When the systems are missing, the team becomes the software — and every extra client costs more time than the last one.",
                "Când sistemele lipsesc, echipa devine software-ul — iar fiecare client nou costă mai mult timp decât cel anterior.",
              )}
            />
          </Reveal>
          <div className="mt-16">
            <BeforeAfter />
          </div>
        </Band>

        <SectionTransition tone="teal" />

        {/* How we work: the five stages */}
        <Band tone="dark">
          <Reveal>
            <SectionHeading
              eyebrow={t("How we work", "Cum lucrăm")}
              title={t(
                "Five stages from scattered tools to an operation that runs.",
                "Cinci etape de la tool-uri împrăștiate la o operațiune care merge.",
              )}
              description={t(
                "Every engagement follows the same path, so you always know what happens next and what it costs.",
                "Fiecare colaborare urmează același drum, ca să știi mereu ce urmează și cât costă.",
              )}
            />
          </Reveal>
          <div className="mt-16">
            <StageRail />
          </div>
        </Band>

        <ServicesIntro />

        <SectionTransition tone="indigo" />

        {/* Lead magnet */}
        <Band tone="ink">
          <AuditTeaser />
        </Band>

        <SectionTransition tone="teal" />

        <AudienceSection />
        <AISpotlight />

        <SectionTransition tone="teal" />

        {/* Results wall — explicit placeholders until real client work is approved */}
        <Band tone="light">
          <Reveal>
            <SectionHeading
              
              eyebrow={t("Results", "Rezultate")}
              title={t("Proof, published only when we can prove it.", "Dovezi, publicate doar când le putem demonstra.")}
              description={t(
                "These slots are reserved for real client outcomes. We would rather show you an honest empty wall than invented numbers.",
                "Aceste spații sunt rezervate rezultatelor reale ale clienților. Preferăm un perete sincer gol decât cifre inventate.",
              )}
            />
          </Reveal>
          <div className="mt-16">
            <ProofWall />
          </div>
        </Band>

        <SectionTransition tone="indigo" />

        <PortfolioPreview />
        <ConsultationSection />

        <SectionTransition tone="indigo" />

        <PricingSection />

        <SectionTransition tone="teal" />

        <TrustSection />

        {/* FAQ */}
        <Band tone="light">
          <HomeFaq />
        </Band>

        <FinalCTA />
      </SiteLayout>
      <StickyCta />
    </div>
  );
}

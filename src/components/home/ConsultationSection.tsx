import { Em, SectionHeader } from "@/components/landing/SectionHeader";
import { RingButton } from "@/components/landing/RingButton";
import FeaturesWithPanel, { type FeatureItem } from "@/components/ui/features-with-panel";
import { unsplash } from "@/components/landing/media";
import { useI18n } from "@/i18n";

/**
 * Consultation offer (#consultation): the three session types as a feature
 * panel, with the booking calls to action underneath.
 */
export function ConsultationSection() {
  const { t, lang } = useI18n();

  const sessions: FeatureItem[] = [
    {
      title: t("Digital Idea Consultation", "Consultanță pentru idei digitale"),
      description: t(
        "For individuals planning a digital product, personal website or creative project.",
        "Pentru persoane care planifică un produs digital, un site web personal sau un proiect creativ.",
      ),
      alt: t("Sketching wireframes on paper", "Schițe de wireframe pe hârtie"),
      ...unsplash("1581291518857-4e27b48ff24e"),
    },
    {
      title: t("Website Strategy Consultation", "Consultanță pentru strategia site-ului web"),
      description: t(
        "For clients requiring help with pages, features, branding and user journeys.",
        "Pentru clienți care au nevoie de ajutor cu paginile, funcționalitățile, brandingul și parcursurile utilizatorilor.",
      ),
      alt: t("Website wireframes on a tablet", "Wireframe-uri de site pe o tabletă"),
      ...unsplash("1586717791821-3f44a563fa4c"),
    },
    {
      title: t("AI Automation Assessment", "Evaluare Automatizare AI"),
      description: t(
        "For businesses wanting to identify tasks that could be improved through automation.",
        "Pentru afaceri care doresc să identifice sarcini ce ar putea fi îmbunătățite prin automatizare.",
      ),
      alt: t("Analytics dashboard on a laptop screen", "Panou de analiză pe ecranul unui laptop"),
      ...unsplash("1551288049-bebda4e38f71"),
    },
  ];

  return (
    <section
      id="consultation"
      aria-labelledby="consultation-heading"
      className="scroll-mt-24 bg-background py-16 md:py-24"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10 lg:px-16">
        <FeaturesWithPanel
          label={t("Consultation sessions", "Sesiuni de consultanță")}
          items={sessions}
          header={
            <SectionHeader
              headingId="consultation-heading"
              className="md:mb-10"
              eyebrow={t("Talk it through", "Hai să discutăm")}
              title={
                lang === "ro" ? (
                  <>
                    Încă nu ești sigur de ce ai <Em>nevoie</Em>?
                  </>
                ) : (
                  <>
                    Not sure what you <Em>need</Em> yet?
                  </>
                )
              }
              description={t(
                "Book a one-to-one conversation to discuss your idea, website, digital product or possible AI workflow. You will receive clear advice on the next practical step.",
                "Programează o discuție individuală despre ideea, site-ul, produsul digital sau posibilul flux AI. Vei primi sfaturi clare despre următorul pas practic.",
              )}
            />
          }
          footer={
            <div className="flex flex-wrap gap-3">
              <RingButton to="/consultancy" variant="solid" arrow="up-right">
                {t("Book a consultation", "Programează o consultanță")}
              </RingButton>
              <RingButton to="/contact" variant="outline">
                {t("Send an enquiry", "Trimite o cerere")}
              </RingButton>
            </div>
          }
        />
      </div>
    </section>
  );
}

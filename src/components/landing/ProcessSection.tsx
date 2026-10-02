import { Em, SectionHeader } from "@/components/landing/SectionHeader";
import { RingButton } from "@/components/landing/RingButton";
import FeaturesWithPanel, { type FeatureItem } from "@/components/ui/features-with-panel";
import { unsplash } from "@/components/landing/media";
import { useMotionPause } from "@/components/landing/motion-pause";
import { useI18n } from "@/i18n";

/**
 * How it works (#process): the five delivery steps as a feature panel that
 * walks itself through the steps until the visitor picks one.
 */
export function ProcessSection() {
  const { t, lang } = useI18n();
  const { paused } = useMotionPause();

  const steps: FeatureItem[] = [
    {
      title: t("Tell us what you need", "Spune-ne de ce ai nevoie"),
      description: t(
        "Submit your idea, request or business challenge.",
        "Trimite-ne ideea, cererea sau provocarea ta de business.",
      ),
      alt: t(
        "Someone explaining an idea across a laptop",
        "O persoană care explică o idee lângă un laptop",
      ),
      ...unsplash("1517245386807-bb43f82c33c4"),
    },
    {
      title: t("Receive a clear proposal", "Primește o propunere clară"),
      description: t(
        "We outline the scope, timeline and price before any work begins.",
        "Stabilim domeniul, termenul și prețul înainte de a începe lucrul.",
      ),
      alt: t("Reviewing a written proposal", "Analiza unei propuneri scrise"),
      ...unsplash("1454165804606-c3d57bc86b40"),
    },
    {
      title: t("Work begins", "Începe lucrul"),
      description: t(
        "Follow progress and share feedback through your client area.",
        "Urmărește progresul și oferă feedback din zona ta de client.",
      ),
      alt: t("A project board with tasks in progress", "Un panou de proiect cu sarcini în lucru"),
      ...unsplash("1531403009284-440f080d1e12"),
    },
    {
      title: t("Review the result", "Analizează rezultatul"),
      description: t(
        "Approve designs, test your website or discuss your automation solution.",
        "Aprobă designurile, testează site-ul sau discută soluția de automatizare.",
      ),
      alt: t("Reviewing a website together on a laptop", "Analiza unui site împreună, pe laptop"),
      ...unsplash("1516321318423-f06f85e504b3"),
    },
    {
      title: t("Receive your delivery", "Primește livrarea"),
      description: t(
        "Download completed files or launch your completed digital solution.",
        "Descarcă fișierele finalizate sau lansează soluția digitală gata realizată.",
      ),
      alt: t("A launched product dashboard on a laptop", "Panoul unui produs lansat, pe laptop"),
      ...unsplash("1460925895917-afdab827c52f"),
    },
  ];

  return (
    <section
      id="process"
      aria-labelledby="process-heading"
      className="scroll-mt-24 bg-background py-16 md:py-24"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10 lg:px-16">
        <FeaturesWithPanel
          label={t("Delivery steps", "Etape de livrare")}
          items={steps}
          autoAdvanceMs={6000}
          paused={paused}
          header={
            <SectionHeader
              headingId="process-heading"
              className="md:mb-10"
              eyebrow={t("How it works", "Cum funcționează")}
              title={
                lang === "ro" ? (
                  <>
                    Un proces simplu, de la cerere la <Em>livrare</Em>.
                  </>
                ) : (
                  <>
                    A simple process, from request to <Em>delivery</Em>.
                  </>
                )
              }
              description={t(
                "Five clear steps, with the scope, timeline and price agreed before any work begins.",
                "Cinci pași clari, cu domeniul, termenul și prețul stabilite înainte de începerea lucrului.",
              )}
            />
          }
          footer={
            <RingButton to="/contact" variant="outline" arrow="right">
              {t("Start a project", "Începe un proiect")}
            </RingButton>
          }
        />
      </div>
    </section>
  );
}

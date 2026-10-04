import { ButtonLink, SectionHeader } from "@/components/system";
import { useI18n } from "@/i18n";

/**
 * How it works (#process): the five delivery steps side by side on a rule (lg+), a
 * hairline list on smaller screens. Static: no photos, no autoplay.
 */
export function ProcessSection() {
  const { t } = useI18n();

  const steps = [
    {
      title: t("Tell us what you need", "Ne spui de ce ai nevoie"),
      description: t(
        "Send us the idea, the request or the problem you want solved.",
        "Ne trimiți ideea, cererea sau problema pe care vrei s-o rezolvi.",
      ),
    },
    {
      title: t("Get a clear proposal", "Primești o propunere clară"),
      description: t(
        "We write down what we will do, how long it takes and the price, before any work.",
        "Scriem ce facem, în cât timp și la ce preț, înainte de orice lucru.",
      ),
    },
    {
      title: t("Work begins", "Începem lucrul"),
      description: t(
        "Follow the progress and files in your client area; send us feedback by e-mail.",
        "Vezi în contul tău stadiul proiectului și fișierele; părerile ni le trimiți pe e-mail.",
      ),
    },
    {
      title: t("Review the result", "Verifici rezultatul"),
      description: t(
        "Approve the designs, test the website or go through the automation with us.",
        "Aprobi designul, testezi site-ul sau trecem împreună prin automatizare.",
      ),
    },
    {
      title: t("Receive the delivery", "Primești livrarea"),
      description: t(
        "Download the final files or launch the finished solution.",
        "Descarci fișierele finale sau lansăm soluția gata făcută.",
      ),
    },
  ];

  return (
    <section id="process" aria-labelledby="process-heading" className="section-y scroll-mt-20">
      <div className="container-vx">
        <SectionHeader
          headingId="process-heading"
          kicker={t("How we work", "Cum lucrăm")}
          // A plain title: the two-tone device stays on Work only.
          title={t(
            "From request to delivery, in five steps.",
            "De la cerere la livrare, în cinci pași.",
          )}
          lead={t(
            "Scope, timeline and price are agreed before we start. We work in Romanian or English.",
            "Stabilim ce facem, în cât timp și cât costă înainte să începem. Lucrăm în română sau în engleză.",
          )}
          actions={
            <ButtonLink to="/contact" variant="secondary">
              {t("Start a project", "Începe un proiect")}
            </ButtonLink>
          }
        />

        <ol className="border-t border-line-1 lg:grid lg:grid-cols-5 lg:gap-6 lg:border-t-0">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line-1 py-4 lg:block lg:border-b-0 lg:border-t lg:border-rule lg:pb-0 lg:pt-4"
            >
              <span className="type-pnum text-[0.8125rem] text-fg-3">{index + 1}</span>
              <div className="min-w-0 lg:mt-1.5">
                <h3 className="type-h4 text-fg">{step.title}</h3>
                <p className="type-body-sm mt-1 text-pretty text-fg-2">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

import { SectionHeading } from "@/components/shared/SectionHeading";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { Reveal } from "@/components/cinematic/Reveal";
import { useI18n } from "@/i18n";

export function HomeFaq() {
  const { t } = useI18n();

  const items = [
    {
      question: t("What does 'business infrastructure' actually mean?", "Ce înseamnă concret „infrastructura afacerii”?"),
      answer: t(
        "Everything your business runs on that is not the product itself: your website, your internal tools, how data moves between them, and the automations that keep it going without manual work.",
        "Tot ce ține afacerea în funcțiune, în afară de produsul propriu-zis: site-ul, uneltele interne, felul în care circulă datele și automatizările care le mențin fără muncă manuală.",
      ),
    },
    {
      question: t("Do you work with small businesses too?", "Lucrați și cu afaceri mici?"),
      answer: t(
        "Yes. Individuals and small teams usually start with the free call or the Starter plan, so we can build a plan before spending anything on a build.",
        "Da. Persoanele și echipele mici pornesc de obicei cu apelul gratuit sau planul Starter, ca să facem un plan înainte de a investi în construcție.",
      ),
    },
    {
      question: t("How fast do we see something real?", "Cât de repede vedem ceva real?"),
      answer: t(
        "The audit and blueprint are typically ready within the first week. First working deliverables usually land in the first month, depending on scope.",
        "Auditul și blueprint-ul sunt de obicei gata în prima săptămână. Primele livrări funcționale apar în general în prima lună, în funcție de amploare.",
      ),
    },
    {
      question: t("Who owns what you build?", "Cine deține ce construiți?"),
      answer: t(
        "You do. Code, accounts and data belong to your business, and we hand over documentation so you are never locked in.",
        "Tu. Codul, conturile și datele aparțin afacerii tale, iar predăm documentația ca să nu fii niciodată blocat.",
      ),
    },
    {
      question: t("Is AI safe to put in our processes?", "Este sigur să punem AI în procesele noastre?"),
      answer: t(
        "Only when it is governed. We define what the AI may touch, keep a human check on the sensitive steps, and log what it does.",
        "Doar când este guvernat. Definim ce poate atinge AI-ul, păstrăm verificarea umană pe pașii sensibili și înregistrăm ce face.",
      ),
    },
    {
      question: t("Can you take over something built by someone else?", "Puteți prelua ceva construit de altcineva?"),
      answer: t(
        "Usually yes. The audit tells us whether it is cheaper to improve what exists or to rebuild the weak part.",
        "De regulă, da. Auditul ne spune dacă e mai ieftin să îmbunătățim ce există sau să reconstruim partea slabă.",
      ),
    },
  ];

  return (
    <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
      <Reveal>
        <SectionHeading
          eyebrow={t("Questions", "Întrebări")}
          title={t("The things people ask before starting.", "Ce întreabă oamenii înainte să înceapă.")}
          description={t(
            "If your question is not here, the free call is the fastest way to get a straight answer.",
            "Dacă întrebarea ta nu e aici, apelul gratuit e cea mai rapidă cale spre un răspuns direct.",
          )}
        />
      </Reveal>
      <Reveal delay={0.1}>
        <FaqAccordion items={items} />
      </Reveal>
    </div>
  );
}

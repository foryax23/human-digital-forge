import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProjectPriceValue, ServiceFaq, ServiceOffer } from "@/components/landing/ServiceOffer";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { ItemList } from "@/components/shared/ItemList";
import { ButtonLink, FOCUS_RING, SectionHeader } from "@/components/system";
import { languageFromMatches, pageMeta, useI18n } from "@/i18n";
import { canonicalLink, jsonLdScript, serviceJsonLd } from "@/i18n/seo";
import { fixedProject, monthlyText, PLAN_CATALOG, projectPriceText } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-automation")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/ai-automation"),
    links: [canonicalLink("/ai-automation")],
    scripts: [
      jsonLdScript(
        serviceJsonLd({
          lang: languageFromMatches(matches),
          path: "/ai-automation",
          name: { en: "AI automation", ro: "Automatizări AI" },
          serviceType: "Business process automation",
          projects: ["automation", "assistant"],
        }),
      ),
    ],
  }),
  component: AiAutomationPage,
});

/** Prose links inside answers: the site's underline. */
const TEXT_LINK = cn(
  "rounded-sm text-fg underline decoration-fg/30 decoration-1 underline-offset-4 transition-colors hover:decoration-fg",
  FOCUS_RING,
);

function AiAutomationPage() {
  const { t, lang } = useI18n();
  const automation = fixedProject("automation");
  const assistant = fixedProject("assistant");
  const automationPrice = projectPriceText(automation)[lang];
  const assistantPrice = projectPriceText(assistant)[lang];
  const growth = PLAN_CATALOG.growth;
  const pro = PLAN_CATALOG.pro;
  const growthFee = monthlyText(growth.priceLei)[lang];
  const proFee = monthlyText(pro.priceLei)[lang];

  // Keep in step with the automation and assistant lines in src/lib/pricing.ts and the
  // service row ("Analiză, implementare, instruirea echipei").
  const included = [
    t(
      "An assessment: what is worth automating and what you gain",
      "Analiza: ce merită automatizat și ce câștigi",
    ),
    t(
      "The automation set up, for example an invoice from each order, booking reminders or lead routing",
      "Automatizarea pusă în funcțiune, de exemplu factura din fiecare comandă, reamintiri pentru programări sau preluarea cererilor",
    ),
    t("Training for the team that uses it", "Instruirea echipei care o folosește"),
    t(
      "For an AI assistant: on your website or WhatsApp, with a visible notice telling your customers they are talking to an AI assistant",
      "Pentru un asistent AI: pe site sau pe WhatsApp, cu un mesaj vizibil care le spune clienților că vorbesc cu un asistent AI",
    ),
  ];

  const facts = [
    {
      label: t("An automation", "O automatizare"),
      value: <ProjectPriceValue project={automation} />,
    },
    {
      label: t("AI assistant", "Asistent AI"),
      value: <ProjectPriceValue project={assistant} />,
    },
    {
      label: t("Time frame", "Termen"),
      value: t(
        "Around 1–2\u00a0weeks for an automation, 2–4\u00a0weeks for an AI assistant; we set the exact date before we start.",
        "În jur de 1–2\u00a0săptămâni pentru o automatizare, 2–4\u00a0săptămâni pentru un asistent AI; data exactă o stabilim înainte să începem.",
      ),
    },
    {
      label: t("After launch", "După lansare"),
      value: t(
        `${growth.name} (${growthFee}) looks after up to 3 automations; ${pro.name} (${proFee}) up to 8 and an AI assistant`,
        `${growth.name} (${growthFee}) îngrijește până la 3 automatizări; ${pro.name} (${proFee}), până la 8 și un asistent AI`,
      ),
    },
    {
      label: t("Reply to your request", "Răspuns la cerere"),
      value: t("within one working day", "într-o zi lucrătoare"),
    },
  ];

  const excluded = [
    t(
      "Tool fees, for example n8n or Make: you pay them",
      "Taxele instrumentelor, de exemplu n8n sau Make: le plătești tu",
    ),
    t("Meta's fees for WhatsApp messages", "Taxele Meta pentru mesajele pe WhatsApp"),
    t(
      `Upkeep after launch (the ${growth.name} and ${pro.name} plans cover it)`,
      `Îngrijirea după lansare (o acoperă abonamentele ${growth.name} și ${pro.name})`,
    ),
    t(
      "Changes of scope after we start: they can change the time frame and the price",
      "Schimbările de scop după ce începem: pot schimba termenul și prețul",
    ),
  ];

  const faq = [
    {
      question: t(
        "What can be automated in a small business?",
        "Ce se poate automatiza într-o firmă mică?",
      ),
      answer: (
        <>
          {t(
            "Repetitive work: an invoice from each order, booking reminders, taking in enquiries, summaries of client requests or documents kept in order. ",
            "Munca repetitivă: factura din fiecare comandă, reamintiri pentru programări, preluarea cererilor, rezumate ale cererilor de la clienți sau documente ținute în ordine. ",
          )}
          <Link to="/scan" className={TEXT_LINK}>
            Vortex Scan
          </Link>
          {t(
            " shows you for free what could be automated in your business.",
            " îți arată gratuit ce s-ar putea automatiza în firma ta.",
          )}
        </>
      ),
    },
    {
      question: t("How much does it cost?", "Cât costă?"),
      answer: t(
        `An automation costs ${automationPrice}, an AI assistant ${assistantPrice}. We agree the exact price before we start. Tool fees, for example n8n or Make, are paid by you.`,
        `O automatizare costă ${automationPrice}, un asistent AI ${assistantPrice}. Prețul exact îl stabilim înainte să începem. Taxele instrumentelor, de exemplu n8n sau Make, le plătești tu.`,
      ),
    },
    {
      question: t("How long does it take?", "În cât timp e gata?"),
      answer: t(
        "Around 1–2\u00a0weeks for an automation and 2–4\u00a0weeks for an AI assistant. We set the exact date together with the price.",
        "În jur de 1–2\u00a0săptămâni pentru o automatizare și 2–4\u00a0săptămâni pentru un asistent AI. Data exactă o stabilim odată cu prețul.",
      ),
    },
    {
      question: t(
        "Will my customers know they are talking to an AI?",
        "Clienții mei vor ști că vorbesc cu un AI?",
      ),
      answer: t(
        "Yes. The assistant always shows a visible notice telling your customers they are talking to an AI assistant.",
        "Da. Asistentul afișează mereu un mesaj vizibil care le spune clienților că vorbesc cu un asistent AI.",
      ),
    },
    {
      question: t(
        "Who looks after the automation after launch?",
        "Cine întreține automatizarea după lansare?",
      ),
      answer: t(
        `The ${growth.name} plan (${growthFee}) looks after up to 3 automations, ${pro.name} (${proFee}) up to 8 automations and an AI assistant. Fixes count against the hours included in the plan.`,
        `Abonamentul ${growth.name} (${growthFee}) îngrijește până la 3 automatizări, iar ${pro.name} (${proFee}) până la 8 automatizări și un asistent AI. Remedierile intră în orele incluse în abonament.`,
      ),
    },
  ];

  const solutions = [
    {
      title: t(
        "Form submissions organised automatically",
        "Formulare primite și organizate automat",
      ),
    },
    { title: t("Client enquiry summaries", "Rezumate ale cererilor de la clienți") },
    { title: t("Document handling workflows", "Fluxuri pentru gestionarea documentelor") },
    { title: t("Content preparation support", "Ajutor la pregătirea conținutului") },
    { title: t("Appointment and follow-up assistance", "Programări și mesaje de revenire") },
    { title: t("Internal knowledge organisation", "Informațiile interne puse în ordine") },
  ];

  return (
    <SiteLayout>
      <PageHero
        kicker={t("AI automation", "Automatizare AI")}
        title={t(
          "Automations for the repetitive work in a small business.",
          "Automatizări pentru munca repetitivă dintr-o firmă mică.",
        )}
        description={t(
          "Automation can take over repetitive work, keep things organised and give your team time for the work that matters. We start with what is worth automating.",
          "Automatizarea poate prelua munca repetitivă, poate ține lucrurile în ordine și îi lasă echipei timp pentru ce contează. Pornim de la ce merită automatizat.",
        )}
      >
        <ButtonLink to="/scan" variant="secondary">
          {t("Try Vortex Scan", "Încearcă Vortex Scan")}
        </ButtonLink>
        <span className="type-body-sm text-fg-3">
          {t(
            `See what could be automated in your business. An automation costs ${automationPrice}.`,
            `Vezi ce s-ar putea automatiza în firma ta. O automatizare costă ${automationPrice}.`,
          )}
        </span>
      </PageHero>

      <section aria-labelledby="ai-list" className="section-y">
        <div className="container-vx">
          <SectionHeader headingId="ai-list" title={t("What we automate", "Ce automatizăm")} />
          <ItemList items={solutions} />

          <div className="mt-12 max-w-3xl md:mt-16">
            <h3 className="type-h4 text-fg">{t("How we work with AI", "Cum lucrăm cu AI")}</h3>
            <p className="type-body mt-1.5 text-pretty text-fg-2">
              {t(
                "Your customers always know when they are talking to an AI assistant, and someone on your team checks what matters.",
                "Clienții tăi știu mereu când vorbesc cu un asistent AI, iar un om din echipa ta verifică ce contează.",
              )}
            </p>
          </div>
        </div>
      </section>

      <ServiceOffer
        headingId="ai-offer"
        title={t("What you get", "Ce primești")}
        lead={t(
          "An automation or an AI assistant at a fixed price, agreed before we start.",
          "O automatizare sau un asistent AI cu preț fix, stabilit înainte să începem.",
        )}
        included={included}
        facts={facts}
        excluded={excluded}
      />

      <ServiceFaq headingId="ai-faq" items={faq} />

      <CtaBand
        title={t("Exploring practical automation?", "Te gândești la o automatizare practică?")}
        description={t(
          "The first call is free. We reply within one working day.",
          "Prima discuție e gratuită. Îți răspundem într-o zi lucrătoare.",
        )}
        primaryLabel={t("Book an automation assessment", "Programează o evaluare")}
        primaryTo="/contact"
        secondaryLabel={t("See the consultancy", "Vezi consultanța")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

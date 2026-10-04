import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PricingSection } from "@/components/home/PricingSection";
import { SessionRows } from "@/components/home/ConsultationSection";
import { ProjectPriceValue, ServiceFaq, ServiceOffer } from "@/components/landing/ServiceOffer";
import { CtaBand } from "@/components/shared/CtaBand";
import { PageHero } from "@/components/shared/PageHero";
import { ButtonLink, FOCUS_RING, SectionHeader } from "@/components/system";
import { languageFromMatches, pageMeta, useI18n } from "@/i18n";
import { canonicalLink, jsonLdScript, serviceJsonLd } from "@/i18n/seo";
import { fixedProject, PLAN_CATALOG, projectPriceText } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/consultancy")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/consultancy"),
    links: [canonicalLink("/consultancy")],
    scripts: [
      jsonLdScript(
        serviceJsonLd({
          lang: languageFromMatches(matches),
          path: "/consultancy",
          name: { en: "Digital consultancy", ro: "Consultanță digitală" },
          serviceType: "Consulting",
          projects: ["consultancy"],
          free: { en: "First call", ro: "Prima discuție" },
        }),
      ),
    ],
  }),
  component: ConsultancyPage,
});

/** Prose links inside answers: the site's underline. */
const TEXT_LINK = cn(
  "rounded-sm text-fg underline decoration-fg/30 decoration-1 underline-offset-4 transition-colors hover:decoration-fg",
  FOCUS_RING,
);

function ConsultancyPage() {
  const { t, lang } = useI18n();
  const consultancy = fixedProject("consultancy");
  const hourPrice = projectPriceText(consultancy)[lang];
  const { growth, pro } = PLAN_CATALOG;

  const included = [
    t(
      "A one-to-one conversation about your idea, website, digital product or a possible automation",
      "O discuție individuală despre idee, site, un produs digital sau o posibilă automatizare",
    ),
    t(
      "A clear, practical next step, whatever stage the idea is at",
      "Următorul pas, clar și practic, oricât de avansată e ideea",
    ),
    t(
      "If you have a Vortex Scan report, we go through it together",
      "Dacă ai un raport Vortex Scan, îl discutăm împreună",
    ),
    t(
      "If it leads to a project: what it includes, the price and the time frame, agreed before we start",
      "Dacă discuția duce la un proiect: ce include, prețul și termenul, stabilite înainte să începem",
    ),
  ];

  const facts = [
    {
      label: t("First call", "Prima discuție"),
      value: <span className="type-price text-fg">{t("free", "gratuită")}</span>,
    },
    {
      label: t("After that", "După aceea"),
      value: (
        <span className="flex flex-col gap-1">
          <ProjectPriceValue project={consultancy} />
          <span className="text-fg-3">{t("without a plan", "fără abonament")}</span>
        </span>
      ),
    },
    {
      label: t("In a plan", "În abonament"),
      value: t(
        `${growth.name} and ${pro.name}: the monthly calls come from the included hours`,
        `${growth.name} și ${pro.name}: discuțiile lunare intră în orele incluse`,
      ),
    },
    { label: t("Languages", "Limbi"), value: t("Romanian or English", "română sau engleză") },
    {
      label: t("Reply to your request", "Răspuns la cerere"),
      value: t(
        "within one working day, with a proposed time",
        "într-o zi lucrătoare, cu o oră propusă",
      ),
    },
  ];

  const excluded = [
    t(
      "Building it: the website, app or automation is a separate project, at a fixed price",
      "Realizarea: site-ul, aplicația sau automatizarea sunt un proiect separat, cu preț fix",
    ),
    t("Legal or tax advice", "Consultanța juridică sau fiscală"),
  ];

  const faq = [
    {
      question: t("How much does a consultation cost?", "Cât costă o consultanță?"),
      answer: t(
        `The first call is free. After that, without a plan, consultancy costs ${hourPrice}. In the ${growth.name} and ${pro.name} plans, the monthly calls come from the included hours.`,
        `Prima discuție e gratuită. După aceea, fără abonament, consultanța costă ${hourPrice}. În abonamentele ${growth.name} și ${pro.name}, discuțiile lunare intră în orele incluse.`,
      ),
    },
    {
      question: t("How do I book a call?", "Cum programez o discuție?"),
      answer: t(
        "Pick the kind of session above and tell us briefly what it is about. We reply within one working day and propose a time.",
        "Alege tipul de discuție de mai sus și spune-ne pe scurt despre ce e vorba. Îți răspundem într-o zi lucrătoare și îți propunem o oră.",
      ),
    },
    {
      question: t("Do I need a clear idea first?", "Trebuie să am deja o idee clară?"),
      answer: t(
        "No. You leave with a practical next step, whatever stage the idea is at.",
        "Nu. Pleci cu un pas practic următor, oricât de avansată e ideea.",
      ),
    },
    {
      question: t("Can I bring a Vortex Scan report?", "Pot veni cu un raport Vortex Scan?"),
      answer: (
        <>
          {t("Yes. Scan your company for free with ", "Da. Îți scanezi firma gratuit cu ")}
          <Link to="/scan" className={TEXT_LINK}>
            Vortex Scan
          </Link>
          {t(
            ", get the plan as a PDF and we talk it through together, with no commitment.",
            ", primești planul în PDF și îl discutăm împreună, fără obligații.",
          )}
        </>
      ),
    },
    {
      question: t("Which language do we speak?", "În ce limbă vorbim?"),
      answer: t("Romanian or English.", "În română sau în engleză."),
    },
  ];

  return (
    <SiteLayout>
      <PageHero
        kicker={t("Consultancy", "Consultanță")}
        title={t(
          "Clear advice before you invest time and money.",
          "Sfaturi clare înainte să investești timp și bani.",
        )}
        description={t(
          "A one-to-one conversation about your idea, website or a possible automation. You leave with a practical next step, whatever stage the idea is at. The first call is free.",
          "O discuție individuală despre idee, site sau o posibilă automatizare. Pleci cu un pas practic următor, oricât de avansată e ideea. Prima discuție e gratuită.",
        )}
      >
        <ButtonLink to="/contact" search={{ service: "consultancy" }}>
          {t("Book a call", "Programează o discuție")}
        </ButtonLink>
        <span className="type-body-sm text-fg-3">
          {t(`After that, ${hourPrice} without a plan.`, `Apoi ${hourPrice}, fără abonament.`)}
        </span>
      </PageHero>

      <section aria-labelledby="consultancy-sessions" className="section-y">
        <div className="container-vx">
          <SectionHeader
            layout="split"
            headingId="consultancy-sessions"
            title={t("Three kinds of session", "Trei tipuri de discuție")}
            lead={t(
              "Pick the one closest to your question. Tell us a little about it and we will propose a time.",
              "Alege-o pe cea mai apropiată de întrebarea ta. Spune-ne pe scurt despre ce e vorba și îți propunem o oră.",
            )}
          >
            <SessionRows />
          </SectionHeader>
        </div>
      </section>

      <ServiceOffer
        headingId="consultancy-offer"
        title={t("What you get", "Ce primești")}
        lead={t(
          "A conversation you leave with a clear next step.",
          "O discuție din care pleci cu următorul pas clar.",
        )}
        included={included}
        facts={facts}
        excluded={excluded}
      />

      <ServiceFaq headingId="consultancy-faq" items={faq} />

      <PricingSection />

      <CtaBand
        title={t("Not sure what you need yet?", "Nu știi încă de ce ai nevoie?")}
        description={t(
          "The first call is free. We reply within one working day.",
          "Prima discuție e gratuită. Îți răspundem într-o zi lucrătoare.",
        )}
        primaryLabel={t("Book a call", "Programează o discuție")}
        primaryTo="/contact"
        secondaryLabel={t("See the services", "Vezi serviciile")}
        secondaryTo="/services"
      />
    </SiteLayout>
  );
}

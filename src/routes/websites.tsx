import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PROJECTS } from "@/components/landing/projects";
import { ProjectPriceValue, ServiceFaq, ServiceOffer } from "@/components/landing/ServiceOffer";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { ButtonLink, FOCUS_RING, SectionHeader } from "@/components/system";
import { languageFromMatches, pageMeta, useI18n } from "@/i18n";
import { canonicalLink, jsonLdScript, serviceJsonLd } from "@/i18n/seo";
import {
  fixedProject,
  hoursText,
  monthlyText,
  PLAN_CATALOG,
  projectPriceText,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/websites")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/websites"),
    links: [canonicalLink("/websites")],
    scripts: [
      jsonLdScript(
        serviceJsonLd({
          lang: languageFromMatches(matches),
          path: "/websites",
          name: { en: "Business websites", ro: "Site-uri de prezentare" },
          serviceType: "Website design and development",
          projects: ["site"],
        }),
      ),
    ],
  }),
  component: WebsitesPage,
});

/** Prose links inside answers: the site's underline. */
const TEXT_LINK = cn(
  "rounded-sm text-fg underline decoration-fg/30 decoration-1 underline-offset-4 transition-colors hover:decoration-fg",
  FOCUS_RING,
);

const ROW =
  "grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line-1 py-4";
const NUMBER = "type-pnum text-[0.8125rem] text-fg-3";

function WebsitesPage() {
  const { t, lang } = useI18n();
  const site = fixedProject("site");
  const price = projectPriceText(site)[lang];
  const priceFirst = price.charAt(0).toUpperCase() + price.slice(1);
  const starter = PLAN_CATALOG.starter;
  const starterFee = monthlyText(starter.priceLei)[lang];
  const starterHours = hoursText(starter.hoursPerMonth)[lang];

  // Keep in step with the site project's line in src/lib/pricing.ts (FIXED_PROJECTS).
  const included = [
    t(
      "Up to 6 pages, designed and built for your business",
      "Până la 6 pagini, gândite și construite pentru afacerea ta",
    ),
    t("A contact form", "Formular de contact"),
    t(
      "Basic SEO, so Google can find and read your pages",
      "SEO de bază, ca Google să-ți găsească și să-ți înțeleagă paginile",
    ),
    t(
      "The GDPR pages: privacy and cookie policy",
      "Paginile GDPR: politica de confidențialitate și cea de cookie-uri",
    ),
    t("30 days of fixes after launch", "30 de zile de remedieri după lansare"),
  ];

  const facts = [
    { label: t("Price", "Preț"), value: <ProjectPriceValue project={site} /> },
    {
      label: t("Time frame", "Termen"),
      value: t(
        "Around 2–3\u00a0weeks; we set the exact date with the price, before we start.",
        "În jur de 2–3\u00a0săptămâni; data exactă o stabilim odată cu prețul, înainte să începem.",
      ),
    },
    {
      label: t("After launch", "După lansare"),
      value: t(
        `${starter.name}, ${starterFee}: hosting, SSL, updates and backups`,
        `${starter.name}, ${starterFee}: găzduire, SSL, actualizări și backup`,
      ),
    },
    {
      label: t("Reply to your request", "Răspuns la cerere"),
      value: t("within one working day", "într-o zi lucrătoare"),
    },
  ];

  const excluded = [
    t(
      "More than 6 pages, a second language, an online shop or online booking: priced separately, in the proposal",
      "Mai mult de 6 pagini, o a doua limbă, magazin online sau programări online: le stabilim separat, în ofertă",
    ),
    t(
      `Hosting and upkeep after the 30 days (the ${starter.name} plan covers them)`,
      `Găzduirea și întreținerea după cele 30 de zile (le acoperă abonamentul ${starter.name})`,
    ),
    t("Other providers' fees, such as the domain", "Taxele altor furnizori, de exemplu domeniul"),
    t("Ad spend", "Bugetul de reclame"),
  ];

  const faq = [
    {
      question: t("How much does a presentation website cost?", "Cât costă un site de prezentare?"),
      answer: t(
        `${priceFirst}, for a website with up to 6 pages. We agree the exact price together before we start, once we know which pages and features you need.`,
        `${priceFirst}, pentru un site cu până la 6 pagini. Prețul exact îl stabilim împreună înainte să începem, după ce știm ce pagini și ce funcții îți trebuie.`,
      ),
    },
    {
      question: t("How long does it take?", "În cât timp e gata?"),
      answer: t(
        "Around 2–3\u00a0weeks. It also depends on how soon we have the texts and images, so we set the exact date before we start.",
        "În jur de 2–3\u00a0săptămâni. Termenul depinde și de cât de repede avem textele și imaginile, așa că data exactă o stabilim înainte să începem.",
      ),
    },
    {
      question: t("What happens after launch?", "Ce se întâmplă după lansare?"),
      answer: t(
        `You get 30 days of fixes included. After that, the ${starter.name} plan (${starterFee}) covers hosting, SSL, updates and backups, with ${starterHours} of work a month.`,
        `Primești 30 de zile de remedieri incluse. După aceea, abonamentul ${starter.name} (${starterFee}) acoperă găzduirea, SSL-ul, actualizările și backup-ul, cu ${starterHours} de lucru pe lună.`,
      ),
    },
    {
      question: t("Can you redo my current website?", "Îmi puteți reface site-ul existent?"),
      answer: (
        <>
          {t(
            "Yes, redesigning an existing website is one of the projects we take on. You can start with ",
            "Da, refacerea unui site existent e unul dintre proiectele pe care le facem. Poți începe cu ",
          )}
          <Link to="/scan" className={TEXT_LINK}>
            Vortex Scan
          </Link>
          {t(
            ", for free: it shows the speed, how the site appears in Google search and what is missing.",
            ", gratuit: îți arată viteza, cum apare site-ul în căutarea Google și ce lipsește.",
          )}
        </>
      ),
    },
    {
      question: t("Can I see websites you have built?", "Pot vedea site-uri făcute de voi?"),
      answer: (
        <>
          {t(`Yes. ${PROJECTS.length} launched projects are on the `, `Da. Pe pagina `)}
          <Link to="/portfolio" className={TEXT_LINK}>
            {t("Projects", "Proiecte")}
          </Link>
          {t(
            " page, each with a quick look and a link to the live site.",
            ` găsești ${PROJECTS.length} proiecte lansate, fiecare cu o privire rapidă și linkul către site.`,
          )}
        </>
      ),
    },
  ];

  const categories = [
    t("Landing pages", "Pagini de destinație"),
    t("Small business websites", "Site-uri pentru afaceri mici"),
    t("Personal portfolio websites", "Site-uri de portofoliu personal"),
    t("Service websites", "Site-uri de servicii"),
    t("Website redesign", "Refacerea unui site existent"),
  ];

  // One line per step, no durations: the dates are set in the proposal.
  const process = [
    {
      title: t("Discovery", "Descoperire"),
      detail: t(
        "A call about what the site is for, then the written proposal with the price and the date.",
        "O discuție despre ce vrei de la site, apoi oferta scrisă, cu prețul și data.",
      ),
    },
    {
      title: t("Structure and content", "Structură și conținut"),
      detail: t(
        "The pages, what each one says and which images we use.",
        "Paginile, ce scrie pe fiecare și ce imagini folosim.",
      ),
    },
    {
      title: t("Visual design", "Design vizual"),
      detail: t(
        "How the pages look on a phone and on a computer, approved by you.",
        "Cum arată paginile pe telefon și pe calculator, aprobat de tine.",
      ),
    },
    {
      title: t("Development", "Dezvoltare"),
      detail: t(
        "We build the pages, with the contact form, basic SEO and the GDPR pages.",
        "Construim paginile, cu formularul de contact, SEO de bază și paginile GDPR.",
      ),
    },
    {
      title: t("Review and launch", "Verificare și lansare"),
      detail: t(
        "We check it together and publish it; the 30 days of fixes start then.",
        "Îl verificăm împreună și îl publicăm; de atunci curg cele 30 de zile de remedieri.",
      ),
    },
  ];

  return (
    <SiteLayout>
      <PageHero
        kicker={t("Websites", "Site-uri web")}
        title={t(
          "Websites designed around your purpose, not just your presence online.",
          "Site-uri făcute pentru scopul tău, nu doar ca să fii prezent online.",
        )}
        description={t(
          "Simple, effective sites for people and businesses that need to explain their offer clearly and turn interest into enquiries.",
          "Site-uri simple și eficiente pentru oameni și firme care trebuie să-și explice clar oferta și să transforme interesul în cereri.",
        )}
      >
        <ButtonLink to="/portfolio" variant="secondary">
          {t("See launched sites", "Vezi site-uri lansate")}
        </ButtonLink>
        <span className="type-body-sm text-fg-3">
          {t(`A presentation website ${price}.`, `Site de prezentare ${price}.`)}
        </span>
      </PageHero>

      <section aria-label={t("What we build", "Ce construim")} className="section-y">
        <div className="container-vx">
          <SectionHeader headingId="websites-build" title={t("What we build", "Ce construim")} />
          {/* ItemList's rows (src/components/shared/ItemList.tsx), plus a sixth that points to
              Produse digitale, where client portals and web apps live now; six rows keep the
              grid full at two and three columns. */}
          <ol className="grid border-t border-rule sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
            {categories.map((title, index) => (
              <li key={title} className={ROW}>
                <span aria-hidden className={NUMBER}>
                  {index + 1}
                </span>
                <h3 className="type-h4 min-w-0 text-pretty text-fg">{title}</h3>
              </li>
            ))}
            <li className={ROW}>
              <span aria-hidden className={NUMBER}>
                {categories.length + 1}
              </span>
              <div className="min-w-0">
                <h3 className="type-h4 text-pretty text-fg">
                  {t("Client portals and web apps", "Portaluri și aplicații web")}
                </h3>
                {/* py-1 keeps a 24 px tap target without moving the line. */}
                <Link
                  to="/digital-products"
                  className={cn(
                    "type-body-sm -mb-1 inline-flex items-center gap-1.5 rounded-sm py-1 text-fg-2 underline decoration-fg/30 decoration-1 underline-offset-4 transition-colors hover:text-fg hover:decoration-fg",
                    FOCUS_RING,
                  )}
                >
                  {t("Find them under Digital products", "Le găsești la Produse digitale")}
                  <ArrowRight aria-hidden className="size-3.5 shrink-0" />
                </Link>
              </div>
            </li>
          </ol>

          <SectionHeader
            className="mt-16 md:mt-20"
            headingId="websites-path"
            title={t("A clear path to launch.", "Un drum clar spre lansare.")}
            lead={t(
              "Scope, timeline and price are agreed before we start.",
              "Stabilim ce facem, în cât timp și cât costă înainte să începem.",
            )}
          />
          <ol className="border-t border-line-1 lg:grid lg:grid-cols-5 lg:gap-6 lg:border-t-0">
            {process.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line-1 py-4 lg:block lg:border-b-0 lg:border-t lg:border-rule lg:pb-0 lg:pt-4"
              >
                <span className="type-pnum text-[0.8125rem] text-fg-3">{index + 1}</span>
                <div className="min-w-0">
                  <h3 className="type-h4 text-fg lg:mt-1.5">{step.title}</h3>
                  <p className="type-body-sm mt-1 text-pretty text-fg-2">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ServiceOffer
        headingId="websites-offer"
        title={t("What you get", "Ce primești")}
        lead={t(
          "A presentation website at a fixed price, agreed before we start.",
          "Un site de prezentare cu preț fix, stabilit înainte să începem.",
        )}
        included={included}
        facts={facts}
        excluded={excluded}
      />

      <ServiceFaq headingId="websites-faq" items={faq} />

      <CtaBand
        title={t(
          "Planning a new website or a redesign?",
          "Pregătești un site nou sau vrei să-l refaci pe cel vechi?",
        )}
        description={t(
          "Tell us what the site is for. We reply within one working day.",
          "Spune-ne la ce îți folosește site-ul. Îți răspundem într-o zi lucrătoare.",
        )}
        primaryLabel={t("Plan a website project", "Planifică proiectul")}
        primaryTo="/contact"
        secondaryLabel={t("Book a call", "Programează o discuție")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

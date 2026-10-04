import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { ServiceFaq, ServiceOffer } from "@/components/landing/ServiceOffer";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { ItemList } from "@/components/shared/ItemList";
import { ButtonLink, FOCUS_RING, SectionHeader } from "@/components/system";
import { languageFromMatches, pageMeta, useI18n } from "@/i18n";
import { canonicalLink, jsonLdScript, serviceJsonLd } from "@/i18n/seo";
import { monthlyText, PLAN_CATALOG } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/digital-products")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/digital-products"),
    links: [canonicalLink("/digital-products")],
    scripts: [
      // No offer: web apps get a fixed price after the first call.
      jsonLdScript(
        serviceJsonLd({
          lang: languageFromMatches(matches),
          path: "/digital-products",
          name: { en: "Custom web apps", ro: "Aplicații web la comandă" },
          serviceType: "Web application development",
        }),
      ),
    ],
  }),
  component: DigitalProductsPage,
});

/** Prose links inside answers: the site's underline. */
const TEXT_LINK = cn(
  "rounded-sm text-fg underline decoration-fg/30 decoration-1 underline-offset-4 transition-colors hover:decoration-fg",
  FOCUS_RING,
);

function DigitalProductsPage() {
  const { t, lang } = useI18n();
  const growth = PLAN_CATALOG.growth;
  const pro = PLAN_CATALOG.pro;
  const growthFee = monthlyText(growth.priceLei)[lang];
  const proFee = monthlyText(pro.priceLei)[lang];

  // Only what Vortex Hub builds today (see /portfolio): web apps that run in the browser.
  const items = [
    {
      title: t("Custom web apps", "Aplicații web la comandă"),
      description: t(
        "For a process that does not fit in a spreadsheet or an off-the-shelf program.",
        "Pentru un proces care nu încape într-un tabel sau într-un program standard.",
      ),
    },
    {
      title: t("Client portals", "Portaluri pentru clienți"),
      description: t(
        "Your clients sign in and see their requests, documents and how the work is going.",
        "Clienții intră în contul lor și văd cererile, documentele și stadiul lucrărilor.",
      ),
    },
    {
      title: t("Internal tools", "Instrumente interne"),
      description: t(
        "Records, approvals and schedules for your team, in one place.",
        "Evidențe, aprobări și programări pentru echipă, într-un singur loc.",
      ),
    },
    {
      title: t("Dashboards", "Tablouri de bord"),
      description: t(
        "The figures that matter on one screen, from the data you already have.",
        "Cifrele importante pe un singur ecran, din datele pe care le ai deja.",
      ),
    },
    {
      title: t("MVPs: the first version of a product", "MVP: prima versiune a unui produs"),
      description: t(
        "Only what is essential, so you can test the idea with real people before a large investment.",
        "Doar ce e esențial, ca să testezi ideea cu oameni reali înainte de o investiție mare.",
      ),
    },
    {
      title: t("Accounts, payments and integrations", "Conturi, plăți și integrări"),
      description: t(
        "Sign-in, user roles, online payments and links to the tools you already use.",
        "Autentificare, roluri pentru utilizatori, plăți online și legătura cu programele pe care le folosești deja.",
      ),
    },
  ];

  // One line per step, no durations: the dates are set in the proposal.
  const process = [
    {
      title: t("What the app has to do", "Ce trebuie să facă aplicația"),
      detail: t(
        "A free first call, then the scope in writing and a fixed-price proposal.",
        "O primă discuție gratuită, apoi scopul scris și oferta cu preț fix.",
      ),
    },
    {
      title: t("Sketch and prototype", "Schiță și prototip"),
      detail: t(
        "The main screens, which you click through before any code.",
        "Ecranele principale, pe care le încerci înainte de cod.",
      ),
    },
    {
      title: t("Build in stages", "Dezvoltare pe etape"),
      detail: t(
        "We build it piece by piece and show you each stage.",
        "Construim pe bucăți și îți arătăm fiecare etapă.",
      ),
    },
    {
      title: t("Testing with real users", "Testare cu utilizatori reali"),
      detail: t(
        "The people who will use it try it and tell us what does not work.",
        "Oamenii care o vor folosi o încearcă și ne spun ce nu merge.",
      ),
    },
    {
      title: t("Launch and improvements", "Lansare și îmbunătățiri"),
      detail: t(
        "We publish it, then improve it from how it is really used.",
        "O publicăm, apoi o îmbunătățim după felul în care e folosită.",
      ),
    },
  ];

  // OWNER TO CONFIRM: the deliverables follow the process above; no time frame until the
  // owner sets one (then add it to "Termen" and the FAQ).
  const included = [
    t(
      "The scope in writing: what the app does, for whom, and what waits for later",
      "Scopul scris: ce face aplicația, pentru cine și ce rămâne pentru mai târziu",
    ),
    t(
      "A prototype you can click through before we build",
      "Un prototip pe care îl încerci înainte să construim",
    ),
    t(
      "The build in stages, with a demo after each",
      "Dezvoltarea pe etape, cu o prezentare după fiecare",
    ),
    t("Testing with your users, before launch", "Testarea cu utilizatorii tăi, înainte de lansare"),
    t(
      "The launch: the app runs in the browser, on a computer and on a phone",
      "Lansarea: aplicația merge în browser, pe calculator și pe telefon",
    ),
  ];

  const facts = [
    {
      label: t("Price", "Preț"),
      value: t(
        "A fixed-price proposal after the first call, which is free",
        "Ofertă cu preț fix după prima discuție, care e gratuită",
      ),
    },
    {
      label: t("Time frame", "Termen"),
      value: t(
        "Set in the proposal, with the price, before we start.",
        "Îl stabilim în ofertă, odată cu prețul, înainte să începem.",
      ),
    },
    {
      label: t("After launch", "După lansare"),
      value: t(
        `Improvements from the hours of a ${growth.name} (${growthFee}) or ${pro.name} (${proFee}) plan; hosting is set in the proposal`,
        `Îmbunătățirile, din orele unui abonament ${growth.name} (${growthFee}) sau ${pro.name} (${proFee}); găzduirea o stabilim în ofertă`,
      ),
    },
    {
      label: t("Reply to your request", "Răspuns la cerere"),
      value: t("within one working day", "într-o zi lucrătoare"),
    },
  ];

  const excluded = [
    t(
      "Native apps for the App Store or Google Play",
      "Aplicații native pentru App Store sau Google Play",
    ),
    t(
      "Other providers' fees, such as the domain or online payment fees",
      "Taxele altor furnizori, de exemplu domeniul sau comisioanele pentru plăți online",
    ),
    t(
      "Changes of scope after we start: they can change the time frame and the price",
      "Schimbările de scop după ce începem: pot schimba termenul și prețul",
    ),
  ];

  const faq = [
    {
      question: t("How much does a web app cost?", "Cât costă o aplicație web?"),
      answer: t(
        "It depends on what it has to do. After the first call, which is free, we send you a fixed-price proposal. We can start with a small first version, so you test the idea before a large investment.",
        "Depinde de ce trebuie să facă. După prima discuție, care e gratuită, îți trimitem o ofertă cu preț fix. Putem începe cu o primă versiune mică, ca să testezi ideea înainte de o investiție mare.",
      ),
    },
    {
      question: t("How long does it take?", "În cât timp e gata?"),
      answer: t(
        "We set the date in the proposal, together with the price. We build in stages and show you each one, so you see the app take shape.",
        "Data o stabilim în ofertă, odată cu prețul. Lucrăm pe etape și ți-o arătăm pe fiecare, așa că vezi cum prinde formă aplicația.",
      ),
    },
    {
      question: t("What happens after launch?", "Ce se întâmplă după lansare?"),
      answer: t(
        `Improvements come from the hours included in a ${growth.name} (${growthFee}) or ${pro.name} (${proFee}) plan. Hosting is set in the proposal.`,
        `Îmbunătățirile intră în orele incluse într-un abonament ${growth.name} (${growthFee}) sau ${pro.name} (${proFee}). Găzduirea o stabilim în ofertă.`,
      ),
    },
    {
      question: t("Can I see apps you have built?", "Pot vedea aplicații făcute de voi?"),
      answer: (
        <>
          {t("Yes, on the ", "Da, pe pagina ")}
          <Link to="/portfolio" className={TEXT_LINK}>
            {t("Projects", "Proiecte")}
          </Link>
          {t(" page, each with a quick look.", ", fiecare cu o privire rapidă.")}
        </>
      ),
    },
  ];

  return (
    <SiteLayout>
      <PageHero
        kicker={t("Digital products", "Produse digitale")}
        title={t(
          "Web apps made to fit the way you work.",
          "Aplicații web făcute pe măsura felului în care lucrezi.",
        )}
        description={t(
          "Client portals, internal tools, dashboards or the first version of a new product. We build them when off-the-shelf software does not fit, and they run in the browser, on a computer or a phone.",
          "Portaluri pentru clienți, instrumente interne, tablouri de bord sau prima versiune a unui produs nou. Le construim când un program standard nu se potrivește, iar ele merg în browser, pe calculator și pe telefon.",
        )}
      >
        <ButtonLink to="/portfolio" variant="secondary">
          {t("See launched apps", "Vezi aplicațiile lansate")}
        </ButtonLink>
        <span className="type-body-sm text-fg-3">
          {t(
            "We set a fixed price after a call about what the app has to do.",
            "Prețul fix îl stabilim după o discuție despre ce trebuie să facă aplicația.",
          )}
        </span>
      </PageHero>

      <section aria-labelledby="products-list" className="section-y">
        <div className="container-vx">
          <SectionHeader headingId="products-list" title={t("What we build", "Ce construim")} />
          <ItemList items={items} />
          <p className="type-body-sm mt-4 text-pretty text-fg-2">
            {t("We also make our own products, such as ", "Facem și produse proprii, cum e ")}
            <Link to="/vortexpoint" className={TEXT_LINK}>
              VortexPoint
            </Link>
            {t(
              ", a free app for the notch on your Mac.",
              ", o aplicație gratuită pentru notch-ul Mac-ului.",
            )}
          </p>

          <SectionHeader
            className="mt-16 md:mt-20"
            headingId="products-path"
            title={t("A clear path to the first version.", "Un drum clar până la prima versiune.")}
            lead={t(
              "Timeline and price are agreed once we know what the app has to do, before we start.",
              "Termenul și prețul le stabilim după ce știm ce trebuie să facă aplicația, înainte să începem.",
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
        headingId="products-offer"
        title={t("What you get", "Ce primești")}
        lead={t(
          "A web app at a fixed price, agreed after the first call and before we start.",
          "O aplicație web cu preț fix, stabilit după prima discuție și înainte să începem.",
        )}
        included={included}
        facts={facts}
        excluded={excluded}
      />

      <ServiceFaq headingId="products-faq" items={faq} />

      <CtaBand
        title={t(
          "Thinking about an app for your business?",
          "Te gândești la o aplicație pentru afacerea ta?",
        )}
        description={t(
          "Tell us what it should solve and we will suggest the smallest version worth building. We reply within one working day.",
          "Spune-ne ce ar trebui să rezolve și îți propunem cea mai mică versiune care merită construită. Îți răspundem într-o zi lucrătoare.",
        )}
        primaryLabel={t("Describe the app", "Descrie aplicația")}
        primaryTo="/contact"
        secondaryLabel={t("Book a call", "Programează o discuție")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

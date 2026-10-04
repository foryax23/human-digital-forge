import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { ItemList } from "@/components/shared/ItemList";
import { ButtonLink, SectionHeader } from "@/components/system";
import { pageMeta, useI18n } from "@/i18n";

export const Route = createFileRoute("/digital-products")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/digital-products"),
    links: [{ rel: "canonical", href: "/digital-products" }],
  }),
  component: DigitalProductsPage,
});

function DigitalProductsPage() {
  const { t } = useI18n();

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

  const process = [
    t("What the app has to do", "Ce trebuie să facă aplicația"),
    t("Sketch and prototype", "Schiță și prototip"),
    t("Build in stages", "Dezvoltare pe etape"),
    t("Testing with real users", "Testare cu utilizatori reali"),
    t("Launch and improvements", "Lansare și îmbunătățiri"),
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
      </PageHero>

      <section aria-labelledby="products-list" className="section-y">
        <div className="container-vx">
          <SectionHeader headingId="products-list" title={t("What we build", "Ce construim")} />
          <ItemList items={items} />

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
                key={step}
                className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line-1 py-4 lg:block lg:border-b-0 lg:border-t lg:border-rule lg:pb-0 lg:pt-4"
              >
                <span className="type-pnum text-[0.8125rem] text-fg-3">{index + 1}</span>
                <h3 className="type-h4 text-fg lg:mt-1.5">{step}</h3>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand
        title={t(
          "Thinking about an app for your business?",
          "Te gândești la o aplicație pentru afacerea ta?",
        )}
        description={t(
          "Tell us what it should solve and we will suggest the smallest version worth building.",
          "Spune-ne ce ar trebui să rezolve și îți propunem cea mai mică versiune care merită construită.",
        )}
        primaryLabel={t("Describe the app", "Descrie aplicația")}
        primaryTo="/contact"
        secondaryLabel={t("Book a call", "Programează o discuție")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

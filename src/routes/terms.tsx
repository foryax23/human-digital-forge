import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CompanyDetails } from "@/components/shared/CompanyDetails";
import { useI18n } from "@/i18n";

const title = "Terms and Conditions | Vortex Hub";
const description = "The terms that govern the use of Vortex Hub services and website.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://vortexhub.dev/terms" },
    ],
    links: [{ rel: "canonical", href: "https://vortexhub.dev/terms" }],
  }),
  component: TermsPage,
});

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-serif text-xl text-foreground">{heading}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function TermsPage() {
  const { t } = useI18n();

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Legal", "Legal")}
        title={t("Terms and Conditions", "Termeni și condiții")}
        description={t(
          "These terms govern the use of our website and services. Please review them with your legal advisor before launch.",
          "Acești termeni reglementează utilizarea site-ului și a serviciilor noastre. Te rugăm să îi revizuiești cu consilierul tău juridic înainte de lansare.",
        )}
      />
      <section className="mx-auto max-w-3xl space-y-10 px-4 py-16 sm:px-6 lg:px-8">
        <Section heading={t("1. Provider", "1. Furnizorul")}>
          <p>
            {t(
              "The website and services are operated by:",
              "Site-ul și serviciile sunt operate de:",
            )}
          </p>
          <CompanyDetails />
        </Section>

        <Section heading={t("2. Definitions", "2. Definiții")}>
          <p>
            {t(
              "'Services' means the digital products, websites, AI automation and consultancy offered by Vortex Hub. 'Client' means any individual or business that requests or purchases the Services. 'Deliverables' means the work produced under an agreed proposal.",
              "„Servicii” înseamnă produsele digitale, site-urile web, automatizările AI și consultanța oferite de Vortex Hub. „Client” înseamnă orice persoană fizică sau juridică ce solicită sau achiziționează Serviciile. „Livrabile” înseamnă lucrările produse conform unei propuneri agreate.",
            )}
          </p>
        </Section>

        <Section heading={t("3. Services and proposals", "3. Servicii și propuneri")}>
          <p>
            {t(
              "The scope, timeline and price of each engagement are defined in a written proposal or quote. Work begins after the Client accepts the proposal. Any change to scope may affect the timeline and price.",
              "Scopul, termenul și prețul fiecărui angajament sunt definite într-o propunere sau ofertă scrisă. Lucrarea începe după ce Clientul acceptă propunerea. Orice modificare a scopului poate afecta termenul și prețul.",
            )}
          </p>
        </Section>

        <Section heading={t("4. Payment", "4. Plată")}>
          <p>
            {t(
              "Prices and payment terms are set out in each proposal. Invoices are due within the period stated on the invoice. Late payment may result in suspension of work or services.",
              "Prețurile și condițiile de plată sunt stabilite în fiecare propunere. Facturile sunt scadente în termenul indicat pe factură. Întârzierea plății poate duce la suspendarea lucrării sau a serviciilor.",
            )}
          </p>
        </Section>

        <Section heading={t("5. Revisions and delivery", "5. Revizuiri și livrare")}>
          <p>
            {t(
              "Each proposal specifies the number of revision rounds included. Deliverables are provided by the agreed method. The Client is responsible for timely feedback and for providing necessary content and access.",
              "Fiecare propunere specifică numărul de runde de revizuire incluse. Livrabilele sunt furnizate prin metoda agreată. Clientul este responsabil pentru feedback în timp util și pentru furnizarea conținutului și a accesului necesar.",
            )}
          </p>
        </Section>

        <Section heading={t("6. Intellectual property", "6. Proprietate intelectuală")}>
          <p>
            {t(
              "Unless otherwise agreed in writing, ownership of final Deliverables transfers to the Client upon full payment. Vortex Hub retains the right to display non-confidential work in its portfolio.",
              "Cu excepția cazului în care se convine altfel în scris, dreptul de proprietate asupra Livrabilelor finale se transferă Clientului la plata integrală. Vortex Hub își rezervă dreptul de a afișa lucrările neconfidențiale în portofoliul său.",
            )}
          </p>
        </Section>

        <Section heading={t("7. Client responsibilities", "7. Responsabilitățile clientului")}>
          <p>
            {t(
              "The Client warrants that any materials it provides do not infringe third-party rights and that it has the authority to enter into the agreement. The Client is responsible for the lawful use of the Deliverables.",
              "Clientul garantează că materialele furnizate nu încalcă drepturile terților și că are autoritatea de a încheia acordul. Clientul este responsabil pentru utilizarea legală a Livrabilelor.",
            )}
          </p>
        </Section>

        <Section heading={t("8. Liability", "8. Răspundere")}>
          <p>
            {t(
              "To the extent permitted by law, Vortex Hub's total liability is limited to the amount paid for the relevant Services. We are not liable for indirect or consequential losses. Nothing limits liability that cannot be limited by law.",
              "În măsura permisă de lege, răspunderea totală a Vortex Hub este limitată la suma plătită pentru Serviciile relevante. Nu răspundem pentru pierderi indirecte sau subsecvente. Nimic nu limitează răspunderea care nu poate fi limitată prin lege.",
            )}
          </p>
        </Section>

        <Section heading={t("9. Termination", "9. Încetare")}>
          <p>
            {t(
              "Either party may terminate an engagement for material breach that is not remedied within a reasonable period. Fees for work performed up to termination remain payable.",
              "Oricare parte poate înceta un angajament pentru încălcare materială care nu este remediată într-un termen rezonabil. Onorariile pentru lucrarea efectuată până la încetare rămân datorate.",
            )}
          </p>
        </Section>

        <Section heading={t("10. Governing law and disputes", "10. Legea aplicabilă și litigii")}>
          <p>
            {t(
              "These terms are governed by Romanian law. Disputes will be resolved by the competent courts of Romania. Consumers may also use the EU Online Dispute Resolution platform (ec.europa.eu/consumers/odr) and the Romanian consumer authority (ANPC, anpc.ro).",
              "Acești termeni sunt guvernați de legea română. Litigiile vor fi soluționate de instanțele competente din România. Consumatorii pot folosi și platforma UE de Soluționare Online a Litigiilor (ec.europa.eu/consumers/odr) și autoritatea pentru protecția consumatorilor (ANPC, anpc.ro).",
            )}
          </p>
        </Section>

        <Section heading={t("11. Contact", "11. Contact")}>
          <p>
            {t("Questions can be sent to", "Întrebările pot fi trimise la")}{" "}
            <a className="text-primary underline-offset-4 hover:underline" href="mailto:hello@vortexhub.ro">
              hello@vortexhub.ro
            </a>
            .
          </p>
        </Section>
      </section>
    </SiteLayout>
  );
}

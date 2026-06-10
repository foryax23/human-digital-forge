import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CompanyDetails } from "@/components/shared/CompanyDetails";
import { useI18n } from "@/i18n";

const title = "Privacy Policy | Vortex Hub";
const description = "How Vortex Hub collects, uses and protects personal data, and your rights under GDPR.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://vortexhub.dev/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://vortexhub.dev/privacy" }],
  }),
  component: PrivacyPage,
});

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-serif text-xl text-foreground">{heading}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function PrivacyPage() {
  const { t } = useI18n();

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Legal", "Legal")}
        title={t("Privacy Policy", "Politica de confidențialitate")}
        description={t(
          "This policy explains how we process your personal data in line with the EU General Data Protection Regulation (GDPR) and applicable Romanian law. Please review it with your legal advisor before launch.",
          "Această politică explică modul în care prelucrăm datele tale cu caracter personal în conformitate cu Regulamentul general UE privind protecția datelor (GDPR) și legislația română aplicabilă. Te rugăm să o revizuiești cu consilierul tău juridic înainte de lansare.",
        )}
      />
      <section className="mx-auto max-w-3xl space-y-10 px-4 py-16 sm:px-6 lg:px-8">
        <Section heading={t("1. Data controller", "1. Operatorul de date")}>
          <p>
            {t(
              "The controller responsible for processing your personal data is:",
              "Operatorul responsabil pentru prelucrarea datelor tale cu caracter personal este:",
            )}
          </p>
          <CompanyDetails />
        </Section>

        <Section heading={t("2. Data we collect", "2. Datele pe care le colectăm")}>
          <p>
            {t(
              "We collect: identification and contact data you provide through forms (name, email, phone, company); account data when you register; the content of your messages and project requests; files you upload to your account; and technical data such as IP address, device and browser information and usage data collected via cookies.",
              "Colectăm: date de identificare și contact pe care le furnizezi prin formulare (nume, email, telefon, companie); date de cont la înregistrare; conținutul mesajelor și al solicitărilor de proiect; fișierele pe care le încarci în cont; și date tehnice precum adresa IP, informații despre dispozitiv și browser și date de utilizare colectate prin cookie-uri.",
            )}
          </p>
        </Section>

        <Section heading={t("3. Purposes and legal bases", "3. Scopuri și temeiuri legale")}>
          <p>
            {t(
              "We process your data to: respond to enquiries and provide our services (performance of a contract); manage accounts and deliver projects (contract); send service communications and, where permitted, marketing (consent or legitimate interest); comply with legal and accounting obligations (legal obligation); and secure and improve the platform (legitimate interest).",
              "Prelucrăm datele tale pentru a: răspunde solicitărilor și a furniza serviciile noastre (executarea unui contract); gestiona conturile și livra proiecte (contract); trimite comunicări de serviciu și, unde este permis, marketing (consimțământ sau interes legitim); respecta obligațiile legale și contabile (obligație legală); și securiza și îmbunătăți platforma (interes legitim).",
            )}
          </p>
        </Section>

        <Section heading={t("4. Uploaded files", "4. Fișiere încărcate")}>
          <p>
            {t(
              "Files you upload are treated as confidential. They are stored securely and are never sent to third-party AI tools or other external services without a clear, separate consent process.",
              "Fișierele pe care le încarci sunt tratate ca fiind confidențiale. Sunt stocate în siguranță și nu sunt trimise niciodată instrumentelor AI terțe sau altor servicii externe fără un proces clar și separat de consimțământ.",
            )}
          </p>
        </Section>

        <Section heading={t("5. Sharing and processors", "5. Partajare și persoane împuternicite")}>
          <p>
            {t(
              "We share data only with trusted service providers acting on our behalf (such as hosting, database, email and payment providers), bound by data processing agreements. We do not sell your personal data.",
              "Partajăm date doar cu furnizori de servicii de încredere care acționează în numele nostru (precum furnizori de găzduire, baze de date, email și plăți), obligați prin acorduri de prelucrare a datelor. Nu vindem datele tale cu caracter personal.",
            )}
          </p>
        </Section>

        <Section heading={t("6. International transfers", "6. Transferuri internaționale")}>
          <p>
            {t(
              "Where data is transferred outside the European Economic Area, we ensure appropriate safeguards are in place, such as adequacy decisions or Standard Contractual Clauses.",
              "Atunci când datele sunt transferate în afara Spațiului Economic European, ne asigurăm că există garanții adecvate, precum decizii privind caracterul adecvat sau Clauze Contractuale Standard.",
            )}
          </p>
        </Section>

        <Section heading={t("7. Retention", "7. Păstrarea datelor")}>
          <p>
            {t(
              "We keep personal data only as long as necessary for the purposes above or as required by law (for example, accounting records). When no longer needed, data is securely deleted or anonymised.",
              "Păstrăm datele cu caracter personal doar atât timp cât este necesar pentru scopurile de mai sus sau conform cerințelor legale (de exemplu, evidențele contabile). Când nu mai sunt necesare, datele sunt șterse în siguranță sau anonimizate.",
            )}
          </p>
        </Section>

        <Section heading={t("8. Your rights", "8. Drepturile tale")}>
          <p>
            {t(
              "Under GDPR you have the right to access, rectify, erase and restrict processing of your data, the right to data portability, the right to object, and the right to withdraw consent at any time. To exercise any of these rights, contact us using the details below.",
              "Conform GDPR ai dreptul de acces, rectificare, ștergere și restricționare a prelucrării datelor, dreptul la portabilitatea datelor, dreptul de a te opune și dreptul de a-ți retrage consimțământul oricând. Pentru a exercita oricare dintre aceste drepturi, contactează-ne folosind datele de mai jos.",
            )}
          </p>
          <p>
            {t(
              "You also have the right to lodge a complaint with the Romanian supervisory authority (ANSPDCP, www.dataprotection.ro).",
              "Ai de asemenea dreptul de a depune o plângere la autoritatea de supraveghere din România (ANSPDCP, www.dataprotection.ro).",
            )}
          </p>
        </Section>

        <Section heading={t("9. Security", "9. Securitate")}>
          <p>
            {t(
              "We apply appropriate technical and organisational measures to protect your data against unauthorised access, loss or alteration.",
              "Aplicăm măsuri tehnice și organizatorice adecvate pentru a-ți proteja datele împotriva accesului neautorizat, pierderii sau alterării.",
            )}
          </p>
        </Section>

        <Section heading={t("10. Cookies", "10. Cookie-uri")}>
          <p>
            {t(
              "We use cookies as described in our Cookie Policy, where you can also manage your preferences.",
              "Folosim cookie-uri conform Politicii noastre de cookie-uri, unde îți poți gestiona și preferințele.",
            )}
          </p>
        </Section>

        <Section heading={t("11. Contact", "11. Contact")}>
          <p>
            {t("For any privacy question, contact us at", "Pentru orice întrebare privind confidențialitatea, contactează-ne la")}{" "}
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

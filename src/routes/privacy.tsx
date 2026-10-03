import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CompanyDetails } from "@/components/shared/CompanyDetails";
import { useI18n } from "@/i18n";
import {
  DEEP_FEEDBACK_RETENTION_MONTHS,
  DEEP_RETENTION_DAYS,
  LEAD_RETENTION_MONTHS,
  PRIVACY_EMAIL,
} from "@/lib/scan/legal/lead-notice";
import { SCAN_USER_AGENT } from "@/lib/scan/legal/bot";

const title = "Privacy Policy | Vortex Hub";
const description =
  "How Vortex Hub collects, uses and protects personal data, what Vortex Scan reads about a company, and your rights under GDPR.";

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

function Section({
  id,
  heading,
  children,
}: {
  id?: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24 space-y-3">
      <h2 className="type-h3 text-fg">{heading}</h2>
      <div className="type-body space-y-3 text-fg-2">{children}</div>
    </div>
  );
}

function Subsection({
  id,
  heading,
  children,
}: {
  id?: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24 space-y-2 pt-2">
      <h3 className="type-h4 text-fg">{heading}</h3>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-fg-3">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="whitespace-pre-wrap rounded-lg border border-line-2 bg-s1 px-4 py-3 type-code text-xs text-fg [overflow-wrap:anywhere]">
      {children}
    </pre>
  );
}

function Mail() {
  return (
    <a
      className="text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
      href={`mailto:${PRIVACY_EMAIL}`}
    >
      {PRIVACY_EMAIL}
    </a>
  );
}

function PrivacyPage() {
  const { t } = useI18n();

  return (
    <SiteLayout>
      <PageHero
        kicker={t("Legal", "Legal")}
        title={t("Privacy Policy", "Politica de confidențialitate")}
        description={t(
          "How we process personal data on vortexhub.dev, including in Vortex Scan and its deep research, under the EU General Data Protection Regulation (GDPR) and Romanian law, and what rights you have. Last updated: 3 October 2026 (deep research added).",
          "Cum prelucrăm datele cu caracter personal pe vortexhub.dev, inclusiv în Vortex Scan și în cercetarea aprofundată, conform Regulamentului general privind protecția datelor (GDPR) și legislației române, și ce drepturi ai. Ultima actualizare: 3 octombrie 2026 (am adăugat cercetarea aprofundată).",
        )}
      />
      <section className="container-vx section-y">
        <div className="max-w-3xl space-y-10">
          <Section heading={t("1. Data controller", "1. Operatorul de date")}>
            <p>
              {t(
                "The controller responsible for processing your personal data is:",
                "Operatorul responsabil pentru prelucrarea datelor tale cu caracter personal este:",
              )}
            </p>
            <CompanyDetails />
            <p>
              {t(
                "Vortex Hub S.R.L. is represented by Mihai Dandea, Director.",
                "Vortex Hub S.R.L. este reprezentată de Mihai Dandea, Director.",
              )}
            </p>
            <p>
              {t(
                "Contact person for data protection: Mihai Dandea, Director, at ",
                "Persoana de contact pentru protecția datelor: Mihai Dandea, Director, la ",
              )}
              <Mail />.
            </p>
          </Section>

          <Section heading={t("2. Data we collect", "2. Datele pe care le colectăm")}>
            <p>
              {t(
                "We collect: identification and contact data you provide through forms (name, email, phone, company); account data when you register; the content of your messages and project requests; files you upload to your account; and technical data such as IP address, device and browser information and usage data collected via cookies.",
                "Colectăm: date de identificare și contact pe care le furnizezi prin formulare (nume, email, telefon, companie); date de cont la înregistrare; conținutul mesajelor și al solicitărilor de proiect; fișierele pe care le încarci în cont; și date tehnice precum adresa IP, informații despre dispozitiv și browser și date de utilizare colectate prin cookie-uri.",
              )}
            </p>
            <p>
              {t(
                "What Vortex Scan reads about a company, what we keep when you download a report and what deep research records are explained in section 4.",
                "Ce citește Vortex Scan despre o firmă, ce păstrăm când descarci un raport și ce înregistrează cercetarea aprofundată explicăm în secțiunea 4.",
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
            <p>
              {t(
                "For deep research (section 4): the report is made at your request, under the report terms you accept (article 6(1)(b) GDPR); marketing messages only if you tick the optional box (consent, article 6(1)(a) GDPR and article 12 of Law 506/2004); spend limits, abuse prevention and security (legitimate interest, article 6(1)(f)); a call you ask for with “Sună-mă” (article 6(1)(b)).",
                "Pentru cercetarea aprofundată (secțiunea 4): raportul îl facem la cererea ta, după termenii raportului pe care îi accepți (art. 6 alin. (1) lit. b GDPR); mesaje de marketing doar dacă bifezi căsuța opțională (consimțământ, art. 6 alin. (1) lit. a GDPR și art. 12 din Legea 506/2004); limitele de cost, prevenirea abuzurilor și securitatea (interes legitim, lit. f); o discuție pe care o ceri cu „Sună-mă” (lit. b).",
              )}
            </p>
          </Section>

          <Section
            id="vortex-scan"
            heading={t("4. Vortex Scan: analysing a company", "4. Vortex Scan: analiza unei firme")}
          >
            <p>
              {t(
                "Vortex Scan (vortexhub.dev/scan) analyses a Romanian company when a visitor asks for it: the official records, the website and the online presence, plus an improvement plan. This section explains which data we use, where it comes from and what you can do if you don't want your company or your name to appear. It is also the notice required by article 14 GDPR for data we don't receive from you directly.",
                "Vortex Scan (vortexhub.dev/scan) analizează o firmă românească atunci când un vizitator o cere: datele oficiale, site-ul și prezența online, plus un plan de îmbunătățire. Secțiunea aceasta explică ce date folosim, de unde le luăm și ce poți face dacă nu vrei să apară firma sau numele tău. Ține loc și de informarea cerută de articolul 14 din GDPR pentru datele pe care nu le primim direct de la tine.",
              )}
            </p>

            <Subsection
              heading={t("What we read from public sources", "Ce citim din surse publice")}
            >
              <List
                items={[
                  t(
                    "Trade Register: name, fiscal code (CUI), county, locality, status and the website the company declared, from the ONRC open data (CC BY 4.0 licence).",
                    "Registrul comerțului: denumirea, codul fiscal (CUI), județul, localitatea, starea firmei și site-ul declarat, din datele deschise ONRC (licență CC BY 4.0).",
                  ),
                  t(
                    "ANAF: legal form, registration number and date, main activity (CAEN), registered address, phone, VAT status and inactive status, from ANAF's public web service. The average headcount from the latest balance sheet ANAF publishes is used only to decide whether we show the registry phone number.",
                    "ANAF: forma juridică, numărul și data înregistrării, activitatea principală (CAEN), adresa sediului, telefonul, plata TVA și starea de inactivitate, din serviciul web public al ANAF. Numărul mediu de angajați din ultimul bilanț publicat de ANAF îl folosim doar ca să decidem dacă afișăm telefonul din registru.",
                  ),
                  t(
                    "The company's website: the homepage, robots.txt, the sitemap and at most 5 internal pages (contact, services, about, prices, terms), plus the links to social networks published on the site.",
                    "Site-ul firmei: pagina principală, robots.txt, sitemap-ul și cel mult 5 pagini interne (contact, servicii, despre noi, prețuri, termeni), plus linkurile către rețelele sociale publicate pe site.",
                  ),
                  t(
                    "Website speed, measured by Google PageSpeed Insights.",
                    "Viteza site-ului, măsurată de Google PageSpeed Insights.",
                  ),
                  t(
                    "When we don't know the website, we look for it: we try addresses made from the company name and may ask the Brave Search engine with the company name and town.",
                    "Când nu știm site-ul, îl căutăm: încercăm adrese formate din numele firmei și putem întreba motorul de căutare Brave Search cu numele firmei și localitatea.",
                  ),
                ]}
              />
            </Subsection>

            <Subsection
              heading={t("What we protect and what we don't do", "Ce protejăm și ce nu facem")}
            >
              <List
                items={[
                  t(
                    "For sole traders (PFA), individual and family businesses (II, IF) and individual practices we show only the name, legal form, status, activity and county. No address, locality, phone or registration number.",
                    "La PFA, întreprinderi individuale și familiale (II, IF) și cabinete individuale afișăm doar numele, forma juridică, starea, activitatea și județul. Fără adresă, localitate, telefon sau număr de înregistrare.",
                  ),
                  t(
                    "The registry phone number appears only for companies with at least 10 employees in the latest balance sheet; for smaller ones it is often the owner's personal number.",
                    "Telefonul din registru apare doar la firmele cu cel puțin 10 angajați în ultimul bilanț; la cele mici este adesea numărul personal al proprietarului.",
                  ),
                  t(
                    "When the registered office is in a flat, we show only the locality and county.",
                    "Când sediul este într-un apartament, afișăm doar localitatea și județul.",
                  ),
                  t(
                    "We don't open pages on Facebook, Instagram, LinkedIn, X, YouTube or TikTok, and we don't use Google Maps. We only note the links the company publishes on its own site.",
                    "Nu deschidem pagini de pe Facebook, Instagram, LinkedIn, X, YouTube sau TikTok și nu folosim Google Maps. Notăm doar linkurile pe care firma le publică pe propriul site.",
                  ),
                  t(
                    "We don't collect employee names, personal emails or data about people from other sources, we don't search by person and we don't build profiles.",
                    "Nu colectăm nume de angajați, e-mailuri personale sau date despre persoane din alte surse, nu căutăm după persoane și nu facem profiluri.",
                  ),
                  t(
                    "The quick scan doesn't use artificial intelligence. Deep research may use it to draft text (section 5). Neither makes automated decisions about people.",
                    "Scanarea rapidă nu folosește inteligență artificială. Cercetarea aprofundată o poate folosi ca să redacteze textul (secțiunea 5). Niciuna nu ia decizii automate despre persoane.",
                  ),
                  t(
                    "We don't contact a company because someone else scanned it, and we don't tell it who asked for the report.",
                    "Nu contactăm o firmă pentru că a scanat-o altcineva și nu îi spunem cine a cerut raportul.",
                  ),
                ]}
              />
            </Subsection>

            <Subsection heading={t("Purpose and legal basis", "Scop și temei legal")}>
              <p>
                {t(
                  "The purpose is a business report requested by the visitor and, if they want one, an offer from us. The legal basis for the data about the analysed company is legitimate interest (article 6(1)(f) GDPR). Company data is mostly about a legal person; GDPR applies when it identifies a person, for example the name of a sole trader.",
                  "Scopul este un raport de afaceri cerut de vizitator și, dacă își dorește, o ofertă de la noi. Temeiul pentru datele firmei analizate este interesul legitim (art. 6 alin. (1) lit. f GDPR). Datele unei firme privesc în general o persoană juridică; GDPR se aplică atunci când ele identifică o persoană, de exemplu numele unui PFA.",
                )}
              </p>
              <p>
                {t(
                  "Our legitimate interest assessment, in short:",
                  "Evaluarea interesului legitim, pe scurt:",
                )}
              </p>
              <List
                items={[
                  t(
                    "Interest: to offer, on request, an analysis of a company's online presence with concrete ideas to improve it.",
                    "Interesul: să oferim, la cerere, o analiză a prezenței online a unei firme, cu idei concrete de îmbunătățire.",
                  ),
                  t(
                    "Necessity: we use only company data published by the official registers or by the company on its own site; the analysis can't be done without it.",
                    "Necesitatea: folosim doar date despre firmă publicate de registrele oficiale sau de firmă pe propriul site; fără ele analiza nu se poate face.",
                  ),
                  t(
                    "Balance: the data is professional, not sensitive and already public; we cut it to the minimum with the rules above, respect robots.txt and every objection, and send no commercial messages to the companies we analyse.",
                    "Echilibrul: datele sunt profesionale, nu sunt sensibile și sunt deja publice; le reducem la minimum prin regulile de mai sus, respectăm robots.txt și orice opoziție și nu trimitem mesaje comerciale firmelor analizate.",
                  ),
                ]}
              />
              <p>
                {t(
                  "We send the full assessment on request.",
                  "Evaluarea completă o trimitem la cerere.",
                )}
              </p>
            </Subsection>

            <Subsection
              id="vortex-scan-pdf"
              heading={t("If you download the PDF report", "Dacă descarci raportul PDF")}
            >
              <p>
                {t(
                  "To download the report we ask for your email and, optionally, your name. We keep them with the analysed company and the scan summary (business type, digital score, estimated savings, recommended plan, website and CUI), together with a record of the information notice you saw (version, text, time) and of your marketing choice.",
                  "Ca să descarci raportul îți cerem e-mailul și, opțional, numele. Le păstrăm împreună cu firma analizată și rezumatul scanării (tipul afacerii, scorul digital, economia estimată, planul recomandat, site-ul și CUI-ul), plus o evidență a notei de informare pe care ai văzut-o (versiunea, textul, ora) și a alegerii tale privind marketingul.",
                )}
              </p>
              <List
                items={[
                  t(
                    "Legal basis: your request to receive the report (article 6(1)(b) GDPR) and our legitimate interest in keeping a record of the reports downloaded (article 6(1)(f)).",
                    "Temei: cererea ta de a primi raportul (art. 6 alin. (1) lit. b GDPR) și interesul nostru legitim de a ține evidența rapoartelor descărcate (lit. f).",
                  ),
                  t(
                    "The report is created in your browser and downloaded right away; we don't email it.",
                    "Raportul se creează în browserul tău și se descarcă imediat; nu îl trimitem pe e-mail.",
                  ),
                  t(
                    "We send ideas and offers by email only if you tick the optional box in the form (article 6(1)(a) GDPR and article 12 of Law 506/2004). You get the report either way, and you can withdraw your consent at any time by writing to us.",
                    "Îți trimitem idei și oferte pe e-mail doar dacă bifezi căsuța opțională din formular (art. 6 alin. (1) lit. a GDPR și art. 12 din Legea 506/2004). Primești raportul oricum și îți poți retrage acordul oricând, cu un mesaj către noi.",
                  ),
                  t(
                    "Requests saved before 3 October 2026 are treated as having no marketing consent.",
                    "Cererile salvate înainte de 3 octombrie 2026 le tratăm ca fiind fără acord de marketing.",
                  ),
                ]}
              />
            </Subsection>

            <Subsection
              id="vortex-scan-deep"
              heading={t("Deep research (Cercetare aprofundată)", "Cercetare aprofundată")}
            >
              <p>
                {t(
                  "Deep research is a longer report about one company that a signed-in account asks for at /scan/deep. It is also the article 14 GDPR notice for the data we read about the researched company.",
                  "Cercetarea aprofundată este un raport mai lung despre o firmă, cerut de un cont autentificat pe /scan/deep. Ține loc și de informarea cerută de articolul 14 din GDPR pentru datele pe care le citim despre firma cercetată.",
                )}
              </p>
              <p>{t("What we record about you:", "Ce înregistrăm despre tine:")}</p>
              <List
                items={[
                  t(
                    "Your account ID and e-mail (from the sign-in), your relationship to the company (owner, employee, client or supplier, competitor, other), the company's CUI, the report language and your answers to the optional questions (estimated turnover, clients a month, average ticket, hour value).",
                    "ID-ul contului și e-mailul tău (de la autentificare), relația ta cu firma (proprietar, angajat, client sau furnizor, concurent, altceva), CUI-ul firmei, limba raportului și răspunsurile tale la întrebările opționale (cifra de afaceri estimată, clienți pe lună, valoarea medie a unei vânzări, valoarea unei ore).",
                  ),
                  t(
                    "The run record: the report, when it was made, its status, its verification code, the cost of the AI calls and the step timings; the record of the notice and report terms you accepted (version, text, time) and of your marketing choice. We store no IP address.",
                    "Evidența cercetării: raportul, când a fost făcut, starea, codul de verificare, costul apelurilor AI și duratele pașilor; evidența notei de informare și a termenilor raportului pe care i-ai acceptat (versiunea, textul, ora) și a alegerii tale privind marketingul. Nu păstrăm adresa IP.",
                  ),
                  t(
                    "Feedback you send (useful or not, a reported error, a correction, a rival removed or added, the price question) and, if you ask for a call with “Sună-mă”, your phone number and the time of day you prefer.",
                    "Părerile pe care ni le trimiți (util sau nu, o eroare raportată, o corectare, un concurent scos sau adăugat, întrebarea despre preț) și, dacă ceri o discuție cu „Sună-mă”, numărul tău de telefon și momentul zilei pe care îl preferi.",
                  ),
                  t(
                    "In your browser only: a journal of the research in progress and the finished report (so a closed tab can continue), until you delete it with “Șterge din acest browser” or sign out.",
                    "Doar în browserul tău: un jurnal al cercetării în curs și raportul terminat (ca o filă închisă să poată continua), până îl ștergi cu „Șterge din acest browser” sau te deconectezi.",
                  ),
                ]}
              />
              <p>{t("What we read about the company:", "Ce citim despre firmă:")}</p>
              <List
                items={[
                  t(
                    "ANAF (company record and the annual accounts filed for 2019 to 2025), the Trade Register open data (ONRC), the Ministry of Finance annual accounts of similar companies (data.gov.ro, CC BY 4.0), the court portal (portal.just.ro: case counts by role and category only), EU tenders (TED), and Google PageSpeed for the website's speed.",
                    "ANAF (datele firmei și bilanțurile depuse pentru 2019–2025), datele deschise ale Registrului Comerțului (ONRC), bilanțurile firmelor similare de la Ministerul Finanțelor (data.gov.ro, CC BY 4.0), portalul instanțelor (portal.just.ro: doar numărul de dosare pe rol și categorie), licitațiile europene (TED) și Google PageSpeed pentru viteza site-ului.",
                  ),
                  t(
                    "At most 30 public pages of the company's own website, and only the homepage of the similar companies named in the report (see the robot below). A Google rating, when shown, is displayed only during your session and never stored, sent to the AI or printed.",
                    "Cel mult 30 de pagini publice ale site-ului firmei și doar pagina principală a firmelor similare numite în raport (vezi robotul de mai jos). O notă Google, când apare, e afișată doar în sesiunea ta și nu e păstrată, trimisă la AI sau tipărită.",
                  ),
                ]}
              />
              <p>
                {t(
                  "Personal data we may meet by accident, and what we do with it: we refuse sole traders, individual and family businesses (PFA, II, IF) entirely; for a registered office in a flat we show only the locality and county; names found on websites are not kept: we keep counts and job titles only (for example “3 medici”), never names; nothing from court files is stored, only counts by role and category; personal e-mail addresses are counted, never shown. We don't build profiles of people and we don't contact a company because someone researched it.",
                  "Date personale pe care le putem întâlni întâmplător și ce facem cu ele: refuzăm complet PFA-urile, întreprinderile individuale și familiale (PFA, II, IF); pentru un sediu într-un apartament arătăm doar localitatea și județul; numele găsite pe site-uri nu le păstrăm: păstrăm doar numere și titluri de posturi (de exemplu „3 medici”), niciodată nume; din dosarele de instanță nu păstrăm nimic, doar numărul lor pe rol și categorie; adresele de e-mail personale le numărăm, nu le arătăm. Nu facem profiluri despre persoane și nu contactăm o firmă pentru că a cercetat-o cineva.",
                )}
              </p>
              <p>
                {t(
                  "Who sees a report: only the account that made it and, while reports are kept on our servers, Vortex Hub's administrators for support and abuse handling. We don't tell the company who researched it. To object to the research of your company or to ask for a correction or deletion, write to ",
                  "Cine vede un raport: doar contul care l-a făcut și, cât timp rapoartele sunt păstrate pe serverele noastre, administratorii Vortex Hub, pentru asistență și prevenirea abuzurilor. Nu spunem firmei cine a cercetat-o. Ca să te opui cercetării firmei tale sau să ceri o corectare sau o ștergere, scrie-ne la ",
                )}
                <Mail />
                {t(
                  " (subject “Cercetare aprofundată”); we answer within one month.",
                  " (subiect „Cercetare aprofundată”); răspundem în cel mult o lună.",
                )}
              </p>
            </Subsection>

            <Subsection heading={t("How long we keep it", "Cât păstrăm")}>
              <List
                items={[
                  t(
                    "The scan result stays in your browser until you close the tab. Our servers don't save it.",
                    "Rezultatul scanării rămâne în browserul tău până închizi fila. Serverele noastre nu îl salvează.",
                  ),
                  t(
                    "ANAF answers stay in server memory for at most 10 minutes, so we don't ask ANAF twice about the same company.",
                    "Răspunsurile ANAF stau în memoria serverului cel mult 10 minute, ca să nu întrebăm ANAF de două ori despre aceeași firmă.",
                  ),
                  t(
                    `Report requests (email, name, summary): ${LEAD_RETENTION_MONTHS} months from the last contact, then we delete them.`,
                    `Cererile de raport (e-mail, nume, rezumat): ${LEAD_RETENTION_MONTHS} de luni de la ultimul contact, apoi le ștergem.`,
                  ),
                  t(
                    "Marketing consent: until you withdraw it. The record of the consent is kept as long as the request.",
                    "Acordul de marketing: până îl retragi. Evidența acordului o păstrăm cât păstrăm cererea.",
                  ),
                  t(
                    `Deep research runs (the report, the notice and terms record) and the records of paid AI calls: ${DEEP_RETENTION_DAYS} days, then we delete them automatically.`,
                    `Cercetările aprofundate (raportul, evidența notei și a termenilor) și evidența apelurilor AI plătite: ${DEEP_RETENTION_DAYS} de zile, apoi le ștergem automat.`,
                  ),
                  t(
                    `Feedback on a deep research: ${DEEP_FEEDBACK_RETENTION_MONTHS} months. Call requests (“Sună-mă”): ${LEAD_RETENTION_MONTHS} months, like other requests.`,
                    `Părerile despre o cercetare aprofundată: ${DEEP_FEEDBACK_RETENTION_MONTHS} luni. Cererile de discuție („Sună-mă”): ${LEAD_RETENTION_MONTHS} de luni, ca celelalte cereri.`,
                  ),
                  t(
                    "We keep no raw web pages: the text of the pages read is used during the research and then dropped; the report keeps short quotes of at most 200 characters (120 on sites that reserve text and data mining).",
                    "Nu păstrăm pagini web întregi: textul paginilor citite e folosit în timpul cercetării și apoi aruncat; raportul păstrează citate scurte de cel mult 200 de caractere (120 pe site-urile care își rezervă extragerea de text și date).",
                  ),
                ]}
              />
            </Subsection>

            <Subsection heading={t("Objection and removal", "Opoziție și eliminare")}>
              <p>
                {t(
                  "Do you represent a company that doesn't want to be analysed, are you named in a report, or do you want us to delete your data? Write to ",
                  "Reprezinți o firmă care nu vrea să fie analizată, apari într-un raport sau vrei să îți ștergem datele? Scrie-ne la ",
                )}
                <Mail />
                {t(
                  " with the subject “Vortex Scan removal” and tell us the CUI or the domain.",
                  " cu subiectul „Eliminare Vortex Scan” și spune-ne CUI-ul sau domeniul.",
                )}
              </p>
              <List
                items={[
                  t(
                    "For a company, write from an address on its domain (for example office@company.ro) so we know you represent it. If you don't have one, we give you a verification code to place on the site.",
                    "Pentru o firmă, scrie de pe o adresă de pe domeniul ei (de exemplu office@firma.ro), ca să știm că o reprezinți. Dacă nu ai o astfel de adresă, îți dăm un cod de verificare pe care îl pui pe site.",
                  ),
                  t(
                    "We answer within one month, as GDPR requires. We delete the data from the report requests, take the company out of the site search at the next index update and confirm when it's done.",
                    "Răspundem în cel mult o lună, cum cere GDPR. Ștergem datele din cererile de raport, scoatem firma din căutarea de pe site la următoarea actualizare a indexului și îți confirmăm când am terminat.",
                  ),
                  t(
                    "For a website, the quickest way is a rule in robots.txt (below): the robot stops on its own, without you writing to us.",
                    "Pentru un site, cea mai rapidă cale este o regulă în robots.txt (mai jos): robotul se oprește singur, fără să ne scrii.",
                  ),
                  t(
                    "You can also complain to the Romanian supervisory authority, ANSPDCP (www.dataprotection.ro).",
                    "Poți depune și o plângere la ANSPDCP, autoritatea de supraveghere din România (www.dataprotection.ro).",
                  ),
                ]}
              />
            </Subsection>

            <Subsection
              id="vortex-scan-bot"
              heading={t("The VortexScan robot", "Robotul VortexScan")}
            >
              <p>
                {t(
                  "When someone analyses a website, our server visits it with this identifier:",
                  "Când cineva analizează un site, serverul nostru îl vizitează cu acest identificator:",
                )}
              </p>
              <Code>{SCAN_USER_AGENT}</Code>
              <p>{t("The quick scan:", "Scanarea rapidă:")}</p>
              <List
                items={[
                  t(
                    "It reads robots.txt first. If the rules for VortexScan forbid the whole site, it stops there.",
                    "Citește întâi robots.txt. Dacă regulile pentru VortexScan interzic tot site-ul, se oprește acolo.",
                  ),
                  t(
                    "It opens the homepage once, at the visitor's request, then the sitemap and at most 5 internal pages that robots.txt allows (the VortexScan rules or, without them, the rules for all robots).",
                    "Deschide pagina principală o singură dată, la cererea vizitatorului, apoi sitemap-ul și cel mult 5 pagini interne pe care robots.txt le permite (regulile pentru VortexScan sau, în lipsa lor, cele pentru toți roboții).",
                  ),
                  t(
                    "It checks the size of a few images and files with HEAD requests.",
                    "Verifică dimensiunea câtorva imagini și fișiere prin cereri HEAD.",
                  ),
                  t(
                    "It makes at most 2 requests at a time to a site and stops after about 15 seconds.",
                    "Face cel mult 2 cereri simultane către un site și se oprește după aproximativ 15 secunde.",
                  ),
                  t(
                    "It stops at logins, CAPTCHAs and bot checks and never tries to get around them. It uses no proxies and never hides its identity.",
                    "Se oprește la autentificare, CAPTCHA sau verificări anti-bot și nu încearcă să le ocolească. Nu folosește proxy-uri și nu își ascunde identitatea.",
                  ),
                  t(
                    "Speed is measured by Google PageSpeed Insights, with Google's Lighthouse robot. If you block VortexScan, we don't send your site there either.",
                    "Viteza o măsoară Google PageSpeed Insights, cu robotul Lighthouse al Google. Dacă blochezi VortexScan, nu trimitem site-ul nici acolo.",
                  ),
                ]}
              />
              <p>{t("Deep research:", "Cercetarea aprofundată:")}</p>
              <List
                items={[
                  t(
                    "It reads robots.txt before the first page on every host (the VortexScan rules or, without them, the rules for all robots) and honours Crawl-delay.",
                    "Citește robots.txt înaintea primei pagini pe fiecare site (regulile pentru VortexScan sau, în lipsa lor, cele pentru toți roboții) și respectă Crawl-delay.",
                  ),
                  t(
                    "It reads at most 30 public pages of the company's site per research, one request at a time, at least 1 second apart, and the homepage only once. For the similar companies named in the report (at most 6 in one research) it reads only the homepage, the same way.",
                    "Citește cel mult 30 de pagini publice ale site-ului firmei la o cercetare, câte o cerere pe rând, la cel puțin o secundă distanță, iar pagina principală o singură dată. Pentru firmele similare numite în raport (cel mult 6 la o cercetare) citește doar pagina principală, la fel.",
                  ),
                  t(
                    "It never goes around logins, CAPTCHAs or bot checks: at a refusal (401, 403, repeated 429) it stops and notes “site-ul blochează accesul automat”.",
                    "Nu ocolește niciodată autentificări, CAPTCHA sau verificări anti-bot: la un refuz (401, 403, 429 repetat) se oprește și notează „site-ul blochează accesul automat”.",
                  ),
                  t(
                    "On sites that reserve text and data mining it keeps only short facts and quotes of at most 120 characters, and no page text is sent to the AI.",
                    "Pe site-urile care își rezervă extragerea de text și date păstrează doar fapte și citate scurte, de cel mult 120 de caractere, și nu trimite text din pagini la AI.",
                  ),
                  t(
                    "It never opens pages on social networks or company directories.",
                    "Nu deschide niciodată pagini de pe rețele sociale sau din cataloage de firme.",
                  ),
                ]}
              />
              <p>
                {t(
                  "To block the robot completely, add this to robots.txt:",
                  "Ca să blochezi complet robotul, adaugă în robots.txt:",
                )}
              </p>
              <Code>{"User-agent: VortexScan\nDisallow: /"}</Code>
              <p>
                {t(
                  "To ask for removal or correction of data, write to Mihai Dandea, Director, at ",
                  "Ca să ceri eliminarea sau corectarea datelor, scrie-i lui Mihai Dandea, Director, la ",
                )}
                <Mail />.
              </p>
            </Subsection>
          </Section>

          <Section
            id="ai"
            heading={t(
              "5. Artificial intelligence (deep research)",
              "5. Inteligența artificială (cercetarea aprofundată)",
            )}
          >
            <p>
              {t(
                "Deep research may draft the text of the report with Claude, made by Anthropic, which works for us as a processor. Anthropic receives only facts about the researched company (from registers and its filed accounts) and public text from its website. Your e-mail, name and phone, and the data of the people who download reports, are never sent to it.",
                "Cercetarea aprofundată poate redacta textul raportului cu Claude, de la Anthropic, care lucrează pentru noi ca persoană împuternicită. Anthropic primește doar fapte despre firma cercetată (din registre și din bilanțurile depuse) și text public de pe site-ul ei. E-mailul, numele și telefonul tău și datele celor care descarcă rapoarte nu îi sunt trimise niciodată.",
              )}
            </p>
            <p>
              {t(
                "Every AI sentence must cite a fact and is checked by code before it is shown; numbers are calculated by code, not by the AI. AI text is labelled on the screen and in the PDF. Without AI the report is built by rules and labelled “Analiză pe reguli, fără AI”. No automated decision is taken about you or about people.",
                "Fiecare propoziție scrisă de AI trebuie să citeze un fapt și e verificată de cod înainte să fie afișată; cifrele le calculează codul, nu AI-ul. Textul redactat cu AI e marcat pe ecran și în PDF. Fără AI, raportul e construit pe reguli și marcat „Analiză pe reguli, fără AI”. Nu se ia nicio decizie automată despre tine sau despre persoane.",
              )}
            </p>
          </Section>

          <Section heading={t("6. Uploaded files", "6. Fișiere încărcate")}>
            <p>
              {t(
                "Files you upload are treated as confidential. They are stored securely and are never sent to third-party AI tools or other external services without a clear, separate consent process.",
                "Fișierele pe care le încarci sunt tratate ca fiind confidențiale. Sunt stocate în siguranță și nu sunt trimise niciodată instrumentelor AI terțe sau altor servicii externe fără un proces clar și separat de consimțământ.",
              )}
            </p>
          </Section>

          <Section
            heading={t("7. Sharing and processors", "7. Partajare și persoane împuternicite")}
          >
            <p>
              {t(
                "We share data only with trusted service providers acting on our behalf (such as hosting, database, email and payment providers), bound by data processing agreements. We do not sell your personal data.",
                "Partajăm date doar cu furnizori de servicii de încredere care acționează în numele nostru (precum furnizori de găzduire, baze de date, email și plăți), obligați prin acorduri de prelucrare a datelor. Nu vindem datele tale cu caracter personal.",
              )}
            </p>
            <p>
              {t(
                "For Vortex Scan: Lovable and Cloudflare host the site and answer the DNS lookups; Supabase stores the report requests; Google PageSpeed Insights receives the address of the analysed website; Brave Search receives the company name and town when we look for a website. ANAF and ONRC are public sources, not processors.",
                "Pentru Vortex Scan: Lovable și Cloudflare găzduiesc site-ul și răspund la interogările DNS; Supabase stochează cererile de raport; Google PageSpeed Insights primește adresa site-ului analizat; Brave Search primește numele firmei și localitatea când căutăm un site. ANAF și ONRC sunt surse publice, nu persoane împuternicite.",
              )}
            </p>
            <p>
              {t(
                "For deep research, also: Supabase stores the run records, feedback and call requests; Anthropic (United States) drafts the report text from company facts and public website text, under the EU-US Data Privacy Framework or standard contractual clauses; Google Places, only when we turn on the display of a Google rating, receives the company name and town.",
                "Pentru cercetarea aprofundată, în plus: Supabase stochează evidența cercetărilor, părerile și cererile de discuție; Anthropic (Statele Unite) redactează textul raportului din fapte despre firmă și text public de pe site, în baza Cadrului UE-SUA privind protecția datelor sau a clauzelor contractuale standard; Google Places, doar când activăm afișarea notei Google, primește numele firmei și localitatea.",
              )}
            </p>
            {/* OWNER DECISION PENDING (plan D22): Lovable's built-in visitor statistics. Remove this
                paragraph if the owner turns them off in Lovable; keep it while they run. */}
            <p>
              {t(
                "Our hosting platform, Lovable, may add its own visitor statistics to our pages (a script served from our domain as /~flock.js, reporting to /~api/analytics), which count page visits for us. We are reviewing whether to keep them; while they run they are listed here and in the Cookie Policy.",
                "Platforma noastră de găzduire, Lovable, poate adăuga propriile statistici despre vizitatori pe paginile noastre (un script servit de pe domeniul nostru ca /~flock.js, care raportează la /~api/analytics), care numără vizitele pentru noi. Analizăm dacă le păstrăm; cât timp funcționează, le menționăm aici și în Politica de cookie-uri.",
              )}
            </p>
          </Section>

          <Section heading={t("8. International transfers", "8. Transferuri internaționale")}>
            <p>
              {t(
                "Where data is transferred outside the European Economic Area, we ensure appropriate safeguards are in place, such as adequacy decisions or Standard Contractual Clauses.",
                "Atunci când datele sunt transferate în afara Spațiului Economic European, ne asigurăm că există garanții adecvate, precum decizii privind caracterul adecvat sau Clauze Contractuale Standard.",
              )}
            </p>
          </Section>

          <Section heading={t("9. Retention", "9. Păstrarea datelor")}>
            <p>
              {t(
                `We keep personal data only as long as necessary for the purposes above or as required by law (for example, accounting records). When no longer needed, data is securely deleted or anonymised. The Vortex Scan periods are listed in section 4: deep research runs and paid AI call records ${DEEP_RETENTION_DAYS} days, feedback ${DEEP_FEEDBACK_RETENTION_MONTHS} months, report and call requests ${LEAD_RETENTION_MONTHS} months, the browser journal until you delete it or sign out.`,
                `Păstrăm datele cu caracter personal doar atât timp cât este necesar pentru scopurile de mai sus sau conform cerințelor legale (de exemplu, evidențele contabile). Când nu mai sunt necesare, datele sunt șterse în siguranță sau anonimizate. Termenele pentru Vortex Scan sunt în secțiunea 4: cercetările aprofundate și evidența apelurilor AI plătite ${DEEP_RETENTION_DAYS} de zile, părerile ${DEEP_FEEDBACK_RETENTION_MONTHS} luni, cererile de raport și de discuție ${LEAD_RETENTION_MONTHS} de luni, jurnalul din browser până îl ștergi sau te deconectezi.`,
              )}
            </p>
          </Section>

          <Section heading={t("10. Your rights", "10. Drepturile tale")}>
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

          <Section heading={t("11. Security", "11. Securitate")}>
            <p>
              {t(
                "We apply appropriate technical and organisational measures to protect your data against unauthorised access, loss or alteration.",
                "Aplicăm măsuri tehnice și organizatorice adecvate pentru a-ți proteja datele împotriva accesului neautorizat, pierderii sau alterării.",
              )}
            </p>
          </Section>

          <Section heading={t("12. Cookies", "12. Cookie-uri")}>
            <p>
              {t(
                "We use cookies as described in our Cookie Policy, where you can also manage your preferences.",
                "Folosim cookie-uri conform Politicii noastre de cookie-uri, unde îți poți gestiona și preferințele.",
              )}
            </p>
            <p>
              {t(
                "Deep research keeps a journal of your research and the company you were about to research in your browser's local storage. Both are strictly necessary for the service you asked for, stay on your device and are deleted when you sign out or press “Șterge din acest browser”. Lovable's visitor statistics, while they run, are described in section 7 and in the Cookie Policy.",
                "Cercetarea aprofundată păstrează în spațiul local al browserului un jurnal al cercetării tale și firma pe care urma să o cercetezi. Ambele sunt strict necesare pentru serviciul cerut, rămân pe dispozitivul tău și se șterg când te deconectezi sau apeși „Șterge din acest browser”. Statisticile Lovable despre vizitatori, cât timp funcționează, sunt descrise în secțiunea 7 și în Politica de cookie-uri.",
              )}
            </p>
          </Section>

          <Section heading={t("13. Contact", "13. Contact")}>
            <p>
              {t(
                "For any privacy question or request, write to",
                "Pentru orice întrebare sau cerere privind datele personale, scrie-ne la",
              )}{" "}
              <Mail />.
            </p>
          </Section>
        </div>
      </section>
    </SiteLayout>
  );
}

import type { Bilingual, Confidence, Fact, SourceId } from "../contracts";

import { bi } from "./format";

/*
 * Labels for facts and sources (client-safe). The AI documents, the "Dovezi"
 * tab and the PDF read the same labels, so a fact says the same thing
 * everywhere. Top-layer wording follows the plan's words table (A8).
 */

const PREDICATE_LABELS: Record<string, Bilingual> = {
  "identity.name": bi("Company name", "Denumirea firmei"),
  "identity.cui": bi("Tax code (CUI)", "Codul fiscal (CUI)"),
  "identity.reg_no": bi("Trade Register number", "Numărul de la Registrul Comerțului"),
  "identity.legal_form": bi("Legal form", "Forma juridică"),
  "identity.status": bi("Status at ANAF", "Starea la ANAF"),
  "identity.caen": bi("Main activity", "Activitatea principală"),
  "identity.seat": bi("Registered office", "Sediul social"),
  "identity.vat_payer": bi("VAT registered", "Plătitor de TVA"),
  "identity.registered_at": bi("Registered on", "Înregistrată la"),
  "identity.website_registry": bi(
    "Website in the Trade Register",
    "Site declarat la Registrul Comerțului",
  ),
  "money.filed": bi("Annual accounts filed", "Bilanț depus"),
  "money.turnover": bi("Turnover", "Cifra de afaceri"),
  "money.revenue_total": bi("Total revenue", "Venituri totale"),
  "money.expenses": bi("Total expenses", "Cheltuieli totale"),
  "money.profit_pretax": bi("Profit before tax", "Profit înainte de impozit (brut)"),
  "money.profit_net": bi("Net profit", "Profit net"),
  "money.receivables": bi("Receivables", "Creanțe (bani de încasat)"),
  "money.debts": bi("Total debts", "Datorii totale"),
  "money.equity": bi("Equity", "Capitaluri proprii"),
  "money.cash": bi("Cash and bank", "Casa și conturi la bănci"),
  "money.caen_rev2": bi("Activity in the annual accounts", "Activitatea din bilanț"),
  "money.margin_pretax": bi(
    "Kept from every 100 lei invoiced, before tax",
    "Din fiecare 100 de lei facturați rămân, înainte de impozit",
  ),
  "money.growth_turnover": bi(
    "Turnover change from the year before",
    "Schimbarea cifrei de afaceri față de anul anterior",
  ),
  "money.growth_turnover_3y": bi(
    "Turnover change over 3 years",
    "Schimbarea cifrei de afaceri în 3 ani",
  ),
  "money.expenses_vs_revenue": bi(
    "Expenses against revenue growth",
    "Cheltuielile față de venituri",
  ),
  "money.profit_change": bi(
    "Profit change from the year before",
    "Schimbarea profitului față de anul anterior",
  ),
  "money.days_to_collect": bi("Days to collect (estimate)", "Zile până la încasare (estimare)"),
  "people.employees": bi(
    "Employees, yearly average (annual accounts)",
    "Salariați, medie (din bilanț)",
  ),
  "people.employees_change": bi(
    "Change in average employees",
    "Schimbarea numărului mediu de salariați",
  ),
  "people.revenue_per_employee": bi("Turnover per employee", "Cifra de afaceri pe salariat"),
  "people.hiring": bi("Hiring on the website", "Angajări anunțate pe site"),
  "people.job_titles": bi("Jobs advertised", "Posturi anunțate"),
  "people.roles": bi("Roles published on the website", "Roluri publicate pe site"),
  "people.departments": bi("Departments published", "Departamente publicate"),
  "people.team_size_published": bi(
    "Team members shown on the website",
    "Membri ai echipei arătați pe site",
  ),
  "people.admin_count": bi("Number of administrators", "Numărul de administratori"),
  "site.url": bi("Website", "Site"),
  "site.status": bi("Website status", "Starea site-ului"),
  "site.proof": bi("Why we think it is the company's site", "De ce credem că e site-ul firmei"),
  "site.https": bi("Secure connection (HTTPS)", "Conexiune securizată (HTTPS)"),
  "site.dns.mx": bi("E-mail on the domain", "E-mail pe domeniul firmei"),
  "site.dns.spf": bi("E-mail sender protection (SPF)", "Protecția expeditorului de e-mail (SPF)"),
  "site.dns.dmarc": bi(
    "E-mail spoofing protection (DMARC)",
    "Protecție împotriva e-mailurilor false (DMARC)",
  ),
  "site.pages_read": bi("Pages read", "Pagini citite"),
  "site.cui.present": bi("Tax code on the website", "Codul fiscal pe site"),
  "site.reg_no.present": bi(
    "Trade Register number on the website",
    "Numărul de la Registrul Comerțului pe site",
  ),
  "site.contact.present": bi("A way to contact the company", "O cale de contact"),
  "site.phone.present": bi("Phone number on the website", "Telefon pe site"),
  "site.email.generic": bi("Company e-mail on the website", "E-mailul firmei pe site"),
  "site.email.personal_count": bi(
    "Personal e-mail addresses (counted, not shown)",
    "Adrese de e-mail personale (numărate, nu arătate)",
  ),
  "site.contact_form.present": bi("Contact form", "Formular de contact"),
  "site.booking.present": bi(
    "Online booking or quote request",
    "Programare sau cerere de ofertă online",
  ),
  "site.booking.provider": bi("Booking service used", "Serviciu de programări folosit"),
  "site.delivery.provider": bi("Delivery platform", "Platformă de livrare"),
  "site.chat.provider": bi("Chat on the website", "Chat pe site"),
  "site.shop.present": bi("Online shop", "Magazin online"),
  "site.analytics.present": bi("Visitor statistics tools", "Statistici despre vizitatori"),
  "site.consent.before_analytics": bi(
    "Statistics start before consent",
    "Statisticile pornesc înainte de acord",
  ),
  "site.legal.privacy": bi("Privacy policy", "Politica de confidențialitate"),
  "site.legal.terms": bi("Terms and conditions", "Termeni și condiții"),
  "site.legal.anpc": bi("Consumer protection links (ANPC)", "Linkurile ANPC"),
  "site.audit.important": bi("Important website issues", "Probleme importante ale site-ului"),
  "site.audit.minor": bi("Minor website issues", "Probleme mărunte ale site-ului"),
  "site.audit.ok": bi("Website checks passed", "Verificări trecute"),
  "site.audit.issue": bi("Website issue", "Problemă a site-ului"),
  "site.tech": bi("Technology seen", "Tehnologie văzută"),
  "site.speed.mobile": bi("Google speed test on a phone", "Testul de viteză Google pe telefon"),
  "site.tdm_reserved": bi(
    "Text-and-data-mining reservation",
    "Rezervare pentru extragerea de text",
  ),
  "offers.services": bi("Services or products listed", "Servicii sau produse listate"),
  "offers.price": bi("Price published", "Preț publicat"),
  "offers.hours": bi("Opening hours", "Program"),
  "offers.booking_method": bi("How to book or order", "Cum se face o programare sau comandă"),
  "offers.promo": bi("Offer published", "Ofertă publicată"),
  "offers.service_area": bi("Area served", "Zona deservită"),
  "presence.social_linked": bi(
    "Social pages linked from the website",
    "Pagini sociale legate de pe site",
  ),
  "presence.google_profile_linked": bi(
    "Google profile linked from the website",
    "Profil Google legat de pe site",
  ),
  "presence.social_only": bi("Only social pages (declared)", "Doar pagini sociale (declarat)"),
  "risk.courts.checked": bi("Court portal checked", "Portalul instanțelor verificat"),
  "risk.courts.as_plaintiff": bi(
    "Cases the company opened (36 months)",
    "Procese deschise de firmă (36 de luni)",
  ),
  "risk.courts.as_defendant": bi(
    "Cases against the company (36 months)",
    "Procese în care firma a fost dată în judecată (36 de luni)",
  ),
  "risk.courts.insolvency_debtor": bi(
    "Insolvency case as debtor",
    "Dosar de insolvență ca debitor",
  ),
  "risk.courts.as_creditor": bi("Cases as creditor", "Dosare în care firma e creditor"),
  "risk.courts.by_category": bi("Cases by type (36 months)", "Dosare pe tipuri (36 de luni)"),
  "risk.ted.awards": bi("EU tenders won", "Licitații europene câștigate"),
  "peers.scope": bi("Compared with", "Comparat cu"),
  "peers.n": bi("Similar firms compared", "Firme similare comparate"),
  "peers.size_band": bi(
    "Size of the firms compared (turnover)",
    "Mărimea firmelor comparate (cifra de afaceri)",
  ),
  "peers.band": bi("Similar firms", "Firme similare"),
  "peers.rank": bi("Position among similar firms", "Locul printre firmele similare"),
  "peers.rival": bi("Rival", "Concurent"),
  "competitors.site": bi("Rival's website", "Site-ul concurentului"),
};

/** "Cifra de afaceri în 2025" for "money.turnover.2025"; the predicate label otherwise. */
export function factLabel(fact: Pick<Fact, "id" | "predicate">, lang: "ro" | "en"): string {
  const base = PREDICATE_LABELS[fact.predicate]?.[lang] ?? fact.predicate;
  const year = /\.((?:19|20)\d{2})$/.exec(fact.id)?.[1];
  if (year) return lang === "ro" ? `${base} în ${year}` : `${base} in ${year}`;
  return base;
}

export const SOURCE_LABELS: Record<SourceId, Bilingual> = {
  anaf_v9: bi(
    "ANAF, VAT registry (public API)",
    "ANAF, registrul plătitorilor de TVA (API public)",
  ),
  anaf_bilant: bi(
    "Ministry of Finance, annual accounts (ANAF)",
    "Ministerul Finanțelor, bilanț (ANAF)",
  ),
  mf_bulk: bi(
    "Ministry of Finance, annual accounts (data.gov.ro, CC BY 4.0)",
    "Ministerul Finanțelor, situații financiare (data.gov.ro, CC BY 4.0)",
  ),
  onrc: bi(
    "Trade Register, open data (data.gov.ro, CC BY 4.0)",
    "Registrul Comerțului, date deschise (data.gov.ro, CC BY 4.0)",
  ),
  courts: bi("Romanian court portal (portal.just.ro)", "Portalul instanțelor (portal.just.ro)"),
  ted: bi("EU public tenders (TED)", "Licitații publice europene (TED)"),
  site: bi("The company's website", "Site-ul firmei"),
  audit: bi("Vortex website checks", "Verificările Vortex ale site-ului"),
  pagespeed: bi(
    "Google speed test (PageSpeed Insights)",
    "Testul de viteză Google (PageSpeed Insights)",
  ),
  dns: bi("Public DNS records", "Înregistrări DNS publice"),
  google_places: bi("Google (displayed only)", "Google (doar afișat)"),
  competitor_site: bi("The rival's website", "Site-ul concurentului"),
  calc: bi("Our calculation on official figures", "Calculul nostru pe cifre oficiale"),
  user: bi("Declared by you", "Declarat de tine"),
};

export const CONFIDENCE_LABELS: Record<Confidence, Bilingual> = {
  confirmat: bi("Confirmed", "Confirmat"),
  probabil: bi("Likely", "Probabil"),
  calculat: bi("Calculated", "Calculat"),
  estimare: bi("Estimate", "Estimare"),
  declarat: bi("Declared by you", "Declarat de tine"),
};

export const SOURCE_URLS: Partial<Record<SourceId, string>> = {
  anaf_v9: "https://www.anaf.ro/RegistruTVA/",
  anaf_bilant: "https://www.mfinante.gov.ro/apps/infocodfiscal.html",
  mf_bulk: "https://data.gov.ro/organization/ministerul-finantelor",
  onrc: "https://data.gov.ro/organization/onrc",
  courts: "https://portal.just.ro",
  ted: "https://ted.europa.eu",
  pagespeed: "https://pagespeed.web.dev",
};

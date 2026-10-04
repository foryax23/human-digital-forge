import { COMPANY } from "@/lib/scan/legal/company";
import {
  CONSULTANCY_HOUR_LEI,
  fixedProject,
  leiText,
  projectPriceText,
  type FixedProject,
} from "@/lib/pricing";
import { LOCALE, languageFromMatches, type Language } from "./lang";

/**
 * Page titles and descriptions in both languages, rendered by the server in the visitor's
 * language (Romanian unless they chose English). A route uses it in its `head`:
 *
 *   head: ({ matches }) => ({ meta: pageMeta(matches, "/websites"), links: [canonicalLink("/websites")] }),
 *
 * `pageMeta` returns the title, description and Open Graph tags (and robots when set); X/Twitter
 * falls back to og:title and og:description, so a page's tags stay consistent. Copy rules:
 * natural Romanian with diacritics; nothing promised that does not exist. Prices come from the
 * one price list (src/lib/pricing.ts), so a title never shows an old price.
 *
 * Every page listed in public/sitemap.xml has an entry here without `robots`; private pages
 * carry `noindex` and a Disallow line in public/robots.txt.
 */

type Bilingual = { en: string; ro: string };
export type PageSeo = { title: Bilingual; description: Bilingual; robots?: string };

/** The main domain: canonical links, the sitemap and structured data all use it. */
export const SITE_URL = "https://vortexhub.dev";

/** "/websites" -> "https://vortexhub.dev/websites"; "/" -> "https://vortexhub.dev/". */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/** The canonical link of a page, absolute, as Google recommends. */
export function canonicalLink(path: string) {
  return { rel: "canonical", href: absoluteUrl(path) };
}

const SITE_PRICE = projectPriceText(fixedProject("site"));
const AUTOMATION_PRICE = projectPriceText(fixedProject("automation"));
const ASSISTANT_PRICE = projectPriceText(fixedProject("assistant"));
const HOUR_PRICE = leiText(CONSULTANCY_HOUR_LEI);

export const SITE_SEO: PageSeo = {
  title: {
    en: "Vortex Hub | Websites, digital products and AI automation",
    ro: "Vortex Hub | Site-uri, produse digitale și automatizări AI",
  },
  description: {
    en: "Vortex Hub, based in Timișoara, builds websites, digital products and AI automations, with practical consultancy for businesses and individuals.",
    ro: "Vortex Hub, din Timișoara, construiește site-uri, produse digitale și automatizări AI, cu consultanță practică pentru afaceri și persoane fizice.",
  },
};

export const PAGE_SEO = {
  "/": SITE_SEO,
  "/services": {
    title: { en: "Services | Vortex Hub", ro: "Servicii | Vortex Hub" },
    description: {
      en: "Websites, digital products, AI automation and consultancy for businesses and individuals.",
      ro: "Site-uri, produse digitale, automatizări AI și consultanță pentru afaceri și persoane fizice.",
    },
  },
  "/websites": {
    title: {
      en: `Business websites ${SITE_PRICE.en} | Vortex Hub`,
      ro: `Site-uri de prezentare ${SITE_PRICE.ro} | Vortex Hub`,
    },
    description: {
      en: `A business website with up to 6 pages, a contact form, basic SEO and the GDPR pages, ${SITE_PRICE.en}. Vortex Hub, Timișoara.`,
      ro: `Site de prezentare cu până la 6 pagini, formular de contact, SEO de bază și paginile GDPR, ${SITE_PRICE.ro}. Vortex Hub, Timișoara.`,
    },
  },
  "/digital-products": {
    title: { en: "Digital products | Vortex Hub", ro: "Produse digitale | Vortex Hub" },
    description: {
      en: "Custom web apps, client portals, internal tools, dashboards and MVPs. Price and timeline are set once we know what the app has to do.",
      ro: "Aplicații web la comandă, portaluri pentru clienți, instrumente interne, tablouri de bord și MVP-uri. Prețul fix și termenul le stabilim după ce știm ce trebuie să facă aplicația.",
    },
  },
  "/ai-automation": {
    title: {
      en: "AI automation for businesses | Vortex Hub",
      ro: "Automatizări AI pentru firme | Vortex Hub",
    },
    description: {
      en: `Automations at ${AUTOMATION_PRICE.en}: an invoice from each order, booking reminders, lead routing. An AI assistant on your website or WhatsApp: ${ASSISTANT_PRICE.en}.`,
      ro: `Automatizări de ${AUTOMATION_PRICE.ro}: factura din fiecare comandă, reamintiri pentru programări, preluarea cererilor. Asistent AI pe site sau WhatsApp: ${ASSISTANT_PRICE.ro}.`,
    },
  },
  "/consultancy": {
    title: { en: "Digital consultancy | Vortex Hub", ro: "Consultanță digitală | Vortex Hub" },
    description: {
      en: `The first call is free: digital ideas, website strategy or an AI automation assessment. After that, ${HOUR_PRICE.en} an hour without a plan.`,
      ro: `Prima discuție e gratuită: idei digitale, strategia site-ului sau evaluarea automatizărilor. După aceea, ${HOUR_PRICE.ro} pe oră, fără abonament.`,
    },
  },
  "/contact": {
    title: { en: "Contact | Vortex Hub", ro: "Contact | Vortex Hub" },
    description: {
      en: "Tell Vortex Hub about your project: a website, a digital product or an AI automation. We reply within one working day.",
      ro: "Spune-ne despre proiectul tău: un site, un produs digital sau o automatizare AI. Îți răspundem într-o zi lucrătoare.",
    },
  },
  "/portfolio": {
    title: { en: "Portfolio | Vortex Hub", ro: "Portofoliu | Vortex Hub" },
    description: {
      en: "Live websites, platforms and web apps designed and built by Vortex Hub, including Momentum One, Bridge Gateway, ORBISGRID, Harvard of Sales, MetaFit and FaneaProperties.",
      ro: "Site-uri, platforme și aplicații web live, făcute de Vortex Hub: Momentum One, Bridge Gateway, ORBISGRID, Harvard of Sales, MetaFit și FaneaProperties.",
    },
  },
  "/scan": {
    title: { en: "Vortex Scan | Vortex Hub", ro: "Vortex Scan | Vortex Hub" },
    description: {
      en: "Vortex Scan analyses a business's public digital footprint for free and turns it into a personalised automation and growth plan.",
      ro: "Vortex Scan analizează gratuit prezența digitală publică a unei afaceri și o transformă într-un plan personalizat de automatizare și creștere.",
    },
    // The start page is indexed; a scan's own screens (?cui=, ?url=, ?q=, ?demo=) are personal
    // to the visitor, so src/routes/scan.tsx adds `noindex` to them and robots.txt keeps
    // crawlers off "/scan?".
  },
  "/scan/deep": {
    title: { en: "Deep Research | Vortex Hub", ro: "Deep Research | Vortex Hub" },
    description: {
      en: "Vortex Scan Deep Research: 7 years of filed accounts, the website read as a new customer would and three actions priced in lei. Your first report is free.",
      ro: "Deep Research din Vortex Scan: bilanțurile din ultimii 7 ani, site-ul citit ca de un client nou și trei acțiuni calculate în lei. Primul raport e gratuit.",
    },
    robots: "noindex, nofollow",
  },
  "/login": {
    title: { en: "Sign in | Vortex Hub", ro: "Autentificare | Vortex Hub" },
    description: {
      en: "Access your Vortex Hub projects, messages and completed deliveries.",
      ro: "Intră în contul Vortex Hub pentru proiecte, mesaje și livrări finalizate.",
    },
  },
  "/register": {
    title: { en: "Create account | Vortex Hub", ro: "Creează un cont | Vortex Hub" },
    description: {
      en: "Create a Vortex Hub client account to submit projects and track progress.",
      ro: "Creează un cont de client Vortex Hub ca să trimiți proiecte și să urmărești progresul.",
    },
  },
  "/reset-password": {
    title: { en: "Reset password | Vortex Hub", ro: "Resetează parola | Vortex Hub" },
    description: {
      en: "Set a new password for your Vortex Hub account.",
      ro: "Setează o parolă nouă pentru contul tău Vortex Hub.",
    },
    robots: "noindex",
  },
  "/privacy": {
    title: { en: "Privacy policy | Vortex Hub", ro: "Politica de confidențialitate | Vortex Hub" },
    description: {
      en: "How Vortex Hub collects, uses and protects personal data, what Vortex Scan reads about a company, and your rights under GDPR.",
      ro: "Cum colectează, folosește și protejează Vortex Hub datele personale, ce citește Vortex Scan despre o firmă și drepturile tale conform GDPR.",
    },
  },
  "/terms": {
    title: { en: "Terms and conditions | Vortex Hub", ro: "Termeni și condiții | Vortex Hub" },
    description: {
      en: "The terms that govern the use of Vortex Hub services and website.",
      ro: "Termenii care se aplică serviciilor și site-ului Vortex Hub.",
    },
  },
  "/cookies": {
    title: { en: "Cookie policy | Vortex Hub", ro: "Politica de cookie-uri | Vortex Hub" },
    description: {
      en: "How Vortex Hub uses cookies and how you can manage your preferences.",
      ro: "Cum folosește Vortex Hub cookie-urile și cum îți poți gestiona preferințele.",
    },
  },
  "/billing-success": {
    title: { en: "Payment check | Vortex Hub", ro: "Verificarea plății | Vortex Hub" },
    description: {
      en: "We check your payment with Stripe.",
      ro: "Verificăm plata ta la Stripe.",
    },
    robots: "noindex",
  },
  "/dashboard": {
    title: { en: "Dashboard | Vortex Hub", ro: "Contul meu | Vortex Hub" },
    description: {
      en: "Your Vortex Hub client workspace.",
      ro: "Spațiul tău de client Vortex Hub.",
    },
    robots: "noindex",
  },
  "/dashboard/admin": {
    title: { en: "Admin panel | Vortex Hub", ro: "Panou de administrare | Vortex Hub" },
    description: { en: "Vortex Hub administration.", ro: "Administrarea Vortex Hub." },
    robots: "noindex",
  },
  "/dashboard/research": {
    title: { en: "Deep Research | Vortex Hub", ro: "Deep Research | Vortex Hub" },
    description: {
      en: "Your deep company research reports.",
      ro: "Rapoartele tale Deep Research despre firme.",
    },
    robots: "noindex",
  },
} satisfies Record<string, PageSeo>;

export type SeoPath = keyof typeof PAGE_SEO;

type MetaTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

/** Title, description and Open Graph tags for a page in one language. */
export function seoMeta(lang: Language, seo: PageSeo): MetaTag[] {
  const title = seo.title[lang];
  const description = seo.description[lang];
  const tags: MetaTag[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:locale", content: LOCALE[lang].og },
  ];
  if (seo.robots) tags.push({ name: "robots", content: seo.robots });
  return tags;
}

/** `seoMeta` for a known page, in the language the root route loaded. */
export function pageMeta(
  matches: ReadonlyArray<{ routeId?: string; loaderData?: unknown }> | undefined,
  path: SeoPath,
): MetaTag[] {
  return seoMeta(languageFromMatches(matches), PAGE_SEO[path]);
}

/*
 * Structured data (schema.org JSON-LD). Only facts the site already states: the company's
 * identity from src/lib/scan/legal/company.ts (the legal pages show the same rows), the
 * contact e-mail, the logo and the prices in src/lib/pricing.ts. No telephone until the
 * owner gives one, and no sameAs until the company has real public profiles.
 */

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const BUSINESS_ID = `${SITE_URL}/#business`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const LOGO_URL = absoluteUrl("/media/brand/app-icon-512.png");
const IMAGE_URL = absoluteUrl("/og-image.jpg");

type JsonLd = Record<string, unknown>;

/** A head script for JSON-LD; "<" is escaped so the data can never close the script tag. */
export function jsonLdScript(data: JsonLd) {
  return {
    type: "application/ld+json",
    children: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}

/** "22.05.2026" (as on the ONRC certificate) -> "2026-05-22". */
function isoDate(roDate: string): string | undefined {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(roDate);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

/**
 * The registered office as a PostalAddress. COMPANY.seat reads "Municipiul Timișoara, Jud.
 * Timiș, Strada …": the street is what follows the county; if the format ever changes, the
 * whole line is kept as the street rather than guessing.
 */
function registeredAddress(): JsonLd {
  const parts = COMPANY.seat.split(", ");
  const county = parts.findIndex((part) => part.startsWith("Jud. "));
  const street = county >= 0 ? parts.slice(county + 1).join(", ") : "";
  return {
    "@type": "PostalAddress",
    streetAddress: street || COMPANY.seat,
    addressLocality: COMPANY.city,
    ...(county >= 0 ? { addressRegion: parts[county].slice("Jud. ".length) } : {}),
    addressCountry: "RO",
  };
}

/**
 * The homepage graph: the company (Organization, with its legal identity), its professional
 * service in Timișoara (ProfessionalService, a LocalBusiness) and the website.
 */
export function organizationJsonLd(lang: Language): JsonLd {
  const address = registeredAddress();
  const description = SITE_SEO.description[lang];
  const foundingDate = isoDate(COMPANY.registeredOn);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "Vortex Hub",
        legalName: COMPANY.legalName,
        url: absoluteUrl("/"),
        logo: {
          "@type": "ImageObject",
          url: LOGO_URL,
          width: 512,
          height: 512,
        },
        image: IMAGE_URL,
        description,
        email: COMPANY.email,
        address,
        // CUI: the Romanian fiscal code. No vatID: the company is not registered for VAT.
        taxID: COMPANY.cui,
        identifier: [
          { "@type": "PropertyValue", propertyID: "EUID", value: COMPANY.euid },
          {
            "@type": "PropertyValue",
            propertyID: "Registrul Comerțului",
            value: COMPANY.regNo,
          },
        ],
        ...(foundingDate ? { foundingDate } : {}),
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          email: COMPANY.email,
          availableLanguage: ["ro", "en"],
        },
      },
      {
        "@type": "ProfessionalService",
        "@id": BUSINESS_ID,
        name: "Vortex Hub",
        url: absoluteUrl("/"),
        logo: LOGO_URL,
        image: IMAGE_URL,
        description,
        email: COMPANY.email,
        address,
        parentOrganization: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: absoluteUrl("/"),
        name: "Vortex Hub",
        inLanguage: LOCALE[lang].html,
        publisher: { "@id": ORGANIZATION_ID },
      },
    ],
  };
}

/** An Offer for a fixed-price project: "de la" (minPrice), a range or a rate per hour. */
function projectOffer(project: FixedProject, lang: Language, path: string): JsonLd {
  const { low, high, perHour } = project.priceLei;
  const priceSpecification = perHour
    ? {
        "@type": "UnitPriceSpecification",
        price: low,
        priceCurrency: "RON",
        unitCode: "HUR",
      }
    : {
        "@type": "PriceSpecification",
        minPrice: low,
        ...(high ? { maxPrice: high } : {}),
        priceCurrency: "RON",
      };
  return {
    "@type": "Offer",
    name: project.name[lang],
    description: project.detail[lang],
    url: absoluteUrl(path),
    priceCurrency: "RON",
    priceSpecification,
  };
}

/**
 * A service page (Service), provided by the business on the homepage graph. `projects` are
 * its fixed prices from src/lib/pricing.ts; `free` adds a free first step (the first call).
 */
export function serviceJsonLd({
  lang,
  path,
  name,
  serviceType,
  projects = [],
  free,
}: {
  lang: Language;
  path: SeoPath;
  name: Bilingual;
  serviceType: string;
  projects?: FixedProject["id"][];
  free?: Bilingual;
}): JsonLd {
  const seo = PAGE_SEO[path];
  const offers = projects.map((id) => projectOffer(fixedProject(id), lang, path));
  if (free) {
    offers.unshift({
      "@type": "Offer",
      name: free[lang],
      url: absoluteUrl(path),
      price: 0,
      priceCurrency: "RON",
    });
  }
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: name[lang],
    serviceType,
    description: seo.description[lang],
    url: absoluteUrl(path),
    provider: {
      "@type": "ProfessionalService",
      "@id": BUSINESS_ID,
      name: "Vortex Hub",
      url: absoluteUrl("/"),
    },
    ...(offers.length ? { offers } : {}),
  };
}

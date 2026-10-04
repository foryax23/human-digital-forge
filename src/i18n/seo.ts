import { LOCALE, languageFromMatches, type Language } from "./lang";

/**
 * Page titles and descriptions in both languages, rendered by the server in the visitor's
 * language (Romanian unless they chose English). A route uses it in its `head`:
 *
 *   head: ({ matches }) => ({ meta: pageMeta(matches, "/websites"), links: [...] }),
 *
 * `pageMeta` returns the title, description and Open Graph tags (and robots when set); X/Twitter
 * falls back to og:title and og:description, so a page's tags stay consistent. Copy rules: natural Romanian with diacritics; nothing promised that does not exist.
 */

type Bilingual = { en: string; ro: string };
export type PageSeo = { title: Bilingual; description: Bilingual; robots?: string };

export const SITE_SEO: PageSeo = {
  title: {
    en: "Vortex Hub | Websites, digital products and AI automation",
    ro: "Vortex Hub | Site-uri, produse digitale și automatizări AI",
  },
  description: {
    en: "Vortex Hub builds websites, digital products and AI automations, with practical consultancy for businesses and individuals.",
    ro: "Vortex Hub construiește site-uri, produse digitale și automatizări AI, cu consultanță practică pentru afaceri și persoane fizice.",
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
    title: { en: "Websites | Vortex Hub", ro: "Site-uri | Vortex Hub" },
    description: {
      en: "Landing pages, business websites, portfolios and website redesigns, built around your purpose.",
      ro: "Pagini de destinație, site-uri de prezentare, portofolii și refaceri de site-uri, făcute pentru scopul tău.",
    },
  },
  "/digital-products": {
    title: { en: "Digital products | Vortex Hub", ro: "Produse digitale | Vortex Hub" },
    description: {
      en: "Custom web apps, client portals, internal tools, dashboards and MVPs, built for real use.",
      ro: "Aplicații web la comandă, portaluri pentru clienți, instrumente interne, dashboard-uri și MVP-uri, construite pentru folosire reală.",
    },
  },
  "/ai-automation": {
    title: { en: "AI automation | Vortex Hub", ro: "Automatizări AI | Vortex Hub" },
    description: {
      en: "Practical AI automation for real tasks: enquiries, documents, follow-ups and internal organisation.",
      ro: "Automatizări AI practice pentru sarcini reale: cereri de la clienți, documente, reveniri către clienți și organizare internă.",
    },
  },
  "/consultancy": {
    title: { en: "Consultancy | Vortex Hub", ro: "Consultanță | Vortex Hub" },
    description: {
      en: "Book a one-to-one consultation for digital ideas, website strategy or an AI automation assessment.",
      ro: "Programează o consultanță unu la unu pentru idei digitale, strategia site-ului sau evaluarea unei automatizări AI.",
    },
  },
  "/contact": {
    title: { en: "Contact | Vortex Hub", ro: "Contact | Vortex Hub" },
    description: {
      en: "Tell Vortex Hub about your project: a website, a digital product or an AI automation idea.",
      ro: "Spune-ne despre proiectul tău: un site, un produs digital sau o idee de automatizare AI.",
    },
  },
  "/portfolio": {
    title: { en: "Portfolio | Vortex Hub", ro: "Portofoliu | Vortex Hub" },
    description: {
      en: "Live websites, platforms and web apps designed and built by Vortex Hub, including Momentum One, Bridge Gateway, ORBISGRID, Harvard of Sales, MetaFit and FaneaProperties.",
      ro: "Site-uri, platforme și aplicații web live, proiectate și construite de Vortex Hub, printre care Momentum One, Bridge Gateway, ORBISGRID, Harvard of Sales, MetaFit și FaneaProperties.",
    },
  },
  "/scan": {
    title: { en: "Vortex Scan | Vortex Hub", ro: "Vortex Scan | Vortex Hub" },
    description: {
      en: "Vortex Scan analyses a business's public digital footprint and turns it into a personalised automation and growth plan.",
      ro: "Vortex Scan analizează prezența digitală publică a unei afaceri și o transformă într-un plan personalizat de automatizare și creștere.",
    },
    // Results are personal to the visitor.
    robots: "noindex",
  },
  "/scan/deep": {
    title: { en: "Deep research | Vortex Hub", ro: "Cercetare aprofundată | Vortex Hub" },
    description: {
      en: "Vortex Scan deep research: official figures, similar firms, the website as a customer sees it and three actions in lei.",
      ro: "Cercetarea aprofundată Vortex Scan: cifre oficiale, firme similare, site-ul văzut ca de un client și trei acțiuni calculate în lei.",
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
    title: { en: "Subscription confirmed | Vortex Hub", ro: "Abonament confirmat | Vortex Hub" },
    description: {
      en: "Your Vortex Hub subscription is now active.",
      ro: "Abonamentul tău Vortex Hub este activ.",
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
    title: { en: "Deep research | Vortex Hub", ro: "Cercetare aprofundată | Vortex Hub" },
    description: {
      en: "Your deep company research reports.",
      ro: "Rapoartele tale de cercetare aprofundată despre firme.",
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

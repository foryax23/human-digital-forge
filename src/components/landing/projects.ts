/**
 * Vortex Hub's published projects, shown in the homepage bento and on
 * /portfolio. Details were written only from what each live site shows (no
 * client metrics). Captures live in public/media/work/<slug>/: hero.webp
 * (1280×800 first screen), full.webp (whole landing page, 960px wide) and
 * mobile.webp (phone).
 */

export type Bilingual = { en: string; ro: string };
export type BilingualList = { en: string[]; ro: string[] };

export type Project = {
  slug: string;
  /** Brand name as the site presents it. */
  name: string;
  /** Distinguishes entries that share a brand (e.g. "Corporate site"). */
  variant?: Bilingual;
  url: string;
  /** Hostname shown in the preview's address bar. */
  domain: string;
  category: Bilingual;
  tagline: Bilingual;
  summary: Bilingual;
  built: BilingualList;
  highlights: BilingualList;
  /** UI languages of the site. */
  languages: string[];
  /**
   * public: open landing page; sign-in: opens on a sign-in screen but has a
   * public way in; private: only a sign-in screen is public.
   */
  access: "public" | "sign-in" | "private";
  accent: string;
  /** object-position for crops of hero.webp. */
  heroPosition: string;
  /** Height of full.webp at its 960px width. */
  fullHeight: number;
  /** Another entry for the same client. */
  related?: string;
};

export const projectImages = (slug: string) => ({
  hero: `/media/work/${slug}/hero.webp`,
  full: `/media/work/${slug}/full.webp`,
  mobile: `/media/work/${slug}/mobile.webp`,
});

/**
 * Display title: the project name alone. Entries that share a brand already differ by
 * name, and the kind of site sits on the category line (`category`), so the title
 * carries no dash and no variant. `lang` stays for older call sites.
 */
export const projectTitle = (project: Project, _lang?: "en" | "ro") => project.name;

export const PROJECTS: Project[] = [
  {
    slug: "momentum-one",
    name: "Momentum One",
    url: "https://momentumone.vortexhub.dev",
    domain: "momentumone.vortexhub.dev",
    category: { en: "Student recruitment platform", ro: "Platformă de recrutare a studenților" },
    tagline: {
      en: "UK degrees, close to home, for career changers and people returning to learning",
      ro: "Licențe britanice, aproape de casă, pentru cine își schimbă cariera sau revine la studii",
    },
    summary: {
      en: "Momentum One is a student recruitment site for UK Foundation Year and selected Year 1 degrees, taught at campuses in Manchester, Sunderland, Derby, Newcastle and Luton. Visitors browse seven degree courses and their campus timetables, then answer five short questions to get a personalised course pack for their nearest campus and continue with an adviser on WhatsApp or by phone. A five-stage timeline explains each step up to enrolment, including the documents usually requested and the campus assessment day.",
      ro: "Momentum One este un site de recrutare a studenților pentru licențe britanice cu an pregătitor (Foundation Year) sau, la unele programe, cu intrare directă în anul I, predate în campusuri din Manchester, Sunderland, Derby, Newcastle și Luton. Vizitatorii răsfoiesc cele șapte programe de licență și orarele campusurilor, apoi răspund la cinci întrebări scurte pentru a primi un pachet personalizat pentru cel mai apropiat campus și continuă cu un consilier pe WhatsApp sau la telefon. Un parcurs în cinci etape explică fiecare pas până la înmatriculare, inclusiv documentele cerute de obicei și ziua de evaluare din campus.",
    },
    built: {
      en: [
        "Five-question application flow with step progress tracker",
        "Swipeable carousel of seven degree courses",
        "Campus cards with courses and study timetables",
        "Five-stage journey timeline from sign-up to enrolment",
      ],
      ro: [
        "Formular în cinci întrebări, cu indicator de progres",
        "Carusel tactil cu cele șapte programe de licență",
        "Carduri de campus cu programe și orare",
        "Parcurs în cinci etape, de la înscriere la înmatriculare",
      ],
    },
    highlights: {
      en: ["Guided application", "Nearest-campus matching", "Trilingual EN/RO/ES"],
      ro: ["Candidatură ghidată", "Campus ales automat", "Trilingv EN/RO/ES"],
    },
    languages: ["EN", "RO", "ES"],
    access: "public",
    accent: "#EEAC44",
    heroPosition: "left top",
    fullHeight: 5816,
  },
  {
    slug: "orbisgrid",
    name: "ORBISGRID",
    url: "https://orbisgrid.app",
    domain: "orbisgrid.app",
    category: { en: "Public-data dashboard", ro: "Tablou de bord pentru analiză de date publice" },
    tagline: {
      en: "Cinematic OSINT command centre built on public open data",
      ro: "Centru de comandă OSINT în stil cinematografic, construit pe date publice deschise",
    },
    summary: {
      en: "ORBISGRID is an “Intelligence OS”: an OSINT and situational-awareness dashboard built on public open data and presented as fictional and privacy-safe. Visitors land on a sign-in terminal with an animated globe and status readouts, where they sign in with email or Google, register, or skip straight to the terminal. Behind it, a command centre combines panels for flights, weather, air quality, markets, public camera feeds and case files with an AI assistant, in a layout users can rearrange.",
      ro: "ORBISGRID este un „Intelligence OS”: un tablou de bord OSINT și de conștientizare situațională, construit pe date publice deschise și prezentat drept fictiv, cu respect pentru confidențialitate. Vizitatorii ajung într-un terminal de autentificare cu glob animat și indicatori de stare, unde se conectează cu e-mail sau cu Google, își creează un cont ori intră direct în terminal. În spatele lui, un centru de comandă reunește panouri pentru zboruri, vreme, calitatea aerului, piețe financiare, camere publice și dosare de caz, alături de un asistent AI, într-un aranjament pe care utilizatorii îl pot modifica.",
    },
    built: {
      en: [
        "Sign-in terminal with animated globe and status readouts",
        "Command-centre dashboard with an editable panel layout",
        "Open-data panels for flights, weather, markets and cameras",
        "AI assistant that summarises web pages and transcripts",
      ],
      ro: [
        "Terminal de autentificare cu glob animat și indicatori",
        "Centru de comandă cu panouri care se pot rearanja",
        "Panouri cu date deschise: zboruri, vreme, piețe, camere",
        "Asistent AI care rezumă pagini web și transcrieri",
      ],
    },
    highlights: {
      en: ["Animated globe", "Open-data panels", "AI assistant"],
      ro: ["Glob animat", "Date publice deschise", "Asistent AI"],
    },
    languages: ["EN"],
    access: "sign-in",
    accent: "#36CAF1",
    heroPosition: "center center",
    fullHeight: 669,
  },
  {
    slug: "bridge-gateway-vortex",
    name: "Bridge Gateway Consulting",
    variant: { en: "Corporate site", ro: "Site corporativ" },
    // Checked 2026-10-04: the two Bridge Gateway entries are not swapped (the 2026-10-02
    // capture of this URL is the London advisory site; bridgegatewayconsulting.com is the
    // student platform). "gateaway" is the live subdomain's own spelling:
    // bridgegateway.vortexhub.dev does not answer yet. Switch both lines once the owner adds
    // it in Lovable (the corporate site's project, Settings, Domains).
    url: "https://bridgegateaway.vortexhub.dev",
    domain: "bridgegateaway.vortexhub.dev",
    category: { en: "Corporate advisory website", ro: "Site corporativ de consultanță" },
    tagline: {
      en: "Corporate site for a London advisory firm, with ten departments and consultation booking",
      ro: "Site corporativ al unei firme londoneze de consultanță, cu zece departamente și programări",
    },
    summary: {
      en: "Bridge Gateway Consulting's corporate site presents the London advisory firm behind the Bridge Gateway study platform and its ten departments, from education and finance to legal, software and engineering. Visitors explore the departments through an interactive image dock, and department pages include tools such as a study pathway finder and a software system configurator. The site also offers three consultation options with a booking form, a recruitment page for education agents with a printable QR code, and a client sign-in that links enquiries, consultations and agent applications.",
      ro: "Site-ul corporativ Bridge Gateway Consulting prezintă firma londoneză de consultanță din spatele platformei de studiu Bridge Gateway și cele zece departamente ale sale, de la educație și finanțe până la juridic, software și inginerie. Vizitatorii explorează departamentele printr-o galerie interactivă de imagini, iar paginile de departament includ instrumente precum un ghid pentru alegerea parcursului de studii și un configurator de sisteme software. Site-ul mai cuprinde trei opțiuni de consultanță cu formular de programare, o pagină de recrutare pentru agenți educaționali cu cod QR imprimabil și un cont de client care reunește solicitările, consultațiile și înscrierile ca agent.",
    },
    built: {
      en: [
        "Hover-to-preview dock for ten advisory departments",
        "Study pathway finder and software system configurator",
        "Agent recruitment page with printable registration QR",
        "Consultation booking form and client account sign-in",
      ],
      ro: [
        "Galerie interactivă cu previzualizare pentru zece departamente",
        "Ghid pentru parcursul de studii și configurator software",
        "Pagină de recrutare a agenților, cu cod QR imprimabil",
        "Formular de programare și autentificare în contul de client",
      ],
    },
    highlights: {
      en: ["Interactive department dock", "Consultation booking", "Agent QR registration"],
      ro: ["Galerie de departamente", "Programare de consultații", "Înscriere prin QR"],
    },
    languages: ["EN"],
    access: "public",
    accent: "#008DED",
    heroPosition: "left center",
    fullHeight: 7871,
    related: "bridge-gateway-consulting",
  },
  {
    slug: "bridge-gateway-consulting",
    name: "Bridge Gateway",
    variant: { en: "Study platform", ro: "Platformă de studiu" },
    url: "https://www.bridgegatewayconsulting.com",
    domain: "bridgegatewayconsulting.com",
    category: { en: "University admissions platform", ro: "Platformă de admitere universitară" },
    tagline: {
      en: "Course matching and adviser-led applications for students heading to UK universities",
      ro: "Recomandări de cursuri și candidaturi cu consilier, pentru universitățile britanice",
    },
    summary: {
      en: "Bridge Gateway is the student platform of Bridge Gateway Consulting, a London consultancy that guides students through applications to UK universities. Visitors start a seven-step course-match onboarding, filter a catalogue of partner-university courses by subject and study level, and browse UK study destinations with indicative tuition and living costs. A free account connects each student with an adviser for applications, scholarships and visas.",
      ro: "Bridge Gateway este platforma pentru studenți a firmei Bridge Gateway Consulting, o consultanță londoneză care îi ghidează pe tineri în procesul de admitere la universitățile britanice. Vizitatorii parcurg un chestionar în șapte pași care le recomandă cursurile potrivite, filtrează catalogul de cursuri ale universităților partenere după domeniu și nivel de studiu și explorează destinațiile de studiu din Marea Britanie, cu costuri orientative de școlarizare și de trai. Un cont gratuit îi pune pe studenți în legătură cu un consilier pentru candidatură, burse și vize.",
    },
    built: {
      en: [
        "Seven-step course-match onboarding flow",
        "Course catalogue filterable by subject and study level",
        "UK destinations carousel with tuition and living costs",
        "Video story section with pause and mute controls",
      ],
      ro: [
        "Chestionar în șapte pași pentru alegerea cursului",
        "Catalog de cursuri cu filtre după domeniu și nivel",
        "Carusel de destinații cu costuri de școlarizare și trai",
        "Secțiune video cu butoane de pauză și sunet",
      ],
    },
    highlights: {
      en: ["Course matching", "Filterable catalogue", "Dark mode"],
      ro: ["Recomandări de cursuri", "Catalog filtrabil", "Temă întunecată"],
    },
    languages: ["EN"],
    access: "public",
    accent: "#A97D3A",
    heroPosition: "center top",
    fullHeight: 6832,
    related: "bridge-gateway-vortex",
  },
  {
    slug: "harvard-of-sales",
    name: "Harvard of Sales",
    url: "https://harvardofsales.vortexhub.dev",
    domain: "harvardofsales.vortexhub.dev",
    category: { en: "Sales script generator", ro: "Generator de scripturi de vânzare" },
    tagline: {
      en: "Invitation scripts for MLM distributors, built on behavioural psychology",
      ro: "Scripturi de invitație pentru distribuitorii MLM, bazate pe psihologia comportamentală",
    },
    summary: {
      en: "Harvard of Sales is a subscription product that writes phone invitation scripts for MLM distributors, based on behavioural psychology. Its landing page lets visitors configure a sample script in an interactive demo, choosing the contact, product, invitation, expected objections and tone, and adjust a live script with four psychology sliders. The page also sets out the three-step method, three monthly plans and a resource library, with a booking page as the main call to action.",
      ro: "Harvard of Sales este un produs cu abonament care scrie scripturi de invitație telefonică pentru distribuitorii MLM, pe baza psihologiei comportamentale. Pe pagina principală, vizitatorii configurează un script de probă într-o demonstrație interactivă, alegând persoana sunată, produsul, invitația, obiecțiile anticipate și tonul, apoi ajustează un script live din patru glisoare psihologice. Pagina mai prezintă metoda în trei pași, trei abonamente lunare și o bibliotecă de resurse, iar îndemnul principal duce către pagina de programare.",
    },
    built: {
      en: [
        "Interactive script configurator with phone-screen preview",
        "Four psychology sliders with live script and score",
        "Typewriter headline over an aurora-style backdrop",
        "Three-tier monthly plans with module comparison",
      ],
      ro: [
        "Configurator interactiv de script, cu previzualizare pe telefon",
        "Patru glisoare psihologice, cu script și scor live",
        "Titlu animat literă cu literă, pe fundal de auroră",
        "Trei abonamente lunare, cu comparație între module",
      ],
    },
    highlights: {
      en: ["Interactive script demo", "Live psychology sliders", "Bilingual RO/EN"],
      ro: ["Demonstrație interactivă", "Glisoare psihologice live", "Bilingv RO/EN"],
    },
    languages: ["RO", "EN"],
    access: "public",
    accent: "#E8B04A",
    heroPosition: "center top",
    fullHeight: 8400,
  },
  {
    slug: "metafit",
    name: "MetaFit",
    url: "https://metafit.ro",
    domain: "metafit.ro",
    category: { en: "Nutrition and fitness platform", ro: "Platformă de nutriție și fitness" },
    tagline: {
      en: "Recipes, meal plans, workouts and mindfulness in one Romanian-language platform",
      ro: "Rețete, planuri alimentare, antrenamente și mindfulness, într-o singură platformă",
    },
    summary: {
      en: "MetaFit is a Romanian-language platform that brings nutrition, fitness and mindfulness together in one place. Visitors browse community recipes tagged with cooking time and calories, and explore recipe and workout categories from breakfast to strength training. Its three pillars set out what members get: personalised meal plans, workout programmes with video tutorials, breathing exercises, guided meditations and a personal journal.",
      ro: "MetaFit este o platformă în limba română care reunește nutriția, fitnessul și mindfulness-ul într-un singur loc. Vizitatorii răsfoiesc rețetele comunității, cu timpul de preparare și caloriile afișate, și explorează categorii de rețete și antrenamente, de la micul dejun până la antrenamentele de forță. Cei trei piloni descriu ce primesc membrii: planuri alimentare personalizate, programe de antrenament cu tutoriale video, exerciții de respirație, meditații ghidate și un jurnal personal.",
    },
    built: {
      en: [
        "Three-pillar hub: nutrition, workouts, mindfulness",
        "Community recipe feed with time and calorie tags",
        "Recipe and workout category explorer",
        "Dark topographic theme with fixed bottom navigation",
      ],
      ro: [
        "Platformă pe trei piloni: nutriție, antrenamente, mindfulness",
        "Rețete din comunitate, cu timp de preparare și calorii",
        "Secțiune de categorii pentru rețete și antrenamente",
        "Temă întunecată cu fundal topografic și meniu fix",
      ],
    },
    highlights: {
      en: ["Community recipe feed", "Nutrition, fitness, mindfulness", "App-style navigation"],
      ro: ["Rețete din comunitate", "Nutriție, fitness, mindfulness", "Navigare tip aplicație"],
    },
    languages: ["RO"],
    access: "public",
    accent: "#FF9B3F",
    heroPosition: "center top",
    fullHeight: 3740,
  },
  {
    slug: "pp-dashboard",
    name: "FaneaProperties",
    url: "https://ppdashboard.vortexhub.dev",
    domain: "ppdashboard.vortexhub.dev",
    category: { en: "Property management app", ro: "Aplicație de administrare imobiliară" },
    tagline: {
      en: "Private web app for managing properties in Timișoara",
      ro: "Aplicație web privată pentru administrarea proprietăților din Timișoara",
    },
    summary: {
      en: "FaneaProperties is a private web app for managing properties in Timișoara. Its public entry point is a branded sign-in screen in Romanian, where users log in with a company email and can recover a forgotten password. Everything beyond the sign-in is private, and the layout adapts from desktop to phone.",
      ro: "FaneaProperties este o aplicație web privată pentru administrarea proprietăților din Timișoara. Accesul public se oprește la un ecran de autentificare în limba română, cu sigla aplicației, unde utilizatorii se conectează cu adresa de e-mail a companiei și își pot recupera parola. Restul aplicației este disponibil doar după conectare, iar ecranul se adaptează de la desktop la telefon.",
    },
    built: {
      en: [
        "Company-email sign-in with password recovery",
        "Branded sign-in card with app icon and wordmark",
        "Responsive sign-in layout for desktop and phone",
      ],
      ro: [
        "Autentificare cu e-mailul companiei și recuperare a parolei",
        "Card de autentificare cu sigla și numele aplicației",
        "Interfață responsivă pentru desktop și telefon",
      ],
    },
    highlights: {
      en: ["Private access", "Company accounts", "Responsive design"],
      ro: ["Acces privat", "Conturi de companie", "Design responsiv"],
    },
    languages: ["RO"],
    access: "private",
    accent: "#005F8A",
    heroPosition: "center center",
    fullHeight: 600,
  },
];

/** Shown in the homepage bento, in this order. */
export const FEATURED_PROJECTS = [
  "momentum-one",
  "orbisgrid",
  "bridge-gateway-vortex",
  "harvard-of-sales",
  "metafit",
].map((slug) => PROJECTS.find((p) => p.slug === slug)!);

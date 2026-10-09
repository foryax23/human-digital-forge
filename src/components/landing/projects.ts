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
  {
    slug: "mouseplus",
    name: "Mouse Plus",
    url: "https://mouseplus-site.pages.dev",
    domain: "mouseplus-site.pages.dev",
    category: { en: "Mac and iPhone app", ro: "Aplicație de Mac și iPhone" },
    tagline: {
      en: "Your iPhone becomes your Mac's trackpad, over your own Wi-Fi",
      ro: "iPhone-ul devine trackpad-ul Mac-ului tău, prin Wi-Fi-ul tău",
    },
    summary: {
      en: "Mouse Plus turns an iPhone into a full trackpad for the Mac: cursor movement, clicks, scrolling, drag, three-finger Spaces gestures, media keys, shortcuts, a slide clicker and an app switcher. An air mode reads the gyroscope so waving the phone moves the cursor. One free app on each device talks over the local Wi-Fi — no account, no cloud in between — and pairing is a single scan. The landing page walks through every gesture with live demos and an engineering section on the 120 Hz updates on ProMotion iPhones.",
      ro: "Mouse Plus transformă iPhone-ul într-un trackpad complet pentru Mac: mișcarea cursorului, clickuri, derulare, tragere, gesturi cu trei degete pentru Spaces, taste media, scurtături, clicker pentru prezentări și comutator de aplicații. Un mod „în aer" citește giroscopul, așa că mișcarea telefonului mișcă cursorul. Câte o aplicație gratuită pe fiecare dispozitiv comunică prin Wi-Fi-ul local — fără cont, fără cloud intermediar — iar asocierea se face cu o singură scanare. Pagina principală demonstrează fiecare gest live și include o secțiune de inginerie despre actualizările la 120 Hz pe iPhone-urile ProMotion.",
    },
    built: {
      en: [
        "Gesture-by-gesture landing page with live demos",
        "Air mode using the iPhone gyroscope",
        "Local Wi-Fi pairing with one scan, no account",
        "Engineering section on 120 Hz cursor updates",
      ],
      ro: [
        "Pagină de prezentare cu demonstrații live pentru fiecare gest",
        "Mod „în aer" bazat pe giroscopul iPhone-ului",
        "Asociere prin Wi-Fi local cu o scanare, fără cont",
        "Secțiune de inginerie despre cursorul la 120 Hz",
      ],
    },
    highlights: {
      en: ["Free on both devices", "No account, no cloud", "120 Hz on ProMotion"],
      ro: ["Gratuit pe ambele dispozitive", "Fără cont, fără cloud", "120 Hz pe ProMotion"],
    },
    languages: ["EN"],
    access: "public",
    accent: "#FF7A1A",
    heroPosition: "center top",
    fullHeight: 15994,
  },
  {
    slug: "limitsdb",
    name: "LimitsDB",
    url: "https://limitsdb.vortexhub.dev",
    domain: "limitsdb.vortexhub.dev",
    category: { en: "Developer-limits database", ro: "Bază de date cu limite pentru dezvoltatori" },
    tagline: {
      en: "Every service limit, quota and price, with its receipt",
      ro: "Fiecare limită, cotă și preț de serviciu, cu dovada ei",
    },
    summary: {
      en: "LimitsDB is a machine-readable record of service limits, quotas, pricing and capabilities across 32 providers — from OpenAI, Anthropic and Google AI to Cloudflare, Stripe and Vercel. Each value is normalised for comparison, kept next to the vendor's original wording, and stamped with its source and the moment it was last checked. Visitors search 240 facts by key, filter by provider or verification status, compare providers side by side, and pull the same data through an API or an llms.txt file.",
      ro: "LimitsDB este o evidență citibilă automat a limitelor, cotelor, prețurilor și capabilităților a 32 de furnizori — de la OpenAI, Anthropic și Google AI la Cloudflare, Stripe și Vercel. Fiecare valoare este normalizată pentru comparație, păstrată alături de formularea originală a furnizorului și însoțită de sursa ei și momentul ultimei verificări. Vizitatorii caută în cele 240 de fapte după cheie, filtrează după furnizor sau stare de verificare, compară furnizorii și preiau aceleași date prin API sau printr-un fișier llms.txt.",
    },
    built: {
      en: [
        "Searchable table of 240 normalised facts across 32 providers",
        "Source link and last-checked date on every value",
        "Provider comparison and change log",
        "Public API and llms.txt for machine reading",
      ],
      ro: [
        "Tabel cu 240 de fapte normalizate de la 32 de furnizori",
        "Link către sursă și data verificării pentru fiecare valoare",
        "Comparație între furnizori și jurnal de modificări",
        "API public și llms.txt pentru citire automată",
      ],
    },
    highlights: {
      en: ["240 sourced facts", "32 providers", "Public API"],
      ro: ["240 de fapte cu sursă", "32 de furnizori", "API public"],
    },
    languages: ["EN"],
    access: "public",
    accent: "#0E9F6E",
    heroPosition: "left top",
    fullHeight: 16383,
  },
  {
    slug: "stuonto",
    name: "StuOnto",
    url: "https://stuonto.vercel.app",
    domain: "stuonto.vercel.app",
    category: { en: "Student-data explorer", ro: "Explorator de date studențești" },
    tagline: {
      en: "Ten thousand students in one living 3D graph you steer with your hands",
      ro: "Zece mii de studenți într-un graf 3D viu, controlat cu mâinile",
    },
    summary: {
      en: "StuOnto puts universities, faculties, programmes and every student into one living graph. Visitors fly through it in 3D, re-sort all 10,000 students with three keystrokes — universe, status galaxies, university clusters — and open any record without leaving the sky. Hand control steers the view with gestures. A live demo lets anyone in as a guest with read-only access, no sign-up.",
      ro: "StuOnto reunește universități, facultăți, programe și fiecare student într-un singur graf viu. Vizitatorii zboară prin el în 3D, reordonează toți cei 10.000 de studenți cu trei taste — univers, galaxii de statusuri, clustere de universități — și deschid orice fișă fără să părăsească cerul. Controlul cu mâinile ghidează vederea prin gesturi. O demonstrație live lasă pe oricine să intre ca oaspete, cu acces doar de citire, fără cont.",
    },
    built: {
      en: [
        "3D graph of 10,000 students, 10 universities, 149 programmes",
        "Three keystroke re-sorting modes with live transitions",
        "Hand-gesture camera control",
        "Guest demo with read-only access",
      ],
      ro: [
        "Graf 3D cu 10.000 de studenți, 10 universități, 149 de programe",
        "Trei moduri de reordonare din taste, cu tranziții live",
        "Control al camerei prin gesturi",
        "Demo pentru oaspeți, cu acces doar de citire",
      ],
    },
    highlights: {
      en: ["Living 3D graph", "Hand control", "Guest demo"],
      ro: ["Graf 3D viu", "Control cu mâinile", "Demo pentru oaspeți"],
    },
    languages: ["EN"],
    access: "public",
    accent: "#5B8CFF",
    heroPosition: "center top",
    fullHeight: 800,
  },
  {
    slug: "cowork",
    name: "CO-MM",
    url: "https://cowork.vortexhub.dev",
    domain: "cowork.vortexhub.dev",
    category: { en: "Shared desktop app", ro: "Aplicație de birou partajat" },
    tagline: {
      en: "A shared desktop for two people working side by side",
      ro: "Un birou partajat pentru doi oameni care lucrează alături",
    },
    summary: {
      en: "CO-MM is a shared desktop for two. The entry screen asks each person to pick their own desktop — Mihai or Mursel — and everything beyond that choice is private to the pair.",
      ro: "CO-MM este un birou partajat pentru doi. Ecranul de intrare îi cere fiecărei persoane să-și aleagă propriul birou — Mihai sau Mursel — iar tot ce urmează după această alegere este privat pentru cei doi.",
    },
    built: {
      en: [
        "Per-person desktop picker on a calm gradient canvas",
        "Private workspace behind the entry screen",
      ],
      ro: [
        "Alegere a biroului pentru fiecare persoană, pe un fundal calm",
        "Spațiu de lucru privat după ecranul de intrare",
      ],
    },
    highlights: {
      en: ["Two-person workspace", "Private access"],
      ro: ["Spațiu pentru două persoane", "Acces privat"],
    },
    languages: ["EN"],
    access: "private",
    accent: "#7FB3A3",
    heroPosition: "center center",
    fullHeight: 800,
  },
  {
    slug: "mgtasks",
    name: "MG Task Hub",
    url: "https://mgtasks.vortexhub.dev",
    domain: "mgtasks.vortexhub.dev",
    category: { en: "Team task app", ro: "Aplicație de sarcini pentru echipă" },
    tagline: {
      en: "Private task hub for a team's daily work",
      ro: "Hub privat de sarcini pentru munca zilnică a echipei",
    },
    summary: {
      en: "MG Task Hub is a private task-management app. Its public entry point is a branded sign-in screen with email and password; everything beyond it is reserved for the team.",
      ro: "MG Task Hub este o aplicație privată de gestionare a sarcinilor. Accesul public se oprește la un ecran de autentificare cu e-mail și parolă; restul aplicației este rezervat echipei.",
    },
    built: {
      en: [
        "Branded email-and-password sign-in",
        "Dark gradient theme with a centered access card",
      ],
      ro: [
        "Autentificare cu e-mail și parolă, cu sigla aplicației",
        "Temă întunecată cu card de acces centrat",
      ],
    },
    highlights: {
      en: ["Private access", "Team accounts"],
      ro: ["Acces privat", "Conturi de echipă"],
    },
    languages: ["EN"],
    access: "private",
    accent: "#8B5CF6",
    heroPosition: "center center",
    fullHeight: 800,
  },
  {
    slug: "dinamo-unleashed",
    name: "Dinamo Unleashed",
    url: "https://dinamounleashed.lovable.app",
    domain: "dinamounleashed.com",
    category: { en: "Fan media site", ro: "Site media de suporteri" },
    tagline: {
      en: "Independent media by Dinamo București fans — passion, history, truths told plainly",
      ro: "Media independentă a fanilor lui Dinamo București — pasiune, istorie, adevăruri spuse pe șleau",
    },
    summary: {
      en: "Dinamo Unleashed is an independent fan-media site about Dinamo București, in Romanian. It publishes news, match coverage, league standings, transfer stories, squad pages, history and legends, with long-form analysis pieces — like a data look at how rarely Dinamo trails in matches — and a newsletter for supporters.",
      ro: "Dinamo Unleashed este un site media independent de suporteri, despre Dinamo București, în limba română. Publică știri, cronici de meci, clasament, transferuri, pagini ale lotului, istorie și legende, cu analize ample — precum o privire pe date despre cât de rar e Dinamo condusă în meciuri — și un newsletter pentru suporteri.",
    },
    built: {
      en: [
        "News, matches, standings, transfers, squad, history and legends sections",
        "Long-form data analysis articles",
        "Newsletter sign-up for supporters",
        "Cookie consent with essential-only refusal",
      ],
      ro: [
        "Secțiuni de știri, meciuri, clasament, transferuri, lot, istorie și legende",
        "Articole de analiză pe date, în format amplu",
        "Înscriere la newsletter pentru suporteri",
        "Consimțământ pentru cookie-uri, cu refuz al celor neesențiale",
      ],
    },
    highlights: {
      en: ["Independent fan media", "Data analysis", "Newsletter"],
      ro: ["Media independentă de suporteri", "Analiză pe date", "Newsletter"],
    },
    languages: ["RO"],
    access: "public",
    accent: "#D61F2C",
    heroPosition: "left top",
    fullHeight: 4431,
  },
  {
    slug: "guardex",
    name: "GuarDEX",
    url: "https://guardex.tech",
    domain: "guardex.tech",
    category: { en: "Crypto analytics terminal", ro: "Terminal de analiză crypto" },
    tagline: {
      en: "Real-time DEX analytics for Solana: movers, pairs, bubble maps and trading bots",
      ro: "Analiză DEX în timp real pentru Solana: mișcări, perechi, hărți cu bule și boți de tranzacționare",
    },
    summary: {
      en: "GuarDEX is a real-time DEX analytics terminal for Solana. A dashboard tracks top gainers, losers and most-traded pairs, with 1h/6h/24h volume and liquidity charts and a market bubble map. Sections cover hot pairs, smart wallets, new listings, a token screener, a meme board, a token creator, trading bots and long/short tools, with wallet connection and pair search throughout.",
      ro: "GuarDEX este un terminal de analiză DEX în timp real pentru Solana. Tabloul de bord urmărește cele mai mari creșteri, scăderi și cele mai tranzacționate perechi, cu grafice de volum și lichiditate pe 1h/6h/24h și o hartă cu bule a pieței. Secțiunile cuprind perechi fierbinți, portofele inteligente, listări noi, un screener de tokenuri, un panou de meme-uri, un creator de tokenuri, boți de tranzacționare și instrumente long/short, cu conectare de portofel și căutare de perechi peste tot.",
    },
    built: {
      en: [
        "Live movers dashboard with 1h/6h/24h activity charts",
        "Market bubble map and token screener",
        "Hot pairs, smart wallets and new listings trackers",
        "Token creator, trading bots and long/short tools",
      ],
      ro: [
        "Tablou de bord live cu grafice de activitate pe 1h/6h/24h",
        "Hartă cu bule a pieței și screener de tokenuri",
        "Urmărire de perechi fierbinți, portofele inteligente și listări noi",
        "Creator de tokenuri, boți de tranzacționare și instrumente long/short",
      ],
    },
    highlights: {
      en: ["Real-time DEX data", "Bubble map", "Trading bots"],
      ro: ["Date DEX în timp real", "Hartă cu bule", "Boți de tranzacționare"],
    },
    languages: ["EN"],
    access: "public",
    accent: "#22C55E",
    heroPosition: "center top",
    fullHeight: 1659,
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

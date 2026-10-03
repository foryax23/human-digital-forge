import type { Bilingual, BusinessType, Lang, Range } from "@/lib/scan/types";

import { bi } from "./model";

/*
 * Business types the playbooks are written for. A company is classified from
 * its CAEN code first (Rev.3 since 2026, Rev.2 codes still circulate, so both
 * are listed), then from words on its website. Browser- and server-safe.
 */

export type BusinessTypeDef = {
  id: string;
  label: Bilingual;
  sector: Bilingual;
  /** Who the business serves, plural ("patients" / "pacienți"). */
  customers: Bilingual;
  /** Serves consumers directly (reviews, social and booking matter more). */
  consumer: boolean;
  /** Takes appointments or reservations. */
  bookings: boolean;
  /** 4-digit CAEN classes (Rev.2 and Rev.3) that identify this type. */
  caenClasses: string[];
  /** Word stems looked for on the website (lower case, no diacritics, prefix match). */
  keywords: string[];
  /** Name fragments used to find similar companies in the index. */
  nameFragments: string[];
  /** Typical team size including the owner: an assumption, not data. */
  teamSize: Range;
  /** CAEN Rev.3 division used for wages when the company's code is unknown. */
  wageDivision: string;
};

export const GENERIC_TYPE_ID = "generic-sme";

export const BUSINESS_TYPES: BusinessTypeDef[] = [
  {
    id: "dental-clinic",
    label: bi("Dental clinic", "Clinică stomatologică"),
    sector: bi("Healthcare", "Sănătate"),
    customers: bi("patients", "pacienți"),
    consumer: true,
    bookings: true,
    caenClasses: ["8623"],
    keywords: [
      "stomatolog",
      "dentist",
      "dentar",
      "dental",
      "implant",
      "ortodon",
      "detartraj",
      "albire",
      "parodont",
      "endodont",
      "aparat dentar",
      "carii",
    ],
    nameFragments: ["dent", "stomatolog", "ortodon"],
    teamSize: { low: 4, high: 9 },
    wageDivision: "86",
  },
  {
    id: "medical-clinic",
    label: bi("Medical clinic", "Clinică medicală"),
    sector: bi("Healthcare", "Sănătate"),
    customers: bi("patients", "pacienți"),
    consumer: true,
    bookings: true,
    caenClasses: [
      "8610",
      "8621",
      "8622",
      "8690",
      "8691",
      "8692",
      "8693",
      "8694",
      "8695",
      "8696",
      "8697",
      "8699",
      "7500",
    ],
    keywords: [
      "clinica",
      "policlinic",
      "cabinet medical",
      "medic",
      "ecograf",
      "analize medicale",
      "cardiolog",
      "dermatolog",
      "ginecolog",
      "pediatr",
      "oftalmolog",
      "kinetoterap",
      "fizioterap",
      "psiholog",
      "psihoterap",
      "veterinar",
      "consultatie",
      "radiolog",
    ],
    nameFragments: ["medic", "clinic", "policlinic", "health", "vet"],
    teamSize: { low: 5, high: 20 },
    wageDivision: "86",
  },
  {
    id: "beauty-salon",
    label: bi("Beauty & hair salon", "Salon de înfrumusețare"),
    sector: bi("Personal services", "Servicii personale"),
    customers: bi("clients", "clienți"),
    consumer: true,
    bookings: true,
    caenClasses: ["9602", "9604", "9621", "9622", "9623"],
    keywords: [
      "salon",
      "coafor",
      "coafur",
      "frizer",
      "barber",
      "manichiur",
      "pedichiur",
      "cosmetic",
      "extensii gene",
      "gene",
      "sprancene",
      "epilare",
      "unghii",
      "masaj",
      "tratamente faciale",
      "machiaj",
      "beauty",
      "nails",
    ],
    nameFragments: ["salon", "beauty", "coafur", "frizer", "barber", "nails", "estetic"],
    teamSize: { low: 2, high: 8 },
    wageDivision: "96",
  },
  {
    id: "fitness",
    label: bi("Gym & fitness studio", "Sală de fitness"),
    sector: bi("Sport", "Sport"),
    customers: bi("members", "membri"),
    consumer: true,
    bookings: true,
    caenClasses: ["9311", "9312", "9313", "9319", "8551"],
    keywords: [
      "fitness",
      "gym",
      "sala de forta",
      "antrenor",
      "personal trainer",
      "pilates",
      "yoga",
      "crossfit",
      "aerobic",
      "spinning",
      "clase de grup",
      "abonament",
    ],
    nameFragments: ["fitness", "gym", "sport", "yoga", "pilates", "fit"],
    teamSize: { low: 3, high: 12 },
    wageDivision: "93",
  },
  {
    id: "restaurant",
    label: bi("Restaurant or café", "Restaurant sau cafenea"),
    sector: bi("Hospitality", "HoReCa"),
    customers: bi("guests", "clienți"),
    consumer: true,
    bookings: true,
    caenClasses: ["5610", "5611", "5612", "5621", "5622", "5629", "5630", "5640"],
    keywords: [
      "restaurant",
      "meniu",
      "rezervare masa",
      "rezerva o masa",
      "bistro",
      "pizz",
      "cafenea",
      "coffee",
      "brunch",
      "burger",
      "terasa",
      "bucatar",
      "trattoria",
      "gratar",
      "cocktail",
      "desert",
    ],
    nameFragments: ["restaurant", "bistro", "pizz", "cafe", "cafenea", "grill", "trattoria"],
    teamSize: { low: 6, high: 15 },
    wageDivision: "56",
  },
  {
    id: "hotel",
    label: bi("Hotel or guesthouse", "Hotel sau pensiune"),
    sector: bi("Hospitality", "HoReCa"),
    customers: bi("guests", "oaspeți"),
    consumer: true,
    bookings: true,
    caenClasses: ["5510", "5520", "5530", "5540", "5590"],
    keywords: [
      "hotel",
      "pensiune",
      "cazare",
      "camera dubla",
      "camere",
      "check-in",
      "mic dejun",
      "vila",
      "cabana",
      "resort",
      "regim hotelier",
    ],
    nameFragments: ["hotel", "pensiun", "vila", "cazare", "resort", "cabana"],
    teamSize: { low: 3, high: 15 },
    wageDivision: "55",
  },
  {
    id: "retail",
    label: bi("Retail shop", "Magazin"),
    sector: bi("Retail", "Comerț"),
    customers: bi("customers", "clienți"),
    consumer: true,
    bookings: false,
    caenClasses: [],
    keywords: [
      "magazin",
      "boutique",
      "colectie noua",
      "florarie",
      "librarie",
      "bijuter",
      "optica",
      "showroom",
      "program magazin",
    ],
    nameFragments: ["magazin", "shop", "store", "market", "boutique"],
    teamSize: { low: 2, high: 8 },
    wageDivision: "47",
  },
  {
    id: "ecommerce",
    label: bi("Online shop", "Magazin online"),
    sector: bi("Retail", "Comerț"),
    customers: bi("customers", "clienți"),
    consumer: true,
    bookings: false,
    caenClasses: ["4791", "4792"],
    keywords: [
      "adauga in cos",
      "add to cart",
      "cosul meu",
      "cos de cumparaturi",
      "checkout",
      "finalizeaza comanda",
      "livrare gratuita",
      "transport gratuit",
      "ramburs",
      "politica de retur",
      "magazin online",
      "shop online",
      "in stoc",
    ],
    nameFragments: ["shop", "store", "online", "market"],
    teamSize: { low: 2, high: 8 },
    wageDivision: "47",
  },
  {
    id: "wholesale",
    label: bi("Wholesale & distribution", "Distribuție și comerț en-gros"),
    sector: bi("Trade", "Comerț"),
    customers: bi("business customers", "clienți firme"),
    consumer: false,
    bookings: false,
    caenClasses: [],
    keywords: [
      "en-gros",
      "engros",
      "angro",
      "distribuitor",
      "distributie",
      "importator",
      "import",
      "depozit",
      "b2b",
      "revanzator",
      "pret en gros",
    ],
    nameFragments: ["distrib", "trading", "import", "impex", "comimpex"],
    teamSize: { low: 5, high: 20 },
    wageDivision: "46",
  },
  {
    id: "construction",
    label: bi("Construction & renovation", "Construcții și renovări"),
    sector: bi("Construction", "Construcții"),
    customers: bi("clients", "clienți"),
    consumer: false,
    bookings: false,
    caenClasses: [],
    keywords: [
      "constructi",
      "renovar",
      "amenajar",
      "instalatii",
      "acoperis",
      "fatad",
      "gresie",
      "faianta",
      "zidar",
      "finisaj",
      "termoizola",
      "hidroizola",
      "santier",
      "la cheie",
      "constructor",
      "demolar",
    ],
    nameFragments: ["construct", "renov", "instal", "amenaj", "build"],
    teamSize: { low: 5, high: 20 },
    wageDivision: "43",
  },
  {
    id: "real-estate",
    label: bi("Real estate agency", "Agenție imobiliară"),
    sector: bi("Real estate", "Imobiliare"),
    customers: bi("clients", "clienți"),
    consumer: true,
    bookings: true,
    caenClasses: ["6831", "6832"],
    keywords: [
      "imobiliar",
      "de vanzare",
      "de inchiriat",
      "garsonier",
      "apartament cu",
      "proprietat",
      "agent imobiliar",
      "teren intravilan",
      "vizionar",
    ],
    nameFragments: ["imobil", "estate", "residen", "propert", "home"],
    teamSize: { low: 2, high: 8 },
    wageDivision: "68",
  },
  {
    id: "accounting",
    label: bi("Accounting firm", "Firmă de contabilitate"),
    sector: bi("Professional services", "Servicii profesionale"),
    customers: bi("clients", "clienți"),
    consumer: false,
    bookings: false,
    caenClasses: ["6920"],
    keywords: [
      "contabilitate",
      "contabil",
      "expert contabil",
      "salarizare",
      "bilant",
      "declaratii fiscale",
      "consultanta fiscala",
      "audit financiar",
      "payroll",
      "ceccar",
      "evidenta contabila",
    ],
    nameFragments: ["contab", "expert", "audit", "fiscal", "conta"],
    teamSize: { low: 2, high: 8 },
    wageDivision: "69",
  },
  {
    id: "legal",
    label: bi("Law firm", "Cabinet de avocatură"),
    sector: bi("Professional services", "Servicii profesionale"),
    customers: bi("clients", "clienți"),
    consumer: false,
    bookings: true,
    caenClasses: ["6910"],
    keywords: [
      "avocat",
      "avocatur",
      "litigi",
      "juridic",
      "consultanta juridica",
      "drept civil",
      "drept penal",
      "dreptul muncii",
      "notar",
      "executor judecatoresc",
      "instanta",
      "law firm",
      "attorney",
    ],
    nameFragments: ["avocat", "law", "legal", "juridic", "notar"],
    teamSize: { low: 2, high: 6 },
    wageDivision: "69",
  },
  {
    id: "consulting",
    label: bi("Business consulting", "Consultanță în afaceri"),
    sector: bi("Professional services", "Servicii profesionale"),
    customers: bi("clients", "clienți"),
    consumer: false,
    bookings: true,
    caenClasses: ["7010", "7020", "7021", "7022", "7490", "7499", "7830", "7810"],
    keywords: [
      "consultanta",
      "consultant",
      "consulting",
      "strategie",
      "fonduri europene",
      "fonduri nerambursabile",
      "plan de afaceri",
      "business plan",
      "advisory",
      "consultatie",
    ],
    nameFragments: ["consult", "advisory", "management", "strategy"],
    teamSize: { low: 1, high: 6 },
    wageDivision: "70",
  },
  {
    id: "marketing-agency",
    label: bi("Marketing & creative agency", "Agenție de marketing"),
    sector: bi("Professional services", "Servicii profesionale"),
    customers: bi("clients", "clienți"),
    consumer: false,
    bookings: false,
    caenClasses: ["7311", "7312", "7320", "7330", "7410", "7411", "7412", "7413", "7414"],
    keywords: [
      "agentie de marketing",
      "marketing digital",
      "social media",
      "publicitate",
      "branding",
      "campanii",
      "seo",
      "google ads",
      "facebook ads",
      "design grafic",
      "identitate vizuala",
      "creative",
      "influencer",
    ],
    nameFragments: ["media", "marketing", "advert", "creative", "brand", "digital"],
    teamSize: { low: 3, high: 12 },
    wageDivision: "73",
  },
  {
    id: "it-software",
    label: bi("IT & software company", "Firmă IT și software"),
    sector: bi("Technology", "Tehnologie"),
    customers: bi("clients", "clienți"),
    consumer: false,
    bookings: false,
    caenClasses: ["5821", "5829"],
    keywords: [
      "software",
      "dezvoltare software",
      "aplicatii web",
      "aplicatii mobile",
      "web development",
      "cloud",
      "saas",
      "devops",
      "programare",
      "outsourcing",
      "erp",
      "inteligenta artificiala",
      "artificial intelligence",
      "machine learning",
      "automatizar",
      "automation",
    ],
    nameFragments: ["soft", "tech", "data", "cloud", "systems", "code", "dev"],
    teamSize: { low: 3, high: 15 },
    wageDivision: "62",
  },
  {
    id: "education",
    label: bi("Education & training", "Educație și formare"),
    sector: bi("Education", "Educație"),
    customers: bi("students", "cursanți"),
    consumer: true,
    bookings: true,
    caenClasses: [],
    keywords: [
      "cursuri",
      "curs de",
      "training",
      "academi",
      "scoala",
      "gradinit",
      "after school",
      "afterschool",
      "meditati",
      "inscrieri",
      "cursanti",
      "workshop",
      "elevi",
      "lectii",
    ],
    nameFragments: ["academ", "scoal", "school", "educ", "training", "cursuri", "gradinit", "kids"],
    teamSize: { low: 3, high: 12 },
    wageDivision: "85",
  },
  {
    id: "transport-logistics",
    label: bi("Transport & logistics", "Transport și logistică"),
    sector: bi("Transport", "Transport"),
    customers: bi("clients", "clienți"),
    consumer: false,
    bookings: false,
    caenClasses: [],
    keywords: [
      "transport marfa",
      "transport de marfa",
      "logistic",
      "curierat",
      "expeditii",
      "camion",
      "flota",
      "transport international",
      "frigorific",
      "groupage",
      "dispecerat",
      "freight",
    ],
    nameFragments: ["trans", "logist", "cargo", "express", "freight", "expedit"],
    teamSize: { low: 5, high: 25 },
    wageDivision: "49",
  },
  {
    id: "auto-service",
    label: bi("Auto service", "Service auto"),
    sector: bi("Automotive", "Auto"),
    customers: bi("drivers", "clienți"),
    consumer: true,
    bookings: true,
    caenClasses: ["4520", "4511", "4519", "4532", "4540", "9531", "9532"],
    keywords: [
      "service auto",
      "reparatii auto",
      "vulcaniz",
      "itp",
      "schimb ulei",
      "diagnoza",
      "tinichigerie",
      "vopsitorie",
      "piese auto",
      "dezmembrar",
      "geometrie roti",
      "anvelope",
    ],
    nameFragments: ["auto", "service", "car", "motors", "vulcaniz"],
    teamSize: { low: 3, high: 10 },
    wageDivision: "95",
  },
  {
    id: "manufacturing",
    label: bi("Manufacturing", "Producție"),
    sector: bi("Industry", "Industrie"),
    customers: bi("clients", "clienți"),
    consumer: false,
    bookings: false,
    caenClasses: [],
    keywords: [
      "productie",
      "fabrica",
      "fabricatie",
      "linie de productie",
      "prelucrare",
      "cnc",
      "manufactur",
      "debitare",
      "sudura",
      "injectie",
      "confectii",
      "tamplarie",
    ],
    nameFragments: ["prod", "industr", "fabric", "manufact", "metal", "plast"],
    teamSize: { low: 10, high: 40 },
    wageDivision: "25",
  },
  {
    id: "travel-agency",
    label: bi("Travel agency", "Agenție de turism"),
    sector: bi("Tourism", "Turism"),
    customers: bi("travellers", "turiști"),
    consumer: true,
    bookings: true,
    caenClasses: ["7911", "7912", "7990"],
    keywords: [
      "agentie de turism",
      "vacant",
      "sejur",
      "circuit",
      "bilete de avion",
      "last minute",
      "early booking",
      "excursi",
      "all inclusive",
      "pachete turistice",
      "croazier",
    ],
    nameFragments: ["travel", "tour", "turism", "vacant", "trip"],
    teamSize: { low: 2, high: 6 },
    wageDivision: "79",
  },
  {
    id: "events",
    label: bi("Events & weddings", "Evenimente și nunți"),
    sector: bi("Events", "Evenimente"),
    customers: bi("clients", "clienți"),
    consumer: true,
    bookings: true,
    caenClasses: ["8230", "7420", "9001", "9002", "9329"],
    keywords: [
      "evenimente",
      "nunt",
      "botez",
      "organizare evenimente",
      "wedding",
      "petrecer",
      "team building",
      "decor",
      "sonorizare",
      "fotograf",
      "videograf",
      "candy bar",
    ],
    nameFragments: ["event", "nunt", "wedding", "party", "fest"],
    teamSize: { low: 2, high: 8 },
    wageDivision: "82",
  },
  {
    id: "ngo",
    label: bi("NGO / association", "ONG / asociație"),
    sector: bi("Non-profit", "Non-profit"),
    customers: bi("supporters", "susținători"),
    consumer: true,
    bookings: false,
    caenClasses: ["9411", "9412", "9491", "9492", "9499", "8899"],
    keywords: [
      "asociatia",
      "fundatia",
      "ong",
      "voluntar",
      "donati",
      "doneaza",
      "formularul 230",
      "redirectioneaza",
      "beneficiari",
      "non-profit",
      "nonprofit",
    ],
    nameFragments: ["asociati", "fundati", "ong", "club"],
    teamSize: { low: 2, high: 10 },
    wageDivision: "94",
  },
  {
    id: GENERIC_TYPE_ID,
    label: bi("Small business", "IMM"),
    sector: bi("General", "General"),
    customers: bi("customers", "clienți"),
    consumer: true,
    bookings: false,
    caenClasses: [],
    keywords: [],
    nameFragments: [],
    teamSize: { low: 2, high: 8 },
    wageDivision: "",
  },
];

/** CAEN division (first two digits) → type, when no class matches. */
const DIVISION_TYPES: Record<string, string> = {
  ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [String(10 + i), "manufacturing"])),
  "41": "construction",
  "42": "construction",
  "43": "construction",
  "45": "auto-service",
  "46": "wholesale",
  "47": "retail",
  "49": "transport-logistics",
  "50": "transport-logistics",
  "51": "transport-logistics",
  "52": "transport-logistics",
  "53": "transport-logistics",
  "55": "hotel",
  "56": "restaurant",
  "59": "marketing-agency",
  "61": "it-software",
  "62": "it-software",
  "63": "it-software",
  "68": "real-estate",
  "70": "consulting",
  "71": "consulting",
  "72": "consulting",
  "73": "marketing-agency",
  "74": "consulting",
  "75": "medical-clinic",
  "78": "consulting",
  "79": "travel-agency",
  "85": "education",
  "86": "medical-clinic",
  "90": "events",
  "93": "fitness",
  "94": "ngo",
};

/** Types whose CAEN code is often a catch-all, so strong site evidence may win. */
const BROAD_TYPES = new Set([
  GENERIC_TYPE_ID,
  "consulting",
  "wholesale",
  "retail",
  "it-software",
  "marketing-agency",
]);

const TYPE_BY_ID = new Map(BUSINESS_TYPES.map((type) => [type.id, type]));

export function getBusinessType(id: string | undefined): BusinessTypeDef {
  return (id && TYPE_BY_ID.get(id)) || TYPE_BY_ID.get(GENERIC_TYPE_ID)!;
}

export function listBusinessTypes(): Array<{ id: string; label: Bilingual }> {
  return BUSINESS_TYPES.map(({ id, label }) => ({ id, label }));
}

/**
 * The classification basis is stored in English (BusinessType.basis is
 * string[]); this renders a line in the visitor's language. Unknown lines are
 * returned as they are. Pass the company's CAEN label to translate it too.
 */
export function basisText(line: string, lang: Lang, caenLabel?: Bilingual): string {
  if (lang !== "ro") return line;
  let text = line;
  if (caenLabel?.en && caenLabel.ro) text = text.replace(`(${caenLabel.en})`, `(${caenLabel.ro})`);
  const words = /^Words (on the site|in the name): (.*)$/.exec(text);
  if (words) {
    return `${words[1] === "on the site" ? "Cuvinte de pe site" : "Cuvinte din denumire"}: ${words[2]}`;
  }
  const BASIS_RO: Record<string, string> = {
    "Online checkout found on the website": "Pe site există finalizarea comenzii online",
    "Not enough information to recognise the activity":
      "Nu avem destule informații ca să recunoaștem activitatea",
    "Label refined by AI review of the public data":
      "Tipul afacerii a fost precizat cu AI, pe baza datelor publice",
  };
  if (BASIS_RO[text]) return BASIS_RO[text];
  return text.replace(
    /: no specific playbook for this code$/,
    ": nu avem un model de lucru dedicat acestui cod",
  );
}

/** Name fragments for finding similar companies (lower case, no diacritics). */
export function competitorKeywords(typeId: string): string[] {
  return [...(TYPE_BY_ID.get(typeId)?.nameFragments ?? [])];
}

/** Lower case, diacritics removed (ș/ş, ț/ţ, ă, â, î), whitespace collapsed. */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const keywordPatterns = new Map<string, RegExp>();
function keywordPattern(stem: string) {
  let pattern = keywordPatterns.get(stem);
  if (!pattern) {
    pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(stem)}`);
    keywordPatterns.set(stem, pattern);
  }
  return pattern;
}

/** Distinct keyword stems of a type found in the text (prefix match on word starts). */
function matchKeywords(type: BusinessTypeDef, text: string): string[] {
  if (!text) return [];
  return type.keywords.filter((stem) => keywordPattern(stem).test(text));
}

/** Business type for a CAEN code (class first, then division). */
export function typeForCaen(
  caen: string | undefined,
): { typeId: string; level: "class" | "division" } | null {
  const code = caen?.replace(/\D/g, "").slice(0, 4);
  if (!code || code.length < 2) return null;
  if (code.length === 4) {
    const byClass = BUSINESS_TYPES.find((type) => type.caenClasses.includes(code));
    if (byClass) return { typeId: byClass.id, level: "class" };
  }
  const byDivision = DIVISION_TYPES[code.slice(0, 2)];
  return byDivision ? { typeId: byDivision, level: "division" } : null;
}

export type ClassifyInput = {
  caen?: string;
  /** Official CAEN label, when known (shown in the basis). */
  caenLabel?: string;
  /** Visible text from the website (title, description, headings, body). */
  siteText?: string;
  title?: string;
  name?: string;
  /** Audit hints that are stronger than words. */
  hints?: { hasEcommerce?: boolean };
};

/**
 * Classifies the business: CAEN class/division mapping first, then keyword
 * evidence from the site, title and name. Deterministic.
 */
export function classifyBusiness(input: ClassifyInput): BusinessType {
  const siteText = normalizeText(input.siteText ?? "");
  const headline = normalizeText([input.title, input.name].filter(Boolean).join(" "));

  // Score every type: distinct stems found, double weight when in the title or name.
  const scores = BUSINESS_TYPES.map((type) => {
    const inText = matchKeywords(type, siteText);
    const inHeadline = matchKeywords(type, headline);
    const words = Array.from(new Set([...inHeadline, ...inText]));
    return { type, words, score: inText.length + inHeadline.length * 2 };
  });
  const scoreOf = (id: string) => scores.find((s) => s.type.id === id)!;
  const best = scores.reduce((top, s) => (s.score > top.score ? s : top), scores[0]);

  const code = input.caen?.replace(/\D/g, "").slice(0, 4);
  const byCaen = typeForCaen(code);
  const basis: string[] = [];
  const caenBasis = code
    ? `CAEN ${code}${input.caenLabel ? ` (${input.caenLabel})` : ""}`
    : undefined;
  const wordsSource = siteText ? "Words on the site" : "Words in the name";
  const wordsBasis = (words: string[]) => `${wordsSource}: ${words.slice(0, 5).join(", ")}`;

  let typeId = GENERIC_TYPE_ID;
  let confidence = 0.3;

  if (byCaen) {
    typeId = byCaen.typeId;
    confidence = byCaen.level === "class" ? 0.85 : 0.65;
    if (caenBasis) basis.push(caenBasis);
    const own = scoreOf(typeId);

    if (typeId === "retail" && input.hints?.hasEcommerce) {
      typeId = "ecommerce";
      confidence = 0.8;
      basis.push("Online checkout found on the website");
    } else if (
      BROAD_TYPES.has(typeId) &&
      best.type.id !== typeId &&
      best.type.id !== GENERIC_TYPE_ID &&
      best.score >= 4 &&
      own.score === 0
    ) {
      // A catch-all code (e.g. consulting) with a site that clearly says otherwise.
      typeId = best.type.id;
      confidence = 0.6;
      basis.push(wordsBasis(best.words));
    } else if (own.words.length > 0) {
      confidence = Math.min(0.95, confidence + (own.words.length >= 2 ? 0.1 : 0.05));
      basis.push(wordsBasis(own.words));
    }
  } else if (input.hints?.hasEcommerce && best.type.id !== "ecommerce" && best.score < 4) {
    typeId = "ecommerce";
    confidence = 0.6;
    basis.push("Online checkout found on the website");
  } else if (best.score >= 2 && best.type.id !== GENERIC_TYPE_ID) {
    typeId = best.type.id;
    confidence = Math.min(0.85, 0.45 + 0.08 * best.score);
    if (caenBasis) basis.push(`${caenBasis}: no specific playbook for this code`);
    basis.push(wordsBasis(best.words));
  } else {
    basis.push(
      caenBasis
        ? `${caenBasis}: no specific playbook for this code`
        : "Not enough information to recognise the activity",
    );
  }

  const type = getBusinessType(typeId);
  return {
    id: type.id,
    label: type.label,
    sector: type.sector,
    confidence: Math.round(confidence * 100) / 100,
    basis,
  };
}

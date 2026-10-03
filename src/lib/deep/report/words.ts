/*
 * The words of the report's top layer (plan A8 "Words"), in one place: the
 * verifier (src/lib/deep/llm/verify.ts, through llm/words.ts), the report
 * templates, the banned-word grep over the UI and the glossary
 * (src/lib/scan/blueprint/GLOSSARY.md, section "Cercetare aprofundată") all
 * read this list, so the quick scan and the deep report never drift apart.
 * Client-safe, no imports.
 */

/** Banned everywhere in the top layer (AI prose, templates, UI copy). */
export const BANNED_PHRASES = [
  "fără clienți pierduți",
  "fără pacienți pierduți",
  "garantat",
  "garantăm",
  "singura problemă",
  "esențial",
  "impact mare",
  "recomandat",
  "partener",
  "sănătos",
  "sănătoasă",
  "cu noi",
];

/** Inferences about how the firm works inside or how people feel (cut from AI prose). */
export const BANNED_INFERENCES = [
  "de mână",
  "pe hârtie",
  "sună fiecare",
  "nu răspunde nimeni",
  "te apreciază",
  "e la limită",
  "lucrează la fel ca",
  "angajații sunt",
  "clienții sunt mulțumiți",
  "clienții sunt nemulțumiți",
  "echipa e copleșită",
  "nu are timp",
];

/*
 * Word boundaries are written as Unicode lookarounds: JavaScript's \b only
 * knows ASCII letters, so "\bți\b" would match the end of "clienți".
 */
const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";

/** Second-person forms, cut for third-party audiences (D9). */
export const TU_FORMS = new RegExp(
  `${B}(?:tu|ta|tău|tale|tăi|ți|te|îți|ție|tine|poți|faci|vei|ești|dumneavoastră|ai\\s+\\p{L}+(?:at|it|ut|ât|s))${E}`,
  "iu",
);

/** Number words that count as numbers (must appear in a cited fact). "nouă" (also "new") is left out. */
export const NUMBER_WORDS = new RegExp(
  `${B}(?:unu|doi|două|trei|patru|cinci|șase|șapte|opt|zece|unsprezece|doisprezece|douăsprezece|douăzeci|treizeci|patruzeci|cincizeci|sută|sute|mie|mii|milion|milioane|miliard|jumătate|jumătatea|treime|sfert|dublu|dublă|triplu|triplă|de \\d+ ori|aproape dublu|la sută|procent|procente)${E}`,
  "iu",
);

/**
 * Top-layer swaps: what to avoid and what to write instead. The "Cifre" and
 * "Dovezi" tabs may use the technical term with an explanation on tap.
 */
export const WORD_SWAPS: Array<{ avoid: string; write: string }> = [
  { avoid: "Vânzări", write: "Cifra de afaceri" },
  { avoid: "marjă", write: "din fiecare 100 de lei facturați, îți rămân X" },
  { avoid: "din 100 de lei încasați", write: "din fiecare 100 de lei facturați" },
  { avoid: "mediana", write: "o firmă obișnuită din activitatea ta" },
  { avoid: "P25–P75", write: "majoritatea: între X și Y" },
  { avoid: "jumătatea din mijloc", write: "majoritatea: între X și Y" },
  { avoid: "reclamant", write: "ai deschis N procese" },
  { avoid: "pârât", write: "ai fost dat în judecată" },
  { avoid: "raportul de lichiditate", write: "(nu apare în v1)" },
  { avoid: "neprezentări", write: "clienți care nu vin la programare" },
  { avoid: "PageSpeed", write: "testul de viteză Google" },
  { avoid: "GA4", write: "statistici despre vizitatori" },
  { avoid: "SEO", write: "apari în căutări" },
  { avoid: "Calcul Vortex", write: "Estimarea noastră (vezi ipotezele)" },
  { avoid: "Firma e sănătoasă", write: "Nu apar semnale de risc în registrele publice verificate" },
  { avoid: "Angajați 2025", write: "Salariați, medie 2025 (din bilanț)" },
  {
    avoid: "Nu ai programare online",
    write: "Nu am găsit programare online pe cele N pagini citite",
  },
  { avoid: "Cu noi", write: "Cu Vortex Hub" },
  { avoid: "email", write: "e-mail" },
  { avoid: "Premium · deschis pentru test", write: "Gratuit în perioada de test" },
  { avoid: "Nu facem dosare despre oameni", write: "Nu facem profiluri despre persoane" },
];

/** The status words of the five lines (a set separate from the quick scan's Bun / Acceptabil / Slab). */
export const LINE_WORDS = {
  bine: { en: "Good", ro: "Bine" },
  atentie: { en: "Watch", ro: "Atenție" },
  de_rezolvat: { en: "To fix", ro: "De rezolvat" },
  neverificat: { en: "Not checked", ro: "Neverificat" },
} as const;

/** The confidence legend (A1, "Dovezi"). */
export const CONFIDENCE_WORDS = {
  confirmat: { en: "Confirmed", ro: "Confirmat" },
  probabil: { en: "Likely", ro: "Probabil" },
  calculat: { en: "Calculated", ro: "Calculat" },
  estimare: { en: "Estimate", ro: "Estimare" },
  declarat: { en: "Declared by you", ro: "Declarat de tine" },
} as const;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Banned phrases found in a top-layer text (diacritics-insensitive, whole
 * words). Used by the templates' tests and the UI copy grep.
 */
export function findBannedWords(text: string): string[] {
  const folded = fold(text);
  return BANNED_PHRASES.filter((phrase) =>
    new RegExp(`${B}${fold(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${E}`, "u").test(folded),
  );
}

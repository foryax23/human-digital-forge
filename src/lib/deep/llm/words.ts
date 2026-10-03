/*
 * Words the verifier enforces (plan A7, A8). The shared top-layer word list is
 * Eng 3's src/lib/deep/report/words.ts; until it lands, the verifier uses this
 * copy of the plan's lists (identical text), and switches to the shared module
 * by changing one import.
 */

/** Banned everywhere in the top layer. */
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

/** Inferences about how the firm works inside or how people feel (cut). */
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

/** Second-person forms, cut for third-party audiences. */
export const TU_FORMS = new RegExp(
  `${B}(?:tu|ta|tău|tale|tăi|ți|te|îți|ție|tine|poți|faci|vei|ești|dumneavoastră|ai\\s+\\p{L}+(?:at|it|ut|ât|s))${E}`,
  "iu",
);

/** Number words that count as numbers (must appear in a cited fact). "nouă" (also "new") is left out. */
export const NUMBER_WORDS = new RegExp(
  `${B}(?:unu|doi|două|trei|patru|cinci|șase|șapte|opt|zece|unsprezece|doisprezece|douăsprezece|douăzeci|treizeci|patruzeci|cincizeci|sută|sute|mie|mii|milion|milioane|miliard|jumătate|jumătatea|treime|sfert|dublu|dublă|triplu|triplă|de \\d+ ori|aproape dublu|la sută|procent|procente)${E}`,
  "iu",
);

import { collapse, fold } from "./text";

/*
 * People rules for deep research (client-safe): counts and roles only, never
 * names. A role string that looks like a personal name is dropped; personal
 * looking e-mail addresses are counted, never shown.
 */

/** Words that make a capitalised string a role, a department or a business term. */
/** Job titles: a role string must contain one of these. */
const ROLE_NOUNS = new Set(
  (
    "director directoare manager managera administrator administratoare ceo cto cfo coo fondator fondatoare founder " +
    "cofondator inginer ingineră engineer arhitect arhitectă contabil contabilă expert auditor consultant consultantă " +
    "specialist specialistă avocat avocată tehnician tehniciană șofer sofer driver dispecer operator operatoare agent " +
    "reprezentant vânzător vanzator vânzătoare chef bucătar bucatar ospătar ospatar barman barista cosmetician " +
    "cosmeticiană stilist stilistă hairstylist frizer manichiuristă manichiurist terapeut terapeută fizioterapeut " +
    "kinetoterapeut developer designer programator programatoare recepționer receptioner recepționeră " +
    "economist economistă jurist juristă șef sef șefă sefa medic medici doctor doctori asistent " +
    "asistentă asistenta asistente stomatolog ortodont chirurg dentist igienist igienistă farmacist farmacistă " +
    "psiholog psihologă profesor profesoară educator educatoare instructor antrenor coordonator coordonatoare " +
    "supervizor responsabil responsabilă gestionar gestionară magaziner lucrător lucrator muncitor electrician " +
    "instalator zidar dulgher sudor mecanic vopsitor tinichigiu croitor croitoreasă ambalator curier livrator " +
    "secretar secretară analist analistă"
  )
    .split(" ")
    .map((w) => fold(w)),
);

/** Department and business words: never part of a personal name. */
const ROLE_WORDS = new Set([
  ...ROLE_NOUNS,
  ...(
    "marketing hr receptie recepție departament departamentul echipa echipă echipe vanzari vânzări achiziții " +
    "achizitii logistică logistica financiar contabilitate juridic producție productie calitate service suport " +
    "support client clienți clienti senior junior principal general executiv executive tehnic tehnică comercial " +
    "comercială regional national office birou secretariat front desk sales account project proiect it qa"
  )
    .split(" ")
    .map((w) => fold(w)),
]);

/** Honorifics that precede a personal name ("Dr. Popescu"). */
const TITLE = /^(dr|dna|dl|d-na|d-l|doamna|domnul|prof|ing|ec|av|jr)\.?$/i;

/**
 * True when a string is probably a person's name: two or three capitalised
 * tokens (an honorific allowed in front) with no role or business word. Used
 * to drop names from role lists and team cards before anything is stored.
 */
export function looksLikePersonalName(value: string): boolean {
  const tokens = collapse(value).split(" ").filter(Boolean);
  if (!tokens.length || tokens.length > 4) return false;
  const rest = TITLE.test(tokens[0]) ? tokens.slice(1) : tokens;
  if (rest.length < 1 || rest.length > 3) return false;
  if (TITLE.test(tokens[0]) && rest.length >= 1) {
    return rest.every((t) => /^\p{Lu}[\p{Ll}'-]+$/u.test(t) && !ROLE_WORDS.has(fold(t)));
  }
  if (rest.length < 2) return false;
  return rest.every(
    (t) =>
      /^\p{Lu}[\p{Ll}'-]+$|^\p{Lu}{2,}$/u.test(t) &&
      !ROLE_WORDS.has(fold(t).replace(/[^a-z]/g, "")),
  );
}

const FIRST_NAMES = new Set(
  (
    "ion ioan maria andrei elena mihai ana alexandru ioana gheorghe vasile dan cristina mihaela radu florin adrian " +
    "daniel george gabriel ionut alina andreea constantin nicolae marius bogdan catalin laura diana oana roxana dragos " +
    "paul petru monica simona carmen lucian sorin ciprian cosmin vlad raluca irina anca liviu ovidiu sergiu iulia " +
    "tudor stefan mircea victor emil emilia corina claudia daniela gabriela georgiana adina alexandra bianca camelia " +
    "denisa larisa lavinia loredana madalina mirela nicoleta otilia ramona silvia sorina valentina violeta viorica " +
    "costel cornel dorin eugen felix horia iulian lucian marian octavian razvan silviu traian valentin aurel"
  ).split(" "),
);

/**
 * True when a text contains a person's name anywhere: a segment (split on
 * ":", "-", ",", "|", "·", parentheses) that looks like a name, or a common
 * first name followed by a capitalised word ("De (autor): Andrei Ionescu").
 * Street names after people ("Str. Dr. Ioan Rațiu") are not counted.
 */
export function containsPersonalName(text: string): boolean {
  const tokens = collapse(text).split(" ");
  // A street named after a person ("Str. Dr. Ioan Rațiu") is an address.
  const streetBefore = (i: number) =>
    /(^|\s)(str|strada|bd|b-dul|bulevardul|calea|piata|p-ta|aleea|sos|soseaua|splaiul)\.?(\s|$)/.test(
      fold(tokens.slice(Math.max(0, i - 3), i).join(" ")),
    );
  for (let i = 0; i + 1 < tokens.length; i++) {
    const word = fold(tokens[i]).replace(/[^a-z]/g, "");
    const nextIsName = /^\p{Lu}\p{Ll}+/u.test(tokens[i + 1]);
    if (!nextIsName || !/^\p{Lu}/u.test(tokens[i])) continue;
    // A common first name, or an honorific, followed by a capitalised word.
    if ((FIRST_NAMES.has(word) || TITLE.test(tokens[i])) && !streetBefore(i)) return true;
  }
  return false;
}

/** A role title as published, with any personal name stripped; null when nothing role-like is left. */
export function cleanRoleTitle(value: string): string | null {
  const text = collapse(value).replace(/\s*[,|–—-]\s*/g, " · ");
  const parts = text.split(" · ").filter((part) => !looksLikePersonalName(part));
  const kept = collapse(parts.join(" · "));
  // A title, not a sentence: short, no closing period, no question.
  if (!kept || kept.length > 80 || /[.?!]$/.test(kept) || kept.split(" ").length > 8) return null;
  const words = kept.split(" ").map((w) => fold(w).replace(/[^a-z]/g, ""));
  return words.some((w) => ROLE_NOUNS.has(w)) ? kept : null;
}

const GENERIC_LOCAL =
  /^(office|contact|info|hello|salut|sales|vanzari|comenzi|order|orders|rezervari|rezervare|programari|programare|secretariat|admin|administrare|suport|support|help|hr|resurse-?umane|cariere|careers|jobs|job|receptie|reception|marketing|factura|facturi|facturare|billing|contabilitate|accounting|client|clienti|customer|service|servicii|oferte|ofertare|comercial|achizitii|logistica|dispecerat|transport|depozit|magazin|shop|webshop|online|press|presa|media|pr|legal|gdpr|dpo|privacy|protectiadatelor|noreply|no-reply|newsletter|team|echipa|management|financiar|finance|tehnic|cabinet|clinica|restaurant|librarie|export|import)\d*$/i;

/** office@, contact@, comenzi@… are the firm's; ion.popescu@ is a person's and is only counted. */
export function isGenericEmail(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return GENERIC_LOCAL.test(local);
}

/** Context gates (A9): health never has reviews extracted; members' and pupils' pages are skipped. */
export function peopleGates(caen?: string): {
  noReviews: boolean;
  countsOnly: boolean;
  skipPupils: boolean;
} {
  const division = (caen ?? "").slice(0, 2);
  const group = (caen ?? "").slice(0, 3);
  return {
    noReviews: division === "86",
    countsOnly: division === "94",
    skipPupils: division === "85" || group === "889",
  };
}

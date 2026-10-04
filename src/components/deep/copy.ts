import type { AccessReason, Bilingual } from "@/lib/deep/contracts";
import { bi } from "@/lib/deep/parse/format";

/*
 * The Romanian copy of the deep research page (Romanian is the source, English through
 * t(en, ro)), for the states the page can be in. Words follow the plan's table (A8):
 * "Cu Vortex Hub", never "cu noi"; "e-mail"; no scores; no "garantat".
 */

export const PAGE_TITLE = bi("Deep research", "Cercetare aprofundată");

/** The running note: the time left is next to the progress, so the note never names a duration. */
export const RUNNING_NOTE = bi(
  "Keep this page open until we finish. If you close it, we pause and continue when you come back. What we found so far stays in this browser.",
  "Ține pagina deschisă până terminăm. Dacă o închizi, ne oprim și continuăm când revii. Ce am găsit până atunci rămâne în acest browser.",
);

export const RULES_LABEL = bi("Rule-based analysis, no AI", "Analiză pe reguli, fără AI");
export const AI_LABEL = bi(
  "Text drafted with AI (Claude, by Anthropic). Official figures come from filed accounts and registers; estimates are our calculations, marked “Estimate”.",
  "Text redactat cu ajutorul inteligenței artificiale (Claude, de la Anthropic). Cifrele oficiale vin din bilanțuri și registre; estimările sunt calculele noastre, marcate «Estimare».",
);
export const RULES_NOTE = bi(
  "Every sentence comes from fixed templates over official facts; no AI wrote this report.",
  "Fiecare propoziție vine din șabloane fixe, scrise peste date oficiale; niciun AI nu a scris acest raport.",
);
export const PRIVACY_LINE = bi(
  "Your report is not public and we don't show it to other users.",
  "Raportul tău nu e public și nu îl arătăm altor utilizatori.",
);
export const WHO_ELSE = bi(
  "Anyone with an account can research any company from public data, as on other company-information sites. We don't tell the company who researched it and we don't show your report to anyone. Annual accounts are public in Romania (Ministry of Finance).",
  "Oricine își face cont poate cerceta orice firmă din date publice, ca pe alte site-uri de profil. Nu spunem firmei cine a cercetat-o și nu arătăm nimănui raportul tău. Bilanțurile firmelor sunt publice în România (Ministerul Finanțelor).",
);
export const NO_PROFILES = bi(
  "We don't sell data. We don't build profiles of people.",
  "Nu vindem date. Nu facem profiluri despre persoane.",
);
export const OPT_OUT = bi(
  "Wrong data, or want it removed?",
  "Date greșite sau vrei să le scoatem?",
);
export const DISCLOSURE = bi(
  "Vortex Hub can do some of this; you can also do it yourself or with someone else.",
  "Vortex Hub poate face o parte din aceste lucruri; le poți face și singur sau cu altcineva.",
);
export const CTA_TITLE = bi(
  "A free 30-minute call with Mihai Dandea: we check the numbers together",
  "Discuție gratuită de 30 de minute cu Mihai Dandea: verificăm cifrele împreună",
);
export const CTA_NEXT = bi(
  "We call you back within one working day. No cost, no obligation.",
  "Te sunăm în cel mult o zi lucrătoare. Nu te costă nimic și nu te obligă la nimic.",
);
export const PFA_LINE = bi(
  "Sole trader or family business: we show only the name, activity and county.",
  "PFA, întreprindere individuală sau familială: afișăm doar numele, activitatea și județul.",
);
export const SAMPLE_TAG = bi("Example with a made-up company", "Exemplu cu o firmă inventată");

/**
 * The promise on the entry and the form: only what every run delivers today (no comparison
 * with similar firms until the peer file is loaded, no "this month": effects show in months).
 */
export const OUTCOME = bi(
  "Find out how much you keep of every 100 lei, what a customer sees on your website and what to do in the next 30 days. It takes about 3 minutes.",
  "Află cât păstrezi din 100 de lei, ce vede un client pe site-ul tău și ce să faci în următoarele 30 de zile. Durează cam 3 minute.",
);

export type GateCopy = { title: Bilingual; body: Bilingual };

/** What each refusal means for the visitor, in plain words. */
export const REASON_COPY: Record<AccessReason, GateCopy> = {
  mode_disabled: {
    title: bi("Deep research is switched off right now", "Cercetarea aprofundată e oprită acum"),
    body: bi(
      "We paused it for a while. The quick analysis on Vortex Scan still works.",
      "Am oprit-o pentru o vreme. Analiza rapidă din Vortex Scan merge în continuare.",
    ),
  },
  login_required: {
    title: bi("Sign in to start the research", "Intră în cont ca să pornești cercetarea"),
    body: bi(
      "The research reads the official registers and the company's website, then writes a report only for you. We tie it to your account so you can pick it up again if you close the page.",
      "Cercetarea citește registrele oficiale și site-ul firmei, apoi scrie un raport doar pentru tine. Îl legăm de contul tău, ca să îl poți relua dacă închizi pagina.",
    ),
  },
  email_unconfirmed: {
    title: bi("Confirm your e-mail address first", "Confirmă mai întâi adresa de e-mail"),
    body: bi(
      "We sent you a confirmation link. Open it, then come back here: we keep the company you chose for an hour.",
      "Ți-am trimis un link de confirmare. Deschide-l, apoi revino aici: păstrăm firma aleasă o oră.",
    ),
  },
  admin_only: {
    title: bi("Deep research is in testing", "Cercetarea aprofundată e în test"),
    body: bi(
      "For now only the Vortex Hub team uses it. If you'd like to try it, send us your account ID.",
      "Deocamdată o folosește doar echipa Vortex Hub. Dacă vrei să o încerci, trimite-ne ID-ul contului tău.",
    ),
  },
  code_required: {
    title: bi("Do you have a test code?", "Ai un cod de test?"),
    body: bi(
      "Deep research is open to people who received a test code. It is free during the test.",
      "Cercetarea aprofundată e deschisă celor care au primit un cod de test. În perioada de test e gratuită.",
    ),
  },
  premium_required: {
    title: bi(
      "Included in the Starter, Growth and Pro plans",
      "Inclusă în abonamentele Starter, Growth și Pro",
    ),
    body: bi(
      "Each report covers the official registers and filed accounts, your website read as a new customer would, and three actions for the next 30 days. The plans are signed by contract.",
      "Fiecare raport cuprinde registrele oficiale și bilanțurile, site-ul citit ca de un client nou și trei acțiuni pentru următoarele 30 de zile. Abonamentele se încheie prin contract.",
    ),
  },
  free_run_used: {
    title: bi("Your free report is used", "Ai folosit raportul gratuit"),
    body: bi(
      "Every account gets one full report for free. More reports come with the Starter, Growth and Pro plans.",
      "Fiecare cont primește un raport complet gratuit. Următoarele vin cu abonamentele Starter, Growth și Pro.",
    ),
  },
  daily_cap_user: {
    title: bi("You reached today's limit", "Ai ajuns la limita de azi"),
    body: bi(
      "The limit resets at midnight, Romanian time. Your reports from today stay in this browser.",
      "Limita se resetează la miezul nopții, ora României. Rapoartele de azi rămân în acest browser.",
    ),
  },
  daily_cap_global: {
    title: bi("We reached today's limit for everyone", "Am ajuns la limita de azi pentru toți"),
    body: bi(
      "We start again tomorrow from midnight, Romanian time.",
      "Pornim din nou mâine, de la miezul nopții, ora României.",
    ),
  },
  already_running: {
    title: bi("You already have a research running", "Ai deja o cercetare pornită"),
    body: bi(
      "Let it finish (about 3 minutes) or continue it in the tab where it runs.",
      "Las-o să se termine (cam 3 minute) sau continu-o în tabul în care rulează.",
    ),
  },
  same_company_today: {
    title: bi("You researched this company today", "Ai cercetat azi această firmă"),
    body: bi(
      "Today's report is saved. A company can be researched once a day per account.",
      "Raportul de azi e salvat. O firmă se poate cerceta o dată pe zi din același cont.",
    ),
  },
  natural_person: {
    title: bi(
      "No deep research for sole traders",
      "Pentru PFA, II și IF nu facem cercetare aprofundată",
    ),
    body: bi(
      "Sole trader or family business: we show only the name, activity and county. Their data belongs to a person, so we don't analyse it further.",
      "PFA, întreprindere individuală sau familială: afișăm doar numele, activitatea și județul. Datele lor țin de o persoană, așa că nu le analizăm mai departe.",
    ),
  },
  not_found: {
    title: bi("We can't find this company", "Nu găsim firma"),
    body: bi(
      "Check the tax code (CUI). If it is right, ANAF doesn't list the company yet.",
      "Verifică CUI-ul. Dacă e corect, ANAF nu are încă firma în registru.",
    ),
  },
  anaf_unavailable: {
    title: bi("ANAF is not answering right now", "ANAF nu răspunde acum"),
    body: bi("Try again in a few minutes.", "Încearcă din nou în câteva minute."),
  },
  ledger_unavailable: {
    title: bi("We can't start a research right now", "Nu putem porni acum o cercetare"),
    body: bi("Try again in a few minutes.", "Încearcă din nou în câteva minute."),
  },
  budget_exhausted: {
    title: bi("Today's research budget is used", "Bugetul de azi pentru cercetări s-a terminat"),
    body: bi("We start again tomorrow.", "Pornim din nou mâine."),
  },
  ticket_invalid: {
    title: bi("We can't continue this research", "Nu putem continua această cercetare"),
    body: bi(
      "Something in it no longer matches what we saved. Start a new one.",
      "Ceva din ea nu mai corespunde cu ce am salvat. Pornește una nouă.",
    ),
  },
  ticket_expired: {
    title: bi("This research has expired", "Această cercetare a expirat"),
    body: bi(
      "Unfinished research can be continued for 24 hours. Start a new one.",
      "O cercetare neterminată se poate continua 24 de ore. Pornește una nouă.",
    ),
  },
  user_mismatch: {
    title: bi("This research belongs to another account", "Cercetarea e a altui cont"),
    body: bi(
      "Sign in with the account that started it, or start a new one.",
      "Intră cu contul care a pornit-o sau pornește una nouă.",
    ),
  },
  run_not_found: {
    title: bi("We can't find this research anymore", "Nu mai găsim această cercetare"),
    body: bi(
      "It may have expired or been started on another device. Start a new one.",
      "Poate a expirat sau a fost pornită pe alt dispozitiv. Pornește una nouă.",
    ),
  },
  terms_outdated: {
    title: bi("The report terms have changed", "Termenii raportului s-au schimbat"),
    body: bi(
      "Reload the page, read them again and tick the box to start.",
      "Reîncarcă pagina, citește-i din nou și bifează căsuța ca să pornești.",
    ),
  },
  too_large: {
    title: bi("The request was too large", "Cererea a fost prea mare"),
    body: bi("Start the research again.", "Pornește din nou cercetarea."),
  },
};

/** The timeline's stages, in the order the runner works through them. */
export type StageId =
  | "identity"
  | "money"
  | "site"
  | "signals"
  | "peers"
  | "pages"
  | "speed"
  | "rivals"
  | "analysis";

export const STAGE_LABEL: Record<StageId, Bilingual> = {
  identity: bi("Official registers", "Registre oficiale"),
  money: bi("Money over 7 years", "Bani pe 7 ani"),
  site: bi("The company's website", "Site-ul firmei"),
  signals: bi("Courts and tenders", "Instanțe și licitații"),
  peers: bi("Similar firms", "Firme similare"),
  pages: bi("Website, read as a customer", "Site-ul, citit ca de un client"),
  speed: bi("Speed on a phone", "Viteza pe telefon"),
  rivals: bi("Rivals", "Concurenți"),
  analysis: bi("Analysis", "Analiză"),
};

export const RELATIONSHIPS = [
  { value: "proprietar", label: bi("I own or run it", "Sunt proprietarul sau administratorul") },
  { value: "angajat", label: bi("I work here", "Lucrez aici") },
  { value: "client_furnizor", label: bi("I'm a client or supplier", "Sunt client sau furnizor") },
  { value: "concurent", label: bi("I'm a competitor", "Sunt concurent") },
  { value: "altceva", label: bi("Something else", "Altceva") },
] as const;

/*
 * premium_required for an account that has a plan (assigned by an admin after the contract,
 * src/lib/client-plans.ts): the plan's reports for this period are used, or the plan starts on
 * a later day. The gate shows these instead of the plans' list.
 */

/** "Ai folosit rapoartele din luna aceasta": the plan's reports for this period are used. */
export function planReportsUsedCopy(args: {
  plan: string;
  reports: number;
  period: "month" | "quarter";
  /** The day the next period starts ("1 noiembrie" / "1 November"), or null when unknown. */
  renews: Bilingual | null;
}): GateCopy {
  const { plan, reports, period, renews } = args;
  const one = reports === 1;
  const enPeriod = period === "month" ? "month" : "quarter";
  const roPeriod = period === "month" ? "luna aceasta" : "acest trimestru";
  const roIncluded = `${one ? "1 raport" : `${reports} rapoarte`} pe ${period === "month" ? "lună" : "trimestru"}`;
  return {
    title: bi(
      one ? `This ${enPeriod}'s report is used` : `This ${enPeriod}'s reports are used`,
      one ? `Ai folosit raportul din ${roPeriod}` : `Ai folosit rapoartele din ${roPeriod}`,
    ),
    body: bi(
      `Your ${plan} plan includes ${reports} ${one ? "report" : "reports"} a ${enPeriod}.` +
        (renews ? ` The next ${one ? "one is" : "ones are"} available from ${renews.en}.` : ""),
      `Abonamentul ${plan} include ${roIncluded}.` +
        (renews
          ? one
            ? ` Următorul e disponibil din ${renews.ro}.`
            : ` Următoarele sunt disponibile din ${renews.ro}.`
          : ""),
    ),
  };
}

/** "Abonamentul Growth începe pe 1 nov. 2026": an assigned plan whose first day is later. */
export function planStartsLaterCopy(args: { plan: string; startsOn: Bilingual }): GateCopy {
  return {
    title: bi(
      `Your ${args.plan} plan starts on ${args.startsOn.en}`,
      `Abonamentul ${args.plan} începe pe ${args.startsOn.ro}`,
    ),
    body: bi(
      "Deep research comes with the plan from its first day.",
      "Cercetarea aprofundată vine cu abonamentul din prima lui zi.",
    ),
  };
}

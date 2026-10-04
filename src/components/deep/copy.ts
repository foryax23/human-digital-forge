import type { AccessReason, Bilingual, DeepAccess } from "@/lib/deep/contracts";
import { bi } from "@/lib/deep/parse/format";
import { deepPlansText, deepValueText } from "@/lib/pricing";

/*
 * The Romanian copy of the deep research page (Romanian is the source, English through
 * t(en, ro)), for the states the page can be in. Words follow the plan's table (A8):
 * "Cu Vortex Hub", never "cu noi"; "e-mail"; no scores; no "garantat".
 *
 * The offer (owner decision, 2026-10-04): "Primul raport Deep Research e gratuit", one per
 * account; the owner's value estimate, always labelled "Estimarea noastră" (src/lib/pricing.ts);
 * the plans by contract add more reports. Never "nelimitat", "garantat", or Deep Research
 * "gratuit" in general. The free check needs a confirmed e-mail and, while
 * DEEP_OPEN_REQUIRES_GOOGLE is on (the server's default, against throwaway accounts), a Google
 * sign-in for that address unless an admin granted it: so the copy says "când intri cu Google"
 * (true either way). With the switch off, FREE_HOW may also name a confirmed e-mail.
 */

export const PAGE_TITLE = bi("Deep Research", "Deep Research");

/** How an account gets the free report (see the note above on DEEP_OPEN_REQUIRES_GOOGLE). */
export const FREE_HOW = bi(
  "One per account, when you sign in with Google",
  "Unul pe cont, când intri cu Google",
);

// A no-break space keeps "Deep Research" on one line in titles.
export const FREE_FIRST = bi(
  "Your first Deep\u00a0Research report is free",
  "Primul raport Deep\u00a0Research e gratuit",
);

/*
 * What every run delivers today. The comparison with rivals waits for the Ministry of Finance
 * peer files (scripts/scan/build-fin-shards.mjs, not published yet: without them the peers and
 * rivals are a gap); add "concurenți reali, comparați cifră cu cifră" here once they are live.
 */
export const REPORT_CONTENTS: Bilingual[] = [
  bi(
    "The accounts the company filed over the last 7 years, year by year",
    "Bilanțurile depuse de firmă în ultimii 7 ani, an cu an",
  ),
  bi(
    "Its website read as a new customer would, plus courts, public tenders and press",
    "Site-ul citit ca de un client nou, plus instanțe, licitații publice și presă",
  ),
  bi(
    "Three steps for the next 30 days; every sentence written with AI shows its source",
    "Trei pași pentru următoarele 30 de zile; fiecare frază scrisă cu AI își arată sursa",
  ),
];

/** "Estimarea noastră: circa 500 de lei de analiză într-un raport." */
export const VALUE_ESTIMATE: Bilingual = deepValueText();

const PLANS_LINE = deepPlansText();

/** "Abonamentele prin contract includ mai multe rapoarte: Starter include 1 raport pe trimestru, …". */
export const MORE_WITH_PLANS: Bilingual = bi(
  `Plans by contract include more reports: ${PLANS_LINE.en}.`,
  `Abonamentele prin contract includ mai multe rapoarte: ${PLANS_LINE.ro}.`,
);

/** The offer in one paragraph, for the pricing section. */
export const FREE_SUMMARY = bi(
  `${FREE_HOW.en}: 7 years of filed accounts, the website read as a new customer would and three steps for 30 days, with a source for every sentence written with AI. The plans include more reports.`,
  `${FREE_HOW.ro}: bilanțurile din ultimii 7 ani, site-ul citit ca de un client nou și trei pași pentru 30 de zile, cu sursa la fiecare frază scrisă cu AI. Abonamentele includ rapoarte în plus.`,
);

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
    title: bi("Deep Research is switched off right now", "Deep Research e oprit acum"),
    body: bi(
      "We paused it for a while. The quick analysis on Vortex Scan still works.",
      "L-am oprit pentru o vreme. Analiza rapidă din Vortex Scan merge în continuare.",
    ),
  },
  login_required: {
    title: FREE_FIRST,
    body: bi(
      `${FREE_HOW.en}. The report is only for you and stays on your account, so you can open it again if you close the page.`,
      `${FREE_HOW.ro}. Raportul e doar al tău și rămâne în cont, ca să îl poți deschide din nou dacă închizi pagina.`,
    ),
  },
  email_unconfirmed: {
    title: bi("Confirm your e-mail address first", "Confirmă mai întâi adresa de e-mail"),
    body: bi(
      "We sent you a confirmation link; we keep the company you chose for an hour. For the free report, the simplest way is to sign in with Google on the same address: the account is confirmed in one step.",
      "Ți-am trimis un link de confirmare; firma aleasă o păstrăm o oră. Pentru raportul gratuit, cel mai simplu e să intri cu Google pe aceeași adresă: contul e confirmat dintr-un pas.",
    ),
  },
  /*
   * admin_only reaches a client only when the account's deep checks could not be read (none
   * left: the gate shows FREE_USED; one waiting for Google: FREE_NEEDS_GOOGLE): "try again",
   * with the account ID to send.
   */
  admin_only: {
    title: bi(
      "We can't start a report from this account right now",
      "Nu putem porni acum un raport din acest cont",
    ),
    body: bi(
      "We couldn't check the account's free report. Try again in a few minutes; if it still doesn't work, send us your account ID and we'll look into it.",
      "Nu am putut verifica raportul gratuit al contului. Încearcă din nou în câteva minute; dacă tot nu merge, trimite-ne ID-ul contului și ne uităm noi.",
    ),
  },
  code_required: {
    title: bi("Do you have a test code?", "Ai un cod de test?"),
    body: bi(
      "If we sent you a code, write it here. Without one, reports come with the plans by contract.",
      "Dacă ai primit un cod de la Vortex Hub, scrie-l aici. Fără cod, rapoartele vin cu abonamentele prin contract.",
    ),
  },
  premium_required: {
    title: bi("More reports come with a plan", "Rapoartele următoare vin cu un abonament"),
    body: bi(
      "The first Deep Research report is free, one per account. For more, the plans by contract include:",
      "Primul raport Deep Research e gratuit, unul pe cont. Pentru mai multe, abonamentele prin contract includ:",
    ),
  },
  free_run_used: {
    title: bi("You used your free report", "Ai folosit raportul gratuit"),
    body: bi(
      "The first report is free for every account; yours is in your reports. For new reports, the plans by contract include:",
      "Primul raport e gratuit pentru fiecare cont; pe al tău îl găsești în rapoartele tale. Pentru rapoarte noi, abonamentele prin contract includ:",
    ),
  },
  daily_cap_user: {
    title: bi("You reached today's limit", "Ai ajuns la limita de azi"),
    body: bi(
      "You can start again tomorrow, from midnight Romanian time. Your reports from today stay in this browser.",
      "Poți porni din nou mâine, de la miezul nopții, ora României. Rapoartele de azi rămân în acest browser.",
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
    title: bi("No Deep Research for sole traders", "Pentru PFA, II și IF nu facem Deep Research"),
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
      "Deep Research reports come with the plan from its first day.",
      "Rapoartele Deep Research vin cu abonamentul din prima lui zi.",
    ),
  };
}

/*
 * The account's deep checks as getDeepAccess reports them (src/lib/deep/access.server.ts):
 * `credits` (a new account has the free plan with 1), and, untyped in DeepAccess, `useCredit`
 * (this run would spend one) and `plan` (a contract plan's reports this period).
 */

/** "Ai folosit raportul gratuit": no checks left and no plan, said plainly. */
export const FREE_USED: GateCopy = REASON_COPY.free_run_used;

/** The account has its free report, but the server wants a Google sign-in for its address first. */
export const FREE_NEEDS_GOOGLE: GateCopy = {
  title: bi("Your free report starts with Google", "Raportul gratuit se pornește cu Google"),
  body: bi(
    "Your account has its free report. To keep it away from throwaway accounts, you start it after signing in with Google on the same e-mail address.",
    "Contul tău are raportul gratuit. Ca să nu ajungă la conturi de unică folosință, îl pornești după ce intri cu Google pe aceeași adresă de e-mail.",
  ),
};

export type Credits = { plan: "free" | "premium"; left: number };

const reportsWord = (n: number) =>
  bi(`${n} report${n === 1 ? "" : "s"}`, n === 1 ? "1 raport" : `${n} rapoarte`);

/**
 * A refusal that did not spend a check (daily limits, storage down): "Nu pierzi nimic: raportul
 * gratuit rămâne în cont." Null without checks left (or when they are unknown).
 */
export function creditsKeptLine(credits: Credits | undefined): Bilingual | null {
  if (!credits || credits.left <= 0) return null;
  if (credits.plan === "free" && credits.left === 1)
    return bi(
      "Nothing is lost: your free report stays on your account.",
      "Nu pierzi nimic: raportul gratuit rămâne în cont.",
    );
  const n = reportsWord(credits.left);
  return bi(
    `Nothing is lost: you still have ${n.en} on your account.`,
    `Nu pierzi nimic: îți rămân ${n.ro} în cont.`,
  );
}

/**
 * "Rapoarte rămase: 1 (primul e gratuit)", for the dashboard and the start form. Only the
 * first report is called free: several checks an admin granted get no note.
 */
export function creditsLeftLine(credits: Credits): Bilingual {
  const { plan, left } = credits;
  const note =
    plan === "premium"
      ? bi(" (Premium)", " (Premium)")
      : left === 1
        ? bi(" (the first one is free)", " (primul e gratuit)")
        : bi("", "");
  return bi(`Reports left: ${left}${note.en}`, `Rapoarte rămase: ${left}${note.ro}`);
}

/** What getDeepAccess sends beyond DeepAccess (DeepAccessResult's additive fields). */
export type AccessExtras = DeepAccess & {
  useCredit?: true;
  plan?: { plan: string; reports: number | null; used: number | null };
  /** The free check waits for a Google sign-in (DEEP_OPEN_REQUIRES_GOOGLE). */
  creditNeeds?: "google";
};

const planName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
/** "4 rapoarte" / "20 de rapoarte". */
const roReports = (n: number) => `${n} ${n % 100 === 0 || n % 100 >= 20 ? "de " : ""}rapoarte`;

/**
 * Under "Pornește cercetarea": what this run uses (the free report, one of the checks left, or
 * the plan). Null for admins, test codes and open mode.
 */
export function startCostLine(access: DeepAccess | null): Bilingual | null {
  const a = access as AccessExtras | null;
  if (!a?.allowed || a.via === "admin") return null;
  const credits = a.credits;
  if (a.useCredit && credits) {
    if (credits.plan === "free" && credits.left === 1)
      return bi(
        "This uses your account's free report. If the research doesn't start, it isn't used up.",
        "Folosești raportul gratuit al contului. Dacă cercetarea nu pornește, nu se consumă.",
      );
    return credits.left === 1
      ? bi(
          "This uses the last report left on your account.",
          "Folosești ultimul raport rămas în cont.",
        )
      : bi(
          `This uses 1 of the ${credits.left} reports left on your account.`,
          `Folosești 1 din cele ${roReports(credits.left)} rămase în cont.`,
        );
  }
  if (a.via === "premium" && a.plan)
    return bi(
      `Included in your ${planName(a.plan.plan)} plan.`,
      `Inclus în abonamentul ${planName(a.plan.plan)}.`,
    );
  return null;
}

/**
 * The entry's offer line on /scan: "Primul raport e gratuit." for a visitor who is not signed
 * in or still has the free report, the checks left otherwise; `free` adds the value estimate.
 */
export function entryOfferLine(
  access: DeepAccess | null,
  preview: boolean,
): { line: Bilingual; free: boolean } | null {
  const free = { line: bi("Your first report is free.", "Primul raport e gratuit."), free: true };
  if (preview) return free;
  const a = access as AccessExtras | null;
  if (!a) return null;
  if (a.reason === "login_required") return free;
  if (!a.allowed || a.via === "admin") return null;
  if (a.useCredit && a.credits) {
    if (a.credits.plan === "free" && a.credits.left === 1) return free;
    const left = creditsLeftLine(a.credits);
    return { line: bi(`${left.en}.`, `${left.ro}.`), free: false };
  }
  if (a.via === "premium" && a.plan)
    return {
      line: bi(
        `Included in your ${planName(a.plan.plan)} plan.`,
        `Inclus în abonamentul ${planName(a.plan.plan)}.`,
      ),
      free: false,
    };
  return null;
}

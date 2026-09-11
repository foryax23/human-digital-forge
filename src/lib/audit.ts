/**
 * Infrastructure audit — question set, scoring and recommendation logic.
 * Pure data + pure functions so it is safe on client and server.
 */

export type Bilingual = { en: string; ro: string };

export type AuditOption = {
  value: string;
  label: Bilingual;
  /** Higher score = more infrastructure work needed. */
  score: number;
  /** Gap surfaced in the result when this option is picked. */
  gap?: Bilingual;
};

export type AuditQuestion = {
  id: string;
  eyebrow: Bilingual;
  question: Bilingual;
  help: Bilingual;
  options: AuditOption[];
};

export const auditQuestions: AuditQuestion[] = [
  {
    id: "stage",
    eyebrow: { en: "Your business", ro: "Afacerea ta" },
    question: { en: "Where is the business today?", ro: "Unde se află afacerea acum?" },
    help: {
      en: "This sets how much structure we start from.",
      ro: "Asta stabilește de la cât structură pornim.",
    },
    options: [
      {
        value: "idea",
        label: { en: "Idea or just launched", ro: "Idee sau abia lansat" },
        score: 3,
        gap: {
          en: "No foundation yet — everything you build now decides your next two years.",
          ro: "Nu există încă o bază — ce construiești acum decide următorii doi ani.",
        },
      },
      {
        value: "running",
        label: { en: "Running, under 10 people", ro: "Funcțional, sub 10 oameni" },
        score: 2,
      },
      {
        value: "scaling",
        label: { en: "Scaling, 10-50 people", ro: "În creștere, 10-50 oameni" },
        score: 2,
      },
      {
        value: "established",
        label: { en: "Established, 50+ people", ro: "Consolidat, 50+ oameni" },
        score: 1,
      },
    ],
  },
  {
    id: "web",
    eyebrow: { en: "Online presence", ro: "Prezența online" },
    question: {
      en: "How well does your website work for you?",
      ro: "Cât de bine lucrează site-ul pentru tine?",
    },
    help: {
      en: "A site that does not convert is a cost, not an asset.",
      ro: "Un site care nu convertește este un cost, nu un activ.",
    },
    options: [
      {
        value: "none",
        label: { en: "We don't have one", ro: "Nu avem site" },
        score: 3,
        gap: {
          en: "No owned platform — every lead depends on someone else's algorithm.",
          ro: "Nicio platformă proprie — fiecare lead depinde de algoritmul altcuiva.",
        },
      },
      {
        value: "outdated",
        label: { en: "Outdated, we're embarrassed by it", ro: "Învechit, ne e rușine cu el" },
        score: 3,
        gap: {
          en: "The site undersells you — buyers judge credibility in seconds.",
          ro: "Site-ul te subevaluează — clienții judecă credibilitatea în câteva secunde.",
        },
      },
      {
        value: "okay",
        label: { en: "Fine, but it doesn't sell", ro: "Decent, dar nu vinde" },
        score: 2,
        gap: {
          en: "Traffic arrives and leaves — there is no conversion path.",
          ro: "Traficul vine și pleacă — nu există un drum spre conversie.",
        },
      },
      { value: "strong", label: { en: "Strong and converting", ro: "Solid și convertește" }, score: 0 },
    ],
  },
  {
    id: "manual",
    eyebrow: { en: "Daily work", ro: "Munca zilnică" },
    question: {
      en: "How much of the week goes into repetitive manual work?",
      ro: "Cât din săptămână se duce în muncă manuală repetitivă?",
    },
    help: {
      en: "Copy-paste, re-typing, chasing documents, manual reporting.",
      ro: "Copy-paste, retastare, alergat după documente, raportare manuală.",
    },
    options: [
      {
        value: "most",
        label: { en: "Most of it", ro: "Cea mai mare parte" },
        score: 3,
        gap: {
          en: "Your team is the integration layer — that is the most expensive software you own.",
          ro: "Echipa ta este stratul de integrare — cel mai scump software pe care îl ai.",
        },
      },
      {
        value: "half",
        label: { en: "Roughly half", ro: "Aproximativ jumătate" },
        score: 2,
        gap: {
          en: "Half the week is recoverable with automation.",
          ro: "Jumătate din săptămână poate fi recuperată cu automatizare.",
        },
      },
      { value: "some", label: { en: "A few hours", ro: "Câteva ore" }, score: 1 },
      { value: "little", label: { en: "Almost none", ro: "Aproape deloc" }, score: 0 },
    ],
  },
  {
    id: "systems",
    eyebrow: { en: "Systems", ro: "Sisteme" },
    question: {
      en: "Where does your business data actually live?",
      ro: "Unde stau de fapt datele afacerii?",
    },
    help: {
      en: "One connected source of truth, or scattered files?",
      ro: "O singură sursă conectată sau fișiere împrăștiate?",
    },
    options: [
      {
        value: "spreadsheets",
        label: { en: "Spreadsheets and inboxes", ro: "Tabele și inbox-uri" },
        score: 3,
        gap: {
          en: "No single source of truth — reporting is guesswork and handover is risky.",
          ro: "Nicio sursă unică de adevăr — raportarea e presupunere, predarea e riscantă.",
        },
      },
      {
        value: "disconnected",
        label: { en: "Several tools that don't talk", ro: "Mai multe tool-uri care nu comunică" },
        score: 2,
        gap: {
          en: "Disconnected tools duplicate data and hide errors.",
          ro: "Tool-urile deconectate dublează datele și ascund erorile.",
        },
      },
      { value: "partly", label: { en: "Partly integrated", ro: "Parțial integrate" }, score: 1 },
      { value: "connected", label: { en: "One connected system", ro: "Un sistem conectat" }, score: 0 },
    ],
  },
  {
    id: "ai",
    eyebrow: { en: "AI", ro: "AI" },
    question: { en: "How are you using AI today?", ro: "Cum folosești AI în prezent?" },
    help: {
      en: "Not as a gadget — as part of the workflow.",
      ro: "Nu ca gadget — ca parte din fluxul de lucru.",
    },
    options: [
      {
        value: "not",
        label: { en: "Not at all", ro: "Deloc" },
        score: 3,
        gap: {
          en: "Competitors are compressing the same work into a fraction of the hours.",
          ro: "Competitorii comprimă aceeași muncă în câteva ore.",
        },
      },
      {
        value: "adhoc",
        label: { en: "People use chatbots ad hoc", ro: "Oamenii folosesc chatboți la întâmplare" },
        score: 2,
        gap: {
          en: "Ad-hoc AI use means no consistency, no quality control and real data risk.",
          ro: "AI folosit haotic înseamnă zero consistență, zero control al calității și risc de date.",
        },
      },
      { value: "some", label: { en: "A few processes", ro: "Câteva procese" }, score: 1 },
      { value: "core", label: { en: "Built into operations", ro: "Integrat în operațiuni" }, score: 0 },
    ],
  },
  {
    id: "owner",
    eyebrow: { en: "Dependency", ro: "Dependență" },
    question: {
      en: "What happens if you step away for two weeks?",
      ro: "Ce se întâmplă dacă pleci două săptămâni?",
    },
    help: {
      en: "Infrastructure exists so the business does not depend on one person.",
      ro: "Infrastructura există ca afacerea să nu depindă de o singură persoană.",
    },
    options: [
      {
        value: "stops",
        label: { en: "Things stop", ro: "Se oprește totul" },
        score: 3,
        gap: {
          en: "The business runs on you, not on a system.",
          ro: "Afacerea funcționează pe tine, nu pe un sistem.",
        },
      },
      {
        value: "slows",
        label: { en: "It slows down badly", ro: "Încetinește serios" },
        score: 2,
      },
      { value: "fine", label: { en: "Mostly fine", ro: "În mare, e bine" }, score: 1 },
      { value: "autonomous", label: { en: "Runs without me", ro: "Merge fără mine" }, score: 0 },
    ],
  },
  {
    id: "budget",
    eyebrow: { en: "Investment", ro: "Investiție" },
    question: {
      en: "What can you invest to fix this properly?",
      ro: "Cât poți investi ca să rezolvi asta corect?",
    },
    help: {
      en: "Honest answers get an honest plan — no surprises later.",
      ro: "Răspunsuri sincere primesc un plan sincer — fără surprize.",
    },
    options: [
      { value: "exploring", label: { en: "Just exploring", ro: "Doar explorez" }, score: 0 },
      { value: "small", label: { en: "Under €1.000", ro: "Sub 1.000 €" }, score: 1 },
      { value: "mid", label: { en: "€1.000 - €5.000", ro: "1.000 € - 5.000 €" }, score: 2 },
      { value: "large", label: { en: "€5.000+", ro: "5.000 € +" }, score: 3 },
    ],
  },
];

export type AuditAnswers = Record<string, string>;

export type AuditResult = {
  score: number;
  maxScore: number;
  level: "solid" | "leaking" | "fragile";
  headline: Bilingual;
  summary: Bilingual;
  gaps: Bilingual[];
  moves: Bilingual[];
  recommendedTier: string;
  tierLabel: Bilingual;
};

const maxScore = auditQuestions.reduce(
  (sum, q) => sum + Math.max(...q.options.map((o) => o.score)),
  0,
);

export function scoreAudit(answers: AuditAnswers): AuditResult {
  let score = 0;
  const gaps: Bilingual[] = [];

  for (const question of auditQuestions) {
    const picked = question.options.find((o) => o.value === answers[question.id]);
    if (!picked) continue;
    score += picked.score;
    if (picked.gap) gaps.push(picked.gap);
  }

  const budget = answers["budget"];
  const level: AuditResult["level"] = score >= 13 ? "fragile" : score >= 7 ? "leaking" : "solid";

  const headline: Bilingual =
    level === "fragile"
      ? {
          en: "Your operation is running on people, not infrastructure.",
          ro: "Operațiunea ta funcționează pe oameni, nu pe infrastructură.",
        }
      : level === "leaking"
        ? {
            en: "The foundation is there — it is leaking time in a few clear places.",
            ro: "Baza există — pierde timp în câteva locuri clare.",
          }
        : {
            en: "You are in good shape. The upside now is optimisation, not rebuilding.",
            ro: "Ești pe drumul bun. Câștigul acum este optimizarea, nu reconstrucția.",
          };

  const summary: Bilingual =
    level === "fragile"
      ? {
          en: "We would start with an audit and a blueprint before building anything, so the first build fixes the cause and not the symptom.",
          ro: "Am începe cu un audit și un blueprint înainte de a construi ceva, ca prima livrare să rezolve cauza, nu simptomul.",
        }
      : level === "leaking"
        ? {
            en: "A focused build plus two or three automations usually recovers the most hours here.",
            ro: "O livrare focusată plus două-trei automatizări recuperează de obicei cele mai multe ore aici.",
          }
        : {
            en: "We would look at measurement, AI-assisted workflows and the parts a growing team will strain first.",
            ro: "Ne-am uita la măsurare, fluxuri asistate de AI și zonele care cedează primele când echipa crește.",
          };

  const moves: Bilingual[] = [];
  if (answers["web"] === "none" || answers["web"] === "outdated") {
    moves.push({
      en: "Rebuild the website as a conversion asset with clear tracking.",
      ro: "Reconstruim site-ul ca activ de conversie, cu măsurare clară.",
    });
  } else if (answers["web"] === "okay") {
    moves.push({
      en: "Rework the offer, page structure and calls to action on the current site.",
      ro: "Refacem oferta, structura paginilor și îndemnurile pe site-ul actual.",
    });
  }
  if (answers["systems"] === "spreadsheets" || answers["systems"] === "disconnected") {
    moves.push({
      en: "Consolidate your data into one connected system your team actually uses.",
      ro: "Consolidăm datele într-un sistem conectat pe care echipa îl folosește real.",
    });
  }
  if (answers["manual"] === "most" || answers["manual"] === "half") {
    moves.push({
      en: "Automate the two heaviest repetitive flows first and measure the hours saved.",
      ro: "Automatizăm primele două fluxuri repetitive grele și măsurăm orele salvate.",
    });
  }
  if (answers["ai"] === "not" || answers["ai"] === "adhoc") {
    moves.push({
      en: "Put one governed AI workflow into production instead of scattered chatbot use.",
      ro: "Punem în producție un flux AI guvernat, în loc de chatboți folosiți haotic.",
    });
  }
  if (answers["owner"] === "stops" || answers["owner"] === "slows") {
    moves.push({
      en: "Document and hand off the processes that only exist in your head.",
      ro: "Documentăm și predăm procesele care există doar în capul tău.",
    });
  }
  if (moves.length === 0) {
    moves.push({
      en: "Instrument what you have, then optimise the weakest measured step.",
      ro: "Măsurăm ce ai, apoi optimizăm cel mai slab pas măsurat.",
    });
  }

  const recommendedTier =
    budget === "large" || level === "fragile"
      ? "pro"
      : budget === "mid" || level === "leaking"
        ? "growth"
        : budget === "small"
          ? "starter"
          : "free";

  const tierLabel: Bilingual =
    recommendedTier === "pro"
      ? { en: "Pro — full build and unlimited support", ro: "Pro — construcție completă și suport nelimitat" }
      : recommendedTier === "growth"
        ? { en: "Growth — deeper consultancy and wider AI access", ro: "Growth — consultanță extinsă și acces AI mai larg" }
        : recommendedTier === "starter"
          ? { en: "Starter — 30 minutes live plus one month of AI access", ro: "Starter — 30 de minute live plus o lună de acces AI" }
          : { en: "Free call — build the plan first", ro: "Apel gratuit — construim planul mai întâi" };

  return {
    score,
    maxScore,
    level,
    headline,
    summary,
    gaps: gaps.slice(0, 4),
    moves: moves.slice(0, 3),
    recommendedTier,
    tierLabel,
  };
}

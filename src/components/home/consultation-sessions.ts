/**
 * The three consultation sessions, in one place: the session rows (homepage and /consultancy)
 * link to /contact?service=consultancy&session=<id>, and the contact form starts its text
 * with the chosen session's title.
 */

export const SESSION_IDS = ["automation", "website", "idea"] as const;

export type SessionId = (typeof SESSION_IDS)[number];

type Text = { en: string; ro: string };

export const CONSULTATION_SESSIONS: { id: SessionId; title: Text; audience: Text }[] = [
  // Business first: the assessment most visitors come for, then the website, then ideas.
  {
    id: "automation",
    title: {
      en: "What you could automate: an assessment",
      ro: "Ce poți automatiza: o evaluare",
    },
    audience: {
      en: "For businesses that want to know which tasks can be automated and what they would gain.",
      ro: "Pentru firmele care vor să afle ce sarcini se pot automatiza și ce ar câștiga.",
    },
  },
  {
    id: "website",
    title: {
      en: "Website strategy consultation",
      ro: "Consultanță pentru strategia site-ului",
    },
    audience: {
      en: "For businesses that want a new or redesigned website: pages, features and the visitor's path to an enquiry.",
      ro: "Pentru firmele care vor un site nou sau refăcut: paginile, funcțiile și drumul vizitatorului până la o cerere.",
    },
  },
  {
    id: "idea",
    title: {
      en: "Digital idea consultation",
      ro: "Consultanță pentru idei digitale",
    },
    audience: {
      en: "For people planning a digital product, a personal website or a creative project.",
      ro: "Pentru cine pregătește un produs digital, un site personal sau un proiect creativ.",
    },
  },
];

/** The contact form's starting text for a booked session: "Aș vrea o discuție: „…”." */
export function sessionPrefill(id: SessionId, lang: "en" | "ro"): string {
  const session = CONSULTATION_SESSIONS.find((s) => s.id === id) ?? CONSULTATION_SESSIONS[0];
  return lang === "ro"
    ? `Aș vrea o discuție: „${session.title.ro}”.`
    : `I would like a call: “${session.title.en}”.`;
}

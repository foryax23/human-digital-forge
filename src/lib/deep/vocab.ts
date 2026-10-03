import type { Bilingual, SectorVocabId } from "./contracts";

/*
 * Sector vocabulary for "Cercetare aprofundată" (plan A8, D12), by CAEN
 * division. The report templates, the AI prompt and the UI copy read it, and
 * it renames the "Clienți" line ("Pacienți", "Oaspeți"). Client-safe: no
 * imports beyond the shared contracts.
 *
 * The division is read from CAEN Rev.2 (the class the company filed its
 * accounts under) when known, else from the Rev.3 code ANAF shows today; the
 * groups below sit on divisions that did not move between the two revisions.
 */

const bi = (en: string, ro: string): Bilingual => ({ en, ro });

export type SectorWords = {
  /** One customer: "pacient", "client sau oaspete". */
  client: Bilingual;
  /** Customers: "pacienți", "clienți". */
  clients: Bilingual;
  /** Customers with the article, to start a sentence: "Pacienții", "Clienții". */
  clientsThe: Bilingual;
  /** What a customer asks for first: "programare", "rezervare", "cerere de ofertă". */
  booking: Bilingual;
  /** The same, as a short line reason: "programare online" (≤ 30 characters; EN without an article). */
  bookingOnline: Bilingual;
  /** Where the work of answering happens: "recepție", "sală", "birou", "dispecerat". */
  frontDesk: Bilingual;
  /** The renamed "Clienți" line. */
  line: Bilingual;
  /** Heading of the mystery-customer block: "Ce vede un pacient nou". */
  customerView: Bilingual;
};

export type SectorVocab = {
  id: SectorVocabId;
  words: SectorWords;
  /**
   * What the sector expects on a website: "booking" (an online booking or
   * reservation), "quote" (a quote request; a contact form counts) or nothing.
   */
  expects: "booking" | "quote" | null;
  /** Appointment sectors: reminders save reception time (A8 actions catalogue). */
  appointments: boolean;
};

const DIVISIONS: Array<[SectorVocabId, (d: number) => boolean]> = [
  ["health", (d) => d === 86],
  ["beauty", (d) => d === 96],
  ["food", (d) => d === 56],
  ["accommodation", (d) => d === 55],
  ["retail", (d) => d === 47],
  ["b2b_wholesale", (d) => d === 46],
  ["manufacturing", (d) => d >= 10 && d <= 33],
  ["auto", (d) => d === 45],
  ["construction", (d) => d >= 41 && d <= 43],
  ["transport", (d) => d >= 49 && d <= 53],
  ["it", (d) => d === 62 || d === 63],
  ["professional", (d) => d >= 69 && d <= 74],
];

export const VOCAB: Record<SectorVocabId, SectorVocab> = {
  health: {
    id: "health",
    expects: "booking",
    appointments: true,
    words: {
      client: bi("patient", "pacient"),
      clients: bi("patients", "pacienți"),
      clientsThe: bi("Patients", "Pacienții"),
      booking: bi("appointment", "programare"),
      bookingOnline: bi("online appointments", "programare online"),
      frontDesk: bi("reception", "recepție"),
      line: bi("Patients", "Pacienți"),
      customerView: bi("What a new patient sees", "Ce vede un pacient nou"),
    },
  },
  beauty: {
    id: "beauty",
    expects: "booking",
    appointments: true,
    words: {
      client: bi("client", "clientă sau client"),
      clients: bi("clients", "cliente și clienți"),
      clientsThe: bi("Clients", "Clientele și clienții"),
      booking: bi("appointment", "programare"),
      bookingOnline: bi("online appointments", "programare online"),
      frontDesk: bi("reception", "recepție"),
      line: bi("Clients", "Clienți"),
      customerView: bi("What a new client sees", "Ce vede o clientă nouă"),
    },
  },
  food: {
    id: "food",
    expects: "booking",
    appointments: false,
    words: {
      client: bi("guest", "client sau oaspete"),
      clients: bi("guests", "clienți"),
      clientsThe: bi("Guests", "Clienții"),
      booking: bi("reservation", "rezervare"),
      bookingOnline: bi("online reservations", "rezervare online"),
      frontDesk: bi("front of house", "sală"),
      line: bi("Guests", "Clienți"),
      customerView: bi("What a new guest sees", "Ce vede un client nou"),
    },
  },
  accommodation: {
    id: "accommodation",
    expects: "booking",
    appointments: false,
    words: {
      client: bi("guest", "oaspete"),
      clients: bi("guests", "oaspeți"),
      clientsThe: bi("Guests", "Oaspeții"),
      booking: bi("reservation", "rezervare"),
      bookingOnline: bi("online reservations", "rezervare online"),
      frontDesk: bi("reception", "recepție"),
      line: bi("Guests", "Oaspeți"),
      customerView: bi("What a new guest sees", "Ce vede un oaspete nou"),
    },
  },
  retail: {
    id: "retail",
    expects: null,
    appointments: false,
    words: {
      client: bi("customer", "client"),
      clients: bi("customers", "clienți"),
      clientsThe: bi("Customers", "Clienții"),
      booking: bi("order", "comandă"),
      bookingOnline: bi("online orders", "comandă online"),
      frontDesk: bi("shop", "magazin"),
      line: bi("Customers", "Clienți"),
      customerView: bi("What a new customer sees", "Ce vede un client nou"),
    },
  },
  b2b_wholesale: {
    id: "b2b_wholesale",
    expects: "quote",
    appointments: false,
    words: {
      client: bi("customer", "client"),
      clients: bi("customers", "clienți"),
      clientsThe: bi("Customers", "Clienții"),
      booking: bi("quote request", "cerere de ofertă"),
      bookingOnline: bi("quote request", "cerere de ofertă"),
      frontDesk: bi("sales office", "birou de vânzări"),
      line: bi("Customers", "Clienți"),
      customerView: bi("As a customer asking for a quote", "Ca un client care cere o ofertă"),
    },
  },
  manufacturing: {
    id: "manufacturing",
    expects: null,
    appointments: false,
    words: {
      client: bi("customer or distributor", "client sau distribuitor"),
      clients: bi("customers and distributors", "clienți și distribuitori"),
      clientsThe: bi("Customers and distributors", "Clienții și distribuitorii"),
      booking: bi("order", "comandă"),
      bookingOnline: bi("online orders", "comandă online"),
      frontDesk: bi("sales office", "birou de vânzări"),
      line: bi("Customers", "Clienți"),
      customerView: bi("As a customer asking for a quote", "Ca un client care cere o ofertă"),
    },
  },
  auto: {
    id: "auto",
    expects: "booking",
    appointments: true,
    words: {
      client: bi("customer", "client"),
      clients: bi("customers", "clienți"),
      clientsThe: bi("Customers", "Clienții"),
      booking: bi("service appointment", "programare la service"),
      bookingOnline: bi("online appointments", "programare online"),
      frontDesk: bi("service desk", "recepție service"),
      line: bi("Customers", "Clienți"),
      customerView: bi("What a new customer sees", "Ce vede un client nou"),
    },
  },
  construction: {
    id: "construction",
    expects: "quote",
    appointments: false,
    words: {
      client: bi("customer", "client"),
      clients: bi("customers", "clienți"),
      clientsThe: bi("Customers", "Clienții"),
      booking: bi("quote request", "cerere de ofertă"),
      bookingOnline: bi("quote request", "cerere de ofertă"),
      frontDesk: bi("estimating", "ofertare"),
      line: bi("Customers", "Clienți"),
      customerView: bi("As a customer asking for a quote", "Ca un client care cere o ofertă"),
    },
  },
  transport: {
    id: "transport",
    expects: "quote",
    appointments: false,
    words: {
      client: bi("customer", "client"),
      clients: bi("customers", "clienți"),
      clientsThe: bi("Customers", "Clienții"),
      booking: bi("quote request", "cerere de ofertă"),
      bookingOnline: bi("quote request", "cerere de ofertă"),
      frontDesk: bi("dispatch", "dispecerat"),
      line: bi("Customers", "Clienți"),
      customerView: bi("As a customer asking for a quote", "Ca un client care cere o ofertă"),
    },
  },
  it: {
    id: "it",
    expects: null,
    appointments: false,
    words: {
      client: bi("client", "client"),
      clients: bi("clients", "clienți"),
      clientsThe: bi("Clients", "Clienții"),
      booking: bi("project", "proiect"),
      bookingOnline: bi("project request", "cerere de proiect"),
      frontDesk: bi("team", "echipă"),
      line: bi("Clients", "Clienți"),
      customerView: bi("As a client with a project", "Ca un client cu un proiect"),
    },
  },
  professional: {
    id: "professional",
    expects: "quote",
    appointments: true,
    words: {
      client: bi("client", "client"),
      clients: bi("clients", "clienți"),
      clientsThe: bi("Clients", "Clienții"),
      booking: bi("meeting", "întâlnire"),
      bookingOnline: bi("online meeting booking", "programare online"),
      frontDesk: bi("office", "birou"),
      line: bi("Clients", "Clienți"),
      customerView: bi("What a new client sees", "Ce vede un client nou"),
    },
  },
  generic: {
    id: "generic",
    expects: null,
    appointments: false,
    words: {
      client: bi("customer", "client"),
      clients: bi("customers", "clienți"),
      clientsThe: bi("Customers", "Clienții"),
      booking: bi("request", "cerere"),
      bookingOnline: bi("online request", "cerere online"),
      frontDesk: bi("team", "echipă"),
      line: bi("Customers", "Clienți"),
      customerView: bi("What a new customer sees", "Ce vede un client nou"),
    },
  },
};

/** The vocabulary group of a CAEN code (Rev.2 or Rev.3; the first two digits decide). */
export function vocabId(caen?: string): SectorVocabId {
  const digits = (caen ?? "").replace(/\D/g, "");
  if (digits.length < 2) return "generic";
  const division = Number(digits.slice(0, 2));
  return DIVISIONS.find(([, test]) => test(division))?.[0] ?? "generic";
}

/** Plan D2: `vocabFor(caen2)` → the group and its words (Bilingual). */
export function vocabFor(caen2?: string): { id: SectorVocabId; words: Record<string, Bilingual> } {
  const vocab = VOCAB[vocabId(caen2)];
  return { id: vocab.id, words: { ...vocab.words } };
}

/**
 * The single-language words the synthesis prompt uses (the shape of the
 * provisional SECTOR_WORDS), so the prompt and the report never use two
 * vocabularies.
 */
export function promptWords(id: SectorVocabId): {
  client: string;
  clients: string;
  booking: string;
  line: Bilingual;
} {
  const w = VOCAB[id].words;
  return { client: w.client.ro, clients: w.clients.ro, booking: w.booking.ro, line: w.line };
}

/** SECTOR_WORDS in the provisional shape, keyed by group (drop-in for synthesis). */
export const SECTOR_WORDS: Record<
  SectorVocabId,
  { client: string; clients: string; booking: string; line: Bilingual }
> = Object.fromEntries(
  (Object.keys(VOCAB) as SectorVocabId[]).map((id) => [id, promptWords(id)]),
) as Record<SectorVocabId, { client: string; clients: string; booking: string; line: Bilingual }>;

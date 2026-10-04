import { isPlanId, type PlanId } from "@/lib/plans";
import { monthlyText, PLAN_CATALOG } from "@/lib/pricing";
import { COMPANY } from "@/lib/scan/legal/company";

/*
 * What the team's alert and the visitor's confirmation say, per intake. Pure, so the tests
 * read the exact texts. Alerts are for the team (Romanian, every detail needed to reply);
 * confirmations go to the address the visitor typed, so they never repeat anything the
 * visitor wrote (no name, no message): a stranger's address cannot be used to send text of
 * someone else's choosing. No marketing in either.
 */

export type Lang = "ro" | "en";

export type IntakeEvent =
  | {
      kind: "contact";
      name: string;
      email: string;
      /** "website", "consultancy", … or "plan-growth" for "Cere contractul". */
      service?: string | null;
      clientType?: string | null;
      budget?: string | null;
      timeline?: string | null;
      description: string;
      lang: Lang;
    }
  | {
      kind: "scan_lead";
      email: string;
      name?: string;
      company?: string;
      cui?: string;
      website?: string;
      recommendedPlan: string;
      digitalMaturity: number;
      marketingConsent: boolean;
      lang: Lang;
    }
  | {
      kind: "consultation";
      /** The account's e-mail (signed in), when known. */
      email?: string;
      title: string;
      preferredAt?: string | null;
      notes?: string | null;
    }
  | {
      kind: "deep_call";
      email: string;
      phone: string;
      when: "dimineata" | "dupa_amiaza";
      cui: string;
      lang: Lang;
      runId: string;
    };

export type Message = { subject: string; text: string; html: string };

const SITE = "vortexhub.dev";

const cut = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/**
 * One line of visitor text: line breaks and control characters become spaces (a name cannot
 * add a fake "Telefon:" line to an alert), spaces collapse, at most `max` characters.
 */
export function clean(value: string | null | undefined, max = 200): string {
  const text = (value ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cut(text, max);
}

/** Multi-line visitor text (the message): line breaks kept, at most 2 blank lines in a row. */
function block(value: string | null | undefined, max: number): string {
  const text = (value ?? "")
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .replace(/[ ]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  return cut(text, max);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SERVICES: Record<string, string> = {
  website: "Site web",
  "ai-automation": "Automatizare AI",
  "digital-product": "Produse digitale",
  consultancy: "Consultanță",
  "not-sure": "Nu știe încă",
};

const CLIENT_TYPES: Record<string, string> = {
  individual: "Persoană fizică",
  business: "Firmă",
};

const LANG_NAMES: Record<Lang, string> = { ro: "română", en: "engleză" };

const WHEN: Record<"dimineata" | "dupa_amiaza", { ro: string; en: string }> = {
  dimineata: { ro: "dimineața", en: "in the morning" },
  dupa_amiaza: { ro: "după-amiaza", en: "in the afternoon" },
};

/** The plan of a contract request ("plan-growth"), or null. */
export function contractPlan(service: string | null | undefined): PlanId | null {
  const id = service?.startsWith("plan-") ? service.slice(5) : null;
  return isPlanId(id) ? id : null;
}

function planLabel(id: PlanId): string {
  return `${PLAN_CATALOG[id].name} (${monthlyText(PLAN_CATALOG[id].priceLei).ro})`;
}

/** "Etichetă: valoare" lines, skipping the empty ones. */
function rows(pairs: Array<[string, string | null | undefined]>): string[] {
  return pairs.filter(([, value]) => value && value.trim()).map(([k, v]) => `${k}: ${v}`);
}

function toMessage(subject: string, lines: string[]): Message {
  const text = lines.join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111;white-space:pre-wrap">${escapeHtml(text)}</div>`;
  return { subject, text, html };
}

/** The headline of the team's alert. */
export function alertTitle(event: IntakeEvent): string {
  switch (event.kind) {
    case "contact": {
      const plan = contractPlan(event.service);
      if (plan) return `Cerere de contract: abonamentul ${planLabel(plan)}`;
      if (event.service === "consultancy") return "Cerere de consultanță de pe site";
      return "Cerere nouă de pe site";
    }
    case "scan_lead":
      return "Lead nou din Vortex Scan (raportul PDF)";
    case "consultation":
      return "Consultație cerută din contul de client";
    case "deep_call":
      return "„Sună-mă” din Deep Research";
  }
}

/** The team's alert: Telegram text and the alert e-mail. */
export function alertMessage(event: IntakeEvent): Message {
  const title = alertTitle(event);
  let lines: string[];
  let who: string;
  switch (event.kind) {
    case "contact": {
      const plan = contractPlan(event.service);
      who = clean(event.name, 80) || clean(event.email, 120);
      lines = [
        title,
        "",
        ...rows([
          ["Nume", clean(event.name, 120)],
          ["E-mail", clean(event.email, 200)],
          ["Abonament", plan ? planLabel(plan) : null],
          ["Serviciu", plan ? null : (SERVICES[event.service ?? ""] ?? clean(event.service, 60))],
          ["Tip client", CLIENT_TYPES[event.clientType ?? ""] ?? clean(event.clientType, 40)],
          ["Buget", clean(event.budget, 120)],
          ["Termen", clean(event.timeline, 120)],
          ["Limba site-ului", LANG_NAMES[event.lang]],
        ]),
        "",
        "Mesaj:",
        block(event.description, 1500),
      ];
      break;
    }
    case "scan_lead": {
      who = clean(event.company, 80) || clean(event.email, 120);
      lines = [
        title,
        "",
        ...rows([
          ["E-mail", clean(event.email, 200)],
          ["Nume", clean(event.name, 120)],
          ["Firma", clean(event.company, 200)],
          ["CUI", clean(event.cui, 12)],
          ["Site", clean(event.website, 300)],
          ["Plan recomandat de scan", clean(event.recommendedPlan, 20)],
          ["Maturitate digitală", `${Math.round(event.digitalMaturity)}/100`],
          ["Acord pentru noutăți (marketing)", event.marketingConsent ? "da" : "nu"],
          ["Limba", LANG_NAMES[event.lang]],
        ]),
        "",
        event.marketingConsent
          ? "A primit PDF-ul și a bifat acordul pentru noutăți."
          : "A primit PDF-ul. Fără acord de marketing: îi scriem doar dacă ne cere ceva.",
      ];
      break;
    }
    case "consultation": {
      who = clean(event.email, 120) || "client";
      lines = [
        title,
        "",
        ...rows([
          ["Cont", clean(event.email, 200)],
          ["Subiect", clean(event.title, 200)],
          ["Data dorită", clean(event.preferredAt, 40)],
        ]),
        ...(event.notes ? ["", "Note:", block(event.notes, 1000)] : []),
      ];
      break;
    }
    case "deep_call": {
      who = clean(event.phone, 30);
      lines = [
        title,
        "",
        ...rows([
          ["Telefon", clean(event.phone, 30)],
          ["Când", WHEN[event.when].ro],
          ["CUI", clean(event.cui, 12)],
          ["Cont", clean(event.email, 200)],
          ["Raport", clean(event.runId, 40)],
          ["Limba", LANG_NAMES[event.lang]],
        ]),
        "",
        "Promisiunea afișată: îl sunăm în cel mult o zi lucrătoare.",
      ];
      break;
    }
  }
  return toMessage(`[Vortex Hub] ${title} · ${who}`, lines);
}

const SIGNATURE = [
  COMPANY.legalName,
  `${COMPANY.email} · ${SITE}`,
  `CUI ${COMPANY.cui} · ${COMPANY.city}`,
];

const FOOTER = {
  ro: `Ai primit acest e-mail pentru că adresa a fost folosită într-o cerere pe ${SITE}. Dacă nu ai trimis-o tu, poți ignora mesajul.`,
  en: `You received this e-mail because this address was used for a request on ${SITE}. If it was not you, you can ignore it.`,
};

/**
 * The visitor's confirmation, or null when there is none for this intake (a scan lead got
 * the PDF and asked for nothing more) or no address to send it to.
 */
export function confirmationMessage(event: IntakeEvent): (Message & { to: string }) | null {
  let lang: Lang = "ro";
  let subject: { ro: string; en: string };
  let body: { ro: string; en: string };
  switch (event.kind) {
    case "scan_lead":
      return null;
    case "contact": {
      lang = event.lang;
      const plan = contractPlan(event.service);
      if (plan) {
        const name = PLAN_CATALOG[plan].name;
        subject = {
          ro: `Am primit cererea pentru contractul ${name}`,
          en: `We received your request for the ${name} contract`,
        };
        body = {
          ro: `Am primit cererea ta pentru contractul abonamentului ${name}. Îți răspundem în cel mult o zi lucrătoare, pe această adresă, cu contractul spre citire.`,
          en: `We received your request for the ${name} plan contract. We reply within one working day, at this address, with the contract for you to read.`,
        };
      } else {
        subject = { ro: "Am primit cererea ta", en: "We received your request" };
        body = {
          ro: `Am primit cererea trimisă pe ${SITE}. Îți răspundem în cel mult o zi lucrătoare, pe această adresă.`,
          en: `We received the request you sent on ${SITE}. We reply within one working day, at this address.`,
        };
      }
      break;
    }
    case "deep_call": {
      lang = event.lang;
      subject = { ro: "Am primit cererea de apel", en: "We received your call request" };
      body = {
        ro: `Am primit cererea ta din raportul Deep Research. Te sunăm în cel mult o zi lucrătoare, ${WHEN[event.when].ro}, la numărul lăsat în raport.`,
        en: `We received your request from the Deep Research report. We call you within one working day, ${WHEN[event.when].en}, on the number you left in the report.`,
      };
      break;
    }
    case "consultation": {
      // The client portal does not say which language the account uses: Romanian.
      subject = {
        ro: "Am primit cererea de consultație",
        en: "We received your consultation request",
      };
      body = {
        ro: "Am primit cererea ta de consultație. Îți confirmăm ziua și ora în cel mult o zi lucrătoare.",
        en: "We received your consultation request. We confirm the day and time within one working day.",
      };
      break;
    }
  }
  const to = clean(event.email, 200);
  if (!to || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to)) return null;
  const lines = [
    lang === "ro" ? "Bună," : "Hello,",
    "",
    body[lang],
    "",
    lang === "ro"
      ? "Dacă vrei să adaugi ceva, răspunde la acest e-mail."
      : "If you want to add anything, reply to this e-mail.",
    "",
    ...SIGNATURE,
    "",
    FOOTER[lang],
  ];
  return { to, ...toMessage(`${subject[lang]} | Vortex Hub`, lines) };
}

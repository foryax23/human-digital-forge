import type { Bilingual, Lang } from "@/lib/scan/types";

import { roNeedsDe } from "./blueprint/format";

/*
 * Romanian wording for the strings the engine and the audit keep in English
 * (tool names, the classification basis, audit evidence) and the spelling
 * fixes for registry data. Shared by the scan screens and the PDF, so both
 * read the same; anything not listed is shown unchanged, so a new tool name
 * or evidence format never breaks a page.
 */

/* ---------------------------------------------------------- diacritics */

const COMMA_BELOW: Record<string, string> = { ş: "ș", ţ: "ț", Ş: "Ș", Ţ: "Ț" };

/**
 * Every string in a plain data tree with the legacy cedilla letters (ş ţ,
 * still common in ANAF records and older sites) spelled the correct Romanian
 * way, with a comma below (ș ț): "Timiş, Revoluţiei" → "Timiș, Revoluției".
 */
export function withCommaBelow<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/[şţŞŢ]/g, (letter) => COMMA_BELOW[letter]) as T;
  }
  if (Array.isArray(value)) return value.map(withCommaBelow) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, withCommaBelow(item)]),
    ) as T;
  }
  return value;
}

/**
 * A registry text written in capitals ("JUD. TIMIŞ, MUN. TIMIŞOARA, BD. REVOLUŢIEI 1989,
 * NR. 10", "DENTAL SMILE CLINIC S.R.L.") in normal Romanian case: words capitalised,
 * short abbreviations with a dot lower-case ("jud.", "mun.", "bd.", "nr."), the legal
 * form kept ("S.R.L.", "S.A."), comma-below letters. Mixed-case text is left as it is.
 */
export function titleCaseAnaf(text: string): string {
  const fixed = withCommaBelow(text);
  if (fixed !== fixed.toLocaleUpperCase("ro")) return fixed;
  return fixed
    .toLocaleLowerCase("ro")
    .replace(/(^|[\s,(/-])(\p{L}+)(\.?)/gu, (_, sep: string, word: string, dot: string) => {
      if (dot && word.length <= 4 && !/^(s|r|l|a)$/.test(word)) return `${sep}${word}${dot}`;
      return `${sep}${word.charAt(0).toLocaleUpperCase("ro")}${word.slice(1)}${dot}`;
    })
    .replace(/\bS\.r\.l\./g, "S.R.L.")
    .replace(/\bS\.a\./g, "S.A.")
    .replace(/\b(Srl|Sa|Pfa)\b/g, (form) => form.toUpperCase());
}

/* --------------------------------------------------------------- tools */

/** Tool names from the playbooks, in common Romanian business wording. */
const TOOLS_RO: Record<string, string> = {
  "AI assistant (Claude)": "Asistent AI (Claude)",
  "AI document reading": "Citire de documente cu AI",
  "AI drafting": "Texte propuse de AI",
  "AI meeting notes": "Notițe de ședință cu AI",
  "AI summaries": "Rezumate cu AI",
  "ANAF e-Factura API": "Conectare la e-Factura (ANAF)",
  "ANAF e-Transport API": "Conectare la e-Transport (ANAF)",
  "API connectors": "Conectori între aplicații",
  "Attendance app": "Aplicație de pontaj",
  "Bank feed": "Import automat de extrase bancare",
  "Booking calendar": "Calendar de programări",
  "Booking link": "Link de programare",
  "Booking system": "Sistem de rezervări",
  "CRM / client list": "Listă comună de clienți",
  "Calendar sync": "Sincronizare cu Google Calendar",
  "Card payments": "Plăți cu cardul",
  "Channel manager": "Channel manager (sincronizarea rezervărilor)",
  Email: "E-mail",
  "Email / SMS": "E-mail / SMS",
  "Email / WhatsApp": "E-mail / WhatsApp",
  "Helpdesk (Freshdesk / Zendesk)": "Sistem de tichete (Freshdesk / Zendesk)",
  PMS: "Program de gestiune hotelieră (PMS)",
  POS: "Casa de marcat / POS",
  "WhatsApp / email": "WhatsApp / e-mail",
  "Client portal": "Portal pentru clienți",
  "Courier tracking API": "Urmărirea coletelor la curier",
  "Delivery aggregator integration": "Integrare cu platformele de livrare",
  "Digital loyalty card": "Card de fidelitate digital",
  "Document OCR": "Citire automată a documentelor",
  "Document templates": "Șabloane de documente",
  "Donor CRM": "Evidența donatorilor",
  "Driver app": "Aplicație pentru șoferi",
  "E-signature": "Semnătură electronică",
  "ERP / TMS integration": "Integrare ERP / TMS",
  "ERP integration": "Integrare ERP",
  "ERP integration (SAGA, WinMentor, SmartBill)": "Integrare ERP (SAGA, WinMentor, SmartBill)",
  "Email / SMS marketing": "Marketing prin e-mail / SMS",
  "Email alerts": "Alerte pe e-mail",
  "Email automation": "E-mailuri automate",
  "GDPR-compliant storage": "Stocare conformă GDPR",
  "GPS / fleet tracking": "GPS / monitorizarea flotei",
  "Google Business Profile": "Profil Google Business",
  "Kitchen display": "Ecran pentru bucătărie",
  "Knowledge base": "Bază de cunoștințe",
  "Membership software": "Program pentru abonamente",
  "Meta / Google Ads APIs": "Conectare la Meta / Google Ads",
  "Meta Business Suite / Buffer": "Meta Business Suite / Buffer",
  "Mobile forms app": "Formulare pe mobil",
  "Online Form 230": "Formularul 230 online",
  "Online check-in": "Check-in online",
  "Online forms": "Formulare online",
  "Online forms with e-signature": "Formulare online cu semnătură electronică",
  "PDF templates": "Șabloane PDF",
  "POS / ERP stock": "Stocuri din POS / ERP",
  "Patient / client database": "Bază de date cu pacienți / clienți",
  "Payroll export": "Export pentru salarizare",
  "Portal feeds (imobiliare.ro, Storia, OLX)":
    "Publicare automată pe portaluri (imobiliare.ro, Storia, OLX)",
  "Price list": "Listă de prețuri",
  "Product feed": "Listă de produse pentru marketplace",
  "Production dashboard": "Panou de producție",
  "Project board (Trello / Asana)": "Panou de proiecte (Trello / Asana)",
  "Project tool": "Aplicație de proiecte",
  "QR check-in": "Check-in cu cod QR",
  "Quote builder": "Generator de oferte",
  "Rota & time-tracking app": "Aplicație de ture și pontaj",
  "SAGA / SmartBill import": "Import în SAGA / SmartBill",
  "SAGA / WinMentor import": "Import în SAGA / WinMentor",
  "SMS gateway": "SMS",
  "Sameday / FAN Courier / Cargus API": "Conectare la Sameday / FAN Courier / Cargus",
  "Secure patient portal": "Portal securizat pentru pacienți",
  "Shop integration": "Integrare cu magazinul online",
  "Shop notifications": "Notificări din magazin",
  "Shop-floor tablets": "Tablete în hală",
  "SmartBill / Oblio reminders": "Notificări de plată SmartBill / Oblio",
  "Supplier email or portal": "E-mail sau portal pentru furnizori",
  "TMS / invoicing": "TMS / facturare",
  "Time tracker (Toggl / Clockify)": "Pontaj pe proiecte (Toggl / Clockify)",
  "WhatsApp / SMS": "WhatsApp / SMS",
  "WhatsApp Business API": "WhatsApp Business",
  "Website chat": "Chat pe site",
  "Website forms": "Formulare pe site",
  "Website integration": "Integrare pe site",
  "Workshop software": "Program pentru service",
  "eMAG Marketplace API": "Conectare la eMAG Marketplace",
  "portal.just.ro checks": "Verificări pe portal.just.ro",
};

export function localizeTool(tool: string, lang: Lang): string {
  return lang === "ro" ? (TOOLS_RO[tool] ?? tool) : tool;
}

/** A tool name in both languages. */
export function toolName(tool: string): Bilingual {
  return { en: tool, ro: TOOLS_RO[tool] ?? tool };
}

/* --------------------------------------------------------------- basis */

/**
 * One line of the classification basis ("CAEN 8623 (Dental practice
 * activities)", "Words on the site: implant, dental"). The CAEN label is
 * swapped for the registry's Romanian one when we have it: when the code is
 * the company's own, or the label is the registry's English one.
 */
export function localizeBasis(
  basis: string,
  lang: Lang,
  company?: { caen?: string; caenLabel?: Bilingual },
): string {
  if (lang !== "ro") return basis;
  const registry = company?.caenLabel;
  const ownCode = company?.caen?.replace(/\D/g, "").slice(0, 4);
  const caen = (code: string, label: string) =>
    registry?.ro &&
    (code === ownCode || label.trim().toLowerCase() === registry.en.trim().toLowerCase())
      ? registry.ro
      : label;
  const rules: Array<[RegExp, (...groups: string[]) => string]> = [
    [
      /^CAEN (\d+) \((.+)\): no specific playbook for this code$/,
      (code, label) =>
        `CAEN ${code} (${caen(code, label)}): nu avem un model dedicat pentru acest cod`,
    ],
    [
      /^CAEN (\d+): no specific playbook for this code$/,
      (code) => `CAEN ${code}: nu avem un model dedicat pentru acest cod`,
    ],
    [/^CAEN (\d+) \((.+)\)$/, (code, label) => `CAEN ${code} (${caen(code, label)})`],
    [/^Words on the site: (.+)$/, (words) => `Cuvinte de pe site: ${words}`],
    [/^Words in the name: (.+)$/, (words) => `Cuvinte din denumire: ${words}`],
    [
      /^Online checkout found on the website$/,
      () => "Site-ul are coș de cumpărături și plată online",
    ],
    [
      /^Not enough information to recognise the activity$/,
      () => "Nu am avut destule informații ca să recunoaștem activitatea",
    ],
    [
      /^Label refined by AI review of the public data$/,
      () => "Eticheta a fost ajustată cu AI, pe baza datelor publice",
    ],
    [/^Chosen by the visitor$/, () => "Ales de tine"],
  ];
  for (const [pattern, render] of rules) {
    const match = basis.match(pattern);
    if (match) return render(...match.slice(1));
  }
  return basis;
}

/* ------------------------------------------------------------ evidence */

const decimalComma = (text: string) => text.replace(/(\d)\.(\d)/g, "$1,$2");

/** Lighthouse and Chrome measurements, with the target a visitor compares them to. */
const VITALS: Array<{
  pattern: RegExp;
  render: (value: string, lang: Lang, device: string) => string;
}> = [
  {
    pattern: /^LCP (\d+(?:\.\d+)?) s \(Lighthouse, (mobile|desktop)\)$/,
    render: (value, lang, device) =>
      lang === "ro"
        ? `${decimalComma(value)} s (Lighthouse, ${device === "mobile" ? "mobil" : "desktop"}). Ținta e sub 2,5 s.`
        : `${value} s (Lighthouse, ${device}). The target is under 2.5 s.`,
  },
  {
    pattern: /^CLS (\d+(?:\.\d+)?) \(Lighthouse, (mobile|desktop)\)$/,
    render: (value, lang, device) => {
      const shift = String(Math.round(Number(value) * 100) / 100);
      return lang === "ro"
        ? `Deplasare ${decimalComma(shift)} (Lighthouse, ${device === "mobile" ? "mobil" : "desktop"}). Ținta e sub 0,1.`
        : `Layout shift ${shift} (Lighthouse, ${device}). The target is under 0.1.`;
    },
  },
  {
    pattern: /^TBT (\d+) ms \(Lighthouse, (mobile|desktop)\)$/,
    render: (value, lang, device) =>
      lang === "ro"
        ? `${value} ms blocat (Lighthouse, ${device === "mobile" ? "mobil" : "desktop"}). Ținta e sub 200 ms.`
        : `${value} ms blocked (Lighthouse, ${device}). The target is under 200 ms.`,
  },
  {
    pattern: /^CrUX LCP p75 (\d+(?:\.\d+)?) s$/,
    render: (value, lang) =>
      lang === "ro"
        ? `${decimalComma(value)} s la vizitatorii reali (date Chrome). Ținta e sub 2,5 s.`
        : `${value} s for real visitors (Chrome data). The target is under 2.5 s.`,
  },
  {
    pattern: /^CrUX INP p75 (\d+) ms$/,
    render: (value, lang) =>
      lang === "ro"
        ? `${value} ms la vizitatorii reali (date Chrome). Ținta e sub 200 ms.`
        : `${value} ms for real visitors (Chrome data). The target is under 200 ms.`,
  },
];

/**
 * Audit evidence is raw proof from the page (headers, file names, values).
 * Measurements read as a value plus its target ("4,6 s (Lighthouse, mobil).
 * Ținta e sub 2,5 s."); elsewhere only the English words around the values
 * are translated, and decimals get a Romanian comma.
 */
export function localizeEvidence(evidence: string, lang: Lang): string {
  for (const vital of VITALS) {
    const match = evidence.match(vital.pattern);
    if (match) return vital.render(match[1], lang, match[2] ?? "mobile");
  }
  if (lang !== "ro") return evidence;
  let out = evidence;
  const roDe = (n: string) => (roNeedsDe(Number(n)) ? "de " : "");
  const words: Array<[RegExp, string | ((match: string, ...groups: string[]) => string)]> = [
    [/\(Lighthouse, mobile\)/, "(Lighthouse, mobil)"],
    [/^Lighthouse accessibility (\d+)/, "Accesibilitate Lighthouse $1"],
    [/^Time to first byte: /, "Timp până la primul byte: "],
    [/ \(uncompressed\)$/, " (necomprimat)"],
    [
      /^No Content-Encoding header on the homepage$/,
      "Pagina principală nu trimite antetul Content-Encoding",
    ],
    [/^(\d+) stylesheets$/, (_, n) => `${n} ${roDe(n)}fișiere CSS`],
    [/^(\d+) <img> without loading="lazy"$/, '$1 <img> fără loading="lazy"'],
    [/: no Cache-Control$/, ": fără Cache-Control"],
    [/^(\d+) KB inline <script>$/, (_, n) => `${n} KB de <script> inline`],
    [/→ HTTP no response$/, "→ fără răspuns"],
    [/^Missing: /, "Lipsesc: "],
    [/^(\d+) words in the HTML$/, (_, n) => `${n} ${roDe(n)}cuvinte în HTML`],
    [/^(\d+) words$/, (_, n) => `${n} ${roDe(n)}cuvinte`],
    [/^Languages found: /, "Limbi găsite: "],
    [/^Languages: /, "Limbi: "],
    [/^(.+) header missing$/, "Lipsește antetul $1"],
    [/^1 page analysed$/, "1 pagină analizată"],
    [/^(\d+) pages analysed$/, (_, n) => `${n} ${roDe(n)}pagini analizate`],
    [/^implied by /, "dedus din "],
    [/^Googlebot disallowed on \/$/, "Googlebot blocat pe /"],
  ];
  for (const [pattern, replacement] of words) {
    out =
      typeof replacement === "string"
        ? out.replace(pattern, replacement)
        : out.replace(pattern, replacement);
  }
  return out;
}

/* --------------------------------------------------------------- money */

/** Romanian prose says "lei"; blueprint copy written by hand or by AI sometimes says RON. */
export function localizeMoney(value: string, lang: Lang): string {
  return lang === "ro" ? value.replace(/\bRON\b/g, "lei").replace(/\bLEI\b/g, "lei") : value;
}

/** Joins sentences or clauses without doubling the full stop: "a; b; c." */
export function joinClauses(parts: string[], separator = "; "): string {
  const clean = parts
    .map((part) => part.trim().replace(/[.;]+$/, ""))
    .filter(Boolean)
    // After a semicolon a clause goes on in lower case ("…; cea mai mare parte…"), unless
    // it opens with a name ("Google", "WhatsApp") or an acronym.
    .map((part, i) =>
      i > 0 &&
      separator.trim() === ";" &&
      /^[A-ZĂÂÎȘȚ][a-zăâîșț]+\b/.test(part) &&
      !KEEP_NAMES.test(part)
        ? part.charAt(0).toLocaleLowerCase("ro") + part.slice(1)
        : part,
    );
  return clean.length ? `${clean.join(separator)}.` : "";
}

/** Words that keep their capital inside a sentence. */
const KEEP_NAMES =
  /^(Google|Facebook|Instagram|LinkedIn|WhatsApp|Meta|Microsoft|Stripe|Claude|OpenAI|ANAF|INS|Vortex|Romania|România|Timișoara|București)\b/;

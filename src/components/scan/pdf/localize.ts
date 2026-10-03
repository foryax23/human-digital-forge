import type { Bilingual, Lang } from "@/lib/scan/types";

import { roDe } from "./format";

/*
 * Romanian wording for the few blueprint strings that the engine keeps in
 * English only: tool names, the classification basis and audit evidence.
 * Brand and product names stay as they are; anything not listed is shown
 * unchanged, so a new tool name never breaks the PDF.
 */

/** Tool names from the playbooks, in common Romanian business wording. */
const TOOLS_RO: Record<string, string> = {
  "AI assistant (Claude)": "Asistent AI (Claude)",
  "AI document reading": "Citire de documente cu AI",
  "AI drafting": "Redactare cu AI",
  "AI meeting notes": "Notițe de ședință cu AI",
  "AI summaries": "Rezumate cu AI",
  "ANAF e-Factura API": "API ANAF e-Factura",
  "ANAF e-Transport API": "API ANAF e-Transport",
  "API connectors": "Conectori API",
  "Attendance app": "Aplicație de pontaj",
  "Bank feed": "Import automat de extrase bancare",
  "Booking calendar": "Calendar de programări",
  "Booking link": "Link de programare",
  "Booking system": "Sistem de rezervări",
  "CRM / client list": "CRM / listă de clienți",
  "Calendar sync": "Sincronizare cu calendarul",
  "Card payments": "Plăți cu cardul",
  "Client portal": "Portal pentru clienți",
  "Courier tracking API": "API de urmărire a coletelor",
  "Delivery aggregator integration": "Integrare cu platformele de livrare",
  "Digital loyalty card": "Card de fidelitate digital",
  "Document OCR": "OCR pentru documente",
  "Document templates": "Șabloane de documente",
  "Donor CRM": "CRM pentru donatori",
  "Driver app": "Aplicație pentru șoferi",
  "E-signature": "Semnătură electronică",
  "ERP / TMS integration": "Integrare ERP / TMS",
  "ERP integration": "Integrare ERP",
  "ERP integration (SAGA, WinMentor, SmartBill)": "Integrare ERP (SAGA, WinMentor, SmartBill)",
  "Email / SMS marketing": "Marketing prin email / SMS",
  "Email alerts": "Alerte pe email",
  "Email automation": "Emailuri automate",
  "GDPR-compliant storage": "Stocare conformă GDPR",
  "GPS / fleet tracking": "GPS / monitorizarea flotei",
  "Google Business Profile": "Profil Google Business",
  "Kitchen display": "Ecran pentru bucătărie",
  "Knowledge base": "Bază de cunoștințe",
  "Membership software": "Program pentru abonamente",
  "Meta / Google Ads APIs": "API Meta / Google Ads",
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
  "Product feed": "Feed de produse",
  "Production dashboard": "Panou de producție",
  "Project board (Trello / Asana)": "Panou de proiecte (Trello / Asana)",
  "Project tool": "Aplicație de proiecte",
  "QR check-in": "Check-in cu cod QR",
  "Quote builder": "Generator de oferte",
  "Rota & time-tracking app": "Aplicație de ture și pontaj",
  "SAGA / SmartBill import": "Import în SAGA / SmartBill",
  "SAGA / WinMentor import": "Import în SAGA / WinMentor",
  "SMS gateway": "Serviciu de SMS",
  "Sameday / FAN Courier / Cargus API": "API Sameday / FAN Courier / Cargus",
  "Secure patient portal": "Portal securizat pentru pacienți",
  "Shop integration": "Integrare cu magazinul online",
  "Shop notifications": "Notificări din magazin",
  "Shop-floor tablets": "Tablete în hală",
  "SmartBill / Oblio reminders": "Notificări de plată SmartBill / Oblio",
  "Supplier email or portal": "Email sau portal pentru furnizori",
  "TMS / invoicing": "TMS / facturare",
  "Time tracker (Toggl / Clockify)": "Pontaj pe proiecte (Toggl / Clockify)",
  "Website chat": "Chat pe site",
  "Website forms": "Formulare pe site",
  "Website integration": "Integrare pe site",
  "Workshop software": "Program pentru service",
  "eMAG Marketplace API": "API eMAG Marketplace",
  "portal.just.ro checks": "Verificări pe portal.just.ro",
};

export function localizeTool(tool: string, lang: Lang): string {
  return lang === "ro" ? (TOOLS_RO[tool] ?? tool) : tool;
}

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

/**
 * Audit evidence is raw proof from the page (headers, file names, values);
 * only the English words around the values are translated, and Lighthouse
 * decimals get a Romanian comma.
 */
export function localizeEvidence(evidence: string, lang: Lang): string {
  if (lang !== "ro") return evidence;
  let out = evidence;
  if (/^(LCP|CLS|TBT|CrUX)\b/.test(out)) out = out.replace(/(\d)\.(\d)/g, "$1,$2");
  const words: Array<[RegExp, string | ((match: string, ...groups: string[]) => string)]> = [
    [/\(Lighthouse, mobile\)/, "(Lighthouse, mobil)"],
    [/^Lighthouse accessibility (\d+)/, "Accesibilitate Lighthouse $1"],
    [/^Time to first byte: /, "Timp până la primul byte: "],
    [/ \(uncompressed\)$/, " (necomprimat)"],
    [
      /^No Content-Encoding header on the homepage$/,
      "Pagina principală nu trimite antetul Content-Encoding",
    ],
    [/^(\d+) stylesheets$/, "$1 fișiere CSS"],
    [/^(\d+) <img> without loading="lazy"$/, '$1 <img> fără loading="lazy"'],
    [/: no Cache-Control$/, ": fără Cache-Control"],
    [/^(\d+) KB inline <script>$/, "$1 KB de <script> inline"],
    [/→ HTTP no response$/, "→ fără răspuns"],
    [/^Missing: /, "Lipsesc: "],
    [/^(\d+) words in the HTML$/, (_, n) => `${n} ${roDe(Number(n))}cuvinte în HTML`],
    [/^(\d+) words$/, (_, n) => `${n} ${roDe(Number(n))}cuvinte`],
    [/^Languages found: /, "Limbi găsite: "],
    [/^Languages: /, "Limbi: "],
    [/^(.+) header missing$/, "Lipsește antetul $1"],
    [/^1 page analysed$/, "1 pagină analizată"],
    [/^(\d+) pages analysed$/, "$1 pagini analizate"],
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

/** Romanian prose says "lei"; blueprint copy written by hand or by AI sometimes says RON. */
export function localizeMoney(value: string, lang: Lang): string {
  return lang === "ro" ? value.replace(/\bRON\b/g, "lei") : value;
}

/** Joins sentences or clauses without doubling the full stop: "a; b; c." */
export function joinClauses(parts: string[], separator = "; "): string {
  const clean = parts.map((part) => part.trim().replace(/[.;]+$/, "")).filter(Boolean);
  return clean.length ? `${clean.join(separator)}.` : "";
}

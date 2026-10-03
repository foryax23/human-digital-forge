import type { Bilingual } from "@/lib/scan/types";

import { bi } from "./model";

/*
 * Short names for the catalogue, lower case, written to read well inside a
 * phase title ("Recenzii și evidența solicitărilor") and after "mai ales la"
 * ("…, mai ales la programări"). A missing id falls back to the full title.
 */

/** Per opportunity: the work in two or three words. */
export const SHORT_NAMES: Record<string, Bilingual> = {
  "einvoice-automation": bi("e-Factura invoicing", "facturare automată în e-Factura"),
  "document-ocr": bi("receipts read automatically", "bonuri citite automat"),
  "lead-capture-crm": bi("one list of enquiries", "evidența solicitărilor"),
  "review-requests": bi("reviews", "recenzii"),
  "ai-assistant": bi("website and WhatsApp assistant", "asistent pe site și WhatsApp"),
  "social-scheduling": bi("planned social posts", "postări planificate"),
  "reporting-dashboard": bi("weekly reporting", "raportare săptămânală"),
  "appointment-reminders": bi("automatic reminders", "reamintiri automate"),
  "online-booking": bi("online booking", "programări online"),
  "recall-reminders": bi("check-up recalls", "reamintiri pentru control"),
  "patient-intake": bi("digital patient forms", "fișe digitale"),
  "results-delivery": bi("results delivered online", "rezultate trimise online"),
  "membership-billing": bi("memberships and payments online", "abonamente și plăți online"),
  "staff-scheduling": bi("rota and timesheets", "ture și pontaj"),
  "delivery-orders": bi("delivery orders", "comenzi de livrare"),
  "inventory-reorder": bi("stock and supplier orders", "stocuri și comenzi la furnizori"),
  "channel-sync": bi("bookings in sync", "rezervări sincronizate"),
  "guest-messaging": bi("online check-in", "check-in online"),
  "loyalty-program": bi("loyalty", "fidelizare"),
  "order-confirmations": bi("order confirmations", "confirmarea comenzilor"),
  "awb-automation": bi("automatic shipping labels", "AWB-uri automate"),
  "order-notifications": bi("order updates", "notificări despre comenzi"),
  "abandoned-cart": bi("abandoned carts", "coșuri abandonate"),
  "marketplace-sync": bi("marketplace sync", "stoc sincronizat cu marketplace-urile"),
  "order-intake": bi("automatic order entry", "comenzi introduse automat"),
  "quote-generator": bi("faster quotes", "oferte rapide"),
  "payment-reminders": bi("payment reminders", "reamintiri de plată"),
  "client-onboarding": bi("client onboarding", "preluarea clienților noi"),
  "site-reports": bi("site reports", "rapoarte de șantier"),
  "client-updates": bi("client updates", "actualizări pentru clienți"),
  "listing-syndication": bi("listings published everywhere", "anunțuri publicate automat"),
  "document-assembly": bi("contracts from templates", "contracte din șabloane"),
  "client-documents": bi("client documents", "documentele clienților"),
  "spv-sync": bi("SPV downloads", "mesaje SPV descărcate automat"),
  "legal-deadlines": bi("court deadlines", "termene urmărite automat"),
  "time-tracking-invoicing": bi("time tracking and invoicing", "ore facturate automat"),
  "meeting-notes": bi("meeting notes", "notițe de ședință"),
  "client-reporting": bi("client reports", "rapoarte pentru clienți"),
  "support-triage": bi("support tickets", "tichete de suport"),
  "enrolment-payments": bi("enrolment and payments", "înscrieri și plăți online"),
  certificates: bi("attendance and certificates", "prezență și diplome"),
  "transport-documents": bi("transport documents", "documente de transport citite automat"),
  "eta-notifications": bi("delivery time updates", "ora de sosire comunicată automat"),
  "etransport-declarations": bi("e-Transport declarations", "declarații e-Transport"),
  "repair-status": bi("repair status updates", "stadiul reparațiilor"),
  "production-reporting": bi("production reporting", "raportare de producție"),
  "travel-documents": bi("travel documents", "documente de călătorie"),
  "donor-crm": bi("donors and Form 230", "donatori și Formularul 230"),
};

/** Pairs that read better as one phrase than as "X și Y" (order does not matter). */
export const PAIR_TITLES: Array<{ ids: [string, string]; title: Bilingual }> = [
  {
    ids: ["appointment-reminders", "online-booking"],
    title: bi("Automatic booking and reminders", "Programări și reamintiri automate"),
  },
  {
    ids: ["order-confirmations", "order-notifications"],
    title: bi("Order confirmations and updates", "Confirmări și notificări pentru comenzi"),
  },
];

/** The process an automation saves most time on, as it reads after "mai ales la". */
export const PROCESS_WORDS: Record<string, Bilingual> = {
  appointments: bi("bookings", "programări"),
  invoicing: bi("invoicing", "facturare"),
  bookkeeping: bi("paperwork for the accountant", "documentele pentru contabil"),
  sales: bi("enquiries and quotes", "solicitări și oferte"),
  reputation: bi("reviews", "recenzii"),
  "customer-service": bi("customer questions", "întrebările clienților"),
  marketing: bi("social posts", "postări"),
  reporting: bi("reporting", "rapoarte"),
  retention: bi("recalls", "reamintiri"),
  "patient-intake": bi("patient forms", "fișele pacienților"),
  "patient-communication": bi("sending results", "trimiterea rezultatelor"),
  memberships: bi("memberships", "abonamente"),
  staffing: bi("rotas and timesheets", "ture și pontaj"),
  orders: bi("orders", "comenzi"),
  inventory: bi("stock", "stocuri"),
  reservations: bi("bookings", "rezervări"),
  "guest-communication": bi("guest messages", "mesajele către oaspeți"),
  shipping: bi("shipping", "livrări"),
  catalogue: bi("the catalogue", "catalog"),
  collections: bi("collections", "încasări"),
  onboarding: bi("new clients", "clienții noi"),
  "field-operations": bi("site reports", "rapoartele de șantier"),
  "client-communication": bi("client updates", "comunicarea cu clienții"),
  listings: bi("listings", "anunțuri"),
  documents: bi("documents", "documente"),
  compliance: bi("ANAF filings", "obligațiile ANAF"),
  "case-management": bi("case files", "dosare"),
  billing: bi("billing", "facturare"),
  enrolment: bi("enrolments", "înscrieri"),
  administration: bi("admin", "partea administrativă"),
  production: bi("production", "producție"),
  fundraising: bi("donations", "donații"),
};

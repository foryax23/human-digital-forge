import type { Bilingual, Range } from "@/lib/scan/types";

import {
  bi,
  type OpportunityTemplate,
  type Playbook,
  type PlaybookEntry,
  type PlaybookParams,
  type SignalContext,
  type VolumeModel,
} from "./model";
import { GENERIC_TYPE_ID } from "./taxonomy";

/*
 * The opportunity catalogue and, per business type, which opportunities apply
 * and at what volume. Volumes are stated for the type's typical team (see
 * taxonomy teamSize) and are planning assumptions, not measurements; every one
 * is printed next to the numbers it produces.
 */

const r = (low: number, high: number): Range => ({ low, high });

const vol = (
  basis: VolumeModel["basis"],
  perMonth: number,
  unit: Bilingual,
  minutes: Range,
  automatable: Range,
): VolumeModel => ({ basis, perMonth, unit, minutes, automatable });

const U = {
  appointments: bi("appointments", "programări"),
  bookings: bi("bookings", "rezervări"),
  invoices: bi("invoices", "facturi"),
  documents: bi("supplier invoices and receipts", "facturi de la furnizori și bonuri"),
  questions: bi("incoming questions", "întrebări primite"),
  enquiries: bi("enquiries", "solicitări"),
  followUps: bi("post-visit follow-ups", "mesaje după vizită"),
  posts: bi("social posts", "postări"),
  reports: bi("reports", "rapoarte"),
  orders: bi("orders", "comenzi"),
  newPatients: bi("new patients", "pacienți noi"),
  recalls: bi("check-up reminders", "reamintiri pentru control"),
  results: bi("results delivered", "rezultate livrate"),
  questionsWhere: bi("“where is my order” contacts", "întrebări de tipul „unde e comanda mea?”"),
  carts: bi("abandoned checkouts with contact details", "coșuri abandonate cu date de contact"),
  productUpdates: bi("stock and price updates", "actualizări de stoc și preț"),
  supplierOrders: bi(
    "stock checks and supplier orders",
    "verificări de stoc și comenzi la furnizori",
  ),
  shifts: bi("rota and timesheet tasks", "sarcini legate de programul pe ture și pontaj"),
  stays: bi("stays", "sejururi"),
  renewals: bi("renewals and payments", "reînnoiri și plăți"),
  quotes: bi("quotes", "oferte"),
  siteReports: bi("site reports", "rapoarte de șantier"),
  updates: bi("client updates", "actualizări pentru clienți"),
  listingUpdates: bi("listing updates", "actualizări de anunțuri"),
  clientBatches: bi("client document requests", "solicitări de documente către clienți"),
  spvChecks: bi("SPV checks", "verificări în SPV"),
  overdue: bi("overdue invoices", "facturi restante"),
  newClients: bi("new clients", "clienți noi"),
  caseChecks: bi("case checks", "verificări de dosare"),
  contracts: bi("contracts and letters", "contracte și scrisori"),
  monthEnds: bi("month-end time reconstructions", "reconstituiri de pontaj la final de lună"),
  meetings: bi("client meetings", "întâlniri cu clienții"),
  clientReports: bi("client reports", "rapoarte pentru clienți"),
  tickets: bi("support tickets", "tichete de suport"),
  enrolments: bi("enrolments", "înscrieri"),
  certificates: bi("certificates", "diplome"),
  trips: bi("trips", "curse"),
  etaCalls: bi("ETA and delivery calls", "apeluri despre ora de sosire și livrare"),
  shipments: bi("shipments", "transporturi"),
  repairJobs: bi("repair jobs", "lucrări de reparație"),
  productionEntries: bi("production entries", "înregistrări de producție"),
  travelBookings: bi("trip bookings", "rezervări de călătorie"),
  donations: bi("donations and Form 230 submissions", "donații și formulare 230"),
  messages: bi("customer messages", "mesaje de la clienți"),
};

const hasBookingTool = (ctx: SignalContext) =>
  Boolean(ctx.signals?.hasOnlineBooking) ||
  ctx.technologies.some((tech) => tech.category === "booking");

const hasCrm = (ctx: SignalContext) =>
  ctx.technologies.some((tech) =>
    /hubspot|pipedrive|salesforce|zoho|bitrix|activecampaign|freshsales/i.test(tech.name),
  );

/** The catalogue. Universal opportunities come first. */
export const OPPORTUNITY_TEMPLATES: OpportunityTemplate[] = [
  /* ------------------------------------------------------------ universal */
  {
    id: "einvoice-automation",
    title: bi("e-Factura invoicing on autopilot", "Facturare automată în e-Factura"),
    problem: bi(
      "e-Factura is mandatory for every invoice, yet invoices are still typed by hand and their ANAF status is checked one by one.",
      "e-Factura este obligatorie pentru fiecare factură, dar facturile sunt încă introduse manual, iar starea lor în ANAF se verifică pe rând, factură cu factură.",
    ),
    solution: bi(
      "Invoices are generated from orders or contracts in SmartBill, Oblio or SAGA, sent to e-Factura automatically and emailed to the client; rejected ones are flagged.",
      "Facturile se emit din comenzi sau contracte în SmartBill, Oblio ori SAGA, se trimit automat în e-Factura și pe e-mail clientului, iar cele respinse sunt semnalate.",
    ),
    process: "invoicing",
    impact: "high",
    complexity: "low",
    tools: ["SmartBill / Oblio / SAGA", "ANAF e-Factura API", "Make / n8n"],
    strategy: "automate",
    volume: (p) => vol("business", p.invoices, U.invoices, r(4, 7), r(0.6, 0.8)),
    applies: (_ctx, p) => p.invoices >= 10,
  },
  {
    id: "document-ocr",
    title: bi(
      "Receipts and supplier invoices read automatically",
      "Bonuri și facturi de la furnizori citite automat",
    ),
    problem: bi(
      "Receipts and supplier invoices are photographed, sorted and retyped for the accountant every month.",
      "Bonurile și facturile de la furnizori sunt fotografiate, sortate și introduse manual, în fiecare lună, pentru contabil.",
    ),
    solution: bi(
      "Snap or forward a document: OCR reads supplier, amounts and VAT, files it by month and sends it to your accountant's software.",
      "Fotografiezi documentul sau îl trimiți pe e-mail: sistemul citește furnizorul, sumele și TVA-ul, îl arhivează pe luni și îl trimite în programul contabilului.",
    ),
    process: "bookkeeping",
    impact: "medium",
    complexity: "low",
    tools: ["Document OCR", "Google Drive", "SAGA / SmartBill import"],
    strategy: "automate",
    volume: (p) => vol("business", p.documents, U.documents, r(3, 5), r(0.6, 0.8)),
    applies: (_ctx, p) => p.documents >= 20,
  },
  {
    id: "lead-capture-crm",
    customerFacing: true,
    title: bi("Every enquiry in one shared list", "Toate cererile într-o listă comună"),
    problem: bi(
      "Enquiries arrive by phone, email, WhatsApp and forms and are tracked in notebooks or inboxes, so follow-ups get forgotten.",
      "Solicitările vin pe telefon, e-mail, WhatsApp și formulare și sunt ținute în agende sau în căsuța de e-mail, așa că revenirile la clienți se uită.",
    ),
    solution: bi(
      "Forms, emails and WhatsApp messages create contacts and deals automatically, with follow-up reminders and a clear pipeline.",
      "Formularele, e-mailurile și mesajele WhatsApp creează automat contacte și oportunități de vânzare, cu reamintiri pentru revenire și o evidență clară a fiecărei etape.",
    ),
    process: "sales",
    impact: "high",
    complexity: "medium",
    tools: ["HubSpot / Pipedrive", "WhatsApp Business", "Website forms"],
    strategy: "acquire",
    volume: (p) => vol("business", p.enquiries, U.enquiries, r(5, 10), r(0.4, 0.6)),
    applies: (ctx, p) => p.enquiries >= 15 && !hasCrm(ctx),
  },
  {
    id: "review-requests",
    customerFacing: true,
    title: bi("Review requests after each visit", "Cereri de recenzii după fiecare vizită"),
    problem: bi(
      "Happy customers rarely leave a Google review unless asked, and asking each one by hand takes time.",
      "Clienții mulțumiți lasă rar o recenzie pe Google dacă nu li se cere, iar să-i rogi pe fiecare în parte durează.",
    ),
    solution: bi(
      "An automatic message after the visit with a direct review link; unhappy replies go privately to the manager.",
      "Un mesaj automat după vizită, cu link direct pentru recenzie; răspunsurile negative ajung doar la manager, nu în public.",
    ),
    process: "reputation",
    impact: "medium",
    complexity: "low",
    tools: ["WhatsApp / SMS", "Google Business Profile"],
    strategy: "acquire",
    volume: (p) => vol("business", p.followUps, U.followUps, r(1.5, 2.5), r(0.9, 1)),
    usageCostRon: r(0.05, 0.2),
    applies: (ctx, p) => ctx.consumer && p.followUps >= 30,
    note: bi(
      "Hours are what the same follow-ups would cost by hand; the main gain is more reviews, which we don't put a price on.",
      "Orele reprezintă costul acelorași mesaje trimise manual; câștigul principal sunt recenziile în plus, pe care nu le evaluăm în bani.",
    ),
  },
  {
    id: "ai-assistant",
    customerFacing: true,
    title: bi("AI assistant for routine questions", "Asistent AI pentru întrebările de rutină"),
    problem: bi(
      "The team answers the same questions about prices, hours, availability and location many times a day, and messages sent after hours wait until morning.",
      "Echipa răspunde de multe ori pe zi la aceleași întrebări despre prețuri, program, disponibilitate și locație, iar mesajele trimise după program așteaptă până dimineața.",
    ),
    solution: bi(
      "An assistant on the website and WhatsApp, trained on your prices and FAQ, answers instantly in Romanian and English and hands over to a person when needed.",
      "Un asistent pe site și pe WhatsApp, pregătit cu prețurile și întrebările tale frecvente, răspunde imediat în română și engleză și transferă conversația unui coleg când e nevoie.",
    ),
    process: "customer-service",
    impact: "high",
    complexity: "medium",
    tools: ["AI assistant (Claude)", "Website chat", "WhatsApp Business API"],
    strategy: "assist",
    volume: (p) => vol("business", p.questions, U.questions, r(2, 4), p.routineShare),
    usageCostRon: r(0.05, 0.2),
    monthlyToolsRon: r(100, 300),
  },
  {
    id: "social-scheduling",
    title: bi(
      "Social posts planned once a month",
      "Postări pe rețelele sociale planificate o dată pe lună",
    ),
    problem: bi(
      "Posts are written and published by hand on each network, usually whenever someone finds time.",
      "Postările sunt scrise și publicate manual pe fiecare rețea, de obicei când cineva găsește timp.",
    ),
    solution: bi(
      "A monthly content calendar, AI-assisted drafts in your tone and automatic publishing to Facebook, Instagram and your Google profile.",
      "Un calendar lunar de postări, texte propuse de AI în stilul tău și publicare automată pe Facebook, Instagram și profilul Google.",
    ),
    process: "marketing",
    impact: "medium",
    complexity: "low",
    tools: ["Meta Business Suite / Buffer", "AI drafting", "Canva"],
    strategy: "acquire",
    volume: (p) => vol("fixed", p.posts, U.posts, r(25, 45), r(0.4, 0.6)),
    applies: (ctx, p) =>
      p.posts >= 4 && (ctx.consumer || (ctx.signals?.socialLinks.length ?? 0) > 0),
  },
  {
    id: "reporting-dashboard",
    title: bi(
      "Weekly numbers in one dashboard",
      "Cifrele săptămânii într-un singur panou de raportare",
    ),
    problem: bi(
      "Sales, bookings and costs are pulled from several tools into spreadsheets by hand.",
      "Vânzările, rezervările și costurile sunt copiate manual din mai multe aplicații în tabele.",
    ),
    solution: bi(
      "A live dashboard pulls data from your invoicing, booking and ad tools and emails a weekly summary.",
      "Un panou de raportare actualizat permanent preia datele din facturare, programări și reclame și trimite săptămânal un rezumat pe e-mail.",
    ),
    process: "reporting",
    impact: "medium",
    complexity: "medium",
    tools: ["Looker Studio", "Google Sheets", "API connectors"],
    strategy: "automate",
    volume: vol("fixed", 4, U.reports, r(60, 120), r(0.6, 0.85)),
  },

  /* -------------------------------------------------- bookings & services */
  {
    id: "appointment-reminders",
    customerFacing: true,
    title: bi("Automatic appointment reminders", "Reamintiri automate pentru programări"),
    problem: bi(
      "Reception calls or texts each customer the day before their appointment, and no-shows still slip through.",
      "Recepția sună sau scrie fiecărui client cu o zi înainte de programare, iar neprezentările tot apar.",
    ),
    solution: bi(
      "SMS/WhatsApp reminders 24 h and 2 h before, with one-tap confirm or reschedule that updates the calendar.",
      "Reamintiri pe SMS/WhatsApp cu 24 de ore și cu 2 ore înainte; clientul confirmă sau reprogramează dintr-un clic, iar calendarul se actualizează singur.",
    ),
    process: "appointments",
    impact: "high",
    complexity: "low",
    tools: ["WhatsApp Business API", "SMS gateway", "Calendar sync"],
    strategy: "automate",
    volume: vol("business", 500, U.appointments, r(2, 3), r(0.7, 0.9)),
    usageCostRon: r(0.15, 0.5),
    monthlyToolsRon: r(50, 150),
    note: bi(
      "Fewer no-shows are a further gain we don't put a price on.",
      "Mai puține neprezentări sunt un câștig în plus, pe care nu îl evaluăm în bani.",
    ),
  },
  {
    id: "online-booking",
    customerFacing: true,
    title: bi(
      "Online booking with real availability",
      "Programare online cu disponibilitate reală",
    ),
    problem: bi(
      "Every booking needs a phone call or message during opening hours.",
      "Fiecare programare cere un apel sau un mesaj în timpul programului.",
    ),
    solution: bi(
      "A booking calendar on the website and Google profile, synced with the team's schedules, open around the clock.",
      "Un calendar de programări pe site și în profilul Google, sincronizat cu programul echipei, disponibil non-stop.",
    ),
    process: "appointments",
    impact: "high",
    complexity: "medium",
    tools: ["Booking calendar", "Google Business Profile", "Website integration"],
    strategy: "automate",
    volume: vol("business", 500, U.appointments, r(3, 5), r(0.35, 0.55)),
    applies: (ctx) => !hasBookingTool(ctx),
    note: bi(
      "The automatable share is the part of bookings we expect to move online.",
      "Procentul automatizat este partea din programări care estimăm că se va muta online.",
    ),
  },
  {
    id: "recall-reminders",
    customerFacing: true,
    title: bi("Check-up and follow-up recalls", "Reamintiri pentru controale periodice"),
    problem: bi(
      "Customers due for a check-up or follow-up are only contacted when someone has time to go through the list.",
      "Clienții care trebuie să revină la control sunt contactați doar când cineva are timp să parcurgă lista.",
    ),
    solution: bi(
      "Each customer due for a check-up gets a personal message with a booking link at the right time.",
      "Fiecare client care trebuie să revină la control primește la momentul potrivit un mesaj personal cu link de programare.",
    ),
    process: "retention",
    impact: "medium",
    complexity: "low",
    tools: ["Patient / client database", "WhatsApp / SMS", "Booking link"],
    strategy: "automate",
    volume: vol("business", 120, U.recalls, r(3, 5), r(0.8, 0.95)),
    usageCostRon: r(0.1, 0.3),
  },
  {
    id: "patient-intake",
    title: bi("Digital patient forms", "Fișe digitale pentru pacienți"),
    problem: bi(
      "New patients fill in paper forms that staff then retype into the patient file.",
      "Pacienții noi completează formulare pe hârtie, pe care personalul le copiază apoi în fișa pacientului.",
    ),
    solution: bi(
      "Patients fill in and sign their medical history online before the visit; it lands directly in the patient file (GDPR-compliant).",
      "Pacienții completează și semnează anamneza online înainte de vizită, iar aceasta ajunge direct în fișa pacientului (conform GDPR).",
    ),
    process: "patient-intake",
    impact: "medium",
    complexity: "medium",
    tools: ["Online forms with e-signature", "GDPR-compliant storage"],
    strategy: "automate",
    volume: vol("business", 50, U.newPatients, r(10, 15), r(0.7, 0.9)),
  },
  {
    id: "results-delivery",
    title: bi(
      "Test results delivered securely online",
      "Rezultatele analizelor trimise securizat online",
    ),
    problem: bi(
      "Patients call or come back to collect lab or imaging results.",
      "Pacienții sună sau revin la clinică pentru a-și ridica rezultatele analizelor sau investigațiilor.",
    ),
    solution: bi(
      "Results are published to a secure patient link, with an SMS when they are ready.",
      "Pacientul primește un SMS când rezultatele sunt gata și le vede printr-un link securizat.",
    ),
    process: "patient-communication",
    impact: "medium",
    complexity: "medium",
    tools: ["Secure patient portal", "SMS gateway"],
    strategy: "automate",
    volume: vol("business", 400, U.results, r(3, 5), r(0.6, 0.8)),
    usageCostRon: r(0.05, 0.2),
  },
  {
    id: "membership-billing",
    customerFacing: true,
    title: bi("Memberships, renewals and payments online", "Abonamente, reînnoiri și plăți online"),
    problem: bi(
      "Memberships are tracked in spreadsheets and renewals are chased in person at the desk.",
      "Abonamentele sunt ținute în tabele, iar reînnoirile sunt urmărite personal, la recepție.",
    ),
    solution: bi(
      "Members buy and renew online by card, get a reminder before their pass expires and check in with a QR code.",
      "Membrii cumpără și reînnoiesc online cu cardul, primesc o reamintire înainte de expirare și intră cu un cod QR.",
    ),
    process: "memberships",
    impact: "high",
    complexity: "medium",
    tools: ["Membership software", "Card payments", "QR check-in"],
    strategy: "automate",
    volume: vol("business", 250, U.renewals, r(3, 5), r(0.6, 0.8)),
  },
  {
    id: "staff-scheduling",
    title: bi("Staff rota and timesheets", "Program de lucru și pontaj"),
    problem: bi(
      "Shift rotas are built in spreadsheets, swaps are agreed by phone and timesheets are retyped for payroll.",
      "Programul pe ture se face în tabele, schimbările de tură se stabilesc la telefon, iar pontajul se copiază manual pentru salarizare.",
    ),
    solution: bi(
      "A shared rota app with shift swaps, clock-in on the phone and timesheets exported to payroll.",
      "O aplicație comună pentru programul pe ture, cu schimbări de tură, pontaj din telefon și export pentru salarizare.",
    ),
    process: "staffing",
    impact: "medium",
    complexity: "low",
    tools: ["Rota & time-tracking app", "Payroll export"],
    strategy: "automate",
    volume: vol("employee", 4, U.shifts, r(8, 15), r(0.5, 0.7)),
  },

  /* ------------------------------------------------- hospitality & retail */
  {
    id: "delivery-orders",
    customerFacing: true,
    title: bi("Delivery orders in one place", "Comenzile de livrare într-un singur loc"),
    problem: bi(
      "Orders from Glovo, Wolt, the phone and the website are retyped into the POS.",
      "Comenzile din Glovo, Wolt, telefon și site sunt reintroduse manual în POS.",
    ),
    solution: bi(
      "Orders from delivery apps and your site flow into the POS and kitchen screen automatically.",
      "Comenzile din aplicațiile de livrare și de pe site ajung automat în POS și pe ecranul din bucătărie.",
    ),
    process: "orders",
    impact: "high",
    complexity: "medium",
    tools: ["Delivery aggregator integration", "POS", "Kitchen display"],
    strategy: "automate",
    volume: vol("business", 600, U.orders, r(1, 2), r(0.6, 0.85)),
  },
  {
    id: "inventory-reorder",
    title: bi("Stock alerts and supplier orders", "Alerte de stoc și comenzi la furnizori"),
    problem: bi(
      "Stock is counted by hand and supplier orders go out by phone when something runs out.",
      "Stocul se numără manual, iar comenzile la furnizori se dau la telefon când se termină ceva.",
    ),
    solution: bi(
      "Stock updates from sales; low-stock alerts and draft purchase orders go to suppliers automatically.",
      "Stocul se actualizează din vânzări; alertele de stoc scăzut și comenzile către furnizori se generează și se trimit automat.",
    ),
    process: "inventory",
    impact: "medium",
    complexity: "medium",
    tools: ["POS / ERP stock", "Supplier email or portal", "Make / n8n"],
    strategy: "automate",
    volume: vol("business", 40, U.supplierOrders, r(15, 25), r(0.4, 0.6)),
  },
  {
    id: "channel-sync",
    customerFacing: true,
    title: bi(
      "Booking.com, Airbnb and direct bookings in sync",
      "Booking.com, Airbnb și rezervările directe sincronizate",
    ),
    problem: bi(
      "Availability is updated by hand across Booking.com, Airbnb and the phone diary, risking double bookings.",
      "Disponibilitatea se actualizează manual pe Booking.com, Airbnb și în agenda de rezervări telefonice, cu risc de rezervări duble.",
    ),
    solution: bi(
      "A channel manager keeps rates and availability in sync and imports every booking into one calendar.",
      "Un channel manager (program de sincronizare) ține la zi tarifele și disponibilitatea și aduce toate rezervările într-un singur calendar.",
    ),
    process: "reservations",
    impact: "high",
    complexity: "medium",
    tools: ["Channel manager", "Booking.com / Airbnb", "PMS"],
    strategy: "automate",
    volume: vol("business", 250, U.bookings, r(2, 4), r(0.8, 0.95)),
  },
  {
    id: "guest-messaging",
    customerFacing: true,
    title: bi(
      "Pre-arrival messages and online check-in",
      "Mesaje înainte de sosire și check-in online",
    ),
    problem: bi(
      "Reception sends directions, check-in details and invoices one guest at a time.",
      "Recepția trimite indicațiile, detaliile de check-in și facturile fiecărui oaspete, pe rând.",
    ),
    solution: bi(
      "Guests get the confirmation, directions, online check-in and invoice automatically.",
      "Oaspeții primesc automat confirmarea, indicațiile, check-in-ul online și factura.",
    ),
    process: "guest-communication",
    impact: "medium",
    complexity: "medium",
    tools: ["PMS", "WhatsApp / email", "Online check-in"],
    strategy: "automate",
    volume: vol("business", 250, U.stays, r(5, 8), r(0.6, 0.8)),
  },
  {
    id: "loyalty-program",
    customerFacing: true,
    title: bi("Digital loyalty and customer list", "Fidelizare digitală și listă de clienți"),
    problem: bi(
      "Regular customers aren't recognised and promotions are announced by hand, if at all.",
      "Clienții fideli nu sunt recunoscuți, iar promoțiile sunt anunțate manual, dacă sunt anunțate.",
    ),
    solution: bi(
      "A digital loyalty card collects customers with consent and sends birthday and new-arrival messages automatically.",
      "Un card de fidelitate digital strânge datele clienților, cu acordul lor, și trimite automat mesaje de ziua lor și când apar produse noi.",
    ),
    process: "retention",
    impact: "medium",
    complexity: "low",
    tools: ["Digital loyalty card", "Email / SMS marketing"],
    strategy: "acquire",
    volume: vol("business", 150, U.messages, r(1, 2), r(0.7, 0.9)),
    usageCostRon: r(0.03, 0.15),
  },

  /* ------------------------------------------------------------ e-commerce */
  {
    id: "order-confirmations",
    customerFacing: true,
    title: bi(
      "Cash-on-delivery orders confirmed by message",
      "Comenzi ramburs confirmate prin mesaj",
    ),
    problem: bi(
      "Staff phone customers to confirm cash-on-delivery orders before shipping.",
      "Echipa sună clienții pentru a confirma comenzile cu plata ramburs înainte de expediere.",
    ),
    solution: bi(
      "Customers confirm or cancel with one tap on WhatsApp/SMS; unconfirmed orders are flagged before an AWB is created.",
      "Clienții confirmă sau anulează dintr-un clic pe WhatsApp/SMS, iar comenzile neconfirmate sunt semnalate înainte de generarea AWB-ului.",
    ),
    process: "orders",
    impact: "high",
    complexity: "low",
    tools: ["WhatsApp Business API", "SMS gateway", "Shop integration"],
    strategy: "automate",
    volume: vol("business", 400, U.orders, r(1.5, 3), r(0.6, 0.85)),
    usageCostRon: r(0.08, 0.3),
    note: bi(
      "Assumes most orders are paid on delivery, as is common in Romania.",
      "Pornim de la ideea că majoritatea comenzilor se plătesc ramburs, cum e frecvent în România.",
    ),
  },
  {
    id: "awb-automation",
    title: bi("Shipping labels (AWB) created automatically", "AWB-uri generate automat"),
    problem: bi(
      "Each order is retyped into the courier's portal (Sameday, FAN Courier, Cargus) to create the AWB.",
      "Fiecare comandă este reintrodusă în portalul curierului (Sameday, FAN Courier, Cargus) pentru AWB.",
    ),
    solution: bi(
      "AWBs are created from the order with one click or automatically, and the tracking number goes to the customer.",
      "AWB-ul se generează din comandă dintr-un clic sau automat, iar numărul de urmărire ajunge la client.",
    ),
    process: "shipping",
    impact: "high",
    complexity: "low",
    tools: ["Sameday / FAN Courier / Cargus API", "WooCommerce / Shopify"],
    strategy: "automate",
    volume: vol("business", 400, U.orders, r(2, 4), r(0.8, 0.95)),
    monthlyToolsRon: r(0, 100),
  },
  {
    id: "order-notifications",
    customerFacing: true,
    title: bi(
      "Order and delivery updates sent automatically",
      "Actualizări automate despre comenzi și livrare",
    ),
    problem: bi(
      "Customers email or call to ask where their order is.",
      "Clienții scriu sau sună să întrebe unde este comanda.",
    ),
    solution: bi(
      "Confirmation, tracking and delivery messages go out automatically by email, SMS or WhatsApp.",
      "Mesajele de confirmare, urmărire și livrare pleacă automat pe e-mail, SMS sau WhatsApp.",
    ),
    process: "customer-service",
    impact: "medium",
    complexity: "low",
    tools: ["Shop notifications", "Courier tracking API", "SMS / WhatsApp"],
    strategy: "automate",
    volume: vol("business", 150, U.questionsWhere, r(3, 5), r(0.6, 0.8)),
    usageCostRon: r(0.05, 0.2),
  },
  {
    id: "abandoned-cart",
    customerFacing: true,
    title: bi("Abandoned-cart recovery", "Recuperarea coșurilor abandonate"),
    problem: bi(
      "Shoppers who leave at checkout are followed up by hand, if at all.",
      "Cumpărătorii care renunță la finalizarea comenzii sunt contactați manual, dacă sunt contactați.",
    ),
    solution: bi(
      "A 3-step email/SMS sequence with the cart contents brings shoppers back automatically.",
      "O serie de 3 mesaje pe e-mail/SMS, cu produsele rămase în coș, îi aduce automat înapoi pe cumpărători.",
    ),
    process: "sales",
    impact: "high",
    complexity: "low",
    tools: ["Klaviyo / Omnisend / MailerLite", "Shop integration"],
    strategy: "acquire",
    volume: vol("business", 80, U.carts, r(3, 5), r(0.9, 1)),
    usageCostRon: r(0.05, 0.2),
    applies: (ctx) => ctx.typeId === "ecommerce" || Boolean(ctx.signals?.hasEcommerce),
    note: bi(
      "Recovered sales are not counted: we can't estimate them without your order data.",
      "Vânzările recuperate nu sunt incluse: nu le putem estima fără datele comenzilor tale.",
    ),
  },
  {
    id: "marketplace-sync",
    title: bi(
      "Stock and prices synced with marketplaces",
      "Stoc și prețuri sincronizate cu marketplace-urile",
    ),
    problem: bi(
      "Stock and prices are updated by hand on the shop and on eMAG Marketplace or other channels.",
      "Stocul și prețurile se actualizează manual în magazin și pe eMAG Marketplace sau alte canale.",
    ),
    solution: bi(
      "One product feed keeps stock, prices and orders in sync between your shop, eMAG and your invoicing tool.",
      "O singură listă de produse ține sincronizate stocul, prețurile și comenzile între magazin, eMAG și programul de facturare.",
    ),
    process: "catalogue",
    impact: "medium",
    complexity: "medium",
    tools: ["eMAG Marketplace API", "Product feed", "WooCommerce / Shopify"],
    strategy: "automate",
    volume: vol("business", 300, U.productUpdates, r(1, 2), r(0.8, 0.95)),
  },

  /* ----------------------------------------------------- B2B & operations */
  {
    id: "order-intake",
    title: bi(
      "Orders from email and WhatsApp entered automatically",
      "Comenzi din e-mail și WhatsApp introduse automat",
    ),
    problem: bi(
      "Customer orders arrive as emails, PDFs and WhatsApp messages and are retyped into the ERP.",
      "Comenzile clienților vin pe e-mail, în PDF-uri și pe WhatsApp și sunt introduse din nou, manual, în ERP.",
    ),
    solution: bi(
      "AI reads each order, matches products and customer and creates a draft order in your ERP for a quick check.",
      "AI-ul citește fiecare comandă, recunoaște produsele și clientul și creează în ERP o comandă ciornă, de verificat rapid.",
    ),
    process: "orders",
    impact: "high",
    complexity: "high",
    tools: [
      "AI document reading",
      "ERP integration (SAGA, WinMentor, SmartBill)",
      "Email / WhatsApp",
    ],
    strategy: "automate",
    volume: vol("business", 300, U.orders, r(5, 10), r(0.5, 0.7)),
  },
  {
    id: "quote-generator",
    title: bi("Quotes in minutes, not hours", "Oferte în câteva minute, nu în ore"),
    problem: bi(
      "Every quote is assembled by hand in Word or Excel from price lists and past jobs.",
      "Fiecare ofertă se face manual în Word sau Excel, pornind de la liste de prețuri și lucrări anterioare.",
    ),
    solution: bi(
      "A quote builder uses your price list and templates to produce a branded PDF quote, sends it and reminds you to follow up.",
      "Un generator de oferte folosește lista ta de prețuri și șabloanele tale ca să creeze o ofertă PDF cu sigla firmei, o trimite și îți amintește când să revii la client.",
    ),
    process: "sales",
    impact: "high",
    complexity: "medium",
    tools: ["Quote builder", "Price list", "E-signature"],
    strategy: "automate",
    volume: vol("business", 30, U.quotes, r(45, 90), r(0.4, 0.6)),
  },
  {
    id: "payment-reminders",
    title: bi("Automatic payment reminders", "Reamintiri automate de plată"),
    problem: bi(
      "Overdue invoices are chased by phone and email whenever someone notices.",
      "Facturile restante sunt urmărite la telefon și pe e-mail doar când observă cineva.",
    ),
    solution: bi(
      "Polite reminders go out before and after the due date, stop when the payment arrives, and overdue invoices are listed daily.",
      "Clienții primesc reamintiri politicoase înainte și după scadență, care se opresc la încasare, iar restanțele apar zilnic într-o listă.",
    ),
    process: "collections",
    impact: "medium",
    complexity: "low",
    tools: ["SmartBill / Oblio reminders", "Bank feed", "Email"],
    strategy: "automate",
    volume: vol("business", 25, U.overdue, r(8, 12), r(0.6, 0.8)),
  },
  {
    id: "client-onboarding",
    title: bi("Client onboarding without paperwork", "Clienți noi preluați fără hârtii"),
    problem: bi(
      "Contracts, ID copies and onboarding forms for new clients are collected by email and filled in by hand.",
      "Contractele, copiile actelor și formularele pentru clienții noi sunt strânse pe e-mail și completate manual.",
    ),
    solution: bi(
      "New clients fill in one online form, sign the contract electronically and land in your client list with the documents attached.",
      "Clienții noi completează un singur formular online, semnează electronic contractul și apar în lista de clienți cu documentele atașate.",
    ),
    process: "onboarding",
    impact: "medium",
    complexity: "low",
    tools: ["Online forms", "E-signature", "CRM / client list"],
    strategy: "automate",
    volume: vol("business", 6, U.newClients, r(45, 75), r(0.5, 0.7)),
  },
  {
    id: "site-reports",
    title: bi(
      "Site reports and timesheets from the phone",
      "Rapoarte de șantier și pontaj din telefon",
    ),
    problem: bi(
      "Site progress, hours and materials are reported by phone and on paper, then retyped in the office.",
      "Stadiul lucrărilor, orele și materialele de pe șantier sunt raportate la telefon și pe hârtie, apoi copiate manual la birou.",
    ),
    solution: bi(
      "Teams log hours, photos and materials in a mobile form; the office gets daily reports and payroll-ready timesheets.",
      "Echipele trec orele, pozele și materialele într-un formular pe telefon; biroul primește rapoarte zilnice și pontajul gata pentru salarizare.",
    ),
    process: "field-operations",
    impact: "high",
    complexity: "medium",
    tools: ["Mobile forms app", "Google Sheets / ERP", "Payroll export"],
    strategy: "automate",
    volume: vol("employee", 20, U.siteReports, r(4, 6), r(0.5, 0.7)),
  },
  {
    id: "client-updates",
    customerFacing: true,
    title: bi("Automatic progress updates for clients", "Clienții află automat stadiul lucrării"),
    problem: bi(
      "Clients call to ask how their project is going.",
      "Clienții sună să întrebe cum merge proiectul lor.",
    ),
    solution: bi(
      "Clients get a weekly update with photos and next steps, generated from your project board.",
      "Clienții primesc săptămânal o actualizare cu poze și pașii următori, generată din aplicația în care urmărești proiectul.",
    ),
    process: "client-communication",
    impact: "medium",
    complexity: "low",
    tools: ["Project board (Trello / Asana)", "Email / WhatsApp"],
    strategy: "automate",
    volume: vol("business", 30, U.updates, r(10, 20), r(0.5, 0.7)),
  },
  {
    id: "listing-syndication",
    title: bi(
      "Listings published everywhere from one place",
      "Anunțuri publicate peste tot dintr-un singur loc",
    ),
    problem: bi(
      "Each property is posted by hand on imobiliare.ro, Storia, OLX and your website, and every change is repeated on each portal.",
      "Fiecare proprietate este postată manual pe imobiliare.ro, Storia, OLX și pe site, iar fiecare modificare se repetă pe fiecare portal.",
    ),
    solution: bi(
      "One listing feed publishes and updates properties on every portal and your website.",
      "Anunțurile se publică și se actualizează dintr-un singur loc, pe toate portalurile și pe site.",
    ),
    process: "listings",
    impact: "high",
    complexity: "medium",
    tools: ["CRM imobiliar", "Portal feeds (imobiliare.ro, Storia, OLX)"],
    strategy: "automate",
    volume: vol("business", 60, U.listingUpdates, r(15, 25), r(0.6, 0.8)),
  },
  {
    id: "document-assembly",
    title: bi("Contracts drafted from templates", "Contracte generate din șabloane"),
    problem: bi(
      "Standard contracts and letters are copied from old files and edited by hand.",
      "Contractele și scrisorile standard sunt copiate din fișiere vechi și editate manual.",
    ),
    solution: bi(
      "Answer a short form and get the contract or letter drafted from your approved templates, ready to review.",
      "Completezi un formular scurt și primești contractul sau scrisoarea redactată din șabloanele tale aprobate, gata de verificat.",
    ),
    process: "documents",
    impact: "medium",
    complexity: "medium",
    tools: ["Document templates", "AI drafting", "E-signature"],
    strategy: "automate",
    volume: vol("business", 30, U.contracts, r(20, 40), r(0.4, 0.6)),
  },

  /* --------------------------------------------- professional services */
  {
    id: "client-documents",
    title: bi(
      "Client documents collected automatically",
      "Documentele clienților colectate automat",
    ),
    problem: bi(
      "Each month the team chases clients for invoices, receipts and bank statements by email and WhatsApp.",
      "În fiecare lună, echipa le cere clienților facturi, bonuri și extrase de cont pe e-mail și WhatsApp.",
    ),
    solution: bi(
      "Clients upload to a portal or forward by email; documents are read by OCR, matched to the right company and month, and reminders go out automatically.",
      "Clienții încarcă documentele într-un portal sau le trimit pe e-mail; acestea sunt citite automat și puse la firma și luna corecte, iar reamintirile pleacă singure.",
    ),
    process: "bookkeeping",
    impact: "high",
    complexity: "medium",
    tools: ["Client portal", "Document OCR", "SAGA / WinMentor import"],
    strategy: "automate",
    volume: vol("employee", 25, U.clientBatches, r(20, 35), r(0.4, 0.6)),
  },
  {
    id: "spv-sync",
    title: bi(
      "ANAF SPV messages and e-invoices downloaded automatically",
      "Mesajele SPV și e-facturile descărcate automat",
    ),
    problem: bi(
      "Staff log into ANAF's SPV for each client to download e-invoices and messages.",
      "Echipa intră în SPV-ul ANAF pentru fiecare client ca să descarce e-facturile și mesajele.",
    ),
    solution: bi(
      "e-Invoices and SPV messages for all clients are downloaded daily, filed and imported into your accounting software.",
      "E-facturile și mesajele SPV pentru toți clienții se descarcă zilnic, se arhivează și se importă în programul de contabilitate.",
    ),
    process: "compliance",
    impact: "high",
    complexity: "medium",
    tools: ["ANAF e-Factura API", "SAGA / WinMentor import", "Make / n8n"],
    strategy: "automate",
    volume: vol("employee", 100, U.spvChecks, r(3, 5), r(0.7, 0.9)),
  },
  {
    id: "legal-deadlines",
    title: bi(
      "Court dates and decisions tracked automatically",
      "Termene și soluții urmărite automat",
    ),
    problem: bi(
      "Lawyers check court portals by hand for hearing dates and decisions.",
      "Avocații verifică manual portalurile instanțelor pentru termene și soluții.",
    ),
    solution: bi(
      "Your cases are checked daily on portal.just.ro; new hearings and decisions go to the calendar and the responsible lawyer.",
      "Dosarele tale sunt verificate zilnic pe portal.just.ro; termenele și soluțiile noi ajung în calendar și la avocatul responsabil.",
    ),
    process: "case-management",
    impact: "high",
    complexity: "medium",
    tools: ["portal.just.ro checks", "Calendar", "Email alerts"],
    strategy: "automate",
    volume: vol("business", 120, U.caseChecks, r(3, 6), r(0.8, 0.95)),
  },
  {
    id: "time-tracking-invoicing",
    title: bi(
      "Time tracking that turns into invoices",
      "Orele lucrate transformate automat în facturi",
    ),
    problem: bi(
      "Billable hours are reconstructed at month-end from calendars and emails.",
      "Orele facturabile sunt reconstituite la final de lună din calendare și e-mailuri.",
    ),
    solution: bi(
      "Time is tracked per client and project; at month-end draft invoices are created in SmartBill and sent to e-Factura.",
      "Timpul se înregistrează pe client și proiect; la final de lună se creează facturi ciornă în SmartBill, trimise apoi în e-Factura.",
    ),
    process: "billing",
    impact: "medium",
    complexity: "low",
    tools: ["Time tracker (Toggl / Clockify)", "SmartBill", "e-Factura"],
    strategy: "automate",
    volume: vol("employee", 1, U.monthEnds, r(90, 150), r(0.5, 0.7)),
  },
  {
    id: "meeting-notes",
    title: bi(
      "Meeting notes and follow-ups written for you",
      "Notițe de ședință și e-mailuri de revenire scrise automat",
    ),
    problem: bi(
      "After each client call someone writes up notes, tasks and the follow-up email.",
      "După fiecare discuție cu un client, cineva scrie notițele, sarcinile și e-mailul de revenire.",
    ),
    solution: bi(
      "Calls are transcribed and summarised; tasks go to your project tool and a follow-up email draft is ready to send.",
      "Discuțiile sunt transcrise și rezumate; sarcinile ajung în aplicația de proiecte, iar e-mailul de revenire e gata de trimis.",
    ),
    process: "client-communication",
    impact: "medium",
    complexity: "low",
    tools: ["AI meeting notes", "Project tool", "Email"],
    strategy: "automate",
    volume: vol("employee", 8, U.meetings, r(15, 25), r(0.5, 0.7)),
  },
  {
    id: "client-reporting",
    title: bi("Client reports built automatically", "Rapoarte pentru clienți generate automat"),
    problem: bi(
      "Monthly reports are assembled by hand from Meta, Google Ads and Analytics screenshots.",
      "Rapoartele lunare se fac manual, din capturi de ecran din Meta, Google Ads și Analytics.",
    ),
    solution: bi(
      "Reports pull live data from every ad and analytics account and go out on schedule with AI-written highlights.",
      "Rapoartele preiau automat datele din toate conturile de reclame și de statistici și pleacă la timp, cu concluzii scrise de AI.",
    ),
    process: "reporting",
    impact: "high",
    complexity: "medium",
    tools: ["Looker Studio", "Meta / Google Ads APIs", "AI summaries"],
    strategy: "automate",
    volume: vol("business", 15, U.clientReports, r(90, 150), r(0.6, 0.8)),
  },
  {
    id: "support-triage",
    title: bi(
      "Support tickets sorted and answered faster",
      "Tichete de suport sortate și rezolvate mai rapid",
    ),
    problem: bi(
      "Support emails are read, categorised and assigned by hand, and common questions get the same answer every time.",
      "E-mailurile de suport sunt citite, sortate și repartizate manual, iar la întrebările frecvente se scrie de fiecare dată același răspuns.",
    ),
    solution: bi(
      "Tickets are categorised and routed automatically, with AI-drafted replies from your documentation for an agent to approve.",
      "Tichetele sunt sortate și repartizate automat, cu răspunsuri propuse de AI din documentația ta, pe care un coleg le aprobă.",
    ),
    process: "customer-service",
    impact: "high",
    complexity: "medium",
    tools: ["Helpdesk (Freshdesk / Zendesk)", "AI drafting", "Knowledge base"],
    strategy: "automate",
    volume: vol("business", 200, U.tickets, r(4, 8), r(0.3, 0.5)),
  },

  /* ----------------------------------------------- education & transport */
  {
    id: "enrolment-payments",
    customerFacing: true,
    title: bi("Enrolment and payments online", "Înscrieri și plăți online"),
    problem: bi(
      "Enrolments come by phone and email; payments and receipts are checked by hand.",
      "Înscrierile vin la telefon și pe e-mail; plățile și chitanțele sunt verificate manual.",
    ),
    solution: bi(
      "An online enrolment form with card payment, automatic receipts and a class list that updates itself.",
      "Un formular de înscriere online cu plată cu cardul, chitanțe automate și o listă de cursanți care se actualizează singură.",
    ),
    process: "enrolment",
    impact: "high",
    complexity: "medium",
    tools: ["Online forms", "Card payments", "SmartBill"],
    strategy: "automate",
    volume: vol("business", 60, U.enrolments, r(15, 25), r(0.6, 0.8)),
  },
  {
    id: "certificates",
    title: bi(
      "Attendance and certificates generated automatically",
      "Liste de prezență și diplome generate automat",
    ),
    problem: bi(
      "Attendance sheets and certificates are filled in one by one.",
      "Listele de prezență și diplomele sunt completate una câte una.",
    ),
    solution: bi(
      "Attendance is checked in on the phone and certificates are generated and emailed when a course ends.",
      "Prezența se bifează din telefon, iar diplomele se generează și se trimit pe e-mail la finalul cursului.",
    ),
    process: "administration",
    impact: "low",
    complexity: "low",
    tools: ["Attendance app", "PDF templates", "Email"],
    strategy: "automate",
    volume: vol("business", 80, U.certificates, r(5, 10), r(0.8, 0.95)),
  },
  {
    id: "transport-documents",
    title: bi(
      "CMR and delivery documents read automatically",
      "CMR-uri și documente de livrare citite automat",
    ),
    problem: bi(
      "CMRs, delivery notes and fuel receipts come back as photos and are retyped for invoicing.",
      "CMR-urile, avizele și bonurile de combustibil vin ca poze și sunt introduse manual pentru facturare.",
    ),
    solution: bi(
      "Drivers photograph documents in an app; OCR extracts the data, matches it to the trip and triggers the invoice.",
      "Șoferii fotografiază documentele într-o aplicație, care extrage datele, le asociază cursei și pornește facturarea.",
    ),
    process: "documents",
    impact: "high",
    complexity: "medium",
    tools: ["Driver app", "Document OCR", "TMS / invoicing"],
    strategy: "automate",
    volume: vol("business", 300, U.trips, r(4, 8), r(0.6, 0.8)),
  },
  {
    id: "eta-notifications",
    customerFacing: true,
    title: bi("Automatic ETA and delivery updates", "Ora de sosire și livrarea comunicate automat"),
    problem: bi(
      "Clients call dispatch for ETAs and proof of delivery.",
      "Clienții sună la dispecerat ca să afle ora de sosire și să ceară dovada livrării.",
    ),
    solution: bi(
      "Clients get pickup, ETA and proof-of-delivery messages automatically from GPS and driver updates.",
      "Clienții primesc automat mesaje la preluare, ora estimată de sosire și dovada livrării, pe baza GPS-ului și a actualizărilor de la șoferi.",
    ),
    process: "customer-service",
    impact: "medium",
    complexity: "medium",
    tools: ["GPS / fleet tracking", "Email / SMS", "TMS"],
    strategy: "automate",
    volume: vol("business", 250, U.etaCalls, r(3, 5), r(0.5, 0.7)),
    usageCostRon: r(0.05, 0.2),
  },
  {
    id: "etransport-declarations",
    title: bi("RO e-Transport declarations automated", "Declarații RO e-Transport automatizate"),
    problem: bi(
      "RO e-Transport (UIT) codes are declared by hand in SPV for each shipment of covered goods.",
      "Codurile UIT pentru RO e-Transport sunt declarate manual în SPV pentru fiecare transport de bunuri vizate.",
    ),
    solution: bi(
      "UIT codes are requested through the ANAF API from the order or invoice data and printed on the transport documents.",
      "Codurile UIT sunt obținute prin API-ul ANAF din datele comenzii sau facturii și tipărite pe documentele de transport.",
    ),
    process: "compliance",
    impact: "medium",
    complexity: "medium",
    tools: ["ANAF e-Transport API", "ERP / TMS integration"],
    strategy: "automate",
    volume: vol("business", 120, U.shipments, r(5, 8), r(0.7, 0.9)),
    note: bi(
      "Only relevant if you move goods covered by RO e-Transport.",
      "Relevant doar dacă transporți bunuri care intră sub RO e-Transport.",
    ),
  },
  {
    id: "repair-status",
    customerFacing: true,
    title: bi("Repair status updates by SMS/WhatsApp", "Stadiul reparației pe SMS/WhatsApp"),
    problem: bi(
      "Customers call to ask if their car is ready, and extra work is approved over the phone.",
      "Clienții sună să afle dacă mașina e gata, iar lucrările suplimentare se aprobă la telefon.",
    ),
    solution: bi(
      "Customers get status updates, photos and quotes for extra work to approve with one tap.",
      "Clienții primesc noutăți, poze și oferte pentru lucrări suplimentare, pe care le aprobă dintr-un clic.",
    ),
    process: "customer-service",
    impact: "medium",
    complexity: "low",
    tools: ["Workshop software", "WhatsApp / SMS"],
    strategy: "automate",
    volume: vol("business", 150, U.repairJobs, r(5, 8), r(0.5, 0.7)),
    usageCostRon: r(0.05, 0.2),
  },
  {
    id: "production-reporting",
    title: bi("Production reports from the shop floor", "Raportare de producție din hală"),
    problem: bi(
      "Output, scrap and downtime are written on paper and retyped into Excel.",
      "Producția, rebuturile și opririle sunt notate pe hârtie și copiate apoi în Excel.",
    ),
    solution: bi(
      "Operators log output and stops on a tablet; managers get live dashboards and daily reports.",
      "Operatorii înregistrează producția și opririle pe o tabletă; managerii văd cifrele pe un panou de raportare actualizat permanent și primesc rapoarte zilnice.",
    ),
    process: "production",
    impact: "high",
    complexity: "high",
    tools: ["Shop-floor tablets", "Production dashboard", "ERP integration"],
    strategy: "automate",
    volume: vol("employee", 20, U.productionEntries, r(3, 5), r(0.5, 0.7)),
  },
  {
    id: "travel-documents",
    title: bi("Booking documents and trip reminders", "Documente de călătorie și reamintiri"),
    problem: bi(
      "Vouchers, contracts and pre-departure details are assembled and emailed one client at a time.",
      "Voucherele, contractele și informațiile dinaintea plecării sunt pregătite și trimise fiecărui client, pe rând.",
    ),
    solution: bi(
      "Contracts, vouchers and pre-departure reminders are generated from the booking and sent automatically.",
      "Contractele, voucherele și reamintirile dinaintea plecării sunt generate din rezervare și trimise automat.",
    ),
    process: "documents",
    impact: "medium",
    complexity: "medium",
    tools: ["Booking system", "PDF templates", "Email / WhatsApp"],
    strategy: "automate",
    volume: vol("business", 60, U.travelBookings, r(15, 25), r(0.5, 0.7)),
  },
  {
    id: "donor-crm",
    title: bi("Donors and Form 230 on autopilot", "Donatori și Formularul 230 gestionate automat"),
    problem: bi(
      "Donor lists live in spreadsheets; Form 230 tax redirections and thank-you messages are handled by hand.",
      "Listele de donatori sunt ținute în tabele, iar formularele 230 și mesajele de mulțumire sunt gestionate manual.",
    ),
    solution: bi(
      "Online Form 230 with e-signature, a donor CRM, automatic thank-you and receipt emails and a yearly campaign sequence.",
      "Formular 230 online cu semnătură electronică, o evidență a donatorilor (CRM), mulțumiri și confirmări automate și o campanie anuală programată.",
    ),
    process: "fundraising",
    impact: "high",
    complexity: "medium",
    tools: ["Donor CRM", "Online Form 230", "Email automation"],
    strategy: "automate",
    volume: vol("business", 80, U.donations, r(5, 10), r(0.6, 0.8)),
  },
];

const TEMPLATE_BY_ID = new Map(OPPORTUNITY_TEMPLATES.map((template) => [template.id, template]));

export function getTemplate(id: string): OpportunityTemplate | undefined {
  return TEMPLATE_BY_ID.get(id);
}

/** Universal opportunities offered to every type when they apply. */
export const UNIVERSAL_IDS = [
  "einvoice-automation",
  "document-ocr",
  "lead-capture-crm",
  "review-requests",
  "ai-assistant",
  "social-scheduling",
  "reporting-dashboard",
] as const;

const params = (p: PlaybookParams) => p;
const e = (
  id: string,
  volume?: Partial<VolumeModel>,
  text?: PlaybookEntry["text"],
): PlaybookEntry => ({
  id,
  volume,
  text,
});

const WIN_CLIENTS = bi("Win more clients", "Atrage mai mulți clienți");
const AI_CLIENT = bi("AI client assistant", "Asistent AI pentru clienți");

/** Per business type: volumes for its typical team and its own opportunities. */
export const PLAYBOOKS: Record<string, Playbook> = {
  "dental-clinic": {
    typeId: "dental-clinic",
    params: params({
      invoices: 40,
      documents: 50,
      questions: 300,
      routineShare: r(0.4, 0.6),
      enquiries: 80,
      followUps: 250,
      posts: 8,
    }),
    entries: [
      e("appointment-reminders", { perMonth: 500 }),
      e("online-booking", { perMonth: 500 }),
      e("patient-intake", { perMonth: 50 }),
      e(
        "recall-reminders",
        { perMonth: 120, unit: U.recalls },
        {
          title: bi("Six-month check-up recalls", "Reamintiri pentru controlul la șase luni"),
          problem: bi(
            "Patients due for a check-up or a treatment follow-up are only called when someone has time to go through the list.",
            "Pacienții care au nevoie de control sau de continuarea tratamentului sunt sunați doar când cineva are timp să parcurgă lista.",
          ),
          solution: bi(
            "Each patient due for a check-up gets a personal message with a booking link at the right time.",
            "Fiecare pacient care trebuie să revină la control primește la momentul potrivit un mesaj personal cu link de programare.",
          ),
        },
      ),
      e("ai-assistant", undefined, {
        title: bi("AI patient assistant", "Asistent AI pentru pacienți"),
      }),
    ],
    titles: {
      acquire: bi("Win more patients", "Atrage mai mulți pacienți"),
      automate: bi("Automate the front desk", "Automatizează recepția"),
      assist: bi("AI patient assistant", "Asistent AI pentru pacienți"),
    },
  },
  "medical-clinic": {
    typeId: "medical-clinic",
    params: params({
      invoices: 60,
      documents: 80,
      questions: 500,
      routineShare: r(0.4, 0.6),
      enquiries: 120,
      followUps: 400,
      posts: 8,
    }),
    entries: [
      e("appointment-reminders", { perMonth: 900 }),
      e("online-booking", { perMonth: 900, automatable: r(0.3, 0.5) }),
      e("patient-intake", { perMonth: 150, automatable: r(0.6, 0.85) }),
      e("results-delivery", { perMonth: 400 }),
      e("recall-reminders", { perMonth: 150 }),
      e("ai-assistant", undefined, {
        title: bi("AI patient assistant", "Asistent AI pentru pacienți"),
      }),
    ],
    titles: {
      acquire: bi("Win more patients", "Atrage mai mulți pacienți"),
      automate: bi("Automate the front desk", "Automatizează recepția"),
      assist: bi("AI patient assistant", "Asistent AI pentru pacienți"),
    },
  },
  "beauty-salon": {
    typeId: "beauty-salon",
    params: params({
      invoices: 0,
      documents: 30,
      questions: 250,
      routineShare: r(0.45, 0.65),
      enquiries: 60,
      followUps: 200,
      posts: 16,
    }),
    entries: [
      e("online-booking", { perMonth: 350, automatable: r(0.4, 0.6) }),
      e("appointment-reminders", { perMonth: 350, minutes: r(1.5, 2.5) }),
      e(
        "recall-reminders",
        {
          perMonth: 100,
          minutes: r(2, 4),
          unit: bi("rebooking reminders", "reamintiri pentru o nouă programare"),
        },
        {
          title: bi("Rebooking reminders", "Reamintiri pentru o nouă programare"),
          problem: bi(
            "Clients who usually come back every few weeks are only reminded if someone remembers.",
            "Clienții care revin de obicei la câteva săptămâni primesc o reamintire doar dacă își amintește cineva.",
          ),
          solution: bi(
            "Each client gets a personal reminder with a booking link when their usual interval is up.",
            "Fiecare client primește o reamintire personală cu link de programare când se împlinește intervalul obișnuit.",
          ),
        },
      ),
      e("ai-assistant", undefined, {
        title: bi(
          "AI booking assistant for Instagram and WhatsApp",
          "Asistent AI de programări pe Instagram și WhatsApp",
        ),
      }),
    ],
    titles: {
      acquire: WIN_CLIENTS,
      automate: bi("Automate bookings", "Automatizează programările"),
      assist: bi("AI booking assistant", "Asistent AI pentru programări"),
    },
  },
  fitness: {
    typeId: "fitness",
    params: params({
      invoices: 10,
      documents: 30,
      questions: 250,
      routineShare: r(0.45, 0.65),
      enquiries: 60,
      followUps: 100,
      posts: 16,
    }),
    entries: [
      e(
        "online-booking",
        {
          perMonth: 600,
          minutes: r(2, 3),
          automatable: r(0.5, 0.7),
          unit: bi("class and session bookings", "rezervări la clase și antrenamente"),
        },
        {
          title: bi(
            "Class and session booking online",
            "Rezervări online la clase și antrenamente",
          ),
        },
      ),
      e("membership-billing", { perMonth: 250 }),
      e(
        "lead-capture-crm",
        { perMonth: 60, automatable: r(0.5, 0.7) },
        {
          title: bi(
            "Trial sign-ups followed up automatically",
            "Înscrierile la ședința de probă urmărite automat",
          ),
        },
      ),
      e("appointment-reminders", {
        perMonth: 200,
        minutes: r(1.5, 2.5),
        unit: bi("personal-training sessions", "ședințe de antrenament personal"),
      }),
      e("staff-scheduling"),
    ],
    titles: {
      acquire: bi("Win more members", "Atrage mai mulți membri"),
      automate: bi("Automate memberships", "Automatizează abonamentele"),
      assist: bi("AI member assistant", "Asistent AI pentru membri"),
    },
  },
  restaurant: {
    typeId: "restaurant",
    params: params({
      invoices: 20,
      documents: 120,
      questions: 300,
      routineShare: r(0.5, 0.7),
      enquiries: 40,
      followUps: 200,
      posts: 16,
    }),
    entries: [
      e(
        "online-booking",
        {
          perMonth: 400,
          minutes: r(2, 4),
          automatable: r(0.3, 0.5),
          unit: bi("table reservations", "rezervări la masă"),
        },
        {
          title: bi("Online table reservations", "Rezervări online la masă"),
          problem: bi(
            "Reservations are taken by phone during service, when the team is busiest.",
            "Rezervările se iau la telefon în plin serviciu, când echipa e cea mai ocupată.",
          ),
          solution: bi(
            "Guests book a table on the website, Google and Instagram, with automatic confirmation and reminders.",
            "Clienții rezervă o masă pe site, pe Google și pe Instagram, cu confirmare și reamintire automată.",
          ),
        },
      ),
      e("delivery-orders"),
      e("inventory-reorder"),
      e("staff-scheduling"),
      e("ai-assistant", undefined, {
        title: bi(
          "AI reservations assistant on WhatsApp",
          "Asistent AI pentru rezervări pe WhatsApp",
        ),
      }),
    ],
    titles: {
      acquire: bi("Fill more tables", "Atrage mai multe rezervări"),
      automate: bi("Automate the back office", "Automatizează partea administrativă"),
      assist: bi("AI reservations assistant", "Asistent AI pentru rezervări"),
    },
  },
  hotel: {
    typeId: "hotel",
    params: params({
      invoices: 60,
      documents: 80,
      questions: 300,
      routineShare: r(0.45, 0.65),
      enquiries: 120,
      followUps: 250,
      posts: 12,
    }),
    entries: [
      e("channel-sync"),
      e("guest-messaging"),
      e(
        "online-booking",
        {
          perMonth: 250,
          minutes: r(5, 10),
          automatable: r(0.2, 0.4),
          unit: bi("direct bookings", "rezervări directe"),
        },
        {
          title: bi("Direct booking engine on your website", "Sistem de rezervări directe pe site"),
          problem: bi(
            "Direct bookings come by phone and email and are confirmed by hand, while the platforms take a commission.",
            "Rezervările directe vin la telefon și pe e-mail și sunt confirmate manual, în timp ce platformele iau comision.",
          ),
          solution: bi(
            "Guests book and pay on your own website at the best rate, synced with your calendar.",
            "Oaspeții rezervă și plătesc direct pe site-ul tău, la cel mai bun tarif, iar rezervarea apare automat în calendar.",
          ),
        },
      ),
      e("staff-scheduling"),
      e("ai-assistant", undefined, {
        title: bi("AI guest concierge", "Asistent AI pentru oaspeți"),
      }),
    ],
    titles: {
      acquire: bi("Get more direct bookings", "Atrage mai multe rezervări directe"),
      automate: bi("Automate reception", "Automatizează recepția"),
      assist: bi("AI guest concierge", "Asistent AI pentru oaspeți"),
    },
  },
  retail: {
    typeId: "retail",
    params: params({
      invoices: 10,
      documents: 60,
      questions: 150,
      routineShare: r(0.4, 0.6),
      enquiries: 30,
      followUps: 100,
      posts: 12,
    }),
    entries: [
      e("inventory-reorder", { perMonth: 30 }),
      e("loyalty-program"),
      e("staff-scheduling"),
      e("document-ocr"),
      e("ai-assistant", undefined, {
        title: bi("AI shop assistant", "Asistent AI pentru magazin"),
      }),
    ],
    titles: {
      acquire: bi("Bring in more shoppers", "Atrage mai mulți cumpărători"),
      automate: bi("Automate stock and admin", "Automatizează stocul și partea administrativă"),
      assist: bi("AI shop assistant", "Asistent AI pentru magazin"),
    },
  },
  ecommerce: {
    typeId: "ecommerce",
    params: params({
      invoices: 400,
      documents: 40,
      questions: 400,
      routineShare: r(0.5, 0.7),
      enquiries: 0,
      followUps: 300,
      posts: 12,
    }),
    entries: [
      e("order-confirmations"),
      e("awb-automation"),
      e("order-notifications"),
      e("abandoned-cart"),
      e("marketplace-sync"),
      e(
        "einvoice-automation",
        { perMonth: 400, minutes: r(1.5, 3), automatable: r(0.7, 0.9) },
        {
          title: bi(
            "An e-Factura invoice for every order, automatically",
            "Factură automată în e-Factura pentru fiecare comandă",
          ),
        },
      ),
      e("ai-assistant", undefined, {
        title: bi("AI shopping assistant", "Asistent AI de cumpărături"),
      }),
    ],
    titles: {
      acquire: bi("Sell more online", "Vinde mai mult online"),
      automate: bi("Automate order handling", "Automatizează procesarea comenzilor"),
      assist: bi("AI shopping assistant", "Asistent AI de cumpărături"),
    },
  },
  wholesale: {
    typeId: "wholesale",
    params: params({
      invoices: 400,
      documents: 150,
      questions: 200,
      routineShare: r(0.3, 0.5),
      enquiries: 60,
      followUps: 0,
      posts: 4,
    }),
    entries: [
      e("order-intake"),
      e("payment-reminders", { perMonth: 40 }),
      e("inventory-reorder"),
      e("awb-automation", { perMonth: 200 }),
      e("quote-generator", { perMonth: 40, minutes: r(30, 60) }),
      e("etransport-declarations"),
    ],
    titles: {
      acquire: bi("Win more resellers", "Atrage mai mulți revânzători"),
      automate: bi("Automate order-to-invoice", "Automatizează fluxul comandă–factură"),
      assist: bi("AI order assistant", "Asistent AI pentru comenzi"),
    },
  },
  construction: {
    typeId: "construction",
    params: params({
      invoices: 30,
      documents: 150,
      questions: 100,
      routineShare: r(0.25, 0.4),
      enquiries: 50,
      followUps: 15,
      posts: 6,
    }),
    entries: [
      e("quote-generator", { perMonth: 30, minutes: r(60, 120) }),
      e("site-reports"),
      e("client-updates"),
      e("document-ocr"),
      e("payment-reminders", { perMonth: 20 }),
    ],
    titles: {
      acquire: bi("Win more projects", "Câștigă mai multe proiecte"),
      automate: bi(
        "Automate quotes and site admin",
        "Automatizează ofertele și administrarea șantierelor",
      ),
      assist: bi("AI quote-request assistant", "Asistent AI pentru cereri de ofertă"),
    },
  },
  "real-estate": {
    typeId: "real-estate",
    params: params({
      invoices: 10,
      documents: 20,
      questions: 400,
      routineShare: r(0.4, 0.6),
      enquiries: 150,
      followUps: 40,
      posts: 20,
    }),
    entries: [
      e("listing-syndication"),
      e(
        "lead-capture-crm",
        { perMonth: 150, automatable: r(0.5, 0.7) },
        {
          title: bi(
            "Every lead routed and followed up",
            "Fiecare client potențial repartizat și urmărit",
          ),
        },
      ),
      e(
        "online-booking",
        {
          perMonth: 80,
          minutes: r(5, 10),
          automatable: r(0.4, 0.6),
          unit: bi("viewings", "vizionări"),
        },
        {
          title: bi("Viewings scheduled online", "Vizionări programate online"),
          problem: bi(
            "Viewings are arranged through back-and-forth calls between buyer, owner and agent.",
            "Vizionările se stabilesc prin apeluri repetate între cumpărător, proprietar și agent.",
          ),
          solution: bi(
            "Buyers pick a viewing slot from the agent's calendar, with automatic confirmations and reminders.",
            "Cumpărătorii aleg un interval din calendarul agentului, cu confirmări și reamintiri automate.",
          ),
        },
      ),
      e("document-assembly", { perMonth: 20 }),
      e("ai-assistant", undefined, {
        title: bi("AI property assistant", "Asistent AI pentru proprietăți"),
      }),
    ],
    titles: {
      acquire: bi("Win more listings and buyers", "Atrage mai multe proprietăți și cumpărători"),
      automate: bi("Automate listings and leads", "Automatizează anunțurile și solicitările"),
      assist: bi("AI property assistant", "Asistent AI pentru proprietăți"),
    },
  },
  accounting: {
    typeId: "accounting",
    params: params({
      invoices: 80,
      documents: 30,
      questions: 200,
      routineShare: r(0.25, 0.4),
      enquiries: 20,
      followUps: 0,
      posts: 4,
    }),
    entries: [
      e("client-documents"),
      e("spv-sync"),
      e("payment-reminders", { perMonth: 20 }),
      e("client-onboarding", { perMonth: 4 }),
      e(
        "reporting-dashboard",
        {
          basis: "business",
          perMonth: 60,
          minutes: r(10, 20),
          automatable: r(0.6, 0.8),
          unit: U.clientReports,
        },
        {
          title: bi(
            "Monthly client reports generated automatically",
            "Rapoarte lunare pentru clienți generate automat",
          ),
        },
      ),
    ],
    titles: {
      acquire: WIN_CLIENTS,
      automate: bi("Automate document collection", "Automatizează colectarea documentelor"),
      assist: AI_CLIENT,
    },
  },
  legal: {
    typeId: "legal",
    params: params({
      invoices: 30,
      documents: 20,
      questions: 100,
      routineShare: r(0.2, 0.35),
      enquiries: 30,
      followUps: 0,
      posts: 4,
    }),
    entries: [
      e("legal-deadlines"),
      e("document-assembly"),
      e("client-onboarding"),
      e("time-tracking-invoicing"),
      e("meeting-notes"),
    ],
    titles: {
      acquire: WIN_CLIENTS,
      automate: bi("Automate case admin", "Automatizează administrarea dosarelor"),
      assist: bi("AI intake assistant", "Asistent AI pentru solicitări noi"),
    },
  },
  consulting: {
    typeId: "consulting",
    params: params({
      invoices: 15,
      documents: 20,
      questions: 60,
      routineShare: r(0.25, 0.4),
      enquiries: 15,
      followUps: 0,
      posts: 6,
    }),
    entries: [
      e(
        "quote-generator",
        { perMonth: 8, minutes: r(90, 180), unit: bi("proposals", "propuneri") },
        {
          title: bi("Proposals in minutes", "Propuneri în câteva minute"),
        },
      ),
      e("meeting-notes", { perMonth: 10 }),
      e("time-tracking-invoicing"),
      e("client-onboarding", { perMonth: 3 }),
      e("payment-reminders", { perMonth: 8 }),
    ],
    titles: {
      acquire: WIN_CLIENTS,
      automate: bi(
        "Automate proposals and admin",
        "Automatizează ofertele și partea administrativă",
      ),
      assist: AI_CLIENT,
    },
  },
  "marketing-agency": {
    typeId: "marketing-agency",
    params: params({
      invoices: 30,
      documents: 40,
      questions: 80,
      routineShare: r(0.25, 0.4),
      enquiries: 25,
      followUps: 0,
      posts: 12,
    }),
    entries: [
      e("client-reporting"),
      e(
        "quote-generator",
        { perMonth: 10, minutes: r(60, 120), unit: bi("proposals", "propuneri") },
        {
          title: bi("Proposals in minutes", "Propuneri în câteva minute"),
        },
      ),
      e("time-tracking-invoicing"),
      e("meeting-notes"),
      e("client-onboarding", { perMonth: 3 }),
      e("payment-reminders", { perMonth: 15 }),
    ],
    titles: {
      acquire: WIN_CLIENTS,
      automate: bi("Automate reporting and delivery", "Automatizează raportarea și livrarea"),
      assist: AI_CLIENT,
    },
  },
  "it-software": {
    typeId: "it-software",
    params: params({
      invoices: 25,
      documents: 40,
      questions: 150,
      routineShare: r(0.25, 0.45),
      enquiries: 20,
      followUps: 0,
      posts: 6,
    }),
    entries: [
      e("support-triage"),
      e("time-tracking-invoicing"),
      e("meeting-notes"),
      e("client-onboarding", { perMonth: 3 }),
      e(
        "quote-generator",
        { perMonth: 8, minutes: r(90, 180), unit: bi("proposals", "propuneri") },
        {
          title: bi("Proposals in minutes", "Propuneri în câteva minute"),
        },
      ),
      e("payment-reminders", { perMonth: 10 }),
    ],
    titles: {
      acquire: WIN_CLIENTS,
      automate: bi("Automate delivery admin", "Automatizează administrarea proiectelor"),
      assist: bi("AI support assistant", "Asistent AI pentru suport"),
    },
  },
  education: {
    typeId: "education",
    params: params({
      invoices: 60,
      documents: 30,
      questions: 300,
      routineShare: r(0.45, 0.65),
      enquiries: 80,
      followUps: 60,
      posts: 12,
    }),
    entries: [
      e("enrolment-payments"),
      e(
        "appointment-reminders",
        {
          perMonth: 400,
          minutes: r(1, 2),
          unit: bi("class reminders", "reamintiri pentru cursuri"),
        },
        {
          title: bi("Class reminders sent automatically", "Reamintiri automate pentru cursuri"),
          problem: bi(
            "Students are reminded about classes and changes by phone or group messages.",
            "Cursanții sunt anunțați despre cursuri și modificări la telefon sau pe grupuri de WhatsApp.",
          ),
          solution: bi(
            "Each student gets a reminder before class and an instant notice when the schedule changes.",
            "Fiecare cursant primește o reamintire înainte de curs și o notificare imediată când se schimbă programul.",
          ),
        },
      ),
      e("certificates"),
      e(
        "lead-capture-crm",
        { perMonth: 80 },
        {
          title: bi("Enquiries followed up automatically", "Fiecare solicitare urmărită automat"),
        },
      ),
      e("payment-reminders", { perMonth: 30 }),
      e("ai-assistant", undefined, {
        title: bi("AI enrolment assistant", "Asistent AI pentru înscrieri"),
      }),
    ],
    titles: {
      acquire: bi("Enrol more students", "Înscrie mai mulți cursanți"),
      automate: bi(
        "Automate enrolment and admin",
        "Automatizează înscrierile și partea administrativă",
      ),
      assist: bi("AI enrolment assistant", "Asistent AI pentru înscrieri"),
    },
  },
  "transport-logistics": {
    typeId: "transport-logistics",
    params: params({
      invoices: 250,
      documents: 100,
      questions: 150,
      routineShare: r(0.3, 0.5),
      enquiries: 40,
      followUps: 0,
      posts: 2,
    }),
    entries: [
      e("transport-documents"),
      e("eta-notifications"),
      e("order-intake", { perMonth: 200, unit: bi("transport orders", "comenzi de transport") }),
      e("etransport-declarations"),
      e("payment-reminders", { perMonth: 40 }),
    ],
    titles: {
      acquire: bi("Win more freight", "Câștigă mai multe curse"),
      automate: bi("Automate dispatch paperwork", "Automatizează documentele de transport"),
      assist: bi("AI dispatch assistant", "Asistent AI pentru dispecerat"),
    },
  },
  "auto-service": {
    typeId: "auto-service",
    params: params({
      invoices: 100,
      documents: 120,
      questions: 250,
      routineShare: r(0.4, 0.6),
      enquiries: 80,
      followUps: 150,
      posts: 6,
    }),
    entries: [
      e("online-booking", { perMonth: 200 }),
      e("appointment-reminders", { perMonth: 200 }),
      e(
        "recall-reminders",
        {
          perMonth: 150,
          unit: bi("ITP, RCA and service reminders", "reamintiri ITP, RCA și revizie"),
        },
        {
          title: bi(
            "ITP, insurance and service reminders",
            "Reamintiri pentru ITP, RCA și revizie",
          ),
          problem: bi(
            "Customers forget their ITP, RCA and service dates and often go elsewhere.",
            "Clienții uită termenele de ITP, RCA și revizie și ajung adesea în altă parte.",
          ),
          solution: bi(
            "Each customer gets a reminder before their ITP, RCA or service is due, with a booking link.",
            "Fiecare client primește o reamintire înainte de ITP, RCA sau revizie, cu link de programare.",
          ),
        },
      ),
      e("repair-status"),
      e("inventory-reorder", { perMonth: 30, unit: bi("parts orders", "comenzi de piese") }),
    ],
    titles: {
      acquire: bi("Win more drivers", "Atrage mai mulți clienți"),
      automate: bi("Automate the workshop front desk", "Automatizează recepția service-ului"),
      assist: bi("AI booking assistant", "Asistent AI pentru programări"),
    },
  },
  manufacturing: {
    typeId: "manufacturing",
    params: params({
      invoices: 150,
      documents: 200,
      questions: 100,
      routineShare: r(0.25, 0.4),
      enquiries: 30,
      followUps: 0,
      posts: 4,
    }),
    entries: [
      e("order-intake", { perMonth: 200 }),
      e("production-reporting"),
      e("inventory-reorder", { perMonth: 60 }),
      e("quote-generator", { perMonth: 30, minutes: r(60, 120) }),
      e("payment-reminders", { perMonth: 30 }),
    ],
    titles: {
      acquire: bi("Win more orders", "Câștigă mai multe comenzi"),
      automate: bi("Automate order-to-production", "Automatizează fluxul comandă–producție"),
      assist: bi("AI sales assistant", "Asistent AI pentru vânzări"),
    },
  },
  "travel-agency": {
    typeId: "travel-agency",
    params: params({
      invoices: 60,
      documents: 40,
      questions: 400,
      routineShare: r(0.4, 0.6),
      enquiries: 120,
      followUps: 60,
      posts: 16,
    }),
    entries: [
      e(
        "quote-generator",
        { perMonth: 80, minutes: r(20, 40), unit: bi("trip offers", "oferte de vacanță") },
        {
          title: bi("Trip offers in minutes", "Oferte de vacanță în câteva minute"),
        },
      ),
      e("travel-documents"),
      e("lead-capture-crm", { perMonth: 120, automatable: r(0.5, 0.7) }),
      e("payment-reminders", {
        perMonth: 30,
        minutes: r(5, 10),
        unit: bi("instalment reminders", "reamintiri de rate"),
      }),
      e("ai-assistant", undefined, {
        title: bi("AI travel assistant", "Asistent AI de călătorie"),
      }),
    ],
    titles: {
      acquire: bi("Book more trips", "Vinde mai multe vacanțe"),
      automate: bi("Automate booking admin", "Automatizează administrarea rezervărilor"),
      assist: bi("AI travel assistant", "Asistent AI de călătorie"),
    },
  },
  events: {
    typeId: "events",
    params: params({
      invoices: 15,
      documents: 40,
      questions: 150,
      routineShare: r(0.35, 0.55),
      enquiries: 50,
      followUps: 20,
      posts: 12,
    }),
    entries: [
      e("quote-generator", { perMonth: 30, minutes: r(45, 90) }),
      e(
        "client-onboarding",
        { perMonth: 10, unit: bi("contracts", "contracte") },
        {
          title: bi("Contracts and e-signature", "Contracte și semnătură electronică"),
        },
      ),
      e("payment-reminders", {
        perMonth: 15,
        unit: bi("deposit reminders", "reamintiri de avans"),
      }),
      e("lead-capture-crm", { perMonth: 50 }),
      e("ai-assistant", undefined, {
        title: bi("AI events assistant", "Asistent AI pentru evenimente"),
      }),
    ],
    titles: {
      acquire: bi("Book more events", "Organizează mai multe evenimente"),
      automate: bi("Automate quotes and contracts", "Automatizează ofertele și contractele"),
      assist: bi("AI events assistant", "Asistent AI pentru evenimente"),
    },
  },
  ngo: {
    typeId: "ngo",
    params: params({
      invoices: 0,
      documents: 30,
      questions: 100,
      routineShare: r(0.4, 0.6),
      enquiries: 20,
      followUps: 0,
      posts: 10,
    }),
    entries: [
      e("donor-crm"),
      e("reporting-dashboard", {
        basis: "business",
        perMonth: 6,
        unit: bi("grant and donor reports", "rapoarte pentru finanțatori"),
      }),
      e("document-ocr"),
      e("social-scheduling"),
      e(
        "lead-capture-crm",
        { perMonth: 20 },
        {
          title: bi(
            "Supporter enquiries in one place",
            "Solicitările susținătorilor într-un singur loc",
          ),
        },
      ),
    ],
    titles: {
      acquire: bi("Reach more supporters", "Atrage mai mulți susținători"),
      automate: bi("Automate donor admin", "Automatizează administrarea donatorilor"),
      assist: bi("AI supporter assistant", "Asistent AI pentru susținători"),
    },
  },
  [GENERIC_TYPE_ID]: {
    typeId: GENERIC_TYPE_ID,
    params: params({
      invoices: 40,
      documents: 50,
      questions: 150,
      routineShare: r(0.35, 0.55),
      enquiries: 30,
      followUps: 40,
      posts: 8,
    }),
    entries: [
      e("lead-capture-crm"),
      e("einvoice-automation"),
      e("document-ocr"),
      e("payment-reminders", { perMonth: 15 }),
      e("reporting-dashboard"),
    ],
    titles: {
      acquire: bi("Win more customers", "Atrage mai mulți clienți"),
      automate: bi("Automate operations", "Automatizează operațiunile"),
      assist: bi("AI customer assistant", "Asistent AI pentru clienți"),
    },
  },
};

export function getPlaybook(typeId: string): Playbook {
  return PLAYBOOKS[typeId] ?? PLAYBOOKS[GENERIC_TYPE_ID];
}

export type ResolvedOpportunity = {
  template: OpportunityTemplate;
  /** Volume for the type's typical team at volume factor 1. */
  volume: VolumeModel;
  title: Bilingual;
  problem: Bilingual;
  solution: Bilingual;
  /** True when the type's playbook lists it (not just a universal fallback). */
  fromPlaybook: boolean;
};

/** An opportunity as it applies to a business type (type overrides merged). */
export function resolveOpportunity(typeId: string, id: string): ResolvedOpportunity | null {
  const template = getTemplate(id);
  if (!template) return null;
  const playbook = getPlaybook(typeId);
  const entry = playbook.entries.find((item) => item.id === id);
  const base =
    typeof template.volume === "function" ? template.volume(playbook.params) : template.volume;
  return {
    template,
    volume: { ...base, ...entry?.volume },
    title: entry?.text?.title ?? template.title,
    problem: entry?.text?.problem ?? template.problem,
    solution: entry?.text?.solution ?? template.solution,
    fromPlaybook: Boolean(entry),
  };
}

/** Every opportunity id a type could be offered: its playbook, then the universal ones. */
export function candidateIds(typeId: string): string[] {
  const playbook = getPlaybook(typeId);
  const ids = playbook.entries.map((entry) => entry.id);
  for (const id of UNIVERSAL_IDS) if (!ids.includes(id)) ids.push(id);
  return ids;
}

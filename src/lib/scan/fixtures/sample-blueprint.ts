import type { Blueprint } from "../types";

/**
 * A realistic blueprint for designing and testing the scan report and the PDF
 * without running a scan (a fictional dental clinic in Timișoara). Also served
 * at /scan?demo=1.
 */
export const SAMPLE_BLUEPRINT: Blueprint = {
  id: "demo-dental-timisoara",
  generatedAt: "2026-10-03T09:30:00.000Z",
  engine: "rules",
  target: { cui: "12345678" },
  company: {
    cui: "12345678",
    name: "DENTAL SMILE CLINIC S.R.L.",
    displayName: "Dental Smile Clinic SRL",
    regNo: "J35/1234/2015",
    legalForm: "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ",
    address: "JUD. TIMIŞ, MUN. TIMIŞOARA, BD. REVOLUŢIEI 1989, NR. 10",
    county: "Timiș",
    city: "Timișoara",
    phone: "+40 256 000 000",
    caen: "8623",
    caenLabel: { en: "Dental practice activities", ro: "Activități de asistență stomatologică" },
    registeredAt: "2015-03-12",
    vatPayer: false,
    eInvoice: true,
    inactive: false,
    website: "https://dentalsmile-example.ro",
    sources: ["anaf", "index"],
  },
  audit: {
    url: "https://dentalsmile-example.ro",
    finalUrl: "https://dentalsmile-example.ro/",
    host: "dentalsmile-example.ro",
    fetchedAt: "2026-10-03T09:29:40.000Z",
    reachable: true,
    https: true,
    statusCode: 200,
    responseMs: 1840,
    pages: [
      {
        url: "https://dentalsmile-example.ro/",
        status: 200,
        title: "Dental Smile Clinic – Stomatologie Timișoara",
      },
      { url: "https://dentalsmile-example.ro/servicii", status: 200, title: "Servicii" },
      { url: "https://dentalsmile-example.ro/contact", status: 200, title: "Contact" },
    ],
    meta: {
      title: "Dental Smile Clinic – Stomatologie Timișoara",
      lang: "ro",
      // No favicon: the sample business's domain doesn't exist, so a real request would fail.
      favicon: undefined,
    },
    technologies: [
      { name: "WordPress", category: "cms", confidence: 0.95 },
      { name: "Elementor", category: "builder", confidence: 0.9 },
      { name: "Google Analytics 4", category: "analytics", confidence: 0.9 },
    ],
    signals: {
      hasContactForm: true,
      hasPhone: true,
      hasEmail: true,
      hasWhatsApp: false,
      hasLiveChat: false,
      hasOnlineBooking: false,
      hasEcommerce: false,
      hasCookieConsent: false,
      hasAnalytics: true,
      hasMarketingPixel: false,
      hasStructuredData: false,
      hasNewsletter: false,
      hasBlog: false,
      languages: ["ro"],
      socialLinks: ["https://facebook.com/dentalsmile-example"],
      cuiOnSite: "12345678",
    },
    scores: {
      performance: 46,
      seo: 62,
      accessibility: 71,
      security: 58,
      conversion: 44,
      overall: 56,
    },
    pagespeed: {
      strategy: "mobile",
      performance: 46,
      accessibility: 71,
      bestPractices: 78,
      seo: 83,
      lcpMs: 4600,
      cls: 0.12,
      tbtMs: 690,
    },
    findings: [
      {
        id: "conversion.no-online-booking",
        category: "conversion",
        severity: "high",
        title: { en: "No online booking", ro: "Fără programare online" },
        detail: {
          en: "Patients can only book by phone or the contact form, so bookings stop when the reception is busy or closed.",
          ro: "Pacienții se pot programa doar telefonic sau prin formular, deci programările se opresc când recepția e ocupată sau închisă.",
        },
        recommendation: {
          en: "Add a booking calendar with real availability and automatic confirmations.",
          ro: "Adaugă un calendar de programări cu disponibilitate reală și confirmări automate.",
        },
        effort: "medium",
      },
      {
        id: "performance.slow-lcp",
        category: "performance",
        severity: "high",
        title: { en: "Slow first screen on mobile", ro: "Primul ecran se încarcă greu pe mobil" },
        detail: {
          en: "The largest element appears after 4.6 s on a mid-range phone (good is under 2.5 s).",
          ro: "Elementul principal apare după 4,6 s pe un telefon mediu (ideal sub 2,5 s).",
        },
        recommendation: {
          en: "Compress and resize the hero image, serve WebP/AVIF and defer non-critical scripts.",
          ro: "Comprimă și redimensionează imaginea principală, folosește WebP/AVIF și amână scripturile neesențiale.",
        },
        evidence: "LCP 4.6 s (Lighthouse, mobile)",
        effort: "quick",
      },
      {
        id: "security.no-cookie-consent",
        category: "security",
        severity: "high",
        title: { en: "Analytics without cookie consent", ro: "Analytics fără consimțământ cookie" },
        detail: {
          en: "Google Analytics loads before the visitor agrees, which conflicts with GDPR and ePrivacy rules.",
          ro: "Google Analytics se încarcă înainte de acordul vizitatorului, ceea ce contravine GDPR și regulilor ePrivacy.",
        },
        recommendation: {
          en: "Add a consent banner and load analytics only after consent (Consent Mode v2).",
          ro: "Adaugă un banner de consimțământ și încarcă analytics doar după acord (Consent Mode v2).",
        },
        effort: "quick",
      },
      {
        id: "seo.no-structured-data",
        category: "seo",
        severity: "medium",
        title: { en: "No business details for Google", ro: "Fără date structurate pentru Google" },
        detail: {
          en: "The site has no Dentist/LocalBusiness markup, so Google can't show hours, address and ratings richly.",
          ro: "Site-ul nu are marcaj Dentist/LocalBusiness, așa că Google nu poate afișa bogat programul, adresa și recenziile.",
        },
        recommendation: {
          en: "Add schema.org Dentist markup with address, hours, phone and services.",
          ro: "Adaugă marcaj schema.org Dentist cu adresă, program, telefon și servicii.",
        },
        effort: "quick",
      },
      {
        id: "conversion.no-whatsapp",
        category: "conversion",
        severity: "low",
        title: { en: "No WhatsApp contact", ro: "Fără contact pe WhatsApp" },
        detail: {
          en: "Most patients prefer messaging to calling; there is no click-to-chat option.",
          ro: "Mulți pacienți preferă mesajele în locul apelurilor; nu există opțiune de chat rapid.",
        },
        recommendation: {
          en: "Add a WhatsApp Business button with quick replies for prices and availability.",
          ro: "Adaugă un buton WhatsApp Business cu răspunsuri rapide pentru prețuri și disponibilitate.",
        },
        effort: "quick",
      },
    ],
  },
  businessType: {
    id: "dental-clinic",
    label: { en: "Dental clinic", ro: "Clinică stomatologică" },
    sector: { en: "Healthcare", ro: "Sănătate" },
    confidence: 0.92,
    basis: ["CAEN 8623 (dental practice)", "Words on the site: implant, ortodonție, programare"],
  },
  scores: { digitalMaturity: 48, websiteHealth: 56, automationPotential: 82 },
  headline: {
    en: "Dental Smile Clinic could win back about 70 hours a month",
    ro: "Dental Smile Clinic poate recupera aproximativ 70 de ore pe lună",
  },
  summary: {
    en: "Bookings, reminders and patient paperwork are still handled by hand. Automating them frees the front desk, cuts no-shows and lets the website book patients around the clock.",
    ro: "Programările, reamintirile și documentele pacienților sunt gestionate încă manual. Automatizarea lor eliberează recepția, reduce neprezentările și permite site-ului să programeze pacienți non-stop.",
  },
  opportunities: [
    {
      id: "appointment-reminders",
      title: { en: "Automatic appointment reminders", ro: "Reamintiri automate pentru programări" },
      problem: {
        en: "Reception calls patients the day before each appointment.",
        ro: "Recepția sună pacienții cu o zi înainte de fiecare programare.",
      },
      solution: {
        en: "SMS/WhatsApp reminders 24 h and 2 h before, with one-tap confirm or reschedule.",
        ro: "Reamintiri SMS/WhatsApp cu 24 h și 2 h înainte, cu confirmare sau reprogramare dintr-o atingere.",
      },
      process: "appointments",
      impact: "high",
      complexity: "low",
      hoursSavedPerMonth: { low: 18, high: 26 },
      monthlySavingsRon: { low: 1000, high: 1450 },
      setupCostRon: { low: 1500, high: 3000 },
      monthlyToolCostRon: { low: 120, high: 300 },
      paybackMonths: { low: 1.3, high: 3.4 },
      tools: ["WhatsApp Business API", "SMS gateway", "Calendar sync"],
      assumptions: [
        {
          en: "About 25 appointments a day, 2 minutes per reminder call",
          ro: "Aproximativ 25 de programări pe zi, 2 minute pe apel",
        },
        { en: "Loaded staff cost 56 RON/hour", ro: "Cost salarial complet 56 RON/oră" },
      ],
    },
    {
      id: "online-booking",
      title: {
        en: "Online booking with real availability",
        ro: "Programare online cu disponibilitate reală",
      },
      problem: {
        en: "Every booking needs a phone call during opening hours.",
        ro: "Fiecare programare necesită un apel în timpul programului.",
      },
      solution: {
        en: "A booking calendar on the site and Google profile, synced with the dentists' schedules.",
        ro: "Un calendar de programări pe site și în profilul Google, sincronizat cu programul medicilor.",
      },
      process: "appointments",
      impact: "high",
      complexity: "medium",
      hoursSavedPerMonth: { low: 20, high: 30 },
      monthlySavingsRon: { low: 1120, high: 1680 },
      setupCostRon: { low: 2500, high: 5000 },
      monthlyToolCostRon: { low: 100, high: 250 },
      paybackMonths: { low: 1.6, high: 4.6 },
      tools: ["Booking calendar", "Google Business Profile", "Website integration"],
      assumptions: [
        {
          en: "About half of bookings move online",
          ro: "Aproximativ jumătate dintre programări se mută online",
        },
        { en: "4 minutes saved per booking", ro: "4 minute economisite pe programare" },
      ],
    },
    {
      id: "patient-intake",
      title: { en: "Digital patient forms", ro: "Fișe digitale pentru pacienți" },
      problem: {
        en: "New patients fill paper forms that staff retype.",
        ro: "Pacienții noi completează formulare pe hârtie pe care personalul le retranscrie.",
      },
      solution: {
        en: "Patients fill and sign the medical history online before the visit; it lands in the patient file.",
        ro: "Pacienții completează și semnează anamneza online înainte de vizită; aceasta ajunge direct în dosar.",
      },
      process: "patient-intake",
      impact: "medium",
      complexity: "medium",
      hoursSavedPerMonth: { low: 10, high: 16 },
      monthlySavingsRon: { low: 560, high: 900 },
      setupCostRon: { low: 2000, high: 4000 },
      monthlyToolCostRon: { low: 0, high: 150 },
      paybackMonths: { low: 2.2, high: 7.1 },
      tools: ["Online forms with e-signature", "GDPR-compliant storage"],
      assumptions: [
        {
          en: "About 60 new patients a month, 12 minutes of retyping each",
          ro: "Aproximativ 60 de pacienți noi pe lună, 12 minute de retranscriere fiecare",
        },
      ],
    },
    {
      id: "review-requests",
      title: {
        en: "Review requests after each visit",
        ro: "Cereri de recenzii după fiecare vizită",
      },
      problem: {
        en: "Happy patients rarely leave a Google review unless asked.",
        ro: "Pacienții mulțumiți lasă rar o recenzie Google dacă nu sunt rugați.",
      },
      solution: {
        en: "An automatic message after the visit with a direct review link; unhappy replies go to the manager.",
        ro: "Un mesaj automat după vizită cu link direct de recenzie; răspunsurile nemulțumite ajung la manager.",
      },
      process: "reputation",
      impact: "medium",
      complexity: "low",
      hoursSavedPerMonth: { low: 4, high: 6 },
      monthlySavingsRon: { low: 220, high: 340 },
      setupCostRon: { low: 800, high: 1500 },
      monthlyToolCostRon: { low: 0, high: 100 },
      paybackMonths: { low: 2.4, high: 6.8 },
      tools: ["WhatsApp / SMS", "Google Business Profile"],
      assumptions: [
        { en: "Replaces manual follow-up calls", ro: "Înlocuiește apelurile manuale de follow-up" },
      ],
    },
  ],
  websiteActions: [],
  totals: {
    hoursSavedPerMonth: { low: 52, high: 78 },
    monthlySavingsRon: { low: 2900, high: 4370 },
    annualSavingsRon: { low: 34800, high: 52440 },
    setupCostRon: { low: 6800, high: 13500 },
    paybackMonths: { low: 1.6, high: 4.7 },
  },
  presence: {
    profiles: [
      {
        platform: "website",
        status: "active",
        url: "https://dentalsmile-example.ro",
        metric: { label: { en: "Pages analysed", ro: "Pagini analizate" }, value: "3" },
      },
      { platform: "google-business", status: "detected", url: "https://maps.google.com/?cid=0" },
      { platform: "facebook", status: "active", url: "https://facebook.com/dentalsmile-example" },
      { platform: "instagram", status: "missing" },
      { platform: "linkedin", status: "missing" },
      { platform: "youtube", status: "missing" },
    ],
  },
  competitors: [
    {
      cui: "23456789",
      name: "Clinica Dentară Alfa SRL",
      city: "Timișoara",
      website: "https://alfa-dent-example.ro",
      websiteScore: 71,
    },
    {
      cui: "34567890",
      name: "Zâmbet Perfect SRL",
      city: "Timișoara",
      website: "https://zambet-example.ro",
      websiteScore: 64,
    },
    { cui: "45678901", name: "Ortodent Vest SRL", city: "Timișoara" },
  ],
  strategies: [
    {
      id: "acquire",
      title: { en: "Win more patients", ro: "Atrage mai mulți pacienți" },
      summary: {
        en: "Get found by more local patients and turn more visits into bookings.",
        ro: "Fii găsit de mai mulți pacienți din zonă și transformă mai multe vizite în programări.",
      },
      tactics: [
        { en: "Local SEO and Google profile", ro: "SEO local și profil Google" },
        { en: "Faster mobile landing pages", ro: "Pagini de destinație rapide pe mobil" },
        { en: "Review generation", ro: "Generare de recenzii" },
        { en: "Conversion tracking", ro: "Măsurarea conversiilor" },
      ],
      outcome: {
        label: { en: "more enquiries", ro: "mai multe solicitări" },
        range: { low: 20, high: 40 },
        unit: "%",
        basis: {
          en: "Typical uplift after fixing speed, local SEO and reviews",
          ro: "Creștere tipică după corectarea vitezei, SEO local și recenzii",
        },
      },
      implementation: "medium",
      timeToValueMonths: { low: 2, high: 4 },
      investmentLevel: 2,
      investmentRon: { low: 4000, high: 9000 },
      opportunityIds: ["review-requests"],
      recommended: false,
    },
    {
      id: "automate",
      title: { en: "Automate operations", ro: "Automatizează operațiunile" },
      summary: {
        en: "Take bookings, reminders and paperwork off the front desk.",
        ro: "Preia de pe recepție programările, reamintirile și documentele.",
      },
      tactics: [
        {
          en: "Online booking with real availability",
          ro: "Programare online cu disponibilitate reală",
        },
        { en: "Automatic reminders (SMS/WhatsApp)", ro: "Reamintiri automate (SMS/WhatsApp)" },
        { en: "Digital patient forms", ro: "Fișe digitale pentru pacienți" },
        { en: "Integration with your calendar", ro: "Integrare cu calendarul tău" },
      ],
      outcome: {
        label: { en: "hours saved a month", ro: "ore economisite pe lună" },
        range: { low: 48, high: 72 },
        unit: "hours",
        basis: {
          en: "Sum of the booking, reminder and intake automations",
          ro: "Suma automatizărilor de programare, reamintire și înregistrare",
        },
      },
      implementation: "medium",
      timeToValueMonths: { low: 1, high: 2 },
      investmentLevel: 2,
      investmentRon: { low: 6000, high: 12000 },
      opportunityIds: ["appointment-reminders", "online-booking", "patient-intake"],
      recommended: true,
    },
    {
      id: "assist",
      title: { en: "AI patient assistant", ro: "Asistent AI pentru pacienți" },
      summary: {
        en: "Answer questions and book patients 24/7 on the site and WhatsApp.",
        ro: "Răspunde la întrebări și programează pacienți non-stop pe site și pe WhatsApp.",
      },
      tactics: [
        { en: "24/7 website chat assistant", ro: "Asistent de chat non-stop pe site" },
        { en: "Answers to common questions", ro: "Răspunsuri la întrebările frecvente" },
        { en: "Booking from the chat", ro: "Programare direct din chat" },
        { en: "Romanian and English", ro: "Română și engleză" },
      ],
      outcome: {
        label: {
          en: "of questions answered automatically",
          ro: "din întrebări primesc răspuns automat",
        },
        range: { low: 40, high: 60 },
        unit: "%",
        basis: {
          en: "Share of routine questions (prices, hours, availability)",
          ro: "Ponderea întrebărilor de rutină (prețuri, program, disponibilitate)",
        },
      },
      implementation: "medium",
      timeToValueMonths: { low: 1, high: 3 },
      investmentLevel: 2,
      investmentRon: { low: 5000, high: 10000 },
      opportunityIds: [],
      recommended: false,
    },
  ],
  roadmap: [
    {
      startMonth: 1,
      endMonth: 1,
      stage: { en: "Foundation", ro: "Fundație" },
      title: { en: "Set up the core systems", ro: "Configurează sistemele de bază" },
      items: [
        {
          en: "Cookie consent and analytics fix",
          ro: "Consimțământ cookie și corectarea analytics",
        },
        {
          en: "Calendar and booking integration",
          ro: "Integrarea calendarului și a programărilor",
        },
        { en: "WhatsApp contact button", ro: "Buton de contact WhatsApp" },
      ],
      tag: "essential",
      opportunityIds: [],
    },
    {
      startMonth: 2,
      endMonth: 3,
      stage: { en: "Automation", ro: "Automatizare" },
      title: { en: "Automate daily operations", ro: "Automatizează operațiunile zilnice" },
      items: [
        {
          en: "Online booking with real availability",
          ro: "Programare online cu disponibilitate reală",
        },
        { en: "Appointment reminders", ro: "Reamintiri pentru programări" },
        { en: "Digital patient forms", ro: "Fișe digitale pentru pacienți" },
      ],
      tag: "high-impact",
      opportunityIds: ["online-booking", "appointment-reminders", "patient-intake"],
    },
    {
      startMonth: 4,
      endMonth: 6,
      stage: { en: "Growth", ro: "Creștere" },
      title: { en: "Grow and optimise", ro: "Crește și optimizează" },
      items: [
        { en: "Automatic review requests", ro: "Cereri automate de recenzii" },
        { en: "Faster mobile pages", ro: "Pagini mai rapide pe mobil" },
        { en: "Local SEO", ro: "SEO local" },
      ],
      tag: "growth",
      opportunityIds: ["review-requests"],
    },
  ],
  projection: Array.from({ length: 24 }, (_, i) => {
    const month = i + 1;
    const ramp = Math.min(1, month / 3);
    return {
      month,
      cumulativeSavingsRon: {
        low: Math.round(2900 * ramp * month * 0.85),
        high: Math.round(4370 * ramp * month * 0.9),
      },
      cumulativeCostRon: { low: 6800 + 220 * month, high: 13500 + 800 * month },
    };
  }),
  offer: {
    planId: "growth",
    title: {
      en: "Vortex Growth + automation setup",
      ro: "Vortex Growth + implementarea automatizărilor",
    },
    why: {
      en: "You have several high-impact automations; Growth covers the guided setup and ongoing support.",
      ro: "Ai mai multe automatizări cu impact mare; Growth acoperă implementarea ghidată și suportul continuu.",
    },
    includes: [
      { en: "2 hours of live consultation", ro: "2 ore de consultanță live" },
      {
        en: "Guided setup of your digital workflow",
        ro: "Configurare ghidată a fluxului tău digital",
      },
      { en: "Priority support", ro: "Suport prioritar" },
    ],
    priceNote: {
      en: "From 50 EUR / month + one-off setup",
      ro: "De la 250 lei / lună + cost unic de implementare",
    },
  },
  assumptions: {
    hourlyCostRon: 56,
    hourlyCostBasis: {
      en: "Average gross earnings in healthcare (INS, 2026) plus 2.25% employer contribution, over 168 working hours",
      ro: "Câștigul salarial mediu brut în sănătate (INS, 2026) plus 2,25% contribuția angajatorului, la 168 de ore lucrate",
    },
    teamSize: { low: 6, high: 12 },
    simulation: { teamSize: 8, hourlyCostRon: 56, volumeFactor: 1 },
    notes: [
      {
        en: "Volumes are typical for a clinic of this size, not measured.",
        ro: "Volumele sunt tipice pentru o clinică de această mărime, nu măsurate.",
      },
    ],
  },
  disclaimer: {
    en: "Estimates based on public data and typical volumes for this kind of business. Final figures come from a short discovery call.",
    ro: "Estimări bazate pe date publice și volume tipice pentru acest tip de afacere. Cifrele finale rezultă dintr-o discuție scurtă de evaluare.",
  },
};

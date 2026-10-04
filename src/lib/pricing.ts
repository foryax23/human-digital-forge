import type { PlanId } from "@/lib/plans";

/*
 * The public price list (owner decision, 2026-10-04): the three plans sold by contract and
 * the fixed-price projects. One source for the pricing section (PricingSection.tsx), the
 * contact form's plan line, the deep research gate and the scan offer (web and PDF), so a
 * price is changed here once.
 *
 * Copy rules: never "nelimitat" or "garantat", "pe lună" with every hour figure, nothing
 * listed before it exists. No VAT line until the accountant confirms the wording
 * (analysis §4.7: "Prețuri finale. Vortex Hub S.R.L. nu este plătitoare de TVA.").
 *
 * The hours and the deep research reports are what the app grants once an admin assigns the
 * plan (src/lib/client-plans.ts); scripts/scan/check-display.ts checks the two agree. Plans
 * have no card checkout: src/lib/plans.ts keeps only the plan IDs and labels, and
 * createCheckoutSession refuses plan purchases and points to /contact?plan=<id>.
 */

export type PriceText = { en: string; ro: string };

const t = (en: string, ro: string): PriceText => ({ en, ro });

export type PlanCatalogEntry = {
  id: PlanId;
  /** The plan ID's name, the same in both languages. */
  name: string;
  /** What the plan does, in a word ("Îngrijire"). */
  role: PriceText;
  /** Lei a month, final. */
  priceLei: number;
  /** Hours of work included each month. */
  hoursPerMonth: number;
  /** Minimum term in months; null = month to month. */
  minimumMonths: number | null;
  /** Deep research reports included (enforced by the deep research access check). */
  deepReports: { count: number; per: "month" | "quarter" };
  /** One plain line on who the plan is for. */
  descriptor: PriceText;
  /** The pricing section's list, after the hours line. */
  features: PriceText[];
  /** Three lines for the scan offer, said about the plan's own scope. */
  offerIncludes: PriceText[];
};

/** Hours beyond the plan, any plan. */
export const EXTRA_HOUR_LEI = 200;

/** Consultancy without a plan. */
export const CONSULTANCY_HOUR_LEI = 300;

const HOSTING_ONE = t(
  "Hosting, SSL, updates and backups for 1 website",
  "Găzduire, SSL, actualizări și backup pentru 1 site",
);

export const PLAN_CATALOG: Record<PlanId, PlanCatalogEntry> = {
  starter: {
    id: "starter",
    name: "Starter",
    role: t("Care", "Îngrijire"),
    priceLei: 290,
    hoursPerMonth: 1,
    minimumMonths: null,
    deepReports: { count: 1, per: "quarter" },
    descriptor: t(
      "For a website we built or took over, kept healthy.",
      "Pentru un site făcut sau preluat de noi, ținut în formă.",
    ),
    features: [
      HOSTING_ONE,
      t(
        "A health report every quarter, made with Vortex Scan",
        "Raport de sănătate la fiecare trimestru, făcut cu Vortex Scan",
      ),
      t("Reply within 2 working days", "Răspuns în 2 zile lucrătoare"),
    ],
    offerIncludes: [
      HOSTING_ONE,
      t(
        "A health report every quarter, made with Vortex Scan",
        "Raport de sănătate la fiecare trimestru, făcut cu Vortex Scan",
      ),
      t("Reply within 2 working days", "Răspuns în 2 zile lucrătoare"),
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    role: t("Improvement", "Creștere"),
    priceLei: 790,
    hoursPerMonth: 4,
    minimumMonths: 3,
    deepReports: { count: 2, per: "month" },
    descriptor: t(
      "For a firm with a few automations that wants steady improvements.",
      "Pentru o firmă cu câteva automatizări, care vrea îmbunătățiri constante.",
    ),
    features: [
      HOSTING_ONE,
      t("A one-page health report every month", "Raport de sănătate lunar, pe o pagină"),
      t(
        "We look after up to 3 automations; fixes count against the hours",
        "Îngrijim până la 3 automatizări; remedierile intră în ore",
      ),
      t(
        "A one-hour call every month, from the included hours",
        "O discuție de o oră pe lună, din orele incluse",
      ),
      t("Reply within 1 working day", "Răspuns într-o zi lucrătoare"),
    ],
    offerIncludes: [
      t(
        "We look after up to 3 automations; fixes count against the hours",
        "Îngrijim până la 3 automatizări; remedierile intră în ore",
      ),
      t(
        "A one-page health report and a one-hour call every month",
        "Raport de sănătate lunar și o discuție de o oră pe lună, din orele incluse",
      ),
      t("Reply within 1 working day", "Răspuns într-o zi lucrătoare"),
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    role: t("Partnership", "Parteneriat"),
    priceLei: 1990,
    hoursPerMonth: 10,
    minimumMonths: 3,
    deepReports: { count: 5, per: "month" },
    descriptor: t(
      "For a firm whose website, automations and AI assistant are part of daily work.",
      "Pentru o firmă în care site-ul, automatizările și asistentul AI fac parte din munca zilnică.",
    ),
    features: [
      t(
        "Hosting, SSL, updates and backups for up to 2 websites",
        "Găzduire, SSL, actualizări și backup pentru cel mult 2 site-uri",
      ),
      t(
        "A monthly health report and a quarterly review against the first scan",
        "Raport de sănătate lunar și o comparație trimestrială cu prima scanare",
      ),
      t(
        "We look after up to 8 automations and 1 AI assistant (up to 1,000 conversations a month)",
        "Îngrijim până la 8 automatizări și un asistent AI (cel mult 1.000 de conversații pe lună)",
      ),
      t(
        "A 2-hour strategy session every month, from the included hours",
        "O sesiune de strategie de 2 ore pe lună, din orele incluse",
      ),
      t(
        "Critical issues (site down, payments broken): reply within 4 working hours",
        "Probleme critice (site căzut, plăți blocate): răspuns în 4 ore lucrătoare",
      ),
    ],
    offerIncludes: [
      t(
        "We look after up to 8 automations and 1 AI assistant (up to 1,000 conversations a month)",
        "Îngrijim până la 8 automatizări și un asistent AI (cel mult 1.000 de conversații pe lună)",
      ),
      t(
        "A monthly health report and a 2-hour strategy session every month",
        "Raport de sănătate lunar și o sesiune de strategie de 2 ore pe lună",
      ),
      t(
        "Critical issues: reply within 4 working hours",
        "Probleme critice: răspuns în 4 ore lucrătoare",
      ),
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "growth", "pro"];

export type FixedProject = {
  id: "site" | "automation" | "assistant" | "consultancy";
  name: PriceText;
  /** Lei: `low` alone is a "de la" price, `perHour` a rate. */
  priceLei: { low: number; high?: number; perHour?: boolean };
  /** What it is, in one line (analysis §4.3). */
  detail: PriceText;
};

/** Fixed-price projects (owner decision, from analysis §4.3). */
export const FIXED_PROJECTS: FixedProject[] = [
  {
    id: "site",
    name: t("Presentation website", "Site de prezentare"),
    priceLei: { low: 4500 },
    detail: t(
      "Up to 6 pages, contact form, basic SEO, GDPR pages and 30 days of fixes",
      "Până la 6 pagini, formular de contact, SEO de bază, paginile GDPR și 30 de zile de remedieri",
    ),
  },
  {
    id: "automation",
    name: t("An automation", "O automatizare"),
    priceLei: { low: 1500, high: 3500 },
    detail: t(
      "An invoice from each order, booking reminders or lead routing; you pay the tool fees",
      "Factura din fiecare comandă, reamintiri pentru programări sau preluarea cererilor; taxele instrumentelor le plătești tu",
    ),
  },
  {
    id: "assistant",
    name: t("AI assistant", "Asistent AI"),
    priceLei: { low: 3000, high: 6000 },
    detail: t(
      "On your website or WhatsApp, with a visible notice telling your customers they are talking to an AI assistant",
      "Pe site sau pe WhatsApp, cu un mesaj vizibil care le spune clienților că vorbesc cu un asistent AI",
    ),
  },
  {
    id: "consultancy",
    name: t("Consultancy", "Consultanță"),
    priceLei: { low: CONSULTANCY_HOUR_LEI, perHour: true },
    detail: t("Without a plan, billed by the hour", "Fără abonament, plătită la oră"),
  },
];

export function fixedProject(id: FixedProject["id"]): FixedProject {
  return FIXED_PROJECTS.find((p) => p.id === id) ?? FIXED_PROJECTS[0];
}

/** "1.990" in Romanian, "1,990" in English: grouped by hand so server and browser agree. */
export function groupedNumber(value: number, lang: "en" | "ro"): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, lang === "ro" ? "." : ",");
}

/** "1.990 lei" / "1,990 RON". */
export function leiText(value: number): PriceText {
  return t(`${groupedNumber(value, "en")} RON`, `${groupedNumber(value, "ro")} lei`);
}

/** "790 lei pe lună" / "790 RON a month". */
export function monthlyText(value: number): PriceText {
  const amount = leiText(value);
  return t(`${amount.en} a month`, `${amount.ro} pe lună`);
}

/** "1 oră" / "4 ore" / "20 de ore". */
export function hoursText(hours: number): PriceText {
  if (hours === 1) return t("1 hour", "1 oră");
  const de = hours % 100 === 0 || hours % 100 >= 20 ? "de " : "";
  return t(`${hours} hours`, `${hours} ${de}ore`);
}

/** "4 ore de lucru pe lună incluse" / "4 hours of work a month included". */
export function includedHoursText(hours: number): PriceText {
  const h = hoursText(hours);
  return t(
    `${h.en} of work a month included`,
    `${h.ro} de lucru pe lună ${hours === 1 ? "inclusă" : "incluse"}`,
  );
}

/** "2 rapoarte pe lună" / "1 raport pe trimestru" / "2 reports a month". */
export function reportsText(plan: PlanId): PriceText {
  const { count, per } = PLAN_CATALOG[plan].deepReports;
  return t(
    `${count} report${count === 1 ? "" : "s"} ${per === "month" ? "a month" : "a quarter"}`,
    `${count === 1 ? "1 raport" : `${count} rapoarte`} ${per === "month" ? "pe lună" : "pe trimestru"}`,
  );
}

/** "Cercetare aprofundată: 2 rapoarte pe lună" / "Deep research: 2 reports a month". */
export function deepReportsText(plan: PlanId): PriceText {
  const reports = reportsText(plan);
  return t(`Deep research: ${reports.en}`, `Cercetare aprofundată: ${reports.ro}`);
}

/** "Minimum 3 luni, apoi lunar" / "Fără perioadă minimă". */
export function termText(plan: PlanId): PriceText {
  const months = PLAN_CATALOG[plan].minimumMonths;
  return months
    ? t(`At least ${months} months, then monthly`, `Minimum ${months} luni, apoi lunar`)
    : t("No minimum term, month to month", "Fără perioadă minimă, lunar");
}

/** "de la 4.500 lei" / "1.500–3.500 lei" / "300 lei pe oră". */
export function projectPriceText(project: FixedProject): PriceText {
  const { low, high, perHour } = project.priceLei;
  if (perHour) {
    const amount = leiText(low);
    return t(`${amount.en} an hour`, `${amount.ro} pe oră`);
  }
  if (high) {
    return t(
      `${groupedNumber(low, "en")}–${groupedNumber(high, "en")} RON`,
      `${groupedNumber(low, "ro")}–${groupedNumber(high, "ro")} lei`,
    );
  }
  const amount = leiText(low);
  return t(`from ${amount.en}`, `de la ${amount.ro}`);
}

/** The plan in the contact form and in a contract request ("Growth, 790 lei pe lună"). */
export function planLine(plan: PlanId): PriceText {
  const entry = PLAN_CATALOG[plan];
  const fee = monthlyText(entry.priceLei);
  const hours = includedHoursText(entry.hoursPerMonth);
  return t(`${entry.name}, ${fee.en}, ${hours.en}`, `${entry.name}, ${fee.ro}, ${hours.ro}`);
}

/*
 * ACTION PRICES (owner decision 2026-10-04: the public price list wins).
 *
 * "Cu Vortex Hub: de la X lei, plus Y lei pe lună" and "Poți face singur:
 * gratuit, N ore" on every action read this table, so the screen, the PDF and
 * the summary text always show the same price. Each Vortex Hub "de la" is the
 * low end of the quick scan's price for the same work (PRICE_BOOK in
 * src/lib/scan/blueprint/economics.ts, itself read from the public list in
 * src/lib/pricing.ts). Deep research imports nothing from the app (plan A5), so
 * the figures are repeated here and checked: scripts/scan/check-display.ts and
 * tests/deep/report/review-fixes.test.ts fail when they drift from the scan.
 * Prices in lei, final (no VAT line until the accountant confirms the wording).
 */

import type { Bilingual } from "../contracts";

/** The scan's floors (the PRICE_BOOK lows) for the work deep research prices. */
export const SCAN_FROM = {
  /** A quick website fix: 1 hour at 300 lei. */
  quickFix: 300,
  /** A medium website fix (the speed findings): 5 hours at 300 lei. */
  mediumFix: 1500,
  /** Visitor statistics after cookie consent: 3 hours at 300 lei. */
  measurement: 900,
  /** A simple automation: the public "1.500–3.500 lei" floor. */
  simpleAutomation: 1500,
  /** A medium automation (online booking): the upper half of the public range. */
  mediumAutomation: 2500,
  /** A new presentation website: "de la 4.500 lei". */
  newWebsite: 4500,
} as const;

const bi = (en: string, ro: string): Bilingual => ({ en, ro });

export type ActionPrice = {
  /**
   * Doing it yourself: out-of-pocket lei (0 = free) and hours of your time, or `how` in words
   * when the cost is not a single number ("reînnoiești domeniul…, cam 60–100 lei pe an").
   */
  diy?: { lei: number; hours: number; how?: Bilingual };
  /** With Vortex Hub: one-off setup and monthly cost, from. */
  vortex?: { setupLei: number; monthlyLei: number };
};

/** Actions that Vortex Hub does with the same system: priced once when both are shown. */
export const SAME_SYSTEM: string[][] = [
  ["clients.online_booking", "clients.quote_request", "clients.reminders"],
];

export const ACTION_PRICES: Record<string, ActionPrice> = {
  /** Put the CUI and company details on the site (Legea 365/2002). */
  "legal.company_details": { diy: { lei: 0, hours: 0.25 } },
  /** Renew the certificate or move off a parked or dead domain. */
  "site.fix_domain": {
    diy: {
      lei: 0,
      hours: 0.5,
      how: bi(
        "renew the domain with the company you bought it from (about 60–100 lei a year, 30 minutes) or ask your host to renew the certificate",
        "reînnoiești domeniul la firma de la care l-ai cumpărat (cam 60–100 lei pe an, 30 de minute) sau ceri firmei de găzduire să reînnoiască certificatul",
      ),
    },
    vortex: { setupLei: SCAN_FROM.quickFix, monthlyLei: 0 },
  },
  /** Cookie consent before visitor statistics. */
  "site.cookie_consent": {
    diy: {
      lei: 0,
      hours: 2,
      how: bi(
        "add a free consent banner from your site's platform and start the statistics only after consent (about 2 hours)",
        "pui un banner de acord gratuit din platforma site-ului și pornești statisticile doar după acord (cam 2 ore)",
      ),
    },
    vortex: { setupLei: SCAN_FROM.measurement, monthlyLei: 0 },
  },
  /** Online booking or reservation. */
  "clients.online_booking": {
    diy: { lei: 0, hours: 3 },
    vortex: { setupLei: SCAN_FROM.mediumAutomation, monthlyLei: 50 },
  },
  /** A quote request form. */
  "clients.quote_request": {
    diy: { lei: 0, hours: 2 },
    // A form on the site that files each request: a simple automation.
    vortex: { setupLei: SCAN_FROM.simpleAutomation, monthlyLei: 50 },
  },
  /** Automatic reminders before appointments. */
  "clients.reminders": {
    diy: {
      lei: 0,
      hours: 0,
      how: bi(
        "send the reminder yourself by text or WhatsApp the day before (about 10 minutes a day)",
        "trimiți tu reamintirea prin SMS sau WhatsApp cu o zi înainte (cam 10 minute pe zi)",
      ),
    },
    vortex: { setupLei: SCAN_FROM.simpleAutomation, monthlyLei: 50 },
  },
  /** Close the margin gap (prices, costs, what you sell more of), with the accountant. */
  "money.margin_gap": {
    diy: {
      lei: 0,
      hours: 4,
      how: bi(
        "a 2–4 hour talk with your accountant to see where the difference comes from; the effect depends on what you change",
        "o discuție de 2–4 ore cu contabilul ca să vedeți de unde vine diferența; efectul depinde de ce schimbați",
      ),
    },
  },
  /** Collect faster: payment terms and reminders, with the accountant. */
  "money.collect_faster": { diy: { lei: 0, hours: 2 } },
  /** A faster site on phones. */
  "site.speed": {
    diy: {
      lei: 0,
      hours: 3,
      how: bi(
        "compress the large images and remove what you don't use from the home page (about 3 hours)",
        "comprimi imaginile mari și scoți de pe prima pagină ce nu folosești (cam 3 ore)",
      ),
    },
    vortex: { setupLei: SCAN_FROM.mediumFix, monthlyLei: 0 },
  },
  /** Claim or complete the Google Business Profile. */
  "presence.google_profile": { diy: { lei: 0, hours: 1 } },
  /** Look at public tenders. */
  "money.tenders": { diy: { lei: 0, hours: 2 } },
  /** An own website instead of only social pages. */
  "site.own_website": {
    diy: {
      lei: 0,
      hours: 12,
      how: bi(
        "a simple site from an online site builder (about 50–100 lei a month, 1–2 days of work)",
        "un site simplu dintr-un constructor online (cam 50–100 lei pe lună, 1–2 zile de lucru)",
      ),
    },
    vortex: { setupLei: SCAN_FROM.newWebsite, monthlyLei: 50 },
  },
};

/**
 * "Cost total dacă lucrezi cu Vortex Hub": one-off and monthly, each shared system counted
 * once, at its dearest part (booking with its reminders costs what the booking costs), over
 * the actions shown; `shared` lists that part first. Undefined when none is priced by Vortex Hub.
 */
export function vortexTotal(
  actions: Array<{ id: string; cost: { vortex?: { setupLei: number; monthlyLei: number } } }>,
): { setupLei: number; monthlyLei: number; shared: string[][] } | undefined {
  const priced = actions.filter((a) => a.cost.vortex);
  if (!priced.length) return undefined;
  const shared: string[][] = [];
  const seen = new Set<string>();
  let setupLei = 0;
  let monthlyLei = 0;
  for (const a of priced) {
    if (seen.has(a.id)) continue;
    const group = SAME_SYSTEM.find((g) => g.includes(a.id));
    // The dearest part first: the screen prices the shared system by its first member.
    const parts = (group ? priced.filter((x) => group.includes(x.id)) : [a])
      .map((x, i) => ({ id: x.id, vortex: x.cost.vortex!, i }))
      .sort((x, y) => y.vortex.setupLei - x.vortex.setupLei || x.i - y.i);
    const members = parts.map((x) => x.id);
    members.forEach((id) => seen.add(id));
    if (members.length > 1) shared.push(members);
    setupLei += parts[0].vortex.setupLei;
    monthlyLei += Math.max(...parts.map((x) => x.vortex.monthlyLei));
  }
  return { setupLei, monthlyLei, shared };
}

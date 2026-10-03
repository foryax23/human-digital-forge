/*
 * ACTION PRICES: TO BE APPROVED BY THE OWNER (plan A8, D7).
 *
 * "Cu Vortex Hub: de la X lei, plus Y lei pe lună" and "Poți face singur:
 * gratuit, N ore" on every action read this table, so the screen, the PDF and
 * the summary text always show the same price. The Vortex Hub figures start
 * from the low end of the quick scan's price book (PRICE_BOOK in
 * src/lib/scan/blueprint/economics.ts) so the two reports agree; Mihai Dandea
 * replaces them with his real prices before the test round. Prices in lei,
 * VAT excluded.
 */

import type { Bilingual } from "../contracts";

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
    vortex: { setupLei: 400, monthlyLei: 0 },
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
    vortex: { setupLei: 800, monthlyLei: 0 },
  },
  /** Online booking or reservation. */
  "clients.online_booking": {
    diy: { lei: 0, hours: 3 },
    vortex: { setupLei: 1200, monthlyLei: 50 },
  },
  /** A quote request form. */
  "clients.quote_request": {
    diy: { lei: 0, hours: 2 },
    vortex: { setupLei: 1200, monthlyLei: 50 },
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
    vortex: { setupLei: 1200, monthlyLei: 50 },
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
    vortex: { setupLei: 1500, monthlyLei: 0 },
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
    vortex: { setupLei: 6000, monthlyLei: 50 },
  },
};

/**
 * "Cost total dacă lucrezi cu Vortex Hub": one-off and monthly, each shared system counted
 * once, over the actions shown. Undefined when none of them is priced by Vortex Hub.
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
    const members = group ? priced.filter((x) => group.includes(x.id)).map((x) => x.id) : [a.id];
    members.forEach((id) => seen.add(id));
    if (members.length > 1) shared.push(members);
    setupLei += a.cost.vortex!.setupLei;
    monthlyLei += a.cost.vortex!.monthlyLei;
  }
  return { setupLei, monthlyLei, shared };
}

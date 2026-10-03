import type {
  Action,
  Audience,
  Bilingual,
  DeepReport,
  Estimate,
  Fact,
  OwnerInputs,
  PlanTotals,
  SectorVocabId,
} from "../contracts";
import { VOCAB } from "../vocab";

import {
  FORMULA,
  marginGapEstimate,
  recomputeEstimateList,
  timeEstimatesFor,
  totalOf,
} from "./estimates";
import { ACTION_PRICES } from "./prices";
import { readFacts, roCount, SITE_BROKEN, SITE_OK, type FactReader } from "./read";

/*
 * The actions catalogue (plan A8): triggers are fact predicates, effects come
 * from the money model (estimates.ts), costs from prices.ts (to be approved by
 * the owner). The three shown are ranked by value in lei, text-only actions
 * after valued ones, with at least one the owner or the accountant does alone;
 * legal must-dos are listed first, marked mandatory, and do not take a slot.
 * The screen, the PDF and the summary text all read the same `actions[]` and
 * `totals`. Third parties get no actions (they get "Ce să verifici").
 */

const bi = (en: string, ro: string): Bilingual => ({ en, ro });

export const SHOWN_ACTIONS = 3;

type Candidate = Omit<Action, "rank"> & { order: number };

function cost(id: string): Action["cost"] {
  const p = ACTION_PRICES[id];
  if (!p) return {};
  return {
    ...(p.diy ? { diyLei: p.diy.lei, diyHours: p.diy.hours } : {}),
    ...(p.diy?.how ? { diyHow: p.diy.how } : {}),
    ...(p.vortex
      ? { vortex: { setupLei: p.vortex.setupLei, monthlyLei: p.vortex.monthlyLei } }
      : {}),
  };
}

const B2B: SectorVocabId[] = ["b2b_wholesale", "construction", "manufacturing", "transport", "it"];

export type ActionsContext = {
  vocab: SectorVocabId;
  audience: Audience;
  caen?: string;
  owner?: OwnerInputs;
  peers?: DeepReport["peers"];
};

function candidates(r: FactReader, ctx: ActionsContext): Candidate[] {
  const out: Candidate[] = [];
  const v = VOCAB[ctx.vocab];
  const status = r.websiteStatus();
  const siteOk = Boolean(status && SITE_OK.includes(status));

  // Legal must-do: company details on the site (Legea 365/2002 art. 5).
  const cui = r.get("site.cui.present");
  const regNo = r.get("site.reg_no.present");
  // Legea 365/2002 art. 5 asks for both: either one not found on the pages read triggers it.
  if (siteOk && ((cui && cui.value === false) || (regNo && regNo.value === false))) {
    out.push({
      id: "legal.company_details",
      title: bi(
        "Put the tax code (CUI) and the company details on the website",
        "Pune pe site codul fiscal (CUI) și datele firmei",
      ),
      why: bi(
        "Required by law (Law 365/2002): name, tax code and Trade Register number on the website.",
        "Obligatoriu prin lege (Legea 365/2002): denumirea, codul fiscal și numărul de la Registrul Comerțului pe site.",
      ),
      mandatory: true,
      comparison: bi("required by law (Law 365/2002)", "obligatoriu prin lege (Legea 365/2002)"),
      cost: cost("legal.company_details"),
      who: "singur",
      firstEffect: bi("immediately", "imediat"),
      factIds: [cui, regNo]
        .filter((f): f is Fact => Boolean(f && f.value === false))
        .map((f) => f.id),
      order: 0,
    });
  }

  if (status && SITE_BROKEN.includes(status)) {
    out.push({
      id: "site.fix_domain",
      title:
        status === "broken_certificate"
          ? bi(
              "Renew the website's security certificate",
              "Reînnoiește certificatul de securitate al site-ului",
            )
          : bi(
              "Move the website off the parked or dead domain",
              "Mută site-ul de pe domeniul parcat sau nefuncțional",
            ),
      why: bi(
        "Customers who open the address see an error or a for-sale page.",
        "Clienții care deschid adresa văd o eroare sau «domeniu de vânzare».",
      ),
      mandatory: false,
      comparison:
        status === "broken_certificate"
          ? bi(
              "visitors no longer see the browser's security warning",
              "vizitatorii nu mai văd avertismentul de securitate al browserului",
            )
          : bi(
              "whoever looks for you finds the company, not a for-sale page",
              "cine te caută găsește firma, nu un anunț de vânzare",
            ),
      cost: cost("site.fix_domain"),
      who: "cu_vortex",
      firstEffect: bi("in the first week", "din prima săptămână"),
      factIds: ["site.status"],
      order: 1,
    });
  }

  const social = r.get("presence.social_only");
  if (social || status === "none" || (!status && r.has("site.status"))) {
    out.push({
      id: "site.own_website",
      title: social
        ? bi(
            "An own website, not only social media pages",
            "Un site propriu, nu doar pagini pe rețele sociale",
          )
        : bi("A website for the company", "Un site al firmei"),
      why: bi(
        "An own website is where the company's details, services and a way to get in touch appear in searches.",
        "Pe un site propriu apar în căutări datele firmei, serviciile și o cale de contact.",
      ),
      mandatory: false,
      comparison: bi(
        "whoever searches for you finds the company's details, services and a way to get in touch",
        "cine te caută pe Google găsește datele firmei, serviciile și o cale de contact",
      ),
      cost: cost("site.own_website"),
      who: "cu_vortex",
      firstEffect: bi("in 4 to 6 weeks", "în 4–6 săptămâni"),
      factIds: social ? [social.id] : ["site.status"],
      order: 2,
    });
  }

  const consent = r.get("site.consent.before_analytics");
  if (siteOk && consent && consent.value === true) {
    out.push({
      id: "site.cookie_consent",
      title: bi(
        "Ask visitors for consent before visitor statistics",
        "Cere acordul vizitatorilor înainte de statisticile despre vizitatori",
      ),
      why: bi(
        "Probably not compliant with the cookie rules; to be checked with a specialist.",
        "Probabil neconform cu regulile privind cookie-urile; de verificat cu un specialist.",
      ),
      mandatory: false,
      comparison: bi(
        "your visitor statistics follow the cookie rules (to be checked with a specialist)",
        "statisticile despre vizitatori respectă regulile privind cookie-urile (de verificat cu un specialist)",
      ),
      cost: cost("site.cookie_consent"),
      who: "cu_vortex",
      firstEffect: bi("immediately", "imediat"),
      factIds: [consent.id],
      order: 3,
    });
  }

  const booking = r.get("site.booking.present");
  const form = r.get("site.contact_form.present");
  const bookingMissing =
    siteOk &&
    booking?.value === false &&
    (v.expects === "booking" || (v.expects === "quote" && form?.value !== true));
  const timeCtx = {
    vocab: ctx.vocab,
    caen: ctx.caen,
    clientsPerMonth: ctx.owner?.clientsPerMonth,
    hourValue: ctx.owner?.hourValue,
    // No filed accounts: the sector's default volume says nothing about this firm, so no lei
    // are shown until the owner gives their own number (A1 "New firm").
    volumeUnknown: r.filed() !== true,
  };
  if (bookingMissing && booking) {
    const pages = booking.observed?.pagesRead;
    const observed =
      pages && pages > 1
        ? bi(
            `We found no ${v.words.bookingOnline.en} on the ${pages} pages we read.`,
            `Nu am găsit ${v.words.bookingOnline.ro} pe cele ${roCount(pages, "pagini citite")}.`,
          )
        : bi(
            `We found no ${v.words.bookingOnline.en} on the pages we read.`,
            `Nu am găsit ${v.words.bookingOnline.ro} pe paginile citite.`,
          );
    // A quote request is its own action (own ID, price and headline area), not "booking".
    const quote = v.expects === "quote";
    const id = quote ? "clients.quote_request" : "clients.online_booking";
    out.push({
      id,
      title: quote
        ? bi("A quote request form on the website", "Un formular de cerere de ofertă pe site")
        : bi(
            `${cap(v.words.bookingOnline.en)} on the website`,
            `${cap(v.words.bookingOnline.ro)} pe site`,
          ),
      why: observed,
      mandatory: false,
      comparison: bi(
        `${v.words.clientsThe.en} can ask outside working hours`,
        `${v.words.clientsThe.ro} pot cere și în afara programului`,
      ),
      cost: cost(id),
      who: "cu_vortex",
      firstEffect: bi("from month 2", "din luna 2"),
      factIds: [booking.id, ...(form ? [form.id] : [])],
      order: 4,
      effect: timeEstimatesFor([FORMULA.booking], { ...timeCtx, factIds: [booking.id] })[
        FORMULA.booking
      ],
    });
  }

  if (siteOk && v.appointments) {
    out.push({
      id: "clients.reminders",
      title: bi(
        "Automatic reminders before appointments",
        "Mesaje automate de reamintire înainte de programări",
      ),
      why: bi(
        `Fewer phone calls to confirm ${v.words.booking.en}s; ${v.words.clients.en} who would forget are reminded.`,
        `Mai puține telefoane pentru confirmarea programărilor; ${v.words.clients.ro} care ar uita primesc o reamintire.`,
      ),
      mandatory: false,
      comparison: bi(
        `fewer ${v.words.clients.en} forget their ${v.words.booking.en}`,
        `mai puțini ${v.words.clients.ro} își uită programarea`,
      ),
      cost: cost("clients.reminders"),
      who: "cu_vortex",
      firstEffect: bi("from month 2", "din luna 2"),
      factIds: ["site.status"],
      order: 5,
      effect: timeEstimatesFor([FORMULA.reminders], { ...timeCtx, factIds: ["site.status"] })[
        FORMULA.reminders
      ],
    });
  }

  const margins = r.series("money.margin_pretax");
  const band = r.band("marginPretax");
  const turnover = r.latest("money.turnover");
  if (margins[0] && band && turnover && margins[0].value < band.p25) {
    const ownerTurnover = typeof ctx.owner?.turnover2026 === "number" && ctx.owner.turnover2026 > 0;
    const effect = marginGapEstimate({
      turnover: ownerTurnover ? ctx.owner!.turnover2026! : turnover.value,
      marginOwn: margins[0].value,
      marginP25: band.p25,
      marginP50: band.p50,
      n: band.n,
      scope: ctx.peers?.scopeLabel ?? band.fact.display,
      year: margins[0].year,
      ownerTurnover,
      factIds: [margins[0].fact.id, band.fact.id, turnover.fact.id],
    });
    const trend = r.get("money.expenses_vs_revenue");
    if (effect) {
      out.push({
        id: "money.margin_gap",
        title: bi(
          "Keep more of every 100 lei invoiced: prices, costs, what you sell more of",
          "Păstrează mai mult din fiecare 100 de lei facturați: prețuri, costuri, ce vinzi mai mult",
        ),
        why: trend
          ? bi(
              `From the annual accounts: ${trend.display.en}.`,
              `Din bilanțuri: ${trend.display.ro}.`,
            )
          : bi(
              "You keep less of every 100 lei invoiced than most similar firms.",
              "Păstrezi din fiecare 100 de lei facturați mai puțin decât majoritatea firmelor similare.",
            ),
        mandatory: false,
        cost: cost("money.margin_gap"),
        who: "contabil",
        firstEffect: bi("in 3 to 6 months", "în 3–6 luni"),
        factIds: [...effect.factIds, ...(trend ? [trend.id] : [])],
        order: 6,
        effect,
      });
    }
  }

  const days = r.band("daysToCollect");
  if (days && days.you !== undefined && days.you > days.p75) {
    out.push({
      id: "money.collect_faster",
      title: bi(
        "Collect faster: payment terms and reminders",
        "Încasează mai repede: termene de plată și reamintiri",
      ),
      why: bi(
        "You collect more slowly than most similar firms (estimate from the annual accounts).",
        "Încasezi mai încet decât majoritatea firmelor similare (estimare din bilanțuri).",
      ),
      mandatory: false,
      comparison: bi(
        "the money from your invoices reaches the account sooner",
        "banii din facturi ajung mai repede în cont",
      ),
      cost: cost("money.collect_faster"),
      who: "contabil",
      firstEffect: bi("in 1 to 2 months", "în 1–2 luni"),
      factIds: [days.fact.id],
      order: 7,
    });
  }

  const speed = r.get("site.speed.mobile");
  const lcp = (speed?.value as { lcpMs?: number } | undefined)?.lcpMs;
  if (siteOk && speed && typeof lcp === "number" && lcp > 4000) {
    out.push({
      id: "site.speed",
      title: bi("A faster website on phones", "Un site mai rapid pe telefon"),
      why: bi(`${speed.display.en}.`, `${speed.display.ro}.`),
      mandatory: false,
      comparison: bi(
        "the page opens faster on phones, so fewer visitors leave before it loads",
        "pagina se deschide mai repede pe telefon, așa că pleacă mai puțini vizitatori",
      ),
      cost: cost("site.speed"),
      who: "cu_vortex",
      firstEffect: bi("from the first month", "din prima lună"),
      factIds: [speed.id],
      order: 8,
    });
  }

  const google = r.get("presence.google_profile_linked");
  if (siteOk && google && google.value === false) {
    out.push({
      id: "presence.google_profile",
      title: bi(
        "Claim or complete the Google profile",
        "Revendică sau completează profilul Google",
      ),
      why: bi(`${google.display.en}.`, `${google.display.ro}.`),
      mandatory: false,
      comparison: bi(
        "you show up with the right details in Google searches and on the map",
        "apari cu datele corecte în căutările Google și pe hartă",
      ),
      cost: cost("presence.google_profile"),
      who: "singur",
      firstEffect: bi("in a few weeks", "în câteva săptămâni"),
      factIds: [google.id],
      order: 9,
    });
  }

  const ted = r.get("risk.ted.awards");
  if (B2B.includes(ctx.vocab) && ted && ted.value === 0) {
    out.push({
      id: "money.tenders",
      title: bi(
        "Look at the public tenders in your field",
        "Uită-te la licitațiile publice din domeniul tău",
      ),
      why: bi(
        "We found no public contracts won by the company in the European tenders register (TED).",
        "Nu am găsit contracte publice câștigate de firmă în registrul european de licitații (TED).",
      ),
      mandatory: false,
      comparison: bi(
        "you learn early what public buyers in your field want to buy",
        "afli din timp ce vor să cumpere autoritățile din domeniul tău",
      ),
      cost: cost("money.tenders"),
      who: "singur",
      firstEffect: bi("at the next suitable tender", "la următoarea licitație potrivită"),
      factIds: [ted.id],
      order: 10,
    });
  }
  return out;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Time estimates under this value (lei a month) are not worth an action slot: a reader
 * who sees "40 lei pe lună" as a top action stops trusting the rest.
 */
export const MIN_TIME_VALUE_MONTH = 100;

/** Lei a year, for ranking only (two kinds of money are compared here, never added). */
function yearlyValue(e?: Estimate): number {
  if (!e || e.value <= 0) return 0;
  return e.kind === "time_value_month" ? e.value * 12 : e.value;
}

/** The actions shown: legal must-dos, then three ranked by value with at least one done alone. */
export function chooseActions(facts: Fact[], ctx: ActionsContext): Action[] {
  if (ctx.audience !== "owner") return [];
  const r = readFacts(facts);
  const all = candidates(r, ctx).filter(
    (a) =>
      !(
        a.effect?.kind === "time_value_month" &&
        a.effect.value < MIN_TIME_VALUE_MONTH &&
        !a.effect.inputs.needsVolume
      ),
  );
  const mandatory = all.filter((a) => a.mandatory);
  const ranked = all
    .filter((a) => !a.mandatory)
    .sort((a, b) => yearlyValue(b.effect) - yearlyValue(a.effect) || a.order - b.order);
  let shown = ranked.slice(0, SHOWN_ACTIONS);
  const alone = (a: Candidate) => a.who === "singur" || a.who === "contabil";
  if (shown.length === SHOWN_ACTIONS && !shown.some(alone)) {
    const swap = ranked.slice(SHOWN_ACTIONS).find(alone);
    if (swap) shown = [...shown.slice(0, SHOWN_ACTIONS - 1), swap];
  }
  // Time estimates are recomputed over the shown actions only, so overlap and the
  // 20% cap apply to exactly what the reader sees and the totals equal the parts.
  const TIME_ORDER: string[] = [FORMULA.booking, FORMULA.reminders];
  const timeShown = shown
    .filter((a) => a.effect?.kind === "time_value_month")
    .sort(
      (a, b) => TIME_ORDER.indexOf(a.effect!.formulaId) - TIME_ORDER.indexOf(b.effect!.formulaId),
    );
  if (timeShown.length) {
    const rebuilt = recomputeEstimateList(
      timeShown.map((a) => a.effect!),
      {},
    );
    timeShown.forEach((a, i) => {
      a.effect = rebuilt[i];
    });
  }
  return [...mandatory, ...shown].map(({ order: _order, ...a }, i) => ({
    ...a,
    rank: a.mandatory ? 0 : i - mandatory.length + 1,
  }));
}

/** The totals: one line per kind of money, never added across kinds. */
export function planTotals(actions: Action[]): PlanTotals {
  const effects = actions.map((a) => a.effect).filter((e): e is Estimate => Boolean(e));
  const totals: PlanTotals = {};
  const time = totalOf(effects, "time_value_month");
  const profit = totalOf(effects, "profit_year_pretax");
  if (time) totals.timeValueMonth = time;
  if (profit) totals.profitYearPretax = profit;
  return totals;
}

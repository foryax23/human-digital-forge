import type { AreaLight, Audience, Bilingual, Fact, LightState, SectorVocabId } from "../contracts";
import { VOCAB } from "../vocab";

import {
  keptOf100,
  readFacts,
  roCount,
  sameDirection3y,
  SITE_BROKEN,
  SITE_OK,
  type FactReader,
} from "./read";

/*
 * The five lines (plan A8 "Lines"): Bani, Clienți (renamed by the sector
 * vocabulary), Online, Echipă and Risc, each with a state (■ Bine, ◆ Atenție,
 * ● De rezolvat, □ Neverificat), a reason of at most 40 characters and the
 * facts it rests on. Pure and client-safe: `finish` builds them on the
 * server and the browser rebuilds them after a correction or while the run is
 * still in progress (provisional).
 *
 * Absences are observations ("nu am găsit … "), never "nu ai". Hiring is
 * positive. Being a creditor in someone else's case is never adverse. Court
 * matches below 0.9 never count against the company.
 */

/** Line reasons stay on one row next to the word: at most 40 characters (A1). */
export const REASON_MAX = 40;

type Wording = { owner: Bilingual; third: Bilingual };
const w = (en: string, ro: string, thirdEn = en, thirdRo = ro): Wording => ({
  owner: { en, ro },
  third: { en: thirdEn, ro: thirdRo },
});

const LABELS = {
  bani: { en: "Money", ro: "Bani" },
  online: { en: "Online", ro: "Online" },
  echipa: { en: "Team", ro: "Echipă" },
  risc: { en: "Risk", ro: "Risc" },
} satisfies Record<string, Bilingual>;

export type LightsContext = { vocab: SectorVocabId; audience: Audience };

function kept(margin: number): Wording {
  const k = keptOf100(margin);
  if (k <= 0)
    return w(
      "nothing left of 100 lei, before tax",
      "nu îți rămâne nimic din 100 de lei",
      "nothing left of 100 lei, before tax",
      "nu rămâne nimic din 100 de lei",
    );
  if (k === 1)
    return w(
      "you keep 1 leu of 100",
      "îți rămâne un leu din 100",
      "keeps 1 leu of 100",
      "rămâne un leu din 100",
    );
  return w(
    `you keep ${k} lei of 100`,
    `îți rămân ${k} lei din 100`,
    `keeps ${k} lei of 100`,
    `rămân ${k} lei din 100`,
  );
}

const ids = (...list: Array<Fact | string | undefined>) =>
  list.map((x) => (typeof x === "string" ? x : x?.id)).filter((x): x is string => Boolean(x));

type LineOut = { state: LightState; reason: Wording; factIds: string[]; note?: Wording };

function bani(r: FactReader): LineOut {
  const filed = r.filed();
  if (filed === false)
    return {
      state: "neverificat",
      reason: w(
        "no annual accounts filed yet",
        "încă nu ai bilanț depus",
        "no annual accounts filed yet",
        "încă nu are bilanț depus",
      ),
      factIds: ["money.filed"],
    };
  if (filed === null)
    return {
      state: "neverificat",
      reason: w(
        "ANAF did not answer; check later",
        "ANAF nu a răspuns; verifică la sursă",
        "ANAF did not answer",
        "ANAF nu a răspuns; de verificat",
      ),
      factIds: ["money.filed"],
    };
  if (filed !== true)
    return {
      state: "neverificat",
      reason: w("annual accounts not checked", "bilanțul nu a fost verificat"),
      factIds: [],
    };
  const turnover = r.latest("money.turnover");
  const year =
    turnover?.year ?? r.latest("money.profit_net")?.year ?? r.latest("money.profit_pretax")?.year;
  const at = (predicate: string) => (year ? r.num(`${predicate}.${year}`) : undefined);
  const dormant =
    year !== undefined &&
    !at("money.turnover") &&
    !at("money.revenue_total") &&
    !at("money.expenses") &&
    !at("people.employees");
  if (dormant)
    return {
      state: "atentie",
      reason: w(`no activity in the ${year} accounts`, `fără activitate în bilanțul ${year}`),
      factIds: ids(turnover?.fact, "money.filed"),
    };
  const net = r.latest("money.profit_net");
  if (net && net.value < 0)
    return {
      state: "de_rezolvat",
      reason: w(`net loss in ${net.year}`, `pierdere în ${net.year}`),
      factIds: [net.fact.id],
    };
  const margins = r.series("money.margin_pretax");
  const margin = margins[0];
  const band = r.band("marginPretax");
  const own = margin?.value;
  const falling2y = sameDirection3y(margins) === "down";
  if (own !== undefined && band && own < band.p25 && falling2y)
    return {
      state: "de_rezolvat",
      reason: kept(own),
      factIds: ids(margin.fact, band.fact, margins[1]?.fact, margins[2]?.fact),
    };
  const profitChange = r.get("money.profit_change");
  const pc = profitChange?.value as { ratio?: number; from?: number } | undefined;
  const drop = typeof pc?.ratio === "number" && pc.ratio < -0.1;
  if (own !== undefined && band && own < band.p50)
    return { state: "atentie", reason: kept(own), factIds: ids(margin.fact, band.fact) };
  // The trigger is the profit drop: the reason says so (not the margin).
  if (drop)
    return {
      state: "atentie",
      reason: profitDown(pc!.ratio!, pc!.from),
      factIds: ids(profitChange, margin?.fact),
    };
  if (own !== undefined && keptOf100(own) <= 0)
    return { state: "atentie", reason: kept(own), factIds: ids(margin.fact) };
  if (!band) {
    // No similar firms to compare with (every live run until the peer file loads): never
    // "Bine" on the margin alone. Keeping 3 lei (of 100) less than 3 years earlier is a warning.
    const then = marginYearsBefore(r, margin);
    if (own !== undefined && then && keptOf100(then.value) - keptOf100(own) >= 3)
      return {
        state: "atentie",
        reason: keptThen(keptOf100(own), keptOf100(then.value), then.year),
        factIds: ids(margin.fact, ...then.factIds),
      };
    const profits = r.series("money.profit_pretax").slice(0, 3);
    const every3 =
      profits.length === 3 &&
      profits[0].year - profits[2].year === 2 &&
      profits.every((p) => p.value > 0);
    const noPeers = w(
      "no comparison with similar firms yet",
      "fără comparație cu firme similare încă",
    );
    if (every3)
      return {
        state: "bine",
        reason: w("profit in each of the last 3 years", "profit în fiecare din ultimii 3 ani"),
        factIds: profits.map((p) => p.fact.id),
        note: noPeers,
      };
    if (net && net.value > 0)
      return {
        state: "bine",
        reason: w(`profit in ${net.year}`, `profit în ${net.year}`),
        factIds: [net.fact.id],
        note: noPeers,
      };
  }
  if (own !== undefined) return { state: "bine", reason: kept(own), factIds: ids(margin.fact) };
  if (net && net.value > 0)
    return {
      state: "bine",
      reason: w(`profit in ${net.year}`, `profit în ${net.year}`),
      factIds: [net.fact.id],
    };
  if (net)
    return {
      state: "atentie",
      reason: w(`no profit in ${net.year}`, `fără profit în ${net.year}`),
      factIds: [net.fact.id],
    };
  return {
    state: "neverificat",
    reason: w("profit not in the accounts", "profitul nu apare în bilanț"),
    factIds: ["money.filed"],
  };
}

/** "profitul a scăzut cu 23% față de 2024". */
function profitDown(ratio: number, from?: number): Wording {
  const p = Math.round(Math.abs(ratio) * 100);
  return from
    ? w(`profit down ${p}% on ${from}`, `profitul a scăzut cu ${p}% față de ${from}`)
    : w(`profit down ${p}% on the year before`, `profitul a scăzut cu ${p}%`);
}

/** "îți rămân 10 din 100, față de 17 în 2022" (within the 40-character reason). */
function keptThen(k: number, k0: number, y0: number): Wording {
  const fit = (long: string, short: string) => (long.length <= REASON_MAX ? long : short);
  return w(
    fit(`you keep ${k} of 100, ${k0} in ${y0}`, `${k} of 100, ${k0} in ${y0}`),
    fit(
      `îți rămân ${k} din 100, față de ${k0} în ${y0}`,
      `${k} lei din 100, față de ${k0} în ${y0}`,
    ),
    fit(`keeps ${k} of 100, ${k0} in ${y0}`, `${k} of 100, ${k0} in ${y0}`),
    fit(`rămân ${k} din 100, față de ${k0} în ${y0}`, `${k} lei din 100, față de ${k0} în ${y0}`),
  );
}

/** The pre-tax margin of one year, from the filed turnover and pre-tax profit. */
export function marginAt(
  r: FactReader,
  year: number,
): { year: number; value: number; factIds: string[] } | undefined {
  const t = r.series("money.turnover").find((x) => x.year === year);
  const p = r.series("money.profit_pretax").find((x) => x.year === year);
  return t && p && t.value > 0
    ? { year, value: p.value / t.value, factIds: [t.fact.id, p.fact.id] }
    : undefined;
}

/**
 * The pre-tax margin 3 years before the latest one (2 when the third is missing), from the
 * filed turnover and pre-tax profit (the margin facts cover the last 3 years only).
 */
export function marginYearsBefore(
  r: FactReader,
  latest: { year: number } | undefined,
): { year: number; value: number; factIds: string[] } | undefined {
  if (!latest) return undefined;
  for (const back of [3, 2]) {
    const m = marginAt(r, latest.year - back);
    if (m) return m;
  }
  return undefined;
}

function clienti(r: FactReader, vocab: SectorVocabId) {
  const v = VOCAB[vocab];
  const status = r.websiteStatus();
  const contact = r.get("site.contact.present");
  const booking = r.get("site.booking.present");
  const form = r.get("site.contact_form.present");
  const rating = r.get("presence.google_rating");
  const ratingValue = (rating?.value as { rating?: number } | undefined)?.rating;
  if (!status || !SITE_OK.includes(status)) {
    if (typeof ratingValue === "number" && ratingValue < 4)
      return {
        state: "atentie" as LightState,
        reason: w("Google rating under 4", "nota Google sub 4"),
        factIds: [rating!.id],
      };
    return {
      state: "neverificat" as LightState,
      reason: w("no confirmed website to check", "niciun site confirmat de verificat"),
      factIds: ids("site.status"),
    };
  }
  if (contact && contact.value === false)
    return {
      state: "de_rezolvat" as LightState,
      reason: w("no way to contact found", "nu am găsit o cale de contact"),
      factIds: [contact.id],
    };
  const expected =
    v.expects === "booking"
      ? booking?.value === false
      : v.expects === "quote"
        ? booking?.value === false && form?.value !== true
        : false;
  if (expected && booking)
    return {
      state: "atentie" as LightState,
      reason: w(`no ${v.words.bookingOnline.en} found`, `nu am găsit ${v.words.bookingOnline.ro}`),
      factIds: ids(booking, form),
    };
  if (typeof ratingValue === "number" && ratingValue < 4)
    return {
      state: "atentie" as LightState,
      reason: w("Google rating under 4", "nota Google sub 4"),
      factIds: [rating!.id],
    };
  return {
    state: "bine" as LightState,
    reason: w("easy to reach", "ușor de contactat"),
    factIds: ids(contact ?? "site.status", booking),
  };
}

function online(r: FactReader) {
  const status = r.websiteStatus();
  if (status && SITE_BROKEN.includes(status)) {
    const reasons: Record<string, Wording> = {
      parked: w("domain parked or for sale", "domeniu parcat sau de vânzare"),
      dead: w("the domain does not work", "domeniul nu funcționează"),
      broken_certificate: w("broken security certificate", "certificat de securitate invalid"),
    };
    return {
      state: "de_rezolvat" as LightState,
      reason: reasons[status],
      factIds: ["site.status"],
    };
  }
  const social = r.get("presence.social_only");
  if (social)
    return {
      state: "atentie" as LightState,
      reason: w("only social media pages", "doar pagini pe rețele sociale"),
      factIds: [social.id],
    };
  if (status === "blocked")
    // The site refuses automated visits: nothing is concluded about it.
    return {
      state: "neverificat" as LightState,
      reason: w("the site blocks automated visits", "site-ul blochează accesul automat"),
      factIds: ["site.status"],
    };
  if (!status || status === "none")
    return {
      state: "atentie" as LightState,
      reason: w("no company website found", "nu am găsit un site al firmei"),
      factIds: ids(r.has("site.status") ? "site.status" : undefined),
    };
  if (status === "unreachable")
    return {
      state: "atentie" as LightState,
      reason: w("the website did not answer", "site-ul nu a răspuns"),
      factIds: ["site.status"],
    };
  if (status === "ask_visitor")
    return {
      state: "atentie" as LightState,
      reason: w("website not confirmed", "nu am putut confirma site-ul"),
      factIds: ["site.status"],
    };
  const cui = r.get("site.cui.present");
  const regNo = r.get("site.reg_no.present");
  // Legea 365/2002 asks for the tax code on the site: missing CUI is a warning even when
  // the Trade Register number is there.
  if (cui && cui.value === false)
    return {
      state: "atentie" as LightState,
      reason: w("tax code not found on the site", "CUI-ul nu apare pe site"),
      factIds: ids(cui, regNo),
    };
  const important = r.num("site.audit.important");
  if (important && important > 0)
    return {
      state: "atentie" as LightState,
      reason:
        important === 1
          ? w("1 important issue on the site", "o problemă importantă pe site")
          : w(
              `${important} important issues on the site`,
              `${roCount(important, "probleme importante")} pe site`,
            ),
      factIds: ["site.audit.important"],
    };
  return {
    state: "bine" as LightState,
    reason: w("the website works", "site-ul funcționează"),
    factIds: ids(r.has("site.audit.important") ? "site.audit.important" : "site.status"),
  };
}

function echipa(r: FactReader) {
  const staff = r.latest("people.employees");
  if (!staff)
    return {
      state: "neverificat" as LightState,
      reason: w("not in the accounts yet", "încă nu apare în bilanț"),
      factIds: [] as string[],
    };
  const change = r.get("people.employees_change");
  const c = change?.value as { ratio?: number; from?: number; to?: number } | undefined;
  // Down ≥ 30% on the year and by at least 2 people (3 → 2 in a tiny firm is not a trend).
  if (c && typeof c.ratio === "number" && c.ratio <= -0.3 && (c.from ?? 0) - (c.to ?? 0) >= 2)
    return {
      state: "atentie" as LightState,
      reason: w(`employees ${c.from} → ${c.to}`, `salariați ${c.from} → ${c.to}`),
      factIds: [change!.id],
    };
  const rpe = r.band("revPerEmp");
  if (rpe && rpe.you !== undefined && rpe.you < rpe.p25)
    return {
      state: "atentie" as LightState,
      reason: w("low turnover per employee", "cifră de afaceri mică pe salariat"),
      factIds: ids(rpe.fact, r.get("people.revenue_per_employee")),
    };
  const hiring = r.get("people.hiring");
  if (hiring && hiring.value === true)
    return {
      state: "bine" as LightState,
      reason: w("you are hiring", "angajezi", "hiring", "angajează"),
      factIds: ids(hiring, staff.fact),
    };
  const n = staff.value;
  return {
    state: "bine" as LightState,
    reason:
      n === 0
        ? w("no employees in the accounts", "fără salariați în bilanț")
        : n === 1
          ? w("1 employee", "un salariat")
          : w(`${n} employees`, roCount(n, "salariați")),
    factIds: [staff.fact.id],
  };
}

function risc(r: FactReader) {
  const identity = r.get("identity.status");
  const insolvency = r.get("risk.courts.insolvency_debtor");
  const defendant = r.get("risk.courts.as_defendant");
  const courts = r.get("risk.courts.checked");
  const defendantN = typeof defendant?.value === "number" ? defendant.value : 0;
  if (identity && identity.value === "radiat")
    return {
      state: "de_rezolvat" as LightState,
      reason: w("struck off the register", "radiată din registru"),
      factIds: [identity.id],
    };
  if (identity && identity.value !== "activ")
    return {
      state: "de_rezolvat" as LightState,
      reason: w("inactive at ANAF", "inactivă la ANAF"),
      factIds: [identity.id],
    };
  if (insolvency && insolvency.score >= 0.9)
    return {
      state: "de_rezolvat" as LightState,
      reason: w("insolvency case as debtor", "dosar de insolvență ca debitor"),
      factIds: [insolvency.id],
    };
  if (defendant && defendantN > 0 && defendant.score >= 0.9)
    return {
      state: "atentie" as LightState,
      reason:
        defendantN === 1
          ? w("taken to court once in 3 years", "dată în judecată o dată în 3 ani")
          : w(
              `taken to court ${defendantN} times in 3 years`,
              `dată în judecată de ${defendantN} ori în 3 ani`,
            ),
      factIds: [defendant.id],
    };
  if (insolvency || (defendant && defendantN > 0))
    // Matches below 0.9: never "Bine", never shown as adverse; the portal link decides.
    return {
      state: "neverificat" as LightState,
      reason: w(
        "uncertain match; check the portal",
        "potrivire nesigură; verifică la sursă",
        "uncertain match; check the portal",
        "potrivire nesigură; de verificat",
      ),
      factIds: [(insolvency ?? defendant)!.id],
    };
  if (!courts)
    return {
      state: "neverificat" as LightState,
      reason: w("courts not checked", "instanțe neverificate"),
      factIds: ids(identity),
    };
  return {
    state: "bine" as LightState,
    reason: w("no signals in what we checked", "fără semnale în ce am verificat"),
    factIds: ids(courts, identity),
  };
}

/** The five lines in their fixed order (owners: Bani, Clienți, Online, Echipă, Risc; others: Risc first). */
export function computeLights(facts: Fact[], ctx: LightsContext): AreaLight[] {
  const r = readFacts(facts);
  const pick = (x: Wording) => (ctx.audience === "owner" ? x.owner : x.third);
  const make = (area: AreaLight["area"], label: Bilingual, out: LineOut): AreaLight => ({
    area,
    label,
    state: out.state,
    reason: pick(out.reason),
    factIds: out.factIds,
    ...(out.note ? { note: pick(out.note) } : {}),
  });
  const lines = {
    bani: make("bani", LABELS.bani, bani(r)),
    clienti: make("clienti", VOCAB[ctx.vocab].words.line, clienti(r, ctx.vocab)),
    online: make("online", LABELS.online, online(r)),
    echipa: make("echipa", LABELS.echipa, echipa(r)),
    risc: make("risc", LABELS.risc, risc(r)),
  };
  // A client or supplier checks the risk first, then the money and the team; the owner's
  // marketing lines (customers, online) come last for them.
  const order: Array<keyof typeof lines> =
    ctx.audience === "owner"
      ? ["bani", "clienti", "online", "echipa", "risc"]
      : ["risc", "bani", "echipa", "online", "clienti"];
  return order.map((k) => lines[k]);
}

/** The order states are compared in: the worse state wins. */
export const STATE_SEVERITY: Record<LightState, number> = {
  de_rezolvat: 3,
  atentie: 2,
  neverificat: 1,
  bine: 0,
};

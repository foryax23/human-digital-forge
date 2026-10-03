import type {
  Action,
  AreaLight,
  Audience,
  Bilingual,
  Brief,
  BriefSection,
  CitedSentence,
  CompetitorCard,
  DeepReport,
  Fact,
  Finding,
  Gap,
  Lang,
  LightState,
  OwnerInputs,
  PlanTotals,
  Relationship,
  SectorVocabId,
  WebsiteStatus,
} from "../contracts";
import { bi } from "../parse/format";

/*
 * PROVISIONAL report logic, used by `finish` and `synthesis` until Eng 3's
 * src/lib/deep/report/index.ts (buildReportParts) lands; the dispatcher takes
 * the builder as a parameter, so switching is one line in deep.functions.ts.
 * It keeps the plan's rules (A8) at their simplest: the five lines, three
 * findings from official facts, legal must-dos and text-only actions (no
 * estimates in lei: those belong to Eng 3's money model), and sentence
 * templates for the rules-only brief, each citing its facts.
 */

export type ReportPartsInput = {
  facts: Fact[];
  gaps: Gap[];
  company: DeepReport["company"];
  relationship: Relationship;
  lang: Lang;
  peers?: DeepReport["peers"];
  competitors: CompetitorCard[];
  owner?: OwnerInputs;
};
export type ReportParts = {
  lights: AreaLight[];
  findings: Finding[];
  actions: Action[];
  totals: PlanTotals;
  headlineKey: string;
  rulesBrief: Brief;
  firm: "established" | "new";
  audience: Audience;
  vocab: SectorVocabId;
  registers: DeepReport["registers"];
  counts: DeepReport["counts"];
};
export type ReportBuilder = (input: ReportPartsInput) => ReportParts;

const VOCAB: Array<[SectorVocabId, (d: number) => boolean]> = [
  ["health", (d) => d === 86],
  ["beauty", (d) => d === 96],
  ["food", (d) => d === 56],
  ["accommodation", (d) => d === 55],
  ["retail", (d) => d === 47],
  ["b2b_wholesale", (d) => d === 46],
  ["manufacturing", (d) => d >= 10 && d <= 33],
  ["auto", (d) => d === 45],
  ["construction", (d) => d >= 41 && d <= 43],
  ["transport", (d) => d >= 49 && d <= 53],
  ["it", (d) => d === 62 || d === 63],
  ["professional", (d) => d >= 69 && d <= 74],
];

export function vocabId(caen?: string): SectorVocabId {
  const d = Number((caen ?? "").slice(0, 2));
  return VOCAB.find(([, test]) => test(d))?.[0] ?? "generic";
}

export const SECTOR_WORDS: Record<
  SectorVocabId,
  { client: string; clients: string; booking: string; line: Bilingual }
> = {
  health: {
    client: "pacient",
    clients: "pacienți",
    booking: "programare",
    line: bi("Patients", "Pacienți"),
  },
  beauty: {
    client: "clientă",
    clients: "cliente și clienți",
    booking: "programare",
    line: bi("Clients", "Clienți"),
  },
  food: {
    client: "client",
    clients: "clienți sau oaspeți",
    booking: "rezervare",
    line: bi("Guests", "Clienți"),
  },
  accommodation: {
    client: "oaspete",
    clients: "oaspeți",
    booking: "rezervare",
    line: bi("Guests", "Oaspeți"),
  },
  retail: {
    client: "client",
    clients: "clienți",
    booking: "comandă",
    line: bi("Customers", "Clienți"),
  },
  b2b_wholesale: {
    client: "client",
    clients: "clienți",
    booking: "cerere de ofertă",
    line: bi("Customers", "Clienți"),
  },
  manufacturing: {
    client: "client sau distribuitor",
    clients: "clienți și distribuitori",
    booking: "comandă",
    line: bi("Customers", "Clienți"),
  },
  auto: {
    client: "client",
    clients: "clienți",
    booking: "programare la service",
    line: bi("Customers", "Clienți"),
  },
  construction: {
    client: "client",
    clients: "clienți",
    booking: "cerere de ofertă",
    line: bi("Customers", "Clienți"),
  },
  transport: {
    client: "client",
    clients: "clienți",
    booking: "cerere de ofertă",
    line: bi("Customers", "Clienți"),
  },
  it: {
    client: "client",
    clients: "clienți",
    booking: "proiect",
    line: bi("Customers", "Clienți"),
  },
  professional: {
    client: "client",
    clients: "clienți",
    booking: "întâlnire",
    line: bi("Clients", "Clienți"),
  },
  generic: {
    client: "client",
    clients: "clienți",
    booking: "cerere",
    line: bi("Customers", "Clienți"),
  },
};

const BOOKING_SECTORS: SectorVocabId[] = ["health", "beauty", "food", "accommodation", "auto"];

const byId = (facts: Fact[]) => new Map(facts.map((f) => [f.id, f]));
const latestOf = (facts: Fact[], predicate: string) =>
  facts
    .filter((f) => f.predicate === predicate && /\.(\d{4})$/.test(f.id))
    .sort((a, b) => b.id.localeCompare(a.id))[0];

/** Third-person wording of the line reasons, for someone checking the company (D9). */
export function thirdPerson(text: Bilingual): Bilingual {
  return {
    ro: text.ro
      .replace(/nu îți rămâne/g, "nu rămâne")
      .replace(/îți rămân/g, "rămân")
      .replace(/îți rămâne/g, "rămâne")
      .replace(/încă nu ai bilanț depus/g, "încă nu are bilanț depus")
      .replace(/verifică la sursă/g, "de verificat la sursă")
      .replace(/te găsesc ușor/g, "ușor de contactat")
      .replace(/^angajezi$/g, "angajează"),
    en: text.en
      .replace(/you keep/g, "keeps")
      .replace(/you are hiring/g, "hiring")
      .replace(/check at the source/g, "to be checked at the source")
      .replace(/easy to reach/g, "easy to reach"),
  };
}

/** "îți rămân 9 lei din 100" (kept per 100 lei invoiced, before tax). */
function keptText(kept: number): Bilingual {
  if (kept <= 0)
    return bi(
      "nothing left of every 100 lei, before tax",
      "nu îți rămâne nimic din 100 de lei, înainte de impozit",
    );
  if (kept === 1) return bi("you keep 1 leu of every 100", "îți rămâne un leu din 100");
  return bi(`you keep ${kept} lei of every 100`, `îți rămân ${kept} lei din 100`);
}

const light = (
  area: AreaLight["area"],
  label: Bilingual,
  state: LightState,
  reason: Bilingual,
  factIds: string[],
): AreaLight => ({
  area,
  label,
  state,
  reason,
  factIds,
});

export function provisionalLights(facts: Fact[], vocab: SectorVocabId): AreaLight[] {
  const f = byId(facts);
  const lights: AreaLight[] = [];
  // Bani
  const filedFact = f.get("money.filed");
  const filedValue = filedFact?.value as { filed?: boolean | null; years?: number[] } | undefined;
  const filed = filedValue?.filed;
  const net = latestOf(facts, "money.profit_net");
  const margin = latestOf(facts, "money.margin_pretax");
  const profitChange = f.get("money.profit_change");
  const marginBand = f.get("peers.band.marginPretax")?.value as
    | { p25: number; p50: number; you?: number }
    | undefined;
  const latestYear = Math.max(0, ...(filedValue?.years ?? []));
  const yearValue = (predicate: string) =>
    f.get(`${predicate}.${latestYear}`)?.value as number | undefined;
  const dormant =
    filed === true &&
    latestYear > 0 &&
    !yearValue("money.turnover") &&
    !yearValue("money.revenue_total") &&
    !yearValue("money.expenses") &&
    !yearValue("people.employees");
  const kept = margin ? Math.round((margin.value as number) * 100) : undefined;
  const bani = (state: LightState, reason: Bilingual, ids: Array<string | undefined>) =>
    lights.push(
      light(
        "bani",
        bi("Money", "Bani"),
        state,
        reason,
        ids.filter((x): x is string => Boolean(x)),
      ),
    );
  if (filed === false) {
    bani("neverificat", bi("no annual accounts filed yet", "încă nu ai bilanț depus"), [
      "money.filed",
    ]);
  } else if (filed === null) {
    bani(
      "neverificat",
      bi("ANAF did not answer; check at the source", "ANAF nu a răspuns; verifică la sursă"),
      ["money.filed"],
    );
  } else if (filed !== true) {
    // The money step did not run or did not finish: nothing is concluded.
    bani("neverificat", bi("annual accounts not checked", "bilanțul nu a fost verificat"), []);
  } else if (dormant) {
    bani(
      "atentie",
      bi(`no activity in the ${latestYear} accounts`, `fără activitate în bilanțul ${latestYear}`),
      [f.has(`money.turnover.${latestYear}`) ? `money.turnover.${latestYear}` : "money.filed"],
    );
  } else if (net && (net.value as number) < 0) {
    bani("de_rezolvat", bi("net loss in the latest year", "pierdere în ultimul an"), [net.id]);
  } else if (
    (marginBand?.you !== undefined && marginBand.you < marginBand.p50) ||
    (profitChange && ((profitChange.value as { ratio: number }).ratio ?? 0) < -0.1) ||
    (kept !== undefined && kept <= 0)
  ) {
    bani("atentie", kept !== undefined ? keptText(kept) : bi("profit fell", "profitul a scăzut"), [
      margin?.id,
      profitChange?.id,
    ]);
  } else if (kept !== undefined) {
    bani("bine", keptText(kept), [margin?.id]);
  } else if (net && (net.value as number) > 0) {
    bani("bine", bi("profitable", "pe profit"), [net.id]);
  } else if (net) {
    bani("atentie", bi("no profit in the latest year", "fără profit în ultimul an"), [net.id]);
  } else {
    bani("neverificat", bi("profit not found in the accounts", "profitul nu apare în bilanț"), [
      "money.filed",
    ]);
  }
  // Clienți
  const status = f.get("site.status")?.value as WebsiteStatus | undefined;
  const contact = f.get("site.contact.present");
  const booking = f.get("site.booking.present");
  const words = SECTOR_WORDS[vocab];
  if (!status || ["none", "parked", "dead", "unreachable", "blocked"].includes(status)) {
    lights.push(
      light(
        "clienti",
        words.line,
        "neverificat",
        bi("no website to check", "niciun site de verificat"),
        ["site.status"],
      ),
    );
  } else if (contact && contact.value === false) {
    lights.push(
      light(
        "clienti",
        words.line,
        "de_rezolvat",
        bi("no way to contact found", "nu am găsit o cale de contact"),
        [contact.id],
      ),
    );
  } else if (BOOKING_SECTORS.includes(vocab) && booking && booking.value === false) {
    lights.push(
      light(
        "clienti",
        words.line,
        "atentie",
        bi(`no online ${words.booking} found`, `nu am găsit ${words.booking} online`),
        [booking.id],
      ),
    );
  } else {
    lights.push(
      light("clienti", words.line, "bine", bi("easy to reach", "te găsesc ușor"), [
        contact?.id ?? "site.status",
      ]),
    );
  }
  // Online
  const important = f.get("site.audit.important");
  const cui = f.get("site.cui.present");
  if (status && ["parked", "dead", "broken_certificate"].includes(status)) {
    lights.push(
      light(
        "online",
        bi("Online", "Online"),
        "de_rezolvat",
        {
          parked: bi("domain parked or for sale", "domeniu parcat sau de vânzare"),
          dead: bi("the domain does not work", "domeniul nu funcționează"),
          broken_certificate: bi("broken security certificate", "certificat de securitate invalid"),
        }[status as "parked" | "dead" | "broken_certificate"],
        ["site.status"],
      ),
    );
  } else if (!status || status === "none" || status === "unreachable" || status === "blocked") {
    lights.push(
      light(
        "online",
        bi("Online", "Online"),
        "atentie",
        bi("no company website found", "nu am găsit un site al firmei"),
        ["site.status"],
      ),
    );
  } else if ((important && (important.value as number) > 0) || (cui && cui.value === false)) {
    lights.push(
      light(
        "online",
        bi("Online", "Online"),
        "atentie",
        cui && cui.value === false
          ? bi("tax code not found on the site", "CUI-ul nu apare pe site")
          : important!.value === 1
            ? bi("1 important issue", "o problemă importantă")
            : bi(`${important!.value} important issues`, `${important!.value} probleme importante`),
        [cui && cui.value === false ? cui.id : important!.id],
      ),
    );
  } else {
    lights.push(
      light(
        "online",
        bi("Online", "Online"),
        "bine",
        bi("the website works", "site-ul funcționează"),
        [important?.id ?? "site.status"],
      ),
    );
  }
  // Echipă
  const staff = latestOf(facts, "people.employees");
  const staffChange = f.get("people.employees_change");
  const hiring = f.get("people.hiring");
  if (!staff) {
    lights.push(
      light(
        "echipa",
        bi("Team", "Echipă"),
        "neverificat",
        bi("no headcount filed", "număr de salariați nedeclarat"),
        [],
      ),
    );
  } else if (staffChange && (staffChange.value as { ratio: number }).ratio <= -0.3) {
    const v = staffChange.value as { from: number; to: number };
    lights.push(
      light(
        "echipa",
        bi("Team", "Echipă"),
        "atentie",
        bi(`staff ${v.from} → ${v.to}`, `salariați ${v.from} → ${v.to}`),
        [staffChange.id],
      ),
    );
  } else if (hiring && hiring.value === true) {
    lights.push(
      light("echipa", bi("Team", "Echipă"), "bine", bi("you are hiring", "angajezi"), [
        hiring.id,
        staff.id,
      ]),
    );
  } else {
    const n = staff.value as number;
    lights.push(
      light(
        "echipa",
        bi("Team", "Echipă"),
        "bine",
        n === 1 ? bi("1 employee", "un salariat") : bi(`${n} employees`, `${n} salariați`),
        [staff.id],
      ),
    );
  }
  // Risc
  const identity = f.get("identity.status");
  const insolvency = f.get("risk.courts.insolvency_debtor");
  const defendant = f.get("risk.courts.as_defendant");
  const courts = f.get("risk.courts.checked");
  const risc = (state: LightState, reason: Bilingual, ids: string[]) =>
    lights.push(light("risc", bi("Risk", "Risc"), state, reason, ids));
  if (identity && identity.value === "radiat") {
    risc("de_rezolvat", bi("struck off the register", "radiată din registru"), [identity.id]);
  } else if (identity && identity.value !== "activ") {
    risc("de_rezolvat", bi("inactive at ANAF", "inactivă la ANAF"), [identity.id]);
  } else if (insolvency && insolvency.score >= 0.9) {
    risc("de_rezolvat", bi("insolvency case as debtor", "dosar de insolvență ca debitor"), [
      insolvency.id,
    ]);
  } else if (defendant && (defendant.value as number) > 0 && defendant.score >= 0.9) {
    risc(
      "atentie",
      bi(
        `taken to court ${defendant.value} times in 3 years`,
        `dată în judecată de ${defendant.value} ori în 3 ani`,
      ),
      [defendant.id],
    );
  } else if (insolvency || (defendant && (defendant.value as number) > 0)) {
    // Cases matched below 0.9: never "Bine", never shown as adverse; the portal link decides.
    risc(
      "neverificat",
      bi("uncertain match; check at the source", "potrivire nesigură; verifică la sursă"),
      [(insolvency ?? defendant)!.id],
    );
  } else if (!courts) {
    risc(
      "neverificat",
      bi("courts not checked", "instanțe neverificate"),
      identity ? [identity.id] : [],
    );
  } else {
    risc("bine", bi("no signals in what we checked", "fără semnale în ce am verificat"), [
      courts.id,
      ...(identity ? [identity.id] : []),
    ]);
  }
  return lights;
}

const sentence = (text: string, factIds: string[]): CitedSentence => ({ text, factIds });
const section = (sentences: CitedSentence[]): BriefSection => ({ source: "rules", sentences });

function findingsFrom(facts: Fact[], lang: Lang): Finding[] {
  const f = byId(facts);
  const out: Finding[] = [];
  const turnover = latestOf(facts, "money.turnover");
  const growth = f.get("money.growth_turnover");
  if (turnover) {
    const year = turnover.id.slice(-4);
    out.push({
      id: "finding.turnover",
      figure: turnover.short ?? turnover.display,
      sentence: growth
        ? bi(
            `Turnover in ${year}, ${growth.display.en} on the year before.`,
            `Cifra de afaceri în ${year}, ${growth.display.ro} față de anul anterior.`,
          )
        : bi(`Turnover in ${year}.`, `Cifra de afaceri în ${year}.`),
      factIds: [turnover.id, ...(growth ? [growth.id] : [])],
      rank: 1,
    });
  }
  const margin = latestOf(facts, "money.margin_pretax");
  if (margin) {
    out.push({
      id: "finding.margin",
      figure: margin.display,
      sentence: margin.short ?? margin.display,
      factIds: [margin.id],
      rank: 2,
    });
  }
  const status = f.get("site.status");
  if (status && out.length < 3) {
    out.push({
      id: "finding.site",
      figure: status.display,
      sentence: status.display,
      factIds: [status.id],
      rank: out.length + 1,
    });
  }
  const rank = f.get("peers.rank.turnover");
  if (rank && out.length < 3) {
    out.push({
      id: "finding.peers",
      figure: rank.display,
      sentence: f.get("peers.band.turnover")?.display ?? rank.display,
      factIds: [rank.id],
      rank: out.length + 1,
    });
  }
  void lang;
  return out.slice(0, 3);
}

function actionsFrom(facts: Fact[], vocab: SectorVocabId): Action[] {
  const f = byId(facts);
  const out: Action[] = [];
  const cui = f.get("site.cui.present");
  const regNo = f.get("site.reg_no.present");
  if (cui && cui.value === false && (!regNo || regNo.value === false)) {
    out.push({
      id: "legal.company_details",
      title: bi(
        "Put the tax code and company details on the website",
        "Pune CUI-ul și datele firmei pe site",
      ),
      why: bi("Required by law (Law 365/2002)", "Obligatoriu prin lege (Legea 365/2002)"),
      mandatory: true,
      cost: { diyLei: 0, diyHours: 0.25 },
      who: "singur",
      firstEffect: bi("immediately", "imediat"),
      factIds: [cui.id],
      rank: 0,
    });
  }
  const status = f.get("site.status")?.value as WebsiteStatus | undefined;
  if (status && ["parked", "dead", "broken_certificate"].includes(status)) {
    out.push({
      id: "site.fix_domain",
      title:
        status === "broken_certificate"
          ? bi("Renew the security certificate", "Reînnoiește certificatul de securitate")
          : bi(
              "Move off the parked or dead domain",
              "Mută site-ul de pe domeniul parcat sau nefuncțional",
            ),
      why: bi(
        "Customers see an error or a for-sale page",
        "Clienții văd o eroare sau «domeniu de vânzare»",
      ),
      mandatory: false,
      comparison: bi(
        "Customers see an error or a for-sale page",
        "Clienții văd o eroare sau «domeniu de vânzare»",
      ),
      cost: {},
      who: "cu_vortex",
      firstEffect: bi("in the first week", "din prima săptămână"),
      factIds: ["site.status"],
      rank: 1,
    });
  }
  const consent = f.get("site.consent.before_analytics");
  if (consent && consent.value === true) {
    out.push({
      id: "site.cookie_consent",
      title: bi(
        "Ask for consent before visitor statistics",
        "Cere acordul înainte de statisticile despre vizitatori",
      ),
      why: bi(
        "Probably not compliant with cookie rules; check with a specialist",
        "Probabil neconform cu regulile privind cookie-urile; de verificat cu un specialist",
      ),
      mandatory: false,
      comparison: bi(
        "Probably not compliant with cookie rules",
        "Probabil neconform cu regulile privind cookie-urile",
      ),
      cost: {},
      who: "cu_vortex",
      firstEffect: bi("immediately", "imediat"),
      factIds: [consent.id],
      rank: 2,
    });
  }
  const booking = f.get("site.booking.present");
  if (BOOKING_SECTORS.includes(vocab) && booking && booking.value === false) {
    const words = SECTOR_WORDS[vocab];
    out.push({
      id: "clients.online_booking",
      title: bi(
        `Online ${words.booking}`,
        `${words.booking[0].toUpperCase()}${words.booking.slice(1)} online`,
      ),
      why: booking.display,
      mandatory: false,
      comparison: bi(
        "Customers can book outside working hours",
        "Clienții pot face o programare și în afara programului",
      ),
      cost: {},
      who: "cu_vortex",
      firstEffect: bi("from month 2", "din luna 2"),
      factIds: [booking.id],
      rank: 3,
    });
  }
  const google = f.get("presence.google_profile_linked");
  if (google && google.value === false) {
    out.push({
      id: "presence.google_profile",
      title: bi(
        "Claim or complete the Google profile",
        "Revendică sau completează profilul Google",
      ),
      why: google.display,
      mandatory: false,
      comparison: bi(
        "You appear with correct details in Google searches and Maps",
        "Apari cu datele corecte în căutările Google și pe hartă",
      ),
      cost: { diyLei: 0, diyHours: 1 },
      who: "singur",
      firstEffect: bi("in a few weeks", "în câteva săptămâni"),
      factIds: [google.id],
      rank: 4,
    });
  }
  return out;
}

function briefFrom(
  input: ReportPartsInput,
  parts: { lights: AreaLight[]; findings: Finding[]; audience: Audience; vocab: SectorVocabId },
): Brief {
  const { lang } = input;
  const f = byId(input.facts);
  const t = (b: Bilingual) => b[lang];
  const owner = parts.audience === "owner";
  const bani = parts.lights.find((l) => l.area === "bani")!;
  const risc = parts.lights.find((l) => l.area === "risc")!;
  const worst =
    [bani, risc].find((l) => l.state === "de_rezolvat") ??
    [bani, risc].find((l) => l.state === "atentie");
  const name = input.company.displayName;
  const headline = worst
    ? sentence(
        lang === "ro"
          ? `${owner ? "Firma ta" : name}: ${worst.reason.ro}.`
          : `${owner ? "Your company" : name}: ${worst.reason.en}.`,
        worst.factIds,
      )
    : sentence(
        lang === "ro"
          ? `${owner ? "Firma ta" : name}: ${bani.reason.ro}; ${risc.reason.ro}.`
          : `${owner ? "Your company" : name}: ${bani.reason.en}; ${risc.reason.en}.`,
        [...bani.factIds, ...risc.factIds],
      );
  const meaning: CitedSentence[] = parts.lights
    .filter((l) => l.factIds.length)
    .slice(0, 3)
    .map((l) => sentence(`${t(l.label)}: ${t(l.reason)}.`, l.factIds));
  const findings = parts.findings.map((fd) =>
    section([sentence(`${t(fd.figure)}: ${t(fd.sentence).replace(/\.$/, "")}.`, fd.factIds)]),
  );
  const customer: CitedSentence[] = [];
  const status = f.get("site.status");
  if (status) customer.push(sentence(`${t(status.display)}.`, [status.id]));
  for (const id of ["site.contact.present", "site.booking.present", "site.cui.present"]) {
    const x = f.get(id);
    if (x) customer.push(sentence(`${t(x.display)}.`, [x.id]));
  }
  const rivals: CitedSentence[] = input.facts
    .filter((x) => x.predicate === "peers.rival")
    .slice(0, 3)
    .map((x) => sentence(`${t(x.display)}.`, [x.id]));
  if (!rivals.length) {
    const gapped = input.gaps.find((g) => g.section === "peers");
    if (gapped) rivals.push(sentence(`${t(gapped.where)}.`, []));
  }
  return {
    lang,
    audience: parts.audience,
    headline: section([headline]),
    meaning: section(meaning),
    findings,
    customerView: section(customer.slice(0, 3)),
    rivals: section(rivals),
    cut: { kept: 0, byCode: 0, byEntailment: 0 },
  };
}

const OFFICIAL_SOURCES = new Set(["anaf_v9", "anaf_bilant", "mf_bulk", "onrc", "courts", "ted"]);

export const provisionalReportParts: ReportBuilder = (input) => {
  const audience: Audience =
    input.relationship === "proprietar" || input.relationship === "angajat"
      ? "owner"
      : "third_party";
  // "new" only when ANAF answered for every year and none was filed (money.filed false);
  // unanswered years (null) or a missing money step never make a firm "new".
  const filed = (
    input.facts.find((f) => f.id === "money.filed")?.value as { filed?: boolean | null } | undefined
  )?.filed;
  const vocab = vocabId(input.company.caen2 ?? input.company.caen3);
  const ownerLights = provisionalLights(input.facts, vocab);
  const lights =
    audience === "owner"
      ? ownerLights
      : ownerLights.map((l) => ({ ...l, reason: thirdPerson(l.reason) }));
  const findings = findingsFrom(input.facts, input.lang);
  const actions = audience === "owner" ? actionsFrom(input.facts, vocab) : [];
  const courtsChecked = input.facts.some((f) => f.id === "risk.courts.checked");
  const tedChecked = input.facts.some((f) => f.id === "risk.ted.awards");
  const checked: Bilingual[] = [
    bi("ANAF (status, VAT)", "ANAF (stare, TVA)"),
    bi("Annual accounts (Ministry of Finance)", "Bilanțuri (Ministerul Finanțelor)"),
  ];
  if (courtsChecked)
    checked.push(bi("Court portal (portal.just.ro)", "Portalul instanțelor (portal.just.ro)"));
  if (tedChecked) checked.push(bi("EU tenders (TED)", "Licitații europene (TED)"));
  const pagesRead = input.facts
    .filter((f) => f.predicate === "site.pages_read")
    .reduce((n, f) => n + (f.value as number), 0);
  return {
    lights,
    findings,
    actions,
    totals: {},
    headlineKey: lights.find((l) => (l.area === "bani" || l.area === "risc") && l.state !== "bine")
      ? "problem"
      : "positive",
    rulesBrief: briefFrom(input, { lights, findings, audience, vocab }),
    firm: filed === false ? "new" : "established",
    audience,
    vocab,
    registers: {
      checked,
      notChecked: [
        {
          name: bi("Tax debts (ANAF)", "Datorii la stat (ANAF)"),
          link: "https://www.anaf.ro/restante/",
        },
        {
          name: bi("Insolvency bulletin (BPI)", "Buletinul procedurilor de insolvență (BPI)"),
          link: "https://www.onrc.ro/index.php/ro/bpi",
        },
        {
          name: bi("Movable assets register (RNPM)", "Arhiva electronică de garanții (RNPM)"),
          link: "https://www.rnpm.ro",
        },
      ],
    },
    counts: {
      officialSources: new Set(
        input.facts.map((f) => f.source).filter((s) => OFFICIAL_SOURCES.has(s)),
      ).size,
      pagesRead,
      facts: input.facts.length,
      estimates: input.facts.filter((f) => f.confidence === "estimare").length,
    },
  };
};

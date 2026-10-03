import type {
  Action,
  Bilingual,
  BriefSection,
  CitedSentence,
  CompetitorCard,
  Confidence,
  DeepReport,
  Estimate,
  Fact,
  FactMethod,
  FactValue,
  Finding,
  Gap,
  Lang,
  Relationship,
  SectionId,
  SourceId,
  SourceRef,
  WebsiteStatus,
} from "@/lib/deep/contracts";
import { bi, lei, leiShort, pct } from "@/lib/deep/parse/format";
import { SOURCE_LABELS, SOURCE_URLS } from "@/lib/deep/parse/labels";

import { buildReportParts } from "@/lib/deep/report";

import type { DemoSector } from "./demo-keys";

/*
 * Sample reports for /scan/deep?demo=… : FICTIONAL companies only, labelled "Exemplu cu o
 * firmă inventată" on every screen. CUIs fail the checksum (no real firm can have them),
 * websites use the reserved ".example" domain and every figure is made up. The lines are
 * computed from the facts by the same code as a live run, so the sample cannot contradict
 * itself. Used by the public sample (?demo=exemplu&sector=…) and the screenshot states.
 */

export { DEMO_SECTORS, type DemoSector } from "./demo-keys";
export type DemoVariant = "ai" | "rules" | "partial" | "third" | "new";

const DAY = "2026-10-03";
const AT = `${DAY}T09:41:00.000Z`;
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

type Series = { turnover: number[]; pretax: number[]; net: number[]; staff: number[] };

type SectorSpec = {
  key: DemoSector;
  cui: string;
  name: string;
  displayName: string;
  regNo: string;
  caen: string;
  activity: Bilingual;
  city: string;
  county: string;
  site: { host: string; status: WebsiteStatus };
  series: Series;
  receivables: number;
  site_: {
    pages: number;
    cui: boolean;
    booking: boolean;
    contact: boolean;
    hiring: boolean;
    important: number;
    minor: number;
    ok: number;
    speedS?: number;
    consentBeforeAnalytics: boolean;
    shop?: boolean;
  };
  courts: { plaintiff: number; defendant: number; checked: boolean };
  ted: number;
  peers: {
    n: number;
    scope: "oras" | "judet" | "national";
    scopeLabel: Bilingual;
    band: [number, number];
    margin: [number, number, number];
    turnover: [number, number, number];
    employees: [number, number, number];
    growth: [number, number, number];
    days: [number, number, number];
  };
  rivals: Array<Omit<CompetitorCard, "factIds" | "whyChosen" | "origin">>;
};

const SECTORS: Record<DemoSector, SectorSpec> = {
  sanatate: {
    key: "sanatate",
    cui: "12345670",
    name: "CLINICA DENTARĂ EXEMPLU S.R.L.",
    displayName: "Clinica Dentară Exemplu SRL",
    regNo: "J35/0000/2015",
    caen: "8623",
    activity: bi("Dental practice activities", "Activități de asistență stomatologică"),
    city: "Timișoara",
    county: "Timiș",
    site: { host: "clinica-dentara.example", status: "verified" },
    series: {
      turnover: [2104300, 1861900, 2398400, 2947100, 3402600, 3821500, 4620800],
      pretax: [301000, 212400, 365900, 498200, 336900, 439500, 471300],
      net: [270900, 191200, 329300, 448400, 302900, 395500, 424200],
      staff: [9, 9, 11, 12, 14, 15, 16],
    },
    receivables: 380000,
    site_: {
      pages: 14,
      cui: false,
      booking: false,
      contact: true,
      hiring: true,
      important: 2,
      minor: 7,
      ok: 61,
      speedS: 3.8,
      consentBeforeAnalytics: false,
    },
    courts: { plaintiff: 2, defendant: 0, checked: true },
    ted: 0,
    peers: {
      n: 37,
      scope: "judet",
      scopeLabel: bi("in Timiș county", "din Timiș"),
      band: [1540000, 13860000],
      margin: [0.12, 0.18, 0.26],
      turnover: [1900000, 3100000, 5200000],
      employees: [6, 11, 19],
      growth: [0.12, 0.31, 0.55],
      days: [12, 24, 41],
    },
    rivals: [
      {
        cui: "22222220",
        name: "Dent Estet Exemplu SRL",
        city: "Timișoara",
        turnover: 5104000,
        turnoverPrev: 4312000,
        profitPretax: 1071000,
        employees: 18,
        website: "https://dent-estet.example",
        siteVerified: true,
        booking: true,
        importantIssues: 0,
        betterAt: bi(
          "online booking on the site; keeps 21 lei of every 100",
          "programare online pe site; păstrează 21 de lei din 100",
        ),
      },
      {
        cui: "33333330",
        name: "Zâmbet Clinic Exemplu SRL",
        city: "Timișoara",
        turnover: 3918000,
        turnoverPrev: 3650000,
        profitPretax: 744000,
        employees: 12,
        website: "https://zambet-clinic.example",
        siteVerified: true,
        booking: true,
        importantIssues: 1,
        betterAt: bi(
          "online booking; keeps 19 lei of every 100",
          "programare online; păstrează 19 lei din 100",
        ),
      },
      {
        cui: "44444440",
        name: "Ortodent Exemplu SRL",
        city: "Dumbrăvița",
        turnover: 2716000,
        turnoverPrev: 2480000,
        profitPretax: 380000,
        employees: 9,
        website: "https://ortodent.example",
        siteVerified: true,
        booking: false,
        importantIssues: 0,
        betterAt: bi("no important issues on its website", "nicio problemă importantă pe site"),
      },
    ],
  },
  restaurant: {
    key: "restaurant",
    cui: "12345671",
    name: "BISTRO EXEMPLU S.R.L.",
    displayName: "Bistro Exemplu SRL",
    regNo: "J35/0001/2012",
    caen: "5610",
    activity: bi("Restaurants", "Restaurante"),
    city: "Timișoara",
    county: "Timiș",
    site: { host: "bistro.example", status: "verified" },
    series: {
      turnover: [1520000, 890000, 1210000, 1980000, 2105000, 1850000, 1630000],
      pretax: [98000, -120000, 15000, 168000, 121000, 32000, -52000],
      net: [88000, -120000, 12000, 150000, 104000, 24000, -52000],
      staff: [18, 11, 12, 15, 14, 12, 8],
    },
    receivables: 41000,
    site_: {
      pages: 9,
      cui: true,
      booking: false,
      contact: true,
      hiring: false,
      important: 1,
      minor: 5,
      ok: 58,
      speedS: 4.6,
      consentBeforeAnalytics: true,
    },
    courts: { plaintiff: 0, defendant: 0, checked: true },
    ted: 0,
    peers: {
      n: 14,
      scope: "oras",
      scopeLabel: bi("in Timișoara", "din Timișoara"),
      band: [540000, 4890000],
      margin: [0.02, 0.06, 0.11],
      turnover: [880000, 1450000, 2600000],
      employees: [7, 11, 18],
      growth: [-0.08, 0.06, 0.21],
      days: [3, 6, 11],
    },
    rivals: [
      {
        cui: "22222220",
        name: "Trattoria Exemplu SRL",
        city: "Timișoara",
        turnover: 2240000,
        turnoverPrev: 2010000,
        profitPretax: 201000,
        employees: 13,
        website: "https://trattoria.example",
        siteVerified: true,
        booking: true,
        betterAt: bi(
          "online reservations; turnover up 11%",
          "rezervare online; cifra de afaceri +11%",
        ),
      },
      {
        cui: "33333330",
        name: "Casa Exemplu SRL",
        city: "Timișoara",
        turnover: 1710000,
        turnoverPrev: 1690000,
        profitPretax: 120000,
        employees: 10,
        website: "https://casa.example",
        siteVerified: true,
        booking: true,
        betterAt: bi("online reservations on the site", "rezervare online pe site"),
      },
      {
        cui: "44444440",
        name: "Bucătăria Exemplu SRL",
        city: "Timișoara",
        turnover: 1320000,
        turnoverPrev: 1180000,
        profitPretax: 96000,
        employees: 9,
        betterAt: bi("profitable in 2025", "pe profit în 2025"),
      },
    ],
  },
  constructii: {
    key: "constructii",
    cui: "12345672",
    name: "CONSTRUCT EXEMPLU S.R.L.",
    displayName: "Construct Exemplu SRL",
    regNo: "J02/0002/2008",
    caen: "4120",
    activity: bi(
      "Construction of residential and non-residential buildings",
      "Lucrări de construcții a clădirilor rezidențiale și nerezidențiale",
    ),
    city: "Arad",
    county: "Arad",
    site: { host: "construct.example", status: "parked" },
    series: {
      turnover: [3120000, 3480000, 4210000, 5390000, 6120000, 7050000, 8410000],
      pretax: [280000, 301000, 422000, 518000, 590000, 640000, 757000],
      net: [236000, 255000, 357000, 438000, 498000, 541000, 640000],
      staff: [22, 23, 25, 27, 29, 30, 31],
    },
    receivables: 1704000,
    site_: {
      pages: 0,
      cui: false,
      booking: false,
      contact: false,
      hiring: false,
      important: 0,
      minor: 0,
      ok: 0,
      consentBeforeAnalytics: true,
    },
    courts: { plaintiff: 4, defendant: 1, checked: true },
    ted: 3,
    peers: {
      n: 52,
      scope: "judet",
      scopeLabel: bi("in Arad county", "din Arad"),
      band: [2800000, 25200000],
      margin: [0.05, 0.09, 0.14],
      turnover: [3400000, 6100000, 11800000],
      employees: [14, 26, 48],
      growth: [0.08, 0.29, 0.61],
      days: [38, 52, 61],
    },
    rivals: [
      {
        cui: "22222220",
        name: "Zidar Exemplu SRL",
        city: "Arad",
        turnover: 9120000,
        turnoverPrev: 8300000,
        profitPretax: 1040000,
        employees: 34,
        website: "https://zidar.example",
        siteVerified: true,
        betterAt: bi("a working website with a quote form", "site funcțional, cu cerere de ofertă"),
      },
      {
        cui: "33333330",
        name: "Fundația Exemplu Construct SRL",
        city: "Vladimirescu",
        turnover: 7480000,
        turnoverPrev: 7100000,
        profitPretax: 820000,
        employees: 28,
        website: "https://fundatia.example",
        siteVerified: true,
        betterAt: bi("collects in 41 days", "încasează în 41 de zile"),
      },
      {
        cui: "44444440",
        name: "Acoperiș Exemplu SRL",
        city: "Arad",
        turnover: 5910000,
        turnoverPrev: 5200000,
        profitPretax: 610000,
        employees: 24,
        betterAt: bi("turnover up 14%", "cifra de afaceri +14%"),
      },
    ],
  },
  comert: {
    key: "comert",
    cui: "12345673",
    name: "MAGAZIN EXEMPLU S.R.L.",
    displayName: "Magazin Exemplu SRL",
    regNo: "J12/0003/2017",
    caen: "4771",
    activity: bi("Retail sale of clothing", "Comerț cu amănuntul al îmbrăcămintei"),
    city: "Cluj-Napoca",
    county: "Cluj",
    site: { host: "magazin.example", status: "verified" },
    series: {
      turnover: [640000, 710000, 980000, 1240000, 1390000, 1520000, 1710000],
      pretax: [52000, 61000, 120000, 171000, 190000, 208000, 239000],
      net: [47000, 55000, 108000, 154000, 171000, 187000, 215000],
      staff: [4, 4, 5, 6, 6, 7, 7],
    },
    receivables: 18000,
    site_: {
      pages: 21,
      cui: true,
      booking: true,
      contact: true,
      hiring: false,
      important: 3,
      minor: 9,
      ok: 55,
      speedS: 6.1,
      consentBeforeAnalytics: false,
      shop: true,
    },
    courts: { plaintiff: 0, defendant: 0, checked: false },
    ted: 0,
    peers: {
      n: 23,
      scope: "judet",
      scopeLabel: bi("in Cluj county", "din Cluj"),
      band: [570000, 5130000],
      margin: [0.04, 0.11, 0.17],
      turnover: [690000, 1210000, 2350000],
      employees: [3, 5, 9],
      growth: [0.02, 0.18, 0.39],
      days: [1, 4, 9],
    },
    rivals: [
      {
        cui: "22222220",
        name: "Butic Exemplu SRL",
        city: "Cluj-Napoca",
        turnover: 1980000,
        turnoverPrev: 1760000,
        profitPretax: 260000,
        employees: 8,
        website: "https://butic.example",
        siteVerified: true,
        shop: true,
        importantIssues: 0,
        betterAt: bi("site loads in 2.4 s on a phone", "site-ul se încarcă în 2,4 s pe telefon"),
      },
      {
        cui: "33333330",
        name: "Moda Exemplu SRL",
        city: "Florești",
        turnover: 1420000,
        turnoverPrev: 1390000,
        profitPretax: 130000,
        employees: 6,
        website: "https://moda.example",
        siteVerified: true,
        shop: true,
        importantIssues: 1,
        betterAt: bi(
          "fewer important issues on its site",
          "mai puține probleme importante pe site",
        ),
      },
      {
        cui: "44444440",
        name: "Stil Exemplu SRL",
        city: "Cluj-Napoca",
        turnover: 1090000,
        turnoverPrev: 980000,
        profitPretax: 98000,
        employees: 5,
        betterAt: bi("turnover up 11%", "cifra de afaceri +11%"),
      },
    ],
  },
};

/* ------------------------------------------------------------------ facts */

const OFFICIAL: SourceId[] = ["anaf_v9", "anaf_bilant", "mf_bulk", "onrc", "courts", "ted"];

function fact(
  id: string,
  section: SectionId,
  value: FactValue,
  display: Bilingual,
  source: SourceId,
  opts: {
    predicate?: string;
    asOf?: string;
    confidence?: Confidence;
    method?: FactMethod;
    short?: Bilingual;
    evidence?: Fact["evidence"];
    observed?: Fact["observed"];
    score?: number;
  } = {},
): Fact {
  return {
    id,
    section,
    predicate: opts.predicate ?? id.replace(/\.(19|20)\d{2}$/, "").replace(/\.\d{8}$/, ""),
    value,
    display,
    short: opts.short,
    source,
    asOf: opts.asOf ?? DAY,
    confidence: opts.confidence ?? "confirmat",
    score: opts.score ?? 1,
    method: opts.method ?? "api",
    evidence: opts.evidence,
    observed: opts.observed,
    gdpr: "G0",
  };
}

const ratioText = (r: number) => pct(r, 0);
const growthText = (r: number): Bilingual => {
  const p = pct(Math.abs(r), 0);
  return r >= 0 ? bi(`+${p.en}`, `+${p.ro}`) : bi(`−${p.en}`, `−${p.ro}`);
};

function moneyFacts(s: SectorSpec, firmNew: boolean): Fact[] {
  if (firmNew) {
    return [
      fact(
        "money.filed",
        "money",
        { filed: false, years: [] },
        bi("No annual accounts filed yet", "Încă nu are bilanț depus"),
        "anaf_bilant",
        {
          asOf: "FY2025",
        },
      ),
    ];
  }
  const out: Fact[] = [
    fact(
      "money.filed",
      "money",
      { filed: true, years: YEARS },
      bi("Filed for 2019–2025", "Depus pentru 2019–2025"),
      "anaf_bilant",
      { asOf: "FY2025" },
    ),
  ];
  YEARS.forEach((year, i) => {
    const fy = `FY${year}`;
    const { turnover, pretax, net, staff } = s.series;
    out.push(
      fact(`money.turnover.${year}`, "money", turnover[i], lei(turnover[i]), "anaf_bilant", {
        asOf: fy,
        short: leiShort(turnover[i]),
      }),
      fact(`money.profit_pretax.${year}`, "money", pretax[i], lei(pretax[i]), "anaf_bilant", {
        asOf: fy,
        short: leiShort(pretax[i]),
      }),
      fact(`money.profit_net.${year}`, "money", net[i], lei(net[i]), "anaf_bilant", {
        asOf: fy,
        short: leiShort(net[i]),
      }),
      fact(
        `money.expenses.${year}`,
        "money",
        turnover[i] - pretax[i],
        lei(turnover[i] - pretax[i]),
        "anaf_bilant",
        {
          asOf: fy,
          short: leiShort(turnover[i] - pretax[i]),
        },
      ),
      fact(
        `people.employees.${year}`,
        "people",
        staff[i],
        bi(String(staff[i]), String(staff[i])),
        "anaf_bilant",
        { asOf: fy },
      ),
      fact(
        `money.margin_pretax.${year}`,
        "money",
        pretax[i] / turnover[i],
        ratioText(pretax[i] / turnover[i]),
        "calc",
        {
          asOf: fy,
          confidence: "calculat",
          method: "derived",
        },
      ),
    );
  });
  const last = YEARS.length - 1;
  const t = s.series.turnover;
  const g3 = t[last] / t[last - 3] - 1;
  const g1 = t[last] / t[last - 1] - 1;
  const e3 = (t[last] - s.series.pretax[last]) / (t[last - 3] - s.series.pretax[last - 3]) - 1;
  const p1 = s.series.pretax[last - 1] ? s.series.pretax[last] / s.series.pretax[last - 1] - 1 : 0;
  const staffNow = s.series.staff[last];
  const staffPrev = s.series.staff[last - 1];
  out.push(
    fact(
      "money.growth_turnover",
      "money",
      { ratio: g1, from: 2024, to: 2025 },
      growthText(g1),
      "calc",
      { asOf: "FY2025", confidence: "calculat", method: "derived" },
    ),
    fact(
      "money.growth_turnover_3y",
      "money",
      { ratio: g3, from: 2022, to: 2025 },
      bi(`${growthText(g3).en} (2022–2025)`, `${growthText(g3).ro} (2022–2025)`),
      "calc",
      {
        asOf: "FY2025",
        confidence: "calculat",
        method: "derived",
      },
    ),
    fact(
      "money.expenses_vs_revenue",
      "money",
      { expenses: e3, revenue: g3 },
      bi(
        `expenses ${growthText(e3).en}, revenue ${growthText(g3).en} (2022–2025)`,
        `cheltuielile ${growthText(e3).ro}, veniturile ${growthText(g3).ro} (2022–2025)`,
      ),
      "calc",
      { asOf: "FY2025", confidence: "calculat", method: "derived" },
    ),
    fact("money.profit_change", "money", { ratio: p1 }, growthText(p1), "calc", {
      asOf: "FY2025",
      confidence: "calculat",
      method: "derived",
    }),
    fact("money.receivables.2025", "money", s.receivables, lei(s.receivables), "anaf_bilant", {
      asOf: "FY2025",
      short: leiShort(s.receivables),
    }),
    fact(
      "money.days_to_collect",
      "money",
      Math.round((s.receivables / t[last]) * 365),
      bi(
        `about ${Math.round((s.receivables / t[last]) * 365)} days`,
        `cam ${Math.round((s.receivables / t[last]) * 365)} de zile`,
      ),
      "calc",
      { asOf: "FY2025", confidence: "estimare", method: "derived" },
    ),
    fact(
      "people.employees_change",
      "people",
      { ratio: staffNow / staffPrev - 1, from: staffPrev, to: staffNow },
      bi(`${staffPrev} → ${staffNow}`, `${staffPrev} → ${staffNow}`),
      "calc",
      { asOf: "FY2025", confidence: "calculat", method: "derived" },
    ),
  );
  return out;
}

function siteFacts(s: SectorSpec): Fact[] {
  const url = `https://${s.site.host}`;
  const x = s.site_;
  const pagesRead = x.pages;
  const observed = { pagesRead };
  const abs = (yes: boolean, what: Bilingual): Bilingual =>
    yes
      ? bi("Yes", "Da")
      : bi(
          `Not found on the ${pagesRead} pages we read (${what.en})`,
          `Nu am găsit pe cele ${pagesRead} pagini citite (${what.ro})`,
        );
  const statusWord: Record<WebsiteStatus, Bilingual> = {
    // The engine's own wording (site.server.ts): proof can be the CUI, the J number or the
    // registry website, so the label never claims the CUI is on the site.
    verified: bi("Verified as the company's website", "Verificat: este site-ul firmei"),
    declared: bi("Declared", "Declarat"),
    ask_visitor: bi("Not confirmed", "Neconfirmat"),
    broken_certificate: bi("Broken certificate", "Certificat invalid"),
    parked: bi(`${s.site.host} is for sale`, `${s.site.host} este de vânzare`),
    dead: bi("Does not work", "Nu funcționează"),
    unreachable: bi("Did not answer", "Nu a răspuns"),
    blocked: bi("Blocks automated access", "Blochează accesul automat"),
    none: bi("No website found", "Nu am găsit un site"),
  };
  const out: Fact[] = [
    fact("site.url", "site", url, bi(s.site.host, s.site.host), "site", { method: "html" }),
    fact("site.status", "site", s.site.status, statusWord[s.site.status], "site", {
      method: "html",
      evidence:
        s.site.status === "parked" ? { url, quote: `${s.site.host} este de vânzare!` } : { url },
    }),
  ];
  if (s.site.status !== "verified") return out;
  out.push(
    fact("site.pages_read", "site", pagesRead, bi(String(pagesRead), String(pagesRead)), "site", {
      method: "html",
    }),
    fact("site.cui.present", "site", x.cui, abs(x.cui, bi("tax code", "CUI")), "site", {
      method: "html",
      observed,
      evidence: x.cui ? { url: `${url}/contact`, quote: `CUI ${s.cui}` } : undefined,
    }),
    fact(
      "site.contact.present",
      "site",
      x.contact,
      abs(x.contact, bi("phone or form", "telefon sau formular")),
      "site",
      {
        method: "html",
        observed,
        evidence: x.contact ? { url: `${url}/contact`, quote: "Telefon: 0256 000 000" } : undefined,
      },
    ),
    fact(
      "site.booking.present",
      "site",
      x.booking,
      abs(x.booking, bi("online booking", "programare online")),
      "site",
      {
        method: "html",
        observed,
      },
    ),
    fact(
      "site.audit.important",
      "site",
      x.important,
      bi(String(x.important), String(x.important)),
      "audit",
      { method: "html" },
    ),
    fact("site.audit.minor", "site", x.minor, bi(String(x.minor), String(x.minor)), "audit", {
      method: "html",
    }),
    fact("site.audit.ok", "site", x.ok, bi(String(x.ok), String(x.ok)), "audit", {
      method: "html",
    }),
    fact(
      "site.consent.before_analytics",
      "site",
      !x.consentBeforeAnalytics,
      x.consentBeforeAnalytics
        ? bi(
            "Consent is asked before visitor statistics",
            "Consimțământul e cerut înainte de statistici",
          )
        : bi(
            "Visitor statistics start before consent",
            "Statisticile despre vizitatori pornesc înainte de consimțământ",
          ),
      "audit",
      { method: "html" },
    ),
    fact("site.dns.mx", "site", true, bi("Yes", "Da"), "dns", { method: "api" }),
    fact("site.dns.dmarc", "site", false, bi("Missing", "Lipsește"), "dns", { method: "api" }),
    fact(
      "people.hiring",
      "people",
      x.hiring,
      x.hiring
        ? bi("Yes: a careers page", "Da: pagină de cariere")
        : abs(false, bi("jobs", "posturi")),
      "site",
      {
        method: "html",
        observed,
        evidence: x.hiring
          ? {
              url: `${url}/cariere`,
              quote: "Căutăm asistent(ă) medical(ă) pentru cabinetul din Timișoara",
            }
          : undefined,
      },
    ),
  );
  if (x.speedS) {
    const shown = x.speedS.toFixed(1);
    out.push(
      fact(
        "site.speed.mobile",
        "site",
        { performance: x.speedS > 5 ? 31 : 52, lcpMs: Math.round(x.speedS * 1000) },
        bi(
          `The main content appears after ${shown} s on a phone`,
          `Conținutul principal apare după ${shown.replace(".", ",")} s pe telefon`,
        ),
        "pagespeed",
        { method: "api" },
      ),
    );
  }
  out.push(
    fact(
      "presence.google_profile_linked",
      "presence",
      false,
      bi(
        `No Google profile linked from the ${pagesRead} pages we read`,
        `Nu am găsit un profil Google legat de pe cele ${pagesRead} pagini citite`,
      ),
      "site",
      { method: "html", observed },
    ),
  );
  if (x.shop)
    out.push(
      fact(
        "site.shop.present",
        "site",
        true,
        bi("Yes: an online shop", "Da: magazin online"),
        "site",
        { method: "html", observed },
      ),
    );
  out.push(
    fact(
      "offers.hours",
      "offers",
      "Luni–Vineri 9–20",
      bi("Mon–Fri 9–20", "Luni–Vineri 9–20"),
      "site",
      {
        method: "llm",
        confidence: "probabil",
        evidence: { url: `${url}/contact`, quote: "Program: Luni–Vineri 9–20, Sâmbătă 9–14" },
      },
    ),
  );
  return out;
}

function riskFacts(s: SectorSpec): Fact[] {
  const out: Fact[] = [
    fact(
      "identity.status",
      "identity",
      "activ",
      bi("Active, VAT registered", "Activă, plătitoare de TVA"),
      "anaf_v9",
    ),
  ];
  if (s.courts.checked) {
    out.push(
      fact(
        "risk.courts.checked",
        "risk",
        true,
        bi("Checked: last 36 months", "Verificat: ultimele 36 de luni"),
        "courts",
      ),
      fact(
        "risk.courts.as_plaintiff",
        "risk",
        s.courts.plaintiff,
        s.courts.plaintiff
          ? bi(
              `${s.courts.plaintiff} cases opened (payment claims)`,
              `${s.courts.plaintiff} procese deschise (cereri de plată)`,
            )
          : bi("None", "Niciunul"),
        "courts",
        { score: 0.95 },
      ),
      fact(
        "risk.courts.as_defendant",
        "risk",
        s.courts.defendant,
        s.courts.defendant
          ? bi(
              `${s.courts.defendant} case (contract dispute)`,
              `${s.courts.defendant} proces (litigiu contractual)`,
            )
          : bi("None", "Niciunul"),
        "courts",
        { score: 0.95 },
      ),
    );
  }
  out.push(
    fact(
      "risk.ted.awards",
      "risk",
      s.ted,
      s.ted
        ? bi(`${s.ted} EU tenders won`, `${s.ted} licitații europene câștigate`)
        : bi("None found", "Niciuna găsită"),
      "ted",
    ),
  );
  return out;
}

function identityFacts(s: SectorSpec): Fact[] {
  return [
    fact("identity.name", "identity", s.name, bi(s.displayName, s.displayName), "anaf_v9"),
    fact("identity.cui", "identity", s.cui, bi(s.cui, s.cui), "anaf_v9"),
    fact("identity.reg_no", "identity", { canonical: s.regNo }, bi(s.regNo, s.regNo), "anaf_v9"),
    fact(
      "identity.caen",
      "identity",
      { code: s.caen },
      bi(`${s.caen} · ${s.activity.en}`, `${s.caen} · ${s.activity.ro}`),
      "anaf_v9",
      {
        short: s.activity,
      },
    ),
    fact(
      "identity.seat",
      "identity",
      { city: s.city, county: s.county },
      bi(`${s.city}, ${s.county}`, `${s.city}, ${s.county}`),
      "anaf_v9",
    ),
    fact("identity.vat_payer", "identity", true, bi("Yes", "Da"), "anaf_v9"),
  ];
}

/** "Better than N of 100" from the quartiles (linear between them; the sample is made up). */
function rankOf(q: [number, number, number], v: number): number {
  const at =
    v <= q[0]
      ? 0.25 * Math.max(0, v / q[0])
      : v <= q[1]
        ? 0.25 + (0.25 * (v - q[0])) / (q[1] - q[0])
        : v <= q[2]
          ? 0.5 + (0.25 * (v - q[1])) / (q[2] - q[1])
          : Math.min(0.97, 0.75 + (0.25 * (v - q[2])) / q[2]);
  return Math.max(2, Math.round(at * 100));
}
const positionOf = (q: [number, number, number], v: number, n: number) =>
  Math.max(1, Math.min(n, Math.round(n * (1 - rankOf(q, v) / 100)) + 1));

function peersFacts(s: SectorSpec, firmNew: boolean): Fact[] {
  const p = s.peers;
  const last = YEARS.length - 1;
  const you = firmNew
    ? {}
    : {
        margin: s.series.pretax[last] / s.series.turnover[last],
        turnover: s.series.turnover[last],
        employees: s.series.staff[last],
        growth: s.series.turnover[last] / s.series.turnover[last - 3] - 1,
        days: Math.round((s.receivables / s.series.turnover[last]) * 365),
      };
  const band = (metric: string, q: [number, number, number], v?: number) => {
    // Fewer days to collect is better: the rank runs the other way.
    const raw = v === undefined ? undefined : rankOf(q, v);
    const better = raw === undefined ? undefined : metric === "daysToCollect" ? 100 - raw : raw;
    return fact(
      `peers.band.${metric}`,
      "peers",
      {
        metric,
        p25: q[0],
        p50: q[1],
        p75: q[2],
        n: p.n,
        ...(v !== undefined ? { you: v } : {}),
        ...(v !== undefined && p.n >= 20 ? { betterThanOf100: better } : {}),
        ...(v !== undefined && p.n < 20
          ? {
              rank: {
                position:
                  metric === "daysToCollect"
                    ? p.n + 1 - positionOf(q, v, p.n)
                    : positionOf(q, v, p.n),
                of: p.n,
              },
            }
          : {}),
      },
      bi(`${metric}`, `${metric}`),
      "mf_bulk",
      { predicate: "peers.band", asOf: "FY2025", confidence: "calculat", method: "bulk" },
    );
  };
  return [
    fact("peers.scope", "peers", { scope: p.scope }, p.scopeLabel, "mf_bulk", {
      asOf: "FY2025",
      method: "bulk",
    }),
    fact("peers.n", "peers", p.n, bi(`${p.n} firms`, `${p.n} de firme`), "mf_bulk", {
      asOf: "FY2025",
      method: "bulk",
    }),
    fact(
      "peers.size_band",
      "peers",
      p.band,
      bi(
        `${leiShort(p.band[0]).en}–${leiShort(p.band[1]).en}`,
        `${leiShort(p.band[0]).ro}–${leiShort(p.band[1]).ro}`,
      ),
      "mf_bulk",
      {
        asOf: "FY2025",
        method: "bulk",
      },
    ),
    ...(you.turnover !== undefined
      ? [
          fact(
            "peers.rank.turnover",
            "peers",
            p.n >= 20
              ? { metric: "turnover", betterThanOf100: rankOf(p.turnover, you.turnover), n: p.n }
              : {
                  metric: "turnover",
                  rank: { position: positionOf(p.turnover, you.turnover, p.n), of: p.n },
                  n: p.n,
                },
            p.n >= 20
              ? bi(
                  `better than ${rankOf(p.turnover, you.turnover)} of 100`,
                  `mai bine decât ${rankOf(p.turnover, you.turnover)} din 100`,
                )
              : bi(
                  `position ${positionOf(p.turnover, you.turnover, p.n)} of ${p.n}`,
                  `locul ${positionOf(p.turnover, you.turnover, p.n)} din ${p.n}`,
                ),
            "mf_bulk",
            { predicate: "peers.rank", asOf: "FY2025", confidence: "calculat", method: "bulk" },
          ),
        ]
      : []),
    band("marginPretax", p.margin, you.margin),
    band("turnover", p.turnover, you.turnover),
    band("employees", p.employees, you.employees),
    band("growth3y", p.growth, you.growth),
    band("daysToCollect", p.days, you.days),
  ];
}

function rivalCards(s: SectorSpec): { cards: CompetitorCard[]; facts: Fact[] } {
  const why = bi(
    `Same activity (CAEN ${s.caen}), similar size, ${s.peers.scopeLabel.en}`,
    `Aceeași activitate (CAEN ${s.caen}), mărime apropiată, ${s.peers.scopeLabel.ro}`,
  );
  const facts: Fact[] = [];
  const cards = s.rivals.map((r) => {
    const id = `peers.rival.${r.cui}`;
    facts.push(
      fact(
        id,
        "competitors",
        {
          cui: r.cui,
          name: r.name,
          city: r.city,
          turnover: r.turnover,
          employees: r.employees,
          website: r.website,
          origin: "official",
          whyChosen: why,
        },
        bi(
          `${r.name} · ${leiShort(r.turnover ?? 0).en}`,
          `${r.name} · ${leiShort(r.turnover ?? 0).ro}`,
        ),
        "mf_bulk",
        {
          predicate: "peers.rival",
          asOf: "FY2025",
          method: "bulk",
        },
      ),
    );
    const ids = [id];
    if (r.website) {
      facts.push(
        fact(
          `competitors.site.${r.cui}`,
          "competitors",
          { cui: r.cui, website: r.website, booking: r.booking ?? false },
          bi(`${r.name}: website read`, `${r.name}: site citit`),
          "competitor_site",
          {
            predicate: "competitors.site",
            method: "html",
          },
        ),
      );
      ids.push(`competitors.site.${r.cui}`);
    }
    return { ...r, whyChosen: why, origin: "official" as const, factIds: ids };
  });
  return { cards, facts };
}

/* ------------------------------------------------------------------ brief */

const said = (text: string, factIds: string[]): CitedSentence => ({ text, factIds });

/**
 * The AI-written sections of the sample (variants "ai" and "third"): each sentence cites the
 * facts its numbers come from, like a verified live section. Rules variants keep the rules
 * brief the report logic builds from the same facts.
 */
function aiSections(
  s: SectorSpec,
  third: boolean,
  lang: Lang,
): Pick<DeepReport["brief"], "headline" | "meaning" | "customerView" | "rivals"> & {
  findings: CitedSentence[][];
  ifNothing?: CitedSentence[];
} {
  const ro = lang === "ro";
  const L = (roText: string, enText: string) => (ro ? roText : enText);
  const sec = (sentences: CitedSentence[]): BriefSection => ({ source: "ai", sentences });
  const last = YEARS.length - 1;
  const t = s.series.turnover;
  const keep = Math.round((s.series.pretax[last] / t[last]) * 100);
  const median = Math.round(s.peers.margin[1] * 100);
  const g3 = Math.round((t[last] / t[last - 3] - 1) * 100);
  const name = s.displayName;
  const top = s.rivals[0];
  const rivals = sec([
    said(
      L(
        `${top.name} are ${top.booking ? "programare online pe site" : "un site funcțional"} și o cifră de afaceri de ${leiShort(top.turnover ?? 0).ro}.`,
        `${top.name} has ${top.booking ? "online booking on its site" : "a working website"} and turns over ${leiShort(top.turnover ?? 0).en}.`,
      ),
      [`peers.rival.${top.cui}`, `competitors.site.${top.cui}`],
    ),
  ]);
  const customerView = sec(
    s.site.status === "verified"
      ? [
          said(
            L(
              "Programul apare pe pagina de contact: Luni–Vineri 9–20.",
              "Opening hours are on the contact page: Mon–Fri 9–20.",
            ),
            ["offers.hours"],
          ),
          said(
            s.site_.booking
              ? L("Poate comanda direct de pe site.", "They can order right on the site.")
              : L(
                  `Nu poate face o ${s.key === "restaurant" ? "rezervare" : "programare"} online de pe site (am citit ${s.site_.pages} pagini).`,
                  `They cannot make an online ${s.key === "restaurant" ? "reservation" : "booking"} on the site (we read ${s.site_.pages} pages).`,
                ),
            ["site.booking.present"],
          ),
          said(
            L(
              "Găsește telefonul și adresa pe pagina de contact.",
              "They find the phone number and the address on the contact page.",
            ),
            ["site.contact.present"],
          ),
        ]
      : [
          said(
            L(
              `Cine scrie ${s.site.host} vede «${s.site.host} este de vânzare!».`,
              `Whoever types ${s.site.host} sees “${s.site.host} is for sale!”.`,
            ),
            ["site.status"],
          ),
        ],
  );
  if (s.key === "restaurant")
    return {
      headline: sec([
        said(
          L(
            "Ai pierdut bani în 2025, iar cifra de afaceri scade de doi ani.",
            "You lost money in 2025, and turnover has fallen for two years.",
          ),
          ["money.profit_net.2025", "money.turnover.2025", "money.turnover.2024"],
        ),
      ]),
      meaning: sec([
        said(
          L(
            "Cifra de afaceri a scăzut de la 2,1 mil. lei în 2023 la 1,63 mil. lei în 2025, iar echipa s-a redus de la 12 la 8 salariați.",
            "Turnover fell from 2.1M lei in 2023 to 1.63M lei in 2025, and the team shrank from 12 to 8 employees.",
          ),
          ["money.turnover.2023", "money.turnover.2025", "people.employees_change"],
        ),
      ]),
      findings: [],
      customerView,
      rivals,
      ifNothing: [
        said(
          L(
            "Dacă tendința din 2023–2025 continuă, cifra de afaceri ar putea ajunge la 1,4–1,5 mil. lei în 2026.",
            "If the 2023–2025 trend continues, turnover could reach 1.4–1.5M lei in 2026.",
          ),
          ["money.turnover.2023", "money.turnover.2024", "money.turnover.2025"],
        ),
      ],
    };
  if (s.key === "constructii")
    return {
      headline: sec([
        said(
          L(
            `Crești de șapte ani, dar cine caută ${s.site.host} vede un domeniu de vânzare.`,
            `You have grown for seven years, but people who look for ${s.site.host} see a domain for sale.`,
          ),
          ["money.growth_turnover_3y", "site.status"],
        ),
      ]),
      meaning: sec([
        said(
          L(
            `Cifra de afaceri a crescut cu ${g3}% din 2022 și firma e pe profit. Încasezi însă mai încet decât majoritatea firmelor similare din Arad.`,
            `Turnover grew by ${g3}% since 2022 and the firm makes a profit. You collect more slowly than most similar firms in Arad, though.`,
          ),
          ["money.growth_turnover_3y", "money.profit_net.2025", "peers.band.daysToCollect"],
        ),
      ]),
      findings: [],
      customerView,
      rivals,
    };
  if (s.key === "comert")
    return {
      headline: sec([
        said(
          L(
            `Firma ta merge bine: păstrezi ${keep} lei din 100, mai mult decât o firmă obișnuită.`,
            `Your firm is doing well: you keep ${keep} lei of every 100, more than a typical firm.`,
          ),
          ["money.margin_pretax.2025", "peers.band.marginPretax"],
        ),
      ]),
      meaning: sec([
        said(
          L(
            "Crești de cinci ani la rând. Unde mai poți câștiga: magazinul are 3 probleme importante pe site.",
            "You have grown five years in a row. Where you can still gain: the shop has 3 important issues on its site.",
          ),
          ["money.turnover.2025", "money.turnover.2021", "site.audit.important"],
        ),
      ]),
      findings: [],
      customerView,
      rivals,
    };
  return {
    headline: sec([
      said(
        third
          ? L(
              `${name} crește repede, dar îi rămân doar ${keep} lei din 100 facturați.`,
              `${name} grows fast but keeps only ${keep} lei of every 100 invoiced.`,
            )
          : L(
              "Crești repede, dar păstrezi mai puțin decât clinicile similare.",
              "You grow fast, but keep less than similar clinics.",
            ),
        ["money.growth_turnover_3y", "money.margin_pretax.2025", "peers.band.marginPretax"],
      ),
    ]),
    meaning: sec([
      said(
        third
          ? L(
              `Cifra de afaceri a crescut cu ${g3}% din 2022, iar o clinică obișnuită din Timiș păstrează ${median} lei din 100.`,
              `Turnover grew by ${g3}% since 2022, while a typical clinic in Timiș keeps ${median} lei of every 100.`,
            )
          : L(
              `Cifra de afaceri a crescut cu ${g3}% din 2022, mai repede decât majoritatea clinicilor din Timiș. O clinică obișnuită păstrează însă ${median} lei din 100, tu ${keep}.`,
              `Turnover grew by ${g3}% since 2022, faster than most clinics in Timiș. A typical clinic keeps ${median} lei of every 100, you keep ${keep}.`,
            ),
        ["money.growth_turnover_3y", "peers.band.marginPretax", "money.margin_pretax.2025"],
      ),
      said(
        third
          ? L(
              `Pe cele ${s.site_.pages} pagini citite nu apare programare online.`,
              `There is no online booking on the ${s.site_.pages} pages we read.`,
            )
          : L(
              "Un pacient nou te găsește ușor pe site, dar nu își poate face singur programarea.",
              "A new patient finds you easily on the site, but cannot book on their own.",
            ),
        ["site.booking.present", "site.contact.present"],
      ),
    ]),
    findings: [],
    customerView,
    rivals,
  };
}

/* ----------------------------------------------------------------- report */

/** A complete fictional report for the sample page and the screenshot states. */
export function demoReport(
  sector: DemoSector = "sanatate",
  variant: DemoVariant = "ai",
  lang: Lang = "ro",
): DeepReport {
  const s = SECTORS[sector];
  const firmNew = variant === "new";
  const partial = variant === "partial";
  const relationship: Relationship = variant === "third" ? "client_furnizor" : "proprietar";
  const rivals = rivalCards(s);
  const facts: Fact[] = [
    ...identityFacts(s),
    ...moneyFacts(s, firmNew),
    ...siteFacts(s),
    ...riskFacts(s),
    ...(partial ? [] : peersFacts(s, firmNew)),
    ...(partial || firmNew ? [] : rivals.facts),
  ];
  const company: DeepReport["company"] = {
    name: s.name,
    displayName: s.displayName,
    cui: s.cui,
    regNo: s.regNo,
    caen3: s.caen,
    caen2: s.caen,
    activity: s.activity,
    city: s.city,
    county: s.county,
    website: { url: `https://${s.site.host}`, status: s.site.status },
  };
  const gaps: Gap[] = [
    {
      section: "offers",
      what: bi("Prices", "Prețurile"),
      where: bi(
        `Not published on the ${s.site_.pages} pages we read`,
        `Nepublicate pe cele ${s.site_.pages} pagini citite`,
      ),
      at: DAY,
    },
  ];
  if (!s.courts.checked)
    gaps.push({
      section: "risk",
      what: bi("Courts", "Instanțe"),
      where: bi("The court portal did not answer", "Portalul instanțelor nu a răspuns"),
      at: DAY,
      link: "https://portal.just.ro",
    });
  if (partial)
    gaps.unshift(
      {
        section: "identity",
        what: bi("This report", "Acest raport"),
        where: bi(
          "Generated partially: the last step ran out of time",
          "Raportul a fost generat parțial: ultimul pas a rămas fără timp",
        ),
        at: DAY,
      },
      {
        section: "peers",
        what: bi("Comparison with similar firms", "Comparația cu firme similare"),
        where: bi("Not checked in this run", "Neverificat în această rulare"),
        at: DAY,
      },
    );
  const peers: DeepReport["peers"] = partial
    ? undefined
    : {
        n: s.peers.n,
        scope: s.peers.scope,
        scopeLabel: s.peers.scopeLabel,
        year: 2025,
        sizeBand: s.peers.band,
        bands: Object.fromEntries(
          facts
            .filter((f) => f.predicate === "peers.band")
            .map((f) => {
              const { metric, ...rest } = f.value as { metric: string } & Record<string, number>;
              return [metric, rest];
            }),
        ),
      };
  const competitors = partial || firmNew ? [] : rivals.cards;
  const parts = buildReportParts({ facts, gaps, company, relationship, lang, peers, competitors });
  const ai = variant === "ai" || variant === "third";
  let brief = parts.rulesBrief;
  // The written sections of the sample exist in the third person for the clinic only; other
  // sectors keep the rules sections (as a live run does when a section falls back).
  if (ai && (variant !== "third" || sector === "sanatate")) {
    const written = aiSections(s, variant === "third", lang);
    brief = {
      ...brief,
      headline: written.headline,
      meaning: written.meaning,
      customerView: written.customerView,
      rivals: written.rivals,
      ifNothing: written.ifNothing
        ? { source: "ai", sentences: written.ifNothing }
        : brief.ifNothing,
      cut: { kept: 9, byCode: 1, byEntailment: 0 },
    };
  }
  const sources: SourceRef[] = (
    [
      "anaf_v9",
      "anaf_bilant",
      ...(partial ? [] : (["mf_bulk"] as const)),
      ...(s.courts.checked ? (["courts"] as const) : []),
      "ted",
      "site",
      "audit",
      ...(s.site_.speedS ? (["pagespeed"] as const) : []),
      "dns",
      "calc",
    ] as SourceId[]
  ).map((id) => ({
    id,
    label: SOURCE_LABELS[id],
    url: SOURCE_URLS[id],
    licence: id === "mf_bulk" ? "CC BY 4.0" : undefined,
    asOf: id === "anaf_bilant" || id === "mf_bulk" ? "FY2025" : DAY,
    retrievedAt: AT,
  }));
  return {
    schema: 1,
    runId: `demo-${sector}-${variant}`,
    cui: s.cui,
    lang,
    relationship,
    audience: parts.audience,
    firm: parts.firm,
    generatedAt: AT,
    aiMode: ai ? "ai" : "rules",
    models: ai
      ? { synthesis: "claude-opus-5-5", extraction: "claude-haiku-4-5-20251001" }
      : undefined,
    company,
    facts,
    gaps,
    sources,
    registers: parts.registers,
    lights: parts.lights,
    findings: parts.findings,
    actions: parts.actions,
    totals: parts.totals,
    brief,
    peers,
    competitors,
    counts: parts.counts,
    vocab: parts.vocab,
    verifyCode: "7KQ4-M2XD",
    costUsd: ai ? 0.38 : 0,
  };
}

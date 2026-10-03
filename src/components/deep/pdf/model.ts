import type {
  Action,
  AreaLight,
  Bilingual,
  BriefSection,
  DeepReport,
  Estimate,
  Fact,
  Lang,
  LightState,
  PeerBand,
  SourceId,
  WebsiteStatus,
} from "@/lib/deep/contracts";
import { count, formatInt, leiShort, pct } from "@/lib/deep/parse/format";
import { factLabel, SOURCE_LABELS } from "@/lib/deep/parse/labels";
import { SIGNATORY } from "@/components/deep/contact";
import type { PdfAssets } from "@/components/scan/pdf/assets";

/*
 * The deep report PDF reads one DeepReport (the JSON the screen shows) and
 * derives everything it prints here, in plain functions: the same facts,
 * displays, lines, actions and totals as the screen, never new arithmetic on
 * official figures. Official numbers are printed from each fact's `display` or
 * `short` (formatted by code on the server); estimates are printed from the
 * Estimate values (already rounded by the money model) with the same
 * thousands format. Ephemeral facts (the Google rating) are never printed.
 */

export const NBSP = "\u00a0";
export const MINUS = "−";

export type DeepPdfVariant = "full" | "brief";

export type DeepPdfInput = {
  report: DeepReport;
  /** Language of the labels; the AI text stays in the run's language. Default: the report's. */
  lang?: Lang;
  /** "Exemplu cu o firmă inventată" on every page (the public sample report). Default: a demo run ID. */
  sample?: boolean;
  /** Server storage is on, so /scan/deep?verify=<code> can confirm the code. */
  verifiable?: boolean;
  /** Signatory photo (PNG or JPEG, absolute URL or file path); initials when missing. */
  photo?: string | null;
  /** Brand images (see resolvePdfAssets). */
  assets: PdfAssets;
};

/** Signatory and contact (src/components/deep/contact.ts); phone and WhatsApp appear once they are set there. */
export type Signatory = {
  name: string;
  role: Bilingual;
  initials: string;
  phone?: string;
  whatsapp?: string;
  email: string;
};

export function signatory(): Signatory {
  // One place to fill for the screen and the PDF: src/components/deep/contact.ts (owner to
  // send the phone and WhatsApp number). Until then the PDF leaves those rows out (plan A10:
  // never a made-up number) and the photo slot shows the initials.
  return {
    name: SIGNATORY.name,
    role: SIGNATORY.role,
    initials: SIGNATORY.initials,
    phone: SIGNATORY.phone || undefined,
    whatsapp: SIGNATORY.whatsapp || undefined,
    email: SIGNATORY.email,
  };
}

export const CONTACT_URL = "https://vortexhub.dev/contact";
export const PRIVACY_URL = "vortexhub.dev/privacy";
export const BOT_URL = "vortexhub.dev/privacy#vortex-scan-bot";

export type DeepPdfContext = {
  report: DeepReport;
  lang: Lang;
  t: (en: string, ro: string) => string;
  pick: (value: Bilingual | undefined) => string;
  /** Printable facts (never ephemeral ones). */
  facts: Fact[];
  fact: (id: string) => Fact | undefined;
  byPredicate: (predicate: string) => Fact[];
  /** Per-year facts of a predicate, oldest first. */
  series: (predicate: string) => Array<{ year: number; fact: Fact }>;
  name: string;
  owner: boolean;
  newFirm: boolean;
  sample: boolean;
  verifiable: boolean;
  adjusted: boolean;
  /** A Google rating was shown online; the PDF says it is not printed. */
  googleOnlineOnly: boolean;
  code: string;
  /** "03.10.2026, 19:22" / "3 Oct 2026, 19:22". */
  generated: string;
  /** "bilanț 2025, registre 03.10.2026". */
  validAt: string;
  latestYear?: number;
  pagesRead: number;
  assets: PdfAssets;
  photo?: string | null;
  signatory: Signatory;
};

const YEAR_ID = /\.((?:19|20)\d{2})$/;

/** "03.10.2026" / "3 Oct 2026" in Bucharest time; with the time when asked. */
export function dateText(iso: string, lang: Lang, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Bucharest",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const day =
    lang === "ro"
      ? `${parts.day}.${parts.month}.${parts.year}`
      : `${Number(parts.day)} ${months[Number(parts.month) - 1]} ${parts.year}`;
  return withTime ? `${day}, ${parts.hour}:${parts.minute}` : day;
}

/** A fact's "valabil la": "FY2025" → "bilanț 2025"; an ISO day → its date. */
export function asOfText(asOf: string, lang: Lang): string {
  const fy = /^FY(\d{4})$/.exec(asOf);
  if (fy) return lang === "ro" ? `bilanț ${fy[1]}` : `accounts ${fy[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(asOf)) return dateText(`${asOf.slice(0, 10)}T12:00:00Z`, lang);
  return asOf;
}

export function createDeepContext(input: DeepPdfInput): DeepPdfContext {
  const { report } = input;
  const lang = input.lang ?? report.lang;
  const t = (en: string, ro: string) => (lang === "ro" ? ro : en);
  const pick = (value: Bilingual | undefined) => (value ? value[lang] || value.en : "");
  const all = report.facts ?? [];
  const facts = all.filter((f) => !f.ephemeral);
  const byId = new Map(facts.map((f) => [f.id, f]));
  const byPredicate = (predicate: string) => facts.filter((f) => f.predicate === predicate);
  const series = (predicate: string) =>
    byPredicate(predicate)
      .filter((f) => YEAR_ID.test(f.id))
      .map((f) => ({ year: Number(YEAR_ID.exec(f.id)![1]), fact: f }))
      .sort((a, b) => a.year - b.year);
  const years = series("money.turnover").map((s) => s.year);
  const latestYear = years.length ? years[years.length - 1] : undefined;
  const registryDay =
    byId.get("identity.status")?.asOf ?? byId.get("identity.name")?.asOf ?? report.generatedAt;
  const validAt = [
    latestYear ? asOfText(`FY${latestYear}`, lang) : undefined,
    t(`registers ${asOfText(registryDay, lang)}`, `registre ${asOfText(registryDay, lang)}`),
  ]
    .filter(Boolean)
    .join(", ");
  const pagesFact = byId.get("site.pages_read");
  const pagesRead =
    typeof pagesFact?.value === "number" ? pagesFact.value : (report.counts?.pagesRead ?? 0);
  const owner = report.audience === "owner";
  const inputs = report.ownerInputs ?? {};
  return {
    report,
    lang,
    t,
    pick,
    facts,
    fact: (id) => byId.get(id),
    byPredicate,
    series,
    name: report.company.displayName || report.company.name,
    owner,
    newFirm: report.firm === "new",
    sample: input.sample ?? /^demo/i.test(report.runId),
    verifiable: Boolean(input.verifiable),
    adjusted: Object.values(inputs).some((v) => typeof v === "number" && v > 0),
    googleOnlineOnly: all.some((f) => f.ephemeral && f.source === "google_places"),
    code: report.verifyCode ?? "",
    generated: dateText(report.generatedAt, lang, true),
    validAt,
    latestYear,
    pagesRead,
    assets: input.assets,
    photo: input.photo,
    signatory: signatory(),
  };
}

/* ------------------------------------------------------------ wording */

/** Romanian "de" from 20 up ("14 pagini", "20 de pagini"); English plural. */
export function countText(
  ctx: DeepPdfContext,
  n: number,
  en: [string, string],
  ro: [string, string],
) {
  if (ctx.lang === "en") return `${formatInt(n, "en")} ${n === 1 ? en[0] : en[1]}`;
  if (n === 1) return `1 ${ro[0]}`;
  const rest = n % 100;
  const de = n >= 20 && (rest === 0 || rest >= 20);
  return `${formatInt(n, "ro")} ${de ? "de " : ""}${ro[1]}`;
}

export const lei = (value: number, lang: Lang) =>
  `${formatInt(value, lang).replace(/^-/, MINUS)}${NBSP}lei`;

/** The status words of the five lines (= LINE_WORDS in src/lib/deep/report/words.ts). */
export const STATE_WORD: Record<LightState, Bilingual> = {
  bine: { en: "Good", ro: "Bine" },
  atentie: { en: "Watch", ro: "Atenție" },
  de_rezolvat: { en: "To fix", ro: "De rezolvat" },
  neverificat: { en: "Not checked", ro: "Neverificat" },
};

export const STATE_TONE: Record<LightState, "ok" | "warn" | "bad" | "neutral"> = {
  bine: "ok",
  atentie: "warn",
  de_rezolvat: "bad",
  neverificat: "neutral",
};

export const WEBSITE_STATUS_TEXT: Record<WebsiteStatus, Bilingual> = {
  verified: { en: "Verified as the company's website", ro: "Verificat: este site-ul firmei" },
  declared: { en: "Declared by you", ro: "Declarat de tine" },
  ask_visitor: { en: "Not confirmed as the company's site", ro: "Neconfirmat ca site al firmei" },
  broken_certificate: {
    en: "The security certificate is expired or wrong",
    ro: "Certificatul de securitate e expirat sau greșit",
  },
  parked: { en: "Parked or for-sale domain", ro: "Domeniu parcat sau scos la vânzare" },
  dead: { en: "The domain does not answer", ro: "Domeniul nu răspunde" },
  unreachable: { en: "We could not reach the site", ro: "Nu am putut ajunge la site" },
  blocked: {
    en: "The site blocks automated access",
    ro: "Site-ul blochează accesul automat",
  },
  none: { en: "No company website found", ro: "Nu am găsit un site al firmei" },
};

/** Who does it, after "Cine:" (lower case: it follows a colon). */
export const WHO_TEXT: Record<Action["who"], Bilingual> = {
  singur: { en: "you, on your own", ro: "tu, singur" },
  contabil: { en: "you and your accountant", ro: "tu și contabilul" },
  cu_vortex: { en: "you, with Vortex Hub", ro: "tu, cu Vortex Hub" },
};

/** Who does it, with both paths when the action has a do-it-yourself path and a price. */
export function whoText(ctx: DeepPdfContext, action: Action): string {
  const both =
    action.cost.vortex &&
    (action.cost.diyHow || action.cost.diyHours !== undefined) &&
    action.who !== "contabil";
  return both
    ? ctx.t("you, on your own or with Vortex Hub", "tu, singur sau cu Vortex Hub")
    : ctx.pick(WHO_TEXT[action.who]);
}

/** "15 minute", "o oră", "2 ore", "20 de ore" / "15 minutes", "1 hour", "2 hours". */
export function hoursText(ctx: DeepPdfContext, hours: number): string {
  if (hours < 1) {
    return countText(ctx, Math.round(hours * 60), ["minute", "minutes"], ["minut", "minute"]);
  }
  const h = Math.round(hours * 10) / 10;
  if (h === 1) return ctx.t("1 hour", "o oră");
  return countText(ctx, h, ["hour", "hours"], ["oră", "ore"]);
}

/** "Poți face singur: gratuit, 2 ore · Cu Vortex Hub: de la 1.200 lei, plus 50 lei pe lună". */
export function costText(ctx: DeepPdfContext, cost: Action["cost"]): string {
  const parts: string[] = [];
  if (cost.diyHow) {
    parts.push(ctx.t(`On your own: ${cost.diyHow.en}`, `Poți face singur: ${cost.diyHow.ro}`));
  } else if (cost.diyHours !== undefined || cost.diyLei !== undefined) {
    const money = cost.diyLei
      ? ctx.t(`about ${lei(cost.diyLei, "en")}`, `cam ${lei(cost.diyLei, "ro")}`)
      : ctx.t("free", "gratuit");
    const time = cost.diyHours ? `, ${hoursText(ctx, cost.diyHours)}` : "";
    parts.push(ctx.t(`On your own: ${money}${time}`, `Poți face singur: ${money}${time}`));
  }
  if (cost.vortex) {
    const monthly = cost.vortex.monthlyLei
      ? ctx.t(
          `, plus ${lei(cost.vortex.monthlyLei, "en")} a month`,
          `, plus ${lei(cost.vortex.monthlyLei, "ro")} pe lună`,
        )
      : "";
    parts.push(
      ctx.t(
        `With Vortex Hub: from ${lei(cost.vortex.setupLei, "en")}${monthly}`,
        `Cu Vortex Hub: de la ${lei(cost.vortex.setupLei, "ro")}${monthly}`,
      ),
    );
  }
  return parts.join(" · ");
}

/** The main figure of an estimate: "≈ 570 lei pe lună" / "≈ 560.000 lei pe an, înainte de impozit". */
export function estimateFigure(
  ctx: DeepPdfContext,
  e: Estimate,
  short = false,
): { value: string; unit: string } {
  const value = `≈${NBSP}${formatInt(e.value, ctx.lang)}`;
  if (e.kind === "time_value_month") return { value, unit: ctx.t("lei a month", "lei pe lună") };
  // The margin gap is a ceiling ("până la"), never the headline number of the plan.
  return {
    value: `${ctx.t("up to", "până la")}${NBSP}${formatInt(e.value, ctx.lang)}`,
    unit: short
      ? ctx.t("lei a year", "lei pe an")
      : ctx.t("lei a year, before tax", "lei pe an, înainte de impozit"),
  };
}

/** "între 380 și 760 lei" / "between 380 and 760 lei", or "" when there is no range. */
export function estimateRange(ctx: DeepPdfContext, e: Estimate): string {
  if (!(e.low < e.high)) return "";
  return ctx.t(
    `between ${formatInt(e.low, "en")} and ${formatInt(e.high, "en")} lei`,
    `între ${formatInt(e.low, "ro")} și ${formatInt(e.high, "ro")} lei`,
  );
}

/** Kept sentences of a brief section (corrected ones are hidden), joined. */
export function sectionText(section: BriefSection | undefined): string {
  if (!section) return "";
  return section.sentences
    .filter((s) => !s.hiddenBy && s.text.trim())
    .map((s) => s.text.trim())
    .join(" ");
}

export function sectionSentences(section: BriefSection | undefined): string[] {
  if (!section) return [];
  return section.sentences.filter((s) => !s.hiddenBy && s.text.trim()).map((s) => s.text.trim());
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/**
 * A fact's display as printed. E-mail addresses are removed everywhere except
 * the company's own generic address (plan A9: personal e-mails are counted,
 * never shown); a role string scraped next to a named mailbox must not carry
 * the name into the PDF.
 */
export function factText(ctx: DeepPdfContext, f: Fact): string {
  const text = ctx.pick(f.display);
  if (f.predicate === "site.email.generic") return text;
  return text
    .replace(EMAIL, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,;)])/g, "$1")
    .trim();
}

/** Lower-cases the first letter after a colon, unless the word is an acronym ("ANAF"). */
export function lcFirst(text: string): string {
  return /^\p{Lu}\p{Ll}/u.test(text) ? text[0].toLocaleLowerCase("ro") + text.slice(1) : text;
}

/** First `max` words, with "…" when cut. */
export function words(text: string, max: number): string {
  const list = text.split(/\s+/).filter(Boolean);
  return list.length <= max
    ? text
    : `${list
        .slice(0, max)
        .join(" ")
        .replace(/[,;:]$/, "")}…`;
}

/** "Ministerul Finanțelor, bilanț (ANAF) · bilanț 2025" for the facts a block rests on. */
export function sourceLine(ctx: DeepPdfContext, factIds: string[]): string {
  const seen = new Map<string, string>();
  for (const id of factIds) {
    const f = ctx.fact(id);
    if (!f) continue;
    const label = sourceShort(ctx, f.source);
    const key = `${label}|${f.asOf}`;
    if (!seen.has(key)) seen.set(key, `${label} · ${asOfText(f.asOf, ctx.lang)}`);
  }
  return [...seen.values()].slice(0, 2).join("; ");
}

/** Short source names for source lines; the appendix has the full ones. */
export function sourceShort(ctx: DeepPdfContext, id: SourceId): string {
  const short: Partial<Record<SourceId, Bilingual>> = {
    anaf_v9: { en: "ANAF", ro: "ANAF" },
    anaf_bilant: { en: "Ministry of Finance", ro: "Ministerul Finanțelor" },
    mf_bulk: { en: "Ministry of Finance", ro: "Ministerul Finanțelor" },
    onrc: { en: "Trade Register", ro: "Registrul Comerțului" },
    calc: { en: "our calculation", ro: "calculul nostru" },
    site: { en: "the company's website", ro: "site-ul firmei" },
    audit: { en: "website checks", ro: "verificările site-ului" },
    courts: { en: "portal.just.ro", ro: "portal.just.ro" },
    competitor_site: { en: "the rivals' websites", ro: "site-urile concurenților" },
    pagespeed: { en: "Google speed test", ro: "testul de viteză Google" },
    dns: { en: "public DNS records", ro: "înregistrări DNS publice" },
    user: { en: "declared by you", ro: "declarat de tine" },
  };
  return ctx.pick(short[id] ?? SOURCE_LABELS[id]);
}

/* ------------------------------------------------------------- figures */

export type FigureCell = { label: string; value: string; source: string };

/** The official figures strip: turnover, net profit, average staff of the latest filed year. */
export function officialFigures(ctx: DeepPdfContext): FigureCell[] {
  const y = ctx.latestYear;
  if (!y) return [];
  const cell = (id: string, en: string, ro: string): FigureCell | null => {
    const f = ctx.fact(id);
    if (!f) return null;
    return {
      label: ctx.t(en, ro),
      value: ctx.pick(f.short ?? f.display),
      source: `${sourceShort(ctx, f.source)} · ${asOfText(f.asOf, ctx.lang)}`,
    };
  };
  return [
    cell(`money.turnover.${y}`, `Turnover ${y}`, `Cifra de afaceri ${y}`),
    cell(`money.profit_net.${y}`, `Net profit ${y}`, `Profit net ${y}`),
    cell(
      `people.employees.${y}`,
      `Employees, average ${y} (accounts)`,
      `Salariați, medie ${y} (din bilanț)`,
    ),
  ].filter((c): c is FigureCell => c !== null);
}

export type MoneyRow = { label: string; cells: string[] };

/** The money table, 2019 to the latest year, from the per-year facts (short displays). */
export function moneyTable(ctx: DeepPdfContext): { years: number[]; rows: MoneyRow[] } {
  const rowsSpec: Array<[string, string, string]> = [
    ["money.turnover", "Turnover", "Cifra de afaceri"],
    ["money.profit_pretax", "Profit before tax", "Profit înainte de impozit"],
    ["money.profit_net", "Net profit", "Profit net"],
    ["money.expenses", "Total expenses", "Cheltuieli totale"],
    ["people.employees", "Employees (average)", "Salariați (medie)"],
  ];
  const years = [...new Set(rowsSpec.flatMap(([p]) => ctx.series(p).map((s) => s.year)))].sort(
    (a, b) => a - b,
  );
  const rows = rowsSpec
    .map(([predicate, en, ro]) => {
      const byYear = new Map(ctx.series(predicate).map((s) => [s.year, s.fact]));
      if (!byYear.size) return null;
      return {
        label: ctx.t(en, ro),
        cells: years.map((y) => {
          const f = byYear.get(y);
          return f ? ctx.pick(f.short ?? f.display) : "–";
        }),
      };
    })
    .filter((r): r is MoneyRow => r !== null);
  return { years, rows };
}

/* --------------------------------------------------------------- peers */

const BAND_LABEL: Record<string, Bilingual> = {
  turnover: { en: "Turnover", ro: "Cifra de afaceri" },
  marginPretax: {
    en: "Kept from every 100 lei invoiced, before tax",
    ro: "Cât rămâne din 100 de lei facturați, înainte de impozit",
  },
  employees: { en: "Employees", ro: "Salariați" },
  revPerEmp: { en: "Turnover per employee", ro: "Cifra de afaceri pe salariat" },
  growth3y: { en: "Turnover growth", ro: "Creșterea cifrei de afaceri" },
  daysToCollect: { en: "Days to collect (estimate)", ro: "Zile până la încasare (estimare)" },
};

function bandValue(metric: string, v: number, lang: Lang): string {
  if (metric === "marginPretax") {
    const n = Math.round(v * 100);
    return lang === "ro" ? `${n} lei din 100` : `${n} lei of 100`;
  }
  if (metric === "growth3y") return pct(v)[lang];
  if (metric === "employees") return count(Math.round(v))[lang];
  if (metric === "daysToCollect")
    return lang === "ro" ? `${Math.round(v)} de zile` : `${Math.round(v)} days`;
  return leiShort(Math.round(v))[lang];
}

export type PeerSentence = {
  metric: string;
  label: string;
  typical: string;
  you?: string;
  estimate: boolean;
};

/** One sentence per peer band, with N and scope (A1, "Cifre"): "a 3-a din 9" under 20, "din 100" from 20. */
/**
 * The peers block: the report's own, with any band it lacks taken from the
 * peers.band facts (as src/lib/deep/steps/merge.server.ts builds it), so the
 * PDF shows the same comparison as the "Cifre" tab whichever one is filled.
 */
export function peersOf(ctx: DeepPdfContext): DeepReport["peers"] | undefined {
  const own = ctx.report.peers;
  const scopeFact = ctx.fact("peers.scope");
  const n = ctx.fact("peers.n")?.value;
  const base: DeepReport["peers"] | undefined =
    own ??
    (scopeFact && typeof n === "number"
      ? {
          n,
          scope: ((scopeFact.value as { scope?: string } | null)?.scope ?? "national") as
            | "oras"
            | "judet"
            | "national",
          scopeLabel: scopeFact.display,
          year: Number(scopeFact.asOf.replace(/\D/g, "")) || 0,
          sizeBand: (ctx.fact("peers.size_band")?.value as [number, number] | undefined) ?? [0, 0],
          bands: {},
        }
      : undefined);
  if (!base) return undefined;
  const bands: Record<string, PeerBand> = { ...base.bands };
  for (const f of ctx.byPredicate("peers.band")) {
    const v = f.value as ({ metric?: string } & Partial<PeerBand>) | null;
    if (!v?.metric || bands[v.metric]) continue;
    if ([v.p25, v.p50, v.p75, v.n].every((x) => typeof x === "number")) {
      const { metric, ...band } = v;
      bands[metric] = band as PeerBand;
    }
  }
  return { ...base, bands };
}

/** Size is not "better": turnover and staff rank as "mai mare / mai mulți decât". */
const RANK_WORD: Record<string, Bilingual> = {
  turnover: { en: "higher than", ro: "mai mare decât" },
  marginPretax: { en: "better than", ro: "mai bine decât" },
  employees: { en: "more than", ro: "mai mulți decât" },
  revPerEmp: { en: "higher than", ro: "mai mare decât" },
  growth3y: { en: "faster than", ro: "mai repede decât" },
  daysToCollect: { en: "faster than", ro: "mai repede decât" },
};

export function peerSentences(ctx: DeepPdfContext): PeerSentence[] {
  const peers = peersOf(ctx);
  if (!peers) return [];
  const order = [
    "turnover",
    "marginPretax",
    "employees",
    "revPerEmp",
    "growth3y",
    "daysToCollect",
  ] as const;
  const out: PeerSentence[] = [];
  for (const metric of order) {
    const b: PeerBand | undefined = peers.bands[metric];
    if (!b) continue;
    const v = (x: number) => bandValue(metric, x, ctx.lang);
    const typical = ctx.t(
      `a typical firm: ${v(b.p50)}; half of the firms are between ${v(b.p25)} and ${v(b.p75)}`,
      `o firmă obișnuită: ${v(b.p50)}; jumătate dintre firme sunt între ${v(b.p25)} și ${v(b.p75)}`,
    );
    let you: string | undefined;
    if (b.you !== undefined) {
      const who = ctx.owner ? ctx.t("You", "Tu") : ctx.t("This firm", "Firma");
      const place = b.rank
        ? ctx.t(
            `, position ${b.rank.position} of ${b.rank.of}`,
            `, locul ${b.rank.position} din ${b.rank.of}`,
          )
        : b.betterThanOf100 !== undefined
          ? ctx.t(
              `, ${RANK_WORD[metric].en} ${b.betterThanOf100} of 100`,
              `, ${RANK_WORD[metric].ro} ${b.betterThanOf100} din 100`,
            )
          : "";
      you = `${who}: ${v(b.you)}${place}`;
    }
    out.push({
      metric,
      label: ctx.pick(BAND_LABEL[metric]),
      typical,
      you,
      estimate: metric === "daysToCollect",
    });
  }
  return out;
}

/** "37 de firme cu aceeași activitate și mărime apropiată, din județul Timiș (bilanț 2025)". */
export function peerScopeLine(ctx: DeepPdfContext): string {
  const p = peersOf(ctx);
  if (!p) return "";
  const firms = countText(ctx, p.n, ["firm", "firms"], ["firmă", "firme"]);
  return ctx.t(
    `${firms} with the same activity and a similar size, ${ctx.pick(p.scopeLabel)} (accounts ${p.year})`,
    `${firms} cu aceeași activitate și mărime apropiată, ${ctx.pick(p.scopeLabel)} (bilanț ${p.year})`,
  );
}

/** "De ce acești concurenți", in one line. */
export function whyTheseRivals(ctx: DeepPdfContext): string {
  const p = peersOf(ctx);
  const caen = ctx.report.company.caen2 ?? ctx.report.company.caen3;
  if (!p) return "";
  const band =
    p.sizeBand && Number.isFinite(p.sizeBand[1]) && p.sizeBand[1] > 0
      ? ctx.t(
          `, turnover between ${leiShort(p.sizeBand[0]).en} and ${leiShort(p.sizeBand[1]).en}`,
          `, cifra de afaceri între ${leiShort(p.sizeBand[0]).ro} și ${leiShort(p.sizeBand[1]).ro}`,
        )
      : "";
  return ctx.t(
    `Why these rivals: same activity${caen ? ` (CAEN ${caen})` : ""}${band}, ${ctx.pick(p.scopeLabel)}, from the official annual accounts. You can remove or add one in the online report.`,
    `De ce acești concurenți: aceeași activitate${caen ? ` (CAEN ${caen})` : ""}${band}, ${ctx.pick(p.scopeLabel)}, din bilanțurile oficiale. Poți scoate sau adăuga un concurent în raportul online.`,
  );
}

/* --------------------------------------------------------------- lines */

export function linesOf(ctx: DeepPdfContext): AreaLight[] {
  // Owners read Bani first; a client or supplier reads Risc first (the report's own order).
  const order = ctx.owner
    ? ["bani", "clienti", "online", "echipa", "risc"]
    : ["risc", "bani", "echipa", "online", "clienti"];
  return [...(ctx.report.lights ?? [])].sort(
    (a, b) => order.indexOf(a.area) - order.indexOf(b.area),
  );
}

/* ------------------------------------------------------------- actions */

export function mandatoryActions(ctx: DeepPdfContext): Action[] {
  return (ctx.report.actions ?? []).filter((a) => a.mandatory).sort((a, b) => a.rank - b.rank);
}

export function rankedActions(ctx: DeepPdfContext): Action[] {
  return (ctx.report.actions ?? []).filter((a) => !a.mandatory).sort((a, b) => a.rank - b.rank);
}

/** The plan: must-dos and the 3 shown actions in 30 days, the next two in 60, the rest in 90. */
export function planBuckets(ctx: DeepPdfContext): Array<{ title: string; actions: Action[] }> {
  const ranked = rankedActions(ctx);
  // By when the effect shows: "imediat", "din prima săptămână/lună" → 30 days; "din luna 2" →
  // 60; "în 3–6 luni" and later → 90 (so the plan is not the same list as page 3).
  const bucketOf = (a: Action): 0 | 1 | 2 => {
    const ro = a.firstEffect?.ro ?? "";
    if (/luna 2|1–2 luni|câteva săptămâni|4–6 săptămâni/.test(ro)) return 1;
    if (/3–6 luni|licitație/.test(ro)) return 2;
    return 0;
  };
  const buckets = [
    {
      title: ctx.t("In the next 30 days", "În următoarele 30 de zile"),
      actions: [...mandatoryActions(ctx), ...ranked.filter((a) => bucketOf(a) === 0)],
    },
    {
      title: ctx.t("In 60 days", "În 60 de zile"),
      actions: ranked.filter((a) => bucketOf(a) === 1),
    },
    {
      title: ctx.t("In 90 days", "În 90 de zile"),
      actions: ranked.filter((a) => bucketOf(a) === 2),
    },
  ];
  return buckets.filter((b) => b.actions.length);
}

/** The first time estimate carries the hour value next to it (D4). */
export function hourAssumption(ctx: DeepPdfContext): { actionId: string; text: string } | null {
  for (const a of [...mandatoryActions(ctx), ...rankedActions(ctx)]) {
    if (a.effect?.kind === "time_value_month" && a.effect.assumptions[0]) {
      return { actionId: a.id, text: ctx.pick(a.effect.assumptions[0]) };
    }
  }
  return null;
}

/* -------------------------------------------------------- third party */

export type CheckRow = { label: string; value: string; link?: string };

/** "Ce să verifici înainte să lucrezi cu ei" (third parties, A1 variants). */
export function thirdPartyChecks(ctx: DeepPdfContext): CheckRow[] {
  const rows: CheckRow[] = [];
  const show = (id: string, label?: string) => {
    const f = ctx.fact(id);
    if (f) rows.push({ label: label ?? factLabel(f, ctx.lang), value: factText(ctx, f) });
  };
  show("identity.status");
  // The status already says "plătitoare de TVA": no second row for it.
  if (!/TVA/.test(ctx.fact("identity.status")?.display.ro ?? "")) show("identity.vat_payer");
  show("identity.registered_at");
  const days = peersOf(ctx)?.bands.daysToCollect;
  if (days?.you !== undefined) {
    rows.push({
      label: ctx.t(
        "Days to collect its invoices, against similar firms (estimate; not how fast it pays suppliers)",
        "Zile până își încasează facturile, față de firme similare (estimare; nu arată cât de repede își plătește furnizorii)",
      ),
      value: ctx.t(
        `${Math.round(days.you)} days; a typical similar firm ${Math.round(days.p50)}`,
        `${Math.round(days.you)} de zile; o firmă similară obișnuită ${Math.round(days.p50)}`,
      ),
    });
  }
  for (const id of [
    "risk.courts.as_defendant",
    "risk.courts.as_plaintiff",
    "risk.courts.insolvency_debtor",
  ]) {
    const f = ctx.fact(id);
    if (!f) continue;
    if (f.adverse && f.score < 0.9) {
      rows.push({
        label: factLabel(f, ctx.lang),
        value: ctx.t("check at the source", "verifică la sursă"),
        link: "https://portal.just.ro",
      });
    } else rows.push({ label: factLabel(f, ctx.lang), value: factText(ctx, f) });
  }
  const courtsListed = (ctx.report.registers?.notChecked ?? []).some((r) =>
    /portal\.just\.ro/.test(r.link),
  );
  if (!ctx.fact("risk.courts.checked") && !courtsListed) {
    rows.push({
      label: ctx.t("Court cases", "Dosare în instanță"),
      value: ctx.t("not checked in this report", "neverificate în acest raport"),
      link: "https://portal.just.ro",
    });
  }
  for (const r of ctx.report.registers?.notChecked ?? []) {
    rows.push({
      label: ctx.pick(r.name),
      value: ctx.t("not checked by us", "neverificat de noi"),
      link: r.link,
    });
  }
  return rows;
}

/* -------------------------------------------------------------- labels */

export function relationshipText(ctx: DeepPdfContext): string {
  const map: Record<DeepReport["relationship"], Bilingual> = {
    proprietar: { en: "for the owner or manager", ro: "pentru proprietar sau administrator" },
    angajat: { en: "for someone who works here", ro: "pentru cineva care lucrează aici" },
    client_furnizor: { en: "for a client or supplier", ro: "pentru un client sau furnizor" },
    concurent: { en: "for a competitor", ro: "pentru un concurent" },
    altceva: { en: "for an outside reader", ro: "pentru un cititor din afară" },
  };
  return ctx.pick(map[ctx.report.relationship]);
}

export function aiLabel(ctx: DeepPdfContext): string {
  return ctx.report.aiMode === "ai"
    ? ctx.t(
        'Text drafted with AI (Claude, by Anthropic). Official figures come from filed accounts and registers; estimates are our calculations, marked "Estimate".',
        "Text redactat cu ajutorul inteligenței artificiale (Claude, de la Anthropic). Cifrele oficiale vin din bilanțuri și registre; estimările sunt calculele noastre, marcate «Estimare».",
      )
    : ctx.t(
        'Rule-based analysis, no AI. Official figures come from filed accounts and registers; estimates are our calculations, marked "Estimate".',
        "Analiză pe reguli, fără AI. Cifrele oficiale vin din bilanțuri și registre; estimările sunt calculele noastre, marcate «Estimare».",
      );
}

export function sampleLabel(ctx: DeepPdfContext): string {
  return ctx.t("Sample with an invented company", "Exemplu cu o firmă inventată");
}

/** The PDF's file name: "Vortex-Cercetare-Doriot-Dent-SRL-2026-10-03.pdf" (or "-pe-scurt"). */
export function deepPdfFileName(
  report: DeepReport,
  lang: Lang,
  variant: DeepPdfVariant = "full",
): string {
  const slug =
    (report.company.displayName || report.company.name)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/g, "") || "raport";
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(
    Number.isNaN(new Date(report.generatedAt).getTime())
      ? new Date()
      : new Date(report.generatedAt),
  );
  const head = lang === "ro" ? "Vortex-Cercetare" : "Vortex-Deep-Research";
  const tail = variant === "brief" ? (lang === "ro" ? "-pe-scurt" : "-brief") : "";
  return `${head}-${slug}-${stamp}${tail}.pdf`;
}

import { Tag } from "@/components/system";
import type { DeepReport, Lang, PeerBand } from "@/lib/deep/contracts";
import { formatDecimal } from "@/lib/deep/parse/format";
import { roCount } from "@/lib/deep/report/read";
import { useI18n } from "@/i18n";

import { leiParts, NBSP } from "../format";
import { BandTrack, BarChart, LineChart, type Point } from "./Charts";
import { useReport } from "./context";
import { TAG_13 } from "./helpers";
import { ReportHeading } from "./shared";

/*
 * "Cifre și comparații" (plan A1): the money table 2019–2025, charts whose titles state the
 * conclusion, expenses against revenue, the peer comparisons as sentences with N and scope
 * ("a 3-a din 9" under 20 firms, "mai bine decât 41 din 100" from 20), why these rivals, the
 * rivals as a table on desktop and cards on phones, and the measured values per area (no
 * scores). Tables become one card per row on phones; nothing is cut off.
 */

type Row = {
  year: number;
  turnover?: number;
  pretax?: number;
  net?: number;
  staff?: number;
  expenses?: number;
};

function rows(report: DeepReport): Row[] {
  const byYear = new Map<number, Row>();
  const put = (predicate: string, key: keyof Omit<Row, "year">) => {
    for (const f of report.facts.filter(
      (x) => x.predicate === predicate && /\.\d{4}$/.test(x.id),
    )) {
      const y = Number(f.id.slice(-4));
      const row = byYear.get(y) ?? { year: y };
      if (typeof f.value === "number") row[key] = f.value;
      byYear.set(y, row);
    }
  };
  put("money.turnover", "turnover");
  put("money.profit_pretax", "pretax");
  put("money.profit_net", "net");
  put("people.employees", "staff");
  put("money.expenses", "expenses");
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

const money = (v: number | undefined, lang: Lang) => {
  if (v === undefined) return "—";
  const p = leiParts(v, lang);
  return `${p.value}${NBSP}${p.unit}`;
};

/**
 * How a rank reads for a metric: size is not "better" (more staff is just more), so turnover
 * and staff say "mai mare / mai mulți decât", the margin and growth "mai bine / mai repede".
 */
type RankWord = { en: string; ro: string };
const RANK_WORD: Record<string, RankWord> = {
  turnover: { en: "higher than", ro: "mai mare decât" },
  employees: { en: "more than", ro: "mai mulți decât" },
  revPerEmp: { en: "higher than", ro: "mai mare decât" },
  marginPretax: { en: "better than", ro: "mai bine decât" },
  growth3y: { en: "faster than", ro: "mai repede decât" },
  daysToCollect: { en: "faster than", ro: "mai repede decât" },
};

const METRIC: Record<
  string,
  { label: [string, string]; fmt: (v: number, lang: Lang) => string; higherIsBetter: boolean }
> = {
  turnover: {
    label: ["Turnover", "Cifra de afaceri"],
    fmt: (v, l) => money(v, l),
    higherIsBetter: true,
  },
  marginPretax: {
    label: [
      "Kept of every 100 lei invoiced, before tax",
      "Din 100 de lei facturați rămân, înainte de impozit",
    ],
    fmt: (v) => `${Math.round(v * 100)}${NBSP}lei`,
    higherIsBetter: true,
  },
  employees: {
    label: ["Employees", "Salariați"],
    fmt: (v) => String(Math.round(v)),
    higherIsBetter: true,
  },
  revPerEmp: {
    label: ["Turnover per employee", "Cifra de afaceri pe salariat"],
    fmt: (v, l) => money(v, l),
    higherIsBetter: true,
  },
  growth3y: {
    label: ["Turnover change in 3 years", "Schimbarea cifrei de afaceri în 3 ani"],
    fmt: (v, l) => `${v >= 0 ? "+" : "−"}${formatDecimal(Math.abs(v) * 100, l, 0)}%`,
    higherIsBetter: true,
  },
  daysToCollect: {
    label: ["Days to collect (estimate)", "Zile până la încasare (estimare)"],
    fmt: (v) => String(Math.round(v)),
    higherIsBetter: false,
  },
};

function rankText(metric: string, band: PeerBand, lang: Lang): string {
  if (band.rank)
    return lang === "ro"
      ? `locul ${band.rank.position} din ${band.rank.of}`
      : `position ${band.rank.position} of ${band.rank.of}`;
  if (band.betterThanOf100 !== undefined) {
    const word = RANK_WORD[metric] ?? { en: "better than", ro: "mai bine decât" };
    return lang === "ro"
      ? `${word.ro} ${band.betterThanOf100} din 100`
      : `${word.en} ${band.betterThanOf100} of 100`;
  }
  return "";
}

export function FiguresTab() {
  const { t, lang } = useI18n();
  const { report } = useReport();
  const data = rows(report);
  const growth = report.facts.find((f) => f.id === "money.growth_turnover_3y");
  const trend = report.facts.find((f) => f.id === "money.expenses_vs_revenue");
  const turnoverPoints: Point[] = data
    .filter((r) => r.turnover !== undefined)
    .map((r) => ({ year: r.year, value: r.turnover!, label: leiParts(r.turnover!, lang).value }));
  const marginPoints: Point[] = data
    .filter((r) => r.turnover && r.pretax !== undefined)
    .map((r) => {
      const v = r.pretax! / r.turnover!;
      return { year: r.year, value: v, label: String(Math.round(v * 100)) };
    });
  const lastMargin = marginPoints.at(-1);
  const third = report.audience === "third_party";
  // Titles state the conclusion over the years the chart shows (A10).
  const firstT = turnoverPoints[0];
  const lastT = turnoverPoints.at(-1);
  const g3 = growth?.value as { ratio?: number; from?: number } | undefined;
  const sinceFirst = firstT && lastT && firstT.value > 0 ? lastT.value / firstT.value : undefined;
  const pctOf = (r: number) => `${Math.round(Math.abs(r) * 100)}%`;
  const recent =
    g3 && typeof g3.ratio === "number"
      ? t(
          ` (${g3.ratio >= 0 ? "+" : "−"}${pctOf(g3.ratio)} in the last 3 years)`,
          ` (${g3.ratio >= 0 ? "+" : "−"}${pctOf(g3.ratio)} în ultimii 3 ani)`,
        )
      : "";
  const turnoverTitle =
    firstT && lastT && sinceFirst !== undefined && turnoverPoints.length >= 3
      ? sinceFirst >= 1.9
        ? t(
            `Turnover ${sinceFirst >= 2.9 ? "tripled" : "doubled"} since ${firstT.year}${recent}`,
            `Cifra de afaceri s-a ${sinceFirst >= 2.9 ? "triplat" : "dublat"} din ${firstT.year}${recent}`,
          )
        : sinceFirst >= 1
          ? t(
              `Turnover grew by ${pctOf(sinceFirst - 1)} since ${firstT.year}${recent}`,
              `Cifra de afaceri a crescut cu ${pctOf(sinceFirst - 1)} din ${firstT.year}${recent}`,
            )
          : t(
              `Turnover fell by ${pctOf(1 - sinceFirst)} since ${firstT.year}${recent}`,
              `Cifra de afaceri a scăzut cu ${pctOf(1 - sinceFirst)} din ${firstT.year}${recent}`,
            )
      : growth
        ? t(`Turnover: ${growth.display.en}`, `Cifra de afaceri: ${growth.display.ro}`)
        : t("Turnover by year", "Cifra de afaceri pe ani");
  const firstM = marginPoints[0];
  const k = lastMargin ? Math.round(lastMargin.value * 100) : 0;
  const k0 = firstM ? Math.round(firstM.value * 100) : 0;
  const marginTitle =
    lastMargin && firstM && firstM.year !== lastMargin.year
      ? third
        ? t(
            `Of every 100 lei invoiced, ${k} were left in ${lastMargin.year}, against ${k0} in ${firstM.year}`,
            `Din 100 de lei facturați au rămas ${k} în ${lastMargin.year}, față de ${k0} în ${firstM.year}`,
          )
        : t(
            `Of every 100 lei invoiced you keep ${k}, against ${k0} in ${firstM.year}`,
            `Din 100 de lei îți rămân ${k}, față de ${k0} în ${firstM.year}`,
          )
      : t(
          `Of every 100 lei invoiced, ${k} left before tax`,
          `Din 100 de lei facturați rămân ${k}, înainte de impozit`,
        );

  return (
    <div className="space-y-10">
      <section aria-labelledby="cifre-bani" className="min-w-0">
        <ReportHeading
          id="cifre-bani"
          sub={t(
            "From the annual accounts filed with the Ministry of Finance.",
            "Din bilanțurile depuse la Ministerul Finanțelor.",
          )}
        >
          {t("Money over the years", "Banii, an de an")}
        </ReportHeading>
        {data.length ? (
          <>
            <div className="grid gap-8 lg:grid-cols-2">
              {turnoverPoints.length >= 2 ? (
                <BarChart title={turnoverTitle} points={turnoverPoints} highlightFrom={g3?.from} />
              ) : null}
              {marginPoints.length >= 2 && lastMargin ? (
                <LineChart title={marginTitle} points={marginPoints} />
              ) : null}
            </div>
            {trend ? (
              <p className="mt-4 max-w-[62ch] text-fg-2">
                {t("Expenses against revenue: ", "Cheltuielile față de venituri: ")}
                {trend.display[lang]}.
              </p>
            ) : null}
            <MoneyTable data={data} />
          </>
        ) : (
          <p className="text-fg-2">
            {t("No annual accounts filed yet.", "Încă nu există bilanț depus.")}
          </p>
        )}
      </section>

      <Peers />
      <RivalsTable />
      <Measured />
    </div>
  );
}

function MoneyTable({ data }: { data: Row[] }) {
  const { t, lang } = useI18n();
  const head = [
    t("Year", "Anul"),
    t("Turnover", "Cifra de afaceri"),
    t("Profit before tax", "Profit brut"),
    t("Net profit", "Profit net"),
    t("Employees", "Salariați"),
    t("Total expenses", "Cheltuieli totale"),
  ];
  return (
    <div className="mt-6">
      <table className="w-full border-collapse text-[0.9375rem] max-md:hidden">
        <caption className="sr-only">
          {t("Annual accounts 2019–2025", "Bilanțuri 2019–2025")}
        </caption>
        <thead>
          <tr className="border-b border-rule text-left">
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`py-2 pr-3 text-[0.8125rem] font-medium text-fg-3 ${i ? "text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map((r) => (
            <tr key={r.year} className="border-b border-line-1">
              <th scope="row" className="type-pnum py-2 pr-3 text-left font-medium text-fg">
                {r.year}
              </th>
              <td className="type-num py-2 pr-3 text-right text-fg">{money(r.turnover, lang)}</td>
              <td
                className={`type-num py-2 pr-3 text-right ${r.pretax !== undefined && r.pretax < 0 ? "text-bad" : "text-fg"}`}
              >
                {money(r.pretax, lang)}
              </td>
              <td
                className={`type-num py-2 pr-3 text-right ${r.net !== undefined && r.net < 0 ? "text-bad" : "text-fg"}`}
              >
                {money(r.net, lang)}
              </td>
              <td className="type-num py-2 pr-3 text-right text-fg">{r.staff ?? "—"}</td>
              <td className="type-num py-2 text-right text-fg">{money(r.expenses, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Phones: two narrow tables with the years as rows, so years compare at a glance. */}
      <div className="space-y-5 md:hidden">
        <PhoneTable
          caption={t("Turnover and profit before tax", "Cifra de afaceri și profitul brut")}
          head={[head[0], head[1], head[2]]}
          rows={[...data]
            .reverse()
            .map((r) => [String(r.year), money(r.turnover, lang), money(r.pretax, lang)])}
          bad={[...data]
            .reverse()
            .map((r) => [false, false, r.pretax !== undefined && r.pretax < 0])}
        />
        <PhoneTable
          caption={t(
            "Net profit, employees and expenses",
            "Profitul net, salariații și cheltuielile",
          )}
          head={[head[0], head[3], head[4], head[5]]}
          rows={[...data]
            .reverse()
            .map((r) => [
              String(r.year),
              money(r.net, lang),
              r.staff !== undefined ? String(r.staff) : "—",
              money(r.expenses, lang),
            ])}
          bad={[...data]
            .reverse()
            .map((r) => [false, r.net !== undefined && r.net < 0, false, false])}
        />
      </div>
    </div>
  );
}

function PhoneTable({
  caption,
  head,
  rows,
  bad,
}: {
  caption: string;
  head: string[];
  rows: string[][];
  bad: boolean[][];
}) {
  return (
    <table className="w-full border-collapse text-[0.9375rem]">
      <caption className="mb-1 text-left text-[0.8125rem] font-medium text-fg-3">{caption}</caption>
      <thead>
        <tr className="border-b border-rule text-left">
          {head.map((h, i) => (
            <th
              key={h}
              scope="col"
              className={`py-1.5 pr-2 text-[0.8125rem] font-medium leading-[1.25] text-fg-3 ${i ? "text-right" : ""}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={row[0]} className="border-b border-line-1">
            {row.map((cell, i) =>
              i === 0 ? (
                <th
                  key={i}
                  scope="row"
                  className="type-pnum py-1.5 pr-2 text-left font-medium text-fg"
                >
                  {cell}
                </th>
              ) : (
                <td
                  key={i}
                  className={`type-num whitespace-nowrap py-1.5 pr-2 text-right last:pr-0 ${bad[r]?.[i] ? "text-bad" : "text-fg"}`}
                >
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Peers() {
  const { t, lang } = useI18n();
  const { report } = useReport();
  const third = report.audience === "third_party";
  const peers = report.peers;
  const gap = report.gaps.find((g) => g.section === "peers");
  return (
    <section aria-labelledby="cifre-comparatie" className="min-w-0">
      <ReportHeading
        id="cifre-comparatie"
        sub={
          peers
            ? t(
                `${peers.n} firms with the same activity and a similar size ${peers.scopeLabel.en} (turnover ${money(peers.sizeBand[0], lang)}–${money(peers.sizeBand[1], lang)}), accounts ${peers.year}.`,
                `${roCount(peers.n, "firme")} cu aceeași activitate și mărime apropiată ${peers.scopeLabel.ro} (cifra de afaceri ${money(peers.sizeBand[0], lang)}–${money(peers.sizeBand[1], lang)}), bilanț ${peers.year}.`,
              )
            : undefined
        }
      >
        {t("Compared with similar firms", "Comparat cu firme similare")}
      </ReportHeading>
      {peers ? (
        <ul className="border-t border-line-1">
          {Object.entries(peers.bands).map(([metric, band]) => {
            const m = METRIC[metric];
            if (!band || !m) return null;
            const rank = band.you !== undefined ? rankText(metric, band, lang) : "";
            return (
              <li
                key={metric}
                className="grid gap-x-6 gap-y-1 border-b border-line-1 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] md:items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium text-fg">{t(m.label[0], m.label[1])}</p>
                  <p className="text-fg-2">
                    {band.you !== undefined ? (
                      <>
                        {third ? t("The company: ", "Firma: ") : lang === "ro" ? "Tu: " : "You: "}
                        <span className="type-pnum font-medium text-fg">
                          {m.fmt(band.you, lang)}
                        </span>
                        {rank ? ` · ${rank}` : ""}
                        {" · "}
                      </>
                    ) : null}
                    {lang === "ro" ? "o firmă obișnuită: " : "a typical firm: "}
                    <span className="type-pnum">{m.fmt(band.p50, lang)}</span>
                    {lang === "ro"
                      ? "; jumătate dintre firme sunt între "
                      : "; half of the firms are between "}
                    <span className="type-pnum">{m.fmt(band.p25, lang)}</span>
                    {lang === "ro" ? " și " : " and "}
                    <span className="type-pnum">{m.fmt(band.p75, lang)}</span>
                    {metric === "daysToCollect" ? (
                      <>
                        {" "}
                        <Tag variant="dashed" className={`${TAG_13} align-[1px]`}>
                          {t("Estimate", "Estimare")}
                        </Tag>
                      </>
                    ) : null}
                  </p>
                  {metric === "daysToCollect" && band.you !== undefined ? (
                    <p className="text-[0.875rem] text-fg-3">
                      {band.you > band.p75
                        ? third
                          ? t(
                              "It collects more slowly than most similar firms.",
                              "Încasează mai încet decât majoritatea firmelor similare.",
                            )
                          : t(
                              "You collect more slowly than most similar firms.",
                              "Încasezi mai încet decât majoritatea firmelor similare.",
                            )
                        : band.you < band.p25
                          ? third
                            ? t(
                                "It collects faster than most similar firms.",
                                "Încasează mai repede decât majoritatea firmelor similare.",
                              )
                            : t(
                                "You collect faster than most similar firms.",
                                "Încasezi mai repede decât majoritatea firmelor similare.",
                              )
                          : third
                            ? t(
                                "It collects about as fast as half of the similar firms.",
                                "Încasează cam la fel de repede ca jumătate dintre firmele similare.",
                              )
                            : t(
                                "You collect about as fast as half of the similar firms.",
                                "Încasezi cam la fel de repede ca jumătate dintre firmele similare.",
                              )}
                    </p>
                  ) : null}
                </div>
                <BandTrack p25={band.p25} p50={band.p50} p75={band.p75} you={band.you} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="max-w-[62ch] text-fg-2">
          {gap?.where[lang] ??
            t(
              "The comparison appears after we load the Ministry of Finance accounts.",
              "Comparația apare după ce încărcăm bilanțurile Ministerului Finanțelor.",
            )}
        </p>
      )}
      {peers ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-fg-3">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-5 rounded-[2px] bg-fg-3/75" />
            {t("half of the firms", "jumătate dintre firme")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-px bg-fg-2" />
            {t("a typical firm", "o firmă obișnuită")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rotate-45 bg-brand-line" />
            {third ? t("the company", "firma") : t("you", "tu")}
          </span>
        </p>
      ) : null}
    </section>
  );
}

function RivalsTable() {
  const { t, lang } = useI18n();
  const { report } = useReport();
  const list = report.competitors;
  if (!list.length) return null;
  const why = list.find((c) => c.origin === "official")?.whyChosen;
  const yes = t("Yes", "Da");
  const no = t("Not found", "Nu am găsit");
  return (
    <section aria-labelledby="cifre-concurenti" className="min-w-0">
      <ReportHeading
        id="cifre-concurenti"
        sub={why ? `${t("Why these rivals", "De ce acești concurenți")}: ${why[lang]}.` : undefined}
      >
        {t("Rivals, side by side", "Concurenții, unul lângă altul")}
      </ReportHeading>
      <table className="w-full border-collapse text-[0.9375rem] max-md:hidden">
        <thead>
          <tr className="border-b border-rule text-left">
            {[
              t("Company", "Firma"),
              t("Turnover", "Cifra de afaceri"),
              t("Profit before tax", "Profit brut"),
              t("Employees", "Salariați"),
              t("Online booking", "Programare online"),
            ].map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`py-2 pr-3 text-[0.8125rem] font-medium text-fg-3 ${i ? "text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.cui} className="border-b border-line-1">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-fg">
                {c.name}
                <span className="block text-[0.8125rem] font-normal text-fg-3">{c.city}</span>
              </th>
              <td className="type-num py-2 pr-3 text-right text-fg">{money(c.turnover, lang)}</td>
              <td className="type-num py-2 pr-3 text-right text-fg">
                {money(c.profitPretax, lang)}
              </td>
              <td className="type-num py-2 pr-3 text-right text-fg">{c.employees ?? "—"}</td>
              <td className="py-2 text-right text-fg-2">
                {c.booking === undefined ? "—" : c.booking ? yes : no}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="border-t border-line-1 md:hidden">
        {list.map((c) => (
          <li key={c.cui} className="border-b border-line-1 py-3">
            <p className="font-medium text-fg">{c.name}</p>
            <p className="text-[0.8125rem] text-fg-3">{c.city}</p>
            <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                [t("Turnover", "Cifra de afaceri"), money(c.turnover, lang)],
                [t("Profit before tax", "Profit brut"), money(c.profitPretax, lang)],
                [
                  t("Employees", "Salariați"),
                  c.employees !== undefined ? String(c.employees) : "—",
                ],
                [
                  t("Online booking", "Programare online"),
                  c.booking === undefined ? "—" : c.booking ? yes : no,
                ],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[0.8125rem] text-fg-3">{label}</dt>
                  <dd className="type-num text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The measured values per area (no 0–100 scores, D3). */
function Measured() {
  const { t, lang } = useI18n();
  const { report } = useReport();
  const get = (id: string) => report.facts.find((f) => f.id === id);
  const rows: Array<[string, string | undefined]> = [
    [
      t("Website checks: important", "Verificări ale site-ului: importante"),
      get("site.audit.important")?.display[lang],
    ],
    [
      t("Website checks: minor", "Verificări ale site-ului: mărunte"),
      get("site.audit.minor")?.display[lang],
    ],
    [
      t("Website checks: fine", "Verificări ale site-ului: în regulă"),
      get("site.audit.ok")?.display[lang],
    ],
    [t("Speed on a phone", "Viteza pe telefon"), get("site.speed.mobile")?.display[lang]],
    [t("Pages read", "Pagini citite"), get("site.pages_read")?.display[lang]],
    [
      t("Cases opened (36 months)", "Procese deschise (36 de luni)"),
      get("risk.courts.as_plaintiff")?.display[lang],
    ],
    [
      t("Taken to court (36 months)", "Dată în judecată (36 de luni)"),
      get("risk.courts.as_defendant")?.display[lang],
    ],
    [t("EU tenders won", "Licitații europene câștigate"), get("risk.ted.awards")?.display[lang]],
  ];
  const shown = rows.filter(([, v]) => v);
  if (!shown.length) return null;
  return (
    <section aria-labelledby="cifre-masurat" className="min-w-0">
      <ReportHeading
        id="cifre-masurat"
        sub={t(
          "We give no 0–100 scores: these are the values as measured.",
          "Nu dăm note de la 0 la 100: acestea sunt valorile, așa cum le-am măsurat.",
        )}
      >
        {t("What we measured", "Ce am măsurat")}
      </ReportHeading>
      <dl className="border-t border-line-1">
        {shown.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-x-6 border-b border-line-1 py-2 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]"
          >
            <dt className="text-[0.875rem] text-fg-3">{label}</dt>
            <dd className="text-fg">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

import type { Audience, Bilingual, Fact, Finding, Lang } from "../contracts";
import { leiShort } from "../parse/format";

import { changePct, keptOf100, leiFromTo, readFacts, SITE_BROKEN } from "./read";

/*
 * The three findings of "Pe scurt" (plan A1 item 7): one big figure, one
 * everyday sentence, the facts behind it. Ranked by code: problems first (a
 * loss, keeping less than similar firms, expenses growing faster than
 * revenue, a shrinking team, a broken website, court cases), then what goes
 * well (growth, rank among similar firms, public contracts). At most two of
 * the three are about money, so the reader sees more than one side.
 */

const bi = (en: string, ro: string): Bilingual => ({ en, ro });

type Candidate = Omit<Finding, "rank"> & { score: number; money: boolean };

/** The finding that says what a headline already says (dropped so the page does not repeat it). */
const SAME_AS_HEADLINE: Record<string, string> = {
  "bani.loss": "finding.loss",
  "bani.margin_falling": "finding.margin",
  "bani.growing_keeps_less": "finding.margin",
  "bani.margin_below": "finding.margin",
  "bani.margin_down": "finding.margin",
  "risc.defendant": "finding.courts",
  "positive.growth": "finding.turnover",
  "money.turnover_down": "finding.turnover",
  "money.turnover_down_costs_up": "finding.turnover",
  "money.expenses_faster": "finding.expenses",
};

export function computeFindings(
  facts: Fact[],
  ctx: { audience: Audience; lang?: Lang; headlineKey?: string },
): Finding[] {
  const r = readFacts(facts);
  const owner = ctx.audience === "owner";
  const out: Candidate[] = [];
  const you = (ownerRo: string, thirdRo: string) => (owner ? ownerRo : thirdRo);
  const youEn = (ownerEn: string, thirdEn: string) => (owner ? ownerEn : thirdEn);

  const net = r.latest("money.profit_net");
  if (net && net.value < 0) {
    out.push({
      id: "finding.loss",
      figure: net.fact.short ?? net.fact.display,
      sentence: bi(
        youEn(
          `You closed ${net.year} with a net loss.`,
          `The company closed ${net.year} with a net loss.`,
        ),
        you(`Ai încheiat ${net.year} pe pierdere.`, `Firma a încheiat ${net.year} pe pierdere.`),
      ),
      factIds: [net.fact.id],
      score: 100,
      money: true,
    });
  }

  const margin = r.latest("money.margin_pretax");
  const band = r.band("marginPretax");
  if (margin) {
    const k = keptOf100(margin.value);
    const typical = band ? keptOf100(band.p50) : undefined;
    const below = band !== undefined && margin.value < band.p50;
    const lei = k === 1 || k === -1 ? "leu" : "lei";
    // "ți-au rămas 9 lei", "ți-a rămas un leu", "nu ți-a rămas nimic"
    const keptRo = (owner: boolean) => {
      const pron = owner ? "ți-" : "firmei i-";
      if (k <= 0) return owner ? "nu ți-a rămas nimic" : "firmei nu i-a rămas nimic";
      if (k === 1) return `${pron}a rămas un leu`;
      return `${pron}au rămas ${k} lei`;
    };
    const tail = typical !== undefined;
    out.push({
      id: "finding.margin",
      figure: bi(`${k} ${lei} of 100`, k === 1 ? "un leu din 100" : `${k} lei din 100`),
      sentence: bi(
        youEn(
          `Of every 100 lei invoiced in ${margin.year} you kept ${k} before tax${tail ? `; a typical similar firm keeps ${typical}` : ""}.`,
          `Of every 100 lei invoiced in ${margin.year} the company kept ${k} before tax${tail ? `; a typical similar firm keeps ${typical}` : ""}.`,
        ),
        you(
          `Din fiecare 100 de lei facturați în ${margin.year} ${keptRo(true)}, înainte de impozit${tail ? `; o firmă obișnuită din activitatea ta păstrează ${typical}` : ""}.`,
          `Din fiecare 100 de lei facturați în ${margin.year} ${keptRo(false)}, înainte de impozit${tail ? `; o firmă obișnuită din aceeași activitate păstrează ${typical}` : ""}.`,
        ),
      ),
      factIds: [margin.fact.id, ...(band ? [band.fact.id] : [])],
      score: below ? 90 : 40,
      money: true,
    });
  }

  const trend = r.get("money.expenses_vs_revenue");
  const t = trend?.value as { expenses?: number; revenue?: number } | undefined;
  if (
    trend &&
    t &&
    typeof t.expenses === "number" &&
    typeof t.revenue === "number" &&
    t.expenses > t.revenue + 0.05
  ) {
    out.push({
      id: "finding.expenses",
      figure: bi(signed(t.expenses), signed(t.expenses)),
      sentence: bi(`${trend.display.en}.`, `${capFirst(trend.display.ro)}.`),
      factIds: [trend.id],
      score: 80,
      money: true,
    });
  }

  const staff = r.get("people.employees_change");
  const s = staff?.value as
    | { ratio?: number; from?: number; to?: number; fromYear?: number; toYear?: number }
    | undefined;
  if (
    staff &&
    s &&
    typeof s.ratio === "number" &&
    s.ratio <= -0.3 &&
    (s.from ?? 0) - (s.to ?? 0) >= 2
  ) {
    out.push({
      id: "finding.team",
      figure: bi(`${s.from} → ${s.to}`, `${s.from} → ${s.to}`),
      sentence: bi(
        `Average employees went from ${s.from} to ${s.to} between ${s.fromYear} and ${s.toYear}.`,
        `Numărul mediu de salariați a scăzut de la ${s.from} la ${s.to} între ${s.fromYear} și ${s.toYear}.`,
      ),
      factIds: [staff.id],
      score: 75,
      money: false,
    });
  }

  const status = r.websiteStatus();
  const statusFact = r.get("site.status");
  if (statusFact && status && SITE_BROKEN.includes(status)) {
    const text: Record<string, Bilingual> = {
      parked: bi(
        "The address of the website shows a parked or for-sale domain.",
        "Adresa site-ului arată un domeniu parcat sau de vânzare.",
      ),
      dead: bi("The address of the website does not open.", "Adresa site-ului nu se deschide."),
      broken_certificate: bi(
        "Browsers warn visitors that the website's security certificate is invalid.",
        "Browserele îi avertizează pe vizitatori că certificatul de securitate al site-ului e invalid.",
      ),
    };
    out.push({
      id: "finding.site",
      figure: statusFact.short ?? statusFact.display,
      sentence: text[status],
      factIds: [statusFact.id],
      score: 85,
      money: false,
    });
  }

  const defendant = r.get("risk.courts.as_defendant");
  const dn = typeof defendant?.value === "number" ? defendant.value : 0;
  if (defendant && dn > 0 && defendant.score >= 0.9) {
    out.push({
      id: "finding.courts",
      figure: bi(String(dn), String(dn)),
      sentence:
        dn === 1
          ? bi(
              youEn(
                "Your company was taken to court once in the last 3 years.",
                "The company was taken to court once in the last 3 years.",
              ),
              you(
                "Firma ta a fost dată în judecată o dată în ultimii 3 ani.",
                "Firma a fost dată în judecată o dată în ultimii 3 ani.",
              ),
            )
          : bi(
              youEn(
                `Your company was taken to court ${dn} times in the last 3 years.`,
                `The company was taken to court ${dn} times in the last 3 years.`,
              ),
              you(
                `Firma ta a fost dată în judecată de ${dn} ori în ultimii 3 ani.`,
                `Firma a fost dată în judecată de ${dn} ori în ultimii 3 ani.`,
              ),
            ),
      factIds: [defendant.id],
      score: 70,
      money: false,
    });
  }

  const turnover = r.latest("money.turnover");
  const growth = r.get("money.growth_turnover");
  const g = growth?.value as { ratio?: number; from?: number; to?: number } | undefined;
  if (turnover) {
    const prev = r.series("money.turnover").find((x) => x.year === turnover.year - 1);
    const grew = typeof g?.ratio === "number" && g.ratio > 0;
    const flat = typeof g?.ratio === "number" && Math.abs(g.ratio) < 0.005;
    // One percent format on the page (the headline says the same number) and one money unit.
    const p = typeof g?.ratio === "number" ? changePct(g.ratio) : undefined;
    const span = prev ? leiFromTo(prev.value, turnover.value, leiShort) : undefined;
    out.push({
      id: "finding.turnover",
      figure: turnover.fact.short ?? leiShort(turnover.value),
      sentence:
        growth && prev && p && span
          ? flat
            ? bi(
                `Turnover stayed about the same between ${prev.year} and ${turnover.year}: ${span.en}.`,
                `Cifra de afaceri a rămas aproape la fel între ${prev.year} și ${turnover.year}: ${span.ro}.`,
              )
            : bi(
                `Turnover ${grew ? "grew" : "fell"} by ${p.en} between ${prev.year} and ${turnover.year}, ${span.en}.`,
                `Cifra de afaceri a ${grew ? "crescut" : "scăzut"} cu ${p.ro} între ${prev.year} și ${turnover.year}, ${span.ro}.`,
              )
          : bi(`Turnover in ${turnover.year}.`, `Cifra de afaceri în ${turnover.year}.`),
      factIds: [turnover.fact.id, ...(prev ? [prev.fact.id] : []), ...(growth ? [growth.id] : [])],
      score: grew ? 50 : typeof g?.ratio === "number" && g.ratio < -0.1 ? 65 : 35,
      money: true,
    });
  }

  const rank = r.get("peers.rank.turnover");
  const scope = r.get("peers.scope");
  if (rank && scope) {
    const v = rank.value as { rank?: { position: number; of: number }; betterThanOf100?: number };
    out.push({
      id: "finding.peers",
      figure: v.rank
        ? rank.display
        : bi(
            `higher than ${v.betterThanOf100} of 100`,
            `mai mare decât ${v.betterThanOf100} din 100`,
          ),
      sentence: v.rank
        ? bi(
            `By turnover, ${youEn("you are", "the company is")} number ${v.rank.position} of ${v.rank.of} similar firms (${scope.display.en}).`,
            `După cifra de afaceri, ${you("ești", "firma este")} pe locul ${v.rank.position} din ${v.rank.of} firme similare (${scope.display.ro}).`,
          )
        : bi(
            `${youEn("Your", "The company's")} turnover is higher than that of ${v.betterThanOf100} of 100 similar firms (${scope.display.en}).`,
            `${you("Ai", "Firma are")} o cifră de afaceri mai mare decât ${v.betterThanOf100} din 100 de firme similare (${scope.display.ro}).`,
          ),
      factIds: [rank.id, scope.id],
      score: 45,
      money: false,
    });
  }

  const ted = r.get("risk.ted.awards");
  if (ted && typeof ted.value === "number" && ted.value > 0) {
    out.push({
      id: "finding.tenders",
      figure: ted.display,
      sentence: bi(
        `Public contracts won, in the European tenders register (TED): ${ted.display.en}.`,
        `Contracte publice câștigate, în registrul european de licitații (TED): ${ted.display.ro}.`,
      ),
      factIds: [ted.id],
      score: 30,
      money: false,
    });
  }

  const skip = ctx.headlineKey ? SAME_AS_HEADLINE[ctx.headlineKey] : undefined;
  const pool = out.filter((c) => c.id !== skip);
  const picked: Candidate[] = [];
  for (const c of [...pool].sort((a, b) => b.score - a.score)) {
    if (picked.length >= 3) break;
    if (c.money && picked.filter((p) => p.money).length >= 2) continue;
    picked.push(c);
  }
  // Fewer than three non-money candidates: fill with the remaining money ones.
  for (const c of [...pool].sort((a, b) => b.score - a.score)) {
    if (picked.length >= 3) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked.map(({ score: _s, money: _m, ...f }, i) => ({ ...f, rank: i + 1 }));
}

/** "+23%" / "-61%". */
const signed = (ratio: number) => `${ratio >= 0 ? "+" : "-"}${Math.abs(Math.round(ratio * 100))}%`;

const capFirst = (s: string) => {
  // "2022–2025: cheltuielile …" stays as written; a leading letter is capitalised.
  return /^\p{Ll}/u.test(s) ? s[0].toUpperCase() + s.slice(1) : s;
};

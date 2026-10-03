import { AnafLimitError } from "../anaf-pacer.server";
import type { Fact, Gap, PeerBand, StepResult } from "../contracts";
import type { StepEnv } from "../env.server";
import {
  MIN_PEERS_SHOWN,
  parseFinShard,
  peerBands,
  pickRivals,
  selectPeers,
  type FinRow,
  type PeerSubject,
} from "../parse/fin-shard";
import { bi, count, lei, leiShort, pct } from "../parse/format";
import { caenRev3ToRev2, cleanCui, isValidCui, parseAnafV9 } from "../parse/registry";

import { fact, gap, isoDay, type StepDraft } from "./common.server";
import { prettyName } from "./start.server";

/*
 * Step 4, "peers" (plan A3, D5, D8): same activity, similar size, near you,
 * only from the Ministry of Finance shard (official annual accounts). The
 * activity is the CAEN Rev.2 class the company filed under (money step), else
 * its Rev.3 class mapped to Rev.2. One ANAF v9 batch confirms the five named
 * rivals (status and name). Without the shard, peers are a gap: never a
 * fallback to name matches. The owner may remove a rival or add one
 * (≤ 3 edits per run); an added CUI must exist in the shard or the index.
 */

const SCOPE_LABEL = {
  oras: (city?: string) => bi(`in ${city ?? "your town"}`, `din ${city ?? "orașul tău"}`),
  judet: (county?: string) =>
    bi(`in ${county ?? "your county"} county`, `din județul ${county ?? "tău"}`),
  national: () => bi("across Romania", "din toată țara"),
};

const latestValue = (
  facts: Fact[],
  predicate: string,
): { value: number; year: number } | undefined => {
  const hits = facts
    .filter((f) => f.predicate === predicate && typeof f.value === "number")
    .map((f) => ({ value: f.value as number, year: Number(/\.(\d{4})$/.exec(f.id)?.[1] ?? 0) }))
    .sort((a, b) => b.year - a.year);
  return hits[0];
};

function bandDisplay(metric: string, band: PeerBand): { en: string; ro: string } {
  const fmt = (v: number) =>
    metric === "marginPretax" || metric === "growth3y"
      ? pct(v)
      : metric === "employees"
        ? count(Math.round(v))
        : metric === "daysToCollect"
          ? bi(`${Math.round(v)} days`, `${Math.round(v)} de zile`)
          : leiShort(Math.round(v));
  const lo = fmt(band.p25);
  const mid = fmt(band.p50);
  const hi = fmt(band.p75);
  return bi(
    `typical firm ${mid.en}; most between ${lo.en} and ${hi.en} (${band.n} firms)`,
    `o firmă obișnuită: ${mid.ro}; majoritatea între ${lo.ro} și ${hi.ro} (${band.n} firme)`,
  );
}

export async function runPeers(
  env: StepEnv,
  input: { money: StepResult; edits?: { remove: string[]; add: string[] } },
): Promise<StepDraft> {
  const today = isoDay(env.now());
  const facts: Fact[] = [];
  const gaps: Gap[] = [];
  const moneyFacts = input.money.facts;
  const caen2Fact = moneyFacts.find((f) => f.predicate === "money.caen_rev2");
  const fromFiling = (caen2Fact?.value as { code?: string } | undefined)?.code;
  const fromMap = env.identity.caen3
    ? caenRev3ToRev2(env.identity.caen3, env.data.caenRev3ToRev2)[0]
    : undefined;
  const caen4 = fromFiling ?? fromMap;
  const noPeers = (why: { en: string; ro: string }): StepDraft => ({
    status: "skipped",
    facts,
    gaps: [
      ...gaps,
      gap(
        "peers",
        bi("Comparison with similar firms", "Comparația cu firmele similare"),
        why,
        today,
      ),
    ],
    counters: { anafCalls: env.anaf.calls(), peers: 0 },
    next: { anafNextAt: env.anaf.nextAt() },
  });
  if (!caen4)
    return noPeers(bi("The activity code is not known", "Codul de activitate nu este cunoscut"));
  const shard = await env.shards.fin(caen4, env.identity.countyCode);
  if (!shard) {
    return noPeers(
      bi(
        "The comparison appears once we load the Ministry of Finance annual accounts",
        "Comparația apare după ce încărcăm bilanțurile Ministerului Finanțelor",
      ),
    );
  }
  const rows = parseFinShard(shard);
  const turnover = latestValue(moneyFacts, "money.turnover");
  const year = turnover?.year ?? new Date(env.now()).getUTCFullYear() - 1;
  const subject: PeerSubject = {
    cui: env.cui,
    countyCode: env.identity.countyCode,
    city: env.identity.city,
    turnover: turnover?.value,
    turnoverPrev: moneyFacts.find((f) => f.id === `money.turnover.${year - 1}`)?.value as
      | number
      | undefined,
    profitPretax: moneyFacts.find((f) => f.id === `money.profit_pretax.${year}`)?.value as
      | number
      | undefined,
    employees: moneyFacts.find((f) => f.id === `people.employees.${year}`)?.value as
      | number
      | undefined,
    receivables: moneyFacts.find((f) => f.id === `money.receivables.${year}`)?.value as
      | number
      | undefined,
  };
  const selection = selectPeers(rows, subject);
  if (!selection || selection.peers.length < MIN_PEERS_SHOWN) {
    return noPeers(
      bi(
        `Fewer than ${MIN_PEERS_SHOWN} similar firms with filed accounts`,
        `Mai puțin de ${MIN_PEERS_SHOWN} firme similare cu bilanț depus`,
      ),
    );
  }
  const scopeLabel =
    selection.scope === "oras"
      ? SCOPE_LABEL.oras(env.identity.city)
      : selection.scope === "judet"
        ? SCOPE_LABEL.judet(env.identity.county)
        : SCOPE_LABEL.national();
  const base = {
    section: "peers" as const,
    source: "mf_bulk" as const,
    asOf: `FY${year}`,
    confidence: "calculat" as const,
    method: "bulk" as const,
  };
  facts.push(
    fact({
      ...base,
      id: "peers.scope",
      predicate: "peers.scope",
      value: { scope: selection.scope, caen: caen4 },
      display: scopeLabel,
    }),
    fact({
      ...base,
      id: "peers.n",
      predicate: "peers.n",
      value: selection.peers.length,
      display: count(selection.peers.length),
    }),
  );
  if (Number.isFinite(selection.band[1])) {
    facts.push(
      fact({
        ...base,
        id: "peers.size_band",
        predicate: "peers.size_band",
        value: selection.band,
        display: bi(
          `${leiShort(selection.band[0]).en} – ${leiShort(selection.band[1]).en}`,
          `${leiShort(selection.band[0]).ro} – ${leiShort(selection.band[1]).ro}`,
        ),
      }),
    );
  }
  const bands = peerBands(selection.peers, subject);
  for (const [metric, band] of Object.entries(bands)) {
    if (!band) continue;
    const estimate = metric === "daysToCollect";
    facts.push(
      fact({
        ...base,
        id: `peers.band.${metric}`,
        predicate: "peers.band",
        value: { metric, ...band },
        display: bandDisplay(metric, band),
        confidence: estimate ? "estimare" : "calculat",
      }),
    );
    if (band.you !== undefined && (band.rank || band.betterThanOf100 !== undefined)) {
      facts.push(
        fact({
          ...base,
          id: `peers.rank.${metric}`,
          predicate: "peers.rank",
          value: { metric, rank: band.rank, betterThanOf100: band.betterThanOf100, n: band.n },
          display: band.rank
            ? bi(
                `position ${band.rank.position} of ${band.rank.of}`,
                `locul ${band.rank.position} din ${band.rank.of}`,
              )
            : bi(
                `better than ${band.betterThanOf100} of 100`,
                `mai bine decât ${band.betterThanOf100} din 100`,
              ),
          confidence: estimate ? "estimare" : "calculat",
        }),
      );
    }
  }

  // Five named rivals, edited by the owner (≤ 3 edits), confirmed by one ANAF batch.
  // Owner edits arrive as typed ("RO123…"): normalised and checksum-validated, invalid ones dropped.
  const normal = (list?: string[]) =>
    [...new Set((list ?? []).map((c) => cleanCui(String(c))).filter((c): c is string => !!c))]
      .filter((c) => isValidCui(c))
      .slice(0, 3);
  const removed = new Set(normal(input.edits?.remove));
  const added = normal(input.edits?.add).slice(0, Math.max(0, 3 - removed.size));
  const byCui = new Map(rows.map((r) => [r.cui, r]));
  const chosen: Array<{ row?: FinRow; cui: string; origin: "official" | "owner_added" }> =
    pickRivals(
      selection.peers.filter((p) => !removed.has(p.cui)),
      subject,
      5,
    ).map((row) => ({ row, cui: row.cui, origin: "official" as const }));
  for (const cui of added) {
    if (cui === env.cui || chosen.some((c) => c.cui === cui)) continue;
    chosen.push({ row: byCui.get(cui), cui, origin: "owner_added" });
  }
  const names = new Map<
    string,
    { name: string; city?: string; website?: string; active: boolean }
  >();
  await Promise.all(
    chosen.map(async (c) => {
      const hit = await env.index.byCui(c.cui).catch(() => null);
      if (hit)
        names.set(c.cui, {
          name: hit.name,
          city: hit.city,
          website: hit.website,
          active: hit.status !== "inactive",
        });
    }),
  );
  let anafOk = false;
  try {
    // No rival to confirm: no ANAF call.
    const records = chosen.length ? await env.anaf.v9(chosen.map((c) => c.cui)) : [];
    anafOk = true;
    for (const record of records) {
      const parsed = parseAnafV9(record);
      if (!parsed.cui) continue;
      const known = names.get(parsed.cui);
      names.set(parsed.cui, {
        name: parsed.name || known?.name || parsed.cui,
        city: known?.city,
        website: known?.website,
        active: parsed.status === "activ" && !parsed.naturalPerson,
      });
    }
  } catch (error) {
    if (!(error instanceof AnafLimitError)) env.log({ peers: "anaf", error: String(error) });
  }
  for (const c of chosen) {
    const info = names.get(c.cui);
    if (!info || !info.active) continue;
    if (c.origin === "owner_added" && !c.row && !info) continue;
    const r = c.row;
    const display = prettyName(info.name);
    const why =
      c.origin === "owner_added"
        ? bi("Added by you", "Adăugat de tine")
        : bi(
            `Same activity (CAEN ${caen4}), similar size, ${scopeLabel.en}`,
            `Aceeași activitate (CAEN ${caen4}), mărime apropiată, ${scopeLabel.ro}`,
          );
    facts.push(
      fact({
        id: `peers.rival.${c.cui}`,
        section: "competitors",
        predicate: "peers.rival",
        value: {
          cui: c.cui,
          name: display,
          city: info.city,
          turnover: r?.turnover,
          turnoverPrev: r?.turnoverPrev,
          profitPretax: r?.profitPretax,
          employees: r?.employees,
          website: info.website,
          origin: c.origin,
          whyChosen: why,
        },
        display: bi(
          `${display}${r ? ` · ${leiShort(r.turnover).en}` : ""}${r?.employees ? ` · ${r.employees} employees` : ""}`,
          `${display}${r ? ` · ${leiShort(r.turnover).ro}` : ""}${r?.employees ? ` · ${r.employees} salariați` : ""}`,
        ),
        short: r ? lei(r.turnover) : undefined,
        source: r ? "mf_bulk" : "onrc",
        asOf: r ? `FY${year}` : today,
        confidence: c.origin === "owner_added" ? "declarat" : "confirmat",
        method: "bulk",
      }),
    );
  }
  if (!anafOk) {
    gaps.push(
      gap(
        "competitors",
        bi("Rivals' current status", "Starea actuală a concurenților"),
        bi(
          "ANAF did not answer; names from the Trade Register",
          "ANAF nu a răspuns; numele sunt din Registrul Comerțului",
        ),
        today,
      ),
    );
  }
  return {
    status: "done",
    facts,
    gaps,
    counters: {
      anafCalls: env.anaf.calls(),
      peers: selection.peers.length,
      rivals: facts.filter((f) => f.predicate === "peers.rival").length,
    },
    next: { anafNextAt: env.anaf.nextAt() },
  };
}

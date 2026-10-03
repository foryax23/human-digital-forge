import type {
  Action,
  AreaLight,
  Audience,
  Bilingual,
  CitedSentence,
  Fact,
  Lang,
} from "../contracts";

import { marginYearsBefore } from "./lights";
import { changePct, keptOf100, readFacts } from "./read";

/*
 * The verdict headline (plan A8, D26): from Bani or Risc whenever either is
 * not clean (the worse of the two); otherwise a positive or neutral sentence.
 * One sentence, consequence first, short enough for two lines on a phone
 * (A10): the next step lives in "Ce înseamnă pentru tine" and the actions, so
 * the headline can never name an area the actions do not show. The headline
 * key names the line it comes from, so a test can assert the headline never
 * contradicts the lines.
 */

const bi = (en: string, ro: string): Bilingual => ({ en, ro });

export type Headline = {
  key: string;
  /** The line the headline rests on ("bani", "risc", or none for positive and neutral ones). */
  area?: "bani" | "risc";
  text: Bilingual;
  factIds: string[];
};

/** Owner templates stay within this many characters (two lines at 24 px on a 390 px phone). */
export const HEADLINE_MAX = 70;

const SEVERITY = { de_rezolvat: 2, atentie: 1 } as Record<string, number>;

export function computeHeadline(
  facts: Fact[],
  lights: AreaLight[],
  _actions: Action[],
  ctx: { audience: Audience; name: string },
): Headline {
  const r = readFacts(facts);
  const owner = ctx.audience === "owner";
  const subj = (ownerRo: string, ownerEn: string, thirdRo: string, thirdEn: string) =>
    owner ? bi(ownerEn, ownerRo) : bi(thirdEn, thirdRo);
  const name = ctx.name;
  const bani = lights.find((l) => l.area === "bani");
  const risc = lights.find((l) => l.area === "risc");

  // Risk wins a tie: an inactive firm matters more than its margin.
  const worst = [risc, bani]
    .filter((l): l is AreaLight => Boolean(l && SEVERITY[l.state]))
    .sort((a, b) => SEVERITY[b.state] - SEVERITY[a.state])[0];

  if (worst?.area === "risc") {
    const status = r.get("identity.status");
    if (status && status.value === "radiat")
      return {
        key: "risc.struck_off",
        area: "risc",
        factIds: [status.id],
        text: subj(
          "Firma ta apare radiată din Registrul Comerțului.",
          "Your company shows as struck off the Trade Register.",
          `${name} apare radiată din Registrul Comerțului.`,
          `${name} shows as struck off the Trade Register.`,
        ),
      };
    if (status && status.value !== "activ")
      return {
        key: "risc.inactive",
        area: "risc",
        factIds: [status.id],
        text: subj(
          "Firma ta apare inactivă la ANAF: e primul lucru de rezolvat.",
          "Your company shows as inactive at ANAF: fix that first.",
          `${name} apare inactivă la ANAF: e primul lucru de verificat.`,
          `${name} shows as inactive at ANAF: check that first.`,
        ),
      };
    const insolvency = r.get("risk.courts.insolvency_debtor");
    if (worst.state === "de_rezolvat" && insolvency)
      return {
        key: "risc.insolvency",
        area: "risc",
        factIds: [insolvency.id],
        text: subj(
          "Firma ta apare ca debitor într-un dosar de insolvență.",
          "Your company appears as the debtor in an insolvency case.",
          `${name} apare ca debitor într-un dosar de insolvență.`,
          `${name} appears as the debtor in an insolvency case.`,
        ),
      };
    return {
      key: "risc.defendant",
      area: "risc",
      factIds: worst.factIds,
      text: subj(
        "Firma ta a fost dată în judecată în ultimii 3 ani.",
        "Your company was taken to court in the last 3 years.",
        `${name} a fost dată în judecată în ultimii 3 ani.`,
        `${name} was taken to court in the last 3 years.`,
      ),
    };
  }

  const margins = r.series("money.margin_pretax");
  const growth = r.get("money.growth_turnover");
  const g = growth?.value as { ratio?: number; from?: number; to?: number } | undefined;
  const trend = r.get("money.expenses_vs_revenue");
  const tv = trend?.value as { expenses?: number; revenue?: number } | undefined;

  if (worst?.area === "bani") {
    const net = r.latest("money.profit_net");
    if (net && net.value < 0)
      return {
        key: "bani.loss",
        area: "bani",
        factIds: [net.fact.id],
        text: subj(
          `Firma ta a încheiat ${net.year} pe pierdere.`,
          `Your company closed ${net.year} with a loss.`,
          `${name} a încheiat ${net.year} pe pierdere.`,
          `${name} closed ${net.year} with a loss.`,
        ),
      };
    const fewer = margins.length >= 2 && margins[0].value < margins[1].value;
    const marginIds = margins.slice(0, 2).map((m) => m.fact.id);
    if (worst.state === "de_rezolvat")
      return {
        key: "bani.margin_falling",
        area: "bani",
        factIds: [...worst.factIds],
        text: subj(
          "Îți rămân tot mai puțini lei din 100, sub firmele similare.",
          "You keep less of every 100 lei each year, below similar firms.",
          `${name} păstrează tot mai puțin din 100 de lei, sub firmele similare.`,
          `${name} keeps less of every 100 lei each year, below similar firms.`,
        ),
      };
    // The headline names the trigger the Bani line shows: a profit drop says so first.
    const change = r.get("money.profit_change");
    const c = change?.value as { ratio?: number; from?: number } | undefined;
    const profitDrop = change && typeof c?.ratio === "number" && c.ratio < -0.1;
    if (profitDrop && worst.factIds.includes(change.id)) {
      const p = changePct(c!.ratio!);
      return {
        key: "bani.profit_down",
        area: "bani",
        factIds: [change!.id],
        text: subj(
          `Profitul firmei tale a scăzut cu ${p.ro} față de ${c!.from}.`,
          `Your company's profit fell by ${p.en} on ${c!.from}.`,
          `Profitul firmei ${name} a scăzut cu ${p.ro} față de ${c!.from}.`,
          `${name}'s profit fell by ${p.en} on ${c!.from}.`,
        ),
      };
    }
    if (typeof g?.ratio === "number" && g.ratio >= 0.03 && fewer)
      return {
        key: "bani.growing_keeps_less",
        area: "bani",
        factIds: [growth!.id, ...marginIds],
        text: subj(
          "Firma ta crește, dar îți rămân tot mai puțini lei din 100.",
          "Your company is growing, but you keep less of every 100 lei.",
          `${name} crește, dar îi rămân tot mai puțini lei din 100.`,
          `${name} is growing, but keeps less of every 100 lei.`,
        ),
      };
    const band = r.band("marginPretax");
    if (band && margins[0] && margins[0].value < band.p50)
      return {
        key: "bani.margin_below",
        area: "bani",
        factIds: [margins[0].fact.id, band.fact.id],
        text: subj(
          "Îți rămân mai puțini lei din 100 decât unei firme obișnuite.",
          "You keep less of every 100 lei than a typical similar firm.",
          `${name} păstrează din 100 de lei mai puțin decât o firmă obișnuită.`,
          `${name} keeps less of every 100 lei than a typical similar firm.`,
        ),
      };
    if (profitDrop) {
      const p = changePct(c!.ratio!);
      return {
        key: "bani.profit_down",
        area: "bani",
        factIds: [change!.id],
        text: subj(
          `Profitul firmei tale a scăzut cu ${p.ro} față de ${c!.from}.`,
          `Your company's profit fell by ${p.en} on ${c!.from}.`,
          `Profitul firmei ${name} a scăzut cu ${p.ro} față de ${c!.from}.`,
          `${name}'s profit fell by ${p.en} on ${c!.from}.`,
        ),
      };
    }
    const then = marginYearsBefore(r, margins[0]);
    if (margins[0] && then && keptOf100(then.value) - keptOf100(margins[0].value) >= 3) {
      const k = keptOf100(margins[0].value);
      const k0 = keptOf100(then.value);
      return {
        key: "bani.margin_down",
        area: "bani",
        factIds: [margins[0].fact.id, ...then.factIds],
        text: subj(
          `Din 100 de lei îți rămân ${k}, față de ${k0} în ${then.year}.`,
          `Of every 100 lei you keep ${k}, against ${k0} in ${then.year}.`,
          `Din 100 de lei, ${name} păstrează ${k}, față de ${k0} în ${then.year}.`,
          `Of every 100 lei, ${name} keeps ${k}, against ${k0} in ${then.year}.`,
        ),
      };
    }
    return {
      key: "bani.attention",
      area: "bani",
      factIds: worst.factIds,
      text: subj(
        "Banii cer atenție: din 100 de lei facturați rămâne puțin.",
        "Money needs attention: little is left of every 100 lei invoiced.",
        `La ${name}, banii cer atenție: din 100 de lei facturați rămâne puțin.`,
        `At ${name}, money needs attention: little is left of every 100 lei invoiced.`,
      ),
    };
  }

  const filed = r.filed();
  if (filed === false)
    return {
      key: "new_firm",
      factIds: ["money.filed"],
      text: subj(
        "Încă nu ai bilanț depus; iată ce am verificat în rest.",
        "No annual accounts filed yet; here is what we checked otherwise.",
        `${name} nu are încă bilanț depus; iată ce am verificat în rest.`,
        `${name} has not filed annual accounts yet; here is what we checked otherwise.`,
      ),
    };
  if (filed !== true)
    return {
      key: "money_unchecked",
      factIds: filed === null ? ["money.filed"] : [],
      text: subj(
        "Nu am putut citi acum bilanțurile; iată ce am verificat în rest.",
        "We could not read the annual accounts now; here is what we checked otherwise.",
        `Nu am putut citi acum bilanțurile firmei ${name}; iată ce am verificat în rest.`,
        `We could not read ${name}'s annual accounts now; here is what we checked otherwise.`,
      ),
    };

  // Money is not a problem, but the trend is not clean either: say what moved, never
  // "no money problems" (the Libris case: turnover down, expenses up).
  const turnoverDown = typeof g?.ratio === "number" && g.ratio < -0.02;
  const expensesFaster =
    typeof tv?.expenses === "number" &&
    typeof tv?.revenue === "number" &&
    tv.expenses > tv.revenue + 0.05;
  if (turnoverDown && growth) {
    const p = changePct(g!.ratio!);
    return {
      key: expensesFaster ? "money.turnover_down_costs_up" : "money.turnover_down",
      factIds: [growth.id, ...(expensesFaster ? [trend!.id] : [])],
      text: expensesFaster
        ? subj(
            `Cifra de afaceri a scăzut cu ${p.ro}, iar cheltuielile cresc mai repede.`,
            `Turnover fell by ${p.en}, and expenses grow faster than it.`,
            `La ${name}, cifra de afaceri a scăzut cu ${p.ro}, iar cheltuielile cresc mai repede.`,
            `At ${name}, turnover fell by ${p.en}, and expenses grow faster than it.`,
          )
        : subj(
            `Cifra de afaceri a scăzut cu ${p.ro} față de ${g!.from}.`,
            `Turnover fell by ${p.en} on ${g!.from}.`,
            `La ${name}, cifra de afaceri a scăzut cu ${p.ro} față de ${g!.from}.`,
            `At ${name}, turnover fell by ${p.en} on ${g!.from}.`,
          ),
    };
  }
  if (expensesFaster && trend)
    return {
      key: "money.expenses_faster",
      factIds: [trend.id],
      text: subj(
        "Cheltuielile cresc mai repede decât cifra de afaceri.",
        "Expenses grow faster than turnover.",
        `La ${name}, cheltuielile cresc mai repede decât cifra de afaceri.`,
        `At ${name}, expenses grow faster than turnover.`,
      ),
    };

  const growthBand = r.band("growth3y");
  if (growthBand?.you !== undefined && growthBand.you > growthBand.p50) {
    const better =
      growthBand.betterThanOf100 !== undefined
        ? Math.round(growthBand.betterThanOf100 / 10)
        : undefined;
    const text =
      better !== undefined && better >= 5
        ? subj(
            `Firma ta merge bine: crești mai repede decât ${better} din 10 firme similare.`,
            `Your company is doing well: you grow faster than ${better} of 10 similar firms.`,
            `${name} merge bine: crește mai repede decât ${better} din 10 firme similare.`,
            `${name} is doing well: it grows faster than ${better} of 10 similar firms.`,
          )
        : subj(
            "Firma ta merge bine: crești mai repede decât o firmă obișnuită.",
            "Your company is doing well: you grow faster than a typical firm.",
            `${name} merge bine: crește mai repede decât o firmă obișnuită.`,
            `${name} is doing well: it grows faster than a typical firm.`,
          );
    return { key: "positive.growth_peers", factIds: [growthBand.fact.id], text };
  }
  if (growth && typeof g?.ratio === "number" && g.ratio > 0) {
    const p = changePct(g.ratio);
    return {
      key: "positive.growth",
      factIds: [growth.id],
      text: subj(
        `Firma ta merge bine: cifra de afaceri a crescut cu ${p.ro}.`,
        `Your company is doing well: turnover grew by ${p.en}.`,
        `${name} merge bine: cifra de afaceri a crescut cu ${p.ro}.`,
        `${name} is doing well: turnover grew by ${p.en}.`,
      ),
    };
  }
  return {
    key: "neutral",
    factIds: [...(bani?.factIds ?? []), ...(risc?.factIds ?? [])],
    text: subj(
      "Nu am găsit probleme la bani sau semnale de risc în ce am verificat.",
      "We found no money problems or risk signals in what we checked.",
      `La ${name} nu am găsit probleme la bani sau semnale de risc în ce am verificat.`,
      `At ${name} we found no money problems or risk signals in what we checked.`,
    ),
  };
}

/** The headline as a cited sentence of the rules brief. */
export function headlineSentence(h: Headline, lang: Lang): CitedSentence {
  return { text: h.text[lang], factIds: h.factIds };
}

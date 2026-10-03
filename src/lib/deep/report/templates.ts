import type {
  Action,
  AreaLight,
  Audience,
  Bilingual,
  Brief,
  BriefSection,
  CitedSentence,
  Fact,
  Finding,
  Gap,
  Lang,
  SectorVocabId,
} from "../contracts";
import { formatInt, leiShort } from "../parse/format";
import { VOCAB } from "../vocab";

import type { Headline } from "./headline";
import { marginAt } from "./lights";
import { changePct, keptOf100, readFacts, roCount, sameDirection3y, SITE_OK } from "./read";

/*
 * The rules-only brief (plan A7 "Rules-only mode"), labelled "Analiză pe
 * reguli, fără AI" by the UI: sentence templates that cite the facts they
 * rest on, in the run language, in the second person for owners and the third
 * person for anyone else (D9). It is also the fallback of every AI section.
 * Numbers come from fact displays or from code, never from a model.
 */

const sentence = (text: string, factIds: string[]): CitedSentence => ({ text, factIds });
const section = (sentences: CitedSentence[]): BriefSection => ({ source: "rules", sentences });
const end = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export type TemplateInput = {
  facts: Fact[];
  gaps: Gap[];
  lang: Lang;
  audience: Audience;
  vocab: SectorVocabId;
  name: string;
  lights: AreaLight[];
  findings: Finding[];
  actions: Action[];
  headline: Headline;
};

/**
 * "Ce înseamnă pentru tine": at most 60 words that add to the lines instead of repeating
 * them: how the money moved over 3 years (turnover, expenses, what is left of 100 lei then
 * and now), what a new customer can do on the site, and the first step.
 */
function meaning(input: TemplateInput): CitedSentence[] {
  const { lang } = input;
  const ro = lang === "ro";
  const owner = input.audience === "owner";
  const r = readFacts(input.facts);
  const v = VOCAB[input.vocab];
  const out: CitedSentence[] = [];

  // 1. Money over three years.
  const trend = r.get("money.expenses_vs_revenue");
  const t = trend?.value as
    | { expenses?: number; revenue?: number; from?: number; to?: number }
    | undefined;
  const margins = r.series("money.margin_pretax");
  const then = t?.from ? marginAt(r, t.from) : undefined;
  if (trend && t && typeof t.expenses === "number" && typeof t.revenue === "number" && t.from) {
    const rev = changePct(t.revenue);
    const exp = changePct(t.expenses);
    const revVerb = t.revenue >= 0 ? (ro ? "a crescut" : "grew") : ro ? "a scăzut" : "fell";
    const expVerb = t.expenses >= 0 ? (ro ? "au crescut" : "grew") : ro ? "au scăzut" : "fell";
    const k = margins[0] ? keptOf100(margins[0].value) : undefined;
    const k0 = then ? keptOf100(then.value) : undefined;
    const faster = t.expenses > t.revenue + 0.05;
    // "îți rămân 10" / "îți rămâne un leu"; no tail when either year was a loss.
    const keepRo =
      k === 1
        ? owner
          ? "îți rămâne un leu"
          : "rămâne un leu"
        : `${owner ? "îți rămân" : "rămân"} ${k}`;
    const keepEn = `${owner ? "you keep" : "the company keeps"} ${k}`;
    const tail =
      k !== undefined && k0 !== undefined && k > 0 && k0 > 0 && k !== k0
        ? ro
          ? `${faster ? ", așa că" : ";"} din 100 de lei ${keepRo}, față de ${k0} în ${t.from}`
          : `${faster ? ", so" : ";"} of every 100 lei ${keepEn}, against ${k0} in ${t.from}`
        : "";
    out.push(
      sentence(
        ro
          ? `Din ${t.from} până în ${t.to}, cifra de afaceri ${revVerb} cu ${rev.ro}, iar cheltuielile ${expVerb} cu ${exp.ro}${tail}.`
          : `From ${t.from} to ${t.to}, turnover ${revVerb} by ${rev.en} and expenses ${expVerb} by ${exp.en}${tail}.`,
        [trend.id, ...(margins[0] ? [margins[0].fact.id] : []), ...(then?.factIds ?? [])],
      ),
    );
  } else if (r.filed() === false) {
    out.push(
      sentence(
        ro
          ? `Fără bilanț depus, nu putem spune încă cât ${owner ? "îți rămâne" : "rămâne"} din fiecare 100 de lei facturați.`
          : `With no annual accounts filed, we cannot yet say how much of every 100 lei invoiced ${owner ? "you keep" : "the company keeps"}.`,
        ["money.filed"],
      ),
    );
  }

  // 2. What a new customer can do on the site (from the pages read).
  const status = r.websiteStatus();
  const contact = r.get("site.contact.present");
  const booking = r.get("site.booking.present");
  const pages = r.num("site.pages_read") ?? booking?.observed?.pagesRead;
  const onPages =
    pages && pages > 1
      ? ro
        ? `Pe cele ${roCount(pages, "pagini citite")}`
        : `On the ${pages} pages we read`
      : ro
        ? "Pe site"
        : "On the site";
  const form = r.get("site.contact_form.present");
  if (status && SITE_OK.includes(status) && contact) {
    const noun = v.words.client.ro.split(" ")[0];
    const who = ro
      ? /ă$/.test(noun)
        ? `o ${noun} nouă`
        : `un ${noun} nou`
      : `a new ${v.words.client.en.split(" ")[0]}`;
    const canBook = booking?.value === true;
    const expects = v.expects !== null && booking;
    let text: string;
    if (contact.value === false)
      text = ro
        ? `${onPages} nu am găsit un telefon, un e-mail sau un formular de contact.`
        : `${onPages} we found no phone, e-mail or contact form.`;
    else if (expects && !canBook && v.expects === "quote" && form?.value === true)
      text = ro
        ? `${onPages}, ${who} găsește cum să ia legătura cu firma și poate trimite o cerere prin formular.`
        : `${onPages}, ${who} finds how to get in touch and can send a request through a form.`;
    else if (expects && !canBook)
      text = ro
        ? `${onPages}, ${who} găsește cum să ia legătura cu firma, dar nu poate face o ${v.words.booking.ro} online.`
        : `${onPages}, ${who} finds how to get in touch, but cannot make an online ${v.words.booking.en}.`;
    else if (expects && canBook)
      text = ro
        ? `Pe site, ${who} poate lua legătura cu firma și poate face o ${v.words.booking.ro} online.`
        : `On the site, ${who} can get in touch and make an online ${v.words.booking.en}.`;
    else
      text = ro
        ? `${onPages}, ${who} găsește cum să ia legătura cu firma.`
        : `${onPages}, ${who} finds how to get in touch.`;
    out.push(sentence(text, [contact.id, ...(expects && booking ? [booking.id] : [])]));
  }

  // 3. The first step (owners) or what to check (others).
  const top = input.actions.find((a) => !a.mandatory);
  const must = input.actions.find((a) => a.mandatory);
  if (owner && (top || must)) {
    // What the law asks comes before anything that brings money.
    const first = must ?? top!;
    out.push(
      sentence(
        ro
          ? end(`Primul pas: ${lowerFirst(first.title.ro)}`)
          : end(`First step: ${lowerFirst(first.title.en)}`),
        first.factIds,
      ),
    );
  } else if (!owner) {
    out.push(
      sentence(
        ro
          ? "Înainte să lucrați împreună, verificați la sursă registrele pe care nu le-am verificat noi."
          : "Before working together, check the registers we did not check at their source.",
        r.has("identity.status") ? ["identity.status"] : [],
      ),
    );
  }

  // Nothing above (no accounts read, no site): fall back to the lines that are not clean.
  if (out.length < 2) {
    const notClean = input.lights.filter((l) => l.state === "de_rezolvat" || l.state === "atentie");
    for (const l of notClean.slice(0, 2))
      out.unshift(sentence(end(`${l.label[lang]}: ${l.reason[lang]}`), l.factIds));
  }
  // At most 60 words: the site sentence goes first, so the first step always stays.
  const count = (list: CitedSentence[]) => list.reduce((n, x) => n + x.text.split(/\s+/).length, 0);
  let kept = out;
  if (count(kept) > 60 && kept.length > 2) kept = kept.filter((_, i) => i !== kept.length - 2);
  let words = 0;
  return kept.filter((x) => (words += x.text.split(/\s+/).length) <= 60);
}

const lowerFirst = (s: string) =>
  /^[A-ZĂÂÎȘȚ][a-zăâîșț]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

/**
 * "Ce vede un client nou": up to three lines of what a customer can do on the site, each
 * citing an observation; never a bare "Da", never a compliance check (the CUI is in Online).
 */
function customerView(input: TemplateInput): CitedSentence[] {
  const r = readFacts(input.facts);
  const { lang } = input;
  const ro = lang === "ro";
  const v = VOCAB[input.vocab];
  const out: CitedSentence[] = [];
  const status = r.get("site.status");
  if (!status) return out;
  if (!SITE_OK.includes(status.value as never)) {
    out.push(sentence(end(status.display[lang]), [status.id]));
    return out;
  }
  const pages = r.num("site.pages_read");
  const read = (n?: number) =>
    n && n > 1 ? (ro ? ` (am citit ${roCount(n, "pagini")})` : ` (we read ${n} pages)`) : "";
  const contact = r.get("site.contact.present");
  if (contact)
    out.push(
      sentence(
        contact.value === true
          ? ro
            ? "Pe site găsește un telefon, un e-mail sau un formular de contact."
            : "On the site they find a phone number, an e-mail or a contact form."
          : ro
            ? `Nu găsește pe site un telefon, un e-mail sau un formular de contact${read(contact.observed?.pagesRead ?? pages)}.`
            : `They find no phone, e-mail or contact form on the site${read(contact.observed?.pagesRead ?? pages)}.`,
        [contact.id],
      ),
    );
  const booking = r.get("site.booking.present");
  const form = r.get("site.contact_form.present");
  if (v.expects === "quote" && form?.value === true && booking?.value !== true)
    out.push(
      sentence(
        ro
          ? "Poate trimite o cerere prin formularul de pe site."
          : "They can send a request through the form on the site.",
        [form.id],
      ),
    );
  else if (booking && v.expects)
    out.push(
      sentence(
        booking.value === true
          ? ro
            ? `Poate face o ${v.words.booking.ro} online, direct de pe site.`
            : `They can make an online ${v.words.booking.en}, right on the site.`
          : ro
            ? `Nu poate face o ${v.words.booking.ro} online de pe site${read(booking.observed?.pagesRead ?? pages)}.`
            : `They cannot make an online ${v.words.booking.en} on the site${read(booking.observed?.pagesRead ?? pages)}.`,
        [booking.id],
      ),
    );
  const prices = r.byPredicate("offers.price");
  if (prices.length && out.length < 3) {
    const pagesWithPrices = new Set(prices.map((p) => p.evidence?.url).filter(Boolean)).size;
    out.push(
      sentence(
        ro
          ? pagesWithPrices > 1
            ? `Vede prețuri pe ${roCount(pagesWithPrices, "pagini")}.`
            : "Vede prețuri pe site."
          : pagesWithPrices > 1
            ? `They see prices on ${pagesWithPrices} pages.`
            : "They see prices on the site.",
        [prices[0].id],
      ),
    );
  }
  const speed = r.get("site.speed.mobile");
  if (speed && out.length < 3) out.push(sentence(end(cap(speed.display[lang])), [speed.id]));
  return out.slice(0, 3);
}

/** Rivals: up to three named rivals with their official figures, or the honest gap. */
function rivals(input: TemplateInput): CitedSentence[] {
  const { lang } = input;
  const list = input.facts.filter((f) => f.predicate === "peers.rival").slice(0, 3);
  if (list.length) return list.map((f) => sentence(end(f.display[lang]), [f.id]));
  const gap = input.gaps.find((g) => g.section === "peers");
  return gap
    ? [
        sentence(
          lang === "ro"
            ? "Comparația cu firme similare nu e încă gata; apare aici când încărcăm bilanțurile lor."
            : "The comparison with similar firms is not ready yet; it appears here once we load their accounts.",
          [],
        ),
      ]
    : [];
}

/**
 * "Dacă nu faci nimic": only when turnover moved the same way for three years,
 * one year ahead, as a range, never below zero, "dacă tendința din 2023–2025
 * continuă". Code-computed and tagged "Estimare" by the UI.
 */
export function ifNothing(
  input: Pick<TemplateInput, "facts" | "lang" | "audience" | "name">,
): CitedSentence[] {
  const r = readFacts(input.facts);
  const s = r.series("money.turnover");
  const dir = sameDirection3y(s);
  if (!dir) return [];
  const [c, b, a] = s;
  const r1 = b.value / a.value - 1;
  const r2 = c.value / b.value - 1;
  if (!Number.isFinite(r1) || !Number.isFinite(r2)) return [];
  const lo = Math.max(0, c.value * (1 + Math.min(r1, r2)));
  const hi = Math.max(0, c.value * (1 + Math.max(r1, r2)));
  const next = c.year + 1;
  const owner = input.audience === "owner";
  const lowS = leiShort(Math.round(lo));
  const highS = leiShort(Math.round(hi));
  const text =
    input.lang === "ro"
      ? `Dacă tendința din ${a.year}–${c.year} continuă, cifra ${owner ? "ta " : ""}de afaceri din ${next} ar putea fi între ${lowS.ro} și ${highS.ro}.`
      : `If the ${a.year}–${c.year} trend continues, ${owner ? "your" : "the"} ${next} turnover could be between ${lowS.en} and ${highS.en}.`;
  return [sentence(text, [a.fact.id, b.fact.id, c.fact.id])];
}

/** The rules-only brief: every section cites the facts it rests on. */
export function rulesBrief(input: TemplateInput): Brief {
  const { lang } = input;
  const findings = input.findings.map((f) => section([sentence(end(f.sentence[lang]), f.factIds)]));
  const nothing = ifNothing(input);
  return {
    lang,
    audience: input.audience,
    headline: section([sentence(input.headline.text[lang], input.headline.factIds)]),
    meaning: section(meaning(input)),
    findings,
    customerView: section(customerView(input)),
    rivals: section(rivals(input)),
    ...(nothing.length ? { ifNothing: section(nothing) } : {}),
    cut: { kept: 0, byCode: 0, byEntailment: 0 },
  };
}

/** Five lines for WhatsApp ("Copiază rezumatul"): the headline and the five lines, from the same data. */
export function summaryLines(input: {
  headline: Bilingual;
  lights: AreaLight[];
  lang: Lang;
}): string[] {
  const words: Record<string, Bilingual> = {
    bine: { en: "Good", ro: "Bine" },
    atentie: { en: "Watch", ro: "Atenție" },
    de_rezolvat: { en: "To fix", ro: "De rezolvat" },
    neverificat: { en: "Not checked", ro: "Neverificat" },
  };
  return [
    input.headline[input.lang],
    ...input.lights.map(
      (l) => `${l.label[input.lang]}: ${words[l.state][input.lang]} · ${l.reason[input.lang]}`,
    ),
  ];
}

export const RULES_LABEL: Bilingual = {
  en: "Rule-based analysis, no AI",
  ro: "Analiză pe reguli, fără AI",
};

/** "Verificat azi, 03.10.2026 · bilanț 2025 · …": the counts come from report.counts (lists the reader can open). */
export function countLabel(n: number, one: Bilingual, many: Bilingual, lang: Lang): string {
  return n === 1 ? one[lang] : `${formatInt(n, lang)} ${many[lang]}`;
}

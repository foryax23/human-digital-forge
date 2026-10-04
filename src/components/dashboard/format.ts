import type { Language } from "@/i18n";
import type { Tone } from "@/components/system";

/*
 * Words and dates for the client workspace, Romanian first. The database keeps the team's
 * own words (project status, step); the known ones are shown in the client's language and
 * anything else as written.
 */

type Bi = readonly [en: string, ro: string];

const pickBi = (lang: Language, [en, ro]: Bi) => (lang === "ro" ? ro : en);

const LOCALES: Record<Language, string> = { ro: "ro-RO", en: "en-GB" };
const ZONE = "Europe/Bucharest";

/** The project steps (TIMELINE_STEPS in src/hooks/use-dashboard-data.ts, same order). */
export const STEP_LABELS: readonly Bi[] = [
  ["Request submitted", "Cerere trimisă"],
  ["Brief reviewed", "Cerere analizată"],
  ["Proposal accepted", "Ofertă acceptată"],
  ["Work in progress", "În lucru"],
  ["Your review", "Verificarea ta"],
  ["Completed", "Finalizat"],
];

const STATUS_WORDS: Record<string, Bi> = {
  "request submitted": STEP_LABELS[0],
  "brief reviewed": STEP_LABELS[1],
  "proposal accepted": STEP_LABELS[2],
  "work in progress": STEP_LABELS[3],
  "client review": STEP_LABELS[4],
  completed: STEP_LABELS[5],
};

export function stepLabel(index: number, lang: Language): string {
  const i = Math.max(0, Math.min(STEP_LABELS.length - 1, Math.trunc(index) || 0));
  return pickBi(lang, STEP_LABELS[i]);
}

/** The team's status text, translated when it is one of the step names. */
export function projectStatusLabel(status: string | null | undefined, lang: Language): string {
  const text = (status ?? "").trim();
  if (!text) return pickBi(lang, STEP_LABELS[0]);
  const known = STATUS_WORDS[text.toLowerCase()];
  return known ? pickBi(lang, known) : text;
}

const SERVICES: Record<string, Bi> = {
  website: ["Website", "Site"],
  "digital-product": ["Digital products", "Produse digitale"],
  "ai-automation": ["AI automation", "Automatizare AI"],
  consultancy: ["Consultancy", "Consultanță"],
  "not-sure": ["To be decided", "De stabilit"],
};

export function serviceLabel(value: string | null | undefined, lang: Language): string | null {
  if (!value) return null;
  const known = SERVICES[value];
  return known ? pickBi(lang, known) : value.replace(/-/g, " ");
}

const CONSULTATION_STATUS: Record<string, { label: Bi; tone: Tone }> = {
  requested: { label: ["Requested", "Cerută"], tone: "unverified" },
  scheduled: { label: ["Scheduled", "Programată"], tone: "ok" },
  confirmed: { label: ["Confirmed", "Confirmată"], tone: "ok" },
  completed: { label: ["Held", "Încheiată"], tone: "neutral" },
  done: { label: ["Held", "Încheiată"], tone: "neutral" },
  canceled: { label: ["Cancelled", "Anulată"], tone: "bad" },
  cancelled: { label: ["Cancelled", "Anulată"], tone: "bad" },
};

export function consultationStatus(status: string | null | undefined, lang: Language) {
  const known = CONSULTATION_STATUS[(status ?? "").toLowerCase()];
  return known
    ? { label: pickBi(lang, known.label), tone: known.tone }
    : { label: status || pickBi(lang, ["Requested", "Cerută"]), tone: "neutral" as Tone };
}

const INVOICE_STATUS: Record<string, { label: Bi; tone: Tone }> = {
  paid: { label: ["Paid", "Plătită"], tone: "ok" },
  sent: { label: ["Issued", "Emisă"], tone: "neutral" },
  open: { label: ["Issued", "Emisă"], tone: "neutral" },
  overdue: { label: ["Overdue", "Restantă"], tone: "bad" },
  void: { label: ["Cancelled", "Anulată"], tone: "neutral" },
};

export function invoiceStatus(status: string, lang: Language) {
  const known = INVOICE_STATUS[status.toLowerCase()];
  return known
    ? { label: pickBi(lang, known.label), tone: known.tone }
    : { label: status, tone: "neutral" as Tone };
}

function valid(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "4 octombrie 2026" */
export function formatDay(value: string | null | undefined, lang: Language): string {
  const d = valid(value);
  if (!d) return "";
  return d.toLocaleDateString(LOCALES[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONE,
  });
}

/** "sâmbătă, 4 octombrie, 14:30" */
export function formatDateTime(value: string | null | undefined, lang: Language): string {
  const d = valid(value);
  if (!d) return "";
  return d.toLocaleString(LOCALES[lang], {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONE,
  });
}

/** "4 oct., 14:30" */
export function formatShort(value: string | null | undefined, lang: Language): string {
  const d = valid(value);
  if (!d) return "";
  return d.toLocaleString(LOCALES[lang], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONE,
  });
}

/** An amount in minor units in its own currency: "1.250,00 lei" / "1,250.00 RON", "49,00 EUR". */
export function formatMoney(minor: number, currency: string, lang: Language): string {
  const code = (currency || "RON").toUpperCase();
  if (code === "RON") {
    // Like the price list (src/lib/pricing.ts leiText): "lei" in Romanian, "RON" in English.
    const amount = (minor / 100).toLocaleString(LOCALES[lang], {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return lang === "ro" ? `${amount} lei` : `${amount} RON`;
  }
  try {
    return new Intl.NumberFormat(LOCALES[lang], { style: "currency", currency: code }).format(
      minor / 100,
    );
  } catch {
    return `${(minor / 100).toFixed(2)} ${code}`;
  }
}

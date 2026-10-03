import type { Bilingual, Estimate, SectorVocabId } from "../contracts";
import { formatDecimal, formatInt, pct } from "../parse/format";
import { roCount } from "./read";

import { DEFAULT_ROLE_HOURS, MAX_SHARE_OF_ROLE_TIME, SECTOR_VOLUMES } from "./defaults";
import { HOURS_PER_MONTH, officeHourValue, WORKING_DAYS_PER_MONTH } from "./hourly";

/*
 * One money model (plan A8): estimates in lei with a range beside every
 * value, recomputed by code from typed inputs only (never by the AI, never in
 * AI prose), so the "Ajustează cifrele" panel can change an input and get the
 * same arithmetic the server used.
 *
 * Three kinds of money are never added together: the value of hours won
 * ("time_value_month", lei a month), extra profit a year before tax
 * ("profit_year_pretax") and cash collected sooner (not valued in v1). Actions
 * that save the same role's time are applied one after the other on the
 * remaining hours, and the total is capped at 20% of that role's hours.
 */

export const FORMULA = {
  booking: "time.booking.v1",
  reminders: "time.reminders.v1",
  marginGap: "profit.margin_gap.v1",
} as const;

const bi = (en: string, ro: string): Bilingual => ({ en, ro });
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Lei a month rounded to 10; lei a year rounded to 100 below 10.000 and to 1.000 above. */
export function roundLei(value: number, kind: Estimate["kind"]): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (kind === "time_value_month") return Math.round(value / 10) * 10;
  return value < 10_000 ? Math.round(value / 100) * 100 : Math.round(value / 1000) * 1000;
}

const leiRo = (v: number) => `${formatInt(v, "ro")} lei`;
const leiEn = (v: number) => `${formatInt(v, "en")} lei`;
const pctRo = (v: number) => pct(v, 0).ro;
const pctEn = (v: number) => pct(v, 0).en;

const PLURAL: Partial<Record<SectorVocabId, Bilingual>> = {
  health: bi("appointments", "programări"),
  beauty: bi("appointments", "programări"),
  auto: bi("service appointments", "programări la service"),
  professional: bi("meetings", "întâlniri"),
  food: bi("reservations", "rezervări"),
  accommodation: bi("reservations", "rezervări"),
};

/** What the volume of a sector counts, per day ("programări", "rezervări", "cereri"). */
export function volumeNoun(vocab: SectorVocabId): Bilingual {
  return PLURAL[vocab] ?? bi("bookings", "cereri");
}

/* --------------------------------------------------------------- time */

/** Raw hours a month before the overlap rule, at the low, central and high input. */
type HoursTriple = { low: number; value: number; high: number };

function bookingHours(i: Record<string, number>): HoursTriple {
  const base =
    (i.bookingsPerDay * WORKING_DAYS_PER_MONTH * clamp01(i.phoneShare) * i.minutesPerBooking) / 60;
  return {
    low: base * clamp01(i.onlineShareLow),
    value: base * clamp01(i.onlineShare),
    high: base * clamp01(i.onlineShareHigh),
  };
}

function reminderHours(i: Record<string, number>): HoursTriple {
  const at = (share: number) =>
    (i.bookingsPerDay * WORKING_DAYS_PER_MONTH * clamp01(share) * i.minutesPerReminder) / 60;
  return { low: at(i.reminderShareLow), value: at(i.reminderShare), high: at(i.reminderShareHigh) };
}

const RAW_HOURS: Record<string, (i: Record<string, number>) => HoursTriple> = {
  [FORMULA.booking]: bookingHours,
  [FORMULA.reminders]: reminderHours,
};

export type TimeContext = {
  vocab: SectorVocabId;
  caen?: string;
  factIds: string[];
  /** The owner's own volume (clients a month) and hour value, when given. */
  clientsPerMonth?: number;
  hourValue?: number;
  /**
   * The firm has no filed accounts: the sector's default volume is not used for a value in
   * lei (the estimate keeps its inputs, worth 0, until the owner gives their own number).
   */
  volumeUnknown?: boolean;
};

/** The typed inputs of a time estimate, from the owner's numbers or the sector defaults. */
export function timeInputs(
  formulaId: string,
  ctx: TimeContext,
): { inputs: Record<string, number>; ownerVolume: boolean; ownerHour: boolean } | null {
  const volumes = SECTOR_VOLUMES[ctx.vocab];
  if (!volumes) return null;
  const hour = officeHourValue(ctx.caen);
  const ownerVolume = typeof ctx.clientsPerMonth === "number" && ctx.clientsPerMonth > 0;
  const ownerHour = typeof ctx.hourValue === "number" && ctx.hourValue > 0;
  const bookingsPerDay = ownerVolume
    ? ctx.clientsPerMonth! / WORKING_DAYS_PER_MONTH
    : volumes.bookingsPerDay;
  const common = {
    bookingsPerDay,
    hourValue: ownerHour ? ctx.hourValue! : hour.value,
    roleHours: DEFAULT_ROLE_HOURS,
    ...(ctx.volumeUnknown && !ownerVolume ? { needsVolume: 1 } : {}),
  };
  if (formulaId === FORMULA.booking) {
    return {
      ownerVolume,
      ownerHour,
      inputs: {
        ...common,
        phoneShare: volumes.phoneShare,
        minutesPerBooking: volumes.minutesPerBooking,
        onlineShareLow: volumes.onlineShare.low,
        onlineShare: volumes.onlineShare.value,
        onlineShareHigh: volumes.onlineShare.high,
      },
    };
  }
  if (formulaId === FORMULA.reminders && volumes.reminderShare && volumes.minutesPerReminder) {
    return {
      ownerVolume,
      ownerHour,
      inputs: {
        ...common,
        minutesPerReminder: volumes.minutesPerReminder,
        reminderShareLow: clamp01(volumes.reminderShare - 0.15),
        reminderShare: volumes.reminderShare,
        reminderShareHigh: clamp01(volumes.reminderShare + 0.15),
      },
    };
  }
  return null;
}

function timeAssumptions(
  formulaId: string,
  i: Record<string, number>,
  ctx: { vocab: SectorVocabId; caen?: string; ownerVolume: boolean; ownerHour: boolean },
): Bilingual[] {
  const hour = officeHourValue(ctx.caen);
  const plural = PLURAL[ctx.vocab] ?? bi("bookings", "cereri");
  const perDay = Math.round(i.bookingsPerDay);
  const out: Bilingual[] = [
    ctx.ownerHour
      ? bi(
          `${formatInt(i.hourValue, "en")} lei an hour (your number)`,
          `${formatInt(i.hourValue, "ro")} lei/oră (cifra ta)`,
        )
      : hour.assumption,
    ctx.ownerVolume
      ? bi(
          `about ${perDay} ${plural.en} a day, from the clients a month you gave`,
          `cam ${roCount(perDay, plural.ro)} pe zi, din numărul de clienți pe lună dat de tine`,
        )
      : bi(
          `we assume about ${perDay} ${plural.en} a day`,
          `presupunem ~${roCount(perDay, plural.ro)} pe zi`,
        ),
  ];
  if (formulaId === FORMULA.booking) {
    out.push(
      bi(
        `${pctEn(i.phoneShare)} arrive by phone today, ${formatDecimal(i.minutesPerBooking, "en", 1)} minutes each`,
        `${pctRo(i.phoneShare)} vin azi la telefon, câte ${formatDecimal(i.minutesPerBooking, "ro", 1)} minute fiecare`,
      ),
      bi(
        `${pctEn(i.onlineShare)} of those would move online (between ${pctEn(i.onlineShareLow)} and ${pctEn(i.onlineShareHigh)})`,
        `${pctRo(i.onlineShare)} dintre ele s-ar muta online (între ${pctRo(i.onlineShareLow)} și ${pctRo(i.onlineShareHigh)})`,
      ),
    );
  } else {
    out.push(
      bi(
        `${pctEn(i.reminderShare)} are confirmed by a phone call today (between ${pctEn(i.reminderShareLow)} and ${pctEn(i.reminderShareHigh)}), ${formatDecimal(i.minutesPerReminder, "en", 1)} minutes each`,
        `${pctRo(i.reminderShare)} sunt confirmate azi printr-un telefon (între ${pctRo(i.reminderShareLow)} și ${pctRo(i.reminderShareHigh)}), câte ${formatDecimal(i.minutesPerReminder, "ro", 1)} minute fiecare`,
      ),
    );
  }
  out.push(
    bi(
      `${WORKING_DAYS_PER_MONTH} working days and ${HOURS_PER_MONTH} hours a month`,
      `${WORKING_DAYS_PER_MONTH} de zile lucrătoare și ${HOURS_PER_MONTH} de ore pe lună`,
    ),
  );
  return out;
}

const TIME_METHOD = bi(
  "Hours of front-desk work won a month × the value of an hour; at most 20% of one person's hours, with overlapping actions counted once.",
  "Ore de recepție câștigate pe lună × valoarea unei ore; cel mult 20% din orele unei persoane, iar acțiunile care se suprapun sunt numărate o singură dată.",
);

/**
 * Builds the time estimates of one role, in the order given (booking before
 * reminders), applying the overlap rule and the 20% cap. The returned
 * estimates' values add up to exactly the role's total.
 */
export function buildTimeEstimates(
  specs: Array<{
    formulaId: string;
    inputs: Record<string, number>;
    assumptions: Bilingual[];
    factIds: string[];
  }>,
): Estimate[] {
  if (!specs.length) return [];
  const roleHours = specs[0].inputs.roleHours || DEFAULT_ROLE_HOURS;
  const cap = roleHours * MAX_SHARE_OF_ROLE_TIME;
  const used: HoursTriple = { low: 0, value: 0, high: 0 };
  return specs.map((spec) => {
    const raw = spec.inputs.needsVolume
      ? { low: 0, value: 0, high: 0 }
      : (RAW_HOURS[spec.formulaId]?.(spec.inputs) ?? { low: 0, value: 0, high: 0 });
    const applied = { low: 0, value: 0, high: 0 } as HoursTriple;
    for (const k of ["low", "value", "high"] as const) {
      const remaining = Math.max(0, roleHours - used[k]);
      const scaled = raw[k] * (remaining / roleHours);
      applied[k] = Math.max(0, Math.min(scaled, cap - used[k]));
      used[k] += applied[k];
    }
    const hourValue = spec.inputs.hourValue;
    const lei = (h: number) => roundLei(h * hourValue, "time_value_month");
    const value = lei(applied.value);
    const low = Math.min(lei(applied.low), value);
    const high = Math.max(lei(applied.high), value);
    return {
      formulaId: spec.formulaId,
      kind: "time_value_month",
      value,
      low,
      high,
      hours: Math.round(applied.value * 10) / 10,
      inputs: { ...spec.inputs },
      assumptions: spec.assumptions,
      method: TIME_METHOD,
      factIds: spec.factIds,
    };
  });
}

/** Time estimates for a sector's booking (and reminder) actions, from facts and owner inputs. */
export function timeEstimatesFor(formulaIds: string[], ctx: TimeContext): Record<string, Estimate> {
  const specs = formulaIds
    .map((formulaId) => {
      const made = timeInputs(formulaId, ctx);
      if (!made) return null;
      return {
        formulaId,
        inputs: made.inputs,
        assumptions: timeAssumptions(formulaId, made.inputs, {
          vocab: ctx.vocab,
          caen: ctx.caen,
          ownerVolume: made.ownerVolume,
          ownerHour: made.ownerHour,
        }),
        factIds: ctx.factIds,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  return Object.fromEntries(buildTimeEstimates(specs).map((e) => [e.formulaId, e]));
}

/* ------------------------------------------------------------- profit */

export type MarginGapInput = {
  turnover: number;
  marginOwn: number;
  marginP25: number;
  marginP50: number;
  n: number;
  scope: Bilingual;
  year: number;
  /** The owner's own 2026 turnover estimate replaced the filed one. */
  ownerTurnover: boolean;
  factIds: string[];
};

/**
 * "Dacă ai păstra cât o firmă obișnuită din activitatea ta (21 din 100 de lei),
 * ai avea ≈ X lei profit în plus pe an, înainte de impozit": only when the
 * pre-tax margin is below the peers' lower quarter. Value at the peers'
 * median, low end at their lower quarter; never negative.
 */
export function marginGapEstimate(input: MarginGapInput): Estimate | null {
  if (!(input.turnover > 0) || !(input.marginOwn < input.marginP25)) return null;
  return marginGapFromInputs(
    {
      turnover: input.turnover,
      marginOwn: input.marginOwn,
      marginP25: input.marginP25,
      marginP50: input.marginP50,
      n: input.n,
      year: input.year,
      ownerTurnover: input.ownerTurnover ? 1 : 0,
    },
    input.scope,
    input.factIds,
  );
}

function marginGapFromInputs(
  i: Record<string, number>,
  scope: Bilingual,
  factIds: string[],
): Estimate | null {
  if (!(i.turnover > 0) || !(i.marginP50 > i.marginOwn)) return null;
  const value = roundLei((i.marginP50 - i.marginOwn) * i.turnover, "profit_year_pretax");
  const low = Math.min(
    value,
    roundLei(Math.max(0, i.marginP25 - i.marginOwn) * i.turnover, "profit_year_pretax"),
  );
  if (value <= 0) return null;
  const typical = Math.round(i.marginP50 * 100);
  const own = Math.round(i.marginOwn * 100);
  const n = Math.round(i.n);
  return {
    formulaId: FORMULA.marginGap,
    kind: "profit_year_pretax",
    value,
    low,
    high: value,
    inputs: { ...i },
    assumptions: [
      bi(
        `a typical firm in your activity keeps ${typical} lei of every 100 invoiced, before tax (${n} firms, ${scope.en})`,
        `o firmă obișnuită din activitatea ta păstrează ${typical} lei din fiecare 100 facturați, înainte de impozit (${roCount(n, "firme")}, ${scope.ro})`,
      ),
      bi(
        `you keep ${own} lei of every 100 (annual accounts ${Math.round(i.year)})`,
        `tu păstrezi ${own} lei din fiecare 100 (bilanț ${Math.round(i.year)})`,
      ),
      i.ownerTurnover
        ? bi(
            `turnover: your 2026 estimate, ${leiEn(i.turnover)}`,
            `cifra de afaceri: estimarea ta pentru 2026, ${leiRo(i.turnover)}`,
          )
        : bi(
            `turnover ${Math.round(i.year)}: ${leiEn(i.turnover)}`,
            `cifra de afaceri ${Math.round(i.year)}: ${leiRo(i.turnover)}`,
          ),
      bi(
        "owners of small firms often pay themselves dividends, which makes a margin look better",
        "proprietarii firmelor mici își plătesc des dividende, ceea ce face ca ce rămâne din 100 de lei să arate mai bine",
      ),
    ],
    method: bi(
      "(what a typical firm keeps − what you keep) × turnover, before tax; the low end uses the lower quarter of similar firms.",
      "(cât păstrează o firmă obișnuită − cât păstrezi tu) × cifra de afaceri, înainte de impozit; capătul de jos folosește pragul de jos al majorității firmelor similare.",
    ),
    factIds,
  };
}

/* ----------------------------------------------------------- recompute */

/**
 * Recomputes estimates from their inputs merged with the panel's values (A8,
 * D11): time estimates of one role again in order, with overlap and the cap.
 * Unknown input names are ignored; only numbers ≥ 0 are taken.
 */
export function recomputeEstimateList(
  estimates: Estimate[],
  changes: Record<string, number>,
): Estimate[] {
  const clean = Object.fromEntries(
    Object.entries(changes).filter(
      ([, v]) => typeof v === "number" && Number.isFinite(v) && v >= 0,
    ),
  );
  const merge = (e: Estimate) => {
    const out = Object.fromEntries(
      Object.entries(e.inputs).map(([k, v]) => [k, k in clean ? clean[k] : v]),
    ) as Record<string, number>;
    // The owner's own volume replaces the unknown one: the estimate gets a value again.
    if ("bookingsPerDay" in clean && out.needsVolume) out.needsVolume = 0;
    return out;
  };
  const time = estimates.filter((e) => e.kind === "time_value_month");
  const rebuiltTime = buildTimeEstimates(
    time.map((e) => {
      const inputs = merge(e);
      return {
        formulaId: e.formulaId,
        inputs,
        assumptions: ownerAssumptions(e.assumptions, inputs, clean),
        factIds: e.factIds,
      };
    }),
  );
  const timeById = new Map(rebuiltTime.map((e) => [e.formulaId, e]));
  return estimates.map((e) => {
    if (e.kind === "time_value_month") return timeById.get(e.formulaId) ?? e;
    if (e.formulaId === FORMULA.marginGap) {
      const inputs = merge(e);
      const scope = bi(
        /\(\d+ firms, (.+)\)$/.exec(e.assumptions[0]?.en ?? "")?.[1] ?? "",
        /\(\d+ (?:de )?firme, (.+)\)$/.exec(e.assumptions[0]?.ro ?? "")?.[1] ?? "",
      );
      const again = marginGapFromInputs(inputs, scope, e.factIds);
      return again ?? { ...e, value: 0, low: 0, high: 0, inputs };
    }
    return e;
  });
}

/**
 * The arithmetic under a footnote, from the numbers it prints, so a reader can redo it:
 * "= 6,3 ore pe lună × 32 lei ≈ 202 lei, rotunjit la 200 lei". Time estimates say when the
 * overlap with the action before or the 20% cap took hours off.
 */
export function estimateArithmetic(e: Estimate): Bilingual | null {
  if (e.value <= 0) return null;
  if (e.kind === "time_value_month" && e.hours !== undefined && e.inputs.hourValue) {
    const hour = Math.round(e.inputs.hourValue);
    const product = Math.round(e.hours * hour);
    const raw = RAW_HOURS[e.formulaId]?.(e.inputs).value;
    const trimmed = raw !== undefined && raw > e.hours + 0.05;
    const h = (lang: "ro" | "en") => formatDecimal(e.hours!, lang, 1);
    return bi(
      `= ${h("en")} hours a month × ${hour} lei ≈ ${formatInt(product, "en")} lei, rounded to ${formatInt(e.value, "en")} lei${trimmed ? ` (${formatDecimal(raw!, "en", 1)} hours before the overlap with the other time action and the 20% cap)` : ""}`,
      `= ${h("ro")} ore pe lună × ${hour} lei ≈ ${formatInt(product, "ro")} lei, rotunjit la ${formatInt(e.value, "ro")} lei${trimmed ? ` (${formatDecimal(raw!, "ro", 1)} ore înainte de suprapunerea cu cealaltă acțiune de timp și de plafonul de 20%)` : ""}`,
    );
  }
  if (e.formulaId === FORMULA.marginGap && e.inputs.turnover) {
    const typical = (lang: "ro" | "en") => formatDecimal(e.inputs.marginP50 * 100, lang, 1);
    const own = (lang: "ro" | "en") => formatDecimal(e.inputs.marginOwn * 100, lang, 1);
    const product = (e.inputs.marginP50 - e.inputs.marginOwn) * e.inputs.turnover;
    return bi(
      `= (${typical("en")} − ${own("en")}) of 100 × ${formatInt(e.inputs.turnover, "en")} lei ≈ ${formatInt(product, "en")} lei, rounded to ${formatInt(e.value, "en")} lei a year`,
      `= (${typical("ro")} − ${own("ro")}) din 100 × ${formatInt(e.inputs.turnover, "ro")} lei ≈ ${formatInt(product, "ro")} lei, rotunjit la ${formatInt(e.value, "ro")} lei pe an`,
    );
  }
  return null;
}

/** The assumption lines the owner replaced with their own numbers say so ("cifra ta"). */
function ownerAssumptions(
  list: Bilingual[],
  inputs: Record<string, number>,
  changed: Record<string, number>,
): Bilingual[] {
  return list.map((a) => {
    if ("bookingsPerDay" in changed && /pe zi/.test(a.ro)) {
      const nounRo = /\d+(?: de)? (.+?) pe zi/.exec(a.ro)?.[1] ?? "cereri";
      const nounEn = /\d+ (.+?) a day/.exec(a.en)?.[1] ?? "bookings";
      const n = Math.round(inputs.bookingsPerDay);
      return bi(
        `about ${n} ${nounEn} a day (your number)`,
        `cam ${roCount(n, nounRo)} pe zi (cifra ta)`,
      );
    }
    if ("hourValue" in changed && /lei\/oră/.test(a.ro)) {
      const h = Math.round(inputs.hourValue);
      return bi(`${h} lei an hour (your number)`, `${h} lei/oră (cifra ta)`);
    }
    return a;
  });
}

/** The sum of estimates of ONE kind (never across kinds), or undefined when there are none. */
export function totalOf(estimates: Estimate[], kind: Estimate["kind"]): Estimate | undefined {
  const list = estimates.filter((e) => e.kind === kind && e.value > 0);
  if (!list.length) return undefined;
  const sum = (k: "value" | "low" | "high") => list.reduce((n, e) => n + e[k], 0);
  return {
    formulaId: `total.${kind}`,
    kind,
    value: sum("value"),
    low: sum("low"),
    high: sum("high"),
    hours:
      kind === "time_value_month"
        ? Math.round(list.reduce((n, e) => n + (e.hours ?? 0), 0) * 10) / 10
        : undefined,
    inputs: {},
    assumptions: [],
    method:
      kind === "time_value_month"
        ? bi(
            "The time estimates above, added up (same kind of money).",
            "Estimările de timp de mai sus, adunate (același fel de bani).",
          )
        : bi(
            "The profit estimates above, added up (same kind of money).",
            "Estimările de profit de mai sus, adunate (același fel de bani).",
          ),
    factIds: [...new Set(list.flatMap((e) => e.factIds))],
  };
}

import type {
  AuditFinding,
  AutomationOpportunity,
  Bilingual,
  Blueprint,
  CompanyProfile,
  ScanTarget,
  StartReason,
  WebsiteAudit,
} from "@/lib/scan/types";

import {
  addEstimates,
  approxLei,
  hoursPerMonth,
  joinList,
  lcFirst,
  lei,
  midOf,
  monthLabel,
  roCount,
  roDefinite,
  roundStep,
  STEP,
} from "./format";
import { bi } from "./model";
import { PROCESS_WORDS, SHORT_NAMES } from "./short-names";
import type { BusinessTypeDef } from "./taxonomy";
import { WAGE_SOURCE } from "./wages";

/*
 * Bilingual templates for the headline, the summary, "Pe scurt", the start
 * reasons and the disclaimer (spec §3.8; Romanian is the source). Every
 * figure here is the rounded one the screens show, from the same helpers.
 */

/** What we call the business in copy: its name, else its website, else "your business". */
export function businessName(args: {
  company?: CompanyProfile;
  audit?: WebsiteAudit;
  target: ScanTarget;
}): Bilingual | null {
  const official = args.company?.displayName || args.company?.name;
  const name =
    (official && readableName(official)) ||
    args.audit?.host?.replace(/^www\./, "") ||
    hostOf(args.target.url);
  return name ? bi(name, name) : null;
}

const LEGAL_FORMS =
  /^(S\.?R\.?L\.?|S\.?A\.?|P\.?F\.?A\.?|I\.?I\.?|I\.?F\.?|S\.?N\.?C\.?|S\.?C\.?S\.?)$/i;

/** "DENTAL SMILE CLINIC S.R.L." → "Dental Smile Clinic SRL"; mixed-case names are kept. */
export function readableName(name: string): string {
  if (name !== name.toUpperCase()) return name.trim();
  return name
    .trim()
    .split(/\s+/)
    .map((word) =>
      LEGAL_FORMS.test(word)
        ? word.replace(/\./g, "").toUpperCase()
        : word
            .toLowerCase()
            .replace(
              /(^|[-'’])(\p{L})/gu,
              (_, sep: string, letter: string) => sep + letter.toUpperCase(),
            ),
    )
    .join(" ");
}

function hostOf(url: string | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Hours a month as shown everywhere (headline, Gantt total, "Pe scurt"): steps of 5. */
export function shownHours(opportunities: AutomationOpportunity[]): number {
  return roundStep(addEstimates(opportunities.map((o) => o.hoursSavedPerMonth)).mid, STEP.hours);
}

/** The value of the hours a month as shown everywhere: steps of 100 lei. */
export function shownMonthlyValue(opportunities: AutomationOpportunity[]): number {
  return roundStep(addEstimates(opportunities.map((o) => o.monthlySavingsRon)).mid, STEP.monthly);
}

export function buildHeadline(args: {
  name: Bilingual | null;
  type: BusinessTypeDef;
  opportunities: AutomationOpportunity[];
  stepCount: number;
}): Bilingual {
  const name = args.name ?? bi("Your business", "Afacerea ta");
  const hours = shownHours(args.opportunities);
  if (hours >= 10) {
    const qty = hoursPerMonth(hours);
    return bi(`${name.en} could win back ${qty.en}.`, `${name.ro} poate câștiga ${qty.ro}.`);
  }
  const customers = args.type.customers;
  return bi(
    `${name.en}: ${args.stepCount} practical steps to win more ${customers.en}.`,
    `${name.ro}: ${roCount(args.stepCount, "pași practici")} pentru mai mulți ${customers.ro}.`,
  );
}

export function buildSummary(args: {
  type: BusinessTypeDef;
  opportunities: AutomationOpportunity[];
  hourlyCostRon: number;
  websiteActions: AuditFinding[];
  audit?: WebsiteAudit;
  hasWebsite: boolean;
}): Bilingual {
  const top = [...args.opportunities]
    .sort((a, b) => midOf(b.monthlySavingsRon) - midOf(a.monthlySavingsRon))
    .slice(0, 3);
  const count = args.opportunities.length;
  // Short names read better in a list than full titles ("oferte rapide", not "oferte în câteva minute, nu în ore").
  const names = top.map((o) => SHORT_NAMES[o.id] ?? bi(lcFirst(o.title.en), lcFirst(o.title.ro)));
  const value = lei(shownMonthlyValue(args.opportunities));
  const customers = args.type.customers;
  const hourly = lei(args.hourlyCostRon);

  const work = count
    ? bi(
        `We found ${count === 1 ? "one task" : `${count} tasks`} that can be automated, ${count === 1 ? "" : "led by "}${joinList(
          names.map((n) => n.en),
          "en",
        )}. The hours won back are worth about ${value.en} a month, at ${hourly.en} an hour.`,
        `Am găsit ${count === 1 ? "o activitate care se poate automatiza" : `${roCount(count, "activități")} care se pot automatiza`}, ${count === 1 ? "" : "mai ales "}${joinList(
          names.map((n) => n.ro),
          "ro",
        )}. Orele câștigate valorează cam ${value.ro} pe lună, la ${hourly.ro} pe oră.`,
      )
    : bi("", "");

  let site: Bilingual;
  if (!args.hasWebsite || (args.audit && !args.audit.reachable)) {
    const contact = args.type.bookings
      ? bi("contact and booking", "contact și programare")
      : args.type.consumer
        ? bi("contact details and WhatsApp", "date de contact și WhatsApp")
        : bi("contact and quote requests", "contact și cereri de ofertă");
    site =
      args.audit && !args.audit.reachable
        ? bi(
            `The website could not be reached when we scanned it, so getting it back online, fast and with ${contact.en}, comes first.`,
            `Site-ul nu a putut fi deschis la scanare, așa că primul pas e să funcționeze din nou, rapid și cu ${contact.ro}.`,
          )
        : bi(
            `There is no working website yet, so a fast site with ${contact.en} comes first to bring in ${customers.en}.`,
            `Nu există încă un site funcțional, așa că primul pas e un site rapid, cu ${contact.ro}, care să aducă ${customers.ro}.`,
          );
  } else if (args.audit) {
    const score = args.audit.scores.overall;
    const first = args.websiteActions[0];
    const n = args.websiteActions.length;
    site = first
      ? bi(
          `The website scores ${score} out of 100; we found ${n} ${n === 1 ? "issue" : "issues"} worth fixing first (${n === 1 ? "" : "starting with "}“${lcFirst(first.title.en)}”) that could turn more visits into ${customers.en}.`,
          `Site-ul are scorul ${score} din 100; am găsit ${n === 1 ? "o problemă" : roCount(n, "probleme")} de rezolvat întâi (${n === 1 ? "" : "prima: "}„${lcFirst(first.title.ro)}”); ${n === 1 ? "rezolvată, poate" : "rezolvate, pot"} transforma mai multe vizite în ${customers.ro}.`,
        )
      : bi(
          `The website scores ${score} out of 100 and covers the basics.`,
          `Site-ul are scorul ${score} din 100 și acoperă elementele de bază.`,
        );
  } else {
    site = bi("", "");
  }

  return bi(
    [work.en, site.en].filter(Boolean).join(" "),
    [work.ro, site.ro].filter(Boolean).join(" "),
  );
}

/* ---------------------------------------------------- start and "Pe scurt" */

/** What "start here" is about, for the sentences below. */
export type StartContext = {
  reason: StartReason;
  /** The recommended strategy (acquire, automate or assist). */
  pick: string;
  type: BusinessTypeDef;
  /** Typical payback of the starting strategy, whole months (null: over two years). */
  paybackMonths: number | null;
  /** The process the starting automations save most time on ("programări"). */
  process?: Bilingual;
  /** Measured website gaps (acquire with a working site). */
  gaps: number;
  unreachable: boolean;
  /**
   * The plan opens with website work although we start with automation or the
   * assistant: its one-off cost, its months ("lunile 1–2") and whether it is only
   * the Google profile. "Pe scurt" line 1 then names both starting points in order.
   */
  siteFirst?: { lei: number; span: Bilingual; googleOnly: boolean };
};

/** "Întâi punem la punct site-ul (≈ 4.500 lei, lunile 1–2), apoi trecem la " */
function siteFirstOpening(site: NonNullable<StartContext["siteFirst"]>): Bilingual {
  const cost = approxLei(site.lei);
  const what = site.googleOnly
    ? bi("we complete the Google profile", "completăm profilul Google")
    : bi("we fix the website", "punem la punct site-ul");
  return bi(
    `First ${what.en} (${cost.en}, ${site.span.en}), then`,
    `Întâi ${what.ro} (${cost.ro}, ${site.span.ro}), apoi trecem la`,
  );
}

/** The sentence after "Începem aici" on the plan's site phase, when it opens the plan. */
export function siteFirstReason(site: NonNullable<StartContext["siteFirst"]>): Bilingual {
  return site.googleOnly
    ? bi(
        "This is where we'd start: a small job that comes before the automations.",
        "Aici am începe: o lucrare mică, făcută înaintea automatizărilor.",
      )
    : bi(
        "This is where we'd start: small fixes on the website, done before the automations.",
        "Aici am începe: remedieri mici pe site, făcute înaintea automatizărilor.",
      );
}

/**
 * The sentence after "Începem aici" on the starting strategy card (and the starting
 * phase, unless website work opens the plan). No month count: the chart's break-even
 * is the one payback figure on the page.
 */
export function startReasonText(ctx: StartContext): Bilingual {
  const lead = ctx.siteFirst
    ? bi(
        "This is where we'd start, right after the website work",
        "Aici am începe, imediat după lucrările la site",
      )
    : bi("This is where we'd start", "Aici am începe");
  const customers = ctx.type.customers;
  switch (ctx.reason) {
    case "no-site":
    case "weak-site":
      return bi(
        `${lead.en}: without a working website, the rest has nowhere to send people.`,
        `${lead.ro}: fără un site care funcționează, celelalte nu au unde să ducă oamenii.`,
      );
    case "automate-payback":
      if (ctx.paybackMonths !== null) {
        return bi(
          `${lead.en}: it is the part that pays for itself fastest, through the time won back.`,
          `${lead.ro}: e partea care își scoate cel mai repede banii, din timpul câștigat.`,
        );
      }
      break;
    case "assist-payback":
      if (ctx.paybackMonths !== null) {
        return bi(
          `${lead.en}: it takes most repeat questions and pays for itself fastest.`,
          `${lead.ro}: preia cele mai multe întrebări repetitive și își scoate cel mai repede banii.`,
        );
      }
      break;
    case "acquire-gaps":
      return bi(
        `${lead.en}: what's missing on the website costs you ${customers.en}, and the rest of the plan leans on the site.`,
        `${lead.ro}: ce lipsește pe site te face să pierzi ${customers.ro}, iar restul planului se sprijină pe site.`,
      );
  }
  return bi(
    `${lead.en}: the best ratio of cost to time won back.`,
    `${lead.ro}: cel mai bun raport între cost și timp câștigat.`,
  );
}

/** "Pe scurt" line 1: where we start and why. */
export function startLine(ctx: StartContext): Bilingual {
  const customers = { en: ctx.type.customers.en, ro: roDefinite(ctx.type.customers.ro) };
  const n = ctx.paybackMonths;
  const process = ctx.process ?? bi("routine work", "munca de rutină");
  const assistant = bi("the website and WhatsApp assistant", "asistentul pe site și WhatsApp");
  switch (ctx.reason) {
    case "no-site": {
      if (ctx.unreachable) {
        return bi(
          `We start by getting the website back online. Without it, the rest has nowhere to send ${customers.en}.`,
          `Începem prin a repune site-ul online. Fără el, restul nu are unde să ducă ${customers.ro}.`,
        );
      }
      const site = ctx.type.bookings
        ? bi("a website with online booking", "un site cu programare online")
        : ctx.type.consumer
          ? bi(
              "a website with contact details and WhatsApp",
              "un site cu date de contact și WhatsApp",
            )
          : bi("a website that takes quote requests", "un site care primește cereri de ofertă");
      return bi(
        `We start with ${site.en}. Without it, the rest has nowhere to send ${customers.en}.`,
        `Începem cu ${site.ro}. Fără el, restul nu are unde să ducă ${customers.ro}.`,
      );
    }
    case "weak-site":
      return bi(
        `We start with the website: as it is, the rest of the plan has nowhere to send ${customers.en}.`,
        `Începem cu site-ul: așa cum e acum, restul planului nu are unde să ducă ${customers.ro}.`,
      );
    case "acquire-gaps": {
      const lost = { en: ctx.type.customers.en, ro: ctx.type.customers.ro };
      return ctx.gaps === 1
        ? bi(
            `We start with the website: one thing on it is costing you ${lost.en}.`,
            `Începem cu site-ul: un lucru de pe el te face să pierzi ${lost.ro}.`,
          )
        : bi(
            `We start with the website: ${ctx.gaps} things on it are costing you ${lost.en}.`,
            `Începem cu site-ul: ${ctx.gaps} lucruri de pe el te fac să pierzi ${lost.ro}.`,
          );
    }
  }
  // Automation or the assistant. No month here: line 3 states the plan's payback, and a
  // second figure would compete with it. When website work opens the plan, it comes first.
  const opening = ctx.siteFirst ? siteFirstOpening(ctx.siteFirst) : null;
  const assist = ctx.pick === "assist";
  const fast = n !== null && (ctx.reason === "automate-payback" || ctx.reason === "assist-payback");
  if (opening) {
    if (assist) {
      return fast
        ? bi(
            `${opening.en} ${assistant.en}, which takes most repeat questions and pays for itself fastest.`,
            `${opening.ro} ${assistant.ro}, care preia cele mai multe întrebări repetitive și își scoate cel mai repede banii.`,
          )
        : bi(
            `${opening.en} ${assistant.en}, which has the best ratio of cost to time won back.`,
            `${opening.ro} ${assistant.ro}, care are cel mai bun raport între cost și timp câștigat.`,
          );
    }
    return fast
      ? bi(
          `${opening.en} automating ${process.en}, which pays for itself fastest.`,
          `${opening.ro} automatizările pentru ${process.ro}, care își scot cel mai repede banii.`,
        )
      : bi(
          `${opening.en} automating ${process.en}, which has the best ratio of cost to time won back.`,
          `${opening.ro} automatizările pentru ${process.ro}, care au cel mai bun raport între cost și timp câștigat.`,
        );
  }
  if (assist) {
    return fast
      ? bi(
          `We start with ${assistant.en}: it takes most repeat questions and pays for itself fastest.`,
          `Începem cu ${assistant.ro}: preia cele mai multe întrebări repetitive și își scoate cel mai repede banii.`,
        )
      : bi(
          `We start with ${assistant.en}: it has the best ratio of cost to time won back.`,
          `Începem cu ${assistant.ro}: are cel mai bun raport între cost și timp câștigat.`,
        );
  }
  return fast
    ? bi(
        `We start by automating ${process.en}: they pay for themselves fastest, through the time won back.`,
        `Începem cu automatizările pentru ${process.ro}: își scot cel mai repede banii, din timpul câștigat.`,
      )
    : bi(
        `We start by automating ${process.en}: it has the best ratio of cost to time won back.`,
        `Începem cu automatizările pentru ${process.ro}: au cel mai bun raport între cost și timp câștigat.`,
      );
}

/** The process most of the hours come from, as it reads after "mai ales la". */
export function topProcess(opportunities: AutomationOpportunity[]): Bilingual | undefined {
  const byProcess = new Map<string, number>();
  for (const o of opportunities) {
    const key = PROCESS_WORDS[o.process] ? o.process : "";
    if (!key) continue;
    byProcess.set(key, (byProcess.get(key) ?? 0) + midOf(o.hoursSavedPerMonth));
  }
  const best = [...byProcess.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? { ...PROCESS_WORDS[best[0]] } : undefined;
}

/** "Pe scurt" line 2: the hours, the same figure as the headline and the Gantt total. */
export function hoursLine(
  hours: number,
  process: Bilingual | undefined,
  type: BusinessTypeDef,
): Bilingual {
  const customers = { en: type.customers.en, ro: roDefinite(type.customers.ro) };
  if (hours <= 0) {
    return bi(
      `The plan is about new ${customers.en}, not hours won back.`,
      `Planul aduce mai ales ${customers.ro} noi, nu ore câștigate.`,
    );
  }
  const qty = hoursPerMonth(hours);
  if (hours < 10) {
    return bi(
      `The main gain is new ${customers.en}: the automations win back only ${qty.en}.`,
      `Câștigul principal sunt ${customers.ro} noi: automatizările câștigă doar ${qty.ro}.`,
    );
  }
  return process
    ? bi(
        `The automations win back ${qty.en}, mostly on ${process.en}.`,
        `Automatizările câștigă ${qty.ro}, mai ales la ${process.ro}.`,
      )
    : bi(`The automations win back ${qty.en}.`, `Automatizările câștigă ${qty.ro}.`);
}

/** "Pe scurt" line 3 (carries note 1): the break-even month, or that it is outside 24 months. */
export function paybackLine(month: number | null, hasAutomations: boolean): Bilingual {
  if (!hasAutomations) {
    return bi(
      "The cost is the website work; its gain is new customers, which we don't put a price on.",
      "Costul e lucrul la site; câștigul sunt clienții noi, pe care nu îi evaluăm în bani.",
    );
  }
  if (month === null) {
    return bi(
      "On the base estimate, the automation investment doesn't pay back within the first 24 months.",
      "Cu estimarea de bază, investiția în automatizări nu se recuperează în primele 24 de luni.",
    );
  }
  const m = monthLabel(month);
  return bi(
    `The automation investment pays back in ${m.en}, on the base estimate.`,
    `Investiția în automatizări se recuperează în ${m.ro}, cu estimarea de bază.`,
  );
}

/** Said once, at the end of the notes. */
export const SHORT_DISCLAIMER = bi(
  "Estimates, not guarantees. We confirm them together on the first call.",
  "Estimări, nu garanții. Le confirmăm împreună la prima discuție.",
);

export const DISCLAIMER = bi(
  `Estimates, not guarantees. Based on public data (ANAF, the Trade Register, your website), INS average earnings (${WAGE_SOURCE.month.en}), typical volumes for this kind of business and Vortex's price book. Final figures come from a short discovery call.`,
  `Estimări, nu garanții. Calculele folosesc date publice (ANAF, Registrul Comerțului, site-ul tău), câștigul salarial mediu INS (${WAGE_SOURCE.month.ro}), volume tipice pentru acest tip de afacere și lista de prețuri Vortex. Cifrele finale le stabilim împreună, după o scurtă discuție de evaluare.`,
);

export function baseNotes(type: BusinessTypeDef): Bilingual[] {
  return [
    bi(
      `Volumes are typical for a ${type.label.en.toLowerCase()} of this size, not measured; each automation lists its own.`,
      `Volumele sunt tipice pentru o afacere de tipul „${type.label.ro}” de această mărime, nu sunt măsurate; fiecare automatizare își arată propriile volume.`,
    ),
    bi(
      "Costs are a one-off setup plus monthly tools from Vortex Hub's price book (RON, excluding VAT); the Vortex Hub plan fee is separate.",
      "Costurile includ implementarea, plătită o singură dată, și instrumentele lunare, conform listei de prețuri Vortex Hub (lei, fără TVA); abonamentul Vortex Hub se plătește separat.",
    ),
    bi(
      "Projection: setup is paid when its phase of the plan starts; the hours won back start the month after, at half the first month and in full after that.",
      "Proiecție: implementarea se plătește la începutul etapei din plan; orele câștigate încep din luna următoare, pe jumătate în prima lună și integral după aceea.",
    ),
  ];
}

/** Whole months for "cam {n} luni" (null when over two years or never). */
export function wholeMonths(months: number, limit = 24): number | null {
  if (!Number.isFinite(months) || months > limit) return null;
  return Math.max(1, Math.ceil(months));
}

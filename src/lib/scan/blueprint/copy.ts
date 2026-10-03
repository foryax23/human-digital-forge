import type {
  AuditFinding,
  AutomationOpportunity,
  Bilingual,
  Blueprint,
  CompanyProfile,
  ScanTarget,
  WebsiteAudit,
} from "@/lib/scan/types";

import { formatRange, lcFirst, midpoint, roCount } from "./format";
import { bi } from "./model";
import type { BusinessTypeDef } from "./taxonomy";
import { WAGE_SOURCE } from "./wages";

/* Bilingual templates for the headline, summary and disclaimer. */

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

export function buildHeadline(args: {
  name: Bilingual | null;
  type: BusinessTypeDef;
  totals: Blueprint["totals"];
  stepCount: number;
}): Bilingual {
  const name = args.name ?? bi("Your business", "Afacerea ta");
  const hours = Math.round(midpoint(args.totals.hoursSavedPerMonth));
  if (hours >= 10) {
    return bi(
      `${name.en} could win back about ${hours} hours a month`,
      `${name.ro} poate economisi aproximativ ${roCount(hours, "ore")} pe lună`,
    );
  }
  const customers = args.type.customers;
  return bi(
    `${name.en}: ${args.stepCount} practical steps to win more ${customers.en}`,
    `${name.ro}: ${roCount(args.stepCount, "pași practici")} pentru mai mulți ${customers.ro}`,
  );
}

function list(items: string[], and: string) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

export function buildSummary(args: {
  type: BusinessTypeDef;
  opportunities: AutomationOpportunity[];
  totals: Blueprint["totals"];
  hourlyCostRon: number;
  websiteActions: AuditFinding[];
  audit?: WebsiteAudit;
  hasWebsite: boolean;
}): Bilingual {
  const top = [...args.opportunities]
    .sort((a, b) => b.monthlySavingsRon.high - a.monthlySavingsRon.high)
    .slice(0, 3);
  const count = args.opportunities.length;
  const savings = args.totals.monthlySavingsRon;
  const customers = args.type.customers;

  const work = count
    ? bi(
        `We found ${count} tasks that can be automated, led by ${list(
          top.map((o) => lcFirst(o.title.en)),
          "and",
        )}, worth an estimated ${formatRange(savings, "en")} RON a month in staff time at ${args.hourlyCostRon} RON/hour.`,
        `Am găsit ${roCount(count, "activități")} care pot fi automatizate, mai ales ${list(
          top.map((o) => lcFirst(o.title.ro)),
          "și",
        )}, cu o economie estimată de ${formatRange(savings, "ro")} lei pe lună din timpul echipei (la ${args.hourlyCostRon} lei/oră).`,
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
            `Site-ul nu a putut fi deschis la scanare, așa că primul pas este să funcționeze din nou, rapid și cu ${contact.ro}.`,
          )
        : bi(
            `There is no working website yet, so a fast site with ${contact.en} comes first to bring in ${customers.en}.`,
            `Nu există încă un site funcțional, așa că primul pas este un site rapid, cu ${contact.ro}, care să aducă ${customers.ro}.`,
          );
  } else if (args.audit) {
    const score = args.audit.scores.overall;
    const first = args.websiteActions[0];
    const n = args.websiteActions.length;
    site = first
      ? bi(
          `The website scores ${score}/100; we found ${n} ${n === 1 ? "issue" : "issues"} worth fixing first (${n === 1 ? "" : "starting with "}“${lcFirst(first.title.en)}”) that could turn more visits into ${customers.en}.`,
          `Site-ul are scorul ${score}/100; am găsit ${roCount(n, n === 1 ? "problemă" : "probleme")} de rezolvat cu prioritate (${n === 1 ? "" : "prima: "}„${lcFirst(first.title.ro)}”); ${n === 1 ? "rezolvată, poate" : "rezolvate, pot"} transforma mai multe vizite în ${customers.ro}.`,
        )
      : bi(
          `The website scores ${score}/100 and covers the basics.`,
          `Site-ul are scorul ${score}/100 și acoperă elementele de bază.`,
        );
  } else {
    site = bi("", "");
  }

  return bi(
    [work.en, site.en].filter(Boolean).join(" "),
    [work.ro, site.ro].filter(Boolean).join(" "),
  );
}

export const DISCLAIMER = bi(
  `Estimates, not guarantees. Based on public data (ANAF, the Trade Register, your website), INS average earnings (${WAGE_SOURCE.month.en}), typical volumes for this kind of business and Vortex's price book. Final figures come from a short discovery call.`,
  `Estimări, nu garanții. Calculele folosesc date publice (ANAF, Registrul Comerțului, site-ul tău), câștigul salarial mediu INS (${WAGE_SOURCE.month.ro}), volume tipice pentru acest tip de afacere și lista de prețuri Vortex. Cifrele finale le stabilim împreună, după o scurtă discuție de evaluare.`,
);

export function baseNotes(type: BusinessTypeDef): Bilingual[] {
  return [
    bi(
      `Volumes are typical for a ${type.label.en.toLowerCase()} of this size, not measured; each opportunity lists its own.`,
      `Volumele sunt tipice pentru o afacere de tipul „${type.label.ro}” de această mărime, nu sunt măsurate; fiecare oportunitate își arată propriile volume.`,
    ),
    bi(
      "Costs are a one-off setup plus monthly tools from Vortex's price book (RON, excluding VAT); Vortex plan fees are separate.",
      "Costurile includ implementarea, plătită o singură dată, și instrumentele lunare, conform listei de prețuri Vortex (lei, fără TVA); abonamentul Vortex se plătește separat.",
    ),
    bi(
      "Projection: setup is paid when its roadmap phase starts; savings begin the month after, at 50% and then 100%.",
      "Proiecție: implementarea se plătește la începutul etapei din plan; economiile încep din luna următoare, întâi la 50%, apoi la 100%.",
    ),
  ];
}

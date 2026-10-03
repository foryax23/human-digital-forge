import type {
  AuditFinding,
  Bilingual,
  OnlinePresence,
  Range,
  WebsiteAudit,
} from "@/lib/scan/types";

import { PRICE_BOOK } from "./economics";
import { ucFirst } from "./format";
import { bi } from "./model";
import type { BusinessTypeDef } from "./taxonomy";

/*
 * The website work in the plan, each item with its kind and its price-book
 * cost: the roadmap lists it, the acquire strategy and the Gantt price it,
 * and the impact chart leaves it out (it brings customers, not hours). All of
 * it sits in the first phase, so the site row of the plan is exactly "the
 * website work" that the notes, the footer and the Cost figure name; the
 * bigger items stretch that phase into month 2 (`later`).
 */

export type WebsiteWorkKind =
  | "new-site"
  | "rebuild"
  | "fix"
  | "measurement"
  | "google-profile"
  | "local-seo"
  | "kickoff";

export type WebsiteWorkItem = {
  /** Always the first phase: one site row in the plan, one site figure everywhere. */
  phase: "foundation";
  kind: WebsiteWorkKind;
  item: Bilingual;
  cost: Range;
  /** Bigger work done after the quick fixes: the site phase then runs months 1–2. */
  later?: boolean;
};

/** Words in a finding id → the opportunity that fixes it. */
const SOLVED_BY: Record<string, string> = {
  booking: "online-booking",
  "live-chat": "ai-assistant",
  chat: "ai-assistant",
  review: "review-requests",
  cart: "abandoned-cart",
};

/** Quick fixes first, then at most two bigger ones. */
const MAX_QUICK = 3;
const MAX_BIGGER = 2;
const FREE: Range = { low: 0, high: 0 };

export function noWorkingSite(hasWebsite: boolean, audit: WebsiteAudit | undefined): boolean {
  return !hasWebsite || Boolean(audit && !audit.reachable);
}

/** The first website step: rebuild an unreachable site, or a new one shaped by the type. */
export function newSiteItem(type: BusinessTypeDef, unreachable = false): Bilingual {
  if (unreachable) {
    return bi(
      "Get the website back online, fast and mobile-first",
      "Repune site-ul online, rapid și optimizat pentru mobil",
    );
  }
  if (type.bookings) {
    return bi(
      "A fast, mobile-first website with contact and booking",
      "Un site rapid, optimizat pentru mobil, cu contact și programare",
    );
  }
  return type.consumer
    ? bi(
        "A fast, mobile-first website with contact details and WhatsApp",
        "Un site rapid, optimizat pentru mobil, cu date de contact și WhatsApp",
      )
    : bi(
        "A fast, mobile-first website with contact and quote requests",
        "Un site rapid, optimizat pentru mobil, cu contact și cereri de ofertă",
      );
}

/** A finding as a line of the site phase, under its title "Remedieri pe site". */
function fixItem(finding: AuditFinding): Bilingual {
  return bi(ucFirst(finding.title.en), ucFirst(finding.title.ro));
}

export function websiteWork(args: {
  type: BusinessTypeDef;
  websiteActions: AuditFinding[];
  audit?: WebsiteAudit;
  presence?: OnlinePresence;
  hasWebsite: boolean;
  /** Opportunities in the plan: a finding one of them solves is not repeated. */
  opportunityIds: string[];
}): WebsiteWorkItem[] {
  const { audit, presence } = args;
  const work: WebsiteWorkItem[] = [];
  const add = (when: "first" | "later", kind: WebsiteWorkKind, item: Bilingual, cost: Range) =>
    work.push({
      phase: "foundation",
      kind,
      item,
      cost: { ...cost },
      ...(when === "later" ? { later: true } : {}),
    });

  // Month 1: get the website and the basics right first.
  if (noWorkingSite(args.hasWebsite, audit)) {
    const unreachable = Boolean(audit && !audit.reachable);
    add(
      "first",
      unreachable ? "rebuild" : "new-site",
      newSiteItem(args.type, unreachable),
      PRICE_BOOK.newWebsite,
    );
  }
  const selected = new Set(args.opportunityIds);
  const actions = args.websiteActions.filter(
    (f) => !Object.entries(SOLVED_BY).some(([word, id]) => f.id.includes(word) && selected.has(id)),
  );
  const quick = actions.filter((f) => f.effort === "quick");
  const bigger = actions.filter((f) => f.effort !== "quick");
  for (const finding of quick.slice(0, MAX_QUICK)) {
    add("first", "fix", fixItem(finding), PRICE_BOOK.websiteFix.quick);
  }
  if (
    audit?.reachable &&
    !audit.signals.hasAnalytics &&
    !args.websiteActions.some((f) => /analytics|tracking/.test(f.id))
  ) {
    add(
      "first",
      "measurement",
      bi(
        "Visitor statistics and a count of the enquiries the site brings, after cookie consent",
        "Statistici de trafic și evidența cererilor venite de pe site, după acordul pentru cookie-uri",
      ),
      PRICE_BOOK.measurement,
    );
  }
  if (presence?.profiles.find((p) => p.platform === "google-business")?.status === "missing") {
    add(
      "first",
      "google-profile",
      bi(
        "Claim and complete your Google Business Profile",
        "Revendică și completează profilul Google Business",
      ),
      PRICE_BOOK.googleProfile,
    );
  }

  // Then the bigger website work, in the same phase.
  for (const finding of bigger.slice(0, MAX_BIGGER)) {
    add("later", "fix", fixItem(finding), PRICE_BOOK.websiteFix[finding.effort]);
  }
  if (audit?.reachable && audit.scores.seo < 70) {
    add(
      "later",
      "local-seo",
      bi(
        "Easier to find on Google and Maps nearby: the Google profile, reviews and a page for each service",
        "Mai ușor de găsit în Google și pe hartă, în zona ta: profilul Google, recenziile și câte o pagină pentru fiecare serviciu",
      ),
      // Priced like a medium website fix: service pages and markup.
      PRICE_BOOK.websiteFix.medium,
    );
  }

  if (!work.length) {
    work.unshift({
      phase: "foundation",
      kind: "kickoff",
      item: bi(
        "Kick-off: goals, access and data check",
        "Ședința de start: obiective, accese și verificarea datelor",
      ),
      cost: { ...FREE },
    });
  }
  return work;
}

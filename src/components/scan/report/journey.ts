import type {
  AuditFinding,
  Bilingual,
  CompanyProfile,
  OnlinePresence,
  WebsiteAudit,
} from "@/lib/scan/types";
import { roNeedsDe } from "@/lib/scan/blueprint/format";

import { formatNumber } from "./format";

export type JourneyStageId = "discover" | "consider" | "contact" | "book" | "return";
export type JourneyStatus = "strong" | "weak" | "missing";

export type JourneyStage = {
  id: JourneyStageId;
  label: Bilingual;
  question: Bilingual;
  status: JourneyStatus;
  /** What the scan actually saw, stated plainly. */
  found: Bilingual[];
  /** The next fix; absent when the stage is already strong. */
  fix?: Bilingual;
};

const L = (en: string, ro: string): Bilingual => ({ en, ro });
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function topFinding(audit: WebsiteAudit | undefined, test: (finding: AuditFinding) => boolean) {
  return audit?.findings
    .filter(test)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];
}

function joinList(items: string[], and: string) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/**
 * The five-stage customer journey (discover → consider → contact → book/buy →
 * return), each rated strong / weak / missing purely from signals the scan
 * measured, with no guesses about things we couldn't see.
 */
export function deriveJourney({
  audit,
  presence,
  company,
}: {
  audit?: WebsiteAudit | null;
  presence?: OnlinePresence | null;
  company?: CompanyProfile | null;
}): JourneyStage[] {
  const site = audit && audit.reachable ? audit : undefined;
  const s = site?.signals;
  const googleProfile = presence?.profiles.find((p) => p.platform === "google-business");
  const hasGoogle =
    Boolean(presence?.googleRating) || Boolean(googleProfile && googleProfile.status !== "missing");
  const socialCount = presence
    ? presence.profiles.filter(
        (p) =>
          p.platform !== "website" && p.platform !== "google-business" && p.status !== "missing",
      ).length
    : (s?.socialLinks.length ?? 0);
  const rating = presence?.googleRating;

  /* ---- Discover */
  const discover: JourneyStage = {
    id: "discover",
    label: L("Discover", "Descoperire"),
    question: L("Can people find you?", "Te găsesc clienții?"),
    status: "missing",
    found: [],
  };
  if (!site) {
    discover.status = hasGoogle ? "weak" : "missing";
    discover.found.push(L("No website we could analyse", "Niciun site pe care să-l putem analiza"));
    if (hasGoogle)
      discover.found.push(L("Google Business profile found", "Profil Google Business găsit"));
    discover.fix = L(
      "Launch a fast website with your services, city and contact details so Google can list you.",
      "Lansează un site rapid cu serviciile, orașul și datele de contact, ca Google să te poată afișa.",
    );
  } else {
    const seo = site.scores.seo;
    discover.found.push(L(`SEO score ${seo}/100`, `Scor SEO ${seo}/100`));
    discover.found.push(
      s?.hasStructuredData
        ? L("Business details marked up for Google", "Datele afacerii sunt marcate pentru Google")
        : L("No structured business data for Google", "Fără date structurate pentru Google"),
    );
    if (presence) {
      discover.found.push(
        hasGoogle
          ? L("Google Business profile found", "Profil Google Business găsit")
          : L("No Google Business profile found", "Fără profil Google Business"),
      );
    }
    discover.status = seo >= 75 && (s?.hasStructuredData || hasGoogle) ? "strong" : "weak";
    discover.fix =
      topFinding(site, (f) => f.category === "seo")?.recommendation ??
      L(
        "Add LocalBusiness markup and keep your Google Business profile complete.",
        "Adaugă marcajul LocalBusiness și păstrează profilul Google Business complet.",
      );
  }

  /* ---- Consider */
  const consider: JourneyStage = {
    id: "consider",
    label: L("Consider", "Evaluare"),
    question: L("Do they trust what they see?", "Au încredere în ce văd?"),
    status: "missing",
    found: [],
  };
  let trust = 0;
  if (site) {
    const perf = site.scores.performance ?? site.pagespeed?.performance;
    if (site.https) {
      trust++;
      consider.found.push(L("Secure HTTPS connection", "Conexiune securizată HTTPS"));
    } else {
      consider.found.push(
        L("No HTTPS, so browsers warn visitors", "Fără HTTPS: browserele avertizează vizitatorii"),
      );
    }
    if (perf !== undefined) {
      if (perf >= 70) trust++;
      consider.found.push(L(`Mobile performance ${perf}/100`, `Performanță pe mobil ${perf}/100`));
    }
    if (s?.hasBlog) {
      trust++;
      consider.found.push(L("Articles or a blog found", "Am găsit articole sau un blog"));
    }
  } else {
    consider.found.push(
      L("No website to judge your work by", "Niciun site pe care clienții să-ți vadă munca"),
    );
  }
  if (rating) {
    if (rating.rating >= 4.3 && rating.reviews >= 20) trust++;
    consider.found.push(
      L(
        `Google rating ${formatNumber(rating.rating, "en", 1)} from ${formatNumber(rating.reviews, "en")} reviews`,
        `Nota Google ${formatNumber(rating.rating, "ro", 1)} din ${formatNumber(rating.reviews, "ro")} ${roNeedsDe(rating.reviews) ? "de " : ""}recenzii`,
      ),
    );
  }
  consider.status = trust >= 3 ? "strong" : trust >= 1 ? "weak" : "missing";
  consider.fix = site
    ? (topFinding(site, (f) => f.category === "performance" || f.category === "content")
        ?.recommendation ??
      L(
        "Speed up the mobile site and show real reviews and examples of your work.",
        "Accelerează site-ul pe mobil și arată recenzii reale și exemple din munca ta.",
      ))
    : L(
        "Show your work, prices and real reviews where people compare options.",
        "Arată-ți munca, prețurile și recenzii reale acolo unde oamenii compară opțiunile.",
      );

  /* ---- Contact */
  const contact: JourneyStage = {
    id: "contact",
    label: L("Contact", "Contact"),
    question: L("Can they reach you easily?", "Te pot contacta ușor?"),
    status: "missing",
    found: [],
  };
  if (site && s) {
    const channels: Array<[boolean, Bilingual]> = [
      [s.hasPhone, L("phone", "telefon")],
      [s.hasEmail, L("email", "e-mail")],
      [s.hasContactForm, L("contact form", "formular de contact")],
      [s.hasWhatsApp, L("WhatsApp", "WhatsApp")],
      [s.hasLiveChat, L("live chat", "chat live")],
    ];
    const have = channels.filter(([ok]) => ok).map(([, name]) => name);
    const lack = channels.filter(([ok]) => !ok).map(([, name]) => name);
    if (have.length) {
      contact.found.push(
        L(
          `Found: ${joinList(
            have.map((c) => c.en),
            "and",
          )}`,
          `Am găsit: ${joinList(
            have.map((c) => c.ro),
            "și",
          )}`,
        ),
      );
    }
    if (lack.length) {
      contact.found.push(
        L(
          `Missing: ${joinList(
            lack.map((c) => c.en),
            "and",
          )}`,
          `${lack.length === 1 ? "Lipsește" : "Lipsesc"}: ${joinList(
            lack.map((c) => c.ro),
            "și",
          )}`,
        ),
      );
    }
    const instant = s.hasWhatsApp || s.hasLiveChat;
    contact.status = have.length >= 3 && instant ? "strong" : have.length >= 1 ? "weak" : "missing";
    contact.fix = !instant
      ? L(
          "Add a WhatsApp button and an assistant that answers questions after hours.",
          "Adaugă un buton WhatsApp și un asistent care răspunde la întrebări după program.",
        )
      : L(
          "Add a short contact form on every page.",
          "Adaugă un formular scurt de contact pe fiecare pagină.",
        );
  } else {
    contact.status = company?.phone ? "weak" : "missing";
    if (company?.phone) {
      contact.found.push(
        L("Phone number in the official records", "Număr de telefon în evidențele oficiale"),
      );
    }
    contact.fix = L(
      "Make it easy to reach you: phone, WhatsApp and a short form in one place.",
      "Fă-le clienților ușor să te contacteze: telefon, WhatsApp și un formular scurt, într-un singur loc.",
    );
  }

  /* ---- Book / buy */
  const book: JourneyStage = {
    id: "book",
    label: L("Book / buy", "Programare / cumpărare"),
    question: L(
      "Can they book or buy without waiting?",
      "Pot face o programare sau o comandă fără să aștepte?",
    ),
    status: "missing",
    found: [],
  };
  if (site && s) {
    if (s.hasOnlineBooking) book.found.push(L("Online booking found", "Programare online găsită"));
    if (s.hasEcommerce) book.found.push(L("Online shop found", "Magazin online găsit"));
    if (s.hasOnlineBooking || s.hasEcommerce) {
      book.status = "strong";
    } else if (s.hasContactForm || s.hasPhone || s.hasWhatsApp) {
      book.status = "weak";
      book.found.push(
        L(
          "Bookings and orders need a call or a message",
          "Programările și comenzile se fac doar prin apel sau mesaj",
        ),
      );
    } else {
      book.found.push(
        L("No way to book or order on the site", "Pe site nu se pot face programări sau comenzi"),
      );
    }
  } else {
    book.found.push(L("No website to book or buy on", "Niciun site pentru programări sau comenzi"));
  }
  book.fix =
    topFinding(site, (f) => /booking|ecommerce|checkout/i.test(f.id))?.recommendation ??
    L(
      "Let customers book or buy online, with real availability and automatic confirmations.",
      "Lasă clienții să se programeze sau să cumpere online, cu disponibilitate reală și confirmări automate.",
    );

  /* ---- Return */
  const retain: JourneyStage = {
    id: "return",
    label: L("Return", "Revenire"),
    question: L("Do they come back?", "Revin clienții?"),
    status: "missing",
    found: [],
  };
  let loyalty = 0;
  if (site && s) {
    if (s.hasNewsletter) loyalty++;
    if (s.hasMarketingPixel) loyalty++;
    retain.found.push(
      s.hasNewsletter
        ? L("Newsletter sign-up found", "Abonare la newsletter găsită")
        : L("No newsletter sign-up", "Fără abonare la newsletter"),
    );
    retain.found.push(
      s.hasMarketingPixel
        ? L("Remarketing pixel found", "Pixel de remarketing găsit")
        : L("No remarketing pixel", "Fără pixel de remarketing"),
    );
  }
  if (socialCount >= 2) loyalty++;
  retain.found.push(
    socialCount
      ? L(
          `${socialCount} social ${socialCount === 1 ? "profile" : "profiles"} found`,
          `${socialCount} ${socialCount === 1 ? "profil social găsit" : "profiluri sociale găsite"}`,
        )
      : L("No social profiles found", "Niciun profil social găsit"),
  );
  retain.status = loyalty >= 2 ? "strong" : loyalty >= 1 || socialCount ? "weak" : "missing";
  retain.fix = L(
    "Follow up automatically: reminders, review requests and offers for returning customers.",
    "Păstrează legătura automat: reamintiri, cereri de recenzii și oferte pentru clienții care revin.",
  );

  const stages = [discover, consider, contact, book, retain];
  for (const stage of stages) if (stage.status === "strong") delete stage.fix;
  return stages;
}

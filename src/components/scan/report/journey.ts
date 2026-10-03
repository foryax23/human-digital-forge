import type { Bilingual, CompanyProfile, OnlinePresence, WebsiteAudit } from "@/lib/scan/types";
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
  /** What we do next at this stage, in one line of its own; absent when it is already strong. */
  fix?: Bilingual;
};

const L = (en: string, ro: string): Bilingual => ({ en, ro });

function joinList(items: string[], and: string) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/**
 * The five-stage customer journey (discover → consider → contact → book/buy →
 * return), each rated strong / weak / missing purely from signals the scan
 * measured, with no guesses about things we couldn't see. Each stage says what
 * we do there in its own words (first person plural, plain language), never a
 * copy of a finding from the website table.
 */
export function deriveJourney({
  audit,
  presence,
  company,
  bookings = false,
}: {
  audit?: WebsiteAudit | null;
  presence?: OnlinePresence | null;
  company?: CompanyProfile | null;
  /** Appointments, not orders (unless the site has a shop): no "comandă" for a clinic. */
  bookings?: boolean;
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
      "We build a fast website with your services, city and contact details, so Google can list you.",
      "Facem un site rapid cu serviciile, orașul și datele de contact, ca Google să te poată afișa.",
    );
  } else {
    const seo = site.scores.seo;
    discover.found.push(
      L(`Google visibility ${seo} of 100`, `Vizibilitate în Google: ${seo} din 100`),
    );
    discover.found.push(
      s?.hasStructuredData
        ? L(
            "Google gets your hours and address from the site",
            "Google primește de pe site programul și adresa",
          )
        : L(
            "Google doesn't get your hours and address from the site",
            "Google nu primește de pe site programul și adresa",
          ),
    );
    if (presence) {
      discover.found.push(
        hasGoogle
          ? L("Google Business profile found", "Profil Google Business găsit")
          : L("No Google Business profile found", "Fără profil Google Business"),
      );
    }
    discover.status = seo >= 75 && (s?.hasStructuredData || hasGoogle) ? "strong" : "weak";
    discover.fix = hasGoogle
      ? L(
          "We give Google your hours, address and phone from the site, and keep your profile up to date.",
          "Îi dăm lui Google, de pe site, programul, adresa și telefonul și ținem profilul la zi.",
        )
      : L(
          "We set up your Google Business profile and give Google your hours, address and phone.",
          "Facem profilul Google Business și îi dăm lui Google programul, adresa și telefonul.",
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
      consider.found.push(L(`Speed on a phone ${perf} of 100`, `Viteză pe mobil: ${perf} din 100`));
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
    ? L(
        "We make the site faster on phones and show real reviews and examples of your work.",
        "Facem site-ul mai rapid pe telefon și arătăm recenzii reale și exemple din munca ta.",
      )
    : L(
        "We show your work, prices and real reviews where people compare options.",
        "Arătăm munca ta, prețurile și recenzii reale acolo unde oamenii compară.",
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
          "We add a WhatsApp button and an assistant that answers questions after hours too.",
          "Adăugăm un buton de WhatsApp și un asistent care răspunde și după program.",
        )
      : L(
          "We put a short contact form on every page.",
          "Punem un formular scurt de contact pe fiecare pagină.",
        );
  } else {
    contact.status = company?.phone ? "weak" : "missing";
    if (company?.phone) {
      contact.found.push(
        L("Phone number in the official records", "Număr de telefon în evidențele oficiale"),
      );
    }
    contact.fix = L(
      "We put the phone, WhatsApp and a short form in one place, so you are easy to reach.",
      "Punem telefonul, WhatsApp și un formular scurt într-un singur loc, ca să te găsească ușor.",
    );
  }

  /* ---- Book / buy */
  const appointments = bookings && !s?.hasEcommerce;
  const book: JourneyStage = {
    id: "book",
    label: appointments ? L("Book", "Programare") : L("Book / buy", "Programare / cumpărare"),
    question: appointments
      ? L("Can they book without waiting?", "Se pot programa fără să aștepte?")
      : L(
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
        appointments
          ? L("Bookings need a call or a message", "Programările se fac doar prin apel sau mesaj")
          : L(
              "Bookings and orders need a call or a message",
              "Programările și comenzile se fac doar prin apel sau mesaj",
            ),
      );
    } else {
      book.found.push(
        appointments
          ? L("No way to book on the site", "Pe site nu se pot face programări")
          : L(
              "No way to book or order on the site",
              "Pe site nu se pot face programări sau comenzi",
            ),
      );
    }
  } else {
    book.found.push(
      appointments
        ? L("No website to book on", "Niciun site pentru programări")
        : L("No website to book or buy on", "Niciun site pentru programări sau comenzi"),
    );
  }
  book.fix = appointments
    ? L(
        "We put booking online, with real free slots and automatic confirmations.",
        "Punem programarea online, cu locuri libere reale și confirmări automate.",
      )
    : L(
        "We let customers book or buy online, with real free slots and automatic confirmations.",
        "Punem programarea sau comanda online, cu locuri libere reale și confirmări automate.",
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
        ? L("You can show ads to past visitors", "Poți face reclame celor care au vizitat site-ul")
        : L(
            "You can't show ads to past visitors yet",
            "Încă nu poți face reclame celor care au vizitat site-ul",
          ),
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
    "We keep in touch automatically: reminders, review requests and offers for returning customers.",
    "Păstrăm legătura automat: reamintiri, cereri de recenzii și oferte pentru cei care revin.",
  );

  const stages = [discover, consider, contact, book, retain];
  for (const stage of stages) if (stage.status === "strong") delete stage.fix;
  return stages;
}

import { useI18n } from "@/i18n";

type Page = "privacy" | "cookies" | "terms";

/**
 * Extra wording for visitors who chose the UK version (market "uk"). Shown only to them, at
 * the top of the legal page; the rest of the page still applies. Draft wording until the
 * owner's lawyer reviews it.
 */
const COPY: Record<Page, { heading: string; points: string[] }> = {
  privacy: {
    heading: "For visitors and clients in the United Kingdom",
    points: [
      "When we process personal data of people in the UK, we also follow the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.",
      "Your rights are the same as listed below: access, correction, deletion, restriction, objection, data portability and withdrawing consent at any time.",
      "Personal data sent from the UK to us in Romania (EU) is covered by the UK's adequacy regulations for the European Economic Area.",
      "You can complain to the UK Information Commissioner's Office (ICO), ico.org.uk, 0303 123 1113. We'd appreciate the chance to resolve your concern first.",
    ],
  },
  cookies: {
    heading: "For visitors in the United Kingdom",
    points: [
      "Under the Privacy and Electronic Communications Regulations (PECR), we only set non-essential cookies (such as analytics) after you agree in the cookie banner.",
      "Essential cookies (sign-in, your language and region choice, your cookie choice) are set without consent because the site cannot work without them.",
      "You can change your choice at any time from the cookie settings link in the footer.",
    ],
  },
  terms: {
    heading: "For clients in the United Kingdom",
    points: [
      "Prices shown in pounds (GBP) are final; Vortex Hub S.R.L. is not registered for UK VAT.",
      "If you buy as a consumer, nothing in these terms limits your rights under the Consumer Rights Act 2015 or the Consumer Contracts Regulations 2013, including the 14-day cancellation right for services ordered online (unless you asked us to start sooner and the service is complete).",
      "These terms are governed by Romanian law; as a UK consumer you may also bring a claim in the courts of the part of the UK where you live.",
      "The seller is VORTEX HUB S.R.L., a company registered in Romania.",
    ],
  },
};

export function UkLegalNotice({ page }: { page: Page }) {
  const { market } = useI18n();
  if (market !== "uk") return null;
  const { heading, points } = COPY[page];
  return (
    <section aria-labelledby={`uk-${page}`} className="rounded-lg border border-line-2 p-6">
      <h2 id={`uk-${page}`} className="type-h4 text-fg">
        {heading}
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-fg-2">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </section>
  );
}

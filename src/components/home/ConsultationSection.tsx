import { Link } from "@tanstack/react-router";

import { ButtonLink, SectionHeader, buttonClass } from "@/components/system";
import { useI18n } from "@/i18n";

/**
 * The three session types as hairline rows (who it is for, a link to book). Shared by
 * the homepage and /consultancy.
 */
export function SessionRows({ headingLevel = "h3" }: { headingLevel?: "h2" | "h3" }) {
  const { t } = useI18n();
  const Heading = headingLevel;

  // Business first: the assessment most visitors come for, then the website, then ideas.
  const sessions = [
    {
      title: t("AI automation assessment", "Evaluarea automatizărilor cu AI"),
      audience: t(
        "For businesses that want to know which tasks can be automated and what they would gain.",
        "Pentru firmele care vor să afle ce sarcini se pot automatiza și ce ar câștiga.",
      ),
    },
    {
      title: t("Website strategy consultation", "Consultanță pentru strategia site-ului"),
      audience: t(
        "For businesses that want a new or redesigned website: pages, features and the visitor's path to an enquiry.",
        "Pentru firmele care vor un site nou sau refăcut: paginile, funcțiile și drumul vizitatorului până la o cerere.",
      ),
    },
    {
      title: t("Digital idea consultation", "Consultanță pentru idei digitale"),
      audience: t(
        "For people planning a digital product, a personal website or a creative project.",
        "Pentru cine pregătește un produs digital, un site personal sau un proiect creativ.",
      ),
    },
  ];

  return (
    <ul role="list" className="border-t border-rule">
      {sessions.map((session) => (
        <li
          key={session.title}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 border-b border-line-1 py-4"
        >
          <Heading className="type-h4 text-fg">{session.title}</Heading>
          <Link to="/contact" className={buttonClass("link", "sm", "sm:row-span-2")}>
            {t("Book", "Programează")}
            <span className="sr-only">: {session.title}</span>
          </Link>
          <p className="type-body-sm col-span-2 mt-1 max-w-[60ch] text-pretty text-fg-2 sm:col-span-1">
            {session.audience}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Consultation offer (#consultation): split header with the one booking button, and
 * the session rows.
 */
export function ConsultationSection() {
  const { t } = useI18n();

  return (
    <section
      id="consultation"
      aria-labelledby="consultation-heading"
      className="section-y scroll-mt-20"
    >
      <div className="container-vx">
        <SectionHeader
          layout="split"
          headingId="consultation-heading"
          kicker={t("Consultancy", "Consultanță")}
          title={t("Not sure what you need yet?", "Nu știi încă de ce ai nevoie?")}
          lead={t(
            "A one-to-one conversation about your idea, website, digital product or a possible automation. You leave with a clear next step.",
            "O discuție individuală despre idee, site, un produs digital sau o posibilă automatizare. Pleci cu următorul pas clar.",
          )}
          actions={
            <>
              <ButtonLink to="/contact">{t("Book a call", "Programează o discuție")}</ButtonLink>
              <span className="type-body-sm text-fg-3 sm:pl-2">
                {t("The first call is free.", "Prima discuție e gratuită.")}
              </span>
            </>
          }
        >
          <SessionRows />
        </SectionHeader>
      </div>
    </section>
  );
}

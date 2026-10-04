import { Link } from "@tanstack/react-router";

import { ButtonLink, SectionHeader, buttonClass } from "@/components/system";
import { useI18n } from "@/i18n";

import { CONSULTATION_SESSIONS } from "./consultation-sessions";

/**
 * The three session types as hairline rows (who it is for, a link to book). Shared by
 * the homepage and /consultancy.
 */
export function SessionRows({ headingLevel = "h3" }: { headingLevel?: "h2" | "h3" }) {
  const { t } = useI18n();
  const Heading = headingLevel;

  const sessions = CONSULTATION_SESSIONS.map((session) => ({
    id: session.id,
    title: t(session.title.en, session.title.ro),
    audience: t(session.audience.en, session.audience.ro),
  }));

  return (
    <ul role="list" className="border-t border-rule">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 border-b border-line-1 py-4"
        >
          <Heading className="type-h4 text-fg">{session.title}</Heading>
          <Link
            to="/contact"
            search={{ service: "consultancy", session: session.id }}
            className={buttonClass("link", "sm", "sm:row-span-2")}
          >
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
              <ButtonLink to="/contact" search={{ service: "consultancy" }}>
                {t("Book a call", "Programează o discuție")}
              </ButtonLink>
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

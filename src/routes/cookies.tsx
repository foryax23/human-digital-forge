import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CompanyDetails } from "@/components/shared/CompanyDetails";
import { Button } from "@/components/system";
import { pageMeta, useI18n } from "@/i18n";
import { openCookieSettings } from "@/components/cookies/cookie-consent";

export const Route = createFileRoute("/cookies")({
  head: ({ matches }) => ({
    meta: [
      ...pageMeta(matches, "/cookies"),
      { property: "og:url", content: "https://vortexhub.dev/cookies" },
    ],
    links: [{ rel: "canonical", href: "https://vortexhub.dev/cookies" }],
  }),
  component: CookiesPage,
});

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="type-h3 text-fg">{heading}</h2>
      <div className="type-body space-y-3 text-fg-2">{children}</div>
    </div>
  );
}

function CookiesPage() {
  const { t } = useI18n();

  return (
    <SiteLayout>
      <PageHero
        kicker={t("Legal", "Legal")}
        title={t("Cookie Policy", "Politica de cookie-uri")}
        description={t(
          "This policy explains what cookies are, which categories we use and how you can control them at any time.",
          "Această politică explică ce sunt cookie-urile, ce categorii folosim și cum le poți controla oricând.",
        )}
      />
      <section className="container-vx section-y">
        <div className="max-w-3xl space-y-10">
          <CompanyDetails />

          <Section heading={t("What are cookies?", "Ce sunt cookie-urile?")}>
            <p>
              {t(
                "Cookies are small text files stored on your device when you visit a website. They help the site remember your actions and preferences and allow us to understand how the site is used.",
                "Cookie-urile sunt fișiere text mici stocate pe dispozitivul tău când vizitezi un site. Ajută site-ul să rețină acțiunile și preferințele tale și ne permit să înțelegem cum este utilizat site-ul.",
              )}
            </p>
          </Section>

          <Section heading={t("Categories we use", "Categorii pe care le folosim")}>
            <p>
              <strong className="font-medium text-fg">
                {t("Strictly necessary.", "Strict necesare.")}
              </strong>{" "}
              {t(
                "Required for core functionality such as security, network management and remembering your language and consent choices. These cannot be switched off.",
                "Necesare pentru funcționalitatea de bază precum securitatea, gestionarea rețelei și reținerea limbii și a opțiunilor de consimțământ. Acestea nu pot fi dezactivate.",
              )}
            </p>
            <p>
              <strong className="font-medium text-fg">{t("Analytics.", "Analiză.")}</strong>{" "}
              {t(
                "Help us understand how visitors interact with the site so we can improve it. They are only used with your consent.",
                "Ne ajută să înțelegem cum interacționează vizitatorii cu site-ul pentru a-l îmbunătăți. Sunt folosite doar cu consimțământul tău.",
              )}
            </p>
            <p>
              <strong className="font-medium text-fg">{t("Marketing.", "Marketing.")}</strong>{" "}
              {t(
                "Used to deliver relevant content and measure the effectiveness of campaigns. They are only used with your consent.",
                "Folosite pentru a livra conținut relevant și a măsura eficiența campaniilor. Sunt folosite doar cu consimțământul tău.",
              )}
            </p>
          </Section>

          <Section heading={t("Storage in your browser", "Ce păstrăm în browserul tău")}>
            <p>
              {t(
                "Besides cookies, the site keeps a few entries in your browser's local storage. They are strictly necessary for what you ask for, stay on your device and are never sent to advertisers:",
                "Pe lângă cookie-uri, site-ul păstrează câteva intrări în spațiul local al browserului. Sunt strict necesare pentru ce ceri, rămân pe dispozitivul tău și nu ajung la firme de publicitate:",
              )}
            </p>
            <ul className="list-disc space-y-1.5 pl-5 marker:text-fg-3">
              <li>
                {t(
                  "your language and your cookie choices;",
                  "limba aleasă și opțiunile tale privind cookie-urile;",
                )}
              </li>
              <li>
                {t(
                  "for deep research (Cercetare aprofundată): a journal of the research in progress and the finished report, per account, so a closed tab can continue; deleted when you sign out or press “Șterge din acest browser”;",
                  "pentru cercetarea aprofundată: un jurnal al cercetării în curs și raportul terminat, pe cont, ca o filă închisă să poată continua; se șterg când te deconectezi sau apeși „Șterge din acest browser”;",
                )}
              </li>
              <li>
                {t(
                  "the company you were about to research before signing in (kept for at most one hour), so you return to it after login.",
                  "firma pe care urma să o cercetezi înainte de autentificare (păstrată cel mult o oră), ca să revii la ea după login.",
                )}
              </li>
            </ul>
          </Section>

          {/* OWNER DECISION PENDING (plan D22): Lovable's built-in visitor statistics. Remove this
              section if the owner turns them off in Lovable; keep it while they run. */}
          <Section
            heading={t(
              "Visitor statistics from our hosting platform",
              "Statistici de la platforma de găzduire",
            )}
          >
            <p>
              {t(
                "Our hosting platform, Lovable, may add its own visitor statistics to our pages: a script served from our domain as /~flock.js that reports page visits to /~api/analytics, for us. It is added by the platform, not by our cookie banner. We are reviewing whether to keep it; while it runs, it is listed here and in the privacy policy (section 7).",
                "Platforma noastră de găzduire, Lovable, poate adăuga propriile statistici despre vizitatori pe paginile noastre: un script servit de pe domeniul nostru ca /~flock.js, care raportează vizitele la /~api/analytics, pentru noi. Îl adaugă platforma, nu bannerul nostru de cookie-uri. Analizăm dacă îl păstrăm; cât timp funcționează, îl menționăm aici și în politica de confidențialitate (secțiunea 7).",
              )}
            </p>
          </Section>

          <Section heading={t("Managing your preferences", "Gestionarea preferințelor")}>
            <p>
              {t(
                "You can change or withdraw your consent at any time using the button below, or via the 'Cookie settings' link in the footer. You can also block or delete cookies through your browser settings.",
                "Îți poți schimba sau retrage consimțământul oricând folosind butonul de mai jos sau prin linkul „Setări cookie-uri” din subsol. De asemenea, poți bloca sau șterge cookie-urile din setările browserului tău.",
              )}
            </p>
            <Button variant="secondary" onClick={openCookieSettings} className="mt-2">
              {t("Open cookie settings", "Deschide setările cookie-uri")}
            </Button>
          </Section>

          <Section heading={t("Contact", "Contact")}>
            <p>
              {t(
                "For any question about this policy, contact us at",
                "Pentru orice întrebare despre această politică, contactează-ne la",
              )}{" "}
              <a
                className="text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
                href="mailto:hello@vortexhub.ro"
              >
                hello@vortexhub.ro
              </a>
              .
            </p>
          </Section>
        </div>
      </section>
    </SiteLayout>
  );
}

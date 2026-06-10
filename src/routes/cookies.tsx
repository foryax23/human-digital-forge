import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CompanyDetails } from "@/components/shared/CompanyDetails";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { openCookieSettings } from "@/components/cookies/cookie-consent";

const title = "Cookie Policy | Vortex Hub";
const description = "How Vortex Hub uses cookies and how you can manage your preferences.";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://vortexhub.dev/cookies" },
    ],
    links: [{ rel: "canonical", href: "https://vortexhub.dev/cookies" }],
  }),
  component: CookiesPage,
});

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-serif text-xl text-foreground">{heading}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function CookiesPage() {
  const { t } = useI18n();

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Legal", "Legal")}
        title={t("Cookie Policy", "Politica de cookie-uri")}
        description={t(
          "This policy explains what cookies are, which categories we use and how you can control them at any time.",
          "Această politică explică ce sunt cookie-urile, ce categorii folosim și cum le poți controla oricând.",
        )}
      />
      <section className="mx-auto max-w-3xl space-y-10 px-4 py-16 sm:px-6 lg:px-8">
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
            <strong className="text-foreground">{t("Strictly necessary.", "Strict necesare.")}</strong>{" "}
            {t(
              "Required for core functionality such as security, network management and remembering your language and consent choices. These cannot be switched off.",
              "Necesare pentru funcționalitatea de bază precum securitatea, gestionarea rețelei și reținerea limbii și a opțiunilor de consimțământ. Acestea nu pot fi dezactivate.",
            )}
          </p>
          <p>
            <strong className="text-foreground">{t("Analytics.", "Analiză.")}</strong>{" "}
            {t(
              "Help us understand how visitors interact with the site so we can improve it. They are only used with your consent.",
              "Ne ajută să înțelegem cum interacționează vizitatorii cu site-ul pentru a-l îmbunătăți. Sunt folosite doar cu consimțământul tău.",
            )}
          </p>
          <p>
            <strong className="text-foreground">{t("Marketing.", "Marketing.")}</strong>{" "}
            {t(
              "Used to deliver relevant content and measure the effectiveness of campaigns. They are only used with your consent.",
              "Folosite pentru a livra conținut relevant și a măsura eficiența campaniilor. Sunt folosite doar cu consimțământul tău.",
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
          <Button onClick={openCookieSettings} className="mt-2">
            {t("Open cookie settings", "Deschide setările cookie-uri")}
          </Button>
        </Section>

        <Section heading={t("Contact", "Contact")}>
          <p>
            {t("For any question about this policy, contact us at", "Pentru orice întrebare despre această politică, contactează-ne la")}{" "}
            <a className="text-primary underline-offset-4 hover:underline" href="mailto:hello@vortexhub.ro">
              hello@vortexhub.ro
            </a>
            .
          </p>
        </Section>
      </section>
    </SiteLayout>
  );
}

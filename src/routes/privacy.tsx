import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { useI18n } from "@/i18n";

const title = "Privacy Policy | Vortex Hub";
const description = "How Vortex Hub handles personal data and uploaded documents.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useI18n();

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Legal", "Legal")}
        title={t("Privacy Policy", "Politica de confidențialitate")}
        description={t(
          "This is a placeholder page. The full privacy policy will be published before any data collection or accounts go live.",
          "Aceasta este o pagină substituent. Politica completă de confidențialitate va fi publicată înainte ca orice colectare de date sau conturi să fie activată."
        )}
      />
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            {t(
              "Vortex Hub will explain here what information is collected, how it is used, how long it is kept and the rights available to you. Uploaded client files will be treated as private and never sent to AI tools without an explicit consent process.",
              "Vortex Hub va explica aici ce informații sunt colectate, cum sunt utilizate, cât timp sunt păstrate și drepturile disponibile pentru tine. Fișierele încărcate de clienți vor fi tratate ca private și nu vor fi trimise niciodată instrumentelor AI fără un proces explicit de consimțământ."
            )}
          </p>
          <p>
            {t(
              "For any privacy question in the meantime, contact us at",
              "Pentru orice întrebare privind confidențialitatea, contactează-ne la"
            )}{" "}
            <a className="text-primary underline-offset-4 hover:underline" href="mailto:hello@vortexhub.ro">
              hello@vortexhub.ro
            </a>
            .
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { ButtonLink, Status } from "@/components/system";
import { pageMeta, useI18n } from "@/i18n";

export const Route = createFileRoute("/billing-success")({
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/billing-success"),
  }),
  component: BillingSuccessPage,
});

function BillingSuccessPage() {
  const { t } = useI18n();

  return (
    <SiteLayout>
      <section className="container-vx section-y">
        <div className="max-w-2xl py-8 md:py-16">
          <Status tone="ok">{t("Payment received", "Plata a fost primită")}</Status>
          <h1 className="type-h2 mt-3 text-balance text-fg">
            {t("Thank you. Your subscription is active.", "Mulțumim. Abonamentul tău este activ.")}
          </h1>
          <p className="type-lead mt-3 max-w-[56ch] text-pretty text-fg-2">
            {t(
              "We will be in touch shortly to schedule your first session and set up your access.",
              "Te contactăm în curând ca să programăm prima sesiune și să-ți configurăm accesul.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <ButtonLink to="/dashboard" size="lg">
              {t("Go to your account", "Mergi la contul tău")}
            </ButtonLink>
            <ButtonLink to="/" size="lg" variant="secondary">
              {t("Back to the homepage", "Înapoi la prima pagină")}
            </ButtonLink>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

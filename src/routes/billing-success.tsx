import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

const title = "Subscription confirmed | Vortex Hub";
const description = "Your Vortex Hub subscription is now active.";

export const Route = createFileRoute("/billing-success")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingSuccessPage,
});

function BillingSuccessPage() {
  const { t } = useI18n();

  return (
    <SiteLayout>
      <section className="relative mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-teal/15 text-teal glow-soft">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h1 className="mt-6 text-3xl sm:text-4xl">
          {t("Thank you — your subscription is active!", "Mulțumim — abonamentul tău este activ!")}
        </h1>
        <p className="mt-4 max-w-lg text-muted-foreground">
          {t(
            "We've received your payment. Our team will be in touch shortly to schedule your first session and set up your access.",
            "Am primit plata ta. Echipa noastră te va contacta în curând pentru a programa prima sesiune și a-ți configura accesul.",
          )}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button asChild className="glow-soft">
            <Link to="/dashboard">{t("Go to dashboard", "Mergi la panou")}</Link>
          </Button>
          <Button asChild variant="outline" className="border-border glass-panel">
            <Link to="/">{t("Back to home", "Înapoi acasă")}</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}

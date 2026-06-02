import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";

const title = "Terms and Conditions | Vortex Hub";
const description = "The terms that will govern the use of Vortex Hub services.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Legal"
        title="Terms and Conditions"
        description="This is a placeholder page. Full terms will be published before services and accounts go live."
      />
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            These terms will cover proposals, scope, timelines, payments, revisions, delivery and
            the responsibilities of both Vortex Hub and its clients.
          </p>
          <p>
            Questions can be sent to{" "}
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

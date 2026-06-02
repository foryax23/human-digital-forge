import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";

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
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        description="This is a placeholder page. The full privacy policy will be published before any data collection or accounts go live."
      />
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            Vortex Hub will explain here what information is collected, how it is used, how long it
            is kept and the rights available to you. Uploaded client files will be treated as
            private and never sent to AI tools without an explicit consent process.
          </p>
          <p>
            For any privacy question in the meantime, contact us at{" "}
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

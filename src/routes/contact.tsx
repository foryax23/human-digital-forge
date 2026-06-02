import { createFileRoute } from "@tanstack/react-router";
import { Mail, Clock, ShieldCheck } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";

const title = "Contact | Vortex Hub";
const description =
  "Tell Vortex Hub about your project, digital product, website or AI automation idea.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

const points = [
  { icon: Mail, text: "Write to us at hello@vortexhub.ro" },
  { icon: Clock, text: "We aim to reply within two working days." },
  { icon: ShieldCheck, text: "Your details stay private and are used only to reply." },
];

function ContactPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Contact"
        title="Tell us what you need. We will help you shape it clearly."
        description="Share a few details about your idea or challenge and we will respond with a practical next step."
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          <ContactForm />
          <aside className="space-y-4 lg:pt-2">
            {points.map((point) => (
              <div
                key={point.text}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <point.icon className="h-4 w-4" />
                </span>
                <p className="text-sm text-muted-foreground">{point.text}</p>
              </div>
            ))}
          </aside>
        </div>
      </section>
    </SiteLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Mail, Clock, ShieldCheck } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";
import { useI18n } from "@/i18n";

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

function ContactPage() {
  const { t } = useI18n();

  const points = [
    { icon: Mail, text: t("Write to us at hello@vortexhub.ro", "Scrie-ne la hello@vortexhub.ro") },
    { icon: Clock, text: t("We aim to reply within two working days.", "Ne propunem să răspundem în două zile lucrătoare.") },
    { icon: ShieldCheck, text: t("Your details stay private and are used only to reply.", "Datele tale rămân private și sunt folosite doar pentru a răspunde.") },
  ];

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Contact", "Contact")}
        title={t(
          "Tell us what you need. We will help you shape it clearly.",
          "Spune-ne de ce ai nevoie. Te vom ajuta să-l conturezi clar."
        )}
        description={t(
          "Share a few details about your idea or challenge and we will respond with a practical next step.",
          "Împărtășește câteva detalii despre ideea sau provocarea ta și vom răspunde cu un pas practic următor."
        )}
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

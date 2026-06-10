import { createFileRoute } from "@tanstack/react-router";
import {
  Megaphone,
  Presentation,
  FileText,
  Share2,
  LayoutGrid,
  Sparkles,
} from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { useI18n } from "@/i18n";

const title = "Digital Products | Vortex Hub";
const description =
  "Posters, presentations, document formatting and visual assets designed for real, professional use.";

export const Route = createFileRoute("/digital-products")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/digital-products" }],
  }),
  component: DigitalProductsPage,
});

function DigitalProductsPage() {
  const { t } = useI18n();

  const cards = [
    { icon: Megaphone, title: t("Posters and campaign graphics", "Postere și grafice pentru campanii") },
    { icon: Presentation, title: t("Presentation design", "Design de prezentări") },
    { icon: FileText, title: t("Document formatting and layout", "Formatare și aspect de documente") },
    { icon: Share2, title: t("Social media visual assets", "Materiale vizuale pentru social media") },
    { icon: LayoutGrid, title: t("Digital templates", "Șabloane digitale") },
    { icon: Sparkles, title: t("Custom visual requests", "Cereri vizuale personalizate") },
  ];

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Digital products", "Produse digitale")}
        title={t(
          "Design that makes information clearer and ideas easier to present.",
          "Design care face informațiile mai clare și ideile mai ușor de prezentat."
        )}
        description={t(
          "From promotional posters to professionally formatted documents, Vortex Hub creates digital materials that are visually clear, polished and suitable for real use.",
          "De la postere promoționale la documente formatate profesional, Vortex Hub creează materiale digitale care sunt clare vizual, îngrijite și potrivite pentru utilizare reală."
        )}
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.title} className="rounded-xl border border-border bg-card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
                <card.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg">{card.title}</h2>
            </div>
          ))}
        </div>
      </section>
      <CtaBand
        title={t("Ready to create something polished?", "Ești gata să creezi ceva rafinat?")}
        primaryLabel={t("Request a digital product", "Solicită un produs digital")}
        primaryTo="/contact"
        secondaryLabel={t("Book a consultation", "Programează o consultanță")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { ItemList } from "@/components/shared/ItemList";
import { SectionHeader } from "@/components/system";
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

  const items = [
    { title: t("Posters and campaign graphics", "Postere și grafice pentru campanii") },
    { title: t("Presentation design", "Design de prezentări") },
    { title: t("Document formatting and layout", "Formatarea și așezarea documentelor") },
    { title: t("Social media visuals", "Materiale vizuale pentru rețelele sociale") },
    { title: t("Digital templates", "Șabloane digitale") },
    { title: t("Custom visual requests", "Cereri vizuale personalizate") },
  ];

  return (
    <SiteLayout>
      <PageHero
        kicker={t("Graphic materials", "Materiale grafice")}
        title={t(
          "Design that makes information clearer and ideas easier to present.",
          "Design care face informațiile mai clare și ideile mai ușor de prezentat.",
        )}
        description={t(
          "From promotional posters to professionally formatted documents: materials that are clear, polished and ready to use.",
          "De la postere promoționale la documente formatate profesional: materiale clare, îngrijite și gata de folosit.",
        )}
      />

      <section aria-labelledby="products-list" className="section-y">
        <div className="container-vx">
          <SectionHeader headingId="products-list" title={t("What we make", "Ce realizăm")} />
          <ItemList items={items} />
        </div>
      </section>

      <CtaBand
        title={t("Need something polished?", "Ai nevoie de ceva îngrijit?")}
        primaryLabel={t("Request a digital product", "Cere un produs digital")}
        primaryTo="/contact"
        secondaryLabel={t("Book a call", "Programează o discuție")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

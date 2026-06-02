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

const cards = [
  { icon: Megaphone, title: "Posters and campaign graphics" },
  { icon: Presentation, title: "Presentation design" },
  { icon: FileText, title: "Document formatting and layout" },
  { icon: Share2, title: "Social media visual assets" },
  { icon: LayoutGrid, title: "Digital templates" },
  { icon: Sparkles, title: "Custom visual requests" },
];

function DigitalProductsPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Digital products"
        title="Design that makes information clearer and ideas easier to present."
        description="From promotional posters to professionally formatted documents, Vortex Hub creates digital materials that are visually clear, polished and suitable for real use."
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
        title="Ready to create something polished?"
        primaryLabel="Request a digital product"
        primaryTo="/contact"
        secondaryLabel="Book a consultation"
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Rocket, Building2, User, Briefcase, RefreshCw, LayoutDashboard } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { SectionHeading } from "@/components/shared/SectionHeading";

const title = "Websites and Digital Solutions | Vortex Hub";
const description =
  "Landing pages, business websites, portfolios and client portals built around your purpose.";

export const Route = createFileRoute("/websites")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/websites" }],
  }),
  component: WebsitesPage,
});

const categories = [
  { icon: Rocket, title: "Landing pages" },
  { icon: Building2, title: "Small business websites" },
  { icon: User, title: "Personal portfolio websites" },
  { icon: Briefcase, title: "Service websites" },
  { icon: RefreshCw, title: "Website redesign" },
  { icon: LayoutDashboard, title: "Client portal concepts" },
];

const process = [
  "Discovery",
  "Structure and content",
  "Visual design",
  "Development",
  "Review and launch",
];

function WebsitesPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Websites and digital solutions"
        title="Websites designed around your purpose, not just your presence online."
        description="Vortex Hub builds simple, effective digital experiences for individuals, entrepreneurs and businesses that need to explain their offer clearly and convert interest into action."
      />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div key={category.title} className="rounded-xl border border-border bg-card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal/15 text-teal">
                <category.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg">{category.title}</h2>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-card">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading title="A clear path to launch." />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {process.map((step, index) => (
              <li key={step} className="rounded-xl border border-border bg-background p-6">
                <span className="font-serif text-3xl text-primary">{index + 1}</span>
                <h3 className="mt-2 text-base leading-snug">{step}</h3>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <CtaBand
        title="Planning a new website or redesign?"
        primaryLabel="Plan a website project"
        primaryTo="/contact"
        secondaryLabel="Book a consultation"
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

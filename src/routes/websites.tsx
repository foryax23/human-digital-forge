import { createFileRoute } from "@tanstack/react-router";
import { Rocket, Building2, User, Briefcase, RefreshCw, LayoutDashboard } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { PageHero } from "@/components/shared/PageHero";
import { CtaBand } from "@/components/shared/CtaBand";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { useI18n } from "@/i18n";

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

function WebsitesPage() {
  const { t } = useI18n();

  const categories = [
    { icon: Rocket, title: t("Landing pages", "Pagini de destinație") },
    { icon: Building2, title: t("Small business websites", "Site-uri web pentru afaceri mici") },
    { icon: User, title: t("Personal portfolio websites", "Site-uri web de portofoliu personal") },
    { icon: Briefcase, title: t("Service websites", "Site-uri web de servicii") },
    { icon: RefreshCw, title: t("Website redesign", "Redesign de site-uri web") },
    { icon: LayoutDashboard, title: t("Client portal concepts", "Concepte de portal pentru clienți") },
  ];

  const process = [
    t("Discovery", "Descoperire"),
    t("Structure and content", "Structură și conținut"),
    t("Visual design", "Design vizual"),
    t("Development", "Dezvoltare"),
    t("Review and launch", "Revizuire și lansare"),
  ];

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("Websites and digital solutions", "Site-uri web și soluții digitale")}
        title={t(
          "Websites designed around your purpose, not just your presence online.",
          "Site-uri web proiectate în jurul scopului tău, nu doar al prezenței tale online."
        )}
        description={t(
          "Vortex Hub builds simple, effective digital experiences for individuals, entrepreneurs and businesses that need to explain their offer clearly and convert interest into action.",
          "Vortex Hub construiește experiențe digitale simple și eficiente pentru persoane, antreprenori și afaceri care trebuie să-și explice oferta clar și să transforme interesul în acțiune."
        )}
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
          <SectionHeading title={t("A clear path to launch.", "Un drum clar spre lansare.")} />
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
        title={t("Planning a new website or redesign?", "Planifici un site nou sau un redesign?")}
        primaryLabel={t("Plan a website project", "Planifică un proiect de site web")}
        primaryTo="/contact"
        secondaryLabel={t("Book a consultation", "Programează o consultanță")}
        secondaryTo="/consultancy"
      />
    </SiteLayout>
  );
}

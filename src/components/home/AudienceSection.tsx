import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { GlowCard } from "@/components/cinematic/GlowCard";
import { Reveal } from "@/components/cinematic/Reveal";
import { useI18n } from "@/i18n";
import individualsImg from "@/assets/home/audience-individuals.jpg";
import businessImg from "@/assets/home/audience-business.jpg";

function AudienceColumn({
  title,
  image,
  items,
  buttonLabel,
}: {
  title: string;
  image: string;
  items: string[];
  buttonLabel: string;
}) {
  return (
    <GlowCard className="h-full">
      <div className="relative h-40 overflow-hidden">
        <img
          src={image}
          alt={title}
          loading="lazy"
          width={1024}
          height={1024}
          className="h-full w-full object-cover opacity-75 transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
        <h3 className="absolute bottom-4 left-8 text-2xl">{title}</h3>
      </div>
      <div className="p-8 pt-6">
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal/20 text-teal">
                <Check className="h-3 w-3" />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <Button asChild variant="outline" className="mt-8 border-border glass-panel">
          <Link to="/services">{buttonLabel}</Link>
        </Button>
      </div>
    </GlowCard>
  );
}

export function AudienceSection() {
  const { t } = useI18n();

  const individuals = [
    t("Professional documents and presentations.", "Documente și prezentări profesionale."),
    t("Personal portfolio websites.", "Site-uri personale de portofoliu."),
    t("Posters and visual projects.", "Postere și proiecte vizuale."),
    t("One-to-one AI guidance.", "Îndrumare AI personalizată."),
  ];

  const businesses = [
    t("Business websites and landing pages.", "Site-uri de business și pagini de prezentare."),
    t("Marketing and design materials.", "Materiale de marketing și design."),
    t("AI workflow planning.", "Planificarea fluxurilor AI."),
    t("Digital process consultancy.", "Consultanță pentru procese digitale."),
  ];

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-aurora opacity-30" />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow={t("Who it's for", "Pentru cine")}
            title={t("Built for individuals and growing businesses.", "Creat pentru persoane și afaceri în creștere.")}
          />
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <Reveal>
            <AudienceColumn
              title={t("For Individuals", "Pentru persoane")}
              image={individualsImg}
              items={individuals}
              buttonLabel={t("View individual services", "Vezi serviciile pentru persoane")}
            />
          </Reveal>
          <Reveal delay={0.12}>
            <AudienceColumn
              title={t("For Businesses", "Pentru companii")}
              image={businessImg}
              items={businesses}
              buttonLabel={t("View business services", "Vezi serviciile pentru companii")}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

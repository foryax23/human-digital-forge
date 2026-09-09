import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/cinematic/Reveal";
import { useI18n } from "@/i18n";
import individualsImg from "@/assets/home/audience-individuals.jpg";
import businessImg from "@/assets/home/audience-business.jpg";

function AudiencePanel({
  title,
  image,
  items,
  buttonLabel,
  flip,
}: {
  title: string;
  image: string;
  items: string[];
  buttonLabel: string;
  flip?: boolean;
}) {
  return (
    <div className="group grid overflow-hidden rounded-[1.75rem] bento-panel sm:grid-cols-[0.85fr_1fr]">
      <div className={`relative min-h-[13rem] ${flip ? "sm:order-last" : ""}`}>
        <img
          src={image}
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-[1200ms] group-hover:scale-105"
        />
        <div
          aria-hidden
          className={`absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent ${
            flip ? "sm:bg-gradient-to-l" : "sm:bg-gradient-to-r"
          }`}
        />
      </div>
      <div className="p-8 sm:p-9">
        <h3 className="text-2xl">{title}</h3>
        <ul className="mt-6 space-y-3.5">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal/20 text-teal">
                <Check className="h-3 w-3" />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <Button asChild variant="ghost" className="mt-8 -ml-3 text-teal hover:bg-accent">
          <Link to="/services">
            {buttonLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
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
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-aurora opacity-25" />
      <div className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow={t("Who it's for", "Pentru cine")}
            title={t(
              "Built for individuals and growing businesses.",
              "Creat pentru persoane și afaceri în creștere.",
            )}
          />
        </Reveal>
        <div className="mt-16 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <AudiencePanel
              title={t("For individuals", "Pentru persoane")}
              image={individualsImg}
              items={individuals}
              buttonLabel={t("View individual services", "Vezi serviciile pentru persoane")}
            />
          </Reveal>
          <Reveal delay={0.12}>
            <AudiencePanel
              flip
              title={t("For businesses", "Pentru companii")}
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

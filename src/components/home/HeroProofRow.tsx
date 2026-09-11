import { Clock, FileText, Headphones, Users, Zap } from "lucide-react";

import { Reveal } from "@/components/cinematic/Reveal";
import { useI18n } from "@/i18n";

/** The five proof points sitting across the bottom of the hero. */
export function HeroProofRow() {
  const { t } = useI18n();

  const points = [
    {
      Icon: Clock,
      title: t("Clear timelines", "Termene clare"),
      sub: t("No surprises", "Fără surprize"),
    },
    {
      Icon: FileText,
      title: t("Transparent pricing", "Prețuri transparente"),
      sub: t("Fair quotes", "Oferte corecte"),
    },
    {
      Icon: Headphones,
      title: t("Bilingual support", "Suport bilingv"),
      sub: t("RO / EN", "RO / EN"),
    },
    {
      Icon: Users,
      title: t("Private client area", "Zonă privată de client"),
      sub: t("Everything in one place", "Totul într-un singur loc"),
    },
    {
      Icon: Zap,
      title: t("AI automation included", "Automatizare AI inclusă"),
      sub: t("Practical, not promises", "Soluții practice, nu promisiuni"),
    },
  ];

  return (
    <Reveal className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
      <ul className="grid grid-cols-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {points.map(({ Icon, title, sub }, i) => (
          <li
            key={title}
            className={`flex items-center gap-3 px-1 lg:px-5 ${
              i > 0 ? "lg:border-l lg:border-border" : ""
            }`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border glass-panel">
              <Icon className="h-4 w-4 text-foreground/80" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-snug">{title}</span>
              <span className="block text-xs text-muted-foreground">{sub}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-12 flex items-center gap-6">
        <span aria-hidden className="h-px flex-1 bg-border" />
        <p className="text-center text-[0.62rem] uppercase tracking-[0.34em] text-muted-foreground">
          {t(
            "Technology with meaning. For people with vision.",
            "Tehnologie cu sens. Pentru oameni cu viziune.",
          )}
        </p>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
    </Reveal>
  );
}

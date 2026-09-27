import { Clock, FileText, Headphones, Zap } from "lucide-react";

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
      Icon: Zap,
      title: t("AI automation included", "Automatizare AI inclusă"),
      sub: t("Practical, not promises", "Soluții practice, nu promisiuni"),
    },
  ];

  return (
    <Reveal className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
      <ul className="grid grid-cols-2 border-y border-border/70 py-6 lg:grid-cols-4">
        {points.map(({ Icon, title, sub }, i) => (
          <li
            key={title}
            className={`flex items-center gap-3 px-3 py-3 sm:px-5 ${
              i % 2 ? "border-l border-border/70" : ""
            } ${
              i > 0 ? "lg:border-l lg:border-border/70" : ""
            }`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-secondary/60">
              <Icon className="h-4 w-4 text-teal" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-snug">{title}</span>
              <span className="block text-xs text-muted-foreground">{sub}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex items-center gap-6">
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

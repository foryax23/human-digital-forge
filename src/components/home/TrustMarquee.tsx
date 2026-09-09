import { useI18n } from "@/i18n";

/**
 * Slim continuously scrolling band of proof points, sitting directly under the
 * hero so the hero itself stays clean.
 */
export function TrustMarquee() {
  const { t } = useI18n();

  const points = [
    t("Design-led delivery", "Livrare orientată pe design"),
    t("Private client area", "Zonă privată de client"),
    t("Clear timelines", "Termene clare"),
    t("Bilingual support", "Suport bilingv"),
    t("AI automation built in", "Automatizare AI inclusă"),
    t("Fixed, transparent pricing", "Prețuri fixe și transparente"),
  ];

  const track = [...points, ...points];

  return (
    <div className="relative overflow-hidden border-y border-border py-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent"
      />
      <ul className="flex w-max animate-marquee items-center gap-14">
        {track.map((point, i) => (
          <li
            key={`${point}-${i}`}
            className="flex shrink-0 items-center gap-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
            aria-hidden={i >= points.length}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

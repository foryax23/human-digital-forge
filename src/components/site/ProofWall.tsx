import { Quote } from "lucide-react";

import { Reveal } from "@/components/cinematic/Reveal";
import { useI18n } from "@/i18n";

/**
 * Reserved space for client results. Every card is explicitly labelled as a
 * placeholder — no invented outcomes or testimonials.
 */
export function ProofWall() {
  const { t } = useI18n();

  const slots = [
    t("Website and lead system", "Site și sistem de lead-uri"),
    t("Operations automation", "Automatizarea operațiunilor"),
    t("AI-assisted support", "Suport asistat de AI"),
    t("Internal platform", "Platformă internă"),
    t("Reporting and measurement", "Raportare și măsurare"),
    t("Ongoing operation", "Operare continuă"),
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {slots.map((slot, i) => (
        <Reveal key={slot} delay={i * 0.06}>
          <div className="flex h-full flex-col rounded-2xl border border-dashed border-border glass-panel p-6">
            <Quote className="h-5 w-5 text-teal" />
            <p className="mt-4 text-base font-semibold">{slot}</p>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              {t(
                "Reserved for a real client result. We publish outcomes only with written permission, with the numbers we can prove.",
                "Rezervat pentru un rezultat real de client. Publicăm rezultate doar cu acord scris și cu cifre pe care le putem dovedi.",
              )}
            </p>
            <span className="mt-5 inline-flex w-fit rounded-full border border-border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("Placeholder", "Spațiu rezervat")}
            </span>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

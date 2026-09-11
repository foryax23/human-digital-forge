import { Check, X } from "lucide-react";

import { Reveal } from "@/components/cinematic/Reveal";
import { useI18n } from "@/i18n";

/**
 * Contrast block: what running a business without infrastructure feels like,
 * next to what it looks like once the systems are in place.
 */
export function BeforeAfter() {
  const { t } = useI18n();

  const before = [
    t("Work lives in inboxes and spreadsheets.", "Munca trăiește în inbox-uri și tabele."),
    t("Every report is rebuilt by hand.", "Fiecare raport se reface manual."),
    t("New tools get bought, never connected.", "Se cumpără tool-uri noi, niciodată conectate."),
    t("Nothing moves unless you push it.", "Nimic nu se mișcă dacă nu împingi tu."),
  ];

  const after = [
    t("One connected system your team trusts.", "Un sistem conectat în care echipa are încredere."),
    t("Reports and follow-ups run themselves.", "Rapoartele și follow-up-urile merg singure."),
    t("AI does the repetitive work, supervised.", "AI face munca repetitivă, supravegheat."),
    t("The business runs while you think ahead.", "Afacerea merge în timp ce tu gândești înainte."),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Reveal>
        <div className="h-full rounded-sm border border-border glass-panel p-8">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t("Without infrastructure", "Fără infrastructură")}
          </span>
          <h3 className="mt-4 text-2xl font-semibold">
            {t("Everything depends on someone remembering.", "Totul depinde de cineva care ține minte.")}
          </h3>
          <ul className="mt-7 grid gap-4">
            {before.map((item) => (
              <li key={item} className="flex gap-3 text-base text-muted-foreground">
                <X className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="h-full rounded-sm bento-panel p-8 glow-soft">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-teal">
            {t("With Vortex Hub", "Cu Vortex Hub")}
          </span>
          <h3 className="mt-4 text-2xl font-semibold">
            {t("The system remembers, so you don't have to.", "Sistemul ține minte, ca tu să nu mai fii nevoit.")}
          </h3>
          <ul className="mt-7 grid gap-4">
            {after.map((item) => (
              <li key={item} className="flex gap-3 text-base">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </div>
  );
}

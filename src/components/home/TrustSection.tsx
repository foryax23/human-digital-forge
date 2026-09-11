import { SectionHeading } from "@/components/shared/SectionHeading";

import { Reveal } from "@/components/cinematic/Reveal";
import { ProposalIcon, PrivacyIcon, DeliveryIcon, ReviewIcon } from "@/components/cinematic/TrustIcons";
import { ParticlesBackground } from "@/components/backgrounds/ParticlesBackground";
import { useI18n } from "@/i18n";

export function TrustSection() {
  const { t } = useI18n();

  const points = [
    { icon: ProposalIcon, label: t("Clear proposals before work begins.", "Propuneri clare înainte de începerea lucrului.") },
    { icon: PrivacyIcon, label: t("Private project communication.", "Comunicare privată pe proiect.") },
    { icon: DeliveryIcon, label: t("Secure file delivery.", "Livrare sigură a fișierelor.") },
    { icon: ReviewIcon, label: t("Human review throughout the process.", "Verificare umană pe tot parcursul procesului.") },
  ];


  return (
    <section className="relative isolate mx-auto max-w-7xl overflow-hidden px-4 py-28 sm:px-6 lg:px-8">
      <ParticlesBackground className="-z-10" count={55} />
      <Reveal>
        <SectionHeading
          align="center"
          eyebrow={t("Why Vortex Hub", "De ce Vortex Hub")}
          title={t("Designed for a straightforward and secure client experience.", "Conceput pentru o experiență de client simplă și sigură.")}
        />
      </Reveal>
      <div className="mt-20 grid gap-14 sm:grid-cols-2 lg:grid-cols-4">
        {points.map((point, i) => (
          <Reveal key={point.label} delay={i * 0.1}>
            <div className="flex flex-col items-center px-2 text-center">
              <point.icon className="h-24 w-24 text-teal" />
              <p className="mt-7 max-w-[15rem] text-sm font-medium leading-relaxed">{point.label}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className="mx-auto mt-20 max-w-2xl rounded-[1.75rem] bento-panel p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("Client feedback", "Feedback de la clienți")}
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {t(
              "A reserved space for approved client feedback. Real testimonials will appear here once client work is shared with permission.",
              "Un spațiu rezervat pentru feedback aprobat al clienților. Testimoniale reale vor apărea aici după ce lucrările sunt partajate cu acordul clienților.",
            )}
          </p>
        </div>
      </Reveal>

    </section>
  );
}

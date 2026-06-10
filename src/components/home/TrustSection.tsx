import { SectionHeading } from "@/components/shared/SectionHeading";

import { Reveal } from "@/components/cinematic/Reveal";
import { ProposalIcon, PrivacyIcon, DeliveryIcon, ReviewIcon } from "@/components/cinematic/TrustIcons";
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
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <Reveal>
        <SectionHeading
          align="center"
          eyebrow={t("Why Vortex Hub", "De ce Vortex Hub")}
          title={t("Designed for a straightforward and secure client experience.", "Conceput pentru o experiență de client simplă și sigură.")}
        />
      </Reveal>
      <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {points.map((point, i) => (
          <Reveal key={point.label} delay={i * 0.1}>
            <div className="flex flex-col items-center px-4 text-center">
              <point.icon className="h-20 w-20 text-teal" />
              <p className="mt-5 text-sm font-medium">{point.label}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className="mt-10 rounded-2xl border border-dashed border-border glass-panel p-8 text-center">
          <p className="text-sm font-medium text-foreground">{t("Client feedback", "Feedback de la clienți")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
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

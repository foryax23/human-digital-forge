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
    <section className="relative isolate mx-auto max-w-7xl overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
      <ParticlesBackground className="-z-10" count={55} />
      <Reveal>
        <SectionHeading
          align="center"
          eyebrow={t("Why Vortex Hub", "De ce Vortex Hub")}
          title={t("Designed for a straightforward and secure client experience.", "Conceput pentru o experiență de client simplă și sigură.")}
        />
      </Reveal>
      <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
        {points.map((point, i) => (
          <Reveal key={point.label} delay={i * 0.1}>
            <div className="flex flex-col items-center px-2 text-center">
               <point.icon className="h-20 w-20 text-teal" />
               <p className="mt-5 max-w-[15rem] text-sm font-medium leading-relaxed">{point.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

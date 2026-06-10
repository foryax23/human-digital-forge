import { Link } from "@tanstack/react-router";
import { Inbox, FileStack, CalendarClock, Boxes } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/cinematic/Reveal";
import { Magnetic } from "@/components/cinematic/Magnetic";
import { useI18n } from "@/i18n";
import aiImg from "@/assets/home/ai-spotlight.jpg";

export function AISpotlight() {
  const reduce = useReducedMotion();
  const { t } = useI18n();

  const useCases = [
    { icon: Inbox, label: t("Enquiry and lead organisation.", "Organizarea cererilor și a lead-urilor.") },
    { icon: FileStack, label: t("Document workflow support.", "Sprijin pentru fluxul de documente.") },
    { icon: CalendarClock, label: t("Appointment and follow-up processes.", "Procese de programare și urmărire.") },
    { icon: Boxes, label: t("Internal productivity systems.", "Sisteme interne de productivitate.") },
  ];

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-aurora opacity-50" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/40 to-ink/70"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <Eyebrow className="text-teal">{t("AI automation", "Automatizare AI")}</Eyebrow>
              <h2 className="mt-4 text-3xl leading-tight sm:text-4xl lg:text-5xl">
                {t(
                  "Technology should remove unnecessary work, not remove the human relationship.",
                  "Tehnologia ar trebui să elimine munca inutilă, nu relația umană.",
                )}
              </h2>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground">
                {t(
                  "We help individuals and businesses explore useful AI workflows, from organising enquiries and documents to improving repetitive internal processes. Every solution begins with a real need, not with technology for its own sake.",
                  "Ajutăm persoane și companii să exploreze fluxuri AI utile, de la organizarea cererilor și documentelor până la îmbunătățirea proceselor interne repetitive. Fiecare soluție pornește de la o nevoie reală, nu de la tehnologie de dragul tehnologiei.",
                )}
              </p>
              <Magnetic>
                <Button asChild className="mt-9 glow-soft">
                  <Link to="/ai-automation">{t("Discuss an automation idea", "Discută o idee de automatizare")}</Link>
                </Button>
              </Magnetic>
            </div>
          </Reveal>

          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2rem] bg-gradient-brand opacity-20 blur-3xl animate-glow-pulse"
            />
            <div className="relative overflow-hidden rounded-2xl border border-border glass-panel glow-soft">
              <img
                src={aiImg}
                alt="Abstract visualisation of an automated workflow"
                loading="lazy"
                width={1024}
                height={1024}
                className="absolute inset-0 h-full w-full object-cover opacity-30"
              />
              {/* Animated beam connecting the use-case cards */}
              <motion.div
                aria-hidden
                className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-teal to-transparent"
                initial={reduce ? false : { scaleY: 0, opacity: 0 }}
                whileInView={reduce ? undefined : { scaleY: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              />
              <div className="relative grid gap-px p-px sm:grid-cols-2">
                {useCases.map((useCase, i) => (
                  <Reveal key={useCase.label} delay={i * 0.1}>
                    <div className="h-full bg-card/40 p-6 backdrop-blur-sm">
                      <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal/20 text-teal glow-teal">
                        <useCase.icon className="h-5 w-5" />
                      </span>
                      <p className="mt-4 text-sm font-medium text-foreground">{useCase.label}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

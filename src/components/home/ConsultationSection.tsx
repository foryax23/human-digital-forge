import { Link } from "@tanstack/react-router";
import { Lightbulb, LayoutTemplate, Workflow, Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { GlowCard } from "@/components/cinematic/GlowCard";
import { Reveal } from "@/components/cinematic/Reveal";
import { Magnetic } from "@/components/cinematic/Magnetic";
import { useI18n } from "@/i18n";
import consultationImg from "@/assets/home/consultation.jpg";

export function ConsultationSection() {
  const { t } = useI18n();

  const sessions = [
    {
      icon: Lightbulb,
      title: t("Digital Idea Session", "Sesiune de idei digitale"),
      description: t("For individuals or early project ideas.", "Pentru persoane sau idei de proiecte la început de drum."),
    },
    {
      icon: LayoutTemplate,
      title: t("Website Planning Session", "Sesiune de planificare site web"),
      description: t("For clients preparing a new website or redesign.", "Pentru clienții care pregătesc un site nou sau o reproiectare."),
    },
    {
      icon: Workflow,
      title: t("AI Workflow Review", "Analiză flux de lucru AI"),
      description: t("For businesses exploring practical automation.", "Pentru companiile care explorează automatizarea practică."),
    },
  ];

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-aurora opacity-25" />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <SectionHeading
                eyebrow={t("Talk it through", "Hai să discutăm")}
                title={t("Not sure what you need yet?", "Încă nu ești sigur de ce ai nevoie?")}
                description={t(
                  "Book a one-to-one conversation to discuss your idea, website, digital product or possible AI workflow. You will receive clear advice on the next practical step.",
                  "Programează o discuție individuală despre ideea, site-ul, produsul digital sau posibilul flux AI. Vei primi sfaturi clare despre următorul pas practic.",
                )}
              />
              <div className="mt-8 flex flex-wrap gap-4">
                <Magnetic>
                  <Button asChild className="glow-soft">
                    <Link to="/consultancy">{t("Book a consultation", "Programează o consultanță")}</Link>
                  </Button>
                </Magnetic>
                <Magnetic>
                  <Button asChild variant="outline" className="border-border glass-panel">
                    <Link to="/contact">{t("Send an enquiry", "Trimite o cerere")}</Link>
                  </Button>
                </Magnetic>
              </div>

              <div className="mt-8 overflow-hidden rounded-2xl border border-border glass-panel">
                <div className="relative h-40">
                  <img
                    src={consultationImg}
                    alt="A one-to-one consultation conversation"
                    loading="lazy"
                    width={1024}
                    height={1024}
                    className="h-full w-full object-cover opacity-70"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    {t("Booking calendar", "Calendar de programări")}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Live scheduling will appear here once the design is approved.", "Programarea în timp real va apărea aici după aprobarea designului.")}
                  </p>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {[t("Mon", "Lun"), t("Tue", "Mar"), t("Wed", "Mie"), t("Thu", "Joi")].map((day, i) => (
                      <div
                        key={day}
                        className={`rounded-lg border border-border px-2 py-3 text-center text-xs ${
                          i === 1 ? "bg-primary/15 text-primary" : "text-muted-foreground"
                        }`}
                      >
                        <div className="font-medium">{day}</div>
                        <div className="mt-1">10:30</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="grid content-start gap-4">
            {sessions.map((session, i) => (
              <Reveal key={session.title} delay={i * 0.1}>
                <GlowCard>
                  <div className="flex items-start gap-4 p-6">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                      <session.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg">{session.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{session.description}</p>
                    </div>
                  </div>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

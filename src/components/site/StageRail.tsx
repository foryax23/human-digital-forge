import { motion, useReducedMotion } from "motion/react";
import { Search, PenTool, Hammer, Workflow, LifeBuoy } from "lucide-react";

import { Reveal } from "@/components/cinematic/Reveal";
import { useI18n } from "@/i18n";

/**
 * The five-stage way we take a business from scattered tools to running
 * infrastructure. Rendered as a lit vertical rail on mobile, a stepped row on
 * large screens.
 */
export function StageRail() {
  const { t } = useI18n();
  const reduce = useReducedMotion();

  const stages = [
    {
      icon: Search,
      name: t("Audit", "Audit"),
      body: t(
        "We map how work actually flows today — tools, handoffs, and every hour lost between them.",
        "Cartografiem cum circulă munca astăzi — tool-uri, predări și fiecare oră pierdută între ele.",
      ),
    },
    {
      icon: PenTool,
      name: t("Blueprint", "Blueprint"),
      body: t(
        "You get a written plan: what gets built, in what order, what it costs, what it returns.",
        "Primești un plan scris: ce se construiește, în ce ordine, cât costă, ce aduce.",
      ),
    },
    {
      icon: Hammer,
      name: t("Build", "Construcție"),
      body: t(
        "Website, platform, internal tools — built on current technology, owned by you.",
        "Site, platformă, unelte interne — construite pe tehnologie actuală, deținute de tine.",
      ),
    },
    {
      icon: Workflow,
      name: t("Automate", "Automatizare"),
      body: t(
        "We connect the systems and put supervised AI on the repetitive work.",
        "Conectăm sistemele și punem AI supravegheat pe munca repetitivă.",
      ),
    },
    {
      icon: LifeBuoy,
      name: t("Operate", "Operare"),
      body: t(
        "We keep it running, measured and improving — you stay focused on the business.",
        "Îl menținem funcțional, măsurat și în îmbunătățire — tu rămâi pe afacere.",
      ),
    },
  ];

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute left-[1.4rem] top-3 bottom-3 w-px bg-border lg:hidden"
      />
      <div className="grid gap-10 lg:grid-cols-5 lg:gap-6">
        {stages.map((stage, i) => (
          <Reveal key={stage.name} delay={i * 0.08}>
            <div className="relative flex gap-6 lg:flex-col lg:gap-5">
              <div className="relative shrink-0">
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-sm bg-primary blur-lg"
                  animate={reduce ? undefined : { opacity: [0.25, 0.6, 0.25] }}
                  transition={{ duration: 4.5, repeat: Infinity, delay: i * 0.5 }}
                />
                <span className="relative grid h-11 w-11 place-items-center rounded-sm bg-primary text-primary-foreground">
                  <stage.icon className="h-5 w-5" />
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-xl font-semibold">{stage.name}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{stage.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

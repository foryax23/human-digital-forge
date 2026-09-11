import { Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, Clock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/cinematic/Reveal";
import { Magnetic } from "@/components/cinematic/Magnetic";
import { useI18n } from "@/i18n";

/** Lead magnet block that sends visitors into the seven-question audit. */
export function AuditTeaser() {
  const { t } = useI18n();

  const points = [
    {
      icon: Clock,
      label: t("Seven questions, about two minutes.", "Șapte întrebări, aproximativ două minute."),
    },
    {
      icon: ClipboardList,
      label: t("A risk score and your first three moves.", "Un scor de risc și primele trei mișcări."),
    },
    {
      icon: ShieldCheck,
      label: t("No sales script, no spam.", "Fără script de vânzare, fără spam."),
    },
  ];

  return (
    <Reveal>
      <div className="relative overflow-hidden rounded-[2rem] bento-panel p-10 sm:p-14">
        <div aria-hidden className="flow-orb flow-orb-teal -right-16 -top-20 h-72 w-72" />
        <div className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal">
              {t("Free infrastructure audit", "Audit gratuit de infrastructură")}
            </p>
            <h2 className="mt-5 max-w-xl text-3xl font-bold leading-tight sm:text-4xl">
              {t(
                "Find out where your business leaks time — before you spend a euro.",
                "Află unde pierde timp afacerea ta — înainte să dai un euro.",
              )}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              {t(
                "Answer seven questions about how your business actually runs. You get an honest read on your infrastructure and a prioritised plan on screen, straight away.",
                "Răspunde la șapte întrebări despre cum funcționează afacerea ta. Primești o evaluare sinceră a infrastructurii și un plan prioritizat pe ecran, imediat.",
              )}
            </p>
            <Magnetic>
              <Button
                asChild
                size="lg"
                className="mt-9 bg-primary text-primary-foreground glow-soft hover:opacity-90"
              >
                <Link to="/audit">
                  {t("Start the free audit", "Începe auditul gratuit")}
                  <ArrowRight />
                </Link>
              </Button>
            </Magnetic>
          </div>

          <ul className="grid gap-4">
            {points.map((point) => (
              <li
                key={point.label}
                className="flex items-center gap-4 rounded-sm border border-border glass-panel px-5 py-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <point.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{point.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Reveal>
  );
}

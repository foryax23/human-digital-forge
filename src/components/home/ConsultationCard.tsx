import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, CheckCircle2, Clock } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/cinematic/Magnetic";
import { useI18n } from "@/i18n";

type Slot = { date: Date; slots: number };

const TIMES = ["10:00", "13:30", "16:00"];

/** Next three weekdays from today. Deterministic slot counts per weekday. */
function useNextWeekdays(): Slot[] {
  return useMemo(() => {
    const out: Slot[] = [];
    const d = new Date();
    while (out.length < 3) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day === 0 || day === 6) continue;
      // Deterministic 2-6 slots based on day-of-year
      const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
      out.push({ date: new Date(d), slots: 2 + (doy % 5) });
    }
    return out;
  }, []);
}

export function ConsultationCard() {
  const { t, lang } = useI18n();
  const days = useNextWeekdays();
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState(1);

  const locale = lang === "ro" ? "ro-RO" : "en-GB";
  const chosen = days[selectedDay];
  const iso = chosen.date.toISOString().slice(0, 10);
  const time = TIMES[selectedTime];

  const bullets = [
    t("Your goals & current stack", "Obiectivele și stack-ul tău actual"),
    t("A concrete roadmap & estimate", "O foaie de parcurs concretă și estimare"),
    t("Next steps — zero pressure", "Următorii pași — fără presiune"),
  ];

  return (
    <div className="relative rounded-3xl bg-gradient-brand p-[1.5px] glow-strong">
      {/* FREE ribbon */}
      <div
        aria-hidden
        className="absolute -top-3 -right-3 z-10 rotate-6 rounded-full bg-gradient-brand px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-primary-foreground shadow-[0_8px_24px_-6px_oklch(0.66_0.22_305/0.65)]"
      >
        {t("Free", "Gratuit")}
      </div>
      <div className="relative flex h-full w-full flex-col gap-5 overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-[oklch(0.12_0.06_300/0.9)] p-6 backdrop-blur-xl sm:p-7">
      {/* Ambient purple glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/40 blur-3xl"
      />

      {/* Status pill */}
      <div className="relative flex items-center gap-2 self-start rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="font-medium">{t("Available now", "Disponibil acum")}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          {t("30-min free discovery call", "Apel gratuit 30 min")}
        </span>
      </div>

      {/* Headline */}
      <div className="relative">
        <h3 className="text-2xl leading-tight sm:text-3xl">
          <span className="text-gradient-brand">
            {t("Talk to a strategist", "Discută cu un strateg")}
          </span>
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Free 30-min call — no obligation, no sales pitch.",
            "Apel gratuit 30 min — fără obligații, fără vânzări.",
          )}
        </p>
      </div>

      {/* Day picker */}
      <div className="relative">
        <div className="mb-2 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <CalendarCheck className="h-3.5 w-3.5" />
          {t("Pick a day", "Alege o zi")}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {days.map((d, i) => {
            const active = i === selectedDay;
            const weekday = d.date.toLocaleDateString(locale, { weekday: "short" });
            const dayNum = d.date.getDate();
            const month = d.date.toLocaleDateString(locale, { month: "short" });
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedDay(i)}
                className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
                  active
                    ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_var(--primary)/20]"
                    : "border-border bg-background/40 hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <div className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                  {weekday}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-xl font-semibold leading-none">{dayNum}</span>
                  <span className="text-xs text-muted-foreground">{month}</span>
                </div>
                <div className="mt-2 text-[0.65rem] text-muted-foreground">
                  {d.slots} {t("slots", "sloturi")}
                </div>
                {active && (
                  <motion.div
                    layoutId="day-glow"
                    className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-primary/50"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time picker */}
      <div className="relative">
        <div className="mb-2 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {t("Preferred time", "Ora preferată")}
        </div>
        <div className="flex flex-wrap gap-2">
          {TIMES.map((tm, i) => {
            const active = i === selectedTime;
            return (
              <button
                key={tm}
                type="button"
                onClick={() => setSelectedTime(i)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                  active
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {tm}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bullets */}
      <ul className="relative space-y-1.5 text-sm">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">{b}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="relative mt-auto space-y-3">
        <Magnetic>
          <Button
            asChild
            size="lg"
            className="h-12 w-full bg-gradient-brand text-base text-primary-foreground shadow-[0_10px_30px_-8px_oklch(0.66_0.22_305/0.7)] hover:opacity-90"
          >
            <Link to="/consultancy" hash={`slot=${iso}T${time}`}>
              {t("Book my slot", "Rezervă slotul meu")}
              <ArrowRight />
            </Link>
          </Button>
        </Magnetic>
        <p className="text-center text-xs text-muted-foreground">
          {t("Trusted by 40+ founders across the EU", "Ales de peste 40 de fondatori din UE")}
        </p>
      </div>
      </div>
    </div>
  );
}

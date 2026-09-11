import { useRef, useState } from "react";
import { motion, useReducedMotion, useSpring } from "motion/react";
import { Bot, BarChart3, Check, Globe, Zap, BrainCircuit, CheckCircle2 } from "lucide-react";

import { useI18n } from "@/i18n";
import heroShot from "@/assets/home/hero-bg.jpg";
import logoAsset from "@/assets/brand/vortex-logo.png.asset.json";

/**
 * The floating product scene beside the hero copy: a tilted browser window with
 * three glass cards drifting in front of it. Built in markup so it stays crisp.
 */
export function HeroShowcase() {
  const reduce = useReducedMotion();
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  const px = useSpring(0, { stiffness: 90, damping: 20, mass: 0.4 });
  const py = useSpring(0, { stiffness: 90, damping: 20, mass: 0.4 });

  function onMove(e: React.MouseEvent) {
    if (reduce) return;
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    px.set(((e.clientX - box.left) / box.width - 0.5) * 26);
    py.set(((e.clientY - box.top) / box.height - 0.5) * 18);
  }

  function onLeave() {
    setHovering(false);
    px.set(0);
    py.set(0);
  }

  const float = (delay: number) =>
    reduce ? undefined : { animationDelay: `${delay}s` };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={onLeave}
      className="relative mx-auto w-full max-w-[42rem] select-none"
      aria-hidden
    >
      {/* Halo behind the cluster */}
      <div className="pointer-events-none absolute -inset-x-16 -top-16 bottom-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-brand opacity-25 blur-[130px] animate-glow-pulse" />
        <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border opacity-60" />
      </div>

      <motion.div style={reduce ? undefined : { x: px, y: py }} className="relative">
        {/* Browser window */}
        <div
          className="relative rounded-2xl border border-border bento-panel p-2.5 shadow-2xl"
          style={{
            transform: reduce
              ? undefined
              : `perspective(1400px) rotateY(-9deg) rotateX(4deg) ${hovering ? "scale(1.01)" : ""}`,
          }}
        >
          <div className="mb-2.5 flex items-center gap-4 px-2 pt-1">
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
            </span>
            <img src={logoAsset.url} alt="" className="h-3.5 w-auto opacity-90" />
            <span className="ml-auto hidden gap-5 text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground sm:flex">
              <span>{t("Solutions", "Soluții")}</span>
              <span>{t("About", "Despre noi")}</span>
              <span>{t("Portfolio", "Portofoliu")}</span>
              <span>{t("Contact", "Contact")}</span>
            </span>
            <span className="rounded-md border border-primary/50 px-2.5 py-1 text-[0.6rem] text-foreground/90">
              {t("Let's talk", "Hai să discutăm")}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl bg-ink/60 p-4 sm:grid-cols-[1.05fr_1fr]">
            <div className="flex flex-col justify-center">
              <p className="text-lg font-bold leading-tight sm:text-xl">
                {t("Stronger brands", "Branduri")}
                <br />
                {t("through", "mai puternice prin")}{" "}
                <span className="text-gradient-brand">{t("technology.", "tehnologie.")}</span>
              </p>
              <p className="mt-2 text-[0.7rem] text-muted-foreground">
                {t(
                  "Websites. AI automation. Real results.",
                  "Site-uri web. Automatizări AI. Rezultate reale.",
                )}
              </p>
              <span className="mt-3 w-fit rounded-md bg-gradient-brand px-3 py-1.5 text-[0.68rem] font-semibold text-primary-foreground">
                {t("Learn more", "Află mai multe")}
              </span>
            </div>
            <div className="relative overflow-hidden rounded-lg">
              <img
                src={heroShot}
                alt=""
                className="h-32 w-full object-cover opacity-90 sm:h-40"
                loading="lazy"
              />
              <span className="absolute bottom-2 right-2 text-right text-[0.5rem] uppercase leading-relaxed tracking-[0.22em] text-foreground/70">
                {t("Ideas", "Idei")}
                <br />
                {t("Systems", "Sisteme")}
                <br />
                {t("Results", "Rezultate")}
              </span>
            </div>
          </div>
        </div>

        {/* Card — modern website */}
        <div
          className="absolute -bottom-16 -left-6 w-[15rem] rounded-2xl border border-border bento-panel p-4 animate-float-slow sm:-left-14"
          style={float(0)}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Globe className="h-4 w-4 text-teal" />
            {t("Modern website", "Website modern")}
          </p>
          <ul className="mt-3 space-y-2 text-[0.72rem] text-muted-foreground">
            {[
              t("Custom design", "Design personalizat"),
              t("Optimised for speed", "Optimizat pentru performanță"),
              t("Ready to grow", "Pregătit pentru creștere"),
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-primary/25">
                  <Check className="h-2.5 w-2.5 text-foreground" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Card — AI automation */}
        <div
          className="absolute -bottom-28 left-1/2 w-[15.5rem] -translate-x-1/2 rounded-2xl border border-border bento-panel p-4 glow-soft animate-float-slow"
          style={float(1.2)}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4 text-primary" />
            {t("AI automation", "Automatizare AI")}
          </p>
          <ol className="mt-3 space-y-3">
            {[
              {
                Icon: Zap,
                title: t("Trigger", "Trigger"),
                sub: t("New form submitted", "Formular nou completat"),
              },
              {
                Icon: BrainCircuit,
                title: t("AI processes", "AI Procesează"),
                sub: t("Analyse and classify", "Analiză și clasificare"),
              },
              {
                Icon: CheckCircle2,
                title: t("Action", "Acțiune"),
                sub: t("Auto reply + notification", "Răspuns automat + notificare"),
              },
            ].map(({ Icon, title, sub }, i) => (
              <li key={title} className="relative flex items-center gap-3">
                {i < 2 && (
                  <span className="absolute left-[0.68rem] top-8 h-4 w-px bg-gradient-to-b from-primary to-teal" />
                )}
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-brand">
                  <Icon className="h-3.5 w-3.5 text-primary-foreground" />
                </span>
                <span>
                  <span className="block text-[0.74rem] font-semibold">{title}</span>
                  <span className="block text-[0.64rem] text-muted-foreground">{sub}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Card — real results */}
        <div
          className="absolute -bottom-12 -right-4 w-[14.5rem] rounded-2xl border border-border bento-panel p-4 animate-float-slow sm:-right-12"
          style={float(2.1)}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4 text-teal" />
            {t("Real results", "Rezultate reale")}
          </p>
          <ul className="mt-3 space-y-2 text-[0.72rem] text-muted-foreground">
            {[
              t("More time for what matters", "Mai mult timp pentru ce contează"),
              t("Simpler processes", "Procese mai simple"),
              t("Happier clients", "Clienți mai mulțumiți"),
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </div>
  );
}

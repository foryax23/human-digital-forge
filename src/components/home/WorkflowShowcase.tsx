import { Search, PenTool, Workflow, Target, Share2, Star, Quote, ArrowRight } from "lucide-react";

import { useI18n } from "@/i18n";
import avatar1 from "@/assets/home/avatar-1.jpg";
import avatar2 from "@/assets/home/avatar-2.jpg";
import avatar3 from "@/assets/home/avatar-3.jpg";
import avatar4 from "@/assets/home/avatar-4.jpg";

const avatars = [avatar1, avatar2, avatar3, avatar4];

function TimelineNode({
  index,
  icon: Icon,
  title,
  caption,
  last,
}: {
  index: string;
  icon: typeof Search;
  title: string;
  caption: string;
  last?: boolean;
}) {
  return (
    <div className="relative flex-1">
      <div className="flex items-center">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-brand text-primary-foreground glow-soft">
          <Icon className="h-4 w-4" />
        </span>
        {!last ? (
          <span className="relative ml-1 hidden h-px flex-1 bg-gradient-to-r from-primary/50 to-teal/40 sm:block">
            <ArrowRight className="absolute -right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-teal/70" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm font-semibold">
        <span className="text-muted-foreground">{index}</span> {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{caption}</p>
    </div>
  );
}

export function WorkflowShowcase() {
  const { t } = useI18n();

  return (
    <div className="relative animate-float-slow">
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[2.5rem] bg-gradient-brand opacity-25 blur-3xl animate-glow-pulse"
      />
      <div className="relative rounded-3xl border border-border glass-panel p-6 glow-soft sm:p-7">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("Workflow", "Flux de lucru")}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
            </span>
            {t("Project in progress", "Proiect în desfășurare")}
          </span>
        </div>

        {/* Title block */}
        <h3 className="mt-4 font-sans text-xl font-semibold tracking-tight">
          {t("Strategy, design and automation", "Strategie, design și automatizare")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("A clear process, measurable results.", "Un proces clar, rezultate măsurabile.")}
        </p>

        {/* Timeline */}
        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:gap-3">
          <TimelineNode
            index="01"
            icon={Search}
            title={t("Discovery", "Descoperire")}
            caption={t("We understand your goals and context.", "Înțelegem obiectivele și contextul tău.")}
          />
          <TimelineNode
            index="02"
            icon={PenTool}
            title={t("Design & Build", "Design & Build")}
            caption={t("We design and build scalable solutions.", "Proiectăm și construim soluții scalabile.")}
          />
          <TimelineNode
            index="03"
            icon={Workflow}
            title={t("Automation", "Automatizare")}
            caption={t("We optimize and connect critical processes.", "Optimizăm și conectăm procesele critice.")}
            last
          />
        </div>

        {/* Three sub-cards */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {/* Collaboration */}
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("Live collaboration", "Colaborare live")}
            </span>
            <div className="mt-3 flex items-center">
              <div className="flex -space-x-2">
                {avatars.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    loading="lazy"
                    width={512}
                    height={512}
                    className="h-7 w-7 rounded-full border-2 border-card object-cover"
                  />
                ))}
              </div>
              <span className="ml-2 grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-primary/15 text-[0.65rem] font-semibold text-primary">
                +3
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {t(
                "Dedicated team in real time. Full transparency.",
                "Echipă dedicată în timp real. Transparență totală.",
              )}
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-teal">
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
              {t("Online", "Online")}
            </span>
          </div>

          {/* Impact */}
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("Impact", "Impact")}
            </span>
            <p className="mt-2 text-2xl font-bold text-gradient-brand">+68%</p>
            <svg viewBox="0 0 120 44" className="mt-1 h-12 w-full" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="impactArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.585 0.225 277)" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="oklch(0.585 0.225 277)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="impactLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.585 0.225 277)" />
                  <stop offset="100%" stopColor="oklch(0.74 0.11 200)" />
                </linearGradient>
              </defs>
              <path
                d="M2 40 L20 34 L36 36 L54 24 L72 27 L90 14 L118 6 L118 44 L2 44 Z"
                fill="url(#impactArea)"
              />
              <path
                d="M2 40 L20 34 L36 36 L54 24 L72 27 L90 14 L118 6"
                fill="none"
                stroke="url(#impactLine)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("Operational efficiency for our clients", "Eficiență operațională pentru clienții noștri")}
            </p>
          </div>

          {/* Trust */}
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("Trust", "Încredere")}
            </span>
            <Quote className="mt-2 h-4 w-4 text-primary" />
            <p className="mt-1 text-xs leading-relaxed text-foreground">
              {t(
                "Vortex Hub gave us clarity, speed and results beyond expectations.",
                "Vortex Hub ne-a oferit claritate, viteză și rezultate peste așteptări.",
              )}
            </p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">— Andreea P, CEO</p>
            <div className="mt-2 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-teal text-teal" />
              ))}
            </div>
          </div>
        </div>

        {/* Deliverables */}
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-background/30 p-4">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("Deliverables", "Livrabile")}
          </span>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
                <Target className="h-4 w-4" />
              </span>
              {t("Digital strategy", "Strategie digitală")}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/20 text-teal">
                <PenTool className="h-4 w-4" />
              </span>
              {t("UI/UX design", "Design UI/UX")}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
                <Share2 className="h-4 w-4" />
              </span>
              {t("AI automations", "Automatizări AI")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, type CSSProperties } from "react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  showsLogo,
  TECH_ATTRIBUTION,
  TECH_GROUPS,
  TECH_STACK,
  TECH_TRADEMARK_NOTE,
  techInGroup,
  type Tech,
} from "./tech-stack";
import styles from "./TechStack.module.css";

/*
 * "Tehnologii cu care lucrăm": the tools we build with, in three places on the
 * homepage. TechBand is a slim marquee of their logos under the hero, TechGroups
 * closes the Services section with their names and what each group is for (the
 * logos appear once per page), TechCredits is the trademark note and attribution in
 * the homepage footer. Data and wording rules live in tech-stack.ts.
 */

/**
 * One logo. Wordmarks speak for themselves (alt = the name); a symbol gets its name
 * set beside it, so the image is decorative. In the band's aria-hidden copy every
 * image is decorative. A mark switched to "name" shows only its name, at the same
 * height, so the row keeps its rhythm.
 */
function TechItem({ tech, hidden = false }: { tech: Tech; hidden?: boolean }) {
  const { logo, name } = tech;
  const symbol = logo.kind === "symbol";
  if (!showsLogo(tech)) {
    return (
      <li className={styles.item} style={{ "--logo-h": `${logo.height}px` } as CSSProperties}>
        <span className={styles.name}>{name}</span>
      </li>
    );
  }
  return (
    <li className={styles.item} style={{ "--logo-h": `${logo.height}px` } as CSSProperties}>
      <img
        src={logo.src}
        width={logo.width}
        height={logo.height}
        alt={hidden || symbol ? "" : name}
        decoding="async"
        fetchPriority="low"
        draggable={false}
      />
      {symbol ? <span className={styles.name}>{name}</span> : null}
    </li>
  );
}

/**
 * Band directly under the hero: caption cell, hairline, then the logos gliding left
 * (one loop in 50 s, 40 s on phones). It pauses under the pointer, off-screen and with
 * the page pause switch; reduced motion gets one still, wrapped row. Both lists are
 * server-rendered and CSS picks what shows, so there is no hydration mismatch and no
 * layout shift. No id: it stays out of the nav scroll-spy.
 */
export function TechBand({ className }: { className?: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);

  // Off-screen pause straight on the element: no React state, no re-render.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      el.dataset.onscreen = entry.isIntersecting ? "true" : "false";
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      aria-labelledby="tech-band-title"
      className={cn(styles.band, "bg-background", className)}
    >
      <div className="container-vx">
        <div className="border-y border-line-1 md:grid md:min-h-[72px] md:grid-cols-[auto_minmax(0,1fr)]">
          <h2
            id="tech-band-title"
            className="type-body-sm whitespace-nowrap pt-4 text-fg-3 md:flex md:items-center md:border-r md:border-line-1 md:pr-8 md:pt-0"
          >
            {t("Technologies we work with", "Tehnologii cu care lucrăm")}
          </h2>
          <div className={styles.viewport}>
            <div className={styles.track}>
              <ul role="list" lang="en" className={styles.list}>
                {TECH_STACK.map((tech) => (
                  <TechItem key={tech.id} tech={tech} />
                ))}
              </ul>
              <ul role="list" lang="en" aria-hidden="true" className={styles.list}>
                {TECH_STACK.map((tech) => (
                  <TechItem key={tech.id} tech={tech} hidden />
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Closing block of the Services section: the same tools by group, as names, with one
 * plain sentence per group on what we use them for. Static: no motion, rows on
 * hairlines. Names, not logos: the band under the hero already shows the logos.
 */
export function TechGroups({ className }: { className?: string }) {
  const { t, lang } = useI18n();
  const list = (names: string[]) =>
    new Intl.ListFormat(lang === "ro" ? "ro" : "en", { type: "conjunction" }).format(names);
  return (
    <div className={cn("mt-14 md:mt-16", className)}>
      <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-8">
        <h3 className="type-h3 text-fg">
          {t("What we use, and what for", "Ce folosim și pentru ce")}
        </h3>
        <p className="type-body-sm text-pretty text-fg-3">
          {t(
            "For each project we pick only what it needs.",
            "Pentru fiecare proiect alegem doar ce îi trebuie.",
          )}
        </p>
      </div>
      <ul role="list" className="mt-4 border-t border-rule">
        {/* Each row is its own grid with fixed columns, so they line up across rows. */}
        {TECH_GROUPS.map((group) => (
          <li
            key={group.id}
            className="grid gap-x-8 gap-y-1.5 border-b border-line-1 py-4 md:grid-cols-[184px_minmax(0,1fr)] xl:grid-cols-[208px_minmax(0,1fr)_minmax(0,22rem)] xl:items-baseline"
          >
            <h4 className="type-h4 text-fg">{group.title[lang]}</h4>
            <p className="type-body-sm max-w-[60ch] text-pretty text-fg-2">{group.use[lang]}</p>
            <p lang="en" className="type-body-sm text-fg md:col-start-2 xl:col-start-auto">
              {list(techInGroup(group.id).map((tech) => tech.name))}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Trademark note for the homepage footer, under the legal line: the disclaimer in the
 * active language, then the attribution paragraph in English in both languages, kept
 * visible (Vercel and Cloudflare ask for a visible statement). Only on the page that
 * shows the logos.
 */
export function TechCredits({ className }: { className?: string }) {
  const { lang } = useI18n();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="type-micro max-w-[96ch] text-pretty">{TECH_TRADEMARK_NOTE[lang]}</p>
      <p lang="en" className="type-micro max-w-[124ch] text-pretty text-fg-3">
        {TECH_ATTRIBUTION}
      </p>
    </div>
  );
}

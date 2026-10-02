import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { MotionConfig, motion } from "motion/react";

import { openCookieSettings } from "@/components/cookies/cookie-consent";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { gsap, ScrollTrigger, useGsap } from "./gsap";
import { MotionPauseToggle, useMotionPause } from "./motion-pause";
import { HlsVideo } from "./HlsVideo";
import { CONTACT_EMAIL, SWIRL_VIDEO } from "./media";
import { RingButton } from "./RingButton";
import { Em, Eyebrow } from "./SectionHeader";

// Same links and labels as SiteFooter.
const footerNav = [
  { en: "Services", ro: "Servicii", to: "/services" },
  { en: "Websites", ro: "Site-uri web", to: "/websites" },
  { en: "AI Automation", ro: "Automatizare AI", to: "/ai-automation" },
  { en: "Consultancy", ro: "Consultanță", to: "/consultancy" },
  { en: "Portfolio", ro: "Portofoliu", to: "/portfolio" },
  { en: "Contact", ro: "Contact", to: "/contact" },
  { en: "Login", ro: "Autentificare", to: "/login" },
] as const;

const legalNav = [
  { en: "Privacy Policy", ro: "Politica de confidențialitate", to: "/privacy" },
  { en: "Terms and Conditions", ro: "Termeni și condiții", to: "/terms" },
  { en: "Cookie Policy", ro: "Politica de cookie-uri", to: "/cookies" },
] as const;

const linkFocus =
  "rounded-sm transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// LanguageToggle restyled as a pill, matching the nav (dark active label for contrast).
const pillToggle =
  "rounded-full border-white/10 [&>button]:rounded-full [&>button]:outline-none [&>button:focus-visible]:ring-2 [&>button:focus-visible]:ring-ring [&>button[aria-pressed=true]]:text-background";

/**
 * Contact footer (#contact): the swirl video flipped under a heavy overlay, a
 * slow GSAP marquee, the closing call to action, page links and the legal bar.
 */
export function ContactFooter() {
  const { t, lang } = useI18n();
  const { paused } = useMotionPause();
  const footerRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const phrase = t("TECHNOLOGY WITH MEANING • ", "TEHNOLOGIE CU SENS • ").repeat(10);

  // The track holds two identical halves, so sliding it by -50% loops seamlessly.
  // Re-runs on language change so the loop restarts against the new text, and
  // when the page-wide pause is toggled.
  useGsap(
    () => {
      const footer = footerRef.current;
      const track = trackRef.current;
      if (!footer || !track) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tween = gsap.to(track, {
          xPercent: -50,
          duration: 40,
          ease: "none",
          repeat: -1,
          paused: true,
        });
        const trigger = ScrollTrigger.create({
          trigger: footer,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => (self.isActive && !paused ? tween.play() : tween.pause()),
        });
        if (trigger.isActive && !paused) tween.play();
      });
      return () => mm.revert();
    },
    footerRef,
    [lang, paused],
  );

  return (
    <footer
      id="contact"
      ref={footerRef}
      className="relative isolate scroll-mt-24 overflow-hidden bg-background pb-8 pt-16 md:pb-12 md:pt-20"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <HlsVideo
          src={SWIRL_VIDEO.hls}
          fallbackSrc={SWIRL_VIDEO.mp4}
          poster={SWIRL_VIDEO.poster}
          className="absolute inset-0 h-full w-full -scale-y-100 object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-background/70" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent md:h-56" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background/80 to-transparent" />
      </div>

      <div
        aria-hidden
        className="relative z-10 mb-12 overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] md:mb-16"
      >
        <div ref={trackRef} className="flex w-max motion-safe:will-change-transform">
          {[0, 1].map((half) => (
            <span
              key={half}
              // `pre` keeps each half's trailing space, so both halves have the same width.
              className="shrink-0 whitespace-pre font-display text-5xl font-bold uppercase leading-none tracking-tight text-foreground/10 md:text-7xl lg:text-8xl"
            >
              {phrase}
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 md:px-10 lg:px-16">
        <MotionConfig reducedMotion="user">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col items-center text-center"
          >
            <Eyebrow>Contact</Eyebrow>
            <h2 className="mt-5 max-w-4xl text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-6xl lg:text-7xl">
              {t("Turn the next idea into", "Transformă următoarea idee în")}{" "}
              <Em>{t("momentum", "progres")}</Em>.
            </h2>
            <p className="mt-5 max-w-xl text-sm text-muted-foreground md:text-base">
              {t(
                "Tell Vortex Hub what you would like to create, improve or automate.",
                "Spune-i Vortex Hub ce ai vrea să creezi, să îmbunătățești sau să automatizezi.",
              )}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <RingButton href={`mailto:${CONTACT_EMAIL}`} variant="solid" arrow="up-right">
                {CONTACT_EMAIL}
              </RingButton>
              <RingButton to="/contact" variant="outline" arrow="right">
                {t("Start a project", "Începe un proiect")}
              </RingButton>
            </div>
          </motion.div>
        </MotionConfig>

        <nav aria-label={t("Footer", "Subsol")} className="mt-16 md:mt-24">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:gap-x-8">
            {footerNav.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn("inline-block py-1 text-sm text-muted-foreground", linkFocus)}
                >
                  {lang === "ro" ? item.ro : item.en}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-16 flex flex-col items-center gap-6 border-t border-border pt-6 text-center text-xs text-muted-foreground md:flex-row md:justify-between md:text-left md:text-sm">
          <div className="flex min-w-0 flex-col items-center gap-3 md:items-start">
            <p>
              {t("© Vortex Hub. All rights reserved.", "© Vortex Hub. Toate drepturile rezervate.")}
            </p>
            <nav aria-label="Legal">
              <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 md:justify-start">
                {legalNav.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className={cn("inline-block py-1", linkFocus)}>
                      {lang === "ro" ? item.ro : item.en}
                    </Link>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={openCookieSettings}
                    className={cn("py-1", linkFocus)}
                  >
                    {t("Cookie settings", "Setări cookie-uri")}
                  </button>
                </li>
              </ul>
            </nav>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 md:shrink-0 md:flex-nowrap">
            <p className="inline-flex items-center gap-2.5">
              <span aria-hidden className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {t("Available for new projects", "Disponibili pentru proiecte noi")}
            </p>
            <LanguageToggle className={pillToggle} />
            <MotionPauseToggle className="h-8 w-8 bg-transparent" />
          </div>
        </div>
      </div>
    </footer>
  );
}

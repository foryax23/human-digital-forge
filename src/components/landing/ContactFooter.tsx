import { useEffect, useRef, useState } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { Pause, Play } from "lucide-react";

import { openCookieSettings } from "@/components/cookies/cookie-consent";
import { LanguageSwitch } from "@/components/layout/LanguageToggle";
import { ButtonLink, FOCUS_RING, IconButton, Status } from "@/components/system";
import { useI18n } from "@/i18n";
import { COMPANY_LINE } from "@/lib/scan/legal/company";
import { cn } from "@/lib/utils";
import { useMotionPause } from "./motion-pause";
import { prefersReducedMotion } from "./motion-prefs";
import { CONTACT_EMAIL, SIGNOFF_VIDEO } from "./media";
import { TechCredits } from "./TechStack";

type FooterLink = { en: string; ro: string; to: LinkProps["to"] };

const COLUMNS: { en: string; ro: string; links: FooterLink[] }[] = [
  {
    en: "Services",
    ro: "Servicii",
    links: [
      { en: "Websites", ro: "Site-uri web", to: "/websites" },
      { en: "AI automation", ro: "Automatizare AI", to: "/ai-automation" },
      { en: "Consultancy", ro: "Consultanță", to: "/consultancy" },
      { en: "Graphic materials", ro: "Materiale grafice", to: "/digital-products" },
      { en: "All services", ro: "Toate serviciile", to: "/services" },
    ],
  },
  {
    en: "Company",
    ro: "Companie",
    links: [
      { en: "Projects", ro: "Proiecte", to: "/portfolio" },
      { en: "Vortex Scan", ro: "Vortex Scan", to: "/scan" },
      { en: "Contact", ro: "Contact", to: "/contact" },
      { en: "Log in", ro: "Autentificare", to: "/login" },
    ],
  },
  {
    en: "Legal",
    ro: "Legal",
    links: [
      { en: "Privacy policy", ro: "Politica de confidențialitate", to: "/privacy" },
      { en: "Terms and conditions", ro: "Termeni și condiții", to: "/terms" },
      { en: "Cookie policy", ro: "Politica de cookie-uri", to: "/cookies" },
    ],
  },
];

const linkClass = cn("rounded-sm text-sm text-fg-2 transition-colors hover:text-fg", FOCUS_RING);

/**
 * The brand sign-off: the wordmark with its light sweep (the owner's logo animation),
 * 240 px wide, played once when it scrolls into view and then held on its final frame.
 * The 16:9 file is cropped to the wordmark; its black background drops out with
 * `screen`. The poster is that final frame, so reduced motion, the pause switch and
 * slow networks all show the wordmark.
 */
function BrandSignoff({ className }: { className?: string }) {
  const { paused } = useMotionPause();
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    // The WebM file (VP9) is the lightest; the 720p MP4 for browsers without VP9.
    const webm = document.createElement("video").canPlayType('video/webm; codecs="vp9"') !== "";
    setSrc(webm ? SIGNOFF_VIDEO.webm : SIGNOFF_VIDEO.mp4_720);
  }, []);

  // Load the poster and the video when close (the poster also for reduced motion).
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const nearby = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), {
      rootMargin: "400px 0px",
    });
    nearby.observe(box);
    return () => nearby.disconnect();
  }, []);

  // Play when it is fully on screen.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !src) return;
    const visible = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.99),
      { threshold: [0, 0.99] },
    );
    visible.observe(box);
    return () => visible.disconnect();
  }, [src]);

  // Once: an ended video holds its last frame and is never restarted.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !near || !src || video.ended) return;
    if (inView && !paused) {
      video.play().catch(() => {
        /* autoplay refused: the poster (final frame) stays up */
      });
    } else {
      video.pause();
    }
  }, [near, src, inView, paused]);

  return (
    <div ref={boxRef} aria-hidden className={cn("relative h-24 w-60 overflow-hidden", className)}>
      {/* The wordmark covers about 70% of the frame's width: scale the frame up so it
          fills the 240 px box, and shift it so the mark starts at the box's left edge. */}
      <video
        ref={videoRef}
        src={near && src ? src : undefined}
        poster={near ? SIGNOFF_VIDEO.poster : undefined}
        muted
        playsInline
        preload={near ? "auto" : "none"}
        disablePictureInPicture
        tabIndex={-1}
        className="pointer-events-none absolute left-[-51px] top-[-46px] aspect-video w-[343px] max-w-none mix-blend-screen"
      />
    </div>
  );
}

/** Page-wide motion switch as a quiet 28 px icon button (one name; aria-pressed says the state). */
function PauseButton() {
  const { t } = useI18n();
  const { paused, setPaused } = useMotionPause();
  return (
    <IconButton
      aria-pressed={paused}
      label={t("Pause animations", "Oprește animațiile")}
      onClick={() => setPaused(!paused)}
    >
      {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
    </IconButton>
  );
}

/**
 * Contact footer (#contact): the closing line with the e-mail and the call to action,
 * the brand sign-off with three link columns, and the legal bar.
 *
 * `compact` (the other pages, via SiteLayout, which close with their own call to action)
 * drops the closing line and keeps the sign-off, the columns and the legal bar.
 */
export function ContactFooter({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n();

  return (
    <footer
      id={compact ? undefined : "contact"}
      aria-labelledby={compact ? undefined : "contact-heading"}
      className={cn(
        "scroll-mt-20 border-t border-line-1 pb-6",
        compact ? "pt-4" : "pt-12 md:pt-16",
      )}
    >
      <div className="container-vx">
        {!compact && (
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-12">
            <div className="lg:col-span-7">
              <h2 id="contact-heading" className="type-h2 text-balance text-fg">
                {t("Let's talk about your business.", "Hai să vorbim despre afacerea ta.")}
              </h2>
              <p className="type-lead mt-3 max-w-[56ch] text-pretty text-fg-2">
                {t(
                  "Tell us what you would like to build, improve or automate.",
                  "Spune-ne ce vrei să construiești, să îmbunătățești sau să automatizezi.",
                )}
              </p>
            </div>
            <div className="flex flex-col items-start gap-4 lg:col-span-5 lg:items-end">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className={cn(
                  "rounded-sm font-display text-2xl font-medium leading-tight tracking-[-0.01em] text-fg underline decoration-fg/30 decoration-1 underline-offset-[6px] transition-colors hover:decoration-fg",
                  FOCUS_RING,
                )}
              >
                {CONTACT_EMAIL}
              </a>
              <ButtonLink to="/contact" variant="secondary">
                {t("Book a call", "Programează o discuție")}
              </ButtonLink>
            </div>
          </div>
        )}

        <div
          className={cn(
            "grid grid-cols-2 gap-x-6 gap-y-8 pt-8 sm:grid-cols-3 lg:grid-cols-[15rem_repeat(3,minmax(0,1fr))] lg:gap-x-12",
            !compact && "mt-12 border-t border-line-1",
          )}
        >
          <BrandSignoff className="col-span-2 -mt-2 sm:col-span-3 lg:col-span-1" />
          {COLUMNS.map((column) => (
            <nav key={column.en} aria-labelledby={`footer-${column.en.toLowerCase()}`}>
              <h3 id={`footer-${column.en.toLowerCase()}`} className="type-label text-fg-3">
                {lang === "ro" ? column.ro : column.en}
              </h3>
              <ul className="mt-3 flex flex-col items-start gap-2">
                {column.links.map((link) => (
                  <li key={link.en}>
                    <Link to={link.to} className={linkClass}>
                      {lang === "ro" ? link.ro : link.en}
                    </Link>
                  </li>
                ))}
                {compact && column.en === "Company" && (
                  <li>
                    <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                      {CONTACT_EMAIL}
                    </a>
                  </li>
                )}
                {column.en === "Legal" && (
                  <li>
                    <button
                      type="button"
                      onClick={openCookieSettings}
                      className={cn(linkClass, "cursor-pointer")}
                    >
                      {t("Cookie settings", "Setări cookie-uri")}
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line-1 pt-5 md:flex-row md:items-start md:justify-between md:gap-10">
          <div className="flex min-w-0 flex-col gap-1.5 text-xs leading-[1.45] text-fg-3">
            {/* Legea 365/2002 art. 5: the firm's name, CUI and trade register number on every page. */}
            <p>{COMPANY_LINE}</p>
            {/* Trademark note and attribution for the tech logos (TechStack.tsx): only on
                the homepage, the one page that shows them. */}
            {compact ? null : <TechCredits />}
          </div>
          <div className="flex shrink-0 items-center gap-5">
            <Status tone="ok" shape="dot">
              {t("Taking on new projects", "Acceptăm proiecte noi")}
            </Status>
            <LanguageSwitch />
            <PauseButton />
          </div>
        </div>
      </div>
    </footer>
  );
}

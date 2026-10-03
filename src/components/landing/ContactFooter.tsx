import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MotionConfig, motion } from "motion/react";

import { openCookieSettings } from "@/components/cookies/cookie-consent";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { MotionPauseToggle, useMotionPause } from "./motion-pause";
import { prefersReducedMotion } from "./motion-prefs";
import { HlsVideo } from "./HlsVideo";
import { CONTACT_EMAIL, SIGNOFF_VIDEO, SWIRL_VIDEO } from "./media";
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

// LanguageToggle restyled as a quiet pill, matching the nav: mono labels and a
// solid brand-violet active state instead of the gradient.
const pillToggle =
  "rounded-full border-white/10 [&>button]:type-label [&>button]:rounded-full [&>button]:outline-none [&>button:focus-visible]:ring-2 [&>button:focus-visible]:ring-ring [&>button[aria-pressed=true]]:bg-none [&>button[aria-pressed=true]]:bg-primary [&>button[aria-pressed=true]]:text-primary-foreground";

/**
 * The brand sign-off: the wordmark with its light sweep (the owner's logo
 * animation), played once when it scrolls into view and then held on its final
 * frame. 16:9 from md up, the vertical cut on phones (picked after mount); its
 * black background drops out with `screen`. The poster is that final frame, so
 * reduced motion, the pause switch and slow networks all show the wordmark.
 */
function BrandSignoff({ className }: { className?: string }) {
  const { paused } = useMotionPause();
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Null until mounted, so phones never fetch the 16:9 poster (and neither poster loads
  // before the footer is near).
  const [portrait, setPortrait] = useState<boolean | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const phone = window.matchMedia("(max-width: 767px)").matches;
    setPortrait(phone);
    if (prefersReducedMotion()) return;
    // The WebM files (VP9) are the lightest; MP4 for browsers without VP9.
    const webm = document.createElement("video").canPlayType('video/webm; codecs="vp9"') !== "";
    if (phone) {
      setSrc(webm ? SIGNOFF_VIDEO.portrait.webm : SIGNOFF_VIDEO.portrait.mp4);
    } else {
      const large = window.innerWidth * (window.devicePixelRatio || 1) > 1600;
      setSrc(webm ? SIGNOFF_VIDEO.webm : large ? SIGNOFF_VIDEO.mp4_1080 : SIGNOFF_VIDEO.mp4_720);
    }
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

  // Play when at least half of it shows.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !src) return;
    const visible = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.5),
      { threshold: [0, 0.5, 1] },
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
    <div
      ref={boxRef}
      aria-hidden
      className={cn(
        "relative mx-auto aspect-[5/4] w-full max-w-[26rem] md:aspect-[16/7] md:max-w-[44rem]",
        className,
      )}
    >
      <video
        ref={videoRef}
        src={near && src ? src : undefined}
        poster={
          near && portrait !== null
            ? portrait
              ? SIGNOFF_VIDEO.portrait.poster
              : SIGNOFF_VIDEO.poster
            : undefined
        }
        muted
        playsInline
        preload={near ? "auto" : "none"}
        disablePictureInPicture
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover mix-blend-screen [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_71%)]"
      />
    </div>
  );
}

/**
 * Contact footer (#contact): the swirl video flipped under a heavy overlay, the
 * closing call to action, page links, the brand sign-off and the legal bar.
 */
export function ContactFooter() {
  const { t, lang } = useI18n();

  return (
    <footer
      id="contact"
      className="relative isolate scroll-mt-24 overflow-hidden bg-background pb-8 pt-24 md:pb-12 md:pt-32"
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

      {/* No z-index: a stacking context would cut the sign-off's `screen` blend off from
          the swirl behind it (its black would show). DOM order keeps it above the background. */}
      <div className="relative mx-auto max-w-[1200px] px-6 md:px-10 lg:px-16">
        <MotionConfig reducedMotion="user">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col items-center text-center"
          >
            <Eyebrow>Contact</Eyebrow>
            <h2 className="type-h2 mt-5 max-w-4xl text-balance text-foreground">
              {t("Turn the next idea into", "Transformă următoarea idee în")}{" "}
              <Em>{t("momentum", "progres")}</Em>.
            </h2>
            <p className="type-lead mt-5 max-w-xl text-muted-foreground">
              {t(
                "Tell Vortex Hub what you would like to create, improve or automate.",
                "Spune-ne ce vrei să creezi, să îmbunătățești sau să automatizezi.",
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
                  className={cn("type-body-sm inline-block py-1 text-muted-foreground", linkFocus)}
                >
                  {lang === "ro" ? item.ro : item.en}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <BrandSignoff className="mt-10 md:mt-14" />

        <div className="type-micro mt-8 flex flex-col items-center gap-6 border-t border-border pt-6 text-center text-muted-foreground md:mt-10 md:flex-row md:justify-between md:text-left">
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
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#67e8f9] opacity-75 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#67e8f9]" />
              </span>
              {t("Available for new projects", "Acceptăm proiecte noi")}
            </p>
            <LanguageToggle className={pillToggle} />
            <MotionPauseToggle className="h-8 w-8 bg-transparent" />
          </div>
        </div>
      </div>
    </footer>
  );
}

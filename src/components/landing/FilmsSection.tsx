import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

import { FREE_HOW, VALUE_ESTIMATE } from "@/components/deep/copy";
import { ButtonLink, IconButton, SectionHeader, keepHyphens } from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { DEEP_FILM, SCAN_FILM, WHATSAPP_FILM, type PromoFilm } from "./media";
import { useMotionPause } from "./motion-pause";
import { prefersReducedMotion } from "./motion-prefs";

/*
 * The three promo films (#films): vertical, Romanian text on screen, with music and sound effects
 * that stay muted until the visitor asks for them. Playback rules:
 * - Nothing is fetched until a film first plays: no `src` before that, only the lazy poster
 *   (frame 0, so the swap to the video shows no jump).
 * - One film plays at a time. It starts once at least half of it is on screen, pauses when it
 *   leaves or the tab is hidden, and at its end hands over to the next film that is on screen too
 *   (otherwise it starts again), so on desktop the three take turns.
 * - Reduced motion and the page-wide pause switch: no autoplay, the poster and a play button.
 * - Every film has its own pause / play button (WCAG 2.2.2). Pausing one stops autoplay for the
 *   section; pressing play starts that film and stops the others.
 * - Every film autoplays muted and has its own sound toggle beside pause / play. Only one film has
 *   sound at a time. Turning it on unmutes that film only: one that was autoplaying starts again
 *   from 0 and keeps playing (as if its play button had been pressed); one that was paused starts
 *   where it was; under reduced motion or the page pause nothing starts, the film plays with
 *   sound once its play button is pressed. Sound goes off again when that film leaves the screen,
 *   when the tab is hidden, when the page-wide pause is switched on and when the film reaches its
 *   end (the section then goes back to its muted rotation).
 */

type FilmCard = {
  key: "scan" | "deep" | "whatsapp";
  film: PromoFilm;
  title: string;
  caption: string;
  cta: { label: string; to: "/scan" | "/scan/deep" | "/ai-automation"; note?: string };
};

type Mode = "auto" | "manual" | "stopped";

function useFilmCards(): FilmCard[] {
  const { t, lang } = useI18n();
  return [
    {
      key: "scan",
      film: SCAN_FILM,
      title: "Vortex Scan",
      caption: t(
        "From public data: how long a customer waits, the site's score and what to fix.",
        "Din date publice: cât așteaptă clientul, scorul site-ului și ce e de făcut.",
      ),
      cta: {
        label: t("Scan your company for free", "Scanează-ți firma gratuit"),
        to: "/scan",
        note: t("No account needed.", "Fără cont."),
      },
    },
    {
      key: "deep",
      film: DEEP_FILM,
      title: "Deep Research",
      caption: t(
        "Reads a company's filed accounts and shows how much of every 100 lei it keeps.",
        "Citește bilanțurile firmei și îți arată cât îți rămâne din fiecare 100 de lei încasați.",
      ),
      // "Gratuit" never without the labelled estimate (the film's rule, as in PricingSection).
      cta: {
        label: t("Get your first report free", "Cere primul raport gratuit"),
        to: "/scan/deep",
        note: `${FREE_HOW[lang]}. ${VALUE_ESTIMATE[lang]}`,
      },
    },
    {
      key: "whatsapp",
      film: WHATSAPP_FILM,
      title: t("AI assistant on WhatsApp", "Asistent AI pe WhatsApp"),
      caption: t(
        "Replies at once, after hours too, books the appointment, takes the calls and brings you in when you are needed.",
        "Răspunde imediat, și după program, face programarea, preia apelurile și te cheamă când e nevoie de tine.",
      ),
      // The film's end card and /ai-automation both say the first call is free.
      cta: {
        label: t("See how it works", "Vezi cum funcționează"),
        to: "/ai-automation",
        note: t("The first call is free.", "Prima discuție e gratuită."),
      },
    },
  ];
}

/**
 * Films (#films), right after the services, with the split header of Services (the title in the
 * 5/12 column, the lead at the foot of the 7/12 column). Under it the three vertical films, each
 * with its title, caption and call to action: lg+ three columns across the container (about
 * 290 px wide at 1024, 370 px at 1280+, so the on-screen text reads); below lg a horizontal
 * scroll-snap row, the next film peeking in.
 */
export function FilmsSection() {
  const { t } = useI18n();
  const cards = useFilmCards();
  const { paused: pagePaused } = useMotionPause();

  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  // Per film: any part on screen / at least half on screen.
  const [visible, setVisible] = useState<boolean[]>(() => cards.map(() => false));
  const [prominent, setProminent] = useState<boolean[]>(() => cards.map(() => false));
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState<Mode>("auto");
  // The one film with its sound on, or -1.
  const [sound, setSound] = useState(-1);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    setReady(true);
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onQuery = () => setReduced(query.matches);
    query?.addEventListener?.("change", onQuery);
    const onVisibility = () => setTabVisible(document.visibilityState !== "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      query?.removeEventListener?.("change", onQuery);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const autoAllowed = ready && !reduced && !pagePaused;

  // Sound goes off when its film leaves the screen, the tab is hidden or the page-wide pause is
  // switched on, so a film never starts again with sound the visitor did not just ask for.
  useEffect(() => {
    if (sound >= 0 && (!visible[sound] || !tabVisible || pagePaused)) setSound(-1);
  }, [sound, visible, tabVisible, pagePaused]);

  // The page-wide pause also stops a film the visitor started.
  useEffect(() => {
    if (pagePaused) setMode((m) => (m === "manual" ? "auto" : m));
  }, [pagePaused]);

  // Auto mode follows the film on screen (phones: the one swiped into view).
  useEffect(() => {
    if (mode !== "auto" || prominent[current]) return;
    const next = prominent.findIndex(Boolean);
    if (next >= 0) setCurrent(next);
  }, [mode, prominent, current]);

  const playingIndex =
    mode === "stopped" || !tabVisible
      ? -1
      : mode === "manual"
        ? visible[current]
          ? current
          : -1
        : autoAllowed && prominent[current]
          ? current
          : -1;

  const setView = useCallback((index: number, isVisible: boolean, isProminent: boolean) => {
    setVisible((v) =>
      v[index] === isVisible ? v : v.map((x, i) => (i === index ? isVisible : x)),
    );
    setProminent((p) =>
      p[index] === isProminent ? p : p.map((x, i) => (i === index ? isProminent : x)),
    );
  }, []);

  const onUserPlay = useCallback((index: number) => {
    setCurrent(index);
    setMode("manual");
  }, []);
  const onUserPause = useCallback(() => setMode("stopped"), []);

  /**
   * The sound toggle (called inside the click, so the browser lets the film unmute and play).
   * On: only this film is unmuted. If it was autoplaying it starts again from 0; if autoplay is
   * allowed and it was not playing, it starts (stopping the other); under reduced motion or the
   * page pause it waits for its play button. Returns true when the caller should start it.
   */
  const onUserSound = useCallback(
    (index: number, on: boolean): boolean => {
      if (!on) {
        setSound((s) => (s === index ? -1 : s));
        return false;
      }
      setSound(index);
      const el = videos.current[index];
      videos.current.forEach((other, i) => {
        if (other && i !== index) other.muted = true;
      });
      if (!el) return false;
      el.muted = false;
      const isPlaying = !el.paused && !el.ended;
      if (isPlaying && mode === "auto") el.currentTime = 0;
      if (!isPlaying && !autoAllowed) return false;
      setCurrent(index);
      setMode("manual");
      return !isPlaying;
    },
    [mode, autoAllowed],
  );

  const onEnded = useCallback(
    (index: number) => {
      // A film heard once to its end goes quiet again; the section returns to its muted rotation.
      if (index === sound) setSound(-1);
      if (index !== current) return;
      // A film started by hand under reduced motion or the page pause holds its end card.
      if (mode === "manual" && !autoAllowed) {
        setMode("stopped");
        return;
      }
      // The next film in order that is on screen too (desktop: all three; phones: none).
      for (let step = 1; step < cards.length; step++) {
        const other = (index + step) % cards.length;
        if (!prominent[other]) continue;
        const next = videos.current[other];
        if (next) next.currentTime = 0;
        setCurrent(other);
        setMode("auto");
        return;
      }
      const video = videos.current[index];
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {
          /* refused: the end frame stays, the button offers play */
        });
      }
    },
    [current, mode, autoAllowed, prominent, cards.length, sound],
  );

  return (
    <section id="films" aria-labelledby="films-heading" className="section-y scroll-mt-20">
      <div className="container-vx">
        <SectionHeader
          layout="split"
          headingId="films-heading"
          className="mb-8 gap-3 md:mb-10 lg:gap-12"
          title={t(
            "What your customer sees, what you keep, and who answers.",
            "Ce vede clientul tău, cât îți rămâne și cine îi răspunde.",
          )}
        >
          <div className="flex h-full flex-col justify-end">
            <p className="type-lead max-w-[56ch] text-pretty text-fg-2">
              {keepHyphens(
                t(
                  "Three 20-second films in Romanian, with music, muted until you turn the sound on: the free company check, the report that reads your filed accounts and the AI assistant that answers your customers.",
                  "Trei filme de 20 de secunde, cu muzică, fără sunet până îl pornești: verificarea gratuită a firmei, raportul care îți citește bilanțurile și asistentul AI care le răspunde clienților tăi.",
                ),
              )}
            </p>
          </div>
        </SectionHeader>

        <ul
          role="list"
          className={cn(
            // Below lg: a scroll-snap row that bleeds to the screen edges (the container's gutter
            // moves inside it), so the next film peeks in. lg+: three columns; each card is a
            // subgrid of four rows, so the titles, captions and buttons line up.
            "-mx-4 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto overscroll-x-contain px-4 pb-1 scroll-px-4 sm:-mx-6 sm:px-6 sm:scroll-px-6",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-x-8 lg:gap-y-0 lg:overflow-visible lg:px-0 lg:pb-0",
          )}
        >
          {cards.map((card, index) => (
            <FilmItem
              key={card.key}
              card={card}
              index={index}
              playing={playingIndex === index}
              sound={sound === index}
              videoRef={(el) => {
                videos.current[index] = el;
              }}
              onView={setView}
              onUserPlay={onUserPlay}
              onUserPause={onUserPause}
              onUserSound={onUserSound}
              onEnded={onEnded}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function FilmCta({
  card,
  describedBy,
  className,
}: {
  card: FilmCard;
  /** Id of the film's name, so the button reads with it. */
  describedBy: string;
  className?: string;
}) {
  return (
    <div className={cn("mt-3", className)}>
      <ButtonLink to={card.cta.to} variant="secondary" aria-describedby={describedBy}>
        {card.cta.label}
      </ButtonLink>
      {card.cta.note ? (
        <p className="type-micro mt-1.5 max-w-[52ch] text-pretty text-fg-3">{card.cta.note}</p>
      ) : null}
    </div>
  );
}

function FilmItem({
  card,
  index,
  playing,
  sound,
  videoRef,
  onView,
  onUserPlay,
  onUserPause,
  onUserSound,
  onEnded,
}: {
  card: FilmCard;
  index: number;
  /** The section's decision: this film should be playing now. */
  playing: boolean;
  /** This film is the one with its sound on. */
  sound: boolean;
  videoRef: (el: HTMLVideoElement | null) => void;
  onView: (index: number, visible: boolean, prominent: boolean) => void;
  onUserPlay: (index: number) => void;
  onUserPause: () => void;
  onUserSound: (index: number, on: boolean) => boolean;
  onEnded: (index: number) => void;
}) {
  const { t } = useI18n();
  const frameRef = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const loaded = useRef(false);
  // What the element is really doing (autoplay can be refused), and whether it has drawn a frame.
  const [isPlaying, setIsPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const { film } = card;
  const titleId = `film-${card.key}-title`;

  /** The MP4 is attached on the first play only: before that the page fetches no film bytes. */
  const load = useCallback(() => {
    const el = video.current;
    if (!el || loaded.current) return;
    loaded.current = true;
    el.src = film.mp4;
  }, [film.mp4]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (typeof IntersectionObserver === "undefined") {
      onView(index, true, true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => onView(index, entry.isIntersecting, entry.intersectionRatio >= 0.5),
      { threshold: [0, 0.5] },
    );
    io.observe(frame);
    return () => io.disconnect();
  }, [index, onView]);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (playing) {
      load();
      el.play().catch(() => {
        /* refused (e.g. low-power mode): the poster stays, the button offers play */
      });
    } else if (!el.paused) {
      el.pause();
    }
  }, [playing, load]);

  // Muted unless this film is the one with sound (the toggle also sets it inside the click).
  useEffect(() => {
    const el = video.current;
    if (el) el.muted = !sound;
  }, [sound]);

  const toggleSound = () => {
    const el = video.current;
    if (!el) return;
    if (onUserSound(index, !sound)) {
      load();
      // Inside the click, so the browser accepts playback with sound.
      el.play().catch(() => {
        /* refused: the play button stays, and the sound is already on */
      });
    }
  };

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (isPlaying) {
      onUserPause();
      el.pause();
    } else {
      onUserPlay(index);
      load();
      // Inside the click, so browsers that refused autoplay accept it.
      el.play().catch(() => {});
    }
  };

  const action = isPlaying
    ? t("Pause the film", "Pune filmul pe pauză")
    : t("Play the film", "Pornește filmul");
  // A toggle keeps one name and says its state with aria-pressed (as the page's motion switch);
  // the tooltip says what a click does next.
  const soundName = t("Turn sound on", "Pornește sunetul");
  const soundHint = sound
    ? t("Turn sound off", "Oprește sunetul")
    : t("Turn sound on", "Pornește sunetul");

  return (
    <li className="w-[min(76vw,20rem)] shrink-0 snap-start lg:row-span-4 lg:grid lg:w-auto lg:grid-rows-subgrid lg:gap-y-0">
      <div
        ref={frameRef}
        className="relative aspect-[9/16] overflow-hidden rounded-xl border border-line-2 bg-s1"
      >
        <picture>
          <source srcSet={film.poster.avif} type="image/avif" />
          <img
            src={film.poster.webp}
            width={film.width}
            height={film.height}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 size-full select-none object-cover"
          />
        </picture>
        <video
          ref={(el) => {
            video.current = el;
            videoRef(el);
          }}
          muted
          playsInline
          preload="none"
          disablePictureInPicture
          aria-label={t(
            `${card.title} film, 20 seconds, with music, muted until you turn the sound on, Romanian text on screen.`,
            `Film ${card.title}, 20 de secunde, cu muzică, fără sunet până îl pornești, cu text pe ecran.`,
          )}
          onPlaying={() => {
            setStarted(true);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            onEnded(index);
          }}
          className={cn(
            "absolute inset-0 size-full object-cover",
            // Until its first frame is drawn the video stays clear, so the poster shows.
            started ? "opacity-100" : "opacity-0",
          )}
        />
        <div className="absolute bottom-3 right-3 flex gap-2">
          <IconButton
            size="md"
            variant="secondary"
            aria-pressed={sound}
            label={`${soundName}: ${card.title}`}
            title={soundHint}
            onClick={toggleSound}
            className="bg-s1 hover:bg-s3"
          >
            {sound ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
          </IconButton>
          <IconButton
            size="md"
            variant="secondary"
            label={`${action}: ${card.title}`}
            title={action}
            onClick={toggle}
            className="bg-s1 hover:bg-s3"
          >
            {isPlaying ? <Pause aria-hidden /> : <Play aria-hidden />}
          </IconButton>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 id={titleId} className="type-h4 text-fg">
          {card.title}
        </h3>
      </div>
      <p className="type-body-sm mt-1 text-pretty text-fg-2">{keepHyphens(card.caption)}</p>
      <FilmCta card={card} describedBy={titleId} />
    </li>
  );
}

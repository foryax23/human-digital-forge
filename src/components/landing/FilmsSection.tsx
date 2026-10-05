import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Pause, Play, Volume2, VolumeX } from "lucide-react";

import { FREE_HOW, VALUE_ESTIMATE } from "@/components/deep/copy";
import {
  ButtonLink,
  FOCUS_RING,
  IconButton,
  SectionHeader,
  keepHyphens,
} from "@/components/system";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { DEEP_FILM, SCAN_FILM, type PromoFilm } from "./media";
import { useMotionPause } from "./motion-pause";
import { prefersReducedMotion } from "./motion-prefs";

/*
 * The two promo films (#films): vertical, Romanian text on screen, with music and sound effects
 * that stay muted until the visitor asks for them. Playback rules:
 * - Nothing is fetched until a film first plays: no `src` before that, only the lazy poster
 *   (frame 0, so the swap to the video shows no jump).
 * - One film plays at a time. It starts once at least half of it is on screen, pauses when it
 *   leaves or the tab is hidden, and hands over to the other film at its end when that one is
 *   on screen too (otherwise it starts again), so on desktop the two take turns.
 * - Reduced motion and the page-wide pause switch: no autoplay, the poster and a play button.
 * - Every film has its own pause / play button (WCAG 2.2.2). Pausing one stops autoplay for the
 *   section; pressing play starts that film and stops the other.
 * - Every film autoplays muted and has its own sound toggle beside pause / play. Only one film has
 *   sound at a time. Turning it on unmutes that film only: one that was autoplaying starts again
 *   from 0 and keeps playing (as if its play button had been pressed); one that was paused starts
 *   where it was; under reduced motion or the page pause nothing starts, the film plays with
 *   sound once its play button is pressed. Sound goes off again when that film leaves the screen,
 *   when the tab is hidden, when the page-wide pause is switched on and when the film reaches its
 *   end (the section then goes back to its muted rotation).
 * - The text of each film sits under it in a closed <details> (screen readers, search engines).
 */

type Beat = {
  /** Time code in the film (m:ss). */
  at: string;
  /** The big line of the film, as it is on screen. */
  say?: string;
  /** What the product screen shows, in one sentence. */
  screen?: string;
};

type FilmCard = {
  key: "scan" | "deep";
  film: PromoFilm;
  title: string;
  /** Beside the title: what the film's figures are (the site's "Date de exemplu" rule). */
  meta: string;
  caption: string;
  cta: { label: string; to: "/scan" | "/scan/deep"; note?: string };
  beats: Beat[];
  /** The labels the film shows on its sample data, quoted. */
  labels: string;
};

type Mode = "auto" | "manual" | "stopped";

function useFilmCards(): FilmCard[] {
  const { t, lang } = useI18n();
  return [
    {
      key: "scan",
      film: SCAN_FILM,
      title: "Vortex Scan",
      meta: t("Sample data", "Date de exemplu"),
      caption: t(
        "From public data: how long a customer waits, the site's score and what to fix.",
        "Din date publice: cât așteaptă clientul, scorul site-ului și ce e de făcut.",
      ),
      cta: {
        label: t("Scan your company for free", "Scanează-ți firma gratuit"),
        to: "/scan",
        note: t("No account needed.", "Fără cont."),
      },
      beats: [
        { at: "0:00", say: t("Spending money on ads?", "Dai bani pe reclame?") },
        {
          at: "0:01",
          say: t("The customer clicks.", "Clientul dă clic."),
          screen: t(
            "A stopwatch starts; the page is still blank.",
            "Pornește un cronometru; pagina e încă goală.",
          ),
        },
        {
          at: "0:02",
          say: t("And waits.", "Și așteaptă."),
          screen: t(
            "The stopwatch passes the 2.5 s target.",
            "Cronometrul trece de ținta de 2,5 s.",
          ),
        },
        { at: "0:04", say: t("Would you still wait?", "Tu ai mai aștepta?") },
        {
          at: "0:06",
          screen: t(
            "Mobile speed: the first screen appears in 4.6 s. Poor, the target is under 2.5 s.",
            "Viteza pe mobil: primul ecran apare în 4,6 s. Slab, ținta: sub 2,5 s.",
          ),
        },
        {
          at: "0:07",
          say: t("The customer feels it. You don't see it.", "Clientul simte. Tu nu vezi."),
        },
        { at: "0:09", say: t("And at your company?", "Și la firma ta?") },
        {
          at: "0:10",
          say: t("You type the company's name. That's all.", "Scrii numele firmei. Atât."),
          screen: t(
            "Search: Clinica Dentară Exemplu SRL, Timișoara, then Analyse.",
            "În căutare: Clinica Dentară Exemplu SRL, Timișoara, apoi Analizează.",
          ),
        },
        {
          at: "0:12",
          say: t(
            "From public data: ANAF, ONRC, the company's website.",
            "Din date publice: ANAF, ONRC, site-ul firmei.",
          ),
          screen: t("The analysis: 8 of 8 steps done.", "Analiza: 8 din 8 gata."),
        },
        {
          at: "0:13",
          screen: t(
            "Site score: 56 out of 100, Fair.",
            "Scorul site-ului: 56 din 100, Acceptabil.",
          ),
        },
        {
          at: "0:15",
          say: t("Not just problems. What to do, too.", "Nu doar probleme. Și ce e de făcut."),
          screen: t(
            "Problem: the first screen loads slowly on mobile. What we do: shrink the main image and load what is visible first; the other scripts come after.",
            "Problemă: primul ecran se încarcă greu pe mobil. Ce facem: micșorăm poza principală și încărcăm întâi ce se vede; restul scripturilor vin după.",
          ),
        },
        {
          at: "0:17",
          say: t(
            "See what your customer sees. Free, no account.",
            "Vezi ce vede clientul tău. Gratuit, fără cont.",
          ),
          screen: "vortexhub.dev",
        },
      ],
      labels: t(
        "The film marks its figures “Date de exemplu · secvențe scurtate” (sample data, sequences shortened).",
        "Pe ecran: „Date de exemplu · secvențe scurtate”.",
      ),
    },
    {
      key: "deep",
      film: DEEP_FILM,
      title: "Deep Research",
      meta: t("Invented company", "Firmă inventată"),
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
      beats: [
        {
          at: "0:00",
          say: t("Out of every 100 lei, how much do you keep?", "Din 100 de lei, cât îți rămâne?"),
        },
        { at: "0:01", say: t("What's your guess?", "Tu cât zici?") },
        {
          at: "0:02",
          say: t(
            "An example: sales have doubled since 2019.",
            "Un exemplu: cifra de afaceri s-a dublat din 2019.",
          ),
          screen: t(
            "From 2.1 to 4.62 million lei, 2019 to 2025, from the accounts filed with the Ministry of Finance.",
            "De la 2,1 la 4,62 mil. lei, din 2019 până în 2025, din bilanțurile depuse la Ministerul Finanțelor.",
          ),
        },
        { at: "0:04", say: t("But out of 100 lei?", "Dar din 100 de lei?") },
        {
          at: "0:06",
          say: t(
            "Out of 100 lei you keep 10, against 14 in 2019.",
            "Din 100 de lei îți rămân 10, față de 14 în 2019.",
          ),
          screen: t(
            "Year by year, 2019 to 2025: 14, 11, 15, 17, 10, 12, 10.",
            "An cu an, din 2019 până în 2025: 14, 11, 15, 17, 10, 12, 10.",
          ),
        },
        { at: "0:08", say: t("Your accounts know.", "Bilanțul tău știe.") },
        { at: "0:09", say: t("Do you?", "Tu știi?") },
        {
          at: "0:10",
          say: t(
            "Deep Research reads them for you. In plain words, with sources.",
            "Deep Research ți-l citește. Pe înțeles, cu surse.",
          ),
          screen: t(
            "Researching Clinica Dentară Exemplu SRL: official registers, 7 years of money (7 of 7 years with accounts), the website, courts and tenders.",
            "Cercetăm Clinica Dentară Exemplu SRL: registre oficiale, bani pe 7 ani (7 din 7 ani cu bilanț), site-ul firmei, instanțe și licitații.",
          ),
        },
        {
          at: "0:12",
          screen: t(
            "A page of the report: costs +69%, revenue +57% (2022–2025). Our estimate: about 500 lei of analysis.",
            "O pagină din raport: cheltuielile +69%, veniturile +57% (2022–2025). Estimarea noastră: circa 500 de lei de analiză.",
          ),
        },
        {
          at: "0:14",
          say: t(
            "Your first Deep Research report is free.",
            "Primul raport Deep Research e gratuit.",
          ),
          screen: t(
            "One per account, when you sign in with Google. Under the page our estimate stays: about 500 lei of analysis.",
            "Unul pe cont, când intri cu Google. Sub pagină rămâne estimarea noastră: circa 500 de lei de analiză.",
          ),
        },
        {
          at: "0:17",
          say: t("Don't guess. Find out how much you keep.", "Nu ghici. Află cât îți rămâne."),
          screen: t(
            "The first report is free. Our estimate: about 500 lei of analysis. vortexhub.dev",
            "Primul raport e gratuit. Estimarea noastră: circa 500 de lei de analiză. vortexhub.dev",
          ),
        },
      ],
      labels: t(
        "The film marks its sample “Exemplu cu o firmă inventată” (an invented company) and the report “Text redactat cu AI” (written with AI).",
        "Pe ecran: „Exemplu cu o firmă inventată” și „Text redactat cu AI”.",
      ),
    },
  ];
}

/**
 * Films (#films), right after the services, in the split header layout of Services and
 * Consultation. lg+: the title, the lead and the two offers as hairline rows (caption, call to
 * action) in the 5/12 column; the two vertical films in the 7/12 column, each with its title,
 * sample-data label and on-screen text. Below lg the header stacks on top and each film carries
 * its own caption and call to action: side by side on md, one at a time in a horizontal
 * scroll-snap row on phones, the next one peeking in.
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
      const other = (index + 1) % cards.length;
      if (other !== index && prominent[other]) {
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
          // Below lg the offers are hidden but their slot keeps the header's 20 px gap, so 12 (md:
          // 20) more gives the stacked header's 32 / 40 px to the films.
          className="gap-3 md:gap-5 lg:gap-12"
          title={t(
            "What your customer sees, and what you keep.",
            "Ce vede clientul tău și cât îți rămâne.",
          )}
          lead={t(
            "Two 20-second films in Romanian, with music, muted until you turn the sound on. The first shows the free company check, the second the report that reads your filed accounts. The text of each film is under it, in English.",
            "Două filme de 20 de secunde, cu muzică, fără sunet până îl pornești. Primul arată verificarea gratuită a firmei, al doilea raportul care îți citește bilanțurile.",
          )}
          actions={<OfferRows cards={cards} />}
        >
          <ul
            role="list"
            className={cn(
              // Phones: a scroll-snap row that bleeds to the screen edges (the container's gutter
              // moves inside it), so the next film peeks in. md+: two columns, at most 704 px
              // together; each card is a subgrid (five rows below lg, three on lg+), so titles,
              // captions, buttons and texts line up.
              "-mx-4 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto overscroll-x-contain px-4 pb-1 scroll-px-4 sm:-mx-6 sm:px-6 sm:scroll-px-6",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "md:mx-0 md:grid md:max-w-[44rem] md:grid-cols-2 md:gap-x-6 md:gap-y-0 md:overflow-visible md:px-0 md:pb-0",
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
        </SectionHeader>
      </div>
    </section>
  );
}

/**
 * lg+: the two offers as hairline rows under the lead (the PricingSection band). Below lg each
 * film carries its own caption and call to action instead, so this list is hidden there.
 * The names are plain text, not headings: the h3 under each film already names it.
 */
function OfferRows({ cards }: { cards: FilmCard[] }) {
  return (
    <ul
      role="list"
      className="hidden w-full divide-y divide-line-1 border-y border-line-1 lg:mt-3 lg:block"
    >
      {cards.map((card) => {
        const nameId = `film-${card.key}-offer`;
        return (
          <li key={card.key} className="py-5">
            <p id={nameId} className="type-h4 text-fg">
              {card.title}
            </p>
            <p className="type-body-sm mt-1 max-w-[52ch] text-pretty text-fg-2">
              {keepHyphens(card.caption)}
            </p>
            <FilmCta card={card} describedBy={nameId} />
          </li>
        );
      })}
    </ul>
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
    <li className="w-[min(76vw,20rem)] shrink-0 snap-start md:row-span-5 md:grid md:w-auto md:grid-rows-subgrid md:gap-y-0 lg:row-span-3">
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
            `${card.title} film, 20 seconds, with music, muted until you turn the sound on, Romanian text on screen. Its text is below.`,
            `Film ${card.title}, 20 de secunde, cu muzică, fără sunet până îl pornești, cu text pe ecran. Textul lui e mai jos.`,
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
        <span className="type-label text-fg-3">{card.meta}</span>
      </div>
      {/* lg+: the caption and the call to action sit in the offer rows beside the films. */}
      <p className="type-body-sm mt-1 text-pretty text-fg-2 lg:hidden">
        {keepHyphens(card.caption)}
      </p>
      <FilmCta card={card} describedBy={titleId} className="lg:hidden" />
      <FilmText card={card} />
    </li>
  );
}

/** The film's on-screen lines with their time codes, closed by default. */
function FilmText({ card }: { card: FilmCard }) {
  const { t } = useI18n();
  return (
    <details className="group mt-3 border-t border-line-1 pt-2.5">
      <summary
        className={cn(
          "type-label flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden",
          FOCUS_RING,
        )}
      >
        {t("The film's text, in English", "Textul din film")}
        <ChevronDown
          aria-hidden
          className="size-3.5 text-fg-3 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <ol className="mt-2.5 flex flex-col gap-2">
        {card.beats.map((beat) => (
          <li
            key={beat.at + (beat.say ?? beat.screen)}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2"
          >
            <span className="type-pnum text-[0.8125rem] leading-[1.5] text-fg-3">{beat.at}</span>
            <div className="min-w-0">
              {beat.say ? <p className="type-body-sm text-fg">{keepHyphens(beat.say)}</p> : null}
              {beat.screen ? (
                <p className="type-micro mt-0.5 text-pretty text-fg-3">
                  <span className="sr-only">{t("On screen: ", "Pe ecran: ")}</span>
                  {keepHyphens(beat.screen)}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="type-micro mt-2.5 text-fg-3">{card.labels}</p>
    </details>
  );
}

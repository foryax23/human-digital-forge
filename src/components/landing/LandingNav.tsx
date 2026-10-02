import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { navLinks } from "@/components/layout/nav-data";
import { BRAND_ICON_SMALL } from "@/components/landing/media";
import { RingButton } from "@/components/landing/RingButton";
import { Eyebrow } from "@/components/landing/SectionHeader";
import { SECTION_IDS, scrollToSection, type SectionId } from "@/components/landing/smooth-scroll";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n, type Language } from "@/i18n";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<SectionId, { en: string; ro: string }> = {
  top: { en: "Home", ro: "Acasă" },
  work: { en: "Work", ro: "Lucrări" },
  services: { en: "Services", ro: "Servicii" },
  pricing: { en: "Plans", ro: "Planuri" },
  contact: { en: "Contact", ro: "Contact" },
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const roundIconButton = cn(
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-muted-foreground transition-colors duration-200 hover:bg-white/5 hover:text-foreground",
  focusRing,
);

// LanguageToggle restyled as a pill; its buttons get the nav's focus ring (offset so
// it stays visible against the active button's gradient). The active label is dark:
// white text fails contrast on the light (mint) half of the brand gradient.
const pillToggle =
  "rounded-full border-white/10 [&>button]:rounded-full [&>button]:outline-none [&>button:focus-visible]:ring-2 [&>button:focus-visible]:ring-ring [&>button:focus-visible]:ring-offset-1 [&>button:focus-visible]:ring-offset-background [&>button[aria-pressed=true]]:text-background";

function navLinkClass(active: boolean) {
  return cn(
    "whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors duration-200 sm:px-4 sm:py-2 sm:text-sm",
    focusRing,
    active
      ? "bg-white/10 text-foreground"
      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
  );
}

/** Lets modified clicks (new tab / window) through to the browser. */
function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** True once the page has scrolled past `threshold` px. */
function useScrolledPast(threshold: number) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return scrolled;
}

/** Scroll-spy over SECTION_IDS; sections missing from the page are skipped. */
function useActiveSection() {
  const [active, setActive] = useState<SectionId>("top");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = SECTION_IDS.flatMap((id) => {
      const el = document.getElementById(id);
      return el ? [{ id, el }] : [];
    });
    if (sections.length === 0) return;

    // The observer only signals that a section crossed the band; the active one is
    // the last whose top has passed the band. That stays correct when scrolling up
    // and inside untracked sections (explorations, stats, consultation).
    const update = () => {
      const line = window.innerHeight * 0.5;
      let current: SectionId = "top";
      for (const { id, el } of sections) {
        if (el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };

    const observer = new IntersectionObserver(update, { rootMargin: "-45% 0px -50% 0px" });
    for (const { el } of sections) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return active;
}

/** 36px Vortex icon inside the travelling brand-gradient ring. */
function LogoMark() {
  return (
    <span
      aria-hidden
      className="accent-gradient-animated block h-9 w-9 shrink-0 rounded-full p-[2px] group-hover:[animation-direction:reverse]"
    >
      <span className="block h-full w-full overflow-hidden rounded-full bg-background">
        <img
          src={BRAND_ICON_SMALL}
          alt=""
          width={96}
          height={96}
          className="h-full w-full object-cover"
        />
      </span>
    </span>
  );
}

/** Bar-style section link with a small dot under the active one. */
function barLinkClass(active: boolean) {
  return cn(
    "relative inline-flex rounded-full px-3 py-2 text-sm transition-colors duration-200 xl:px-4",
    focusRing,
    active ? "text-foreground" : "text-foreground/60 hover:text-foreground",
  );
}

/** "EN ⌄" language menu from the hero mockup. */
function LanguageMenu({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("Language", "Limba")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm uppercase text-foreground/70 transition-colors hover:text-foreground",
          focusRing,
          className,
        )}
      >
        {lang}
        <ChevronDown aria-hidden className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      {/* Portalled: opts into the dark tokens itself. */}
      <DropdownMenuContent
        align="end"
        className="cinematic min-w-[9rem] rounded-2xl border-white/10 bg-card/95 p-1 text-foreground backdrop-blur-xl"
      >
        <DropdownMenuRadioGroup value={lang} onValueChange={(value) => setLang(value as Language)}>
          {(
            [
              ["en", "English"],
              ["ro", "Română"],
            ] as const
          ).map(([code, label]) => (
            <DropdownMenuRadioItem
              key={code}
              value={code}
              className="rounded-xl py-2 pl-8 text-sm focus:bg-white/10 focus:text-foreground"
            >
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Homepage nav in the search-first hero style: logo and spaced wordmark, centred
 * scroll-spy section links, a language menu, login and an outlined "Start a
 * project". Transparent over the hero, frosted once the page scrolls. Below lg
 * the links move into a right-hand Sheet menu.
 */
export function LandingNav() {
  const { t } = useI18n();
  const { user } = useAuth();
  const scrolled = useScrolledPast(100);
  const active = useActiveSection();
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingScroll = useRef(0);

  useEffect(() => () => window.clearTimeout(pendingScroll.current), []);

  const account = user
    ? { to: "/dashboard" as const, label: t("Dashboard", "Panou") }
    : { to: "/login" as const, label: t("Login", "Autentificare") };
  const ctaLabel = t("Start a project", "Începe un proiect");

  const goToSection = (event: MouseEvent<HTMLAnchorElement>, id: SectionId) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    scrollToSection(id);
  };

  const goToSectionFromMenu = (event: MouseEvent<HTMLAnchorElement>, id: SectionId) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    setMenuOpen(false);
    window.clearTimeout(pendingScroll.current);
    // Wait for the sheet's exit animation, which also releases its scroll lock.
    pendingScroll.current = window.setTimeout(() => {
      pendingScroll.current = 0;
      scrollToSection(id);
    }, 300);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-white/5 bg-background/70 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <nav
        aria-label={t("Primary", "Principală")}
        className="mx-auto flex h-[4.5rem] max-w-[80rem] items-center justify-between gap-4 px-5 md:h-[5.25rem] md:px-8 lg:px-12"
      >
        <button
          type="button"
          onClick={() => scrollToSection("top")}
          className={cn("group flex shrink-0 items-center gap-3.5 rounded-full", focusRing)}
        >
          <span className="transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100">
            <LogoMark />
          </span>
          <span
            aria-hidden
            className="hidden text-[0.8rem] font-light uppercase tracking-[0.55em] text-foreground/90 sm:inline"
          >
            Vortex Hub
          </span>
          <span className="sr-only">
            {t("Vortex Hub — back to top", "Vortex Hub — înapoi sus")}
          </span>
        </button>

        <ul className="hidden items-center lg:flex">
          {SECTION_IDS.map((id) => (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={active === id ? "true" : undefined}
                onClick={(event) => goToSection(event, id)}
                className={barLinkClass(active === id)}
              >
                {t(SECTION_LABELS[id].en, SECTION_LABELS[id].ro)}
                {active === id && (
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-foreground"
                  />
                )}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 lg:gap-3">
          <LanguageMenu className="hidden lg:inline-flex" />
          <span aria-hidden className="hidden h-6 w-px bg-white/15 lg:block" />
          <Link
            to={account.to}
            className={cn(
              "hidden rounded-full px-3 py-2 text-sm text-foreground/70 transition-colors hover:text-foreground lg:inline-flex",
              focusRing,
            )}
          >
            {account.label}
          </Link>
          <Link
            to="/contact"
            className={cn(
              "hidden items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-white/50 hover:bg-white/5 sm:inline-flex lg:px-5 lg:py-2.5",
              focusRing,
            )}
          >
            {ctaLabel}
            <ArrowUpRight aria-hidden className="h-4 w-4" />
          </Link>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={t("Open menu", "Deschide meniul")}
                className={cn(roundIconButton, "lg:hidden")}
              >
                <Menu aria-hidden className="h-4 w-4" />
              </button>
            </SheetTrigger>

            {/* Portalled outside the homepage wrapper, so it opts into the dark tokens
              itself. The built-in close button is swapped for a localised round one. */}
            <SheetContent
              side="right"
              aria-describedby={undefined}
              // A section link closed the menu: let scrollToSection place focus
              // on the section instead of returning it to the menu button.
              onCloseAutoFocus={(event) => {
                if (pendingScroll.current) event.preventDefault();
              }}
              className="cinematic flex w-[88vw] max-w-sm flex-col gap-0 overflow-y-auto border-white/10 bg-background p-6 text-foreground [&>button:first-child]:hidden"
            >
              <div className="flex items-center justify-between gap-4">
                <SheetTitle className="flex items-center gap-3 font-display text-base font-semibold tracking-tight">
                  <LogoMark />
                  Vortex Hub
                </SheetTitle>
                <SheetClose asChild>
                  <button
                    type="button"
                    aria-label={t("Close menu", "Închide meniul")}
                    className={roundIconButton}
                  >
                    <X aria-hidden className="h-4 w-4" />
                  </button>
                </SheetClose>
              </div>

              <nav aria-label={t("Sections", "Secțiuni")} className="mt-10">
                <ul className="flex flex-col gap-1">
                  {SECTION_IDS.map((id) => (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        aria-current={active === id ? "true" : undefined}
                        onClick={(event) => goToSectionFromMenu(event, id)}
                        className={cn(
                          "flex items-center justify-between gap-4 rounded-2xl px-4 py-3 font-display text-2xl font-semibold tracking-tight transition-colors duration-200",
                          focusRing,
                          active === id
                            ? "bg-white/10 text-foreground"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                        )}
                      >
                        {t(SECTION_LABELS[id].en, SECTION_LABELS[id].ro)}
                        {active === id && (
                          <span aria-hidden className="accent-gradient h-2 w-2 rounded-full" />
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div aria-hidden className="my-8 h-px bg-white/10" />

              <nav aria-label={t("Pages", "Pagini")}>
                <Eyebrow>{t("Pages", "Pagini")}</Eyebrow>
                <ul className="mt-4 grid grid-cols-2 gap-1">
                  {navLinks.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        onClick={closeMenu}
                        className={cn(
                          "block rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors duration-200 hover:bg-white/5 hover:text-foreground",
                          focusRing,
                        )}
                      >
                        {t(link.en, link.ro)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="mt-auto flex flex-col gap-4 pt-10">
                <div className="flex items-center justify-between gap-4">
                  <Link to={account.to} onClick={closeMenu} className={navLinkClass(false)}>
                    {account.label}
                  </Link>
                  <LanguageToggle className={pillToggle} />
                </div>
                <RingButton
                  to="/contact"
                  arrow="up-right"
                  onClick={closeMenu}
                  className="w-full"
                  innerClassName="w-full"
                >
                  {ctaLabel}
                </RingButton>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}

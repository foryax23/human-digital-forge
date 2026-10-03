import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { navLinks } from "@/components/layout/nav-data";
import { LOGO_NAV } from "@/components/landing/media";
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

// LanguageToggle restyled as a quiet pill with mono labels and a solid brand-violet
// active state; its buttons get the nav's focus ring (offset so it stays visible).
const pillToggle =
  "rounded-full border-white/10 [&>button]:type-label [&>button]:rounded-full [&>button]:outline-none [&>button:focus-visible]:ring-2 [&>button:focus-visible]:ring-ring [&>button:focus-visible]:ring-offset-1 [&>button:focus-visible]:ring-offset-background [&>button[aria-pressed=true]]:bg-none [&>button[aria-pressed=true]]:bg-[#5b52f0] [&>button[aria-pressed=true]]:text-white";

/**
 * The nav's one call to action: the hero search button's language (compact
 * solid brand violet, 10px corners, no gradient or glow, a slight press). The
 * arrow nudges towards the corner on hover.
 */
const ctaClass = cn(
  "type-button group inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#5b52f0] px-4 text-white transition-[background-color,scale] duration-150 hover:bg-[#6a62f6] active:scale-[0.97] motion-reduce:active:scale-100",
  focusRing,
);
const ctaArrowClass =
  "h-4 w-4 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px motion-reduce:transform-none";

function navLinkClass(active: boolean) {
  return cn(
    "type-body-sm whitespace-nowrap rounded-full px-4 py-2 transition-colors duration-200",
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

/**
 * Scroll-spy over SECTION_IDS; sections missing from the page are skipped.
 * Null when disabled (the nav is on another page).
 */
function useActiveSection(enabled: boolean): SectionId | null {
  const [active, setActive] = useState<SectionId>("top");

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
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
  }, [enabled]);

  return enabled ? active : null;
}

/**
 * The Vortex Hub wordmark (the owner's purple metallic logo), WebP with a PNG
 * fallback. The 96px export stays crisp at 32px (phones, up to 3x) and 40px
 * (md up, up to 2.4x). Glows softly while its link is hovered or focused.
 */
function Wordmark({ className }: { className?: string }) {
  return (
    <picture className="contents">
      <source type="image/webp" srcSet={LOGO_NAV.webp} />
      <img
        src={LOGO_NAV.png}
        alt="Vortex Hub"
        width={LOGO_NAV.width}
        height={LOGO_NAV.height}
        decoding="async"
        draggable={false}
        className={cn(
          "block h-8 w-auto select-none transition-[filter] duration-300 group-hover:drop-shadow-[0_0_14px_rgb(139_108_255/0.55)] group-focus-visible:drop-shadow-[0_0_14px_rgb(139_108_255/0.55)] md:h-10",
          className,
        )}
      />
    </picture>
  );
}

/** Bar-style section link with a small dot under the active one. */
function barLinkClass(active: boolean) {
  return cn(
    "type-body-sm relative inline-flex rounded-full px-3 py-2 transition-colors duration-200 xl:px-4",
    focusRing,
    active ? "text-foreground" : "text-foreground/60 hover:text-foreground",
  );
}

/** Large section link in the phone menu. */
function sheetLinkClass(active: boolean) {
  return cn(
    "type-h3 flex items-center justify-between gap-4 rounded-2xl px-4 py-3 transition-colors duration-200",
    focusRing,
    active
      ? "bg-white/10 text-foreground"
      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
  );
}

/** "EN ⌄" language menu: the quiet outline twin of the CTA, with a mono label. */
function LanguageMenu({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("Language", "Limba")}
        className={cn(
          "type-label inline-flex h-9 items-center gap-1 rounded-[10px] border border-white/12 pl-3 pr-2.5 text-foreground/75 transition-colors hover:border-white/30 hover:bg-white/[0.04] hover:text-foreground data-[state=open]:border-white/30 data-[state=open]:text-foreground",
          focusRing,
          className,
        )}
      >
        {lang}
        <ChevronDown
          aria-hidden
          className="h-3.5 w-3.5 transition-transform duration-200 [[data-state=open]>&]:rotate-180 motion-reduce:transition-none"
        />
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
              className="rounded-xl py-2 pl-8 focus:bg-white/10 focus:text-foreground"
            >
              {/* On a span: the item's own text-sm would win over a role on it. */}
              <span className="type-body-sm">{label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Homepage nav in the search-first hero style: the wordmark, centred
 * scroll-spy section links, a language menu, login and a solid violet "Start a
 * project". Transparent over the hero, frosted once the page scrolls. Below lg
 * the links move into a right-hand Sheet menu.
 *
 * `offPage` is for other pages that borrow the nav (/scan): the section links
 * and the wordmark lead to the homepage (and its sections) instead of
 * scrolling, and no section is highlighted.
 */
export function LandingNav({ offPage = false }: { offPage?: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const scrolled = useScrolledPast(100);
  const active = useActiveSection(!offPage);
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingScroll = useRef(0);

  useEffect(() => () => window.clearTimeout(pendingScroll.current), []);

  const account = user
    ? { to: "/dashboard" as const, label: t("Dashboard", "Contul meu") }
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

  const sectionLabel = (id: SectionId) => t(SECTION_LABELS[id].en, SECTION_LABELS[id].ro);
  /** The homepage section as a router link, for `offPage`. */
  const homeLink = (id: SectionId) => ({
    to: "/" as const,
    hash: id === "top" ? undefined : id,
  });
  const logoClass =
    "group flex shrink-0 items-center justify-self-start rounded-lg py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        // At the top, a soft scrim behind the bar only, so the links read over the hero's vortex.
        scrolled
          ? "border-white/5 bg-background/70 backdrop-blur-xl"
          : "border-transparent bg-transparent bg-[linear-gradient(to_bottom,rgb(0_2_15/0.8),rgb(0_2_15/0.5)_60%,transparent)]",
      )}
    >
      <nav
        aria-label={t("Primary", "Principală")}
        // Three columns from lg up, so the section links sit at the true centre.
        className="mx-auto grid h-[4.5rem] max-w-[80rem] grid-cols-[1fr_auto] items-center gap-4 px-5 md:h-[5.25rem] md:px-8 lg:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] lg:px-12"
      >
        {offPage ? (
          <Link to="/" className={logoClass}>
            <Wordmark />
            <span className="sr-only">{t(", home page", ", pagina principală")}</span>
          </Link>
        ) : (
          <a
            href="/"
            onClick={(event) => {
              if (!isPlainClick(event)) return;
              event.preventDefault();
              scrollToSection("top");
            }}
            className={logoClass}
          >
            <Wordmark />
            <span className="sr-only">{t(", back to top", ", înapoi la început")}</span>
          </a>
        )}

        <ul className="hidden items-center lg:flex">
          {SECTION_IDS.map((id) => (
            <li key={id}>
              {offPage ? (
                <Link {...homeLink(id)} className={barLinkClass(false)}>
                  {sectionLabel(id)}
                </Link>
              ) : (
                <a
                  href={`#${id}`}
                  aria-current={active === id ? "true" : undefined}
                  onClick={(event) => goToSection(event, id)}
                  className={barLinkClass(active === id)}
                >
                  {sectionLabel(id)}
                  {active === id && (
                    <span
                      aria-hidden
                      className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-foreground"
                    />
                  )}
                </a>
              )}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 justify-self-end lg:gap-3">
          <LanguageMenu className="hidden lg:inline-flex" />
          <span aria-hidden className="hidden h-6 w-px bg-white/15 lg:block" />
          <Link
            to={account.to}
            className={cn(
              "type-body-sm hidden whitespace-nowrap rounded-full px-3 py-2 text-foreground/70 transition-colors hover:text-foreground lg:inline-flex",
              focusRing,
            )}
          >
            {account.label}
          </Link>
          <Link to="/contact" className={cn(ctaClass, "hidden sm:inline-flex")}>
            {ctaLabel}
            <ArrowUpRight aria-hidden className={ctaArrowClass} />
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
                <SheetTitle className="flex items-center">
                  <Wordmark className="h-8 md:h-8" />
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
                      {offPage ? (
                        <Link
                          {...homeLink(id)}
                          onClick={closeMenu}
                          className={sheetLinkClass(false)}
                        >
                          {sectionLabel(id)}
                        </Link>
                      ) : (
                        <a
                          href={`#${id}`}
                          aria-current={active === id ? "true" : undefined}
                          onClick={(event) => goToSectionFromMenu(event, id)}
                          className={sheetLinkClass(active === id)}
                        >
                          {sectionLabel(id)}
                          {active === id && (
                            <span aria-hidden className="accent-gradient h-2 w-2 rounded-full" />
                          )}
                        </a>
                      )}
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
                          "type-body-sm block rounded-xl px-4 py-2.5 text-muted-foreground transition-colors duration-200 hover:bg-white/5 hover:text-foreground",
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
                <Link to="/contact" onClick={closeMenu} className={cn(ctaClass, "h-12 w-full")}>
                  {ctaLabel}
                  <ArrowUpRight aria-hidden className={ctaArrowClass} />
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}

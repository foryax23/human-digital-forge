import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { LanguageSwitch } from "@/components/layout/LanguageToggle";
import { navLinks } from "@/components/layout/nav-data";
import { LOGO_NAV } from "@/components/landing/media";
import { SECTION_IDS, scrollToSection, type SectionId } from "@/components/landing/smooth-scroll";
import { ButtonLink, FOCUS_RING, IconButton, type ButtonVariant } from "@/components/system";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** One name per thing, the same as the section titles and the footer. */
const SECTION_LABELS: Record<SectionId, { en: string; ro: string }> = {
  top: { en: "Home", ro: "Acasă" },
  work: { en: "Projects", ro: "Proiecte" },
  services: { en: "Services", ro: "Servicii" },
  pricing: { en: "Pricing", ro: "Prețuri" },
  contact: { en: "Contact", ro: "Contact" },
};

/**
 * The bar's links: the homepage sections in page order with Vortex Scan, the product,
 * before Contact. No "Acasă": the logo leads home.
 */
const BAR_ITEMS = ["work", "services", "pricing", "scan", "contact"] as const;
type BarItem = (typeof BAR_ITEMS)[number];

const SCAN_LABEL = { en: "Vortex Scan", ro: "Vortex Scan" };

/** Pages in the phone menu that the section links do not already cover. */
const MENU_PAGES = navLinks
  .filter((link) => link.to !== "/services" && link.to !== "/contact")
  .map((link) =>
    // The section link is "Proiecte"; the page with every project gets its own name.
    link.to === "/portfolio" ? { ...link, en: "All projects", ro: "Toate proiectele" } : link,
  );

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
    // and inside untracked sections (process, consultation).
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
 * fallback. The 96px export stays crisp at 32px (up to 3x screens). No hover effect.
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
        className={cn("block h-8 w-auto select-none", className)}
      />
    </picture>
  );
}

const BAR_LINK = cn(
  "inline-flex h-9 items-center rounded-md px-3 text-sm transition-colors duration-150",
  FOCUS_RING,
);

/** Section link in the bar: secondary text, the active one in the primary colour. */
function barLinkClass(active: boolean) {
  return cn(BAR_LINK, active ? "text-fg" : "text-fg-2 hover:text-fg");
}

/** Row in the phone menu: 48 px, hairline under it, the active one in weight 500. */
function menuLinkClass(active: boolean) {
  return cn(
    "flex h-12 items-center rounded-sm text-[0.9375rem] transition-colors duration-150",
    FOCUS_RING,
    active ? "font-medium text-fg" : "text-fg-2 hover:text-fg",
  );
}

/**
 * Homepage nav: the wordmark, centred scroll-spy section links plus Vortex Scan, the
 * language switch, login and the one call to action ("Programează o discuție").
 * Transparent over the hero, fully solid with a hairline once the page scrolls (nothing
 * shows through behind the links). Below lg the links move into a right-hand sheet.
 *
 * `offPage` is for other pages that borrow the nav (/scan and the pages in SiteLayout):
 * the section links and the wordmark lead to the homepage (and its sections) instead of
 * scrolling, and no section is highlighted. The call to action steps down to secondary
 * there (the scan's report download is the primary) unless `cta` says otherwise.
 */
export function LandingNav({
  offPage = false,
  cta,
}: {
  offPage?: boolean;
  /** Look of "Programează o discuție"; defaults to primary, secondary when `offPage`. */
  cta?: Extract<ButtonVariant, "primary" | "secondary">;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const scrolled = useScrolledPast(24);
  const active = useActiveSection(!offPage);
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingScroll = useRef(0);

  useEffect(() => () => window.clearTimeout(pendingScroll.current), []);

  const account = user
    ? { to: "/dashboard" as const, label: t("Dashboard", "Contul meu") }
    : { to: "/login" as const, label: t("Log in", "Autentificare") };
  const ctaLabel = t("Book a call", "Programează o discuție");
  const ctaVariant = cta ?? (offPage ? "secondary" : "primary");

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
    }, 260);
  };

  const closeMenu = () => setMenuOpen(false);

  const sectionLabel = (id: SectionId) => t(SECTION_LABELS[id].en, SECTION_LABELS[id].ro);
  /** The homepage section as a router link, for `offPage`. */
  const homeLink = (id: SectionId) => ({
    to: "/" as const,
    hash: id === "top" ? undefined : id,
  });
  const logoClass = cn("flex shrink-0 items-center justify-self-start rounded-md", FOCUS_RING);

  /** A homepage section as a row in the phone menu. */
  const menuSectionItem = (id: SectionId) => (
    <li key={id} className="border-b border-line-1">
      {offPage ? (
        <Link {...homeLink(id)} onClick={closeMenu} className={menuLinkClass(false)}>
          {sectionLabel(id)}
        </Link>
      ) : (
        <a
          href={`#${id}`}
          aria-current={active === id ? "true" : undefined}
          onClick={(event) => goToSectionFromMenu(event, id)}
          className={menuLinkClass(active === id)}
        >
          {sectionLabel(id)}
        </a>
      )}
    </li>
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-200",
        // At the top, a soft scrim behind the bar only, so the links read over the hero's vortex.
        scrolled
          ? "border-line-1 bg-background"
          : "border-transparent bg-[linear-gradient(to_bottom,rgb(0_2_15/0.8),rgb(0_2_15/0.45)_60%,transparent)]",
      )}
    >
      <nav
        aria-label={t("Primary", "Principală")}
        // Three columns from lg up, so the section links sit at the true centre.
        className="container-vx grid h-14 grid-cols-[1fr_auto] items-center gap-4 md:h-16 lg:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)]"
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
          {BAR_ITEMS.map((id: BarItem) => (
            <li key={id}>
              {id === "scan" ? (
                <Link
                  to="/scan"
                  className={BAR_LINK}
                  activeProps={{ className: "text-fg" }}
                  inactiveProps={{ className: "text-fg-2 hover:text-fg" }}
                >
                  {t(SCAN_LABEL.en, SCAN_LABEL.ro)}
                </Link>
              ) : offPage ? (
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
                </a>
              )}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 justify-self-end lg:gap-4">
          <LanguageSwitch className="hidden lg:inline-flex" />
          <Link
            to={account.to}
            className={cn(
              "hidden h-9 items-center whitespace-nowrap rounded-md px-1 text-sm text-fg-2 transition-colors hover:text-fg lg:inline-flex",
              FOCUS_RING,
            )}
          >
            {account.label}
          </Link>
          <ButtonLink to="/contact" variant={ctaVariant} className="hidden sm:inline-flex">
            {ctaLabel}
          </ButtonLink>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <IconButton
                size="md"
                label={t("Open menu", "Deschide meniul")}
                className="-mr-2 lg:hidden"
              >
                <Menu aria-hidden />
              </IconButton>
            </SheetTrigger>

            {/* Portalled outside the homepage wrapper, so it opts into the night tokens itself. */}
            <SheetContent
              side="right"
              closeLabel={t("Close menu", "Închide meniul")}
              aria-describedby={undefined}
              // A section link closed the menu: let scrollToSection place focus
              // on the section instead of returning it to the menu button.
              onCloseAutoFocus={(event) => {
                if (pendingScroll.current) event.preventDefault();
              }}
              className="cinematic flex w-[88vw] max-w-[360px] flex-col gap-0 overflow-y-auto p-0 sm:max-w-[360px]"
            >
              <div className="flex h-14 shrink-0 items-center border-b border-line-1 px-5">
                <SheetTitle className="flex items-center">
                  <Wordmark />
                </SheetTitle>
              </div>

              <nav aria-label={t("Menu", "Meniu")} className="px-5">
                <ul>
                  {(["work", "services", "pricing"] as const).map(menuSectionItem)}
                  <li className="border-b border-line-1">
                    <Link to="/scan" onClick={closeMenu} className={menuLinkClass(false)}>
                      {t(SCAN_LABEL.en, SCAN_LABEL.ro)}
                    </Link>
                  </li>
                  {MENU_PAGES.map((link) => (
                    <li key={link.to} className="border-b border-line-1">
                      <Link to={link.to} onClick={closeMenu} className={menuLinkClass(false)}>
                        {t(link.en, link.ro)}
                      </Link>
                    </li>
                  ))}
                  {menuSectionItem("contact")}
                </ul>
              </nav>

              <div className="mt-auto flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
                <div className="flex items-center justify-between gap-4">
                  <LanguageSwitch className="-ml-1" />
                  <Link
                    to={account.to}
                    onClick={closeMenu}
                    className={cn("rounded-sm py-1 text-sm text-fg-2 hover:text-fg", FOCUS_RING)}
                  >
                    {account.label}
                  </Link>
                </div>
                <ButtonLink
                  to="/contact"
                  size="lg"
                  variant={ctaVariant}
                  onClick={closeMenu}
                  className="w-full"
                >
                  {ctaLabel}
                </ButtonLink>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}

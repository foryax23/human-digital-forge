import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { COOKIE_CONSENT_OPEN_EVENT, readConsent, saveConsent } from "./cookie-consent";

export function CookieConsent() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  // Keyboard flow: "Personalizează" and "Setări cookie-uri" move focus to the first choice,
  // and closing the panel opened from the footer returns focus to that button.
  const firstChoice = useRef<HTMLButtonElement>(null);
  const focusChoice = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!customize || !focusChoice.current) return;
    focusChoice.current = false;
    firstChoice.current?.focus();
  }, [customize, open]);

  useEffect(() => {
    const existing = readConsent();
    if (!existing) {
      setOpen(true);
    } else {
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
    }

    const onOpen = () => {
      const current = readConsent();
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      focusChoice.current = true;
      setAnalytics(current?.analytics ?? false);
      setMarketing(current?.marketing ?? false);
      setCustomize(true);
      setOpen(true);
    };
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setCustomize(false);
    const back = returnFocus.current;
    returnFocus.current = null;
    if (back?.isConnected) back.focus();
  };

  const acceptAll = () => {
    saveConsent({ analytics: true, marketing: true });
    close();
  };

  const rejectAll = () => {
    saveConsent({ analytics: false, marketing: false });
    close();
  };

  const savePreferences = () => {
    saveConsent({ analytics, marketing });
    close();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-5">
      {/* A labelled region (not a modal): the page stays usable, and the choice is first in
          the Tab order after the skip link (it renders before the page in __root). */}
      <section
        aria-labelledby="cookie-consent-title"
        className="pointer-events-auto ml-auto max-h-[58vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4 fade-in duration-300 sm:max-h-[72vh] sm:p-6"
      >
        <h2 id="cookie-consent-title" className="text-lg font-semibold text-foreground">
          {t("We value your privacy", "Confidențialitatea ta contează")}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {t(
            "We use cookies to keep the site working, understand how it is used and improve your experience. You can accept all, reject non-essential, or choose which categories to allow.",
            "Folosim cookie-uri pentru ca site-ul să funcționeze, pentru a înțelege modul de utilizare și pentru a-ți îmbunătăți experiența. Poți accepta toate, respinge cele neesențiale sau alege ce categorii permiți.",
          )}{" "}
          <Link
            to="/cookies"
            className="rounded-sm text-primary underline underline-offset-4"
            onClick={close}
          >
            {t("Cookie Policy", "Politica de cookie-uri")}
          </Link>
        </p>

        {customize && (
          <div className="mt-5 space-y-4 border-t border-border pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="cookie-necessary" className="text-sm font-medium text-foreground">
                  {t("Strictly necessary", "Strict necesare")}
                </p>
                <p id="cookie-necessary-note" className="text-xs text-muted-foreground">
                  {t(
                    "Required for the site to function. Always on.",
                    "Necesare pentru funcționarea site-ului. Mereu active.",
                  )}
                </p>
              </div>
              <Switch
                checked
                disabled
                aria-readonly
                aria-labelledby="cookie-necessary"
                aria-describedby="cookie-necessary-note"
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="cookie-analytics" className="text-sm font-medium text-foreground">
                  {t("Analytics", "Analiză")}
                </p>
                <p id="cookie-analytics-note" className="text-xs text-muted-foreground">
                  {t(
                    "Help us understand how visitors use the site.",
                    "Ne ajută să înțelegem cum este folosit site-ul.",
                  )}
                </p>
              </div>
              <Switch
                ref={firstChoice}
                checked={analytics}
                onCheckedChange={setAnalytics}
                aria-labelledby="cookie-analytics"
                aria-describedby="cookie-analytics-note"
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="cookie-marketing" className="text-sm font-medium text-foreground">
                  {t("Marketing", "Marketing")}
                </p>
                <p id="cookie-marketing-note" className="text-xs text-muted-foreground">
                  {t(
                    "Used to deliver relevant content and measure campaigns.",
                    "Folosite pentru conținut relevant și măsurarea campaniilor.",
                  )}
                </p>
              </div>
              <Switch
                checked={marketing}
                onCheckedChange={setMarketing}
                aria-labelledby="cookie-marketing"
                aria-describedby="cookie-marketing-note"
              />
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button onClick={acceptAll} className="col-span-2">
            {t("Accept all", "Acceptă toate")}
          </Button>
          <Button variant="outline" onClick={rejectAll}>
            {t("Reject non-essential", "Respinge neesențiale")}
          </Button>
          {customize ? (
            <Button variant="secondary" onClick={savePreferences}>
              {t("Save preferences", "Salvează preferințele")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => {
                focusChoice.current = true;
                setCustomize(true);
              }}
            >
              {t("Customize", "Personalizează")}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

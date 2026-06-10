import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import {
  COOKIE_CONSENT_OPEN_EVENT,
  readConsent,
  saveConsent,
} from "./cookie-consent";

export function CookieConsent() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

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
    <div className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
        <h2 className="font-serif text-lg text-foreground">
          {t("We value your privacy", "Confidențialitatea ta contează")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t(
            "We use cookies to keep the site working, understand how it is used and improve your experience. You can accept all, reject non-essential, or choose which categories to allow.",
            "Folosim cookie-uri pentru ca site-ul să funcționeze, pentru a înțelege modul de utilizare și pentru a-ți îmbunătăți experiența. Poți accepta toate, respinge cele neesențiale sau alege ce categorii permiți.",
          )}{" "}
          <Link to="/cookies" className="text-primary underline-offset-4 hover:underline" onClick={close}>
            {t("Cookie Policy", "Politica de cookie-uri")}
          </Link>
        </p>

        {customize && (
          <div className="mt-5 space-y-4 border-t border-border pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("Strictly necessary", "Strict necesare")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("Required for the site to function. Always on.", "Necesare pentru funcționarea site-ului. Mereu active.")}
                </p>
              </div>
              <Switch checked disabled aria-readonly />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{t("Analytics", "Analiză")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("Help us understand how visitors use the site.", "Ne ajută să înțelegem cum este folosit site-ul.")}
                </p>
              </div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{t("Marketing", "Marketing")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("Used to deliver relevant content and measure campaigns.", "Folosite pentru conținut relevant și măsurarea campaniilor.")}
                </p>
              </div>
              <Switch checked={marketing} onCheckedChange={setMarketing} />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button onClick={acceptAll} className="sm:order-3">
            {t("Accept all", "Acceptă toate")}
          </Button>
          <Button variant="outline" onClick={rejectAll} className="sm:order-2">
            {t("Reject non-essential", "Respinge neesențiale")}
          </Button>
          {customize ? (
            <Button variant="secondary" onClick={savePreferences} className="sm:order-1 sm:mr-auto">
              {t("Save preferences", "Salvează preferințele")}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setCustomize(true)} className="sm:order-1 sm:mr-auto">
              {t("Customize", "Personalizează")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

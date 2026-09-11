import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

/**
 * Slim action bar that appears once the visitor has scrolled past the hero, so
 * the main action is always one tap away.
 */
export function StickyCta() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 transition-all duration-500 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-sm border border-border glass-panel px-5 py-3 shadow-lg">
        <p className="text-sm text-muted-foreground">
          {t(
            "Not sure where your infrastructure leaks time?",
            "Nu știi unde pierzi timp în infrastructură?",
          )}
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline" className="border-border glass-panel">
            <Link to="/contact">{t("Talk to us", "Vorbește cu noi")}</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-primary text-primary-foreground hover:opacity-90"
          >
            <Link to="/audit">
              {t("Free audit", "Audit gratuit")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

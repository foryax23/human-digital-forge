import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navLinks, Wordmark } from "./nav-data";
import { LanguageToggle } from "./LanguageToggle";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/i18n";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { t, lang } = useI18n();

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Wordmark />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="relative py-2 text-[0.82rem] font-medium text-muted-foreground transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-right after:scale-x-0 after:bg-teal after:transition-transform hover:text-foreground hover:after:origin-left hover:after:scale-x-100"
              activeProps={{ className: "text-foreground after:scale-x-100" }}
            >
              {lang === "ro" ? link.ro : link.en}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageToggle />
          {user ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">{t("Dashboard", "Panou")}</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">{t("Login", "Autentificare")}</Link>
            </Button>
          )}
          <Button asChild size="sm" className="bg-primary text-primary-foreground glow-soft hover:bg-primary/90">
            <Link to="/contact">
              {t("Start a project", "Începe un proiect")}
              <ArrowRight />
            </Link>
          </Button>
        </div>


        {/* Mobile */}
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[88vw] max-w-sm">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <Wordmark />
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-3 text-base text-foreground hover:bg-accent"
                    activeProps={{ className: "bg-accent font-medium" }}
                  >
                    {lang === "ro" ? link.ro : link.en}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 flex flex-col gap-3">
                <Button asChild variant="outline" onClick={() => setOpen(false)}>
                  <Link to={user ? "/dashboard" : "/login"}>{user ? t("Dashboard", "Panou") : t("Login", "Autentificare")}</Link>
                </Button>
                <Button asChild onClick={() => setOpen(false)}>
                  <Link to="/contact">{t("Start a project", "Începe un proiect")}</Link>
                </Button>
              </div>

            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

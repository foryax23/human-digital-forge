import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

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

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Wordmark />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageToggle />
          {user ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Login</Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link to="/contact">Start a project</Link>
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
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 flex flex-col gap-3">
                <Button asChild variant="outline" onClick={() => setOpen(false)}>
                  <Link to={user ? "/dashboard" : "/login"}>{user ? "Dashboard" : "Login"}</Link>
                </Button>
                <Button asChild onClick={() => setOpen(false)}>
                  <Link to="/contact">Start a project</Link>
                </Button>
              </div>

            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

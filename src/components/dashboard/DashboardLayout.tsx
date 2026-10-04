import { useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutGrid,
  FilePlus2,
  FolderKanban,
  MessagesSquare,
  Files,
  CalendarCheck,
  CreditCard,
  Settings,
  LogOut,
  Bell,
  Menu,
  ShieldCheck,
  Telescope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/components/auth/AuthProvider";
import { LOGO_NAV } from "@/components/landing/media";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type NavItem = {
  /** English, then Romanian (the client workspace follows the site language). */
  label: [en: string, ro: string];
  icon: typeof LayoutGrid;
  to:
    | "/dashboard"
    | "/dashboard/new-request"
    | "/dashboard/projects"
    | "/dashboard/messages"
    | "/dashboard/files"
    | "/dashboard/consultations"
    | "/dashboard/billing"
    | "/dashboard/settings"
    | "/dashboard/admin"
    | "/dashboard/research";
};

const navItems: NavItem[] = [
  { label: ["Overview", "Pe scurt"], icon: LayoutGrid, to: "/dashboard" },
  { label: ["New request", "Cerere nouă"], icon: FilePlus2, to: "/dashboard/new-request" },
  { label: ["My projects", "Proiectele mele"], icon: FolderKanban, to: "/dashboard/projects" },
  { label: ["Messages", "Mesaje"], icon: MessagesSquare, to: "/dashboard/messages" },
  { label: ["Files", "Fișiere"], icon: Files, to: "/dashboard/files" },
  { label: ["Consultations", "Discuții"], icon: CalendarCheck, to: "/dashboard/consultations" },
  { label: ["Billing", "Facturare"], icon: CreditCard, to: "/dashboard/billing" },
  { label: ["Settings", "Setări"], icon: Settings, to: "/dashboard/settings" },
];

function NavList({ onNavigate, onLogout }: { onNavigate?: () => void; onLogout: () => void }) {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  // Deep research is admin-only for now (plans assigned by an admin come later); the page
  // itself runs the same server access check as /scan/deep.
  const items: NavItem[] = isAdmin
    ? [
        ...navItems,
        {
          label: ["Deep Research", "Deep Research"],
          icon: Telescope,
          to: "/dashboard/research",
        },
        // The admin panel's own screens stay in English.
        { label: ["Admin panel", "Administrare"], icon: ShieldCheck, to: "/dashboard/admin" },
      ]
    : navItems;

  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label={t("Dashboard", "Contul meu")}>
      {items.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60",
            )}
          >
            <item.icon className="h-4 w-4" />
            {t(...item.label)}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          onLogout();
        }}
        className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
      >
        <LogOut className="h-4 w-4" />
        {t("Log out", "Ieșire")}
      </button>
    </nav>
  );
}

/** The nav's wordmark file on the dark sidebar; no tile, no glow. */
function SidebarBrand() {
  return (
    <Link to="/" className="flex items-center rounded-md px-2 py-1">
      <picture className="contents">
        <source type="image/webp" srcSet={LOGO_NAV.webp} />
        <img
          src={LOGO_NAV.png}
          alt="Vortex Hub"
          width={LOGO_NAV.width}
          height={LOGO_NAV.height}
          decoding="async"
          className="block h-8 w-auto"
        />
      </picture>
    </Link>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Client";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleLogout() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 bg-sidebar p-4 lg:flex">
        <SidebarBrand />
        <NavList onLogout={handleLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  aria-label={t("Open menu", "Deschide meniul")}
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-4">
                <SheetTitle className="sr-only">
                  {t("Dashboard navigation", "Navigare în cont")}
                </SheetTitle>
                <div className="flex h-full flex-col gap-6">
                  <SidebarBrand />
                  <NavList onNavigate={() => setOpen(false)} onLogout={handleLogout} />
                </div>
              </SheetContent>
            </Sheet>
            <p className="hidden text-sm text-muted-foreground sm:block">
              {t("Client workspace", "Spațiul tău de lucru")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              aria-label={t("Notifications", "Notificări")}
              className="relative"
            >
              <Bell />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
            </Button>
            <span
              className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
              title={displayName}
            >
              {initials || "VH"}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview", icon: LayoutGrid, active: true },
  { label: "New Request", icon: FilePlus2 },
  { label: "My Projects", icon: FolderKanban },
  { label: "Messages", icon: MessagesSquare },
  { label: "Files", icon: Files },
  { label: "Consultations", icon: CalendarCheck },
  { label: "Billing", icon: CreditCard },
  { label: "Settings", icon: Settings },
];

function NavList({ onNavigate, onLogout }: { onNavigate?: () => void; onLogout: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Dashboard">
      {navItems.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
            item.active
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60",
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          onLogout();
        }}
        className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </nav>
  );
}

function SidebarBrand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-2 py-1">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-gradient-brand text-sm font-semibold text-primary-foreground">
        V
      </span>
      <span className="font-serif text-lg text-sidebar-foreground">Vortex Hub</span>
    </Link>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 bg-sidebar p-4 lg:flex">
        <SidebarBrand />
        <NavList />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-4">
                <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
                <div className="flex h-full flex-col gap-6">
                  <SidebarBrand />
                  <NavList onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <p className="hidden text-sm text-muted-foreground sm:block">Client workspace</p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" aria-label="Notifications" className="relative">
              <Bell />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
            </Button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              EL
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

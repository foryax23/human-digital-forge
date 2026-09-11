import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function AuthLayout({
  heading,
  intro,
  children,
  footer,
}: {
  heading: string;
  intro: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-ink p-12 text-ink-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            V
          </span>
          <span className="font-serif text-xl">Vortex Hub</span>
        </Link>
        <div>
          <h2 className="max-w-sm text-3xl leading-tight">
            Digital work designed around your goals.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-ink-foreground/70">
            Submit projects, track progress and securely receive completed work in one calm client
            area.
          </p>
        </div>
        <p className="text-xs text-ink-foreground/50">© Vortex Hub. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              V
            </span>
            <span className="font-serif text-xl">Vortex Hub</span>
          </Link>
          <h1 className="text-3xl">{heading}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{intro}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
        </div>
      </div>
    </div>
  );
}

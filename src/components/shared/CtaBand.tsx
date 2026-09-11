import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function CtaBand({
  title,
  description,
  primaryLabel,
  primaryTo,
  secondaryLabel,
  secondaryTo,
}: {
  title: string;
  description?: string;
  primaryLabel: string;
  primaryTo: string;
  secondaryLabel?: string;
  secondaryTo?: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-sm bg-ink px-8 py-12 text-center text-ink-foreground sm:px-12">
        <h2 className="text-3xl leading-tight sm:text-4xl">{title}</h2>
        {description && (
          <p className="mx-auto mt-4 max-w-xl text-base text-ink-foreground/70">{description}</p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to={primaryTo}>{primaryLabel}</Link>
          </Button>
          {secondaryLabel && secondaryTo && (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-ink-foreground/30 text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
            >
              <Link to={secondaryTo}>{secondaryLabel}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/cinematic/Reveal";
import { Magnetic } from "@/components/cinematic/Magnetic";
import { useI18n } from "@/i18n";

export function FinalCTA() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden border-t border-border bg-ink text-ink-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-aurora opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-brand opacity-30 blur-3xl animate-glow-pulse"
      />
      <div className="relative mx-auto max-w-4xl px-4 py-28 text-center sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-4xl leading-tight sm:text-5xl lg:text-6xl">
            Have a digital project in mind?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-ink-foreground/70">
            Tell Vortex Hub what you would like to create, improve or automate.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Magnetic>
              <Button asChild size="lg" className="glow-soft">
                <Link to="/contact">
                  Start a project
                  <ArrowRight />
                </Link>
              </Button>
            </Magnetic>
            <Magnetic>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-ink-foreground/30 text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
              >
                <Link to="/consultancy">Book a consultation</Link>
              </Button>
            </Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

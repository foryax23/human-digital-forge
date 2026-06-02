import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="bg-ink text-ink-foreground">
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl leading-tight sm:text-4xl">Have a digital project in mind?</h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-ink-foreground/70">
          Tell Vortex Hub what you would like to create, improve or automate.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/contact">
              Start a project
              <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-ink-foreground/30 text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
          >
            <Link to="/consultancy">Book a consultation</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

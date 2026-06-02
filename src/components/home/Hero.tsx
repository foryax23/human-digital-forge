import { Link } from "@tanstack/react-router";
import { CheckCircle2, FileText, CalendarCheck, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/shared/SectionHeading";

function HeroVisual() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-gradient-brand opacity-15 blur-3xl"
      />
      <div className="relative rounded-2xl border border-border bg-card p-5 shadow-sm">
        {/* Project request card */}
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Project request
            </span>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              Proposal in preparation
            </span>
          </div>
          <h3 className="mt-3 font-sans text-base font-semibold">
            Website for local business
          </h3>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/5 rounded-full bg-gradient-brand" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Consultation booking card */}
          <div className="rounded-xl border border-border bg-background p-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/15 text-teal">
              <CalendarCheck className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-medium">Consultation</p>
            <p className="text-xs text-muted-foreground">14 June, 10:30</p>
          </div>

          {/* File delivery card */}
          <div className="rounded-xl border border-border bg-background p-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <p className="mt-3 truncate text-sm font-medium">Brand presentation.pdf</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </div>
        </div>

        {/* Workflow connection line */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-teal" />
          <span className="text-xs text-muted-foreground">
            Request → Proposal → Delivery, in one calm workflow
          </span>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
        <div>
          <Eyebrow>Digital services and AI consultancy</Eyebrow>
          <h1 className="mt-4 text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
            Digital work, built around real people.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Vortex Hub creates professional digital products, practical websites and thoughtful AI
            automations for individuals and businesses.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/contact">
                Start a project
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/consultancy">Book a consultation</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Clear communication. Secure delivery. Human support from idea to completion.
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

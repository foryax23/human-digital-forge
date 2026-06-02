import { Link } from "@tanstack/react-router";
import { Lightbulb, LayoutTemplate, Workflow, Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";

const sessions = [
  {
    icon: Lightbulb,
    title: "Digital Idea Session",
    description: "For individuals or early project ideas.",
  },
  {
    icon: LayoutTemplate,
    title: "Website Planning Session",
    description: "For clients preparing a new website or redesign.",
  },
  {
    icon: Workflow,
    title: "AI Workflow Review",
    description: "For businesses exploring practical automation.",
  },
];

export function ConsultationSection() {
  return (
    <section className="bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              title="Not sure what you need yet?"
              description="Book a one-to-one conversation to discuss your idea, website, digital product or possible AI workflow. You will receive clear advice on the next practical step."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/consultancy">Book a consultation</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/contact">Send an enquiry</Link>
              </Button>
            </div>

            {/* Booking placeholder */}
            <div className="mt-8 rounded-xl border border-dashed border-border bg-background p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-primary" />
                Booking calendar
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Live scheduling will appear here once the design is approved.
              </p>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {["Mon", "Tue", "Wed", "Thu"].map((day, i) => (
                  <div
                    key={day}
                    className={`rounded-lg border border-border px-2 py-3 text-center text-xs ${
                      i === 1 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <div className="font-medium">{day}</div>
                    <div className="mt-1">10:30</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid content-start gap-4">
            {sessions.map((session) => (
              <div
                key={session.title}
                className="flex items-start gap-4 rounded-xl border border-border bg-background p-6"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <session.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg">{session.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{session.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

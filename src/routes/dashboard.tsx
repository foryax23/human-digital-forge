import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  Download,
  FileText,
  MessagesSquare,
  Check,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Vortex Hub" },
      { name: "description", content: "Your Vortex Hub client workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

const timeline = [
  "Request submitted",
  "Brief reviewed",
  "Proposal accepted",
  "Work in progress",
  "Client review",
  "Completed",
];
const currentStep = 4; // index of "Client review"

function ProjectTimeline() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg">Project status</h2>
      <ol className="mt-6 space-y-4">
        {timeline.map((label, index) => {
          const done = index < currentStep;
          const current = index === currentStep;
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-medium ${
                  done
                    ? "bg-teal text-teal-foreground"
                    : current
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={`text-sm ${current ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl">Good afternoon, Elena.</h1>
        <p className="mt-1 text-muted-foreground">Here is what is happening with your projects.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Active project */}
          <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Website
              </span>
              <span className="text-xs text-muted-foreground">Step 4 of 6</span>
            </div>
            <h2 className="mt-4 text-2xl">Landing page for Studio Bloom</h2>
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
              <span>Status: <span className="text-foreground">Design review</span></span>
              <span>Next: <span className="text-foreground">Review homepage design</span></span>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[66%] rounded-full bg-gradient-brand" />
            </div>
            <Button className="mt-6">
              View project
              <ArrowRight />
            </Button>
          </div>

          {/* Consultation */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal/15 text-teal">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg">AI Workflow Review</h2>
            <p className="mt-1 text-sm text-muted-foreground">14 June, 10:30</p>
            <Button variant="outline" className="mt-6 w-full">
              View booking
            </Button>
          </div>

          {/* Recent file */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg">Homepage Concept V2.pdf</h2>
            <p className="mt-1 text-sm text-muted-foreground">Studio Bloom Website</p>
            <Button variant="outline" className="mt-6 w-full">
              <Download />
              Download
            </Button>
          </div>

          {/* Message */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal/15 text-teal">
              <MessagesSquare className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm font-medium">From Vortex Hub</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your revised homepage layout is ready for review.
            </p>
            <Button variant="outline" className="mt-6 w-full">
              Open conversation
            </Button>
          </div>

          {/* Timeline */}
          <div className="lg:col-span-1">
            <ProjectTimeline />
          </div>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          This dashboard shows sample data for design preview only.{" "}
          <Link to="/" className="text-primary underline-offset-4 hover:underline">
            Back to website
          </Link>
        </p>
      </div>
    </DashboardLayout>
  );
}

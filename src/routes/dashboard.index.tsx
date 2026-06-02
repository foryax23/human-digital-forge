import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  FilePlus2,
  FileText,
  Loader2,
  MessagesSquare,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  TIMELINE_STEPS,
  useDashboardData,
  type ProjectRow,
} from "@/hooks/use-dashboard-data";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(value: string | null) {
  if (!value) return "To be scheduled";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProjectTimeline({ currentStep }: { currentStep: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg">Project status</h2>
      <ol className="mt-6 space-y-4">
        {TIMELINE_STEPS.map((label, index) => {
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

function ActiveProjectCard({ project }: { project: ProjectRow }) {
  const total = TIMELINE_STEPS.length - 1;
  const pct = Math.round((Math.min(project.current_step, total) / total) * 100);
  return (
    <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">
          {project.service_type?.replace("-", " ") || "Project"}
        </span>
        <span className="text-xs text-muted-foreground">
          Step {Math.min(project.current_step + 1, TIMELINE_STEPS.length)} of {TIMELINE_STEPS.length}
        </span>
      </div>
      <h2 className="mt-4 text-2xl">{project.title}</h2>
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
        <span>
          Status: <span className="text-foreground">{project.status}</span>
        </span>
        {project.next_action && (
          <span>
            Next: <span className="text-foreground">{project.next_action}</span>
          </span>
        )}
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center lg:col-span-3">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
        <FilePlus2 className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-2xl">No projects yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Start your first request and we will guide it through brief, proposal and delivery — all
        tracked right here in your workspace.
      </p>
      <Button asChild className="mt-6">
        <Link to="/dashboard/new-request">
          Start a new request
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

function DashboardOverview() {
  const { profile, user } = useAuth();
  const { data, loading, error } = useDashboardData(user?.id);
  const firstName = (profile?.full_name || user?.email?.split("@")[0] || "there").split(" ")[0];

  const activeProject = data?.projects[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">
            {getGreeting()}, {firstName}.
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here is what is happening with your projects.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/new-request">
            <FilePlus2 />
            New request
          </Link>
        </Button>
      </div>

      {loading && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {!activeProject && <EmptyState />}

          {activeProject && <ActiveProjectCard project={activeProject} />}

          {activeProject && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal/15 text-teal">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg">
                {data.consultation?.title ?? "No consultation booked"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.consultation
                  ? formatDate(data.consultation.scheduled_at)
                  : "Book a session to review your goals."}
              </p>
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link to="/consultancy">
                  {data.consultation ? "View booking" : "Book a consultation"}
                </Link>
              </Button>
            </div>
          )}

          {activeProject && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg">{data.file?.name ?? "No files yet"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.file?.description ?? "Delivered files will appear here."}
              </p>
            </div>
          )}

          {activeProject && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal/15 text-teal">
                <MessagesSquare className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm font-medium">
                {data.message ? "From Vortex Hub" : "No messages yet"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.message?.body ?? "Updates from your team will show up here."}
              </p>
            </div>
          )}

          {activeProject && (
            <div className="lg:col-span-1">
              <ProjectTimeline currentStep={activeProject.current_step} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

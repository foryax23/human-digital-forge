import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FilePlus2, FolderKanban, Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { TIMELINE_STEPS, type ProjectRow } from "@/hooks/use-dashboard-data";

export const Route = createFileRoute("/dashboard/projects")({
  component: ProjectsPage,
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ProjectCard({ project }: { project: ProjectRow }) {
  const { t } = useI18n();
  const total = TIMELINE_STEPS.length - 1;
  const pct = Math.round((Math.min(project.current_step, total) / total) * 100);
  return (
    <div className="rounded-sm border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">
          {project.service_type?.replace("-", " ") || t("Project", "Proiect")}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("Started", "Început")} {formatDate(project.created_at)}
        </span>
      </div>
      <h2 className="mt-4 text-xl">{project.title}</h2>
      <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
        <span>
          {t("Status", "Stare")}: <span className="text-foreground">{project.status}</span>
        </span>
        {project.next_action && (
          <span>
            {t("Next", "Următor")}: <span className="text-foreground">{project.next_action}</span>
          </span>
        )}
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("Step", "Pasul")} {Math.min(project.current_step + 1, TIMELINE_STEPS.length)} {t("of", "din")} {TIMELINE_STEPS.length}
      </p>
    </div>
  );
}

function ProjectsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("projects")
        .select("id, title, service_type, status, current_step, next_action, created_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (err) {
        console.error("[projects] load failed", err);
        setError(t(
          "We couldn't load your projects. Please refresh to try again.",
          "Nu am putut încărca proiectele tale. Te rugăm să reîmprospătezi pagina.",
        ));
      } else {
        setProjects((data as ProjectRow[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">{t("My projects", "Proiectele mele")}</h1>
          <p className="mt-1 text-muted-foreground">
            {t(
              "Every request you have started, tracked from brief to delivery.",
              "Fiecare cerere pe care ai început-o, urmărită de la brief la livrare.",
            )}
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/new-request">
            <FilePlus2 />
            {t("New request", "Cerere nouă")}
          </Link>
        </Button>
      </div>

      {loading && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="mt-8 rounded-sm border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="mt-8 rounded-sm border border-dashed border-border bg-card p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-sm bg-primary/10 text-primary">
            <FolderKanban className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-2xl">{t("No projects yet", "Niciun proiect încă")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t(
              "Start your first request and we will guide it through brief, proposal and delivery.",
              "Începe prima ta cerere și o vom ghida prin brief, propunere și livrare.",
            )}
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard/new-request">
              {t("Start a new request", "Începe o cerere nouă")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

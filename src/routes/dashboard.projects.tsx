import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyPanel, LoadError, Loading, PageHeader } from "@/components/dashboard/PageHeader";
import {
  STEP_LABELS,
  formatDay,
  projectStatusLabel,
  serviceLabel,
  stepLabel,
} from "@/components/dashboard/format";
import { ButtonLink, Panel, PanelBody, Tag } from "@/components/system";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectRow } from "@/hooks/use-dashboard-data";

export const Route = createFileRoute("/dashboard/projects")({
  component: ProjectsPage,
});

function ProjectCard({ project }: { project: ProjectRow }) {
  const { t, lang } = useI18n();
  const last = STEP_LABELS.length - 1;
  const step = Math.max(0, Math.min(project.current_step, last));
  const pct = Math.round((step / last) * 100);
  const service = serviceLabel(project.service_type, lang);
  return (
    <Panel as="article">
      <PanelBody>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {service ? <Tag>{service}</Tag> : <span />}
          <span className="type-micro text-fg-3">
            {t("Started", "Început pe")} {formatDay(project.created_at, lang)}
          </span>
        </div>
        <h2 className="type-h4 mt-3 text-balance text-fg">{project.title}</h2>
        <p className="type-body-sm mt-1.5 text-fg-2">
          <span className="text-fg-3">{t("Status", "Stare")}:</span>{" "}
          {projectStatusLabel(project.status, lang)}
        </p>
        {project.next_action ? (
          <p className="type-body-sm mt-1 text-fg-2">
            <span className="text-fg-3">{t("Next", "Urmează")}:</span> {project.next_action}
          </p>
        ) : null}
        <div className="mt-4 h-0.5 w-full overflow-hidden bg-line-2" aria-hidden>
          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="type-micro mt-2 text-fg-3">
          {t(
            `Step ${step + 1} of ${STEP_LABELS.length}: ${stepLabel(step, lang)}`,
            `Pasul ${step + 1} din ${STEP_LABELS.length}: ${stepLabel(step, lang)}`,
          )}
        </p>
      </PanelBody>
    </Panel>
  );
}

function ProjectsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, service_type, status, current_step, next_action, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) console.error("[projects] load failed", error);
      setFailed(Boolean(error));
      setProjects((data as ProjectRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={t("My projects", "Proiectele mele")}
        lead={t(
          "Every request you sent, from the first review to delivery.",
          "Fiecare cerere trimisă, de la prima analiză până la livrare.",
        )}
        actions={
          <ButtonLink to="/dashboard/new-request" size="md">
            {t("New request", "Cerere nouă")}
          </ButtonLink>
        }
      />

      {loading ? <Loading label={t("Loading projects", "Se încarcă proiectele")} /> : null}

      {!loading && failed ? (
        <LoadError>
          {t(
            "We couldn't load your projects. Refresh the page to try again.",
            "Nu am putut încărca proiectele. Reîncarcă pagina ca să încerci din nou.",
          )}
        </LoadError>
      ) : null}

      {!loading && !failed && projects.length === 0 ? (
        <EmptyPanel
          title={t("No projects yet", "Niciun proiect încă")}
          action={
            <ButtonLink to="/dashboard/new-request" variant="secondary" size="md">
              {t("Send a request", "Trimite o cerere")}
            </ButtonLink>
          }
        >
          {t(
            "A request becomes a project here once you send it.",
            "O cerere devine proiect aici imediat ce o trimiți.",
          )}
        </EmptyPanel>
      ) : null}

      {!loading && !failed && projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

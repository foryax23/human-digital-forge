import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/components/auth/AuthProvider";
import { ClientPlanCard } from "@/components/dashboard/ClientPlanCard";
import { EmptyPanel, LoadError, Loading, PageHeader } from "@/components/dashboard/PageHeader";
import {
  STEP_LABELS,
  consultationStatus,
  formatDateTime,
  formatDay,
  projectStatusLabel,
  serviceLabel,
  stepLabel,
} from "@/components/dashboard/format";
import {
  ButtonLink,
  Panel,
  PanelBody,
  PanelDivider,
  PanelHeader,
  Status,
  Tag,
} from "@/components/system";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardData, type ProjectRow } from "@/hooks/use-dashboard-data";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

type T = (en: string, ro: string) => string;

function greeting(t: T) {
  const h = new Date().getHours();
  if (h < 12) return t("Good morning", "Bună dimineața");
  if (h < 18) return t("Good afternoon", "Bună ziua");
  return t("Good evening", "Bună seara");
}

type ConsultationLite = { id: string; title: string; scheduled_at: string | null; status: string };
type TeamMessage = { id: string; body: string; created_at: string };

/**
 * The next consultation (the soonest one still ahead, else the newest request) and the
 * team's latest message. The shared dashboard hook reads the oldest consultation and the
 * latest message of either side, which is not what this page needs.
 */
function useOverviewExtras(userId: string | undefined) {
  const [state, setState] = useState<{
    consultation: ConsultationLite | null;
    message: TeamMessage | null;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    void (async () => {
      const [consultations, messages] = await Promise.all([
        supabase
          .from("consultations")
          .select("id, title, scheduled_at, status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("messages")
          .select("id, body, created_at")
          .eq("user_id", userId)
          .eq("sender", "team")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      if (!live) return;
      const rows = (consultations.data as ConsultationLite[] | null) ?? [];
      const now = Date.now();
      const open = rows.filter((r) => !/^cancel/i.test(r.status));
      const ahead = open
        .filter((r) => r.scheduled_at && new Date(r.scheduled_at).getTime() >= now)
        .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
      const requested = open.find((r) => r.status === "requested") ?? null;
      setState({
        consultation: ahead[0] ?? requested,
        message: ((messages.data as TeamMessage[] | null) ?? [])[0] ?? null,
      });
    })();
    return () => {
      live = false;
    };
  }, [userId]);

  return state;
}

function StepList({ current }: { current: number }) {
  const { lang } = useI18n();
  return (
    <ol className="grid gap-2">
      {STEP_LABELS.map((_, index) => {
        const done = index < current;
        const now = index === current;
        return (
          <li key={index} className="flex items-center gap-3">
            <span className="type-pnum w-4 shrink-0 text-right text-[0.8125rem] text-fg-3">
              {index + 1}
            </span>
            <Status tone={done ? "ok" : now ? "brand" : "unverified"}>
              <span className={now ? "text-fg" : done ? "text-fg-2" : "text-fg-3"}>
                {stepLabel(index, lang)}
              </span>
            </Status>
          </li>
        );
      })}
    </ol>
  );
}

function ProjectPanel({ project }: { project: ProjectRow }) {
  const { t, lang } = useI18n();
  const last = STEP_LABELS.length - 1;
  const step = Math.max(0, Math.min(project.current_step, last));
  const pct = Math.round((step / last) * 100);
  const service = serviceLabel(project.service_type, lang);
  const next =
    project.next_action ??
    (step === 0
      ? t(
          "We are reading your request and will come back with questions or an offer.",
          "Citim cererea și revenim cu întrebări sau cu o ofertă.",
        )
      : null);

  return (
    <Panel as="section" aria-label={t("Current project", "Proiectul curent")}>
      <PanelBody className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem] md:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {service ? <Tag>{service}</Tag> : null}
            <span className="type-micro text-fg-3">
              {t("Started", "Început pe")} {formatDay(project.created_at, lang)}
            </span>
          </div>
          <h2 className="type-h3 mt-3 text-balance text-fg">{project.title}</h2>
          <dl className="type-body-sm mt-3 grid gap-1.5 text-fg-2">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-fg-3">{t("Status", "Stare")}:</dt>
              <dd>{projectStatusLabel(project.status, lang)}</dd>
            </div>
            {next ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-fg-3">{t("Next", "Urmează")}:</dt>
                <dd className="min-w-0">{next}</dd>
              </div>
            ) : null}
          </dl>
          <div
            className="mt-5 h-0.5 w-full overflow-hidden bg-line-2"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEP_LABELS.length}
            aria-valuenow={step + 1}
            aria-label={t(
              `Step ${step + 1} of ${STEP_LABELS.length}`,
              `Pasul ${step + 1} din ${STEP_LABELS.length}`,
            )}
          >
            <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
          <p className="type-micro mt-2 text-fg-3">
            {t(
              `Step ${step + 1} of ${STEP_LABELS.length}`,
              `Pasul ${step + 1} din ${STEP_LABELS.length}`,
            )}
          </p>
          <ButtonLink to="/dashboard/projects" variant="link" size="sm" className="mt-4">
            {t("All projects", "Toate proiectele")}
          </ButtonLink>
        </div>
        <StepList current={step} />
      </PanelBody>
    </Panel>
  );
}

function Row({
  label,
  title,
  sub,
  link,
}: {
  label: string;
  title: string;
  sub?: string | null;
  link: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4 sm:px-5">
      <p className="type-label text-fg-3">{label}</p>
      <div className="min-w-0">
        <p className="type-body-sm line-clamp-2 text-fg">{title}</p>
        {sub ? <p className="type-micro mt-0.5 text-fg-3">{sub}</p> : null}
      </div>
      <div className="sm:justify-self-end">{link}</div>
    </div>
  );
}

function DashboardOverview() {
  const { t, lang } = useI18n();
  const { profile, user } = useAuth();
  const { data, loading, error } = useDashboardData(user?.id);
  const extras = useOverviewExtras(user?.id);
  const firstName = (profile?.full_name || user?.email?.split("@")[0] || "").split(" ")[0];
  const project = data?.projects[0] ?? null;
  const consultation = extras?.consultation ?? null;
  const message = extras?.message ?? null;
  const file = data?.file ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={firstName ? `${greeting(t)}, ${firstName}.` : `${greeting(t)}.`}
        lead={t(
          "Your projects, consultations and files in one place.",
          "Proiectele, consultațiile și fișierele tale, într-un singur loc.",
        )}
        actions={
          <ButtonLink to="/dashboard/new-request" size="md">
            {t("New request", "Cerere nouă")}
          </ButtonLink>
        }
      />

      <ClientPlanCard />

      {loading ? (
        <Loading label={t("Loading your workspace", "Se încarcă datele contului")} />
      ) : null}

      {!loading && error ? (
        <LoadError>
          {t(
            "We couldn't load your workspace. Refresh the page to try again.",
            "Nu am putut încărca datele contului. Reîncarcă pagina ca să încerci din nou.",
          )}
        </LoadError>
      ) : null}

      {!loading && !error && data ? (
        <>
          {project ? (
            <ProjectPanel project={project} />
          ) : (
            <EmptyPanel
              title={t("No projects yet", "Niciun proiect încă")}
              action={
                <ButtonLink to="/dashboard/new-request" variant="secondary" size="md">
                  {t("Send a request", "Trimite o cerere")}
                </ButtonLink>
              }
            >
              {t(
                "Tell us what you need. You follow the request here: review, offer, work, delivery.",
                "Spune-ne de ce ai nevoie. Urmărești cererea aici: analiză, ofertă, lucru, livrare.",
              )}
            </EmptyPanel>
          )}

          <Panel as="section" aria-labelledby="overview-latest">
            <PanelHeader titleAs="h2" titleId="overview-latest" title={t("Latest", "Noutăți")} />
            <PanelDivider />
            <Row
              label={t("Consultation", "Consultație")}
              title={
                consultation?.title ?? t("No consultation booked", "Nicio consultație programată")
              }
              sub={
                consultation
                  ? [
                      consultationStatus(consultation.status, lang).label,
                      consultation.scheduled_at
                        ? formatDateTime(consultation.scheduled_at, lang)
                        : t("time to be agreed", "ora rămâne de stabilit"),
                    ].join(" · ")
                  : null
              }
              link={
                <ButtonLink to="/dashboard/consultations" variant="link" size="sm">
                  {consultation ? t("Details", "Detalii") : t("Request one", "Cere o consultație")}
                </ButtonLink>
              }
            />
            <PanelDivider />
            <Row
              label={t("From the team", "De la echipă")}
              title={message?.body ?? t("No messages yet", "Niciun mesaj încă")}
              sub={message ? formatDay(message.created_at, lang) : null}
              link={
                <ButtonLink to="/dashboard/messages" variant="link" size="sm">
                  {t("Messages", "Mesaje")}
                </ButtonLink>
              }
            />
            <PanelDivider />
            <Row
              label={t("Latest file", "Ultimul fișier")}
              title={file?.name ?? t("No files yet", "Niciun fișier încă")}
              sub={file ? formatDay(file.created_at, lang) : null}
              link={
                <ButtonLink to="/dashboard/files" variant="link" size="sm">
                  {t("Files", "Fișiere")}
                </ButtonLink>
              }
            />
          </Panel>
        </>
      ) : null}
    </div>
  );
}

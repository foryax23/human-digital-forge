import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import { consultationRequest } from "@/components/dashboard/account-requests";
import { useTeamRequest } from "@/components/dashboard/team-request";
import { TurnstileField } from "@/components/forms/TurnstileField";
import { EmptyPanel, LoadError, Loading, PageHeader } from "@/components/dashboard/PageHeader";
import { consultationStatus, formatDateTime } from "@/components/dashboard/format";
import { Button, Field, Panel, PanelDivider, Status } from "@/components/system";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

/*
 * Consultations. A request goes to the team through the contact pipeline (the admin panel's
 * enquiries, where the team already looks; before this nothing showed a consultation row to
 * anyone) and is kept as a "requested" row so the client sees it here. The team confirms the
 * time; status and time are the team's to change (drizzle/pending/client_rls_hardening.sql).
 */

export const Route = createFileRoute("/dashboard/consultations")({
  component: ConsultationsPage,
});

interface ConsultationItem {
  id: string;
  title: string;
  scheduled_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

function ConsultationsPage() {
  const { t, lang } = useI18n();
  const { user, profile } = useAuth();
  const { submit, turnstile } = useTeamRequest();
  const [items, setItems] = useState<ConsultationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [preferred, setPreferred] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadItems() {
    if (!user) return;
    const { data, error } = await supabase
      .from("consultations")
      .select("id, title, scheduled_at, status, notes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) console.error("[consultations] load failed", error);
    setFailed(Boolean(error));
    setItems((data as ConsultationItem[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleBook(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !title.trim()) return;
    const when = preferred ? new Date(preferred) : null;
    const whenOk = when && !Number.isNaN(when.getTime()) ? when : null;
    const payload = consultationRequest(
      {
        id: user.id,
        email: user.email,
        fullName: profile?.full_name,
        company: profile?.company,
        clientType: profile?.client_type,
      },
      {
        title: title.trim().slice(0, 200),
        preferred: whenOk ? formatDateTime(whenOk.toISOString(), "ro") : null,
        notes: notes.trim().slice(0, 2000) || null,
      },
    );
    if (!payload) return;
    setFormError(null);
    setSubmitting(true);
    // The team's inbox first (the admin panel's enquiries, and the team alert once it is on):
    // without it the request would reach nobody.
    const sent = await submit(payload);
    if (!sent.ok) {
      setFormError(sent.message);
      setSubmitting(false);
      return;
    }
    // The client's own record; the team already has the request if this fails.
    const { error } = await supabase.from("consultations").insert({
      user_id: user.id,
      title: title.trim().slice(0, 200),
      scheduled_at: whenOk ? whenOk.toISOString() : null,
      notes: notes.trim().slice(0, 2000) || null,
      status: "requested",
    });
    if (error) console.error("[consultations] record failed", error);
    toast.success(
      t(
        "Request sent. We will write to you to confirm the time.",
        "Cererea a fost trimisă. Îți scriem ca să confirmăm ora.",
      ),
    );
    setSubmitting(false);
    setOpen(false);
    setTitle("");
    setPreferred("");
    setNotes("");
    await loadItems();
  }

  const bookButton = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="md">{t("Request a consultation", "Cere o consultație")}</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleBook}>
          <DialogHeader>
            <DialogTitle>{t("Request a consultation", "Cere o consultație")}</DialogTitle>
            <DialogDescription>
              {t(
                "Tell us the topic and a time that suits you. We confirm the time by e-mail.",
                "Spune-ne subiectul și o oră care ți se potrivește. Confirmăm ora pe e-mail.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <Field label={t("Topic", "Subiect")}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("e.g. Booking automation", "ex. Automatizarea programărilor")}
                maxLength={200}
                required
                className="h-10"
              />
            </Field>
            <Field label={t("Preferred date and time", "Data și ora preferate")} optional>
              <Input
                type="datetime-local"
                value={preferred}
                onChange={(e) => setPreferred(e.target.value)}
                className="h-10"
              />
            </Field>
            <Field label={t("Anything we should know", "Ce ar trebui să știm")} optional>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("Goals, questions, context", "Obiective, întrebări, context")}
                rows={3}
                maxLength={2000}
              />
            </Field>
            <TurnstileField ref={turnstile} action="contact" />
            {formError ? (
              <p role="alert" className="type-body-sm text-bad">
                {formError}
              </p>
            ) : null}
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="submit"
              size="lg"
              loading={submitting}
              disabled={submitting || !title.trim()}
            >
              {t("Send the request", "Trimite cererea")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("Consultations", "Consultații")}
        lead={t(
          "One-to-one calls with the Vortex Hub team. You ask, we confirm the time.",
          "Discuții unu la unu cu echipa Vortex Hub. Tu ceri, noi confirmăm ora.",
        )}
        actions={bookButton}
      />

      {loading ? <Loading label={t("Loading consultations", "Se încarcă consultațiile")} /> : null}

      {!loading && failed ? (
        <LoadError>
          {t(
            "We couldn't load your consultations. Refresh the page to try again.",
            "Nu am putut încărca consultațiile. Reîncarcă pagina ca să încerci din nou.",
          )}
        </LoadError>
      ) : null}

      {!loading && !failed && items.length === 0 ? (
        <EmptyPanel title={t("No consultations yet", "Nicio consultație încă")}>
          {t(
            "Ask for a call about your goals, a project or an idea. The first call is free.",
            "Cere o discuție despre obiective, un proiect sau o idee. Prima discuție este gratuită.",
          )}
        </EmptyPanel>
      ) : null}

      {!loading && !failed && items.length > 0 ? (
        <Panel as="section" aria-label={t("Your consultations", "Consultațiile tale")}>
          <ul>
            {items.map((item, index) => {
              const status = consultationStatus(item.status, lang);
              const requested = item.status === "requested";
              return (
                <li key={item.id}>
                  {index > 0 ? <PanelDivider /> : null}
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4 sm:px-5">
                    <div className="min-w-0">
                      <h2 className="type-h4 text-fg">{item.title}</h2>
                      <p className="type-body-sm mt-0.5 text-fg-2">
                        {item.scheduled_at
                          ? `${requested ? t("Proposed: ", "Propusă: ") : ""}${formatDateTime(item.scheduled_at, lang)}`
                          : t("Time to be agreed", "Ora rămâne de stabilit")}
                      </p>
                      {item.notes ? (
                        <p className="type-micro mt-1 whitespace-pre-wrap text-fg-3">
                          {item.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="sm:pt-0.5">
                      <Status tone={status.tone}>{status.label}</Status>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

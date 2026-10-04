import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button, ButtonLink, Field, Panel, PanelBody } from "@/components/system";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/new-request")({
  component: NewRequestPage,
});

function NewRequestPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [service, setService] = useState<string>("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    if (!title || !description) return;

    setSubmitting(true);
    // Status, step and next action are the team's: the row starts with the table's defaults
    // ("Request submitted", step 0, no next action), and drizzle/pending/client_rls_hardening.sql
    // makes the database enforce that.
    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      title: title.slice(0, 200),
      description: description.slice(0, 4000),
      service_type: service || null,
      budget:
        String(form.get("budget") || "")
          .trim()
          .slice(0, 120) || null,
      timeline:
        String(form.get("timeline") || "")
          .trim()
          .slice(0, 120) || null,
    });
    setSubmitting(false);

    if (error) {
      console.error("[new-request] insert failed", error);
      toast.error(
        t(
          "Your request was not sent. Please try again.",
          "Cererea nu a fost trimisă. Încearcă din nou.",
        ),
      );
      return;
    }

    toast.success(
      t(
        "Request sent. You can follow it in My projects.",
        "Cererea a fost trimisă. O urmărești în Proiectele mele.",
      ),
    );
    navigate({ to: "/dashboard/projects" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ButtonLink
        to="/dashboard"
        variant="ghost"
        size="sm"
        icon={<ArrowLeft aria-hidden />}
        className="-ml-2.5"
      >
        {t("Back", "Înapoi")}
      </ButtonLink>

      <PageHeader
        title={t("New request", "Cerere nouă")}
        lead={t(
          "Tell us what you need. We read it and come back with questions or an offer.",
          "Spune-ne de ce ai nevoie. Citim cererea și revenim cu întrebări sau cu o ofertă.",
        )}
      />

      <Panel>
        <PanelBody>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Field label={t("Project title", "Titlul proiectului")}>
              <Input
                name="title"
                required
                maxLength={200}
                placeholder={t("e.g. New company website", "ex. Site nou pentru firmă")}
              />
            </Field>

            <Field id="request-service" label={t("Service", "Serviciu")} optional>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger id="request-service">
                  <SelectValue placeholder={t("Choose one", "Alege unul")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">{t("Website", "Site")}</SelectItem>
                  <SelectItem value="digital-product">
                    {t("Digital products", "Produse digitale")}
                  </SelectItem>
                  <SelectItem value="ai-automation">
                    {t("AI automation", "Automatizare AI")}
                  </SelectItem>
                  <SelectItem value="consultancy">{t("Consultancy", "Consultanță")}</SelectItem>
                  <SelectItem value="not-sure">{t("Not sure yet", "Nu știu încă")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={t("What do you need?", "De ce ai nevoie?")}
              hint={t(
                "The problem, who it is for and anything that already exists.",
                "Problema, pentru cine este și ce există deja.",
              )}
            >
              <Textarea name="description" rows={5} required maxLength={4000} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Approximate budget", "Buget aproximativ")} optional>
                <Input
                  name="budget"
                  maxLength={120}
                  placeholder={t("e.g. 4,500 to 7,500 RON", "de exemplu 4.500–7.500 lei")}
                />
              </Field>
              <Field label={t("When do you need it?", "Până când îți trebuie?")} optional>
                <Input
                  name="timeline"
                  maxLength={120}
                  placeholder={t("e.g. within 4 weeks", "ex. în 4 săptămâni")}
                />
              </Field>
            </div>

            <div>
              <Button type="submit" size="lg" loading={submitting} disabled={submitting}>
                {t("Send the request", "Trimite cererea")}
              </Button>
            </div>
          </form>
        </PanelBody>
      </Panel>
    </div>
  );
}

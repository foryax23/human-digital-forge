import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      title,
      description,
      service_type: service || null,
      budget: String(form.get("budget") || "").trim() || null,
      timeline: String(form.get("timeline") || "").trim() || null,
      status: "Request submitted",
      current_step: 0,
      next_action: "We will review your brief shortly",
    });
    setSubmitting(false);

    if (error) {
      console.error("[new-request] insert failed", error);
      toast.error(t("Could not submit your request. Please try again.", "Nu am putut trimite cererea ta. Te rugăm să încerci din nou."));
      return;
    }

    toast.success(t("Request submitted — we'll be in touch soon.", "Cerere trimisă — te vom contacta în curând."));
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/dashboard">
          <ArrowLeft />
          {t("Back to overview", "Înapoi la prezentare generală")}
        </Link>
      </Button>

      <h1 className="text-3xl">{t("Start a new request", "Începe o cerere nouă")}</h1>
      <p className="mt-1 text-muted-foreground">
        {t(
          "Tell us what you need and we will turn it into a clear, tracked project.",
          "Spune-ne de ce ai nevoie și vom transforma cererea într-un proiect clar și urmărit.",
        )}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">{t("Project title", "Titlul proiectului")}</Label>
          <Input id="title" name="title" required placeholder={t("e.g. New brand website", "ex. Site nou pentru brand")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="service">{t("Service needed", "Serviciu necesar")}</Label>
          <Select value={service} onValueChange={setService}>
            <SelectTrigger id="service">
              <SelectValue placeholder={t("Select one", "Selectează una")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="digital-product">{t("Digital Product", "Produs digital")}</SelectItem>
              <SelectItem value="website">{t("Website", "Website")}</SelectItem>
              <SelectItem value="ai-automation">{t("AI Automation", "Automatizare AI")}</SelectItem>
              <SelectItem value="consultancy">{t("Consultancy", "Consultanță")}</SelectItem>
              <SelectItem value="not-sure">{t("Not sure yet", "Nu știu încă")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t("Brief description", "Descriere succintă")}</Label>
          <Textarea id="description" name="description" rows={5} required />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="budget">{t("Approximate budget (optional)", "Buget aproximativ (opțional)")}</Label>
            <Input id="budget" name="budget" placeholder={t("e.g. €500–€1,500", "ex. €500–€1.500")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeline">{t("Preferred timeline (optional)", "Interval preferat (opțional)")}</Label>
            <Input id="timeline" name="timeline" placeholder={t("e.g. Within 4 weeks", "ex. În 4 săptămâni")} />
          </div>
        </div>

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {t("Submit request", "Trimite cererea")}
        </Button>
      </form>
    </div>
  );
}

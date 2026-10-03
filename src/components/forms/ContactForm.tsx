import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { submitContactEnquiry } from "@/lib/contact.functions";
import { Button, Field } from "@/components/system";
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

/** `prefill` seeds the description, e.g. a Vortex Scan request from the homepage search. */
export function ContactForm({ prefill }: { prefill?: string } = {}) {
  const { t } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await submitContactEnquiry({
        data: {
          fullName: String(form.get("fullName") || "").trim(),
          email: String(form.get("email") || "").trim(),
          clientType: String(form.get("clientType") || "") || null,
          service: String(form.get("service") || "") || null,
          description: String(form.get("description") || "").trim(),
          budget: String(form.get("budget") || "").trim() || null,
          timeline: String(form.get("timeline") || "").trim() || null,
        },
      });
      setSubmitted(true);
    } catch (error) {
      console.error("[contact] submit failed", error);
      toast.error(
        t(
          "Your message did not go through. Please try again, or write to hello@vortexhub.ro.",
          "Mesajul nu a ajuns. Încearcă din nou sau scrie-ne la hello@vortexhub.ro.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div role="status" className="border-t border-rule pt-6">
        <h2 className="type-h3 text-fg">{t("Thank you, we have it.", "Mulțumim, am primit-o.")}</h2>
        <p className="type-body mt-2 max-w-[60ch] text-fg-2">
          {t(
            "We read every request and reply with a practical next step, usually within two working days.",
            "Citim fiecare cerere și răspundem cu un pas practic următor, de obicei în două zile lucrătoare.",
          )}
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => setSubmitted(false)}>
          {t("Send another request", "Trimite altă cerere")}
        </Button>
      </div>
    );
  }

  // Selects portal outside the page wrapper, so they opt into the night tokens themselves.
  const menuClass = "cinematic";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Full name", "Nume complet")}>
          <Input id="fullName" name="fullName" required autoComplete="name" />
        </Field>
        <Field label={t("Email address", "Adresă de e-mail")}>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="clientType" label={t("You are", "Ești")} optional>
          <Select name="clientType">
            <SelectTrigger id="clientType">
              <SelectValue placeholder={t("Choose one", "Alege")} />
            </SelectTrigger>
            <SelectContent className={menuClass}>
              <SelectItem value="individual">{t("A private person", "Persoană fizică")}</SelectItem>
              <SelectItem value="business">{t("A business", "Firmă")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field id="service" label={t("Service", "Serviciul")} optional>
          <Select name="service">
            <SelectTrigger id="service">
              <SelectValue placeholder={t("Choose one", "Alege")} />
            </SelectTrigger>
            <SelectContent className={menuClass}>
              <SelectItem value="website">{t("Website", "Site web")}</SelectItem>
              <SelectItem value="ai-automation">{t("AI automation", "Automatizare AI")}</SelectItem>
              <SelectItem value="digital-product">
                {t("Digital product", "Produs digital")}
              </SelectItem>
              <SelectItem value="consultancy">{t("Consultancy", "Consultanță")}</SelectItem>
              <SelectItem value="not-sure">{t("Not sure yet", "Nu știu încă")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label={t("What do you need?", "De ce ai nevoie?")}>
        <Textarea id="description" name="description" rows={5} required defaultValue={prefill} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Approximate budget", "Buget aproximativ")} optional>
          <Input
            id="budget"
            name="budget"
            placeholder={t("e.g. 2,500 to 7,500 RON", "de exemplu 2.500–7.500 lei")}
          />
        </Field>
        <Field label={t("Preferred timeline", "Termen dorit")} optional>
          <Input
            id="timeline"
            name="timeline"
            placeholder={t("e.g. within 4 weeks", "de exemplu în 4 săptămâni")}
          />
        </Field>
      </div>

      <p className="type-body-sm max-w-[60ch] text-fg-3">
        {t(
          "We use these details only to reply to your request. ",
          "Folosim aceste date doar ca să-ți răspundem la cerere. ",
        )}
        <Link
          to="/privacy"
          className="text-fg-2 underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
        >
          {t("Privacy policy", "Politica de confidențialitate")}
        </Link>
      </p>

      <div>
        <Button type="submit" size="lg" loading={submitting}>
          {submitting ? t("Sending…", "Se trimite…") : t("Send the request", "Trimite cererea")}
        </Button>
      </div>
    </form>
  );
}

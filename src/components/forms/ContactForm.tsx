import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { submitContactEnquiry, type ContactResult } from "@/lib/contact.functions";
import { TurnstileField, type TurnstileHandle } from "@/components/forms/TurnstileField";
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
import { useI18n, type Language } from "@/i18n";
import type { PlanId } from "@/lib/plans";
import { monthlyText, PLAN_CATALOG, PLAN_ORDER } from "@/lib/pricing";

/** The first line of a contract request: "Aș vrea contractul pentru abonamentul Growth (…)." */
function planSentence(id: PlanId, lang: Language): string {
  const { name, priceLei } = PLAN_CATALOG[id];
  const fee = monthlyText(priceLei);
  return lang === "ro"
    ? `Aș vrea contractul pentru abonamentul ${name} (${fee.ro}).`
    : `I would like the contract for the ${name} plan (${fee.en}).`;
}

/** The contract request's starting text: the plan, then what the contract needs. */
function planPrefill(id: PlanId, lang: Language): string {
  return `${planSentence(id, lang)}\n${
    lang === "ro" ? "Firma și CUI: \nTelefon: " : "Company and tax ID (CUI): \nPhone: "
  }`;
}

const isPlanId = (value: string): value is PlanId => (PLAN_ORDER as string[]).includes(value);

/** The service select's values, also accepted as /contact?service=… (see contact.tsx). */
export const CONTACT_SERVICES = [
  "website",
  "ai-automation",
  "digital-product",
  "consultancy",
  "not-sure",
] as const;

export type ContactService = (typeof CONTACT_SERVICES)[number];

/**
 * `prefill` seeds the description, e.g. a Vortex Scan request from the homepage search or
 * a consultation session. `service` preselects the service field (a "Programează" link).
 * `plan` comes from "Cere contractul" (/contact?plan=…): the service field becomes the
 * chosen plan (sent as `plan-growth` etc., which the admin panel lists as the service), the
 * project fields (client type, budget, timeline) step aside and the text asks for the
 * company details a contract needs. Choosing another plan calls `onPlanChange` (the page
 * keeps it in the URL, so its banner follows) and swaps the plan sentence in the text while
 * the visitor has not rewritten it.
 */
export function ContactForm({
  prefill,
  service,
  plan,
  onPlanChange,
}: {
  prefill?: string;
  service?: ContactService;
  plan?: PlanId;
  onPlanChange?: (plan: PlanId) => void;
} = {}) {
  const { t, lang } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const [chosen, setChosen] = useState(plan);
  const [description, setDescription] = useState(
    () => prefill ?? (plan ? planPrefill(plan, lang) : ""),
  );
  // The page changed the plan (back/forward, a link): follow it.
  const [seenPlan, setSeenPlan] = useState(plan);
  if (plan !== seenPlan) {
    setSeenPlan(plan);
    if (plan && plan !== chosen) choosePlan(plan);
  }

  function choosePlan(next: PlanId) {
    const previous = chosen;
    setChosen(next);
    if (!previous || previous === next) return;
    setDescription((current) => {
      for (const l of ["ro", "en"] as const) {
        const old = planSentence(previous, l);
        if (current.startsWith(old)) return planSentence(next, lang) + current.slice(old.length);
      }
      return current;
    });
  }

  const notDelivered = t(
    "Your message did not go through. Please try again, or write to hello@vortexhub.ro.",
    "Mesajul nu a ajuns. Încearcă din nou sau scrie-ne la hello@vortexhub.ro.",
  );

  /** What the visitor reads when the server turned the request away. */
  function refusalText(result: Exclude<ContactResult, { ok: true }>): string {
    if (result.reason === "rate_limited") {
      return t(
        "Too many requests. Please try again in a few minutes.",
        "Prea multe cereri, încearcă din nou peste câteva minute.",
      );
    }
    if (result.reason === "verification") {
      return t(
        "We couldn't confirm the anti-spam check. Please send the request again.",
        "Nu am putut confirma verificarea anti-spam. Trimite cererea din nou.",
      );
    }
    return notDelivered;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFormError(null);
    setSubmitting(true);
    try {
      // Turnstile, when it is on: a token, or a reason to stop here.
      const check = (await turnstile.current?.check()) ?? { needed: false as const };
      if (check.needed && check.token === null) {
        setFormError(
          check.problem === "interaction"
            ? t(
                "Tick the check box above, then send again.",
                "Bifează caseta de verificare de mai sus, apoi trimite din nou.",
              )
            : t(
                "The anti-spam check did not load. Reload the page, or write to us at hello@vortexhub.ro.",
                "Verificarea anti-spam nu s-a încărcat. Reîncarcă pagina sau scrie-ne la hello@vortexhub.ro.",
              ),
        );
        return;
      }
      const result = await submitContactEnquiry({
        data: {
          fullName: String(form.get("fullName") || "").trim(),
          email: String(form.get("email") || "").trim(),
          clientType: String(form.get("clientType") || "") || null,
          service: String(form.get("service") || "") || null,
          description: String(form.get("description") || "").trim(),
          budget: String(form.get("budget") || "").trim() || null,
          timeline: String(form.get("timeline") || "").trim() || null,
          lang,
          turnstileToken: check.needed ? (check.token ?? undefined) : undefined,
        },
      });
      if (result.ok) {
        setSubmitted(true);
        return;
      }
      turnstile.current?.reset();
      setFormError(refusalText(result));
    } catch (error) {
      console.error("[contact] submit failed", error);
      turnstile.current?.reset();
      setFormError(notDelivered);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    const name = chosen ? PLAN_CATALOG[chosen].name : "";
    return (
      <div role="status" className="border-t border-rule pt-6">
        <h2 className="type-h3 text-fg">
          {t("Thank you, we have your request.", "Mulțumim, am primit cererea.")}
        </h2>
        <p className="type-body mt-2 max-w-[60ch] text-fg-2">
          {chosen
            ? t(
                `We will e-mail you the contract for ${name} to read, and we set up the first session together.`,
                `Îți trimitem pe e-mail contractul pentru ${name}, spre citire, și stabilim împreună prima sesiune.`,
              )
            : t(
                "We read every request and reply with a practical next step within one working day.",
                "Citim fiecare cerere și răspundem cu un pas practic următor într-o zi lucrătoare.",
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
        {/* A contract is signed by a company: no client type for a plan request. */}
        {chosen ? null : (
          <Field id="clientType" label={t("You are", "Ești")} optional>
            <Select name="clientType">
              <SelectTrigger id="clientType">
                <SelectValue placeholder={t("Choose one", "Alege")} />
              </SelectTrigger>
              <SelectContent className={menuClass}>
                <SelectItem value="individual">
                  {t("A private person", "Persoană fizică")}
                </SelectItem>
                <SelectItem value="business">{t("A business", "Firmă")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
        {chosen ? (
          <Field id="service" label={t("Plan", "Abonamentul")}>
            <Select
              name="service"
              value={`plan-${chosen}`}
              onValueChange={(value) => {
                const next = value.replace(/^plan-/, "");
                if (!isPlanId(next)) return;
                choosePlan(next);
                onPlanChange?.(next);
              }}
            >
              <SelectTrigger id="service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={menuClass}>
                {PLAN_ORDER.map((id) => (
                  <SelectItem key={id} value={`plan-${id}`}>
                    {`${PLAN_CATALOG[id].name}, ${monthlyText(PLAN_CATALOG[id].priceLei)[lang]}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field id="service" label={t("Service", "Serviciul")} optional>
            <Select name="service" defaultValue={service}>
              <SelectTrigger id="service">
                <SelectValue placeholder={t("Choose one", "Alege")} />
              </SelectTrigger>
              <SelectContent className={menuClass}>
                <SelectItem value="website">{t("Website", "Site web")}</SelectItem>
                <SelectItem value="ai-automation">
                  {t("AI automation", "Automatizare AI")}
                </SelectItem>
                <SelectItem value="digital-product">
                  {t("Digital products", "Produse digitale")}
                </SelectItem>
                <SelectItem value="consultancy">{t("Consultancy", "Consultanță")}</SelectItem>
                <SelectItem value="not-sure">{t("Not sure yet", "Nu știu încă")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      <Field label={t("What do you need?", "De ce ai nevoie?")}>
        <Textarea
          id="description"
          name="description"
          rows={5}
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      {/* The plan has its price: budget and timeline are for projects. */}
      {chosen ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Approximate budget", "Buget aproximativ")} optional>
            <Input
              id="budget"
              name="budget"
              placeholder={t("e.g. 4,500 to 7,500 RON", "de exemplu 4.500–7.500 lei")}
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
      )}

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

      {/* Nothing here unless Turnstile is on (TURNSTILE_SITE_KEY); usually invisible even then. */}
      <TurnstileField ref={turnstile} action="contact" className="max-w-[400px]" />

      <div className="flex flex-col items-start gap-3">
        {formError ? (
          <p id="contact-form-error" role="alert" className="type-body-sm max-w-[60ch] text-bad">
            {formError}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          loading={submitting}
          aria-describedby={formError ? "contact-form-error" : undefined}
        >
          {submitting ? t("Sending…", "Se trimite…") : t("Send the request", "Trimite cererea")}
        </Button>
      </div>
    </form>
  );
}

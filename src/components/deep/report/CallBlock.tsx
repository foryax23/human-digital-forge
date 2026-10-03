import { useId, useState, type FormEvent } from "react";

import { Button, buttonClass, SegmentedControl } from "@/components/system";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { LEAD_RETENTION_MONTHS } from "@/lib/scan/legal/lead-notice";
import { cn } from "@/lib/utils";

import { SIGNATORY, telLink, whatsappLink } from "../contact";
import { CTA_NEXT, CTA_TITLE } from "../copy";
import { useReport } from "./context";

/*
 * Recommendations and the call (plan A10 "Call to action"): the signatory, "Discuție gratuită
 * de 30 de minute", and the three paths, all separate from the marketing box: WhatsApp,
 * "Sună-mă" (a call request the person asks for, art. 6(1)(b)) and a direct phone link.
 * Phone and WhatsApp stay hidden until the owner provides them (contact.ts); the photo slot
 * shows the initials. Owners only: third parties get no Vortex offer.
 */

export function SignatoryLine({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Until the owner's photo arrives (contact.ts), the name and role stand alone. */}
      {SIGNATORY.photo ? (
        <img
          src={SIGNATORY.photo}
          alt={SIGNATORY.name}
          width={56}
          height={56}
          className="size-14 shrink-0 rounded-xl object-cover"
        />
      ) : null}
      <div className="min-w-0">
        <p className="text-[0.8125rem] text-fg-3">
          {t("Recommendations from", "Recomandări de la")}
        </p>
        <p className="font-medium leading-[1.35] text-fg">
          {SIGNATORY.name}, {t(SIGNATORY.role.en, SIGNATORY.role.ro)}, {SIGNATORY.company}
        </p>
        <p className="text-[0.8125rem] text-fg-3">
          CUI {SIGNATORY.cui}, {SIGNATORY.city}
        </p>
      </div>
    </div>
  );
}

export function CallBlock({ id = "discutam" }: { id?: string }) {
  const { t, lang } = useI18n();
  const { report, sample, access, onEvent, onCallRequest } = useReport();
  const fieldId = useId();
  const [phone, setPhone] = useState("");
  const [when, setWhen] = useState<"dimineata" | "dupa_amiaza">("dimineata");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "invalid">("idle");
  if (report.audience !== "owner") return null;
  const wa = whatsappLink(report.company.displayName, report.cui, lang);
  const tel = telLink();
  const canRequest = sample || (access ? access.persistence !== "unavailable" : false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^[+\d][\d\s().-]{6,20}$/.test(phone.trim())) {
      setState("invalid");
      return;
    }
    onEvent("cta_call_request");
    if (sample) {
      setState("sent");
      return;
    }
    setState("sending");
    const ok = await onCallRequest(phone.trim(), when);
    setState(ok ? "sent" : "error");
  };

  return (
    <section id={id} aria-labelledby={`${id}-titlu`} className="min-w-0 scroll-mt-28">
      <SignatoryLine />
      <h2 id={`${id}-titlu`} className="type-h3 mt-4 text-balance text-fg">
        {CTA_TITLE[lang]}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className={buttonClass("secondary", "lg", "h-11")}
            onClick={() => onEvent("cta_whatsapp")}
          >
            WhatsApp
          </a>
        ) : null}
        {tel ? (
          <a
            href={tel}
            className={buttonClass("secondary", "lg", "h-11")}
            onClick={() => onEvent("cta_tel")}
          >
            {t("Call", "Sună")}
          </a>
        ) : null}
      </div>
      {canRequest ? (
        state === "sent" ? (
          <p className="mt-3 text-fg" role="status">
            {sample
              ? t("In the sample nothing is sent.", "În exemplu nu se trimite nimic.")
              : t(
                  "Thank you. We'll call you within one working day.",
                  "Mulțumim. Te sunăm în cel mult o zi lucrătoare.",
                )}
          </p>
        ) : (
          <form
            onSubmit={submit}
            className="mt-3 flex flex-col gap-2"
            aria-label={t("Call me", "Sună-mă")}
          >
            <label htmlFor={fieldId} className="text-[0.8125rem] font-medium text-fg-2">
              {t("Your phone", "Telefonul tău")}
            </label>
            <Input
              id={fieldId}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (state === "invalid") setState("idle");
              }}
              aria-invalid={state === "invalid" ? true : undefined}
              aria-describedby={
                state === "invalid" ? `${fieldId}-error ${fieldId}-use` : `${fieldId}-use`
              }
              className="h-11 text-base"
            />
            <p id={`${fieldId}-use`} className="text-[0.8125rem] leading-[1.45] text-fg-3">
              {t(
                `We use the number only for this call and keep the request ${LEAD_RETENTION_MONTHS} months, like other requests.`,
                `Folosim numărul doar pentru acest apel și păstrăm cererea ${LEAD_RETENTION_MONTHS} de luni, ca pe celelalte cereri.`,
              )}{" "}
              <a
                href="/privacy#vortex-scan-deep"
                className="-my-3 inline-flex min-h-11 items-center rounded-sm underline underline-offset-2 hover:text-fg"
              >
                {t("Privacy", "Confidențialitate")}
              </a>
            </p>
            {state === "invalid" ? (
              <p id={`${fieldId}-error`} className="text-[0.8125rem] text-bad">
                {t(
                  "Write a phone number, e.g. 0722 123 456.",
                  "Scrie un număr de telefon, de exemplu 0722 123 456.",
                )}
              </p>
            ) : null}
            <SegmentedControl
              label={t("When to call", "Când să te sunăm")}
              value={when}
              onChange={setWhen}
              className="mt-1 h-12 self-start [&>button]:h-11 [&>button]:px-3"
              options={[
                { value: "dimineata", label: t("In the morning", "Dimineața") },
                { value: "dupa_amiaza", label: t("In the afternoon", "După-amiaza") },
              ]}
            />
            <Button
              type="submit"
              size="lg"
              className="mt-1 h-11 self-start"
              loading={state === "sending"}
            >
              {t("Call me", "Sună-mă")}
            </Button>
            {state === "error" ? (
              <p className="text-[0.8125rem] text-bad" role="alert">
                {t(
                  "We couldn't save the request. Write to us at ",
                  "Nu am putut salva cererea. Scrie-ne la ",
                )}
                <a href={`mailto:${SIGNATORY.email}`} className="underline underline-offset-2">
                  {SIGNATORY.email}
                </a>
                .
              </p>
            ) : null}
          </form>
        )
      ) : (
        <div className="mt-3 text-[0.9375rem] text-fg-2">
          <p>
            {t(
              "Call requests from this page start once reports are saved on our server. Until then, write to us and we call you back:",
              "Cererile «Sună-mă» pornesc odată cu salvarea rapoartelor pe server. Până atunci, scrie-ne și te sunăm noi:",
            )}{" "}
            <a
              href={`mailto:${SIGNATORY.email}`}
              className="font-medium text-fg underline underline-offset-2"
              onClick={() => onEvent("cta_email")}
            >
              {SIGNATORY.email}
            </a>
          </p>
        </div>
      )}
      <p className="mt-3 text-[0.875rem] text-fg-3">{CTA_NEXT[lang]}</p>
    </section>
  );
}

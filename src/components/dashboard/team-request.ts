import { useCallback, useRef } from "react";

import type { EnquiryPayload } from "@/components/dashboard/account-requests";
import type { TurnstileHandle } from "@/components/forms/TurnstileField";
import { useI18n } from "@/i18n";
import { submitContactEnquiry } from "@/lib/contact.functions";
import { COMPANY } from "@/lib/scan/legal/company";

/*
 * Sends a workspace request (a consultation, an account deletion) through the contact
 * pipeline, the same way the contact form does: the Turnstile check when it is on, then
 * submitContactEnquiry, whose refusals are answers. The form renders
 * <TurnstileField ref={turnstile} action="contact" /> (nothing shows while Turnstile is off).
 */

export type TeamRequestResult = { ok: true } | { ok: false; message: string };

export function useTeamRequest() {
  const { t, lang } = useI18n();
  const turnstile = useRef<TurnstileHandle>(null);

  const submit = useCallback(
    async (payload: EnquiryPayload): Promise<TeamRequestResult> => {
      const notSent = t(
        `The request was not sent. Please try again, or write to ${COMPANY.email}.`,
        `Cererea nu a fost trimisă. Încearcă din nou sau scrie-ne la ${COMPANY.email}.`,
      );
      try {
        const check = (await turnstile.current?.check()) ?? { needed: false as const };
        if (check.needed && check.token === null) {
          return {
            ok: false,
            message:
              check.problem === "interaction"
                ? t(
                    "Tick the check box above, then send again.",
                    "Bifează caseta de verificare de mai sus, apoi trimite din nou.",
                  )
                : t(
                    `The anti-spam check did not load. Reload the page, or write to ${COMPANY.email}.`,
                    `Verificarea anti-spam nu s-a încărcat. Reîncarcă pagina sau scrie-ne la ${COMPANY.email}.`,
                  ),
          };
        }
        const result = await submitContactEnquiry({
          data: {
            ...payload,
            lang,
            turnstileToken: check.needed ? (check.token ?? undefined) : undefined,
          },
        });
        if (result.ok) return { ok: true };
        turnstile.current?.reset();
        if (result.reason === "rate_limited")
          return {
            ok: false,
            message: t(
              "Too many requests. Please try again in a few minutes.",
              "Prea multe cereri. Încearcă din nou peste câteva minute.",
            ),
          };
        if (result.reason === "verification")
          return {
            ok: false,
            message: t(
              "We couldn't confirm the anti-spam check. Please send the request again.",
              "Nu am putut confirma verificarea anti-spam. Trimite cererea din nou.",
            ),
          };
        return { ok: false, message: notSent };
      } catch (error) {
        console.error("[workspace] request failed", error);
        turnstile.current?.reset();
        return { ok: false, message: notSent };
      }
    },
    [t, lang],
  );

  return { submit, turnstile };
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardForm, turnstileSiteKey } from "@/lib/abuse/index.server";
import { notifyIntake } from "@/lib/notify/index.server";

const contactSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().max(200),
  clientType: z.string().max(40).optional().nullable(),
  service: z.string().max(60).optional().nullable(),
  description: z.string().min(1).max(4000),
  budget: z.string().max(120).optional().nullable(),
  timeline: z.string().max(120).optional().nullable(),
  /** The site's language when the form was sent: the confirmation e-mail follows it. */
  lang: z.enum(["ro", "en"]).optional(),
  /** Cloudflare Turnstile's token, when the widget is on (TURNSTILE_SITE_KEY). */
  turnstileToken: z.string().max(2048).optional(),
});

/** The contact form's answer. Refusals are answers, not errors, so the form can say what to do. */
export type ContactResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited"; retryAfterSec: number }
  | { ok: false; reason: "verification"; detail: "missing" | "expired" | "invalid" }
  | { ok: false; reason: "unavailable" };

/**
 * Stores an enquiry (also "Cere contractul", where `service` is "plan-<id>", and the
 * "Programează" links), then alerts the team and confirms to the visitor in the background
 * (src/lib/notify; both off until their secrets exist). Per-address rate limit and, when its
 * keys are set, Turnstile first (src/lib/abuse).
 */
export const submitContactEnquiry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactSchema.parse(input))
  .handler(async ({ data }): Promise<ContactResult> => {
    const refused = await guardForm("contact", data.turnstileToken);
    if (refused) return refused;

    try {
      const { error } = await supabaseAdmin.from("contact_enquiries").insert({
        full_name: data.fullName,
        email: data.email,
        client_type: data.clientType ?? null,
        service: data.service ?? null,
        description: data.description,
        budget: data.budget ?? null,
        timeline: data.timeline ?? null,
      });
      if (error) {
        console.error("[contact] insert failed", error.code ?? "", error.message ?? "");
        return { ok: false, reason: "unavailable" };
      }
    } catch (error) {
      // No database access (e.g. local dev without the service key).
      console.error("[contact] insert failed", (error as Error)?.message ?? "");
      return { ok: false, reason: "unavailable" };
    }

    await notifyIntake({
      kind: "contact",
      name: data.fullName,
      email: data.email,
      service: data.service,
      clientType: data.clientType,
      budget: data.budget,
      timeline: data.timeline,
      description: data.description,
      lang: data.lang ?? "ro",
    });
    return { ok: true };
  });

/**
 * What the browser needs to render the intake forms: the public Turnstile site key, only
 * when the server also has the secret to verify its tokens (otherwise null, and nothing
 * about Turnstile renders).
 */
export const getIntakeConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ turnstileSiteKey: string | null }> => ({
    turnstileSiteKey: turnstileSiteKey(),
  }),
);

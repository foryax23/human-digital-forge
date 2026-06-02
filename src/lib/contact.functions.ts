import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const contactSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().max(200),
  clientType: z.string().max(40).optional().nullable(),
  service: z.string().max(60).optional().nullable(),
  description: z.string().min(1).max(4000),
  budget: z.string().max(120).optional().nullable(),
  timeline: z.string().max(120).optional().nullable(),
});

export const submitContactEnquiry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactSchema.parse(input))
  .handler(async ({ data }) => {
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
      console.error("[contact] insert failed", error);
      throw new Error("Could not submit your enquiry. Please try again.");
    }

    return { ok: true };
  });

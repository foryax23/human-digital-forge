import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const auditLeadSchema = z.object({
  fullName: z.string().max(120).optional().nullable(),
  email: z.string().email().max(200),
  company: z.string().max(160).optional().nullable(),
  answers: z.record(z.string(), z.string()),
  score: z.number().int().min(0).max(100),
  recommendedTier: z.string().max(40),
  recommendation: z.string().max(2000),
  language: z.enum(["en", "ro"]),
});

export const submitAuditLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => auditLeadSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("audit_leads").insert({
      full_name: data.fullName ?? null,
      email: data.email,
      company: data.company ?? null,
      answers: data.answers,
      score: data.score,
      recommended_tier: data.recommendedTier,
      recommendation: data.recommendation,
      language: data.language,
    });

    if (error) {
      console.error("[audit] insert failed", error);
      throw new Error("Could not save your audit. Please try again.");
    }

    return { ok: true };
  });

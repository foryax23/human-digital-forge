import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { lookupAnaf } from "@/lib/scan/anaf.server";
import { auditWebsite } from "@/lib/scan/audit/index.server";
import { runPageSpeed } from "@/lib/scan/audit/pagespeed.server";
import { buildRulesBlueprint } from "@/lib/scan/blueprint";
import { discoverWebsite } from "@/lib/scan/discover.server";
import { detectPresence } from "@/lib/scan/presence.server";
import type { Blueprint, CompanyProfile, OnlinePresence, WebsiteAudit } from "@/lib/scan/types";

/*
 * Vortex Scan server functions. The browser runs a scan as a series of short
 * calls (identify → discover → audit ‖ pagespeed → blueprint), so each one
 * stays well inside the Worker's limits and the UI can animate every step.
 */

const cuiSchema = z.string().regex(/^\d{2,10}$/);
const urlSchema = z
  .string()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), "Only http(s) URLs can be scanned");

/** Official company details from ANAF for a CUI (null when ANAF has none). */
export const lookupCompany = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ cui: cuiSchema }).parse(input))
  .handler(async ({ data }): Promise<CompanyProfile | null> => lookupAnaf(data.cui));

/** Finds and verifies the company's website when the visitor didn't give one. */
export const findCompanyWebsite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        cui: cuiSchema.optional(),
        name: z.string().min(2).max(200),
        city: z.string().max(120).optional(),
        knownWebsite: z.string().max(2048).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => discoverWebsite(data));

/** Crawls a few pages of the site and runs the deterministic checks. */
export const scanWebsite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ url: urlSchema, cui: cuiSchema.optional(), name: z.string().max(200).optional() })
      .parse(input),
  )
  .handler(async ({ data }): Promise<WebsiteAudit> => auditWebsite(data));

/** Lighthouse scores and Core Web Vitals via the PageSpeed Insights API. */
export const scanPageSpeed = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ url: urlSchema }).parse(input))
  .handler(async ({ data }) => runPageSpeed(data.url, "mobile"));

/**
 * Online presence: social profiles linked from the site, plus the Google
 * rating when GOOGLE_PLACES_API_KEY is configured. Metrics are real or absent.
 */
export const scanPresence = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(2).max(200),
        city: z.string().max(120).optional(),
        socialLinks: z.array(z.string().max(2048)).max(40).default([]),
        website: z.string().max(2048).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<OnlinePresence> => detectPresence(data));

/**
 * Builds the blueprint from the playbooks — deterministic and free. Claude
 * refinement is deliberately NOT reachable from this anonymous endpoint (the
 * inputs come from the browser, so it would let anyone spend the LLM budget);
 * it belongs behind lead capture with rate limits and a spend cap (engine plan
 * M3). Audit/company come from earlier steps.
 */
export const createBlueprint = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        target: z.object({
          cui: cuiSchema.optional(),
          url: z.string().max(2048).optional(),
          query: z.string().max(200).optional(),
        }),
        company: z.custom<CompanyProfile>().optional(),
        audit: z.custom<WebsiteAudit>().optional(),
        presence: z.custom<OnlinePresence>().optional(),
        /** The visitor's correction from "Edit business". */
        businessTypeId: z.string().max(60).optional(),
        competitors: z
          .array(
            z.object({
              cui: z.string(),
              name: z.string(),
              city: z.string().optional(),
              website: z.string().optional(),
              websiteScore: z.number().optional(),
            }),
          )
          .max(10)
          .optional(),
      })
      .refine((value) => JSON.stringify(value).length < 400_000, "Scan data too large")
      .parse(input),
  )
  .handler(async ({ data }): Promise<Blueprint> => buildRulesBlueprint(data));

const leadSchema = z.object({
  email: z.string().email().max(200),
  fullName: z.string().max(120).optional(),
  company: z.string().max(200).optional(),
  consent: z.literal(true),
  lang: z.enum(["en", "ro"]),
  blueprintId: z.string().max(80),
  summary: z.object({
    businessType: z.string().max(120),
    digitalMaturity: z.number().min(0).max(100),
    monthlySavingsRon: z.object({ low: z.number(), high: z.number() }),
    recommendedPlan: z.enum(["starter", "growth", "pro", "project"]),
    website: z.string().max(2048).optional(),
    cui: cuiSchema.optional(),
  }),
});

/** Stores the visitor who downloads the blueprint (consent required). */
export const saveScanLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => leadSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("audit_leads").insert({
      email: data.email,
      full_name: data.fullName ?? null,
      company: data.company ?? null,
      language: data.lang,
      score: Math.round(data.summary.digitalMaturity),
      recommended_tier: data.summary.recommendedPlan,
      recommendation: `Vortex Scan blueprint ${data.blueprintId}`,
      answers: { source: "vortex-scan", consent: true, ...data.summary },
    });
    if (error) {
      console.error("[scan] lead insert failed", error);
      throw new Error("Could not save your details. Please try again.");
    }
    return { ok: true };
  });

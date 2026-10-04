import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertScanAllowed, dailyCapAllows, guardForm } from "@/lib/abuse/index.server";
import { notifyIntake } from "@/lib/notify/index.server";
import { lookupAnaf } from "@/lib/scan/anaf.server";
import { auditWebsite } from "@/lib/scan/audit/index.server";
import { runPageSpeed } from "@/lib/scan/audit/pagespeed.server";
import { buildRulesBlueprint } from "@/lib/scan/blueprint";
import { discoverWebsite } from "@/lib/scan/discover.server";
import { detectPresence } from "@/lib/scan/presence.server";
import { LEAD_NOTICE_VERSION, leadConsentRecord } from "@/lib/scan/legal/lead-notice";
import type { Blueprint, CompanyProfile, OnlinePresence, WebsiteAudit } from "@/lib/scan/types";

/*
 * Vortex Scan server functions. The browser runs a scan as a series of short
 * calls (identify → discover → audit ‖ pagespeed → blueprint), so each one
 * stays well inside the Worker's limits and the UI can animate every step.
 *
 * Every call counts against a per-address limit (src/lib/abuse/limits.server.ts); over it,
 * a step throws "rate_limited: …" (PageSpeed returns null instead). Brave Search and
 * PageSpeed also have daily caps shared by all visitors.
 */

const cuiSchema = z.string().regex(/^\d{2,10}$/);
const urlSchema = z
  .string()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), "Only http(s) URLs can be scanned");

/** Official company details from ANAF for a CUI (null when ANAF has none). */
export const lookupCompany = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ cui: cuiSchema }).parse(input))
  .handler(async ({ data }): Promise<CompanyProfile | null> => {
    await assertScanAllowed("scan.company");
    return lookupAnaf(data.cui);
  });

/** Finds and verifies the company's website when the visitor didn't give one. */
export const findCompanyWebsite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        cui: cuiSchema.optional(),
        name: z.string().min(2).max(200),
        city: z.string().max(120).optional(),
        knownWebsite: z.string().max(2048).optional(),
        /** The Trade Register number from the company profile: accepted as proof in either format. */
        regNo: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await assertScanAllowed("scan.discover");
    return discoverWebsite(data, { searchAllowed: () => dailyCapAllows("brave") });
  });

/** Crawls a few pages of the site and runs the deterministic checks. */
export const scanWebsite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ url: urlSchema, cui: cuiSchema.optional(), name: z.string().max(200).optional() })
      .parse(input),
  )
  .handler(async ({ data }): Promise<WebsiteAudit> => {
    await assertScanAllowed("scan.website");
    return auditWebsite(data);
  });

/** Lighthouse scores and Core Web Vitals via the PageSpeed Insights API. */
export const scanPageSpeed = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ url: urlSchema }).parse(input))
  .handler(async ({ data }) => {
    // Over the limit, the scan goes on without Lighthouse, as when PageSpeed is down.
    const allowed = await assertScanAllowed("scan.pagespeed").then(
      () => true,
      () => false,
    );
    if (!allowed) return null;
    return runPageSpeed(data.url, "mobile", { allowed: () => dailyCapAllows("pagespeed") });
  });

/**
 * Online presence: the company's own site plus the social profiles it links
 * to. Social networks and Google Places are not queried (presence.server.ts).
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
  .handler(async ({ data }): Promise<OnlinePresence> => {
    await assertScanAllowed("scan.presence");
    return detectPresence(data);
  });

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
  .handler(async ({ data }): Promise<Blueprint> => {
    await assertScanAllowed("scan.blueprint");
    return buildRulesBlueprint(data);
  });

const leadSchema = z.object({
  email: z.string().email().max(200),
  fullName: z.string().max(120).optional(),
  company: z.string().max(200).optional(),
  /** The information notice the dialog showed; an outdated client fails here. */
  noticeVersion: z.literal(LEAD_NOTICE_VERSION),
  /** The optional, unticked box. The PDF is delivered either way. */
  marketingConsent: z.boolean(),
  /** The language the dialog (and so the notice) was shown in. */
  lang: z.enum(["en", "ro"]),
  blueprintId: z.string().max(80),
  summary: z.object({
    businessType: z.string().max(120),
    digitalMaturity: z.number().min(0).max(100),
    monthlySavingsRon: z.object({
      low: z.number(),
      high: z.number(),
      mid: z.number().optional(),
    }),
    recommendedPlan: z.enum(["starter", "growth", "pro", "project"]),
    website: z.string().max(2048).optional(),
    cui: cuiSchema.optional(),
  }),
  /** Cloudflare Turnstile's token, when the widget is on (TURNSTILE_SITE_KEY). */
  turnstileToken: z.string().max(2048).optional(),
});

/**
 * The lead gate's answer. Refusals are answers, not errors: the dialog still delivers the
 * PDF and says why the details were not kept.
 */
export type ScanLeadResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited"; retryAfterSec: number }
  | { ok: false; reason: "verification"; detail: "missing" | "expired" | "invalid" }
  | { ok: false; reason: "unavailable" };

/**
 * Stores the visitor who downloads the blueprint, with a record of the notice
 * they saw and their marketing choice. audit_leads has no consent columns, so
 * the record lives in `answers` (JSON): `marketingConsent` is the flag to
 * filter on (rows saved before it count as false) and `consentRecord` holds
 * the version, the exact texts in the shown language and the server time.
 */
export const saveScanLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => leadSchema.parse(input))
  .handler(async ({ data }): Promise<ScanLeadResult> => {
    const refused = await guardForm("lead", data.turnstileToken);
    if (refused) return refused;
    try {
      const { error } = await supabaseAdmin.from("audit_leads").insert({
        email: data.email,
        full_name: data.fullName ?? null,
        company: data.company ?? null,
        language: data.lang,
        score: Math.round(data.summary.digitalMaturity),
        recommended_tier: data.summary.recommendedPlan,
        recommendation: `Vortex Scan blueprint ${data.blueprintId}`,
        answers: {
          source: "vortex-scan",
          ...data.summary,
          marketingConsent: data.marketingConsent,
          consentRecord: leadConsentRecord(data.lang, data.marketingConsent),
        },
      });
      if (error) {
        console.error("[scan] lead insert failed", error.code ?? "", error.message ?? "");
        return { ok: false, reason: "unavailable" };
      }
    } catch (error) {
      console.error("[scan] lead insert failed", (error as Error)?.message ?? "");
      return { ok: false, reason: "unavailable" };
    }
    await notifyIntake({
      kind: "scan_lead",
      email: data.email,
      name: data.fullName,
      company: data.company,
      cui: data.summary.cui,
      website: data.summary.website,
      recommendedPlan: data.summary.recommendedPlan,
      digitalMaturity: data.summary.digitalMaturity,
      marketingConsent: data.marketingConsent,
      lang: data.lang,
    });
    return { ok: true };
  });

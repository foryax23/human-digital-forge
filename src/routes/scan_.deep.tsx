import { useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { DeepPage, type DeepSearch } from "@/components/deep/DeepPage";
import { DEMO_SECTORS, DEMO_STATES } from "@/components/deep/fixtures/demo-keys";

/*
 * /scan/deep, "Cercetare aprofundată" (plan A10). Not indexed (noindex, and Disallow in
 * robots.txt). No loader: every deep step starts on the client after hydration, so a crawler
 * can never trigger an ANAF call. Search params: cui, site, run, view, demo (+ sector),
 * verify, theme (screenshots).
 */

const text = (max: number) =>
  z
    .preprocess(
      (v) => (typeof v === "number" ? String(v) : v),
      z.string().trim().min(1).max(max).optional(),
    )
    .catch(undefined);

/** A CUI stays a number so the router writes ?cui=54747928 (a digit string gets quotes). */
const cui = z
  .preprocess(
    (v) =>
      typeof v === "string" && /^(RO)?\d{2,10}$/i.test(v.trim())
        ? Number(v.trim().replace(/^RO/i, ""))
        : v,
    z.number().int().positive().max(9_999_999_999).optional(),
  )
  .catch(undefined);

const searchSchema = z.object({
  cui,
  site: z
    .preprocess(
      (v) => (typeof v === "string" && /^https?:\/\//i.test(v) ? v.slice(0, 300) : undefined),
      z.string().optional(),
    )
    .catch(undefined),
  run: z
    .preprocess(
      (v) => (typeof v === "string" && /^[0-9a-z-]{8,64}$/i.test(v) ? v : undefined),
      z.string().optional(),
    )
    .catch(undefined),
  view: z.enum(["pe-scurt", "cifre", "dovezi"]).optional().catch(undefined),
  demo: z.enum(DEMO_STATES).optional().catch(undefined),
  sector: z.enum(DEMO_SECTORS).optional().catch(undefined),
  verify: text(20),
  theme: z.enum(["light", "dark"]).optional().catch(undefined),
});

export const Route = createFileRoute("/scan_/deep")({
  validateSearch: (search: Record<string, unknown>): DeepSearch =>
    searchSchema.parse(search) as DeepSearch,
  head: () => ({
    meta: [
      { title: "Cercetare aprofundată | Vortex Hub" },
      {
        name: "description",
        content:
          "Vortex Scan deep research: official figures, similar firms, the website as a customer sees it and three actions in lei.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DeepRoute,
});

function DeepRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/scan/deep" });
  const setSearch = useCallback(
    (patch: Partial<DeepSearch>, opts?: { replace?: boolean }) => {
      void navigate({
        search: (prev) => {
          const next: Record<string, unknown> = { ...prev, ...patch };
          for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
          return next as DeepSearch;
        },
        replace: opts?.replace ?? false,
      });
    },
    [navigate],
  );
  return <DeepPage search={search} setSearch={setSearch} />;
}

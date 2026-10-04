import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Conservative security headers on every response the app produces (pages, server functions,
// API routes, error pages). Deliberately NO script-src/style-src CSP: Lovable's badge and
// editor bridge, Google sign-in (Lovable OAuth broker), Google Fonts and the inline head
// scripts must keep working. A header a route sets itself is never overwritten. Static files
// under public/ are served by the host without passing through here.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // No includeSubDomains/preload: only this host is pinned to HTTPS (.dev is HTTPS-only anyway).
  "Strict-Transport-Security": "max-age=31536000",
};

// Lovable's editor shows the app in an iframe on these preview hosts
// (src/integrations/supabase/previewAuthStorage.ts lists the same zones).
const LOVABLE_PREVIEW_ZONES = [
  "lovableproject.com",
  "lovableproject-dev.com",
  "lovable.app",
  "gpt-eng.com",
  "gptengineer.run",
];
const LOVABLE_EDITORS =
  "'self' https://lovable.dev https://*.lovable.dev https://gptengineer.app https://*.gptengineer.app";

function onLovablePreview(request: Request): boolean {
  const hosts = [request.headers.get("x-forwarded-host") ?? "", request.headers.get("host") ?? ""];
  try {
    hosts.push(new URL(request.url).hostname);
  } catch {
    /* ignore */
  }
  return hosts.some((raw) => {
    const host = raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
    return LOVABLE_PREVIEW_ZONES.some((zone) => host === zone || host.endsWith(`.${zone}`));
  });
}

/** Clickjacking protection: no framing, except Lovable's editor on its own preview hosts. */
function framingHeaders(request: Request): Record<string, string> {
  // The dev server is what Lovable's editor frames (sandbox preview): leave framing alone.
  if (import.meta.env.DEV) return {};
  if (onLovablePreview(request)) {
    return { "Content-Security-Policy": `frame-ancestors ${LOVABLE_EDITORS}` };
  }
  return { "X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'" };
}

function withSecurityHeaders(request: Request, response: Response): Response {
  const wanted = { ...SECURITY_HEADERS, ...framingHeaders(request) };
  const missing = Object.entries(wanted).filter(([name]) => !response.headers.has(name));
  if (missing.length === 0) return response;
  try {
    for (const [name, value] of missing) response.headers.set(name, value);
    return response;
  } catch {
    // Immutable headers (e.g. a proxied fetch response): copy into a new Response.
    const headers = new Headers(response.headers);
    for (const [name, value] of missing) headers.set(name, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    let response: Response;
    try {
      const handler = await getServerEntry();
      response = await normalizeCatastrophicSsrResponse(await handler.fetch(request, env, ctx));
    } catch (error) {
      console.error(error);
      response = new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return withSecurityHeaders(request, response);
  },
};

import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

type AuthorizationDetails = {
  client?: { name?: string; client_name?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: Error | null }>;
};

function getOAuthApi(): OAuthApi {
  // Supabase OAuth authorization server namespace is beta; cast through any.
  const auth = (supabase.auth as unknown as { oauth?: OAuthApi }).oauth;
  if (!auth) {
    throw new Error("OAuth authorization API is not available");
  }
  return auth;
}

function clientName(details: AuthorizationDetails | null): string | undefined {
  return details?.client?.name ?? details?.client?.client_name ?? undefined;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id: typeof search.authorization_id === "string" ? search.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) {
      throw new Error("Missing authorization_id");
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await getOAuthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      throw redirect({ href: immediate });
    }
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-sm border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">Authorization request</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Could not load this authorization request: {String((error as Error)?.message ?? error)}
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </main>
  ),
});

function ConsentPage() {
  const { t } = useI18n();
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: apiError } = approve
      ? await getOAuthApi().approveAuthorization(authorization_id)
      : await getOAuthApi().denyAuthorization(authorization_id);

    if (apiError) {
      setBusy(false);
      setError(apiError.message);
      return;
    }

    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const name = clientName(details) ?? t("an app", "o aplicație");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-sm border border-border bg-card p-8 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-sm bg-primary text-primary-foreground">
          <span className="text-xl font-bold">V</span>
        </div>
        <h1 className="mt-6 text-center text-2xl font-semibold">
          {t("Connect", "Conectează")} {name} {t("to Vortex Hub", "la Vortex Hub")}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t(
            "This lets the connected app act on your behalf inside your Vortex Hub workspace.",
            "Aceasta permite aplicației conectate să acționeze în numele tău în spațiul tău de lucru Vortex Hub.",
          )}
        </p>

        <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
            {t("Read your profile and subscription", "Citește profilul și abonamentul tău")}
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
            {t("View and create projects, messages and consultations", "Vizualizează și creează proiecte, mesaje și consultanțe")}
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
            {t("View invoices and uploaded files", "Vizualizează facturile și fișierele încărcate")}
          </li>
        </ul>

        {error && (
          <p role="alert" className="mt-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            {t("Deny", "Respinge")}
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? t("Processing...", "Se procesează...") : t("Approve", "Aprobă")}
          </Button>
        </div>
      </div>
    </main>
  );
}

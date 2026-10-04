import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton, AuthDivider } from "@/components/auth/GoogleButton";
import { safeNext } from "@/components/deep/safe-next";
import { FOCUS_RING } from "@/components/system/tone";
import { supabase } from "@/integrations/supabase/client";
import { pageMeta, useI18n } from "@/i18n";
import { canonicalLink } from "@/i18n/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  // `next` and `redirect` name a path on this site only ("/…", never "//", "@" or "\\").
  validateSearch: (search: Record<string, unknown>) => {
    const result: { redirect?: string; next?: string } = {};
    const redirect = safeNext(search.redirect);
    const next = safeNext(search.next);
    if (redirect) result.redirect = redirect;
    if (next) result.next = next;
    return result;
  },
  head: ({ matches }) => ({
    meta: pageMeta(matches, "/login"),
    links: [canonicalLink("/login")],
  }),
  component: LoginPage,
});

type T = (en: string, ro: string) => string;

/** Supabase Auth errors in words the visitor can act on (never the raw English message). */
function authError(error: { code?: string; status?: number }, t: T, forgot: boolean) {
  if (error.status === 429 || error.code?.startsWith("over_")) {
    return t(
      "Too many attempts. Wait a few minutes and try again.",
      "Prea multe încercări. Așteaptă câteva minute și încearcă din nou.",
    );
  }
  if (forgot) {
    return t(
      "We could not send the reset e-mail. Check the address and try again.",
      "Nu am putut trimite e-mailul de resetare. Verifică adresa și încearcă din nou.",
    );
  }
  if (error.code === "email_not_confirmed") {
    return t(
      "Confirm your e-mail address first, from the link we sent you.",
      "Confirmă mai întâi adresa de e-mail, din linkul pe care ți l-am trimis.",
    );
  }
  if (error.code === "invalid_credentials" || error.status === 400) {
    return t(
      "The e-mail or the password is not right. Check them and try again.",
      "E-mailul sau parola nu se potrivesc. Verifică-le și încearcă din nou.",
    );
  }
  return t("Could not log in. Please try again.", "Nu te-am putut conecta. Încearcă din nou.");
}

/** A text button under or beside a field: 24 px tall, the ring on keyboard focus. */
const TEXT_BUTTON = cn(
  "inline-flex min-h-6 cursor-pointer items-center rounded-sm text-primary underline-offset-4 hover:underline",
  FOCUS_RING,
);

const ERROR_ID = "login-error";

function LoginPage() {
  const { redirect, next } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  // Shown under the fields and tied to them (aria-describedby), read out once (role=alert).
  const [error, setError] = useState<string | null>(null);
  const fieldError = error ? ({ "aria-invalid": true, "aria-describedby": ERROR_ID } as const) : {};

  function switchMode(next: "login" | "forgot") {
    setError(null);
    setMode(next);
  }

  const returnTo = safeNext(next) ?? safeNext(redirect) ?? "/dashboard";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: failure } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (failure) {
      setError(authError(failure, t, false));
      return;
    }
    navigate({ to: returnTo });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: failure } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (failure) {
      setError(authError(failure, t, true));
      return;
    }
    toast.success(
      t(
        "Check your inbox for a password reset link.",
        "Verifică e-mailul: ți-am trimis linkul de resetare a parolei.",
      ),
    );
    switchMode("login");
  }

  const errorLine = error ? (
    <p id={ERROR_ID} role="alert" className="type-body-sm text-bad">
      {error}
    </p>
  ) : null;

  if (mode === "forgot") {
    return (
      <AuthLayout
        heading={t("Reset your password.", "Resetează parola.")}
        intro={t(
          "Enter your email and we'll send you a secure reset link.",
          "Scrie adresa de e-mail și îți trimitem un link securizat de resetare.",
        )}
        footer={
          <button type="button" onClick={() => switchMode("login")} className={TEXT_BUTTON}>
            {t("Back to login", "Înapoi la autentificare")}
          </button>
        }
      >
        <form className="space-y-5" onSubmit={handleForgot}>
          <div className="space-y-2">
            <Label htmlFor="email">{t("Email address", "Adresă de e-mail")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              {...fieldError}
            />
          </div>
          {errorLine}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
            {t("Send reset link", "Trimite linkul de resetare")}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading={t("Welcome back to Vortex Hub.", "Bine ai revenit la Vortex Hub.")}
      intro={t(
        "Access your projects, messages and completed deliveries.",
        "Accesează proiectele, mesajele și livrările finalizate.",
      )}
      footer={
        <span>
          {t("New here?", "Ești nou?")}{" "}
          <Link to="/register" className={TEXT_BUTTON}>
            {t("Create an account", "Creează cont")}
          </Link>
        </span>
      }
    >
      <GoogleButton redirectPath={returnTo} />
      <AuthDivider />
      <form className="space-y-5" onSubmit={handleLogin}>
        <div className="space-y-2">
          <Label htmlFor="email">{t("Email address", "Adresă de e-mail")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            {...fieldError}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("Password", "Parolă")}</Label>
            {/* -my-1: the 24 px target without moving the field. */}
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className={cn("-my-1 text-xs", TEXT_BUTTON)}
            >
              {t("Forgot password", "Ai uitat parola?")}
            </button>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            {...fieldError}
          />
        </div>
        {errorLine}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
          {t("Log in", "Conectează-te")}
        </Button>
      </form>
    </AuthLayout>
  );
}

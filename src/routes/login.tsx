import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton, AuthDivider } from "@/components/auth/GoogleButton";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

const title = "Login | Vortex Hub";
const description = "Access your Vortex Hub projects, messages and completed deliveries.";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => {
    const result: { redirect?: string; next?: string } = {};
    if (typeof search.redirect === "string") result.redirect = search.redirect;
    if (typeof search.next === "string") result.next = search.next;
    return result;
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect, next } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");

  const returnTo = next ?? redirect;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message || t("Could not log in. Check your details.", "Nu s-a putut autentifica. Verificați datele introduse."));
      return;
    }
    navigate({ to: returnTo });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || t("Could not send reset email.", "Nu s-a putut trimite emailul de resetare."));
      return;
    }
    toast.success(t("Check your inbox for a password reset link.", "Verificați căsuța de email pentru linkul de resetare a parolei."));
    setMode("login");
  }

  if (mode === "forgot") {
    return (
      <AuthLayout
        heading={t("Reset your password.", "Resetează parola.")}
        intro={t("Enter your email and we'll send you a secure reset link.", "Introduceți emailul și vă vom trimite un link securizat de resetare.")}
        footer={
          <button
            type="button"
            onClick={() => setMode("login")}
            className="text-primary underline-offset-4 hover:underline"
          >
            {t("Back to login", "Înapoi la autentificare")}
          </button>
        }
      >
        <form className="space-y-5" onSubmit={handleForgot}>
          <div className="space-y-2">
            <Label htmlFor="email">{t("Email address", "Adresă de email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("Send reset link", "Trimite linkul de resetare")}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading={t("Welcome back to Vortex Hub.", "Bine ai revenit la Vortex Hub.")}
      intro={t("Access your projects, messages and completed deliveries.", "Accesează proiectele, mesajele și livrările finalizate.")}
      footer={
        <span>
          {t("New here?", "Ești nou?")}
          {" "}
          <Link to="/register" className="text-primary underline-offset-4 hover:underline">
            {t("Create an account", "Creează cont")}
          </Link>
        </span>
      }
    >
      <GoogleButton redirect_uri={`${window.location.origin}${returnTo}`} />
      <AuthDivider />
      <form className="space-y-5" onSubmit={handleLogin}>
        <div className="space-y-2">
          <Label htmlFor="email">{t("Email address", "Adresă de email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("Password", "Parolă")}</Label>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-xs text-primary hover:underline"
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
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Log in", "Conectează-te")}
        </Button>
      </form>
    </AuthLayout>
  );
}

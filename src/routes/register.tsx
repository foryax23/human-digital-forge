import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoogleButton, AuthDivider } from "@/components/auth/GoogleButton";
import { browserStorage, readPending } from "@/components/deep/journal";
import { DEEP_PATH, safeNext } from "@/components/deep/safe-next";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

const title = "Create account | Vortex Hub";
const description = "Create a Vortex Hub client account to submit projects and track progress.";

export const Route = createFileRoute("/register")({
  // `next` names a path on this site only ("/…", never "//", "@" or "\\").
  validateSearch: (search: Record<string, unknown>) => {
    const result: { next?: string } = {};
    const next = safeNext(search.next);
    if (next) result.next = next;
    return result;
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/register" }],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clientType, setClientType] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);

  const returnTo = safeNext(next) ?? "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // A pending deep research target (kept 1 hour in this browser) brings the confirmation
        // link back to /scan/deep, where the target is restored.
        emailRedirectTo: `${window.location.origin}${readPending(browserStorage(), Date.now()) ? DEEP_PATH : returnTo}`,
        data: {
          full_name: fullName,
          client_type: clientType,
          company,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message || t("Could not create your account.", "Nu s-a putut crea contul tău."),
      );
      return;
    }
    if (data.session) {
      navigate({ to: returnTo });
    } else {
      toast.success(
        t(
          "Account created. Please check your email to confirm, then log in.",
          "Cont creat. Verifică e-mailul pentru confirmare, apoi conectează-te.",
        ),
      );
      navigate({ to: "/login", search: next ? { next } : undefined });
    }
  }

  return (
    <AuthLayout
      heading={t("Create your client account.", "Creează-ți contul de client.")}
      intro={t(
        "Submit projects, track progress and securely receive completed work.",
        "Trimite proiecte, urmărește progresul și primește lucrările finalizate în siguranță.",
      )}
      footer={
        <span>
          {t("Already have an account?", "Ai deja cont?")}{" "}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            {t("Log in", "Conectează-te")}
          </Link>
        </span>
      }
    >
      <GoogleButton
        label={t("Sign up with Google", "Înregistrare cu Google")}
        redirectPath={returnTo}
      />
      <AuthDivider />
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="fullName">{t("Full name", "Nume complet")}</Label>
          <Input
            id="fullName"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("Email address", "Adresă de e-mail")}</Label>
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
          <Label htmlFor="password">{t("Password", "Parolă")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clientType">{t("Client type", "Tip de client")}</Label>
            <Select value={clientType} onValueChange={setClientType}>
              <SelectTrigger id="clientType">
                <SelectValue placeholder={t("Select one", "Alege")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">{t("Individual", "Persoană fizică")}</SelectItem>
                <SelectItem value="business">{t("Business", "Companie")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">
              {t("Company name (optional)", "Nume companie (opțional)")}
            </Label>
            <Input
              id="company"
              autoComplete="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
        </div>
        {/* Information, not consent: the privacy policy is something we tell, not something
            to tick (same rule as the PDF form). Creating the account accepts the terms. */}
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("By creating an account you accept the", "Prin crearea contului accepți")}{" "}
          <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
            {t("Terms and conditions", "Termenii și condițiile")}
          </Link>
          {t(". How we use your data: ", ". Cum folosim datele: ")}
          <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
            {t("Privacy policy", "Politica de confidențialitate")}
          </Link>
          .
        </p>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Create account", "Creează cont")}
        </Button>
      </form>
    </AuthLayout>
  );
}

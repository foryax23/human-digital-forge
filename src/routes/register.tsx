import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoogleButton, AuthDivider } from "@/components/auth/GoogleButton";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

const title = "Create account | Vortex Hub";
const description = "Create a Vortex Hub client account to submit projects and track progress.";

export const Route = createFileRoute("/register")({
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
  const navigate = useNavigate();
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clientType, setClientType] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: fullName,
          client_type: clientType,
          company,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || t("Could not create your account.", "Nu s-a putut crea contul tău."));
      return;
    }
    if (data.session) {
      navigate({ to: "/dashboard" });
    } else {
      toast.success(t("Account created. Please check your email to confirm, then log in.", "Cont creat. Verificați emailul pentru confirmare, apoi autentificați-vă."));
      navigate({ to: "/login" });
    }
  }

  return (
    <AuthLayout
      heading={t("Create your client account.", "Creează-ți contul de client.")}
      intro={t("Submit projects, track progress and securely receive completed work.", "Trimite proiecte, urmărește progresul și primește lucrările finalizate în siguranță.")}
      footer={
        <span>
          {t("Already have an account?", "Ai deja cont?")}
          {" "}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            {t("Log in", "Conectează-te")}
          </Link>
        </span>
      }
    >
      <GoogleButton label={t("Sign up with Google", "Înregistrare cu Google")} />
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
                <SelectValue placeholder={t("Select one", "Selectați")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">{t("Individual", "Persoană fizică")}</SelectItem>
                <SelectItem value="business">{t("Business", "Companie")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">{t("Company name (optional)", "Nume companie (opțional)")}</Label>
            <Input
              id="company"
              autoComplete="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="agree" required className="mt-1" />
          <Label htmlFor="agree" className="text-sm font-normal leading-relaxed text-muted-foreground">
            {t("I agree to the", "Sunt de acord cu")}{" "}
            <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
              {t("Privacy Policy", "Politica de Confidențialitate")}
            </Link>
            .
          </Label>
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Create account", "Creează cont")}
        </Button>
      </form>
    </AuthLayout>
  );
}

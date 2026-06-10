import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

const title = "Reset password | Vortex Hub";
const description = "Set a new password for your Vortex Hub account.";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also check existing session in case the event already fired.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message || t("Could not update your password.", "Nu s-a putut actualiza parola."));
      return;
    }
    toast.success(t("Password updated. You're all set.", "Parola a fost actualizată. Totul este în regulă."));
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthLayout
      heading={t("Set a new password.", "Setează o parolă nouă.")}
      intro={t("Choose a strong password to secure your client account.", "Alegeți o parolă puternică pentru a vă securiza contul de client.")}
      footer={
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          {t("Back to login", "Înapoi la autentificare")}
        </Link>
      }
    >
      {ready ? (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password">{t("New password", "Parolă nouă")}</Label>
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
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("Update password", "Actualizează parola")}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t(
            "Open this page from the reset link in your email to set a new password.",
            "Deschideți această pagină din linkul de resetare din emailul dvs. pentru a seta o parolă nouă."
          )}
        </p>
      )}
    </AuthLayout>
  );
}

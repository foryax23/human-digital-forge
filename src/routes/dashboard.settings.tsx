import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [clientType, setClientType] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setCompany(profile?.company ?? "");
    setClientType(profile?.client_type ?? "");
  }, [profile]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        company: company.trim() || null,
        client_type: clientType || null,
      })
      .eq("id", user.id);
    setSaving(false);

    if (error) {
      console.error("[settings] update failed", error);
      toast.error(t("Could not save your changes. Please try again.", "Nu am putut salva modificările. Te rugăm să încerci din nou."));
      return;
    }
    await refreshProfile();
    toast.success(t("Your profile has been updated.", "Profilul tău a fost actualizat."));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl">{t("Settings", "Setări")}</h1>
      <p className="mt-1 text-muted-foreground">
        {t("Manage your profile details and how we address you.", "Gestionează detaliile profilului tău și modul în care te adresăm.")}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">{t("Email", "Email")}</Label>
          <Input id="email" value={user?.email ?? ""} disabled />
          <p className="text-xs text-muted-foreground">
            {t("Your email is linked to your account and can't be changed here.", "Adresa ta de email este legată de contul tău și nu poate fi modificată aici.")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">{t("Full name", "Nume complet")}</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("Your name", "Numele tău")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">{t("Company (optional)", "Companie (opțional)")}</Label>
          <Input
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={t("Your company", "Compania ta")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientType">{t("I'm working as", "Lucrez ca")}</Label>
          <Select value={clientType} onValueChange={setClientType}>
            <SelectTrigger id="clientType">
              <SelectValue placeholder={t("Select one", "Selectează una")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">{t("An individual", "Persoană fizică")}</SelectItem>
              <SelectItem value="business">{t("A business", "Companie")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" size="lg" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {t("Save changes", "Salvează modificările")}
        </Button>
      </form>
    </div>
  );
}

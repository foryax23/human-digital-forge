import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import {
  DataExportPanel,
  DeletionPanel,
  PasswordPanel,
} from "@/components/dashboard/AccountPanels";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button, Field, Panel, PanelBody, PanelHeader } from "@/components/system";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function ProfilePanel() {
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
    // The e-mail is never sent: it belongs to the sign-in account, not to the profile form.
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim().slice(0, 120) || null,
        company: company.trim().slice(0, 160) || null,
        client_type: clientType || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      console.error("[settings] update failed", error);
      toast.error(
        t(
          "Your changes were not saved. Please try again.",
          "Modificările nu au fost salvate. Încearcă din nou.",
        ),
      );
      return;
    }
    await refreshProfile();
    toast.success(t("Profile saved.", "Profilul a fost salvat."));
  }

  return (
    <Panel as="section" aria-labelledby="settings-profile">
      <PanelHeader
        titleAs="h2"
        titleId="settings-profile"
        title={t("Profile", "Profil")}
        sub={t("How we address you and your company.", "Cum ne adresăm ție și firmei tale.")}
      />
      <PanelBody>
        <form onSubmit={handleSubmit} className="grid max-w-md gap-4">
          <Field
            label={t("E-mail", "E-mail")}
            hint={t(
              "The address you sign in with. To change it, write to us.",
              "Adresa cu care te conectezi. Ca să o schimbi, scrie\u2011ne.",
            )}
          >
            <Input value={user?.email ?? ""} disabled readOnly />
          </Field>
          <Field label={t("Full name", "Nume complet")}>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              maxLength={120}
            />
          </Field>
          <Field label={t("Company", "Firmă")} optional>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              autoComplete="organization"
              maxLength={160}
            />
          </Field>
          <Field id="settings-client-type" label={t("You are", "Ești")} optional>
            <Select value={clientType} onValueChange={setClientType}>
              <SelectTrigger id="settings-client-type">
                <SelectValue placeholder={t("Choose one", "Alege")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">
                  {t("A private person", "Persoană fizică")}
                </SelectItem>
                <SelectItem value="business">{t("A business", "Firmă")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div>
            <Button type="submit" size="md" loading={saving} disabled={saving}>
              {t("Save", "Salvează")}
            </Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

function SettingsPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("Settings", "Setări")}
        lead={t(
          "Your profile, password and the data we keep about your account.",
          "Profilul, parola și datele pe care le păstrăm despre contul tău.",
        )}
      />
      <ProfilePanel />
      <PasswordPanel />
      <DataExportPanel />
      <DeletionPanel />
    </div>
  );
}

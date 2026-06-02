import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
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
      toast.error("Could not save your changes. Please try again.");
      return;
    }
    await refreshProfile();
    toast.success("Your profile has been updated.");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl">Settings</h1>
      <p className="mt-1 text-muted-foreground">
        Manage your profile details and how we address you.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user?.email ?? ""} disabled />
          <p className="text-xs text-muted-foreground">
            Your email is linked to your account and can't be changed here.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">Company (optional)</Label>
          <Input
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Your company"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientType">I'm working as</Label>
          <Select value={clientType} onValueChange={setClientType}>
            <SelectTrigger id="clientType">
              <SelectValue placeholder="Select one" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">An individual</SelectItem>
              <SelectItem value="business">A business</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" size="lg" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </form>
    </div>
  );
}

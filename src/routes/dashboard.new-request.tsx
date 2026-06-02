import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/dashboard/new-request")({
  component: NewRequestPage,
});

function NewRequestPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [service, setService] = useState<string>("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    if (!title || !description) return;

    setSubmitting(true);
    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      title,
      description,
      service_type: service || null,
      budget: String(form.get("budget") || "").trim() || null,
      timeline: String(form.get("timeline") || "").trim() || null,
      status: "Request submitted",
      current_step: 0,
      next_action: "We will review your brief shortly",
    });
    setSubmitting(false);

    if (error) {
      console.error("[new-request] insert failed", error);
      toast.error("Could not submit your request. Please try again.");
      return;
    }

    toast.success("Request submitted — we'll be in touch soon.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/dashboard">
          <ArrowLeft />
          Back to overview
        </Link>
      </Button>

      <h1 className="text-3xl">Start a new request</h1>
      <p className="mt-1 text-muted-foreground">
        Tell us what you need and we will turn it into a clear, tracked project.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Project title</Label>
          <Input id="title" name="title" required placeholder="e.g. New brand website" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="service">Service needed</Label>
          <Select value={service} onValueChange={setService}>
            <SelectTrigger id="service">
              <SelectValue placeholder="Select one" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="digital-product">Digital Product</SelectItem>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="ai-automation">AI Automation</SelectItem>
              <SelectItem value="consultancy">Consultancy</SelectItem>
              <SelectItem value="not-sure">Not sure yet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Brief description</Label>
          <Textarea id="description" name="description" rows={5} required />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="budget">Approximate budget (optional)</Label>
            <Input id="budget" name="budget" placeholder="e.g. €500–€1,500" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeline">Preferred timeline (optional)</Label>
            <Input id="timeline" name="timeline" placeholder="e.g. Within 4 weeks" />
          </div>
        </div>

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Submit request
        </Button>
      </form>
    </div>
  );
}

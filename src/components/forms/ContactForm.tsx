import { useState } from "react";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // UI only — no submission wired in this phase.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-teal/30 bg-teal/5 p-8 text-center">
        <h2 className="text-2xl">Thank you</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This is a design preview, so nothing was sent yet. We will review your request and respond
          with the clearest next step once submissions are connected.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" required autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="clientType">Client type</Label>
          <Select name="clientType">
            <SelectTrigger id="clientType">
              <SelectValue placeholder="Select one" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="service">Service needed</Label>
          <Select name="service">
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Brief description of the request</Label>
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

      <div className="space-y-2">
        <Label>Attachment (optional)</Label>
        <label
          htmlFor="file"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40"
        >
          <UploadCloud className="h-5 w-5" />
          <span>Upload a file (placeholder — uploads connect later)</span>
          <input id="file" name="file" type="file" className="sr-only" disabled />
        </label>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox id="consent" required className="mt-1" />
        <Label htmlFor="consent" className="text-sm font-normal leading-relaxed text-muted-foreground">
          I agree to Vortex Hub handling the information in this enquiry to respond to my request.
        </Label>
      </div>

      <Button type="submit" size="lg">
        Send enquiry
      </Button>
      <p className="text-sm text-muted-foreground">
        We will review your request and respond with the clearest next step.
      </p>
    </form>
  );
}

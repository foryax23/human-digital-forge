import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/billing")({
  component: BillingPage,
});

function BillingPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl">Billing</h1>
      <p className="mt-1 text-muted-foreground">
        Invoices and payment details for your projects.
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <CreditCard className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-2xl">Billing is on the way</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          We're putting the finishing touches on secure online payments and invoicing. For now,
          billing is handled directly with your project lead.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/contact">Ask about billing</Link>
        </Button>
      </div>
    </div>
  );
}

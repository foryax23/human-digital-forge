import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/consultations")({
  component: ConsultationsPage,
});

interface ConsultationItem {
  id: string;
  title: string;
  scheduled_at: string | null;
  status: string;
  notes: string | null;
}

function formatWhen(value: string | null) {
  if (!value) return "To be scheduled";
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConsultationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ConsultationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("consultations")
        .select("id, title, scheduled_at, status, notes")
        .order("scheduled_at", { ascending: true });
      if (!active) return;
      if (err) {
        console.error("[consultations] load failed", err);
        setError("We couldn't load your consultations. Please refresh to try again.");
      } else {
        setItems((data as ConsultationItem[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Consultations</h1>
          <p className="mt-1 text-muted-foreground">
            Your booked one-to-one sessions with the Vortex Hub team.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/consultancy">Book a session</Link>
        </Button>
      </div>

      {loading && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-teal/15 text-teal">
            <CalendarCheck className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-2xl">No consultations booked</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Book a session to talk through your goals and map out the best next steps.
          </p>
          <Button asChild className="mt-6">
            <Link to="/consultancy">Book a consultation</Link>
          </Button>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal/15 text-teal">
                  <CalendarCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg">{item.title}</h2>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatWhen(item.scheduled_at)}
                  </p>
                  {item.notes && <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MessagesSquare } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { MessageRow } from "@/hooks/use-dashboard-data";

export const Route = createFileRoute("/dashboard/messages")({
  component: MessagesPage,
});

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("messages")
        .select("id, body, sender, read, created_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (err) {
        console.error("[messages] load failed", err);
        setError("We couldn't load your messages. Please refresh to try again.");
      } else {
        setMessages((data as MessageRow[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl">Messages</h1>
      <p className="mt-1 text-muted-foreground">
        Updates and replies from your Vortex Hub team.
      </p>

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

      {!loading && !error && messages.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-teal/15 text-teal">
            <MessagesSquare className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-2xl">No messages yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            When your team shares an update it will appear here.
          </p>
        </div>
      )}

      {!loading && !error && messages.length > 0 && (
        <ul className="mt-8 space-y-3">
          {messages.map((message) => (
            <li
              key={message.id}
              className={cn(
                "rounded-2xl border bg-card p-5",
                message.read ? "border-border" : "border-primary/40",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {message.sender === "team" ? "Vortex Hub" : "You"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatWhen(message.created_at)}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{message.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

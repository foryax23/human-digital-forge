import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MessagesSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("messages")
      .select("id, body, sender, read, created_at")
      .order("created_at", { ascending: true });
    if (err) {
      console.error("[messages] load failed", err);
      setError("We couldn't load your messages. Please refresh to try again.");
    } else {
      setError(null);
      setMessages((data as MessageRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !user) return;

    setSending(true);
    try {
      const { data, error: err } = await supabase
        .from("messages")
        .insert({ user_id: user.id, body, sender: "client", read: true })
        .select("id, body, sender, read, created_at")
        .single();
      if (err) throw err;
      setMessages((prev) => [...prev, data as MessageRow]);
      setDraft("");
    } catch (err) {
      console.error("[messages] send failed", err);
      toast.error("Your message didn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <h1 className="text-3xl">Messages</h1>
      <p className="mt-1 text-muted-foreground">
        Talk directly with your Vortex Hub team.
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

      {!loading && !error && (
        <>
          {messages.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-teal/15 text-teal">
                <MessagesSquare className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-2xl">Start the conversation</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Send your first message below and your team will reply here.
              </p>
            </div>
          ) : (
            <ul className="mt-8 space-y-3">
              {messages.map((message) => {
                const mine = message.sender === "client";
                return (
                  <li
                    key={message.id}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl border p-4",
                        mine
                          ? "border-primary/30 bg-primary/10"
                          : "border-border bg-card",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          {mine ? "You" : "Vortex Hub"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatWhen(message.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {message.body}
                      </p>
                    </div>
                  </li>
                );
              })}
              <div ref={endRef} />
            </ul>
          )}

          <form onSubmit={handleSend} className="mt-6 rounded-2xl border border-border bg-card p-4">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message to your team…"
              rows={3}
              className="resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  void handleSend(e);
                }
              }}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</span>
              <Button type="submit" disabled={sending || !draft.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
